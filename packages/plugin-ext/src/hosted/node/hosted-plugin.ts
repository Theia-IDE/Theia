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

import { injectable, inject, multiInject, optional } from 'inversify';
import { ILogger, ConnectionErrorHandler } from '@theia/core/lib/common';
import { HostedPluginClient, ServerPluginRunner, DeployedPlugin } from '../../common/plugin-protocol';
import { LogPart } from '../../common/types';

export interface IPCConnectionOptions {
    readonly serverName: string;
    readonly logger: ILogger;
    readonly args: string[];
    readonly errorHandler?: ConnectionErrorHandler;
}

@injectable()
export class HostedPluginSupport {
    private client: HostedPluginClient;

    @inject(ILogger)
    protected readonly logger: ILogger;

    /**
     * Optional runners to delegate some work
     */
    @optional()
    @multiInject(ServerPluginRunner)
    private readonly pluginRunners: ServerPluginRunner[];

    setClient(client: HostedPluginClient): void {
        this.client = client;
        this.pluginRunners.forEach(runner => runner.setClient(client));
    }

    clientClosed(): void {
        this.pluginRunners.forEach(runner => runner.clientClosed());
    }

    onMessage(pluginHostId: string, message: string): void {
        this.withPluginRunner(pluginHostId, runner => runner.onMessage(pluginHostId, message));
    }

    getDeployedPluginIds(pluginHostId: string): string[] | PromiseLike<string[]> {
        return this.withPluginRunner(pluginHostId, runner => runner.getDeployedPluginIds(pluginHostId)) || [];
    }

    private withPluginRunner<T>(pluginHostId: string, what: (runner: ServerPluginRunner) => T): T | undefined {
        for (const runner of this.pluginRunners) {
            if (runner.acceptMessage(pluginHostId)) {
                return what(runner);
            }
        }
        this.logger.error('no runner found for ' + pluginHostId);
    }

    /**
     * Provides additional deployed plugins.
     */
    public async getDeployedPlugins(pluginHostId: string, pluginIds: string[]): Promise<DeployedPlugin[]> {
        return this.withPluginRunner(pluginHostId, runner => runner.getDeployedPlugins(pluginHostId, pluginIds)) || Promise.resolve([]);
    }

    public sendLog(logPart: LogPart): void {
        this.client.log(logPart);
    }

}
