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

import { Command, CommandContribution, CommandRegistry, environment, isOSX } from '@theia/core';
import {
    ApplicationShell,
    CommonCommands,
    NavigatableWidget,
    open,
    OpenerService,
    PrefixQuickOpenService,
    Saveable
} from '@theia/core/lib/browser';
import { ContextKeyService } from '@theia/core/lib/browser/context-key-service';
import { ApplicationShellMouseTracker } from '@theia/core/lib/browser/shell/application-shell-mouse-tracker';
import { CommandService } from '@theia/core/lib/common/command';
import TheiaURI from '@theia/core/lib/common/uri';
import { EditorManager, EditorCommands } from '@theia/editor/lib/browser';
import {
    CodeEditorWidgetUtil
} from '@theia/plugin-ext/lib/main/browser/menus/menus-contribution-handler';
import {
    TextDocumentShowOptions,
    Location,
    CallHierarchyItem,
    CallHierarchyIncomingCall,
    CallHierarchyOutgoingCall,
    Hover,
    TextEdit,
    FormattingOptions,
    DocumentHighlight
} from '@theia/plugin-ext/lib/common/plugin-api-rpc-model';
import { DocumentsMainImpl } from '@theia/plugin-ext/lib/main/browser/documents-main';
import { createUntitledURI } from '@theia/plugin-ext/lib/main/browser/editor/untitled-resource';
import { isUriComponents, toDocumentSymbol } from '@theia/plugin-ext/lib/plugin/type-converters';
import { ViewColumn } from '@theia/plugin-ext/lib/plugin/types-impl';
import { WorkspaceCommands } from '@theia/workspace/lib/browser';
import { WorkspaceService, WorkspaceInput } from '@theia/workspace/lib/browser/workspace-service';
import { DiffService } from '@theia/workspace/lib/browser/diff-service';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Position } from '@theia/plugin-ext/lib/common/plugin-api-rpc';
import { URI } from '@theia/core/shared/vscode-uri';
import { PluginServer } from '@theia/plugin-ext/lib/common/plugin-protocol';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { TerminalFrontendContribution } from '@theia/terminal/lib/browser/terminal-frontend-contribution';
import { QuickOpenWorkspace } from '@theia/workspace/lib/browser/quick-open-workspace';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import {
    FileNavigatorCommands,
    FILE_NAVIGATOR_TOGGLE_COMMAND_ID
} from '@theia/navigator/lib/browser/navigator-contribution';
import { FILE_NAVIGATOR_ID, FileNavigatorWidget } from '@theia/navigator/lib/browser';
import { SelectableTreeNode } from '@theia/core/lib/browser/tree/tree-selection';
import { UriComponents } from '@theia/plugin-ext/lib/common/uri-components';
import { FileService } from '@theia/filesystem/lib/browser/file-service';

export namespace VscodeCommands {
    export const OPEN: Command = {
        id: 'vscode.open'
    };

    export const OPEN_FOLDER: Command = {
        id: 'vscode.openFolder'
    };

    export const DIFF: Command = {
        id: 'vscode.diff'
    };

    export const INSTALL_FROM_VSIX: Command = {
        id: 'workbench.extensions.installExtension'
    };
}

