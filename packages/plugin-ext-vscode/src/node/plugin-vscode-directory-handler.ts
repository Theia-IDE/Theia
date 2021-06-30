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

import * as fs from '@theia/core/shared/fs-extra';
import * as path from 'path';
import { injectable } from '@theia/core/shared/inversify';
import { RecursivePartial } from '@theia/core';
import {
    PluginDeployerDirectoryHandler,
    PluginDeployerEntry, PluginDeployerDirectoryHandlerContext,
    PluginDeployerEntryType, PluginPackage
} from '@theia/plugin-ext';

@injectable()
export class PluginVsCodeDirectoryHandler implements PluginDeployerDirectoryHandler {

    accept(plugin: PluginDeployerEntry): boolean {
        console.debug(`Resolving "${plugin.id()}" as a VS Code extension...`);
        return this.resolvePackage(plugin) || this.resolveFromSources(plugin) || this.resolveFromVSIX(plugin) || this.resolveFromNpmTarball(plugin);
    }

    async handle(context: PluginDeployerDirectoryHandlerContext): Promise<void> {
        context.pluginEntry().accept(PluginDeployerEntryType.BACKEND);
    }

    protected resolveFromSources(plugin: PluginDeployerEntry): boolean {
        const pluginPath = plugin.path();
        return this.resolvePackage(plugin, { pluginPath, pck: this.requirePackage(pluginPath) });
    }

    protected resolveFromVSIX(plugin: PluginDeployerEntry): boolean {
        if (!fs.existsSync(path.join(plugin.path(), 'extension.vsixmanifest'))) {
            return false;
        }
        const pluginPath = path.join(plugin.path(), 'extension');
        return this.resolvePackage(plugin, { pluginPath, pck: this.requirePackage(pluginPath) });
    }

    protected resolveFromNpmTarball(plugin: PluginDeployerEntry): boolean {
        const pluginPath = path.join(plugin.path(), 'package');
        return this.resolvePackage(plugin, { pluginPath, pck: this.requirePackage(pluginPath) });
    }

    protected resolvePackage(plugin: PluginDeployerEntry, options?: {
        pluginPath: string
        pck?: RecursivePartial<PluginPackage>
    }): boolean {
        const { pluginPath, pck } = options || {
            pluginPath: plugin.path(),
            pck: plugin.getValue('package.json')
        };
        if (!pck || !pck.name || !pck.version || !pck.engines || !pck.engines.vscode) {
            return false;
        }
        if (options) {
            plugin.storeValue('package.json', pck);
            plugin.rootPath = plugin.path();
            plugin.updatePath(pluginPath);
        }
        console.log(`Resolved "${plugin.id()}" to a VS Code extension "${pck.name}@${pck.version}" with engines:`, pck.engines);
        return true;
    }

    protected requirePackage(pluginPath: string): PluginPackage | undefined {
        try {
            return fs.readJSONSync(path.join(pluginPath, 'package.json'));
        } catch {
            return undefined;
        }
    }

}
