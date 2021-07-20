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

import {
    PLUGIN_RPC_CONTEXT,
    NotificationMain,
    MainMessageType,
    MessageRegistryMain,
    PluginManagerExt,
    PluginManager,
    Plugin,
    PluginAPI,
    ConfigStorage,
    PluginManagerInitializeParams,
    PluginManagerStartParams,
    TerminalServiceExt
} from '../common/plugin-api-rpc';
import { PluginMetadata, PluginJsonValidationContribution } from '../common/plugin-protocol';
import * as theia from '@theia/plugin';
import { join } from './path';
import { EnvExtImpl } from './env';
import { PreferenceRegistryExtImpl } from './preference-registry';
import { Memento, KeyValueStorageProxy } from './plugin-storage';
import { ExtPluginApi } from '../common/plugin-ext-api-contribution';
import { RPCProtocol } from '../common/rpc-protocol';
import { Emitter } from '@theia/core/lib/common/event';
import { WebviewsExtImpl } from './webviews';
import { URI as Uri } from './types-impl';
import { SecretsExtImpl, SecretStorageExt } from '../plugin/secrets-ext';

export interface PluginHost {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loadPlugin(plugin: Plugin): any;

    init(data: PluginMetadata[]): Promise<[Plugin[], Plugin[]]> | [Plugin[], Plugin[]];

    initExtApi(extApi: ExtPluginApi[]): void;

    loadTests?(): Promise<void>;
}

interface StopFn {
    (): void | Promise<void>;
}

interface StopOptions {
    /**
     * if terminating then stopping will ignore all errors,
     * since the main side is already gone and any requests are likely to fail
     * or hang
     */
    terminating: boolean
}

class ActivatedPlugin {
    constructor(public readonly pluginContext: theia.PluginContext,
        public readonly exports?: PluginAPI,
        public readonly stopFn?: StopFn) {
    }
}

export class PluginManagerExtImpl implements PluginManagerExt, PluginManager {

    static SUPPORTED_ACTIVATION_EVENTS = new Set([
        '*',
        'onLanguage',
        'onCommand',
        'onDebug', 'onDebugInitialConfigurations', 'onDebugResolve', 'onDebugAdapterProtocolTracker',
        'workspaceContains',
        'onView',
        'onUri',
        'onWebviewPanel',
        'onFileSystem',
        'onCustomEditor',
        'onStartupFinished'
    ]);

    private configStorage: ConfigStorage | undefined;
    private readonly registry = new Map<string, Plugin>();
    private readonly activations = new Map<string, (() => Promise<void>)[] | undefined>();
    /** promises to whether loading each plugin has been successful */
    private readonly loadedPlugins = new Map<string, Promise<boolean>>();
    private readonly activatedPlugins = new Map<string, ActivatedPlugin>();
    private readonly pluginContextsMap = new Map<string, theia.PluginContext>();

    private onDidChangeEmitter = new Emitter<void>();
    private messageRegistryProxy: MessageRegistryMain;
    private notificationMain: NotificationMain;
    protected fireOnDidChange(): void {
        this.onDidChangeEmitter.fire(undefined);
    }

    protected jsonValidation: PluginJsonValidationContribution[] = [];

    constructor(
        private readonly host: PluginHost,
        private readonly envExt: EnvExtImpl,
        private readonly terminalService: TerminalServiceExt,
        private readonly storageProxy: KeyValueStorageProxy,
        private readonly secrets: SecretsExtImpl,
        private readonly preferencesManager: PreferenceRegistryExtImpl,
        private readonly webview: WebviewsExtImpl,
        private readonly rpc: RPCProtocol
    ) {
        this.messageRegistryProxy = this.rpc.getProxy(PLUGIN_RPC_CONTEXT.MESSAGE_REGISTRY_MAIN);
        this.notificationMain = this.rpc.getProxy(PLUGIN_RPC_CONTEXT.NOTIFICATION_MAIN);
    }

    async $stop(pluginId?: string): Promise<void> {
        if (!pluginId) {
            return this.stopAll();
        }
        this.registry.delete(pluginId);
        this.pluginContextsMap.delete(pluginId);
        this.loadedPlugins.delete(pluginId);
        const plugin = this.activatedPlugins.get(pluginId);
        if (!plugin) {
            return;
        }
        this.activatedPlugins.delete(pluginId);
        return this.stopPlugin(pluginId, plugin);
    }

    async terminate(): Promise<void> {
        return this.stopAll({ terminating: true });
    }

    protected async stopAll(options: StopOptions = { terminating: false }): Promise<void> {
        const promises = [];
        for (const [id, plugin] of this.activatedPlugins) {
            promises.push(this.stopPlugin(id, plugin, options));
        }

        this.registry.clear();
        this.loadedPlugins.clear();
        this.activatedPlugins.clear();
        this.pluginContextsMap.clear();
        await Promise.all(promises);
    }

