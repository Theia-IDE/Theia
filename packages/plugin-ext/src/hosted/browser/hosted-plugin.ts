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
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// some code copied and modified from https://github.com/microsoft/vscode/blob/da5fb7d5b865aa522abc7e82c10b746834b98639/src/vs/workbench/api/node/extHostExtensionService.ts

/* eslint-disable @typescript-eslint/no-explicit-any */

import debounce = require('lodash.debounce');
import { UUID } from '@phosphor/coreutils';
import { injectable, inject, interfaces, named, postConstruct } from 'inversify';
import { PluginWorker } from '../../main/browser/plugin-worker';
import { PluginMetadata, getPluginId, HostedPluginServer, DeployedPlugin } from '../../common/plugin-protocol';
import { HostedPluginWatcher } from './hosted-plugin-watcher';
import { MAIN_RPC_CONTEXT, PluginManagerExt } from '../../common/plugin-api-rpc';
import { RPCProtocolPluginAPIFactory } from '../../main/browser/main-context';
import { RPCProtocol, RPCProtocolImpl } from '../../common/rpc-protocol';
import {
    Disposable, DisposableCollection,
    ILogger, ContributionProvider, CommandRegistry, WillExecuteCommandEvent,
    CancellationTokenSource, JsonRpcProxy, ProgressService
} from '@theia/core';
import { PreferenceServiceImpl, PreferenceProviderProvider } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { PluginContributionHandler } from '../../main/browser/plugin-contribution-handler';
import { getQueryParameters } from '../../main/browser/env-main';
import { MainPluginApiProvider } from '../../common/plugin-ext-api-contribution';
import { PluginPathsService } from '../../main/common/plugin-paths-protocol';
import { getPreferences } from '../../main/browser/preference-registry-main';
import { PluginServer } from '../../common/plugin-protocol';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { DebugSessionManager } from '@theia/debug/lib/browser/debug-session-manager';
import { DebugConfigurationManager } from '@theia/debug/lib/browser/debug-configuration-manager';
import { WaitUntilEvent } from '@theia/core/lib/common/event';
import { FileSearchService } from '@theia/file-search/lib/common/file-search-service';
import { Emitter, isCancelled } from '@theia/core';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import { PluginViewRegistry } from '../../main/browser/view/plugin-view-registry';
import { TaskProviderRegistry, TaskResolverRegistry } from '@theia/task/lib/browser/task-contribution';
import { WebviewEnvironment } from '../../main/browser/webview/webview-environment';
import { WebviewWidget } from '../../main/browser/webview/webview';
import { WidgetManager } from '@theia/core/lib/browser/widget-manager';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';

export type PluginHost = 'frontend' | string;
export type DebugActivationEvent = 'onDebugResolve' | 'onDebugInitialConfigurations' | 'onDebugAdapterProtocolTracker';

export const PluginProgressLocation = 'plugin';

@injectable()
export class HostedPluginSupport {

    protected readonly clientId = UUID.uuid4();

    protected container: interfaces.Container;

    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(HostedPluginServer)
    private readonly server: JsonRpcProxy<HostedPluginServer>;

    @inject(HostedPluginWatcher)
    private readonly watcher: HostedPluginWatcher;

    @inject(PluginContributionHandler)
    private readonly contributionHandler: PluginContributionHandler;

    @inject(ContributionProvider)
    @named(MainPluginApiProvider)
    protected readonly mainPluginApiProviders: ContributionProvider<MainPluginApiProvider>;

    @inject(PluginServer)
    protected readonly pluginServer: PluginServer;

    @inject(PreferenceProviderProvider)
    protected readonly preferenceProviderProvider: PreferenceProviderProvider;

    @inject(PreferenceServiceImpl)
    private readonly preferenceServiceImpl: PreferenceServiceImpl;

    @inject(PluginPathsService)
    private readonly pluginPathsService: PluginPathsService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(CommandRegistry)
    protected readonly commands: CommandRegistry;

    @inject(DebugSessionManager)
    protected readonly debugSessionManager: DebugSessionManager;

    @inject(DebugConfigurationManager)
    protected readonly debugConfigurationManager: DebugConfigurationManager;

    @inject(FileSearchService)
    protected readonly fileSearchService: FileSearchService;

