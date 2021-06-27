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

import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import {
    ApplicationShell, ViewContainer as ViewContainerWidget, WidgetManager,
    ViewContainerIdentifier, ViewContainerTitleOptions, Widget, FrontendApplicationContribution,
    StatefulWidget, CommonMenus, BaseWidget, TreeViewWelcomeWidget, ViewContainerPart
} from '@theia/core/lib/browser';
import { ViewContainer, View, ViewWelcome } from '../../../common';
import { PluginSharedStyle } from '../plugin-shared-style';
import { DebugWidget } from '@theia/debug/lib/browser/view/debug-widget';
import { PluginViewWidget, PluginViewWidgetIdentifier } from './plugin-view-widget';
import { SCM_VIEW_CONTAINER_ID, ScmContribution } from '@theia/scm/lib/browser/scm-contribution';
import { EXPLORER_VIEW_CONTAINER_ID, FileNavigatorWidget, FILE_NAVIGATOR_ID } from '@theia/navigator/lib/browser';
import { FileNavigatorContribution } from '@theia/navigator/lib/browser/navigator-contribution';
import { DebugFrontendApplicationContribution } from '@theia/debug/lib/browser/debug-frontend-application-contribution';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { QuickViewService } from '@theia/core/lib/browser/quick-view-service';
import { Emitter } from '@theia/core/lib/common/event';
import { ContextKeyService } from '@theia/core/lib/browser/context-key-service';
import { ViewContextKeyService } from './view-context-key-service';
import { PROBLEMS_WIDGET_ID } from '@theia/markers/lib/browser/problem/problem-widget';
import { OUTPUT_WIDGET_KIND } from '@theia/output/lib/browser/output-widget';
import { DebugConsoleContribution } from '@theia/debug/lib/browser/console/debug-console-contribution';
import { TERMINAL_WIDGET_FACTORY_ID } from '@theia/terminal/lib/browser/terminal-widget-impl';
import { TreeViewWidget } from './tree-view-widget';
import { SEARCH_VIEW_CONTAINER_ID } from '@theia/search-in-workspace/lib/browser/search-in-workspace-factory';

export const PLUGIN_VIEW_FACTORY_ID = 'plugin-view';
export const PLUGIN_VIEW_CONTAINER_FACTORY_ID = 'plugin-view-container';
export const PLUGIN_VIEW_DATA_FACTORY_ID = 'plugin-view-data';

export type ViewDataProvider = (params: { state?: object, viewInfo: View }) => Promise<TreeViewWidget>;

@injectable()
export class PluginViewRegistry implements FrontendApplicationContribution {

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(PluginSharedStyle)
    protected readonly style: PluginSharedStyle;

    @inject(WidgetManager)
    protected readonly widgetManager: WidgetManager;

    @inject(ScmContribution)
    protected readonly scm: ScmContribution;

    @inject(FileNavigatorContribution)
    protected readonly explorer: FileNavigatorContribution;

    @inject(DebugFrontendApplicationContribution)
    protected readonly debug: DebugFrontendApplicationContribution;

    @inject(CommandRegistry)
    protected readonly commands: CommandRegistry;

    @inject(MenuModelRegistry)
    protected readonly menus: MenuModelRegistry;

    @inject(QuickViewService)
    protected readonly quickView: QuickViewService;

    @inject(ContextKeyService)
    protected readonly contextKeyService: ContextKeyService;

    @inject(ViewContextKeyService)
    protected readonly viewContextKeys: ViewContextKeyService;

    protected readonly onDidExpandViewEmitter = new Emitter<string>();
    readonly onDidExpandView = this.onDidExpandViewEmitter.event;

    private readonly views = new Map<string, [string, View]>();
    private readonly viewsWelcome = new Map<string, ViewWelcome[]>();
    private readonly viewContainers = new Map<string, [string, ViewContainerTitleOptions]>();
    private readonly containerViews = new Map<string, string[]>();
    private readonly viewClauseContexts = new Map<string, Set<string>>();

