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

import '../../../src/main/style/status-bar.css';
import '../../../src/main/browser/style/index.css';

import { ContainerModule } from 'inversify';
import {
    FrontendApplicationContribution, FrontendApplication, WidgetFactory, bindViewContribution,
    ViewContainerIdentifier, ViewContainer, createTreeContainer, TreeImpl, TreeWidget, TreeModelImpl, OpenHandler, LabelProviderContribution
} from '@theia/core/lib/browser';
import { MaybePromise, CommandContribution, ResourceResolver, bindContributionProvider } from '@theia/core/lib/common';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser/messaging';
import { HostedPluginSupport } from '../../hosted/browser/hosted-plugin';
import { HostedPluginWatcher } from '../../hosted/browser/hosted-plugin-watcher';
import { OpenUriCommandHandler } from './commands';
import { PluginApiFrontendContribution } from './plugin-frontend-contribution';
import { HostedPluginServer, hostedServicePath, PluginServer, pluginServerJsonRpcPath } from '../../common/plugin-protocol';
import { ModalNotification } from './dialogs/modal-notification';
import { PluginWidget } from './plugin-ext-widget';
import { PluginFrontendViewContribution } from './plugin-frontend-view-contribution';
import { PluginExtDeployCommandService } from './plugin-ext-deploy-command';
import { TextEditorService } from './text-editor-service';
import { EditorModelService } from './text-editor-model-service';
import { UntitledResourceResolver } from './editor/untitled-resource';
import { MenusContributionPointHandler } from './menus/menus-contribution-handler';
import { PluginContributionHandler } from './plugin-contribution-handler';
import { PluginViewRegistry, PLUGIN_VIEW_CONTAINER_FACTORY_ID, PLUGIN_VIEW_FACTORY_ID, PLUGIN_VIEW_DATA_FACTORY_ID } from './view/plugin-view-registry';
import { MainPluginApiProvider } from '../../common/plugin-ext-api-contribution';
import { PluginPathsService, pluginPathsServicePath } from '../common/plugin-paths-protocol';
import { KeybindingsContributionPointHandler } from './keybindings/keybindings-contribution-handler';
import { LanguageClientProvider } from '@theia/languages/lib/browser/language-client-provider';
import { LanguageClientProviderImpl } from './language-provider/plugin-language-client-provider';
import { LanguageClientContributionProviderImpl } from './language-provider/language-client-contribution-provider-impl';
import { LanguageClientContributionProvider } from './language-provider/language-client-contribution-provider';
import { DebugSessionContributionRegistry } from '@theia/debug/lib/browser/debug-session-contribution';
import { PluginDebugSessionContributionRegistry } from './debug/plugin-debug-session-contribution-registry';
import { PluginDebugService } from './debug/plugin-debug-service';
import { DebugService } from '@theia/debug/lib/common/debug-service';
import { PluginSharedStyle } from './plugin-shared-style';
import { SelectionProviderCommandContribution } from './selection-provider-command';
import { ViewColumnService } from './view-column-service';
import { ViewContextKeyService } from './view/view-context-key-service';
import { PluginViewWidget, PluginViewWidgetIdentifier } from './view/plugin-view-widget';
import { TreeViewWidgetIdentifier, VIEW_ITEM_CONTEXT_MENU, PluginTree, TreeViewWidget, PluginTreeModel } from './view/tree-view-widget';
import { RPCProtocol } from '../../common/rpc-protocol';
import { InPluginFileSystemWatcherManager } from './in-plugin-filesystem-watcher-manager';
import { WebviewWidget, WebviewWidgetIdentifier, WebviewWidgetExternalEndpoint } from './webview/webview';
import { WebviewEnvironment } from './webview/webview-environment';
import { WebviewThemeDataProvider } from './webview/webview-theme-data-provider';
import { PluginCommandOpenHandler } from './plugin-command-open-handler';
import { bindWebviewPreferences } from './webview/webview-preferences';
import { WebviewResourceLoader, WebviewResourceLoaderPath } from '../common/webview-protocol';
import { WebviewResourceCache } from './webview/webview-resource-cache';
import { PluginIconThemeService, PluginIconThemeFactory, PluginIconThemeDefinition, PluginIconTheme } from './plugin-icon-theme-service';
import { PluginTreeViewNodeLabelProvider } from './view/plugin-tree-view-node-label-provider';
import { CommandRegistryMainImpl } from './command-registry-main';
import { TextContentResourceResolver } from './text-content-resource';
import { FSResourceResolver } from './fs-resource-resolver';
import { RPCProtocolServiceProvider, RPCProtocolPluginAPIFactory, RPCProtocolPluginAPIImpl } from './main-context';
import { LanguagesMainImpl } from './languages-main';
import { QuickOpenMainImpl } from './quick-open-main';
import { OutputChannelRegistryMainImpl } from './output-channel-registry-main';
import { WorkspaceMainImpl } from './workspace-main';
import { DialogsMainImpl } from './dialogs-main';
import { MessageRegistryMainImpl } from './message-registry-main';
import { PreferenceRegistryMainImpl } from './preference-registry-main';
import { StatusBarMessageRegistryMainImpl } from './status-bar-message-registry-main';
import { EnvMainImpl } from './env-main';
import { NotificationMainImpl } from './notification-main';
import { TerminalServiceMainImpl } from './terminal-main';
import { TreeViewsMainImpl } from './view/tree-views-main';
import { WebviewsMainImpl } from './webviews-main';
import { StorageMainImpl } from './plugin-storage';
import { ConnectionMainImpl } from './connection-main';
import { TasksMainImpl } from './tasks-main';
import { LanguagesContributionMainImpl } from './languages-contribution-main';
import { ScmMainImpl } from './scm-main';
import { DecorationsMainImpl } from './decorations/decorations-main';
import { WindowStateMain } from './window-state-main';
import { ClipboardMainImpl } from './clipboard-main';
import { DebugMainImpl } from './debug/debug-main';
import { EditorsAndDocumentsMain } from './editors-and-documents-main';
import { TextEditorsMainImpl } from './text-editors-main';
import { DocumentsMainImpl } from './documents-main';