    @inject(FrontendApplicationStateService)
    protected readonly appState: FrontendApplicationStateService;

    @inject(PluginViewRegistry)
    protected readonly viewRegistry: PluginViewRegistry;

    @inject(TaskProviderRegistry)
    protected readonly taskProviderRegistry: TaskProviderRegistry;

    @inject(TaskResolverRegistry)
    protected readonly taskResolverRegistry: TaskResolverRegistry;

    @inject(ProgressService)
    protected readonly progressService: ProgressService;

    @inject(WebviewEnvironment)
    protected readonly webviewEnvironment: WebviewEnvironment;

    @inject(WidgetManager)
    protected readonly widgets: WidgetManager;

    @inject(TerminalService)
    protected readonly terminalService: TerminalService;

    @inject(RPCProtocolPluginAPIFactory)
    protected readonly rpcProtocolPluginAPIFactory: RPCProtocolPluginAPIFactory;

    private theiaReadyPromise: Promise<any>;

    protected readonly managers = new Map<string, PluginManagerExt>();

    private readonly contributions = new Map<string, PluginContributions>();

    protected readonly activationEvents = new Set<string>();

    protected readonly onDidChangePluginsEmitter = new Emitter<void>();
    readonly onDidChangePlugins = this.onDidChangePluginsEmitter.event;

    @postConstruct()
    protected init(): void {
        this.theiaReadyPromise = Promise.all([this.preferenceServiceImpl.ready, this.workspaceService.roots]);
        this.workspaceService.onWorkspaceChanged(() => this.updateStoragePath());

        const modeService = monaco.services.StaticServices.modeService.get();
        for (const modeId of Object.keys(modeService['_instantiatedModes'])) {
            const mode = modeService['_instantiatedModes'][modeId];
            this.activateByLanguage(mode.getId());
        }
        modeService.onDidCreateMode(mode => this.activateByLanguage(mode.getId()));
        this.commands.onWillExecuteCommand(event => this.ensureCommandHandlerRegistration(event));
        this.debugSessionManager.onWillStartDebugSession(event => this.ensureDebugActivation(event));
        this.debugSessionManager.onWillResolveDebugConfiguration(event => this.ensureDebugActivation(event, 'onDebugResolve', event.debugType));
        this.debugConfigurationManager.onWillProvideDebugConfiguration(event => this.ensureDebugActivation(event, 'onDebugInitialConfigurations'));
        this.viewRegistry.onDidExpandView(id => this.activateByView(id));
        this.taskProviderRegistry.onWillProvideTaskProvider(event => this.ensureTaskActivation(event));
        this.taskResolverRegistry.onWillProvideTaskResolver(event => this.ensureTaskActivation(event));
        this.widgets.onDidCreateWidget(({ factoryId, widget }) => {
            if (factoryId === WebviewWidget.FACTORY_ID && widget instanceof WebviewWidget) {
                const storeState = widget.storeState.bind(widget);
                const restoreState = widget.restoreState.bind(widget);
                widget.storeState = () => {
                    if (this.webviewRevivers.has(widget.viewType)) {
                        return storeState();
                    }
                    return {};
                };
                widget.restoreState = oldState => {
                    if (oldState.viewType) {
                        restoreState(oldState);
                        this.preserveWebview(widget);
                    } else {
                        widget.dispose();
                    }
                };
            }
        });
    }

    get plugins(): PluginMetadata[] {
        const plugins: PluginMetadata[] = [];
        this.contributions.forEach(contributions => plugins.push(contributions.plugin.metadata));
        return plugins;
    }

    /** do not call it, except from the plugin frontend contribution */
    onStart(container: interfaces.Container): void {
        this.container = container;
        this.load();
        this.watcher.onDidDeploy(() => this.load());
        this.server.onDidOpenConnection(() => this.load());
    }

    protected loadQueue: Promise<void> = Promise.resolve(undefined);
    load = debounce(() => this.loadQueue = this.loadQueue.then(async () => {
        try {
            await this.progressService.withProgress('', PluginProgressLocation, () => this.doLoad());
        } catch (e) {
            console.error('Failed to load plugins:', e);
        }
    }), 50, { leading: true });

