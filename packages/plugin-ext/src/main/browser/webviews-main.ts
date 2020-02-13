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

import debounce = require('lodash.debounce');
import URI from 'vscode-uri';
import { inject, injectable, postConstruct } from 'inversify';
import { WebviewsMain, MAIN_RPC_CONTEXT, WebviewsExt, WebviewPanelViewState, PLUGIN_RPC_CONTEXT } from '../../common/plugin-api-rpc';
import { RPCProtocol, ProxyIdentifier } from '../../common/rpc-protocol';
import { WebviewOptions, WebviewPanelOptions, WebviewPanelShowOptions } from '@theia/plugin';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { WebviewWidget, WebviewWidgetIdentifier } from './webview/webview';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { ViewColumnService } from './view-column-service';
import { WidgetManager } from '@theia/core/lib/browser/widget-manager';
import { JSONExt } from '@phosphor/coreutils/lib/json';
import { Mutable } from '@theia/core/lib/common/types';
import { HostedPluginSupport } from '../../hosted/browser/hosted-plugin';
import { IconUrl } from '../../common/plugin-protocol';
import { RPCProtocolServiceProvider } from './main-context';

@injectable()
export class WebviewsMainImpl implements WebviewsMain, Disposable, RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any> = PLUGIN_RPC_CONTEXT.WEBVIEWS_MAIN;

    private proxy: WebviewsExt;

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(WidgetManager)
    protected readonly widgets: WidgetManager;

    @inject(HostedPluginSupport)
    protected readonly pluginService: HostedPluginSupport;

    @inject(ViewColumnService)
    protected readonly viewColumnService: ViewColumnService;

    @inject(RPCProtocol)
    private readonly rpc: RPCProtocol;

    private readonly toDispose = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        this.proxy = this.rpc.getProxy(MAIN_RPC_CONTEXT.WEBVIEWS_EXT);
        this.toDispose.push(this.shell.onDidChangeActiveWidget(() => this.updateViewStates()));
        this.toDispose.push(this.shell.onDidChangeCurrentWidget(() => this.updateViewStates()));
        this.toDispose.push(this.viewColumnService.onViewColumnChanged(() => this.updateViewStates()));
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    async $createWebviewPanel(
        panelId: string,
        viewType: string,
        title: string,
        showOptions: WebviewPanelShowOptions,
        options: WebviewPanelOptions & WebviewOptions
    ): Promise<void> {
        const view = await this.widgets.getOrCreateWidget<WebviewWidget>(WebviewWidget.FACTORY_ID, <WebviewWidgetIdentifier>{ id: panelId });
        this.hookWebview(view);
        view.viewType = viewType;
        view.title.label = title;
        const { enableFindWidget, retainContextWhenHidden, enableScripts, localResourceRoots, ...contentOptions } = options;
        view.options = { enableFindWidget, retainContextWhenHidden };
        view.setContentOptions({
            allowScripts: enableScripts,
            localResourceRoots: localResourceRoots && localResourceRoots.map(root => root.toString()),
            ...contentOptions
        });
        this.addOrReattachWidget(view, showOptions);
    }

    protected hookWebview(view: WebviewWidget): void {
        const handle = view.identifier.id;
        this.toDispose.push(view.onDidChangeVisibility(() => this.updateViewState(view)));
        this.toDispose.push(view.onMessage(data => this.proxy.$onMessage(handle, data)));
        view.disposed.connect(() => {
            if (this.toDispose.disposed) {
                return;
            }
            this.proxy.$onDidDisposeWebviewPanel(handle);
        });
    }

    private addOrReattachWidget(widget: WebviewWidget, showOptions: WebviewPanelShowOptions): void {
        const widgetOptions: ApplicationShell.WidgetOptions = { area: showOptions.area ? showOptions.area : 'main' };

        let mode = 'open-to-right';
        if (showOptions.viewColumn === -2) {
            const ref = this.shell.currentWidget;
            if (ref && this.shell.getAreaFor(ref) === widgetOptions.area) {
                Object.assign(widgetOptions, { ref, mode });
            }
        } else if (widgetOptions.area === 'main' && showOptions.viewColumn !== undefined) {
            this.viewColumnService.updateViewColumns();
            let widgetIds = this.viewColumnService.getViewColumnIds(showOptions.viewColumn);
            if (widgetIds.length > 0) {
                mode = 'tab-after';
            } else if (showOptions.viewColumn >= 0) {
                const columnsSize = this.viewColumnService.viewColumnsSize();
                if (columnsSize) {
                    showOptions.viewColumn = columnsSize - 1;
                    widgetIds = this.viewColumnService.getViewColumnIds(showOptions.viewColumn);
                }
            }
            const ref = this.shell.getWidgets(widgetOptions.area).find(w => !w.isHidden && widgetIds.indexOf(w.id) !== -1);
            if (ref) {
                Object.assign(widgetOptions, { ref, mode });
            }
        }

        this.shell.addWidget(widget, widgetOptions);
        if (showOptions.preserveFocus) {
            this.shell.revealWidget(widget.id);
        } else {
            this.shell.activateWidget(widget.id);
        }
    }

    async $disposeWebview(handle: string): Promise<void> {
        const view = await this.tryGetWebview(handle);
        if (view) {
            view.dispose();
        }
    }

    async $reveal(handle: string, showOptions: WebviewPanelShowOptions): Promise<void> {
        const widget = await this.getWebview(handle);
        if (widget.isDisposed) {
            return;
        }
        if ((showOptions.viewColumn !== undefined && showOptions.viewColumn !== widget.viewState.position) || showOptions.area !== undefined) {
            this.viewColumnService.updateViewColumns();
            const columnIds = showOptions.viewColumn ? this.viewColumnService.getViewColumnIds(showOptions.viewColumn) : [];
            const area = this.shell.getAreaFor(widget);
            if (columnIds.indexOf(widget.id) === -1 || area !== showOptions.area) {
                this.addOrReattachWidget(widget, showOptions);
                return;
            }
        }
        if (showOptions.preserveFocus) {
            this.shell.revealWidget(widget.id);
        } else {
            this.shell.activateWidget(widget.id);
        }
    }

    async $setTitle(handle: string, value: string): Promise<void> {
        const webview = await this.getWebview(handle);
        webview.title.label = value;
    }

    async $setIconPath(handle: string, iconUrl: IconUrl | undefined): Promise<void> {
        const webview = await this.getWebview(handle);
        webview.setIconUrl(iconUrl);
    }

    async $setHtml(handle: string, value: string): Promise<void> {
        const webview = await this.getWebview(handle);
        webview.setHTML(value);
    }

    async $setOptions(handle: string, options: WebviewOptions): Promise<void> {
        const webview = await this.getWebview(handle);
        const { enableScripts, localResourceRoots, ...contentOptions } = options;
        webview.setContentOptions({
            allowScripts: enableScripts,
            localResourceRoots: localResourceRoots && localResourceRoots.map(root => root.toString()),
            ...contentOptions
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async $postMessage(handle: string, value: any): Promise<boolean> {
        const webview = await this.getWebview(handle);
        webview.sendMessage(value);
        return true;
    }

    $registerSerializer(viewType: string): void {
        this.pluginService.registerWebviewReviver(viewType, widget => this.restoreWidget(widget));
        this.toDispose.push(Disposable.create(() => this.$unregisterSerializer(viewType)));
    }

    $unregisterSerializer(viewType: string): void {
        this.pluginService.unregisterWebviewReviver(viewType);
    }

    protected async restoreWidget(widget: WebviewWidget): Promise<void> {
        this.hookWebview(widget);
        const handle = widget.identifier.id;
        const title = widget.title.label;

        let state = undefined;
        if (widget.state) {
            try {
                state = JSON.parse(widget.state);
            } catch {
                // noop
            }
        }

        const options = widget.options;
        const { allowScripts, localResourceRoots, ...contentOptions } = widget.contentOptions;
        this.updateViewState(widget);
        await this.proxy.$deserializeWebviewPanel(handle, widget.viewType, title, state, widget.viewState, {
            enableScripts: allowScripts,
            localResourceRoots: localResourceRoots && localResourceRoots.map(root => URI.parse(root)),
            ...contentOptions,
            ...options
        });
    }

    protected readonly updateViewStates = debounce(() => {
        for (const widget of this.widgets.getWidgets(WebviewWidget.FACTORY_ID)) {
            if (widget instanceof WebviewWidget) {
                this.updateViewState(widget);
            }
        }
    }, 100);

    private updateViewState(widget: WebviewWidget, viewColumn?: number | undefined): void {
        const viewState: Mutable<WebviewPanelViewState> = {
            active: this.shell.activeWidget === widget,
            visible: !widget.isHidden,
            position: viewColumn || 0
        };
        if (typeof viewColumn !== 'number') {
            this.viewColumnService.updateViewColumns();
            viewState.position = this.viewColumnService.getViewColumn(widget.id) || 0;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (JSONExt.deepEqual(<any>viewState, <any>widget.viewState)) {
            return;
        }
        widget.viewState = viewState;
        this.proxy.$onDidChangeWebviewPanelViewState(widget.identifier.id, widget.viewState);
    }

    private async getWebview(viewId: string): Promise<WebviewWidget> {
        const webview = await this.tryGetWebview(viewId);
        if (!webview) {
            throw new Error(`Unknown Webview: ${viewId}`);
        }
        return webview;
    }

    private async tryGetWebview(id: string): Promise<WebviewWidget | undefined> {
        return this.widgets.getWidget<WebviewWidget>(WebviewWidget.FACTORY_ID, <WebviewWidgetIdentifier>{ id });
    }

}