@injectable()
export class PluginVscodeCommandsContribution implements CommandContribution {
    @inject(CommandService)
    protected readonly commandService: CommandService;
    @inject(ContextKeyService)
    protected readonly contextKeyService: ContextKeyService;
    @inject(EditorManager)
    protected readonly editorManager: EditorManager;
    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;
    @inject(DiffService)
    protected readonly diffService: DiffService;
    @inject(OpenerService)
    protected readonly openerService: OpenerService;
    @inject(ApplicationShellMouseTracker)
    protected readonly mouseTracker: ApplicationShellMouseTracker;
    @inject(PrefixQuickOpenService)
    protected readonly quickOpen: PrefixQuickOpenService;
    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;
    @inject(TerminalFrontendContribution)
    protected readonly terminalContribution: TerminalFrontendContribution;
    @inject(QuickOpenWorkspace)
    protected readonly quickOpenWorkspace: QuickOpenWorkspace;
    @inject(TerminalService)
    protected readonly terminalService: TerminalService;
    @inject(CodeEditorWidgetUtil)
    protected readonly codeEditorWidgetUtil: CodeEditorWidgetUtil;
    @inject(PluginServer)
    protected readonly pluginServer: PluginServer;
    @inject(FileService)
    protected readonly fileService: FileService;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(VscodeCommands.OPEN, {
            isVisible: () => false,
            execute: async (resource: URI, columnOrOptions?: ViewColumn | TextDocumentShowOptions) => {
                if (!resource) {
                    throw new Error(`${VscodeCommands.OPEN.id} command requires at least URI argument.`);
                }
                if (!URI.isUri(resource)) {
                    throw new Error(`Invalid argument for ${VscodeCommands.OPEN.id} command with URI argument. Found ${resource}`);
                }

                let options: TextDocumentShowOptions | undefined;
                if (typeof columnOrOptions === 'number') {
                    options = {
                        viewColumn: columnOrOptions
                    };
                } else if (columnOrOptions) {
                    options = {
                        ...columnOrOptions
                    };
                }
                const editorOptions = DocumentsMainImpl.toEditorOpenerOptions(this.shell, options);
                await open(this.openerService, new TheiaURI(resource), editorOptions);
            }
        });

        interface IOpenFolderAPICommandOptions {
            forceNewWindow?: boolean;
            forceReuseWindow?: boolean;
            noRecentEntry?: boolean;
        }

        commands.registerCommand(VscodeCommands.OPEN_FOLDER, {
            isVisible: () => false,
            execute: async (resource?: URI, arg: boolean | IOpenFolderAPICommandOptions = {}) => {
                if (!resource) {
                    return commands.executeCommand(WorkspaceCommands.OPEN_WORKSPACE.id);
                }
                if (!URI.isUri(resource)) {
                    throw new Error(`Invalid argument for ${VscodeCommands.OPEN_FOLDER.id} command with URI argument. Found ${resource}`);
                }
                let options: WorkspaceInput | undefined;
                if (typeof arg === 'boolean') {
                    options = { preserveWindow: !arg };
                } else {
                    options = { preserveWindow: !arg.forceNewWindow };
                }
                this.workspaceService.open(new TheiaURI(resource), options);
            }
        });

        commands.registerCommand(VscodeCommands.DIFF, {
            isVisible: () => false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            execute: async (left: URI, right: URI, label?: string, options?: TextDocumentShowOptions) => {
                if (!left || !right) {
                    throw new Error(`${VscodeCommands.DIFF} command requires at least two URI arguments. Found left=${left}, right=${right} as arguments`);
                }
                if (!URI.isUri(left)) {
                    throw new Error(`Invalid argument for ${VscodeCommands.DIFF.id} command with left argument. Expecting URI left type but found ${left}`);
                }
                if (!URI.isUri(right)) {
                    throw new Error(`Invalid argument for ${VscodeCommands.DIFF.id} command with right argument. Expecting URI right type but found ${right}`);
                }

                const leftURI = new TheiaURI(left);
                const editorOptions = DocumentsMainImpl.toEditorOpenerOptions(this.shell, options);
                await this.diffService.openDiffEditor(leftURI, new TheiaURI(right), label, editorOptions);
            }
        });

        // https://code.visualstudio.com/docs/getstarted/keybindings#_navigation
        /*
         * internally, in VS Code, any widget opened in the main area is represented as an editor
         * operations below apply to them, but not to side-bar widgets, like the explorer
         *
         * in Theia, there are not such difference and any widget can be put in any area
         * because of it we filter out editors from views based on `NavigatableWidget.is`
         * and apply actions only to them
         */
        commands.registerCommand({ id: 'workbench.action.files.newUntitledFile' }, {
            execute: () => open(this.openerService, createUntitledURI())
        });