    private readonly viewDataProviders = new Map<string, ViewDataProvider>();
    private readonly viewDataState = new Map<string, object>();

    @postConstruct()
    protected init(): void {
        // VS Code Viewlets
        this.trackVisibleWidget(EXPLORER_VIEW_CONTAINER_ID, { viewletId: 'workbench.view.explorer' });
        this.trackVisibleWidget(SCM_VIEW_CONTAINER_ID, { viewletId: 'workbench.view.scm' });
        this.trackVisibleWidget(SEARCH_VIEW_CONTAINER_ID, { viewletId: 'workbench.view.search' });
        this.trackVisibleWidget(DebugWidget.ID, { viewletId: 'workbench.view.debug' });
        // TODO workbench.view.extensions - Theia does not have a proper extension view yet

        // VS Code Panels
        this.trackVisibleWidget(PROBLEMS_WIDGET_ID, { panelId: 'workbench.panel.markers' });
        this.trackVisibleWidget(OUTPUT_WIDGET_KIND, { panelId: 'workbench.panel.output' });
        this.trackVisibleWidget(DebugConsoleContribution.options.id, { panelId: 'workbench.panel.repl' });
        this.trackVisibleWidget(TERMINAL_WIDGET_FACTORY_ID, { panelId: 'workbench.panel.terminal' });
        // TODO workbench.panel.comments - Theia does not have a proper comments view yet

        this.updateFocusedView();
        this.shell.onDidChangeActiveWidget(() => this.updateFocusedView());

        this.widgetManager.onWillCreateWidget(({ factoryId, widget, waitUntil }) => {
            if (factoryId === EXPLORER_VIEW_CONTAINER_ID && widget instanceof ViewContainerWidget) {
                waitUntil(this.prepareViewContainer('explorer', widget));
            }
            if (factoryId === SCM_VIEW_CONTAINER_ID && widget instanceof ViewContainerWidget) {
                waitUntil(this.prepareViewContainer('scm', widget));
            }
            if (factoryId === SEARCH_VIEW_CONTAINER_ID && widget instanceof ViewContainerWidget) {
                waitUntil(this.prepareViewContainer('search', widget));
            }
            if (factoryId === DebugWidget.ID && widget instanceof DebugWidget) {
                const viewContainer = widget['sessionWidget']['viewContainer'];
                waitUntil(this.prepareViewContainer('debug', viewContainer));
            }
            if (factoryId === PLUGIN_VIEW_CONTAINER_FACTORY_ID && widget instanceof ViewContainerWidget) {
                waitUntil(this.prepareViewContainer(this.toViewContainerId(widget.options), widget));
            }
            if (factoryId === PLUGIN_VIEW_FACTORY_ID && widget instanceof PluginViewWidget) {
                waitUntil(this.prepareView(widget));
            }
        });
        this.widgetManager.onDidCreateWidget(event => {
            if (event.widget instanceof FileNavigatorWidget) {
                this.registerViewWelcome({
                    view: 'explorer',
                    // eslint-disable-next-line max-len
                    content: 'You have not yet opened a folder.\n[Open Folder](command:workbench.action.files.openFolder)',
                    order: 0
                });
            }
        });
        this.doRegisterViewContainer('test', 'left', {
            label: 'Test',
            iconClass: 'theia-plugin-test-tab-icon',
            closeable: true
        });
        this.contextKeyService.onDidChange(e => {
            for (const [, view] of this.views.values()) {
                const clauseContext = this.viewClauseContexts.get(view.id);
                if (clauseContext && e.affects(clauseContext)) {
                    this.updateViewVisibility(view.id);
                }
            }
            for (const [viewId, viewWelcomes] of this.viewsWelcome) {
                for (const [index] of viewWelcomes.entries()) {
                    const viewWelcomeId = this.toViewWelcomeId(index, viewId);
                    const clauseContext = this.viewClauseContexts.get(viewWelcomeId);
                    if (clauseContext && e.affects(clauseContext)) {
                        this.updateViewWelcomeVisibility(viewId);
                    }
                }
            }
        });
    }

