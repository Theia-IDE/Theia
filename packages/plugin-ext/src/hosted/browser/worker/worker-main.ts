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
import { MAIN_RPC_CONTEXT, Plugin, emptyPlugin, PluginAPIFactory } from '../../../common/plugin-api-rpc';
import { getPluginId, PluginMetadata } from '../../../common/plugin-protocol';
import * as theia from '@theia/plugin';
import { ExtPluginApi } from '../../../common/plugin-ext-api-contribution';
import { createDebugExtStub } from './debug-stub';
import { WorkerEnvExtImpl } from './worker-env-ext';
import { loadManifest } from './plugin-manifest-loader';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = self as any;

const pluginsApiImpl = new Map<string, typeof theia>();
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
function initialize(contextPath: string, pluginMetadata: PluginMetadata): void {
    ctx.importScripts('/context/' + contextPath);
}
const envExt = new WorkerEnvExtImpl(rpc);
const debugExt = createDebugExtStub(rpc);

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
    async init(apiFactory: PluginAPIFactory, rawPluginData: PluginMetadata[]): Promise<[Plugin[], Plugin[]]> {
        const result: Plugin[] = [];
        const foreign: Plugin[] = [];
        // Process the plugins concurrently, making sure to keep the order.
        const plugins = await Promise.all<{
            /** Where to push the plugin: `result` or `foreign` */
            target: Plugin[],
            plugin: Plugin
        }>(rawPluginData.map(async plg => {
            const pluginModel = plg.model;
            const pluginLifecycle = plg.lifecycle;
            if (pluginModel.entryPoint!.frontend) {
                let frontendInitPath = pluginLifecycle.frontendInitPath;
                if (frontendInitPath) {
                    initialize(frontendInitPath, plg);
                } else {
                    frontendInitPath = '';
                }
                const rawModel = await loadManifest(pluginModel);
                const plugin: Plugin = {
                    pluginPath: pluginModel.entryPoint.frontend!,
                    pluginFolder: pluginModel.packagePath,
                    model: pluginModel,
                    lifecycle: pluginLifecycle,
                    rawModel
                };
                const apiImpl = apiFactory(plugin);
                pluginsApiImpl.set(plugin.model.id, apiImpl);
                pluginsModulesNames.set(plugin.lifecycle.frontendModuleName!, plugin);
                return { target: result, plugin };
            } else {
                return {
                    target: foreign,
                    plugin: {
                        pluginPath: pluginModel.entryPoint.backend,
                        pluginFolder: pluginModel.packagePath,
                        model: pluginModel,
                        lifecycle: pluginLifecycle,
                        get rawModel(): never {
                            throw new Error('not supported');
                        }
                    }
                };
            }
        }));
        // Collect the ordered plugins and insert them in the target array:
        for (const { target, plugin } of plugins) {
            target.push(plugin);
        }
        return [result, foreign];
    },
    initExtApi(extApi: ExtPluginApi[]): void {
        for (const api of extApi) {
            try {
                if (api.frontendExtApi) {
                    ctx.importScripts(api.frontendExtApi.initPath);
                    ctx[api.frontendExtApi.initVariable][api.frontendExtApi.initFunction](rpc, pluginsModulesNames);
                }

            } catch (e) {
                console.error(e);
            }
        }
    }
}, envExt, debugExt, rpc);

let defaultApi: typeof theia;

const handler = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (target: any, name: string) => {
        const plugin = pluginsModulesNames.get(name);
        if (plugin) {
            const apiImpl = pluginsApiImpl.get(plugin.model.id);
            return apiImpl;
        }

        if (!defaultApi) {
            defaultApi = pluginManager.apiFactory(emptyPlugin);
        }

        return defaultApi;
    }
};
ctx['theia'] = new Proxy(Object.create(null), handler);

rpc.set(MAIN_RPC_CONTEXT.HOSTED_PLUGIN_MANAGER_EXT, pluginManager);

function isElectron(): boolean {
    if (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0) {
        return true;
    }

    return false;
}
