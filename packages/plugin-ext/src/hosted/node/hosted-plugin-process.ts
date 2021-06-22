/********************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import * as cp from 'child_process';
import { injectable, inject, named } from '@theia/core/shared/inversify';
import { ILogger, ConnectionErrorHandler, ContributionProvider, MessageService } from '@theia/core/lib/common';
import { createIpcEnv } from '@theia/core/lib/node/messaging/ipc-protocol';
import { HostedPluginClient, ServerPluginRunner, PluginHostEnvironmentVariable, DeployedPlugin, PLUGIN_HOST_BACKEND } from '../../common/plugin-protocol';
import { MessageType } from '../../common/rpc-protocol';
import { HostedPluginCliContribution } from './hosted-plugin-cli-contribution';
import * as psTree from 'ps-tree';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { LocalizationProvider } from '@theia/core/lib/node/i18n/localization-provider';

export interface IPCConnectionOptions {
    readonly serverName: string;
    readonly logger: ILogger;
    readonly args: string[];
    readonly errorHandler?: ConnectionErrorHandler;
}

export const HostedPluginProcessConfiguration = Symbol('HostedPluginProcessConfiguration');
export interface HostedPluginProcessConfiguration {
    readonly path: string
}

@injectable()
export class HostedPluginProcess implements ServerPluginRunner {

    @inject(HostedPluginProcessConfiguration)
    protected configuration: HostedPluginProcessConfiguration;

    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(HostedPluginCliContribution)
    protected readonly cli: HostedPluginCliContribution;

    @inject(ContributionProvider)
    @named(PluginHostEnvironmentVariable)
    protected readonly pluginHostEnvironmentVariables: ContributionProvider<PluginHostEnvironmentVariable>;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(LocalizationProvider)
    protected readonly localizationProvider: LocalizationProvider;

    private childProcess: cp.ChildProcess | undefined;
    private client: HostedPluginClient;

    private terminatingPluginServer = false;

    public setClient(client: HostedPluginClient): void {
        if (this.client) {
            if (this.childProcess) {
                this.runPluginServer();
            }
        }
        this.client = client;
    }

    public clientClosed(): void {

    }

    public setDefault(defaultRunner: ServerPluginRunner): void {

    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public acceptMessage(pluginHostId: string, message: string): boolean {
        return pluginHostId === 'main';
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public onMessage(pluginHostId: string, jsonMessage: string): void {
        if (this.childProcess) {
            this.childProcess.send(jsonMessage);
        }
    }

    async terminatePluginServer(): Promise<void> {
        if (this.childProcess === undefined) {
            return;
        }

        this.terminatingPluginServer = true;
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const cp = this.childProcess;
        this.childProcess = undefined;

        const waitForTerminated = new Deferred<void>();
        cp.on('message', message => {
            const msg = JSON.parse(message);
            if ('type' in msg && msg.type === MessageType.Terminated) {
                waitForTerminated.resolve();
            }
        });
        const stopTimeout = this.cli.pluginHostStopTimeout;
        cp.send(JSON.stringify({ type: MessageType.Terminate, stopTimeout }));

        const terminateTimeout = this.cli.pluginHostTerminateTimeout;
        if (terminateTimeout) {
            await Promise.race([
                waitForTerminated.promise,
                new Promise(resolve => setTimeout(resolve, terminateTimeout))
            ]);
        } else {
            await waitForTerminated.promise;
        }

        this.killProcessTree(cp.pid);
    }

    killProcessTree(parentPid: number): void {
        psTree(parentPid, (_, childProcesses) => {
            childProcesses.forEach(childProcess =>
                this.killProcess(parseInt(childProcess.PID))
            );
            this.killProcess(parentPid);
        });
    }

    protected killProcess(pid: number): void {
        try {
            process.kill(pid);
        } catch (e) {
            if (e && 'code' in e && e.code === 'ESRCH') {
                return;
            }
            this.logger.error(`[${pid}] failed to kill`, e);
        }
    }

    public runPluginServer(): void {
        if (this.childProcess) {
            this.terminatePluginServer();
        }
        this.terminatingPluginServer = false;
        this.childProcess = this.fork({
            serverName: 'hosted-plugin',
            logger: this.logger,
            args: []
        });
        this.childProcess.on('message', message => {
            if (this.client) {
                this.client.postMessage(PLUGIN_HOST_BACKEND, message);
            }
        });
    }

    readonly HOSTED_PLUGIN_ENV_REGEXP_EXCLUSION = new RegExp('HOSTED_PLUGIN*');
    private fork(options: IPCConnectionOptions): cp.ChildProcess {

        // create env and add PATH to it so any executable from root process is available
        const env = createIpcEnv({ env: process.env });
        for (const key of Object.keys(env)) {
            if (this.HOSTED_PLUGIN_ENV_REGEXP_EXCLUSION.test(key)) {
                delete env[key];
            }
        }
        const availableLanguages = ['en', ...this.localizationProvider.getAvailableLanguages()];
        const locale = this.localizationProvider.getCurrentLanguage();
        env['VSCODE_NLS_CONFIG'] = JSON.stringify({ locale, availableLanguages });
        // apply external env variables
        this.pluginHostEnvironmentVariables.getContributions().forEach(envVar => envVar.process(env));
        if (this.cli.extensionTestsPath) {
            env.extensionTestsPath = this.cli.extensionTestsPath;
        }

        const forkOptions: cp.ForkOptions = {
            silent: true,
            env: env,
            execArgv: [],
            stdio: ['pipe', 'pipe', 'pipe', 'ipc']
        };
        const inspectArgPrefix = `--${options.serverName}-inspect`;
        const inspectArg = process.argv.find(v => v.startsWith(inspectArgPrefix));
        if (inspectArg !== undefined) {
            forkOptions.execArgv = ['--nolazy', `--inspect${inspectArg.substr(inspectArgPrefix.length)}`];
        }

        const childProcess = cp.fork(this.configuration.path, options.args, forkOptions);
        childProcess.stdout!.on('data', data => this.logger.info(`[${options.serverName}: ${childProcess.pid}] ${data.toString().trim()}`));
        childProcess.stderr!.on('data', data => this.logger.error(`[${options.serverName}: ${childProcess.pid}] ${data.toString().trim()}`));

        this.logger.debug(`[${options.serverName}: ${childProcess.pid}] IPC started`);
        childProcess.once('exit', (code: number, signal: string) => this.onChildProcessExit(options.serverName, childProcess.pid, code, signal));
        childProcess.on('error', err => this.onChildProcessError(err));
        return childProcess;
    }

    private onChildProcessExit(serverName: string, pid: number, code: number, signal: string): void {
        if (this.terminatingPluginServer) {
            return;
        }
        this.logger.error(`[${serverName}: ${pid}] IPC exited, with signal: ${signal}, and exit code: ${code}`);

        const message = 'Plugin runtime crashed unexpectedly, all plugins are not working, please reload the page.';
        let hintMessage: string = 'If it doesn\'t help, please check Theia server logs.';
        if (signal && signal.toUpperCase() === 'SIGKILL') {
            // May happen in case of OOM or manual force stop.
            hintMessage = 'Probably there is not enough memory for the plugins. ' + hintMessage;
        }

        this.messageService.error(message + ' ' + hintMessage, { timeout: 15 * 60 * 1000 });
    }

    private onChildProcessError(err: Error): void {
        this.logger.error(`Error from plugin host: ${err.message}`);
    }

    /**
     * Provides additional plugin ids.
     */
    public async getExtraDeployedPluginIds(): Promise<string[]> {
        return [];
    }

    /**
     * Provides additional deployed plugins.
     */
    public async getExtraDeployedPlugins(): Promise<DeployedPlugin[]> {
        return [];
    }

}
