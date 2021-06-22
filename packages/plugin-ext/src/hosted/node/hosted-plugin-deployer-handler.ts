/********************************************************************************
 * Copyright (C) 2019 RedHat and others.
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

import * as fs from '@theia/core/shared/fs-extra';
import { injectable, inject } from '@theia/core/shared/inversify';
import { ILogger } from '@theia/core';
import { PluginDeployerHandler, PluginDeployerEntry, PluginEntryPoint, DeployedPlugin, PluginDependencies, Localization } from '../../common/plugin-protocol';
import { HostedPluginReader } from './plugin-reader';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { LocalizationProvider } from '@theia/core/lib/node/i18n/localization-provider';
import { Localization as TheiaLocalization } from '@theia/core/lib/common/i18n/localization';

@injectable()
export class HostedPluginDeployerHandler implements PluginDeployerHandler {

    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(HostedPluginReader)
    private readonly reader: HostedPluginReader;

    @inject(LocalizationProvider)
    private readonly localizationProvider: LocalizationProvider;

    private readonly deployedLocations = new Map<string, Set<string>>();

    /**
     * Managed plugin metadata backend entries.
     */
    private readonly deployedBackendPlugins = new Map<string, DeployedPlugin>();

    /**
     * Managed plugin metadata frontend entries.
     */
    private readonly deployedFrontendPlugins = new Map<string, DeployedPlugin>();

    private backendPluginsMetadataDeferred = new Deferred<void>();

    private frontendPluginsMetadataDeferred = new Deferred<void>();

    async getDeployedFrontendPluginIds(): Promise<string[]> {
        // await first deploy
        await this.frontendPluginsMetadataDeferred.promise;
        // fetch the last deployed state
        return [...this.deployedFrontendPlugins.keys()];
    }

    async getDeployedBackendPluginIds(): Promise<string[]> {
        // await first deploy
        await this.backendPluginsMetadataDeferred.promise;
        // fetch the last deployed state
        return [...this.deployedBackendPlugins.keys()];
    }

    getDeployedPlugin(pluginId: string): DeployedPlugin | undefined {
        const metadata = this.deployedBackendPlugins.get(pluginId);
        if (metadata) {
            return metadata;
        }
        return this.deployedFrontendPlugins.get(pluginId);
    }

    /**
     * @throws never! in order to isolate plugin deployment
     */
    async getPluginDependencies(entry: PluginDeployerEntry): Promise<PluginDependencies | undefined> {
        const pluginPath = entry.path();
        try {
            const manifest = await this.reader.readPackage(pluginPath);
            if (!manifest) {
                return undefined;
            }
            const metadata = this.reader.readMetadata(manifest);
            const dependencies: PluginDependencies = { metadata };
            dependencies.mapping = this.reader.readDependencies(manifest);
            return dependencies;
        } catch (e) {
            console.error(`Failed to load plugin dependencies from '${pluginPath}' path`, e);
            return undefined;
        }
    }

    async deployFrontendPlugins(frontendPlugins: PluginDeployerEntry[]): Promise<void> {
        for (const plugin of frontendPlugins) {
            await this.deployPlugin(plugin, 'frontend');
        }
        // resolve on first deploy
        this.frontendPluginsMetadataDeferred.resolve(undefined);
    }

    async deployBackendPlugins(backendPlugins: PluginDeployerEntry[]): Promise<void> {
        for (const plugin of backendPlugins) {
            await this.deployPlugin(plugin, 'backend');
        }
        // resolve on first deploy
        this.backendPluginsMetadataDeferred.resolve(undefined);
    }

    /**
     * @throws never! in order to isolate plugin deployment
     */
    protected async deployPlugin(entry: PluginDeployerEntry, entryPoint: keyof PluginEntryPoint): Promise<void> {
        const pluginPath = entry.path();
        try {
            const manifest = await this.reader.readPackage(pluginPath);
            if (!manifest) {
                return;
            }

            const metadata = this.reader.readMetadata(manifest);

            const deployedLocations = this.deployedLocations.get(metadata.model.id) || new Set<string>();
            deployedLocations.add(entry.rootPath);
            this.deployedLocations.set(metadata.model.id, deployedLocations);

            const deployedPlugins = entryPoint === 'backend' ? this.deployedBackendPlugins : this.deployedFrontendPlugins;
            if (deployedPlugins.has(metadata.model.id)) {
                return;
            }

            const { type } = entry;
            const deployed: DeployedPlugin = { metadata, type };
            deployed.contributes = this.reader.readContribution(manifest);
            if (deployed.contributes?.localizations) {
                this.localizationProvider.addLocalizations(...buildTheiaLocalizations(deployed.contributes.localizations));
            }
            deployedPlugins.set(metadata.model.id, deployed);
            this.logger.info(`Deploying ${entryPoint} plugin "${metadata.model.name}@${metadata.model.version}" from "${metadata.model.entryPoint[entryPoint] || pluginPath}"`);
        } catch (e) {
            console.error(`Failed to deploy ${entryPoint} plugin from '${pluginPath}' path`, e);
        }
    }

    async undeployPlugin(pluginId: string): Promise<boolean> {
        this.deployedBackendPlugins.delete(pluginId);
        this.deployedFrontendPlugins.delete(pluginId);
        const deployedLocations = this.deployedLocations.get(pluginId);
        if (!deployedLocations) {
            return false;
        }
        this.deployedLocations.delete(pluginId);
        for (const location of deployedLocations) {
            try {
                await fs.remove(location);
            } catch (e) {
                console.error(`[${pluginId}]: failed to undeploy from "${location}", reason`, e);
            }
        }
        return true;
    }
}

function buildTheiaLocalizations(localizations: Localization[]): TheiaLocalization[] {
    const theiaLocalizations: TheiaLocalization[] = [];
    for (const localization of localizations) {
        const theiaLocalization: TheiaLocalization = {
            languageId: localization.languageId,
            languageName: localization.languageName,
            localizedLanguageName: localization.localizedLanguageName,
            translations: {}
        };
        for (const translation of localization.translations) {
            for (const [scope, value] of Object.entries(translation.contents)) {
                for (const [key, item] of Object.entries(value)) {
                    const translationKey = buildTheiaTranslationKey(translation.id, scope, key);
                    theiaLocalization.translations[translationKey] = item;
                }
            }
        }
        theiaLocalizations.push(theiaLocalization);
    }
    return theiaLocalizations;
}

function buildTheiaTranslationKey(pluginId: string, scope: string, key: string): string {
    const scopeSlashIndex = scope.lastIndexOf('/');
    if (scopeSlashIndex >= 0) {
        scope = scope.substring(scopeSlashIndex + 1);
    }
    return `${pluginId}/${scope}/${key}`;
}