    protected async stopPlugin(id: string, plugin: ActivatedPlugin, options: StopOptions = { terminating: false }): Promise<void> {
        let result;
        if (plugin.stopFn) {
            try {
                result = plugin.stopFn();
            } catch (e) {
                if (!options.terminating) {
                    console.error(`[${id}]: failed to stop:`, e);
                }
            }
        }

        const pluginContext = plugin.pluginContext;
        if (pluginContext) {
            for (const subscription of pluginContext.subscriptions) {
                try {
                    subscription.dispose();
                } catch (e) {
                    if (!options.terminating) {
                        console.error(`[${id}]: failed to dispose subscription:`, e);
                    }
                }
            }
        }

        try {
            await result;
        } catch (e) {
            if (!options.terminating) {
                console.error(`[${id}]: failed to stop:`, e);
            }
        }
    }

    async $init(params: PluginManagerInitializeParams): Promise<void> {
        this.storageProxy.init(params.globalState, params.workspaceState);

        this.envExt.setQueryParameters(params.env.queryParams);
        this.envExt.setLanguage(params.env.language);
        this.envExt.setShell(params.env.shell);
        this.envExt.setUIKind(params.env.uiKind);
        this.envExt.setApplicationName(params.env.appName);

        this.preferencesManager.init(params.preferences);

        if (params.extApi) {
            this.host.initExtApi(params.extApi);
        }

        this.webview.init(params.webview);
        this.jsonValidation = params.jsonValidation;
    }

    async $start(params: PluginManagerStartParams): Promise<void> {
        this.configStorage = params.configStorage;

        const [plugins, foreignPlugins] = await this.host.init(params.plugins);
        // add foreign plugins
        for (const plugin of foreignPlugins) {
            this.registerPlugin(plugin);
        }
        // add own plugins, before initialization
        for (const plugin of plugins) {
            this.registerPlugin(plugin);
        }

        // run eager plugins
        await this.$activateByEvent('*');
        for (const activationEvent of params.activationEvents) {
            await this.$activateByEvent(activationEvent);
        }

        if (this.host.loadTests) {
            return this.host.loadTests();
        }

        this.fireOnDidChange();
    }

    protected registerPlugin(plugin: Plugin): void {
        if (plugin.model.id === 'vscode.json-language-features' && this.jsonValidation.length) {
            // VS Code contribute all built-in validations via vscode.json-language-features
            // we enrich them with Theia validations registered on the startup
            // dynamic validations can be provided only via VS Code extensions
            // content is fetched by the extension later via vscode.workspace.openTextDocument
            const contributes = plugin.rawModel.contributes = (plugin.rawModel.contributes || {});
            contributes.jsonValidation = (contributes.jsonValidation || []).concat(this.jsonValidation);
        }
        this.registry.set(plugin.model.id, plugin);
        if (plugin.pluginPath && Array.isArray(plugin.rawModel.activationEvents)) {
            const activation = () => this.$activatePlugin(plugin.model.id);
            // an internal activation event is a subject to change
            this.setActivation(`onPlugin:${plugin.model.id}`, activation);
            const unsupportedActivationEvents = plugin.rawModel.activationEvents.filter(e => !PluginManagerExtImpl.SUPPORTED_ACTIVATION_EVENTS.has(e.split(':')[0]));
            if (unsupportedActivationEvents.length) {
                console.warn(`Unsupported activation events: ${unsupportedActivationEvents.join(', ')}, please open an issue: https://github.com/eclipse-theia/theia/issues/new`);
            }
            for (let activationEvent of plugin.rawModel.activationEvents) {
                if (activationEvent === 'onUri') {
                    activationEvent = `onUri:theia://${plugin.model.id}`;
                }
                this.setActivation(activationEvent, activation);
            }
        }
    }
    protected setActivation(activationEvent: string, activation: () => Promise<void>): void {
        const activations = this.activations.get(activationEvent) || [];
        activations.push(activation);
        this.activations.set(activationEvent, activations);
    }

    protected async loadPlugin(plugin: Plugin, configStorage: ConfigStorage, visited = new Set<string>()): Promise<boolean> {
        // in order to break cycles
        if (visited.has(plugin.model.id)) {
            return true;
        }
        visited.add(plugin.model.id);

        let loading = this.loadedPlugins.get(plugin.model.id);
        if (!loading) {
            loading = (async () => {
                const progressId = await this.notificationMain.$startProgress({
                    title: `Activating ${plugin.model.displayName || plugin.model.name}`,
                    location: 'window'
                });
                try {
                    if (plugin.rawModel.extensionDependencies) {
                        for (const dependencyId of plugin.rawModel.extensionDependencies) {
                            const dependency = this.registry.get(dependencyId.toLowerCase());
                            if (dependency) {
                                const loadedSuccessfully = await this.loadPlugin(dependency, configStorage, visited);
                                if (!loadedSuccessfully) {
                                    throw new Error(`Dependent extension '${dependency.model.displayName || dependency.model.id}' failed to activate.`);
                                }
                            } else {
                                throw new Error(`Dependent extension '${dependencyId}' is not installed.`);
                            }
                        }
                    }

                    let pluginMain = this.host.loadPlugin(plugin);
                    // see https://github.com/TypeFox/vscode/blob/70b8db24a37fafc77247de7f7cb5bb0195120ed0/src/vs/workbench/api/common/extHostExtensionService.ts#L372-L376
                    pluginMain = pluginMain || {};
                    await this.startPlugin(plugin, configStorage, pluginMain);
                    return true;
                } catch (err) {
                    const message = `Activating extension '${plugin.model.displayName || plugin.model.name}' failed:`;
                    this.messageRegistryProxy.$showMessage(MainMessageType.Error, message + ' ' + err.message, {}, []);
                    console.error(message, err);
                    return false;
                } finally {
                    this.notificationMain.$stopProgress(progressId);
                }
            })();
        }
        this.loadedPlugins.set(plugin.model.id, loading);
        return loading;
    }