        if (!environment.electron.is() || isOSX) {
            commands.registerCommand({ id: 'workbench.action.files.openFileFolder' }, {
                execute: () => commands.executeCommand(WorkspaceCommands.OPEN.id)
            });
        }

        commands.registerCommand({ id: 'workbench.action.files.openFile' }, {
            execute: () => commands.executeCommand(WorkspaceCommands.OPEN_FILE.id)
        });
        commands.registerCommand({ id: 'workbench.action.files.openFolder' }, {
            execute: () => commands.executeCommand(WorkspaceCommands.OPEN_FOLDER.id)
        });
        commands.registerCommand({ id: 'workbench.action.addRootFolder' }, {
            execute: () => commands.executeCommand(WorkspaceCommands.ADD_FOLDER.id)
        });
        commands.registerCommand({ id: 'workbench.action.gotoLine' }, {
            execute: () => commands.executeCommand('editor.action.gotoLine')
        });
        commands.registerCommand({ id: 'workbench.action.quickOpen' }, {
            execute: (prefix?: unknown) => this.quickOpen.open(typeof prefix === 'string' ? prefix : '')
        });
        commands.registerCommand({ id: 'workbench.action.openSettings' }, {
            execute: (query?: string) => commands.executeCommand(CommonCommands.OPEN_PREFERENCES.id, query)
        });
        commands.registerCommand({ id: VscodeCommands.INSTALL_FROM_VSIX.id }, {
            execute: async (vsixUriOrExtensionId: TheiaURI | UriComponents | string) => {
                if (typeof vsixUriOrExtensionId === 'string') {
                    await this.pluginServer.deploy(`vscode:extension/${vsixUriOrExtensionId}`);
                } else {
                    const uriPath = isUriComponents(vsixUriOrExtensionId) ? URI.revive(vsixUriOrExtensionId).fsPath : await this.fileService.fsPath(vsixUriOrExtensionId);
                    await this.pluginServer.deploy(`local-file:${uriPath}`);
                }
            }
        });
        commands.registerCommand({ id: 'workbench.action.files.save', }, {
            execute: (uri?: monaco.Uri) => {
                if (uri) {
                    const uriString = uri.toString();
                    const widget = this.shell.widgets.find(w => {
                        const resourceUri = Saveable.is(w) && NavigatableWidget.is(w) && w.getResourceUri();
                        return (resourceUri && resourceUri.toString()) === uriString;
                    });
                    if (Saveable.is(widget)) {
                        Saveable.save(widget);
                    }
                } else {
                    this.shell.save();
                }
            }
        });
        commands.registerCommand({ id: 'workbench.action.files.saveAll', }, {
            execute: () => this.shell.saveAll()
        });
        commands.registerCommand({ id: 'workbench.action.closeActiveEditor' }, {
            execute: async (uri?: monaco.Uri) => {
                let widget = this.editorManager.currentEditor || this.shell.currentWidget;
                if (uri) {
                    const uriString = uri.toString();
                    widget = this.shell.widgets.find(w => {
                        const resourceUri = NavigatableWidget.is(w) && w.getResourceUri();
                        return (resourceUri && resourceUri.toString()) === uriString;
                    });
                }
                if (this.codeEditorWidgetUtil.is(widget)) {
                    await this.shell.closeWidget(widget.id);
                }
            }
        });
        commands.registerCommand({ id: 'workbench.action.closeOtherEditors' }, {
            execute: async (uri?: monaco.Uri) => {
                let editor = this.editorManager.currentEditor || this.shell.currentWidget;
                if (uri) {
                    const uriString = uri.toString();
                    editor = this.editorManager.all.find(e => {
                        const resourceUri = e.getResourceUri();
                        return (resourceUri && resourceUri.toString()) === uriString;
                    });
                }
                for (const widget of this.shell.widgets) {
                    if (this.codeEditorWidgetUtil.is(widget) && widget !== editor) {
                        await this.shell.closeWidget(widget.id);
                    }
                }
            }
        });
        commands.registerCommand({ id: 'workbench.action.closeEditorsInGroup' }, {
            execute: (uri?: monaco.Uri) => {
                let editor = this.editorManager.currentEditor || this.shell.currentWidget;
                if (uri) {
                    const uriString = uri.toString();
                    editor = this.editorManager.all.find(e => {
                        const resourceUri = e.getResourceUri();
                        return (resourceUri && resourceUri.toString()) === uriString;
                    });
                }
                if (editor) {
                    const tabBar = this.shell.getTabBarFor(editor);
                    if (tabBar) {
                        this.shell.closeTabs(tabBar,
                            ({ owner }) => this.codeEditorWidgetUtil.is(owner)
                        );
                    }
                }
            }
        });
        commands.registerCommand({ id: 'workbench.action.closeEditorsInOtherGroups' }, {
            execute: () => {
                const editor = this.editorManager.currentEditor || this.shell.currentWidget;
                if (editor) {
                    const editorTabBar = this.shell.getTabBarFor(editor);
                    for (const tabBar of this.shell.allTabBars) {
                        if (tabBar !== editorTabBar) {
                            this.shell.closeTabs(tabBar,
                                ({ owner }) => this.codeEditorWidgetUtil.is(owner)
                            );
                        }
                    }
                }
            }
        });
        commands.registerCommand({ id: 'workbench.action.closeEditorsToTheLeft' }, {
            execute: () => {
                const editor = this.editorManager.currentEditor || this.shell.currentWidget;
                if (editor) {
                    const tabBar = this.shell.getTabBarFor(editor);
                    if (tabBar) {
                        let left = true;
                        this.shell.closeTabs(tabBar,
                            ({ owner }) => {
                                if (owner === editor) {
                                    left = false;
                                    return false;
                                }
                                return left && this.codeEditorWidgetUtil.is(owner);
                            }
                        );
                    }
                }
            }
        });
        commands.registerCommand({ id: 'workbench.action.closeEditorsToTheRight' }, {
            execute: () => {
                const editor = this.editorManager.currentEditor || this.shell.currentWidget;
                if (editor) {
                    const tabBar = this.shell.getTabBarFor(editor);
                    if (tabBar) {
                        let left = true;
                        this.shell.closeTabs(tabBar,
                            ({ owner }) => {
                                if (owner === editor) {
                                    left = false;
                                    return false;
                                }
                                return !left && this.codeEditorWidgetUtil.is(owner);
                            }
                        );
                    }
                }
            }
        });
        commands.registerCommand({ id: 'workbench.action.closeAllEditors' }, {
            execute: async () => {
                const promises = [];
                for (const widget of this.shell.widgets) {
                    if (this.codeEditorWidgetUtil.is(widget)) {
                        promises.push(this.shell.closeWidget(widget.id));
                    }
                }
                await Promise.all(promises);
            }
        });
        commands.registerCommand({ id: 'workbench.action.nextEditor' }, {
            execute: () => this.shell.activateNextTab()
        });
        commands.registerCommand({ id: 'workbench.action.previousEditor' }, {
            execute: () => this.shell.activatePreviousTab()
        });
        commands.registerCommand({ id: 'workbench.action.navigateBack' }, {
            execute: () => commands.executeCommand(EditorCommands.GO_BACK.id)
        });
        commands.registerCommand({ id: 'workbench.action.navigateForward' }, {
            execute: () => commands.executeCommand(EditorCommands.GO_FORWARD.id)
        });
        commands.registerCommand({ id: 'workbench.action.navigateToLastEditLocation' }, {
            execute: () => commands.executeCommand(EditorCommands.GO_LAST_EDIT.id)
        });