    protected async doLoad(): Promise<void> {
        const toDisconnect = new DisposableCollection(Disposable.create(() => { /* mark as connected */ }));
        toDisconnect.push(Disposable.create(() => this.preserveWebviews()));
        this.server.onDidCloseConnection(() => toDisconnect.dispose());

        // process empty plugins as well in order to properly remove stale plugin widgets
        await this.syncPlugins();

        // make sure that the previous state, including plugin widgets, is restored
        // and core layout is initialized, i.e. explorer, scm, debug views are already added to the shell
        // but shell is not yet revealed
        await this.appState.reachedState('initialized_layout');

        if (toDisconnect.disposed) {
            // if disconnected then don't try to load plugin contributions
            return;
        }
        const contributionsByHost = this.loadContributions(toDisconnect);

        await this.viewRegistry.initWidgets();
        // remove restored plugin widgets which were not registered by contributions
        this.viewRegistry.removeStaleWidgets();
        await this.theiaReadyPromise;

        if (toDisconnect.disposed) {
            // if disconnected then don't try to init plugin code and dynamic contributions
            return;
        }
        await this.startPlugins(contributionsByHost, toDisconnect);
        this.restoreWebviews();
    }

    /**
     * Sync loaded and deployed plugins:
     * - undeployed plugins are unloaded
     * - newly deployed plugins are initialized
     */
    protected async syncPlugins(): Promise<void> {
        let initialized = 0;
        const syncPluginsMeasurement = this.createMeasurement('syncPlugins');

        const toUnload = new Set(this.contributions.keys());
        try {
            const pluginIds: string[] = [];
            const deployedPluginIds = await this.server.getDeployedPluginIds();
            for (const pluginId of deployedPluginIds) {
                toUnload.delete(pluginId);
                if (!this.contributions.has(pluginId)) {
                    pluginIds.push(pluginId);
                }
            }
            for (const pluginId of toUnload) {
                const contribution = this.contributions.get(pluginId);
                if (contribution) {
                    contribution.dispose();
                }
            }
            if (pluginIds.length) {
                const plugins = await this.server.getDeployedPlugins({ pluginIds });
                for (const plugin of plugins) {
                    const pluginId = plugin.metadata.model.id;
                    const contributions = new PluginContributions(plugin);
                    this.contributions.set(pluginId, contributions);
                    contributions.push(Disposable.create(() => this.contributions.delete(pluginId)));
                    initialized++;
                }
            }
        } finally {
            if (initialized || toUnload.size) {
                this.onDidChangePluginsEmitter.fire(undefined);
            }
        }

        this.logMeasurement('Sync', initialized, syncPluginsMeasurement);
    }

    /**
     * Always synchronous in order to simplify handling disconnections.
     * @throws never
     */
    protected loadContributions(toDisconnect: DisposableCollection): Map<PluginHost, PluginContributions[]> {
        let loaded = 0;
        const loadPluginsMeasurement = this.createMeasurement('loadPlugins');

        const hostContributions = new Map<PluginHost, PluginContributions[]>();
        for (const contributions of this.contributions.values()) {
            const plugin = contributions.plugin.metadata;
            const pluginId = plugin.model.id;

            if (contributions.state === PluginContributions.State.INITIALIZING) {
                contributions.state = PluginContributions.State.LOADING;
                contributions.push(Disposable.create(() => console.log(`[${pluginId}]: Unloaded plugin.`)));
                contributions.push(this.contributionHandler.handleContributions(this.clientId, contributions.plugin));
                contributions.state = PluginContributions.State.LOADED;
                console.log(`[${this.clientId}][${pluginId}]: Loaded contributions.`);
                loaded++;
            }

            if (contributions.state === PluginContributions.State.LOADED) {
                contributions.state = PluginContributions.State.STARTING;
                const host = plugin.model.entryPoint.frontend ? 'frontend' : plugin.host;
                const dynamicContributions = hostContributions.get(plugin.host) || [];
                dynamicContributions.push(contributions);
                hostContributions.set(host, dynamicContributions);
                toDisconnect.push(Disposable.create(() => {
                    contributions!.state = PluginContributions.State.LOADED;
                    console.log(`[${this.clientId}][${pluginId}]: Disconnected.`);
                }));
            }
        }

        this.logMeasurement('Load contributions', loaded, loadPluginsMeasurement);

        return hostContributions;
    }

