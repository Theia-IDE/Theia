/********************************************************************************
 * Copyright (C) 2015-2021 Red Hat, Inc.
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

import * as path from 'path';
import { injectable } from '@theia/core/shared/inversify';
import { PluginScanner, PluginEngine, PluginPackage, PluginModel, PluginLifecycle } from '@theia/plugin-ext';
import { TheiaPluginScanner } from '@theia/plugin-ext/lib/hosted/node/scanners/scanner-theia';

@injectable()
export class VsCodePluginScanner extends TheiaPluginScanner implements PluginScanner {

    private readonly VSCODE_TYPE: PluginEngine = 'vscode';
    private readonly VSCODE_PREFIX: string = 'vscode:extension/';

    get apiType(): PluginEngine {
        return this.VSCODE_TYPE;
    }

    getModel(plugin: PluginPackage): PluginModel {
        // publisher can be empty on vscode extension development
        const publisher = plugin.publisher || '';
        const result: PluginModel = {
            packagePath: plugin.packagePath,
            packageUri: this.pluginUriFactory.createUri(plugin).toString(),
            // see id definition: https://github.com/microsoft/vscode/blob/15916055fe0cb9411a5f36119b3b012458fe0a1d/src/vs/platform/extensions/common/extensions.ts#L167-L169
            id: `${publisher.toLowerCase()}.${plugin.name.toLowerCase()}`,
            name: plugin.name,
            publisher: publisher,
            version: plugin.version,
            displayName: plugin.displayName,
            description: plugin.description,
            engine: {
                type: this.VSCODE_TYPE,
                version: plugin.engines[this.VSCODE_TYPE]
            },
            entryPoint: {
                backend: plugin.main
            },
            iconUrl: plugin.icon && PluginPackage.toPluginUrl(plugin, plugin.icon),
            readmeUrl: PluginPackage.toPluginUrl(plugin, './README.md'),
            licenseUrl: PluginPackage.toPluginUrl(plugin, './LICENSE')
        };
        return result;
    }

    /**
     * Maps extension dependencies to deployable extension dependencies.
     */
    getDependencies(plugin: PluginPackage): Map<string, string> | undefined {
        // Store the list of dependencies.
        const dependencies = new Map<string, string>();
        // Iterate through the list of dependencies from `extensionDependencies` and `extensionPack`.
        for (const dependency of [plugin.extensionDependencies, plugin.extensionPack]) {
            if (dependency !== undefined) {
                // Iterate over the list of dependencies present, and add them to the collection.
                dependency.forEach((dep: string) => {
                    const dependencyId = dep.toLowerCase();
                    dependencies.set(dependencyId, this.VSCODE_PREFIX + dependencyId);
                });
            }
        }
        // Return the map of dependencies if present, else `undefined`.
        return dependencies.size > 0 ? dependencies : undefined;
    }

    getLifecycle(plugin: PluginPackage): PluginLifecycle {
        return {
            startMethod: 'activate',
            stopMethod: 'deactivate',

            backendInitPath: path.join(__dirname, 'plugin-vscode-init'),
        };
    }

}