        commands.registerCommand({ id: 'openInTerminal' }, {
            execute: (resource: URI) => this.terminalContribution.openInTerminal(new TheiaURI(resource.toString()))
        });

        commands.registerCommand({ id: 'workbench.action.reloadWindow' }, {
            execute: () => {
                window.location.reload();
            }
        });

        commands.registerCommand({ id: 'workbench.action.revertAndCloseActiveEditor' }, {
            execute: async () => {
                const editor = this.editorManager.currentEditor;
                if (editor) {
                    const monacoEditor = MonacoEditor.getCurrent(this.editorManager);
                    if (monacoEditor) {
                        try {
                            await monacoEditor.document.revert();
                            editor.close();
                        } catch (error) {
                            await this.shell.closeWidget(editor.id, { save: false });
                        }
                    }
                }
            }
        });

        /**
         * TODO:
         * Open Next: workbench.action.openNextRecentlyUsedEditorInGroup
         * Open Previous: workbench.action.openPreviousRecentlyUsedEditorInGroup
         * Copy Path of Active File: workbench.action.files.copyPathOfActiveFile
         * Reveal Active File in Windows: workbench.action.files.revealActiveFileInWindows
         * Show Opened File in New Window: workbench.action.files.showOpenedFileInNewWindow
         * Compare Opened File With: workbench.files.action.compareFileWith
         */