    protected async startPlugins(contributionsByHost: Map<PluginHost, PluginContributions[]>, toDisconnect: DisposableCollection): Promise<void> {
        let started = 0;
        const startPluginsMeasurement = this.createMeasurement('startPlugins');

        const [hostLogPath, hostStoragePath] = await Promise.all([
            this.pluginPathsService.getHostLogPath(),
            this.getStoragePath()
        ]);
        if (toDisconnect.disposed) {
            return;
        }
        const thenable: Promise<void>[] = [];
        const configStorage = { hostLogPath, hostStoragePath };
        for (const [host, hostContributions] of contributionsByHost) {
            const manager = await this.obtainManager(host, hostContributions, toDisconnect);
            if (!manager) {
                return;
            }
            const plugins = hostContributions.map(contributions => contributions.plugin.metadata);
            thenable.push((async () => {
                try {
                    const activationEvents = [...this.activationEvents];
                    await manager.$start({ plugins, configStorage, activationEvents });
                    if (toDisconnect.disposed) {
                        return;
                    }
                    for (const contributions of hostContributions) {
                        started++;
                        const plugin = contributions.plugin;
                        const id = plugin.metadata.model.id;
                        contributions.state = PluginContributions.State.STARTED;
                        console.log(`[${this.clientId}][${id}]: Started plugin.`);
                        toDisconnect.push(contributions.push(Disposable.create(() => {
                            console.log(`[${this.clientId}][${id}]: Stopped plugin.`);
                            manager.$stop(id);
                        })));

                        this.activateByWorkspaceContains(manager, plugin);
                    }
                } catch (e) {
                    console.error(`Failed to start plugins for '${host}' host`, e);
                }
            })());
        }
        await Promise.all(thenable);
        if (toDisconnect.disposed) {
            return;
        }
        this.logMeasurement('Start', started, startPluginsMeasurement);
    }

    protected async obtainManager(host: string, hostContributions: PluginContributions[], toDisconnect: DisposableCollection): Promise<PluginManagerExt | undefined> {
        let manager = this.managers.get(host);
        if (!manager) {
            const pluginId = getPluginId(hostContributions[0].plugin.metadata.model);
            const rpc = this.initRpc(host, pluginId);
            toDisconnect.push(rpc);

            manager = rpc.getProxy(MAIN_RPC_CONTEXT.HOSTED_PLUGIN_MANAGER_EXT);
            this.managers.set(host, manager);
            toDisconnect.push(Disposable.create(() => this.managers.delete(host)));

            const [extApi, globalState, workspaceState, webviewResourceRoot, webviewCspSource, defaultShell] = await Promise.all([
                this.server.getExtPluginAPI(),
                this.pluginServer.getAllStorageValues(undefined),
                this.pluginServer.getAllStorageValues({
                    workspace: this.workspaceService.workspace,
                    roots: this.workspaceService.tryGetRoots()
                }),
                this.webviewEnvironment.resourceRoot(),
                this.webviewEnvironment.cspSource(),
                this.terminalService.getDefaultShell()
            ]);
            if (toDisconnect.disposed) {
                return undefined;
            }

            await manager.$init({
                preferences: getPreferences(this.preferenceProviderProvider, this.workspaceService.tryGetRoots()),
                globalState,
                workspaceState,
                env: {
                    queryParams: getQueryParameters(),
                    language: navigator.language,
                    shell: defaultShell
                },
                extApi,
                webview: {
                    webviewResourceRoot,
                    webviewCspSource
                }
            });
            if (toDisconnect.disposed) {
                return undefined;
            }
        }
        return manager;
    }

    protected initRpc(host: PluginHost, pluginId: string): RPCProtocol {
        const rpc = host === 'frontend' ? new PluginWorker().rpc : this.createServerRpc(pluginId, host);
        this.rpcProtocolPluginAPIFactory(rpc).initialize();
        this.mainPluginApiProviders.getContributions().forEach(p => p.initialize(rpc, this.container));
        return rpc;
    }

    private createServerRpc(pluginID: string, hostID: string): RPCProtocol {
        return new RPCProtocolImpl({
            onMessage: this.watcher.onPostMessageEvent,
            send: message => {
                const wrappedMessage: any = {};
                wrappedMessage['pluginID'] = pluginID;
                wrappedMessage['content'] = message;
                this.server.onMessage(JSON.stringify(wrappedMessage));
            }
        }, hostID);
    }

