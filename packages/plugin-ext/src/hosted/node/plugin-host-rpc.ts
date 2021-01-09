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

import { PluginManagerExtImpl } from '../../plugin/plugin-manager';
import { MAIN_RPC_CONTEXT, Plugin, PluginAPIFactory } from '../../common/plugin-api-rpc';
import { PluginMetadata } from '../../common/plugin-protocol';
import { loadManifest } from './plugin-manifest-loader';
import { ExtPluginApi } from '../../common/plugin-ext-api-contribution';
import { EnvNodeExtImpl } from '../../plugin/node/env-node-ext';
import { DebugExtImpl } from '../../plugin/node/debug/debug';

/**
 * Handle the RPC calls.
 */
export class PluginHostRPC {
    private pluginManager: PluginManagerExtImpl;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(protected readonly rpc: any) {
    }

    initialize(): void {
        this.pluginManager = this.createPluginManager(this.rpc);
        this.rpc.set(MAIN_RPC_CONTEXT.HOSTED_PLUGIN_MANAGER_EXT, this.pluginManager);
    }

    async terminate(): Promise<void> {
        await this.pluginManager.terminate();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initContext(apiFactory: PluginAPIFactory, contextPath: string, plugin: Plugin): any {
        const { name, version } = plugin.rawModel;
        console.log('PLUGIN_HOST(' + process.pid + '): initializing(' + name + '@' + version + ' with ' + contextPath + ')');
        try {
            const backendInit = require(contextPath);
            backendInit.doInitialization(apiFactory, plugin);
        } catch (e) {
            console.error(e);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createPluginManager(rpc: any): PluginManagerExtImpl {
        const envExt = new EnvNodeExtImpl(this.rpc);
        const debugExt = new DebugExtImpl(this.rpc);

        const { extensionTestsPath } = process.env;
        const self = this;
        const pluginManager = new PluginManagerExtImpl({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            loadPlugin(plugin: Plugin): any {
                console.log('PLUGIN_HOST(' + process.pid + '): PluginManagerExtImpl/loadPlugin(' + plugin.pluginPath + ')');
                // cleaning the cache for all files of that plug-in.
                Object.keys(require.cache).forEach(function (key): void {
                    const mod: NodeJS.Module = require.cache[key];

                    // attempting to reload a native module will throw an error, so skip them
                    if (mod.id.endsWith('.node')) {
                        return;
                    }

                    // remove children that are part of the plug-in
                    let i = mod.children.length;
                    while (i--) {
                        const childMod: NodeJS.Module = mod.children[i];
                        // ensure the child module is not null, is in the plug-in folder, and is not a native module (see above)
                        if (childMod && childMod.id.startsWith(plugin.pluginFolder) && !childMod.id.endsWith('.node')) {
                            // cleanup exports - note that some modules (e.g. ansi-styles) define their
                            // exports in an immutable manner, so overwriting the exports throws an error
                            delete childMod.exports;
                            mod.children.splice(i, 1);
                            for (let j = 0; j < childMod.children.length; j++) {
                                delete childMod.children[j];
                            }
                        }
                    }

                    if (key.startsWith(plugin.pluginFolder)) {
                        // delete entry
                        delete require.cache[key];
                        const ix = mod.parent!.children.indexOf(mod);
                        if (ix >= 0) {
                            mod.parent!.children.splice(ix, 1);
                        }
                    }

                });
                if (plugin.pluginPath) {
                    return require(plugin.pluginPath);
                }
            },
            async init(apiFactory: PluginAPIFactory, raw: PluginMetadata[]): Promise<[Plugin[], Plugin[]]> {
                console.log('PLUGIN_HOST(' + process.pid + '): PluginManagerExtImpl/init()');
                const result: Plugin[] = [];
                const foreign: Plugin[] = [];
                for (const plg of raw) {
                    try {
                        const pluginModel = plg.model;
                        const pluginLifecycle = plg.lifecycle;

                        const rawModel = await loadManifest(pluginModel.packagePath);
                        rawModel.packagePath = pluginModel.packagePath;
                        if (pluginModel.entryPoint!.frontend) {
                            foreign.push({
                                pluginPath: pluginModel.entryPoint.frontend!,
                                pluginFolder: pluginModel.packagePath,
                                model: pluginModel,
                                lifecycle: pluginLifecycle,
                                rawModel
                            });
                        } else {
                            let backendInitPath = pluginLifecycle.backendInitPath;
                            // if no init path, try to init as regular Theia plugin
                            if (!backendInitPath) {
                                backendInitPath = __dirname + '/scanners/backend-init-theia.js';
                            }

                            const plugin: Plugin = {
                                pluginPath: pluginModel.entryPoint.backend!,
                                pluginFolder: pluginModel.packagePath,
                                model: pluginModel,
                                lifecycle: pluginLifecycle,
                                rawModel
                            };

                            self.initContext(apiFactory, backendInitPath, plugin);

                            result.push(plugin);
                        }
                    } catch (e) {
                        console.error(`Failed to initialize ${plg.model.id} plugin.`, e);
                    }
                }
                return [result, foreign];
            },
            initExtApi(extApi: ExtPluginApi[]): void {
                for (const api of extApi) {
                    if (api.backendInitPath) {
                        try {
                            const extApiInit = require(api.backendInitPath);
                            extApiInit.provideApi(rpc, pluginManager);
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }
            },
            loadTests: extensionTestsPath ? async () => {
                /* eslint-disable @typescript-eslint/no-explicit-any */
                // Require the test runner via node require from the provided path
                let testRunner: any;
                let requireError: Error | undefined;
                try {
                    testRunner = require(extensionTestsPath);
                } catch (error) {
                    requireError = error;
                }

                // Execute the runner if it follows our spec
                if (testRunner && typeof testRunner.run === 'function') {
                    return new Promise<void>((resolve, reject) => {
                        testRunner.run(extensionTestsPath, (error: any) => {
                            if (error) {
                                reject(error.toString());
                            } else {
                                resolve(undefined);
                            }
                        });
                    });
                }
                throw new Error(requireError ?
                    requireError.toString() :
                    `Path ${extensionTestsPath} does not point to a valid extension test runner.`
                );
            } : undefined
        }, envExt, debugExt, rpc);
        return pluginManager;
    }
}
