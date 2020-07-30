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

import { Emitter } from '@theia/core/lib/common/event';
import { RPCProtocolImpl } from '../../../common/rpc-protocol';
import { PluginManagerExtImpl } from '../../../plugin/plugin-manager';
import { MAIN_RPC_CONTEXT, Plugin } from '../../../common/plugin-api-rpc';
import { getPluginId, PluginMetadata, PluginPackage } from '../../../common/plugin-protocol';
import { PreferenceRegistryExtImpl } from '../../../plugin/preference-registry';
import { ExtPluginApi } from '../../../common/plugin-ext-api-contribution';
import { EditorsAndDocumentsExtImpl } from '../../../plugin/editors-and-documents';
import { WorkspaceExtImpl } from '../../../plugin/workspace';
import { MessageRegistryExt } from '../../../plugin/message-registry';
import { WebviewsExtImpl } from '../../../plugin/webviews';
import { KeyValueStorageProxy } from '../../../plugin/plugin-storage';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = self as any;

const pluginsModulesNames = new Map<string, Plugin>();

const emitter = new Emitter();
const rpc = new RPCProtocolImpl({
    onMessage: emitter.event,
    send: (m: {}) => {
        ctx.postMessage(m);
    }
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
addEventListener('message', (message: any) => {
    emitter.fire(message.data);
});

const storageProxy = new KeyValueStorageProxy(rpc);
const editorsAndDocuments = new EditorsAndDocumentsExtImpl(rpc);
const messageRegistryExt = new MessageRegistryExt(rpc);
const workspaceExt = new WorkspaceExtImpl(rpc, editorsAndDocuments, messageRegistryExt);
const preferenceRegistryExt = new PreferenceRegistryExtImpl(rpc, workspaceExt);
const webviewExt = new WebviewsExtImpl(rpc, workspaceExt);

const pluginManager = new PluginManagerExtImpl({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loadPlugin(plugin: Plugin): any {
        if (plugin.pluginPath) {
            if (isElectron()) {
                ctx.importScripts(plugin.pluginPath);
            } else {
                ctx.importScripts('/hostedPlugin/' + getPluginId(plugin.model) + '/' + plugin.pluginPath);
            }
        }

        if (plugin.lifecycle.frontendModuleName) {
            if (!ctx[plugin.lifecycle.frontendModuleName]) {
                console.error(`WebWorker: Cannot start plugin "${plugin.model.name}". Frontend plugin not found: "${plugin.lifecycle.frontendModuleName}"`);
                return;
            }
            return ctx[plugin.lifecycle.frontendModuleName];
        }
    },
    init(rawPluginData: PluginMetadata[]): [Plugin[], Plugin[]] {
        const result: Plugin[] = [];
        const foreign: Plugin[] = [];
        for (const plg of rawPluginData) {
            const pluginModel = plg.model;
            const pluginLifecycle = plg.lifecycle;
            if (pluginModel.entryPoint!.frontend) {
                const plugin: Plugin = {
                    pluginPath: pluginModel.entryPoint.frontend!,
                    pluginFolder: pluginModel.packagePath,
                    model: pluginModel,
                    lifecycle: pluginLifecycle,
                    get rawModel(): PluginPackage {
                        throw new Error('not supported');
                    }
                };
                result.push(plugin);
                pluginsModulesNames.set(plugin.lifecycle.frontendModuleName!, plugin);
            } else {
                foreign.push({
                    pluginPath: pluginModel.entryPoint.backend,
                    pluginFolder: pluginModel.packagePath,
                    model: pluginModel,
                    lifecycle: pluginLifecycle,
                    get rawModel(): PluginPackage {
                        throw new Error('not supported');
                    }
                });
            }
        }

        return [result, foreign];
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initExtApi(extApi: { pluginApi: ExtPluginApi, initParameters?: any }[]): void {
        for (const api of extApi) {
            try {
                if (api.pluginApi.frontendExtApi) {
                    ctx.importScripts(api.pluginApi.frontendExtApi.initPath);
                    ctx[api.pluginApi.frontendExtApi.initVariable][api.pluginApi.frontendExtApi.initFunction](rpc, pluginsModulesNames, api.initParameters);
                }

            } catch (e) {
                console.error(e);
            }
        }
    }
}, rpc, storageProxy);

rpc.set(MAIN_RPC_CONTEXT.HOSTED_PLUGIN_MANAGER_EXT, pluginManager);
rpc.set(MAIN_RPC_CONTEXT.EDITORS_AND_DOCUMENTS_EXT, editorsAndDocuments);
rpc.set(MAIN_RPC_CONTEXT.WORKSPACE_EXT, workspaceExt);
rpc.set(MAIN_RPC_CONTEXT.PREFERENCE_REGISTRY_EXT, preferenceRegistryExt);
rpc.set(MAIN_RPC_CONTEXT.WEBVIEWS_EXT, webviewExt);

function isElectron(): boolean {
    if (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0) {
        return true;
    }

    return false;
}