export default new ContainerModule((bind, unbind, isBound, rebind) => {

    bind(EditorsAndDocumentsMain).toSelf().inTransientScope();
    bind(CommandRegistryMainImpl).toSelf().inTransientScope();
    bind(QuickOpenMainImpl).toSelf().inTransientScope();
    bind(LanguagesMainImpl).toSelf().inTransientScope();
    bind(OutputChannelRegistryMainImpl).toSelf().inTransientScope();
    bind(WorkspaceMainImpl).toSelf().inTransientScope();
    bind(DialogsMainImpl).toSelf().inTransientScope();
    bind(MessageRegistryMainImpl).toSelf().inTransientScope();
    bind(PreferenceRegistryMainImpl).toSelf().inTransientScope();
    bind(StatusBarMessageRegistryMainImpl).toSelf().inTransientScope();
    bind(EnvMainImpl).toSelf().inTransientScope();
    bind(NotificationMainImpl).toSelf().inTransientScope();
    bind(TerminalServiceMainImpl).toSelf().inTransientScope();
    bind(TreeViewsMainImpl).toSelf().inTransientScope();
    bind(WebviewsMainImpl).toSelf().inTransientScope();
    bind(StorageMainImpl).toSelf().inTransientScope();
    bind(ConnectionMainImpl).toSelf().inTransientScope();
    bind(TasksMainImpl).toSelf().inTransientScope();
    bind(LanguagesContributionMainImpl).toSelf().inTransientScope();
    bind(DebugMainImpl).toSelf().inTransientScope();
    bind(ScmMainImpl).toSelf().inTransientScope();
    bind(DecorationsMainImpl).toSelf().inTransientScope();
    bind(WindowStateMain).toSelf().inTransientScope();
    bind(ClipboardMainImpl).toSelf().inTransientScope();
    bind(TextEditorsMainImpl).toSelf().inTransientScope();
    bind(DocumentsMainImpl).toSelf().inTransientScope();

    bindContributionProvider(bind, RPCProtocolServiceProvider);
    bind(RPCProtocolServiceProvider).to(CommandRegistryMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(QuickOpenMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(LanguagesMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(OutputChannelRegistryMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(WorkspaceMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(DialogsMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(MessageRegistryMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(PreferenceRegistryMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(StatusBarMessageRegistryMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(EnvMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(NotificationMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(TerminalServiceMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(TreeViewsMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(WebviewsMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(StorageMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(ConnectionMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(TasksMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(LanguagesContributionMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(DebugMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(ScmMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(DecorationsMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(WindowStateMain).inTransientScope();
    bind(RPCProtocolServiceProvider).to(ClipboardMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(DocumentsMainImpl).inTransientScope();
    bind(RPCProtocolServiceProvider).to(TextEditorsMainImpl).inTransientScope();

    bind(RPCProtocolPluginAPIImpl).toSelf().inTransientScope();
    bind(RPCProtocolPluginAPIFactory).toFactory(context => (rpc: RPCProtocol) => {
        const child = context.container.createChild();
        child.bind(RPCProtocol).toConstantValue(rpc);
        return child.get(RPCProtocolPluginAPIImpl);
    });

    bind(ModalNotification).toSelf().inSingletonScope();

    bind(HostedPluginSupport).toSelf().inSingletonScope();
    bind(HostedPluginWatcher).toSelf().inSingletonScope();
    bind(SelectionProviderCommandContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(SelectionProviderCommandContribution);

    bind(OpenUriCommandHandler).toSelf().inSingletonScope();
    bind(PluginApiFrontendContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(PluginApiFrontendContribution);

    bind(TextEditorService).toSelf().inSingletonScope();
    bind(EditorModelService).toSelf().inSingletonScope();

    bind(UntitledResourceResolver).toSelf().inSingletonScope();
    bind(ResourceResolver).toService(UntitledResourceResolver);

    bind(FrontendApplicationContribution).toDynamicValue(ctx => ({
        onStart(app: FrontendApplication): MaybePromise<void> {
            ctx.container.get(HostedPluginSupport).onStart(ctx.container);
        }
    }));
    bind(HostedPluginServer).toDynamicValue(ctx => {
        const connection = ctx.container.get(WebSocketConnectionProvider);
        const hostedWatcher = ctx.container.get(HostedPluginWatcher);
        return connection.createProxy<HostedPluginServer>(hostedServicePath, hostedWatcher.getHostedPluginClient());
    }).inSingletonScope();

    bind(PluginPathsService).toDynamicValue(ctx => {
        const connection = ctx.container.get(WebSocketConnectionProvider);
        return connection.createProxy<PluginPathsService>(pluginPathsServicePath);
    }).inSingletonScope();

    bindViewContribution(bind, PluginFrontendViewContribution);

    bind(PluginWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: PluginFrontendViewContribution.PLUGINS_WIDGET_FACTORY_ID,
        createWidget: () => ctx.container.get(PluginWidget)
    }));

    bind(PluginExtDeployCommandService).toSelf().inSingletonScope();
    bind(PluginServer).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<PluginServer>(pluginServerJsonRpcPath);
    }).inSingletonScope();

    bind(ViewContextKeyService).toSelf().inSingletonScope();

    bind(PluginTreeViewNodeLabelProvider).toSelf().inSingletonScope();
    bind(LabelProviderContribution).toService(PluginTreeViewNodeLabelProvider);
    bind(WidgetFactory).toDynamicValue(({ container }) => ({
        id: PLUGIN_VIEW_DATA_FACTORY_ID,
        createWidget: (identifier: TreeViewWidgetIdentifier) => {
            const child = createTreeContainer(container, {
                contextMenuPath: VIEW_ITEM_CONTEXT_MENU,
                globalSelection: true
            });
            child.bind(TreeViewWidgetIdentifier).toConstantValue(identifier);
            child.bind(PluginTree).toSelf();
            child.rebind(TreeImpl).toService(PluginTree);
            child.bind(PluginTreeModel).toSelf();
            child.rebind(TreeModelImpl).toService(PluginTreeModel);
            child.bind(TreeViewWidget).toSelf();
            child.rebind(TreeWidget).toService(TreeViewWidget);
            return child.get(TreeWidget);
        }
    })).inSingletonScope();

    bind(PluginCommandOpenHandler).toSelf().inSingletonScope();
    bind(OpenHandler).toService(PluginCommandOpenHandler);

    bindWebviewPreferences(bind);
    bind(WebviewEnvironment).toSelf().inSingletonScope();
    bind(WebviewThemeDataProvider).toSelf().inSingletonScope();
    bind(WebviewResourceLoader).toDynamicValue(ctx =>
        WebSocketConnectionProvider.createProxy(ctx.container, WebviewResourceLoaderPath)
    ).inSingletonScope();
    bind(WebviewResourceCache).toSelf().inSingletonScope();
    bind(WebviewWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(({ container }) => ({
        id: WebviewWidget.FACTORY_ID,
        createWidget: async (identifier: WebviewWidgetIdentifier) => {
            const externalEndpoint = await container.get(WebviewEnvironment).externalEndpoint();
            let endpoint = externalEndpoint.replace('{{uuid}}', identifier.id);
            if (endpoint[endpoint.length - 1] === '/') {
                endpoint = endpoint.slice(0, endpoint.length - 1);
            }

            const child = container.createChild();
            child.bind(WebviewWidgetIdentifier).toConstantValue(identifier);
            child.bind(WebviewWidgetExternalEndpoint).toConstantValue(endpoint);
            return child.get(WebviewWidget);
        }
    })).inSingletonScope();

    bind(PluginViewWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(({ container }) => ({
        id: PLUGIN_VIEW_FACTORY_ID,
        createWidget: (identifier: PluginViewWidgetIdentifier) => {
            const child = container.createChild();
            child.bind(PluginViewWidgetIdentifier).toConstantValue(identifier);
            return child.get(PluginViewWidget);
        }
    })).inSingletonScope();

    bind(WidgetFactory).toDynamicValue(({ container }) => ({
        id: PLUGIN_VIEW_CONTAINER_FACTORY_ID,
        createWidget: (identifier: ViewContainerIdentifier) =>
            container.get<ViewContainer.Factory>(ViewContainer.Factory)(identifier)
    })).inSingletonScope();
    bind(PluginSharedStyle).toSelf().inSingletonScope();
    bind(PluginViewRegistry).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(PluginViewRegistry);

    bind(PluginIconThemeFactory).toFactory<PluginIconTheme>(({ container }) => (definition: PluginIconThemeDefinition) => {
        const child = container.createChild();
        child.bind(PluginIconThemeDefinition).toConstantValue(definition);
        child.bind(PluginIconTheme).toSelf().inSingletonScope();
        return child.get(PluginIconTheme);
    });
    bind(PluginIconThemeService).toSelf().inSingletonScope();
    bind(LabelProviderContribution).toService(PluginIconThemeService);

    bind(MenusContributionPointHandler).toSelf().inSingletonScope();
    bind(KeybindingsContributionPointHandler).toSelf().inSingletonScope();
    bind(PluginContributionHandler).toSelf().inSingletonScope();

    bind(InPluginFileSystemWatcherManager).toSelf().inSingletonScope();
    bind(TextContentResourceResolver).toSelf().inSingletonScope();
    bind(ResourceResolver).toService(TextContentResourceResolver);
    bind(FSResourceResolver).toSelf().inSingletonScope();
    bind(ResourceResolver).toService(FSResourceResolver);
    bindContributionProvider(bind, MainPluginApiProvider);

    bind(LanguageClientContributionProviderImpl).toSelf().inSingletonScope();
    bind(LanguageClientContributionProvider).toService(LanguageClientContributionProviderImpl);
    bind(LanguageClientProviderImpl).toSelf().inSingletonScope();
    rebind(LanguageClientProvider).toService(LanguageClientProviderImpl);

    bind(PluginDebugService).toSelf().inSingletonScope();
    rebind(DebugService).toService(PluginDebugService);
    bind(PluginDebugSessionContributionRegistry).toSelf().inSingletonScope();
    rebind(DebugSessionContributionRegistry).toService(PluginDebugSessionContributionRegistry);

    bind(ViewColumnService).toSelf().inSingletonScope();
});
