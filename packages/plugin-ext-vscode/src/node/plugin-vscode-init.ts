/********************************************************************************
 * Copyright (C) 2018-2019 Red Hat, Inc.
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

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as theia from '@theia/plugin';
import { BackendInitializationFn, PluginAPIFactory, Plugin, emptyPlugin } from '@theia/plugin-ext';
import { VSCODE_DEFAULT_API_VERSION } from '../common/plugin-vscode-types';

process.env['VSCODE_PID'] = process.env['THEIA_PARENT_PID'];

const pluginsApiImpl = new Map<string, typeof theia>();
const plugins = new Array<Plugin>();
let defaultApi: typeof theia;
let isLoadOverride = false;
let pluginApiFactory: PluginAPIFactory;

export enum ExtensionKind {
    UI = 1,
    Workspace = 2
}

export const doInitialization: BackendInitializationFn = (apiFactory: PluginAPIFactory, plugin: Plugin) => {
    const vscode = Object.assign(apiFactory(plugin), { ExtensionKind });

    // use Theia plugin api instead vscode extensions
    (<any>vscode).extensions = {
        get all(): any[] {
            return vscode.plugins.all.map(p => asExtension(p));
        },
        getExtension(pluginId: string): any | undefined {
            return asExtension(vscode.plugins.getPlugin(pluginId));
        },
        get onDidChange(): theia.Event<void> {
            return vscode.plugins.onDidChange;
        }
    };

    // override the version for vscode to be a VSCode version
    (<any>vscode).version = process.env['VSCODE_API_VERSION'] || VSCODE_DEFAULT_API_VERSION;

    pluginsApiImpl.set(plugin.model.id, vscode);
    plugins.push(plugin);
    pluginApiFactory = apiFactory;

    if (!isLoadOverride) {
        overrideInternalLoad();
        isLoadOverride = true;
    }
};

function overrideInternalLoad(): void {
    const module = require('module');
    const vscodeModuleName = 'vscode';
    // save original load method
    const internalLoad = module._load;

    // if we try to resolve theia module, return the filename entry to use cache.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    module._load = function (request: string, parent: any, isMain: {}): any {
        if (request !== vscodeModuleName) {
            return internalLoad.apply(this, arguments);
        }

        const plugin = findPlugin(parent.filename);
        if (plugin) {
            const apiImpl = pluginsApiImpl.get(plugin.model.id);
            return apiImpl;
        }

        if (!defaultApi) {
            console.warn(`Could not identify plugin for 'Theia' require call from ${parent.filename}`);
            defaultApi = pluginApiFactory(emptyPlugin);
        }

        return defaultApi;
    };
}

function findPlugin(filePath: string): Plugin | undefined {
    return plugins.find(plugin => filePath.startsWith(plugin.pluginFolder));
}

function asExtension(plugin: any | undefined): any | undefined {
    if (!plugin) {
        return plugin;
    }
    if (plugin.pluginPath) {
        plugin.extensionPath = plugin.pluginPath;
    }

    if (plugin.pluginUri) {
        plugin.extensionUri = plugin.pluginUri;
    }
    // stub as a local VS Code extension (not running on a remote workspace)
    plugin.extensionKind = ExtensionKind.UI;
    return plugin;
}