    async $updateStoragePath(path: string | undefined): Promise<void> {
        if (this.configStorage) {
            this.configStorage.hostStoragePath = path;
        }
        this.pluginContextsMap.forEach((pluginContext: theia.PluginContext, pluginId: string) => {
            pluginContext.storagePath = path ? join(path, pluginId) : undefined;
        });
    }

    async $activateByEvent(activationEvent: string): Promise<void> {
        const activations = this.activations.get(activationEvent);
        if (!activations) {
            return;
        }
        this.activations.set(activationEvent, undefined);
        const pendingActivations = [];
        while (activations.length) {
            pendingActivations.push(activations.pop()!());
        }
        await Promise.all(pendingActivations);
    }

    async $activatePlugin(id: string): Promise<void> {
        const plugin = this.registry.get(id);
        if (plugin && this.configStorage) {
            await this.loadPlugin(plugin, this.configStorage);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async startPlugin(plugin: Plugin, configStorage: ConfigStorage, pluginMain: any): Promise<void> {
        const subscriptions: theia.Disposable[] = [];
        const asAbsolutePath = (relativePath: string): string => join(plugin.pluginFolder, relativePath);
        const logPath = join(configStorage.hostLogPath, plugin.model.id); // todo check format
        const storagePath = configStorage.hostStoragePath ? join(configStorage.hostStoragePath, plugin.model.id) : undefined;
        const secrets = new SecretStorageExt(plugin, this.secrets);
        const globalStoragePath = join(configStorage.hostGlobalStoragePath, plugin.model.id);
        const pluginContext: theia.PluginContext = {
            extensionPath: plugin.pluginFolder,
            extensionUri: Uri.file(plugin.pluginFolder),
            globalState: new Memento(plugin.model.id, true, this.storageProxy),
            workspaceState: new Memento(plugin.model.id, false, this.storageProxy),
            subscriptions: subscriptions,
            asAbsolutePath: asAbsolutePath,
            logPath: logPath,
            storagePath: storagePath,
            storageUri: storagePath ? Uri.file(storagePath) : undefined,
            secrets,
            globalStoragePath: globalStoragePath,
            globalStorageUri: Uri.file(globalStoragePath),
            environmentVariableCollection: this.terminalService.getEnvironmentVariableCollection(plugin.model.id)
        };
        this.pluginContextsMap.set(plugin.model.id, pluginContext);

        let stopFn = undefined;
        if (typeof pluginMain[plugin.lifecycle.stopMethod] === 'function') {
            stopFn = pluginMain[plugin.lifecycle.stopMethod];
        }
        const id = plugin.model.displayName || plugin.model.id;
        if (typeof pluginMain[plugin.lifecycle.startMethod] === 'function') {
            const pluginExport = await pluginMain[plugin.lifecycle.startMethod].apply(getGlobal(), [pluginContext]);
            this.activatedPlugins.set(plugin.model.id, new ActivatedPlugin(pluginContext, pluginExport, stopFn));
        } else {
            // https://github.com/TypeFox/vscode/blob/70b8db24a37fafc77247de7f7cb5bb0195120ed0/src/vs/workbench/api/common/extHostExtensionService.ts#L400-L401
            console.log(`plugin ${id}, ${plugin.lifecycle.startMethod} method is undefined so the module is the extension's exports`);
            this.activatedPlugins.set(plugin.model.id, new ActivatedPlugin(pluginContext, pluginMain));
        }
    }

    getAllPlugins(): Plugin[] {
        return Array.from(this.registry.values());
    }
    getPluginExport(pluginId: string): PluginAPI | undefined {
        const activePlugin = this.activatedPlugins.get(pluginId);
        if (activePlugin) {
            return activePlugin.exports;
        }
        return undefined;
    }

    getPluginById(pluginId: string): Plugin | undefined {
        return this.registry.get(pluginId);
    }

    isRunning(pluginId: string): boolean {
        return this.registry.has(pluginId);
    }

    isActive(pluginId: string): boolean {
        return this.activatedPlugins.has(pluginId);
    }

    activatePlugin(pluginId: string): PromiseLike<void> {
        return this.$activatePlugin(pluginId);
    }

    get onDidChange(): theia.Event<void> {
        return this.onDidChangeEmitter.event;
    }

}

// for electron
function getGlobal(): Window | NodeJS.Global | null {
    return typeof self === 'undefined' ? typeof global === 'undefined' ? null : global : self;
}