        // Register built-in language service commands
        // see https://code.visualstudio.com/api/references/commands
        /* eslint-disable @typescript-eslint/no-explicit-any */

        // TODO register other `vscode.execute...` commands.
        // see https://github.com/microsoft/vscode/blob/master/src/vs/workbench/api/common/extHostApiCommands.ts
        commands.registerCommand(
            {
                id: 'vscode.executeDefinitionProvider'
            },
            {
                execute: ((resource: URI, position: Position) =>
                    commands.executeCommand<Location[]>('_executeDefinitionProvider', monaco.Uri.from(resource), position))
            }
        );
        commands.registerCommand(
            {
                id: 'vscode.executeDeclarationProvider'
            },
            {
                execute: ((resource: URI, position: Position) =>
                    commands.executeCommand<Location[]>('_executeDeclarationProvider', monaco.Uri.from(resource), position))
            }
        );
        commands.registerCommand(
            {
                id: 'vscode.executeTypeDefinitionProvider'
            },
            {
                execute: ((resource: URI, position: Position) =>
                    commands.executeCommand<Location[]>('_executeTypeDefinitionProvider', monaco.Uri.from(resource), position))
            }
        );
        commands.registerCommand(
            {
                id: 'vscode.executeImplementationProvider'
            },
            {
                execute: ((resource: URI, position: Position) =>
                    commands.executeCommand<Location[]>('_executeImplementationProvider', monaco.Uri.from(resource), position))
            }
        );
        commands.registerCommand(
            {
                id: 'vscode.executeHoverProvider'
            },
            {
                execute: ((resource: URI, position: Position) =>
                    commands.executeCommand<Hover[]>('_executeHoverProvider', monaco.Uri.from(resource), position))
            }
        );
        commands.registerCommand(
            {
                id: 'vscode.executeDocumentHighlights'
            },
            {
                execute: ((resource: URI, position: Position) =>
                    commands.executeCommand<DocumentHighlight[]>('_executeDocumentHighlights', monaco.Uri.from(resource), position))
            }
        );
        commands.registerCommand(
            {
                id: 'vscode.executeReferenceProvider'
            },
            {
                execute: ((resource: URI, position: Position) => commands.executeCommand<Location[]>('_executeReferenceProvider', monaco.Uri.from(resource), position))
            }
        );
        commands.registerCommand(
            {
                id: 'vscode.executeDocumentSymbolProvider'
            },
            {
                execute: (resource: URI) => commands.executeCommand('_executeDocumentSymbolProvider',
                    monaco.Uri.parse(resource.toString())
                ).then((value: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                    if (!Array.isArray(value) || value === undefined) {
                        return undefined;
                    }
                    return value.map(loc => toDocumentSymbol(loc));
                })
            }
        );
        commands.registerCommand(
            {
                id: 'vscode.executeFormatDocumentProvider'
            },
            {
                execute: ((resource: URI, options: FormattingOptions) =>
                    commands.executeCommand<TextEdit[]>('_executeFormatDocumentProvider', monaco.Uri.from(resource), options))
            }
        );
        commands.registerCommand(
            {
                id: 'vscode.executeFormatRangeProvider'
            },
            {
                execute: ((resource: URI, range: Range, options: FormattingOptions) =>
                    commands.executeCommand<TextEdit[]>('_executeFormatRangeProvider', monaco.Uri.from(resource), range, options))
            }
        );
        commands.registerCommand(
            {
                id: 'vscode.executeFormatOnTypeProvider'
            },
            {
                execute: ((resource: URI, position: Position, ch: string, options: FormattingOptions) =>
                    commands.executeCommand<TextEdit[]>('_executeFormatOnTypeProvider', monaco.Uri.from(resource), position, ch, options))
            }
        );
        commands.registerCommand(
            {
                id: 'vscode.prepareCallHierarchy'
            },
            {
                execute: ((resource: URI, position: Position) =>
                    commands.executeCommand<CallHierarchyItem[]>('_executePrepareCallHierarchy', monaco.Uri.from(resource), position))
            }
        );
        commands.registerCommand(
            {
                id: 'vscode.provideIncomingCalls'
            },
            {
                execute: ((item: CallHierarchyItem) =>
                    commands.executeCommand<CallHierarchyIncomingCall[]>('_executeProvideIncomingCalls', { item }))
            }
        );
        commands.registerCommand(
            {
                id: 'vscode.provideOutgoingCalls'
            },
            {
                execute: ((item: CallHierarchyItem) =>
                    commands.executeCommand<CallHierarchyOutgoingCall[]>('_executeProvideOutgoingCalls', { item }))
            }
        );

