/********************************************************************************
 * Copyright (C) 2015-2018 Red Hat, Inc.
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

import { injectable, multiInject } from '@theia/core/shared/inversify';
import { PluginPackage, PluginScanner, PluginMetadata, PLUGIN_HOST_BACKEND } from '../../common/plugin-protocol';
@injectable()
export class MetadataScanner {
    private scanners: Map<string, PluginScanner> = new Map();

    constructor( // eslint-disable-next-line @typescript-eslint/indent
        @multiInject(PluginScanner) scanners: PluginScanner[]
    ) {
        scanners.forEach((scanner: PluginScanner) => {
            this.scanners.set(scanner.apiType, scanner);
        });
    }

    getPluginMetadata(plugin: PluginPackage): PluginMetadata {
        const scanner = this.getScanner(plugin);
        return {
            host: PLUGIN_HOST_BACKEND,
            model: scanner.getModel(plugin),
            lifecycle: scanner.getLifecycle(plugin)
        };
    }

    /**
     * Returns the first suitable scanner.
     *
     * Throws if no scanner was found.
     *
     * @param {PluginPackage} plugin
     * @returns {PluginScanner}
     */
    getScanner(plugin: PluginPackage): PluginScanner {
        let scanner: PluginScanner | undefined;
        if (plugin && plugin.engines) {
            const scanners = Object.keys(plugin.engines)
                .filter(engineName => this.scanners.has(engineName))
                .map(engineName => this.scanners.get(engineName)!);
            // get the first suitable scanner from the list
            scanner = scanners[0];
        }
        if (!scanner) {
            throw new Error('There is no suitable scanner found for ' + plugin.name);
        }
        return scanner;
    }
}