    private async updateStoragePath(): Promise<void> {
        const path = await this.getStoragePath();
        for (const manager of this.managers.values()) {
            manager.$updateStoragePath(path);
        }
    }

    protected async getStoragePath(): Promise<string | undefined> {
        const roots = await this.workspaceService.roots;
        return this.pluginPathsService.getHostStoragePath(this.workspaceService.workspace, roots);
    }

    async activateByEvent(activationEvent: string): Promise<void> {
        if (this.activationEvents.has(activationEvent)) {
            return;
        }
        this.activationEvents.add(activationEvent);
        const activation: Promise<void>[] = [];
        for (const manager of this.managers.values()) {
            activation.push(manager.$activateByEvent(activationEvent));
        }
        await Promise.all(activation);
    }

    async activateByView(viewId: string): Promise<void> {
        await this.activateByEvent(`onView:${viewId}`);
    }

    async activateByLanguage(languageId: string): Promise<void> {
        await this.activateByEvent(`onLanguage:${languageId}`);
    }

    async activateByCommand(commandId: string): Promise<void> {
        await this.activateByEvent(`onCommand:${commandId}`);
    }

    protected ensureCommandHandlerRegistration(event: WillExecuteCommandEvent): void {
        const activation = this.activateByCommand(event.commandId);
        if (this.commands.getCommand(event.commandId) &&
            (!this.contributionHandler.hasCommand(event.commandId) ||
                this.contributionHandler.hasCommandHandler(event.commandId))) {
            return;
        }
        const waitForCommandHandler = new Deferred<void>();
        const listener = this.contributionHandler.onDidRegisterCommandHandler(id => {
            if (id === event.commandId) {
                listener.dispose();
                waitForCommandHandler.resolve();
            }
        });
        const p = Promise.all([
            activation,
            waitForCommandHandler.promise
        ]);
        p.then(() => listener.dispose(), () => listener.dispose());
        event.waitUntil(p);
    }

    protected ensureTaskActivation(event: WaitUntilEvent): void {
        event.waitUntil(this.activateByCommand('workbench.action.tasks.runTask'));
    }

    protected ensureDebugActivation(event: WaitUntilEvent, activationEvent?: DebugActivationEvent, debugType?: string): void {
        event.waitUntil(this.activateByDebug(activationEvent, debugType));
    }

    async activateByDebug(activationEvent?: DebugActivationEvent, debugType?: string): Promise<void> {
        const promises = [this.activateByEvent('onDebug')];
        if (activationEvent) {
            promises.push(this.activateByEvent(activationEvent));
            if (debugType) {
                promises.push(this.activateByEvent(activationEvent + ':' + debugType));
            }
        }
        await Promise.all(promises);
    }

    protected async activateByWorkspaceContains(manager: PluginManagerExt, plugin: DeployedPlugin): Promise<void> {
        const activationEvents = plugin.contributes && plugin.contributes.activationEvents;
        if (!activationEvents) {
            return;
        }
        const paths: string[] = [];
        const includePatterns: string[] = [];
        // should be aligned with https://github.com/microsoft/vscode/blob/da5fb7d5b865aa522abc7e82c10b746834b98639/src/vs/workbench/api/node/extHostExtensionService.ts#L460-L469
        for (const activationEvent of activationEvents) {
            if (/^workspaceContains:/.test(activationEvent)) {
                const fileNameOrGlob = activationEvent.substr('workspaceContains:'.length);
                if (fileNameOrGlob.indexOf('*') >= 0 || fileNameOrGlob.indexOf('?') >= 0) {
                    includePatterns.push(fileNameOrGlob);
                } else {
                    paths.push(fileNameOrGlob);
                }
            }
        }
        const activatePlugin = () => manager.$activateByEvent(`onPlugin:${plugin.metadata.model.id}`);
        const promises: Promise<boolean>[] = [];
        if (paths.length) {
            promises.push(this.workspaceService.containsSome(paths));
        }
        if (includePatterns.length) {
            const tokenSource = new CancellationTokenSource();
            const searchTimeout = setTimeout(() => {
                tokenSource.cancel();
                // activate eagerly if took to long to search
                activatePlugin();
            }, 7000);
            promises.push((async () => {
                try {
                    const result = await this.fileSearchService.find('', {
                        rootUris: this.workspaceService.tryGetRoots().map(r => r.uri),
                        includePatterns,
                        limit: 1
                    }, tokenSource.token);
                    return result.length > 0;
                } catch (e) {
                    if (!isCancelled(e)) {
                        console.error(e);
                    }
                    return false;
                } finally {
                    clearTimeout(searchTimeout);
                }
            })());
        }
        if (promises.length && await Promise.all(promises).then(exists => exists.some(v => v))) {
            await activatePlugin();
        }
    }

