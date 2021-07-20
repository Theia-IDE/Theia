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
import { injectable, inject, named, postConstruct } from '@theia/core/shared/inversify';
import { HostedPluginServer, HostedPluginClient, PluginDeployer, GetDeployedPluginsParams, DeployedPlugin } from '../../common/plugin-protocol';
import { HostedPluginSupport } from './hosted-plugin';
import { ILogger, Disposable } from '@theia/core';
import { ContributionProvider } from '@theia/core';
import { ExtPluginApiProvider, ExtPluginApi } from '../../common/plugin-ext-api-contribution';
import { HostedPluginDeployerHandler } from './hosted-plugin-deployer-handler';
import { PluginDeployerImpl } from '../../main/node/plugin-deployer-impl';
import { LocalizationProvider } from '@theia/core/lib/node/i18n/localization-provider';
import { loadManifest } from './plugin-manifest-loader';

@injectable()
export class HostedPluginServerImpl implements HostedPluginServer {
    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(HostedPluginDeployerHandler)
    protected readonly deployerHandler: HostedPluginDeployerHandler;

    @inject(PluginDeployer)
    protected readonly pluginDeployer: PluginDeployerImpl;

    @inject(LocalizationProvider)
    protected readonly localizationProvider: LocalizationProvider;

    @inject(ContributionProvider)
    @named(Symbol.for(ExtPluginApiProvider))
    protected readonly extPluginAPIContributions: ContributionProvider<ExtPluginApiProvider>;

    protected client: HostedPluginClient | undefined;

    protected deployedListener: Disposable;

    constructor(
        @inject(HostedPluginSupport) private readonly hostedPlugin: HostedPluginSupport) {
    }

    @postConstruct()
    protected init(): void {
        this.deployedListener = this.pluginDeployer.onDidDeploy(() => {
            if (this.client) {
                this.client.onDidDeploy();
            }
        });
    }

    dispose(): void {
        this.hostedPlugin.clientClosed();
        this.deployedListener.dispose();
    }
    setClient(client: HostedPluginClient): void {
        this.client = client;
        this.hostedPlugin.setClient(client);
    }

    async getDeployedPluginIds(): Promise<string[]> {
        const backendMetadata = await this.deployerHandler.getDeployedBackendPluginIds();
        if (backendMetadata.length > 0) {
            this.hostedPlugin.runPluginServer();
        }
        const plugins = new Set<string>();
        for (const pluginId of await this.deployerHandler.getDeployedFrontendPluginIds()) {
            plugins.add(pluginId);
        }
        for (const pluginId of backendMetadata) {
            plugins.add(pluginId);
        }
        for (const pluginId of await this.hostedPlugin.getExtraDeployedPluginIds()) {
            plugins.add(pluginId);
        }
        return [...plugins.values()];
    }

    async getDeployedPlugins({ pluginIds }: GetDeployedPluginsParams): Promise<DeployedPlugin[]> {
        if (!pluginIds.length) {
            return [];
        }
        const locale = this.localizationProvider.getCurrentLanguage();
        const plugins = [];
        let extraDeployedPlugins: Map<string, DeployedPlugin> | undefined;
        for (const pluginId of pluginIds) {
            let plugin = this.deployerHandler.getDeployedPlugin(pluginId);
            if (!plugin) {
                if (!extraDeployedPlugins) {
                    extraDeployedPlugins = new Map<string, DeployedPlugin>();
                    for (const extraDeployedPlugin of await this.hostedPlugin.getExtraDeployedPlugins()) {
                        extraDeployedPlugins.set(extraDeployedPlugin.metadata.model.id, extraDeployedPlugin);
                    }
                }
                plugin = extraDeployedPlugins.get(pluginId);
            }
            if (plugin) {
                plugins.push(await this.localizePlugin(plugin, locale));
            }
        }
        return plugins;
    }

    onMessage(pluginHostId: string, message: string): Promise<void> {
        this.hostedPlugin.onMessage(pluginHostId, message);
        return Promise.resolve();
    }

    getExtPluginAPI(): Promise<ExtPluginApi[]> {
        return Promise.resolve(this.extPluginAPIContributions.getContributions().map(p => p.provideApi()));
    }

    protected async localizePlugin(plugin: DeployedPlugin, locale: string): Promise<DeployedPlugin> {
        plugin = { ...plugin };
        const packagePath = plugin.metadata.model.packagePath;
        const translatedManifest = await loadManifest(packagePath, locale);
        this.mergeContributes(plugin.contributes, translatedManifest.contributes);
        return plugin;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected mergeContributes(main: any, other: any): void {
        if (main && other) {
            if (Array.isArray(main) && Array.isArray(other)) {
                for (let i = 0; i < main.length && i < other.length; i++) {
                    if (typeof main[i] === 'object' && typeof other[i] === 'object') {
                        this.mergeContributes(main[i], other[i]);
                    }
                }
            } else {
                for (const [key, value] of Object.entries(main)) {
                    if (key in other) {
                        if (typeof value === 'string') {
                            main[key] = other[key];
                        } else if (typeof value === 'object' && typeof other[key] === 'object') {
                            this.mergeContributes(main[key], other[key]);
                        }
                    }
                }
            }
        }
    }
}
