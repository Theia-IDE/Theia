/********************************************************************************
 * Copyright (C) 2019 Red Hat, Inc. and others.
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

import { PluginDevServer, DebugConfiguration, PluginDevClient } from '../common/plugin-dev-protocol';
import { injectable, inject } from 'inversify';
import { HostedInstanceManager } from './hosted-instance-manager';
import { PluginMetadata } from '@theia/plugin-ext/lib/common/plugin-protocol';
import URI from '@theia/core/lib/common/uri';
import { HostedPluginReader } from './hosted-plugin-reader';
import { HostedPluginsManager } from './hosted-plugins-manager';

@injectable()
export class PluginDevServerImpl implements PluginDevServer {

    @inject(HostedPluginsManager)
    protected readonly hostedPluginsManager: HostedPluginsManager;

    @inject(HostedInstanceManager)
    protected readonly hostedInstanceManager: HostedInstanceManager;

    @inject(HostedPluginReader)
    private readonly reader: HostedPluginReader;

    dispose(): void {
        // Terminate the hosted instance if it is currently running.
        if (this.hostedInstanceManager.isRunning()) {
            this.hostedInstanceManager.terminate();
        }
    }
    setClient(client: PluginDevClient): void {

    }

    async getHostedPlugin(): Promise<PluginMetadata | undefined> {
        return this.reader.getPlugin();
    }

    isPluginValid(uri: string): Promise<boolean> {
        return Promise.resolve(this.hostedInstanceManager.isPluginValid(new URI(uri)));
    }

    runHostedPluginInstance(uri: string): Promise<string> {
        return this.uriToStrPromise(this.hostedInstanceManager.run(new URI(uri)));
    }

    runDebugHostedPluginInstance(uri: string, debugConfig: DebugConfiguration): Promise<string> {
        return this.uriToStrPromise(this.hostedInstanceManager.debug(new URI(uri), debugConfig));
    }

    terminateHostedPluginInstance(): Promise<void> {
        this.hostedInstanceManager.terminate();
        return Promise.resolve();
    }

    isHostedPluginInstanceRunning(): Promise<boolean> {
        return Promise.resolve(this.hostedInstanceManager.isRunning());
    }

    getHostedPluginInstanceURI(): Promise<string> {
        return Promise.resolve(this.hostedInstanceManager.getInstanceURI().toString());
    }

    getHostedPluginURI(): Promise<string> {
        return Promise.resolve(this.hostedInstanceManager.getPluginURI().toString());
    }

    protected uriToStrPromise(promise: Promise<URI>): Promise<string> {
        return new Promise((resolve, reject) => {
            promise.then((uri: URI) => {
                resolve(uri.toString());
            }).catch(error => reject(error));
        });
    }

    runWatchCompilation(path: string): Promise<void> {
        return this.hostedPluginsManager.runWatchCompilation(path);
    }

    stopWatchCompilation(path: string): Promise<void> {
        return this.hostedPluginsManager.stopWatchCompilation(path);
    }

    isWatchCompilationRunning(path: string): Promise<boolean> {
        return this.hostedPluginsManager.isWatchCompilationRunning(path);
    }
}
