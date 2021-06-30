/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
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
import * as path from 'path';
import { injectable, inject } from 'inversify';
import { Trace, IPCMessageReader, IPCMessageWriter, createMessageConnection, MessageConnection, Message } from 'vscode-ws-jsonrpc';
import { ILogger, ConnectionErrorHandler, DisposableCollection, Disposable } from '../../common';
import { createIpcEnv } from './ipc-protocol';

export interface ResolvedIPCConnectionOptions {
    readonly serverName: string
    readonly entryPoint: string
    readonly logger: ILogger
    readonly args: string[]
    readonly errorHandler?: ConnectionErrorHandler
    readonly env?: NodeJS.ProcessEnv
}
export type IPCConnectionOptions = Partial<ResolvedIPCConnectionOptions> & {
    readonly serverName: string
    readonly entryPoint: string
};

@injectable()
export class IPCConnectionProvider {

    @inject(ILogger)
    protected readonly logger: ILogger;

    listen(options: IPCConnectionOptions, acceptor: (connection: MessageConnection) => void): Disposable {
        return this.doListen({
            logger: this.logger,
            args: [],
            ...options
        }, acceptor);
    }

    protected doListen(options: ResolvedIPCConnectionOptions, acceptor: (connection: MessageConnection) => void): Disposable {
        const childProcess = this.fork(options);
        const connection = this.createConnection(childProcess, options);
        const toStop = new DisposableCollection();
        const toCancelStop = toStop.push(Disposable.create(() => childProcess.kill()));
        const errorHandler = options.errorHandler;
        if (errorHandler) {
            connection.onError((e: [Error, Message | undefined, number | undefined]) => {
                if (errorHandler.shouldStop(e[0], e[1], e[2])) {
                    toStop.dispose();
                }
            });
            connection.onClose(() => {
                if (toStop.disposed) {
                    return;
                }
                if (errorHandler.shouldRestart()) {
                    toCancelStop.dispose();
                    toStop.push(this.doListen(options, acceptor));
                }
            });
        }
        acceptor(connection);
        return toStop;
    }

    protected createConnection(childProcess: cp.ChildProcess, options: ResolvedIPCConnectionOptions): MessageConnection {
        const reader = new IPCMessageReader(childProcess);
        const writer = new IPCMessageWriter(childProcess);
        const connection = createMessageConnection(reader, writer, {
            error: (message: string) => this.logger.error(`[${options.serverName}: ${childProcess.pid}] ${message}`),
            warn: (message: string) => this.logger.warn(`[${options.serverName}: ${childProcess.pid}] ${message}`),
            info: (message: string) => this.logger.info(`[${options.serverName}: ${childProcess.pid}] ${message}`),
            log: (message: string) => this.logger.info(`[${options.serverName}: ${childProcess.pid}] ${message}`)
        });
        const traceVerbosity = this.logger.isDebug() ? Trace.Verbose : Trace.Off;
        connection.trace(traceVerbosity, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            log: (message: any, data?: string) => this.logger.debug(`[${options.serverName}: ${childProcess.pid}] ${message}` + (typeof data === 'string' ? ' ' + data : ''))
        });
        return connection;
    }

    protected fork(options: ResolvedIPCConnectionOptions): cp.ChildProcess {
        const forkOptions: cp.ForkOptions = {
            silent: true,
            env: createIpcEnv(options),
            execArgv: []
        };
        const inspectArgPrefix = `--${options.serverName}-inspect`;
        const inspectArg = process.argv.find(v => v.startsWith(inspectArgPrefix));
        if (inspectArg !== undefined) {
            forkOptions.execArgv = ['--nolazy', `--inspect${inspectArg.substr(inspectArgPrefix.length)}`];
        }

        const childProcess = cp.fork(path.join(__dirname, 'ipc-bootstrap'), options.args, forkOptions);
        childProcess.stdout!.on('data', data => this.logger.info(`[${options.serverName}: ${childProcess.pid}] ${data.toString().trim()}`));
        childProcess.stderr!.on('data', data => this.logger.error(`[${options.serverName}: ${childProcess.pid}] ${data.toString().trim()}`));

        this.logger.debug(`[${options.serverName}: ${childProcess.pid}] IPC started`);
        childProcess.once('exit', () => this.logger.debug(`[${options.serverName}: ${childProcess.pid}] IPC exited`));

        return childProcess;
    }

}