        commands.registerCommand({
            id: 'workbench.action.openRecent'
        }, {
            execute: () => this.quickOpenWorkspace.select()
        });
        commands.registerCommand({
            id: 'explorer.newFolder'
        }, {
            execute: () => commands.executeCommand(WorkspaceCommands.NEW_FOLDER.id)
        });
        commands.registerCommand({
            id: 'workbench.action.terminal.sendSequence'
        }, {
            execute: (args?: { text?: string }) => {
                if (args === undefined || args.text === undefined) {
                    return;
                }

                const currentTerminal = this.terminalService.currentTerminal;

                if (currentTerminal === undefined) {
                    return;
                }

                currentTerminal.sendText(args.text);
            }
        });
        commands.registerCommand({
            id: 'workbench.action.terminal.kill'
        }, {
            execute: () => {
                const currentTerminal = this.terminalService.currentTerminal;

                if (currentTerminal === undefined) {
                    return;
                }

                currentTerminal.dispose();
            }
        });
        commands.registerCommand({
            id: 'workbench.view.explorer'
        }, {
            execute: () => commands.executeCommand(FileNavigatorCommands.FOCUS.id)
        });
        commands.registerCommand({
            id: 'copyFilePath'
        }, {
            execute: () => commands.executeCommand(CommonCommands.COPY_PATH.id)
        });
        commands.registerCommand({
            id: 'copyRelativeFilePath'
        }, {
            execute: () => commands.executeCommand(FileNavigatorCommands.COPY_RELATIVE_FILE_PATH.id)
        });
        commands.registerCommand({
            id: 'revealInExplorer'
        }, {
            execute: async (resource: URI | object) => {
                if (!URI.isUri(resource)) {
                    return;
                }
                let navigator = await this.shell.revealWidget(FILE_NAVIGATOR_ID);
                if (!navigator) {
                    await this.commandService.executeCommand(FILE_NAVIGATOR_TOGGLE_COMMAND_ID);
                    navigator = await this.shell.revealWidget(FILE_NAVIGATOR_ID);
                }
                if (navigator instanceof FileNavigatorWidget) {
                    const model = navigator.model;
                    const node = await model.revealFile(new TheiaURI(resource));
                    if (SelectableTreeNode.is(node)) {
                        model.selectNode(node);
                    }
                }
            }
        });
    }
}