    protected createMeasurement(name: string): () => number {
        const startMarker = `${name}-start`;
        const endMarker = `${name}-end`;
        performance.clearMeasures(name);
        performance.clearMarks(startMarker);
        performance.clearMarks(endMarker);

        performance.mark(startMarker);
        return () => {
            performance.mark(endMarker);
            performance.measure(name, startMarker, endMarker);
            const duration = performance.getEntriesByName(name)[0].duration;
            performance.clearMeasures(name);
            performance.clearMarks(startMarker);
            performance.clearMarks(endMarker);
            return duration;
        };
    }

    protected logMeasurement(prefix: string, count: number, measurement: () => number): void {
        const pluginCount = `${count} plugin${count === 1 ? '' : 's'}`;
        console.log(`[${this.clientId}] ${prefix} of ${pluginCount} took: ${measurement().toFixed(1)} ms`);
    }

    protected readonly webviewsToRestore = new Set<WebviewWidget>();
    protected readonly webviewRevivers = new Map<string, (webview: WebviewWidget) => Promise<void>>();

    registerWebviewReviver(viewType: string, reviver: (webview: WebviewWidget) => Promise<void>): void {
        if (this.webviewRevivers.has(viewType)) {
            throw new Error(`Reviver for ${viewType} already registered`);
        }
        this.webviewRevivers.set(viewType, reviver);
    }

    unregisterWebviewReviver(viewType: string): void {
        this.webviewRevivers.delete(viewType);
    }

    protected preserveWebviews(): void {
        for (const webview of this.widgets.getWidgets(WebviewWidget.FACTORY_ID)) {
            this.preserveWebview(webview as WebviewWidget);
        }
    }

    protected preserveWebview(webview: WebviewWidget): void {
        if (!this.webviewsToRestore.has(webview)) {
            this.webviewsToRestore.add(webview);
            webview.disposed.connect(() => this.webviewsToRestore.delete(webview));
        }
    }

    protected restoreWebviews(): void {
        for (const webview of this.webviewsToRestore) {
            this.restoreWebview(webview);
        }
        this.webviewsToRestore.clear();
    }

    protected async restoreWebview(webview: WebviewWidget): Promise<void> {
        await this.activateByEvent(`onWebviewPanel:${webview.viewType}`);
        const restore = this.webviewRevivers.get(webview.viewType);
        if (!restore) {
            /* eslint-disable max-len */
            webview.setHTML(this.getDeserializationFailedContents(`
            <p>The extension providing '${webview.viewType}' view is not capable of restoring it.</p>
            <p>Want to help fix this? Please inform the extension developer to register a <a href="https://code.visualstudio.com/api/extension-guides/webview#serialization">reviver</a>.</p>
            `));
            /* eslint-enable max-len */
            return;
        }
        try {
            await restore(webview);
        } catch (e) {
            webview.setHTML(this.getDeserializationFailedContents(`
            An error occurred while restoring '${webview.viewType}' view. Please check logs.
            `));
            console.error('Failed to restore the webview', e);
        }
    }

    protected getDeserializationFailedContents(message: string): string {
        return `<!DOCTYPE html>
		<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none';">
			</head>
			<body>${message}</body>
		</html>`;
    }

}

export class PluginContributions extends DisposableCollection {
    constructor(
        readonly plugin: DeployedPlugin
    ) {
        super();
    }
    state: PluginContributions.State = PluginContributions.State.INITIALIZING;
}
export namespace PluginContributions {
    export enum State {
        INITIALIZING = 0,
        LOADING = 1,
        LOADED = 2,
        STARTING = 3,
        STARTED = 4
    }
}
