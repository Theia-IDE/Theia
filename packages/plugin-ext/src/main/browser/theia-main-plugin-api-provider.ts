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
import { interfaces, injectable } from 'inversify';
import { CommandRegistryMainImpl } from './command-registry-main';
import { PreferenceRegistryMainImpl } from './preference-registry-main';
import { QuickOpenMainImpl } from './quick-open-main';
import { RPCProtocol } from '../../common/rpc-protocol';
import { PLUGIN_RPC_CONTEXT, LanguagesMainFactory, OutputChannelRegistryFactory, UIKind } from '../../common/plugin-api-rpc';
import { MessageRegistryMainImpl } from './message-registry-main';
import { WindowStateMain } from './window-state-main';
import { WorkspaceMainImpl } from './workspace-main';
import { StatusBarMessageRegistryMainImpl } from './status-bar-message-registry-main';
import { EnvMainImpl } from './env-main';
import { EditorsAndDocumentsMain } from './editors-and-documents-main';
import { TerminalServiceMainImpl } from './terminal-main';
import { DialogsMainImpl } from './dialogs-main';
import { TreeViewsMainImpl } from './view/tree-views-main';
import { NotificationMainImpl } from './notification-main';
import { ConnectionMainImpl } from './connection-main';
import { WebviewsMainImpl } from './webviews-main';
import { TasksMainImpl } from './tasks-main';
import { StorageMainImpl } from './plugin-storage';
import { LanguagesContributionMainImpl } from './languages-contribution-main';
import { DebugMainImpl } from './debug/debug-main';
import { FileSystemMainImpl } from './file-system-main';
import { ScmMainImpl } from './scm-main';
import { DecorationsMainImpl } from './decorations/decorations-main';
import { ClipboardMainImpl } from './clipboard-main';
import { DocumentsMainImpl } from './documents-main';
import { TextEditorsMainImpl } from './text-editors-main';
import { EditorManager } from '@theia/editor/lib/browser';
import { EditorModelService } from './text-editor-model-service';
import { OpenerService } from '@theia/core/lib/browser/opener-service';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { MonacoBulkEditService } from '@theia/monaco/lib/browser/monaco-bulk-edit-service';
import { MonacoEditorService } from '@theia/monaco/lib/browser/monaco-editor-service';
import { UntitledResourceResolver } from './editor/untitled-resource';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { FileResourceResolver } from '@theia/filesystem/lib/browser';
import { MainPluginApiProvider, PluginServer } from '../../common';
import { TheiaAPIInitParameters } from '../../plugin/plugin-context';
import { WebviewEnvironment } from './webview/webview-environment';
import { PreferenceProviderProvider } from '@theia/core/lib/browser/preferences';
import { getPreferences } from './preference-registry-main';
import { getQueryParameters } from './env-main';
import { FrontendApplicationConfigProvider } from '@theia/core/lib/browser/frontend-application-config-provider';
import { environment } from '@theia/application-package/lib/environment';
import { JsonSchemaStore } from '@theia/core/lib/browser/json-schema-store';

@injectable()
export class TheiaMainPluginAPIProvider implements MainPluginApiProvider {
    readonly id: string = 'theia';