    protected async updateViewWelcomeVisibility(viewId: string): Promise<void> {
        const widget = await this.getTreeViewWelcomeWidget(viewId);
        if (widget) {
            widget.handleWelcomeContextChange();
        }
    }

    protected async updateViewVisibility(viewId: string): Promise<void> {
        const widget = await this.getView(viewId);
        if (!widget) {
            if (this.isViewVisible(viewId)) {
                await this.openView(viewId);
            }
            return;
        }
        const viewInfo = this.views.get(viewId);
        if (!viewInfo) {
            return;
        }
        const [viewContainerId] = viewInfo;
        const viewContainer = await this.getPluginViewContainer(viewContainerId);
        if (!viewContainer) {
            return;
        }
        const part = viewContainer.getPartFor(widget);
        if (!part) {
            return;
        }
        widget.updateViewVisibility(() =>
            part.setHidden(!this.isViewVisible(viewId))
        );
    }

    protected isViewVisible(viewId: string): boolean {
        const viewInfo = this.views.get(viewId);
        if (!viewInfo) {
            return false;
        }
        const [, view] = viewInfo;
        return view.when === undefined || view.when === 'true' || this.contextKeyService.match(view.when);
    }

    registerViewContainer(location: string, viewContainer: ViewContainer): Disposable {
        if (this.viewContainers.has(viewContainer.id)) {
            console.warn('view container such id already registered: ', JSON.stringify(viewContainer));
            return Disposable.NULL;
        }
        const toDispose = new DisposableCollection();
        const containerClass = 'theia-plugin-view-container';
        const iconClass = 'plugin-view-container-icon-' + viewContainer.id;
        const iconUrl = PluginSharedStyle.toExternalIconUrl(viewContainer.iconUrl);
        toDispose.push(this.style.insertRule('.' + containerClass + '.' + iconClass, () => `
                mask: url('${iconUrl}') no-repeat 50% 50%;
                -webkit-mask: url('${iconUrl}') no-repeat 50% 50%;
            `));
        toDispose.push(this.doRegisterViewContainer(viewContainer.id, location, {
            label: viewContainer.title,
            iconClass: containerClass + ' ' + iconClass,
            closeable: true
        }));
        return toDispose;
    }

