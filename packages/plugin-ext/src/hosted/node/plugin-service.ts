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
import { injectable, inject, named } from 'inversify';
import { HostedPluginServer, HostedPluginClient, PluginDeployer, GetDeployedPluginsParams, DeployedPlugin } from '../../common/plugin-protocol';
import { HostedPluginSupport } from './hosted-plugin';
import { ILogger, DisposableCollection } from '@theia/core';
import { ContributionProvider } from '@theia/core';
import { ExtPluginApiProvider, ExtPluginApi } from '../../common/plugin-ext-api-contribution';
import { PluginDeployerImpl } from '../../main/node/plugin-deployer-impl';
import { HostedPluginProcess } from './hosted-plugin-process';

@injectable()
export class HostedPluginServerImpl implements HostedPluginServer {
    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(PluginDeployer)
    protected readonly pluginDeployer: PluginDeployerImpl;

    @inject(ContributionProvider)
    @named(Symbol.for(ExtPluginApiProvider))
    protected readonly extPluginAPIContributions: ContributionProvider<ExtPluginApiProvider>;

    protected client: HostedPluginClient | undefined;

    protected toDispose = new DisposableCollection();

    constructor(
        @inject(HostedPluginSupport) private readonly hostedPlugin: HostedPluginSupport) {
    }

    dispose(): void {
        this.hostedPlugin.clientClosed();
        this.toDispose.dispose();
    }
    setClient(client: HostedPluginClient): void {
        this.client = client;
        this.toDispose.push(this.pluginDeployer.onDidDeploy(() => {
            if (this.client) {
                this.client.onDidDeploy(HostedPluginProcess.PLUGIN_HOST_ID);
            }
        }));
        this.hostedPlugin.setClient(client);
    }

    async getDeployedPluginIds(pluginHostId: string): Promise<string[]> {
        return this.hostedPlugin.getDeployedPluginIds(pluginHostId);
    }

    async getDeployedPlugins({ pluginHostId, pluginIds }: GetDeployedPluginsParams): Promise<DeployedPlugin[]> {
        return this.hostedPlugin.getDeployedPlugins(pluginHostId, pluginIds);
    }

    onMessage(pluginHostId: string, message: string): Promise<void> {
        this.hostedPlugin.onMessage(pluginHostId, message);
        return Promise.resolve();
    }

    getExtPluginAPI(): Promise<ExtPluginApi[]> {
        return Promise.resolve(this.extPluginAPIContributions.getContributions().map(p => p.provideApi()));
    }
}