    initialize(rpc: RPCProtocol, container: interfaces.Container): void {

        const commandRegistryMain = new CommandRegistryMainImpl(rpc, container);
        rpc.set(PLUGIN_RPC_CONTEXT.COMMAND_REGISTRY_MAIN, commandRegistryMain);

        const quickOpenMain = new QuickOpenMainImpl(rpc, container);
        rpc.set(PLUGIN_RPC_CONTEXT.QUICK_OPEN_MAIN, quickOpenMain);

        const workspaceMain = new WorkspaceMainImpl(rpc, container);
        rpc.set(PLUGIN_RPC_CONTEXT.WORKSPACE_MAIN, workspaceMain);

        const dialogsMain = new DialogsMainImpl(rpc, container);
        rpc.set(PLUGIN_RPC_CONTEXT.DIALOGS_MAIN, dialogsMain);

        const messageRegistryMain = new MessageRegistryMainImpl(container);
        rpc.set(PLUGIN_RPC_CONTEXT.MESSAGE_REGISTRY_MAIN, messageRegistryMain);

        const preferenceRegistryMain = new PreferenceRegistryMainImpl(rpc, container);
        rpc.set(PLUGIN_RPC_CONTEXT.PREFERENCE_REGISTRY_MAIN, preferenceRegistryMain);

        const editorsAndDocuments = new EditorsAndDocumentsMain(rpc, container);

        const modelService = container.get(EditorModelService);
        const editorManager = container.get(EditorManager);
        const openerService = container.get<OpenerService>(OpenerService);
        const shell = container.get(ApplicationShell);
        const untitledResourceResolver = container.get(UntitledResourceResolver);
        const fileResourceResolver = container.get(FileResourceResolver);
        const documentsMain = new DocumentsMainImpl(editorsAndDocuments, modelService, rpc, editorManager, openerService, shell, untitledResourceResolver, fileResourceResolver);
        rpc.set(PLUGIN_RPC_CONTEXT.DOCUMENTS_MAIN, documentsMain);

        const bulkEditService = container.get(MonacoBulkEditService);
        const monacoEditorService = container.get(MonacoEditorService);
        const editorsMain = new TextEditorsMainImpl(editorsAndDocuments, rpc, bulkEditService, monacoEditorService);
        rpc.set(PLUGIN_RPC_CONTEXT.TEXT_EDITORS_MAIN, editorsMain);

        // start listening only after all clients are subscribed to events
        editorsAndDocuments.listen();

        const statusBarMessageRegistryMain = new StatusBarMessageRegistryMainImpl(container);
        rpc.set(PLUGIN_RPC_CONTEXT.STATUS_BAR_MESSAGE_REGISTRY_MAIN, statusBarMessageRegistryMain);

        const envMain = new EnvMainImpl(rpc, container);
        rpc.set(PLUGIN_RPC_CONTEXT.ENV_MAIN, envMain);

        const notificationMain = new NotificationMainImpl(rpc, container);
        rpc.set(PLUGIN_RPC_CONTEXT.NOTIFICATION_MAIN, notificationMain);

        const terminalMain = new TerminalServiceMainImpl(rpc, container);
        rpc.set(PLUGIN_RPC_CONTEXT.TERMINAL_MAIN, terminalMain);

        const treeViewsMain = new TreeViewsMainImpl(rpc, container);
        rpc.set(PLUGIN_RPC_CONTEXT.TREE_VIEWS_MAIN, treeViewsMain);

        const outputChannelRegistryFactory: OutputChannelRegistryFactory = container.get(OutputChannelRegistryFactory);
        const outputChannelRegistryMain = outputChannelRegistryFactory();
        rpc.set(PLUGIN_RPC_CONTEXT.OUTPUT_CHANNEL_REGISTRY_MAIN, outputChannelRegistryMain);

        const languagesMainFactory: LanguagesMainFactory = container.get(LanguagesMainFactory);
        const languagesMain = languagesMainFactory(rpc);
        rpc.set(PLUGIN_RPC_CONTEXT.LANGUAGES_MAIN, languagesMain);

        const webviewsMain = new WebviewsMainImpl(rpc, container);
        rpc.set(PLUGIN_RPC_CONTEXT.WEBVIEWS_MAIN, webviewsMain);

        const storageMain = new StorageMainImpl(container);
        rpc.set(PLUGIN_RPC_CONTEXT.STORAGE_MAIN, storageMain);

        const connectionMain = new ConnectionMainImpl(rpc);
        rpc.set(PLUGIN_RPC_CONTEXT.CONNECTION_MAIN, connectionMain);

        const tasksMain = new TasksMainImpl(rpc, container);
        rpc.set(PLUGIN_RPC_CONTEXT.TASKS_MAIN, tasksMain);

        const languagesContribution = new LanguagesContributionMainImpl(rpc, container, connectionMain);
        rpc.set(PLUGIN_RPC_CONTEXT.LANGUAGES_CONTRIBUTION_MAIN, languagesContribution);

        const debugMain = new DebugMainImpl(rpc, connectionMain, container);
        rpc.set(PLUGIN_RPC_CONTEXT.DEBUG_MAIN, debugMain);

        rpc.set(PLUGIN_RPC_CONTEXT.FILE_SYSTEM_MAIN, new FileSystemMainImpl(rpc, container));

        const scmMain = new ScmMainImpl(rpc, container);
        rpc.set(PLUGIN_RPC_CONTEXT.SCM_MAIN, scmMain);

        const decorationsMain = new DecorationsMainImpl(rpc, container);
        rpc.set(PLUGIN_RPC_CONTEXT.DECORATIONS_MAIN, decorationsMain);

        const windowMain = new WindowStateMain(rpc, container);
        rpc.set(PLUGIN_RPC_CONTEXT.WINDOW_MAIN, windowMain);

        const clipboardMain = new ClipboardMainImpl(container);
        rpc.set(PLUGIN_RPC_CONTEXT.CLIPBOARD_MAIN, clipboardMain);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async computeInitParameters?(rpc: RPCProtocol, container: interfaces.Container): Promise<TheiaAPIInitParameters> {
        const pluginServer: PluginServer = container.get(PluginServer);
        const webviewEnvironment: WebviewEnvironment = container.get(WebviewEnvironment);
        const terminalService: TerminalService = container.get(TerminalService);
        const preferenceProviderProvider: PreferenceProviderProvider = container.get(PreferenceProviderProvider);
        const workspaceService: WorkspaceService = container.get(WorkspaceService);
        const jsonSchemaStore = container.get(JsonSchemaStore);
        const [globalState, workspaceState, webviewResourceRoot, webviewCspSource, defaultShell, jsonSchemas] = await Promise.all([
            pluginServer.getAllStorageValues(undefined),
            pluginServer.getAllStorageValues({
                workspace: workspaceService.workspace,
                roots: workspaceService.tryGetRoots()
            }),
            webviewEnvironment.resourceRoot(),
            webviewEnvironment.cspSource(),
            terminalService.getDefaultShell(),
            jsonSchemaStore.schemas
        ]);

        return {
            preferences: getPreferences(preferenceProviderProvider, workspaceService.tryGetRoots()),
            globalState,
            workspaceState,
            env: {
                queryParams: getQueryParameters(),
                language: navigator.language,
                shell: defaultShell,
                uiKind: environment.electron.is() ? UIKind.Desktop : UIKind.Web,
                appName: FrontendApplicationConfigProvider.get().applicationName
            },
            webview: {
                webviewResourceRoot,
                webviewCspSource
            },
            jsonValidation: jsonSchemas
        };
    }
}
