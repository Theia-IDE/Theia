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

import { inject, injectable } from '@theia/core/shared/inversify';
import * as cp from 'child_process';
import * as processTree from 'ps-tree';
import * as fs from '@theia/core/shared/fs-extra';
import * as path from 'path';
import { FileUri } from '@theia/core/lib/node';
import { HostedPluginSupport } from '@theia/plugin-ext/lib/hosted/node/hosted-plugin';
import { LogType } from '@theia/plugin-ext/lib/common/types';

export const HostedPluginsManager = Symbol('HostedPluginsManager');

export interface HostedPluginsManager {

    /**
     * Runs watcher script to recompile plugin on any changes along given path.
     *
     * @param uri uri to plugin root folder.
     */
    runWatchCompilation(uri: string): Promise<void>;

    /**
     * Stops watcher script.
     *
     * @param uri uri to plugin root folder.
     */
    stopWatchCompilation(uri: string): Promise<void>;

    /**
     * Checks if watcher script to recompile plugin is running.
     *
     * @param uri uri to plugin root folder.
     */
    isWatchCompilationRunning(uri: string): Promise<boolean>;
}

@injectable()
export class HostedPluginsManagerImpl implements HostedPluginsManager {

    @inject(HostedPluginSupport)
    protected readonly hostedPluginSupport: HostedPluginSupport;

    protected watchCompilationRegistry: Map<string, cp.ChildProcess>;

    constructor() {
        this.watchCompilationRegistry = new Map();
    }

    runWatchCompilation(uri: string): Promise<void> {
        const pluginRootPath = FileUri.fsPath(uri);

        if (this.watchCompilationRegistry.has(pluginRootPath)) {
            throw new Error('Watcher is already running in ' + pluginRootPath);
        }

        if (!this.checkWatchScript(pluginRootPath)) {
            this.hostedPluginSupport.sendLog({
                data: 'Plugin in ' + uri + ' doesn\'t have watch script',
                type: LogType.Error
            });
            throw new Error('Watch script doesn\'t exist in ' + pluginRootPath + 'package.json');
        }

        return this.runWatchScript(pluginRootPath);
    }

    private killProcessTree(parentPid: number): void {
        processTree(parentPid, (err: Error, childProcesses: Array<processTree.PS>) => {
            childProcesses.forEach((p: processTree.PS) => {
                process.kill(parseInt(p.PID));
            });
            process.kill(parentPid);
        });
    }

    stopWatchCompilation(uri: string): Promise<void> {
        const pluginPath = FileUri.fsPath(uri);

        const watchProcess = this.watchCompilationRegistry.get(pluginPath);
        if (!watchProcess) {
            throw new Error('Watcher is not running in ' + pluginPath);
        }

        this.killProcessTree(watchProcess.pid);
        return Promise.resolve();
    }

    isWatchCompilationRunning(uri: string): Promise<boolean> {
        const pluginPath = FileUri.fsPath(uri);

        return new Promise(resolve => resolve(this.watchCompilationRegistry.has(pluginPath)));
    }

    protected runWatchScript(pluginRootPath: string): Promise<void> {
        const watchProcess = cp.spawn('yarn', ['run', 'watch'], { cwd: pluginRootPath, shell: true });
        watchProcess.on('exit', () => this.unregisterWatchScript(pluginRootPath));

        this.watchCompilationRegistry.set(pluginRootPath, watchProcess);
        this.hostedPluginSupport.sendLog({
            data: 'Compilation watcher has been started in ' + pluginRootPath,
            type: LogType.Info
        });
        return Promise.resolve();
    }

    protected unregisterWatchScript(pluginRootPath: string): void {
        this.watchCompilationRegistry.delete(pluginRootPath);
        this.hostedPluginSupport.sendLog({
            data: 'Compilation watcher has been stopped in ' + pluginRootPath,
            type: LogType.Info
        });
    }

    /**
     * Checks whether watch script is present into package.json by given parent folder.
     *
     * @param pluginPath path to plugin's root directory
     */
    protected checkWatchScript(pluginPath: string): boolean {
        const pluginPackageJsonPath = path.join(pluginPath, 'package.json');
        if (fs.existsSync(pluginPackageJsonPath)) {
            const packageJson = fs.readJSONSync(pluginPackageJsonPath);
            const scripts = packageJson['scripts'];
            if (scripts && scripts['watch']) {
                return true;
            }
        }
        return false;
    }

}
