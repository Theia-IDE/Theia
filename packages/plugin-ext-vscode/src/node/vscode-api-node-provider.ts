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
import * as theia from '@theia/plugin';
import { RPCProtocol } from '@theia/plugin-ext/lib/common/rpc-protocol';
import { Plugin, emptyPlugin, PluginManager, PluginAPIFactory } from '@theia/plugin-ext/lib/common/plugin-api-rpc';
import { ExtPluginApiBackendInitializationFn } from '@theia/plugin-ext/lib/common/plugin-ext-api-contribution';
import { createAPIFactory } from '@theia/plugin-ext/lib/plugin/plugin-context';
import { KeyValueStorageProxy } from '@theia/plugin-ext/lib/plugin/plugin-storage';

/* eslint-disable @typescript-eslint/no-explicit-any */

const pluginsApiImpl = new Map<string, typeof theia>();
let defaultApi: typeof theia;
let isLoadOverride = false;
let apiFactory: PluginAPIFactory;
let plugins: PluginManager;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const provideApi: ExtPluginApiBackendInitializationFn = (rpc: RPCProtocol, pluginManager: PluginManager, storageProxy: KeyValueStorageProxy, initParams?: any) => {
    apiFactory = createAPIFactory(pluginManager, rpc, storageProxy, initParams);
    plugins = pluginManager;

    if (!isLoadOverride) {
        overrideInternalLoad();
        isLoadOverride = true;
    }

};

function overrideInternalLoad(): void {
    const module = require('module');
    // save original load method
    const internalLoad = module._load;

    // if we try to resolve che module, return the filename entry to use cache.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    module._load = function (request: string, parent: any, isMain: {}): any {
        if (request !== 'vscode') {
            return internalLoad.apply(this, arguments);
        }

        const plugin = findPlugin(parent.filename);
        if (plugin) {
            let apiImpl = pluginsApiImpl.get(plugin.model.id);
            if (!apiImpl) {
                apiImpl = doInitialization(plugin);
                pluginsApiImpl.set(plugin.model.id, apiImpl);
            }
            return apiImpl;
        }

        if (!defaultApi) {
            console.warn(`Could not identify plugin for 'Che' require call from ${parent.filename}`);
            defaultApi = doInitialization(emptyPlugin);
        }

        return defaultApi;
    };
}

function findPlugin(filePath: string): Plugin | undefined {
    return plugins.getAllPlugins().find(plugin => filePath.startsWith(plugin.pluginFolder));
}

export default provideApi;

export const VSCODE_DEFAULT_API_VERSION = '1.44.0';

/** Set up en as a default locale for VS Code extensions using vscode-nls */
process.env['VSCODE_NLS_CONFIG'] = JSON.stringify({ locale: 'en', availableLanguages: {} });
process.env['VSCODE_PID'] = process.env['THEIA_PARENT_PID'];

export const doInitialization = (plugin: Plugin): typeof theia => {
    const api: typeof theia = apiFactory(plugin);

    // use Theia plugin api instead vscode extensions
    (<any>api).extensions = {
        get all(): any[] {
            return api.plugins.all.map(p => asExtension(p));
        },
        getExtension(pluginId: string): any | undefined {
            return asExtension(api.plugins.getPlugin(pluginId));
        },
        get onDidChange(): theia.Event<void> {
            return api.plugins.onDidChange;
        }
    };

    // override the version for vscode to be a VSCode version
    (<any>api).version = process.env['VSCODE_API_VERSION'] || VSCODE_DEFAULT_API_VERSION;
    return api;

};

function asExtension(plugin: any | undefined): typeof theia | undefined {
    if (!plugin) {
        return plugin;
    }
    if (plugin.pluginPath) {
        plugin.extensionPath = plugin.pluginPath;
    }
    return plugin;
}