    protected doRegisterViewContainer(id: string, location: string, options: ViewContainerTitleOptions): Disposable {
        const toDispose = new DisposableCollection();
        this.viewContainers.set(id, [location, options]);
        toDispose.push(Disposable.create(() => this.viewContainers.delete(id)));
        const toggleCommandId = `plugin.view-container.${id}.toggle`;
        toDispose.push(this.commands.registerCommand({
            id: toggleCommandId,
            label: 'Toggle ' + options.label + ' View'
        }, {
            execute: async () => {
                let widget = await this.getPluginViewContainer(id);
                if (widget) {
                    widget.dispose();
                } else {
                    widget = await this.openViewContainer(id);
                    if (widget) {
                        this.shell.activateWidget(widget.id);
                    }
                }
            }
        }));
        toDispose.push(this.menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
            commandId: toggleCommandId,
            label: options.label
        }));
        toDispose.push(this.quickView.registerItem({
            label: options.label,
            open: async () => {
                const widget = await this.openViewContainer(id);
                if (widget) {
                    this.shell.activateWidget(widget.id);
                }
            }
        }));
        toDispose.push(Disposable.create(async () => {
            const widget = await this.getPluginViewContainer(id);
            if (widget) {
                widget.dispose();
            }
        }));
        return toDispose;
    }

    getContainerViews(viewContainerId: string): string[] {
        return this.containerViews.get(viewContainerId) || [];
    }

    registerView(viewContainerId: string, view: View): Disposable {
        if (this.views.has(view.id)) {
            console.warn('view with such id already registered: ', JSON.stringify(view));
            return Disposable.NULL;
        }
        const toDispose = new DisposableCollection();

        view.when = view.when?.trim();
        // const existWidget = this.widgetManager.tryGetWidget<PluginViewWidget>(PLUGIN_VIEW_FACTORY_ID, this.toPluginViewWidgetIdentifier(view.id));
        // const { lastDroppedContainer } = existWidget || {};
        // if (lastDroppedContainer && this.fromViewContainerIdentifier(lastDroppedContainer) !== viewContainerId) {
        //     const containerId = this.fromViewContainerIdentifier(lastDroppedContainer);
        //     viewContainerId = ViewContainerIdentifiers[containerId] || containerId;
        // }
        this.views.set(view.id, [viewContainerId, view]);
        toDispose.push(Disposable.create(() => this.views.delete(view.id)));

        const containerViews = this.getContainerViews(viewContainerId);
        containerViews.push(view.id);
        this.containerViews.set(viewContainerId, containerViews);
        toDispose.push(Disposable.create(() => {
            const index = containerViews.indexOf(view.id);
            if (index !== -1) {
                containerViews.splice(index, 1);
            }
        }));

        if (view.when && view.when !== 'false' && view.when !== 'true') {
            this.viewClauseContexts.set(view.id, this.contextKeyService.parseKeys(view.when));
            toDispose.push(Disposable.create(() => this.viewClauseContexts.delete(view.id)));
        }
        toDispose.push(this.quickView.registerItem({
            label: view.name,
            when: view.when,
            open: () => this.openView(view.id, { activate: true })
        }));
        toDispose.push(this.commands.registerCommand({ id: `${view.id}.focus` }, {
            execute: async () => { await this.openView(view.id, { activate: true }); }
        }));
        return toDispose;
    }

    registerViewWelcome(viewWelcome: ViewWelcome): Disposable {
        const toDispose = new DisposableCollection();

        const viewsWelcome = this.viewsWelcome.get(viewWelcome.view) || [];
        viewsWelcome.push(viewWelcome);
        this.viewsWelcome.set(viewWelcome.view, viewsWelcome);
        this.handleViewWelcomeChange(viewWelcome.view);
        toDispose.push(Disposable.create(() => {
            const index = viewsWelcome.indexOf(viewWelcome);
            if (index !== -1) {
                viewsWelcome.splice(index, 1);
            }
            this.handleViewWelcomeChange(viewWelcome.view);
        }));

        if (viewWelcome.when) {
            const index = viewsWelcome.indexOf(viewWelcome);
            const viewWelcomeId = this.toViewWelcomeId(index, viewWelcome.view);
            this.viewClauseContexts.set(viewWelcomeId, this.contextKeyService.parseKeys(viewWelcome.when));
            toDispose.push(Disposable.create(() => this.viewClauseContexts.delete(viewWelcomeId)));
        }
        return toDispose;
    }

    async handleViewWelcomeChange(viewId: string): Promise<void> {
        const widget = await this.getTreeViewWelcomeWidget(viewId);
        if (widget) {
            widget.handleViewWelcomeContentChange(this.getViewWelcomes(viewId));
        }
    }

    protected async getTreeViewWelcomeWidget(viewId: string): Promise<TreeViewWelcomeWidget | undefined> {
        switch (viewId) {
            case 'explorer':
                return this.widgetManager.getWidget<TreeViewWelcomeWidget>(FILE_NAVIGATOR_ID);
            default:
                return this.widgetManager.getWidget<TreeViewWelcomeWidget>(PLUGIN_VIEW_DATA_FACTORY_ID, { id: viewId });
        }
    }

    getViewWelcomes(viewId: string): ViewWelcome[] {
        return this.viewsWelcome.get(viewId) || [];
    }

    async getView(viewId: string): Promise<PluginViewWidget | undefined> {
        if (!this.views.has(viewId)) {
            return undefined;
        }
        return this.widgetManager.getWidget<PluginViewWidget>(PLUGIN_VIEW_FACTORY_ID, this.toPluginViewWidgetIdentifier(viewId));
    }

    async openView(viewId: string, options?: { activate?: boolean, reveal?: boolean }): Promise<PluginViewWidget | undefined> {
        const view = await this.doOpenView(viewId);
        if (view && options) {
            if (options.activate === true) {
                await this.shell.activateWidget(view.id);
            } else if (options.reveal === true) {
                await this.shell.revealWidget(view.id);
            }
        }
        return view;
    }
    protected async doOpenView(viewId: string): Promise<PluginViewWidget | undefined> {
        const widget = await this.getView(viewId);
        if (widget) {
            return widget;
        }
        const data = this.views.get(viewId);
        if (!data) {
            return undefined;
        }
        const [containerId] = data;
        await this.openViewContainer(containerId);
        return this.getView(viewId);
    }

    protected async prepareView(widget: PluginViewWidget): Promise<void> {
        const data = this.views.get(widget.options.viewId);
        if (!data) {
            return;
        }
        const [, view] = data;
        if (!widget.title.label) {
            widget.title.label = view.name;
        }
        const currentDataWidget = widget.widgets[0];
        const viewDataWidget = await this.createViewDataWidget(view.id);
        if (widget.isDisposed) {
            // eslint-disable-next-line no-unused-expressions
            viewDataWidget?.dispose();
            return;
        }
        if (currentDataWidget !== viewDataWidget) {
            if (currentDataWidget) {
                currentDataWidget.dispose();
            }
            if (viewDataWidget) {
                widget.addWidget(viewDataWidget);
            }
        }
    }

    async openViewContainer(containerId: string): Promise<ViewContainerWidget | undefined> {
        if (containerId === 'explorer') {
            const widget = await this.explorer.openView();
            if (widget.parent instanceof ViewContainerWidget) {
                return widget.parent;
            }
            return undefined;
        }
        if (containerId === 'scm') {
            const widget = await this.scm.openView();
            if (widget.parent instanceof ViewContainerWidget) {
                return widget.parent;
            }
            return undefined;
        }
        if (containerId === 'debug') {
            const widget = await this.debug.openView();
            return widget['sessionWidget']['viewContainer'];
        }
        const data = this.viewContainers.get(containerId);
        if (!data) {
            return undefined;
        }
        const [location] = data;
        const identifier = this.toViewContainerIdentifier(containerId);
        const containerWidget = await this.widgetManager.getOrCreateWidget<ViewContainerWidget>(PLUGIN_VIEW_CONTAINER_FACTORY_ID, identifier);
        if (!containerWidget.isAttached) {
            await this.shell.addWidget(containerWidget, {
                area: ApplicationShell.isSideArea(location) ? location : 'left',
                rank: Number.MAX_SAFE_INTEGER
            });
        }
        return containerWidget;
    }

    protected async prepareViewContainer(viewContainerId: string, containerWidget: ViewContainerWidget): Promise<void> {
        const data = this.viewContainers.get(viewContainerId);
        if (data) {
            const [, options] = data;
            containerWidget.setTitleOptions(options);
        }
        for (const viewId of this.getContainerViews(viewContainerId)) {
            const identifier = this.toPluginViewWidgetIdentifier(viewId);
            // Keep exising widget in its current container and reregister its part to the plugin view widget events.
            const existingWidget = this.widgetManager.tryGetWidget<PluginViewWidget>(PLUGIN_VIEW_FACTORY_ID, identifier);
            if (existingWidget && existingWidget.currentViewContainerId) {
                const currentContainer = await this.getPluginViewContainer(existingWidget.currentViewContainerId);
                if (currentContainer && this.registerWidgetPartEvents(existingWidget, containerWidget)) {
                    continue;
                }
            }
            const widget = await this.widgetManager.getOrCreateWidget<PluginViewWidget>(PLUGIN_VIEW_FACTORY_ID, identifier);
            if (containerWidget.getTrackableWidgets().indexOf(widget) === -1) {
                containerWidget.addWidget(widget, {
                    initiallyCollapsed: !!containerWidget.getParts().length,
                    initiallyHidden: !this.isViewVisible(viewId)
                });
            }
            this.registerWidgetPartEvents(widget, containerWidget);
        }
    }

    protected registerWidgetPartEvents(widget: PluginViewWidget, containerWidget: ViewContainerWidget): ViewContainerPart | undefined {
        const part = containerWidget.getPartFor(widget);
        if (part) {
            this.onPartAttached(part, containerWidget);
            part.onDidRecreatePart(event => {
                this.onPartAttached(event.newPart, event.container);
            });
            return part;
        }
    }

    protected onPartAttached = (part: ViewContainerPart, containerWidget: ViewContainerWidget) => {
        const widget = part.wrapped;
        if (!(widget instanceof PluginViewWidget)) {
            return;
        }
        widget.currentViewContainerId = this.getViewContainerId(containerWidget);
        // if a view is explicitly hidden then suppress updating visibility based on `when` closure
        part.onDidChangeVisibility(() => widget.suppressUpdateViewVisibility = part.isHidden);

        const tryFireOnDidExpandView = () => {
            if (widget.widgets.length === 0) {
                if (!part.collapsed && part.isVisible) {
                    const viewId = this.toViewId(widget.options);
                    this.onDidExpandViewEmitter.fire(viewId);
                }
            } else {
                toFire.dispose();
            }
        };
        const toFire = new DisposableCollection(
            part.onCollapsed(tryFireOnDidExpandView),
            part.onDidChangeVisibility(tryFireOnDidExpandView)
        );

        tryFireOnDidExpandView();
    };

    protected getViewContainerId(container: ViewContainerWidget): string | undefined {
        const description = this.widgetManager.getDescription(container);
        switch (description?.factoryId) {
            case EXPLORER_VIEW_CONTAINER_ID: return 'explorer';
            case SCM_VIEW_CONTAINER_ID: return 'scm';
            case SEARCH_VIEW_CONTAINER_ID: return 'search';
            case EXPLORER_VIEW_CONTAINER_ID: return 'explorer';
            case undefined: return container.parent?.parent instanceof DebugWidget ? 'debug' : undefined;
            default: return description?.factoryId;
        }
    }

    protected async getPluginViewContainer(viewContainerId: string): Promise<ViewContainerWidget | undefined> {
        if (viewContainerId === 'explorer') {
            return this.widgetManager.getWidget<ViewContainerWidget>(EXPLORER_VIEW_CONTAINER_ID);
        }
        if (viewContainerId === 'scm') {
            return this.widgetManager.getWidget<ViewContainerWidget>(SCM_VIEW_CONTAINER_ID);
        }
        if (viewContainerId === 'search') {
            return this.widgetManager.getWidget<ViewContainerWidget>(SEARCH_VIEW_CONTAINER_ID);
        }
        if (viewContainerId === 'debug') {
            const debug = await this.widgetManager.getWidget(DebugWidget.ID);
            if (debug instanceof DebugWidget) {
                return debug['sessionWidget']['viewContainer'];
            }
        }
        const identifier = this.toViewContainerIdentifier(viewContainerId);
        return this.widgetManager.getWidget<ViewContainerWidget>(PLUGIN_VIEW_CONTAINER_FACTORY_ID, identifier);
    }

    async initWidgets(): Promise<void> {
        const promises: Promise<void>[] = [];
        for (const id of this.viewContainers.keys()) {
            promises.push((async () => {
                let viewContainer = await this.getPluginViewContainer(id);
                if (!viewContainer) {
                    viewContainer = await this.openViewContainer(id);
                    if (viewContainer && !viewContainer.getParts().filter(part => !part.isHidden).length) {
                        // close view containers without any visible view parts
                        viewContainer.dispose();
                    }
                } else {
                    await this.prepareViewContainer(this.toViewContainerId(viewContainer.options), viewContainer);
                }
            })().catch(console.error));
        }
        promises.push((async () => {
            const explorer = await this.widgetManager.getWidget(EXPLORER_VIEW_CONTAINER_ID);
            if (explorer instanceof ViewContainerWidget) {
                await this.prepareViewContainer('explorer', explorer);
            }
        })().catch(console.error));
        promises.push((async () => {
            const scm = await this.widgetManager.getWidget(SCM_VIEW_CONTAINER_ID);
            if (scm instanceof ViewContainerWidget) {
                await this.prepareViewContainer('scm', scm);
            }
        })().catch(console.error));
        promises.push((async () => {
            const search = await this.widgetManager.getWidget(SEARCH_VIEW_CONTAINER_ID);
            if (search instanceof ViewContainerWidget) {
                await this.prepareViewContainer('search', search);
            }
        })().catch(console.error));
        promises.push((async () => {
            const debug = await this.widgetManager.getWidget(DebugWidget.ID);
            if (debug instanceof DebugWidget) {
                const viewContainer = debug['sessionWidget']['viewContainer'];
                await this.prepareViewContainer('debug', viewContainer);
            }
        })().catch(console.error));
        await Promise.all(promises);
    }

    async removeStaleWidgets(): Promise<void> {
        const views = this.widgetManager.getWidgets(PLUGIN_VIEW_FACTORY_ID);
        for (const view of views) {
            if (view instanceof PluginViewWidget) {
                const id = this.toViewId(view.options);
                if (!this.views.has(id)) {
                    view.dispose();
                }
            }
        }
        const viewContainers = this.widgetManager.getWidgets(PLUGIN_VIEW_CONTAINER_FACTORY_ID);
        for (const viewContainer of viewContainers) {
            if (viewContainer instanceof ViewContainerWidget) {
                const id = this.toViewContainerId(viewContainer.options);
                if (!this.viewContainers.has(id)) {
                    viewContainer.dispose();
                }
            }
        }
    }

    protected toViewContainerIdentifier(viewContainerId: string): ViewContainerIdentifier {
        return { id: PLUGIN_VIEW_CONTAINER_FACTORY_ID + ':' + viewContainerId, progressLocationId: viewContainerId };
    }
    protected toViewContainerId(identifier: ViewContainerIdentifier): string {
        return identifier.id.substr(PLUGIN_VIEW_CONTAINER_FACTORY_ID.length + 1);
    }

    protected toPluginViewWidgetIdentifier(viewId: string): PluginViewWidgetIdentifier {
        return { id: PLUGIN_VIEW_FACTORY_ID + ':' + viewId, viewId };
    }
    protected toViewId(identifier: PluginViewWidgetIdentifier): string {
        return identifier.viewId;
    }

    protected toViewWelcomeId(index: number, viewId: string): string {
        return `view-welcome.${viewId}.${index}`;
    }

    /**
     * retrieve restored layout state from previous user session but close widgets
     * widgets should be opened only when view data providers are registered
     */
    onDidInitializeLayout(): void {
        const widgets = this.widgetManager.getWidgets(PLUGIN_VIEW_DATA_FACTORY_ID);
        for (const widget of widgets) {
            if (StatefulWidget.is(widget)) {
                const state = widget.storeState();
                if (state) {
                    this.viewDataState.set(widget.id, state);
                }
            }
            widget.dispose();
        }
    }

    registerViewDataProvider(viewId: string, provider: ViewDataProvider): Disposable {
        if (this.viewDataProviders.has(viewId)) {
            console.error(`data provider for '${viewId}' view is already registered`);
            return Disposable.NULL;
        }
        this.viewDataProviders.set(viewId, provider);
        const toDispose = new DisposableCollection(Disposable.create(() => {
            this.viewDataProviders.delete(viewId);
            this.viewDataState.delete(viewId);
        }));
        this.getView(viewId).then(async view => {
            if (toDispose.disposed) {
                return;
            }
            if (view) {
                if (view.isVisible) {
                    await this.prepareView(view);
                } else {
                    const toDisposeOnDidExpandView = new DisposableCollection(this.onDidExpandView(async id => {
                        if (id === viewId) {
                            unsubscribe();
                            await this.prepareView(view);
                        }
                    }));
                    const unsubscribe = () => toDisposeOnDidExpandView.dispose();
                    view.disposed.connect(unsubscribe);
                    toDisposeOnDidExpandView.push(Disposable.create(() => view.disposed.disconnect(unsubscribe)));
                    toDispose.push(toDisposeOnDidExpandView);
                }
            }
        });
        return toDispose;
    }

    protected async createViewDataWidget(viewId: string): Promise<Widget | undefined> {
        const view = this.views.get(viewId);
        const provider = this.viewDataProviders.get(viewId);
        if (!view || !provider) {
            return undefined;
        }
        const [, viewInfo] = view;
        const state = this.viewDataState.get(viewId);
        const widget = await provider({ state, viewInfo });
        widget.handleViewWelcomeContentChange(this.getViewWelcomes(viewId));
        if (StatefulWidget.is(widget)) {
            this.storeViewDataStateOnDispose(viewId, widget);
        } else {
            this.viewDataState.delete(viewId);
        }
        return widget;
    }

    protected storeViewDataStateOnDispose(viewId: string, widget: Widget & StatefulWidget): void {
        const dispose = widget.dispose.bind(widget);
        widget.dispose = () => {
            const state = widget.storeState();
            if (state) {
                this.viewDataState.set(viewId, state);
            }
            dispose();
        };
    }

    protected trackVisibleWidget(factoryId: string, view: PluginViewRegistry.VisibleView): void {
        this.doTrackVisibleWidget(this.widgetManager.tryGetWidget(factoryId), view);
        this.widgetManager.onDidCreateWidget(event => {
            if (factoryId === event.factoryId) {
                const { widget } = event;
                this.doTrackVisibleWidget(widget, view);
            }
        });
    }

    protected doTrackVisibleWidget(widget: Widget | undefined, view: PluginViewRegistry.VisibleView): void {
        if (widget instanceof BaseWidget) {
            widget.onDidChangeVisibility(() => this.updateVisibleWidget(widget, view));
            const toDispose = new DisposableCollection(
                Disposable.create(() => this.updateVisibleWidget(widget, view)),
                this.shell.onDidChangeActiveWidget(() => {
                    if (this.shell.activeWidget === widget) {
                        this.updateVisibleWidget(widget, view);
                    }
                })
            );
            if (view.sideArea !== undefined) {
                toDispose.pushAll([
                    this.shell.onDidAddWidget(w => {
                        if (w === widget) {
                            this.updateVisibleWidget(widget, view);
                        }
                    })
                ]);
            }
            widget.disposed.connect(() => toDispose.dispose());
        }
    }

    protected readonly visiblePanels = new Set<string>();
    protected readonly visibleViewlets = new Set<string>();

    protected updateVisibleWidget(widget: BaseWidget, view: PluginViewRegistry.VisibleView): void {
        const visibleViews = 'viewletId' in view ? this.visibleViewlets : this.visiblePanels;
        const viewId = 'viewletId' in view ? view.viewletId : view.panelId;
        const visibleView = 'viewletId' in view ? this.viewContextKeys.activeViewlet : this.viewContextKeys.activePanel;
        visibleViews.delete(viewId);
        if (this.isVisibleWidget(widget, view)) {
            visibleView.set(viewId);
            visibleViews.add(viewId);
        } else {
            const lastVisibleView = [...visibleViews.values()][visibleViews.size - 1];
            visibleView.set(lastVisibleView);
        }
    }

    protected isVisibleWidget(widget: BaseWidget, view: PluginViewRegistry.VisibleView): boolean {
        if (widget.isDisposed || !widget.isVisible) {
            return false;
        }
        if (view.sideArea === undefined) {
            return true;
        }
        const area = this.shell.getAreaFor(widget);
        return view.sideArea === (area === 'left' || area === 'right');
    }

    protected updateFocusedView(): void {
        const widget = this.shell.activeWidget;
        if (widget instanceof PluginViewWidget) {
            this.viewContextKeys.focusedView.set(widget.options.viewId);
        } else {
            this.viewContextKeys.focusedView.reset();
        }
    }

}
export namespace PluginViewRegistry {
    export type VisibleView = ({ viewletId: string } | { panelId: string }) & {
        /** `undefined` means any area */
        sideArea?: boolean
    };
}
