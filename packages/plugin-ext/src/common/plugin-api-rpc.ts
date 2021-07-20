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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createProxyIdentifier, ProxyIdentifier, RPCProtocol } from './rpc-protocol';
import * as theia from '@theia/plugin';
import { PluginLifecycle, PluginModel, PluginMetadata, PluginPackage, IconUrl, PluginJsonValidationContribution } from './plugin-protocol';
import { QueryParameters } from './env';
import { TextEditorCursorStyle } from './editor-options';
import {
    TextEditorLineNumbersStyle,
    EndOfLine,
    OverviewRulerLane,
    IndentAction,
    FileOperationOptions
} from '../plugin/types-impl';
import { UriComponents } from './uri-components';
import { ConfigurationTarget } from '../plugin/types-impl';
import {
    SerializedDocumentFilter,
    CompletionContext,
    MarkdownString,
    Range,
    Completion,
    CompletionResultDto,
    MarkerData,
    SignatureHelp,
    Hover,
    DocumentHighlight,
    FormattingOptions,
    ChainedCacheId,
    Definition,
    DocumentLink,
    CodeLensSymbol,
    Command,
    TextEdit,
    DocumentSymbol,
    ReferenceContext,
    TextDocumentShowOptions,
    WorkspaceRootsChangeEvent,
    Location,
    Breakpoint,
    ColorPresentation,
    RenameLocation,
    SignatureHelpContext,
    CodeAction,
    CodeActionContext,
    FoldingContext,
    FoldingRange,
    SelectionRange,
    CallHierarchyDefinition,
    CallHierarchyReference,
    SearchInWorkspaceResult,
    AuthenticationSession,
    AuthenticationSessionsChangeEvent,
    AuthenticationProviderInformation,
    Comment,
    CommentOptions,
    CommentThreadCollapsibleState,
    CommentThread,
    CommentThreadChangedEvent,
} from './plugin-api-rpc-model';
import { ExtPluginApi } from './plugin-ext-api-contribution';
import { KeysToAnyValues, KeysToKeysToAnyValue } from './types';
import { CancellationToken, Progress, ProgressOptions } from '@theia/plugin';
import { DebuggerDescription } from '@theia/debug/lib/common/debug-service';
import { DebugProtocol } from 'vscode-debugprotocol';
import { SymbolInformation } from '@theia/core/shared/vscode-languageserver-types';
import { ArgumentProcessor } from '../plugin/command-registry';
import * as files from '@theia/filesystem/lib/common/files';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import { ResourceLabelFormatter } from '@theia/core/lib/common/label-protocol';
import type {
    InternalTimelineOptions,
    Timeline,
    TimelineChangeEvent,
    TimelineProviderDescriptor
} from '@theia/timeline/lib/common/timeline-model';
import { SerializableEnvironmentVariableCollection } from '@theia/terminal/lib/common/base-terminal-protocol';
import { ThemeType } from '@theia/core/lib/browser/theming';
import { Disposable } from '@theia/core/lib/common/disposable';
import { IPickOptions, QuickInputButtonHandle, QuickPickItem } from '@theia/core/lib/browser';

export interface PreferenceData {
    [scope: number]: any;
}

export interface Plugin {
    pluginPath: string | undefined;
    pluginFolder: string;
    pluginUri: string;
    model: PluginModel;
    rawModel: PluginPackage;
    lifecycle: PluginLifecycle;
}

export interface ConfigStorage {
    hostLogPath: string;
    hostStoragePath?: string;
    hostGlobalStoragePath: string;
}

export enum UIKind {

    /**
     * Extensions are accessed from a desktop application.
     */
    Desktop = 1,

    /**
     * Extensions are accessed from a web browser.
     */
    Web = 2
}

export interface EnvInit {
    queryParams: QueryParameters;
    language: string;
    shell: string;
    uiKind: UIKind,
    appName: string;
}

export interface PluginAPI {

}

export interface PluginManager {
    getAllPlugins(): Plugin[];
    getPluginById(pluginId: string): Plugin | undefined;
    getPluginExport(pluginId: string): PluginAPI | undefined;
    isRunning(pluginId: string): boolean;
    isActive(pluginId: string): boolean;
    activatePlugin(pluginId: string): PromiseLike<void>;
    onDidChange: theia.Event<void>;
}

export interface PluginAPIFactory {
    (plugin: Plugin): typeof theia;
}

export const emptyPlugin: Plugin = {
    lifecycle: {
        startMethod: 'empty',
        stopMethod: 'empty'
    },
    model: {
        id: 'emptyPlugin',
        name: 'emptyPlugin',
        publisher: 'Theia',
        version: 'empty',
        displayName: 'empty',
        description: 'empty',
        engine: {
            type: 'empty',
            version: 'empty'
        },
        packagePath: 'empty',
        packageUri: 'empty',
        entryPoint: {

        }
    },
    pluginPath: 'empty',
    pluginFolder: 'empty',
    pluginUri: 'empty',
    rawModel: {
        name: 'emptyPlugin',
        publisher: 'Theia',
        version: 'empty',
        displayName: 'empty',
        description: 'empty',
        engines: {
            type: 'empty',
            version: 'empty'
        },
        packagePath: 'empty'
    }
};

export interface PluginManagerInitializeParams {
    preferences: PreferenceData
    globalState: KeysToKeysToAnyValue
    workspaceState: KeysToKeysToAnyValue
    env: EnvInit
    extApi?: ExtPluginApi[]
    webview: WebviewInitData
    jsonValidation: PluginJsonValidationContribution[]
}

export interface PluginManagerStartParams {
    plugins: PluginMetadata[]
    configStorage: ConfigStorage
    activationEvents: string[]
}

export interface PluginManagerExt {

    /** initialize the manager, should be called only once */
    $init(params: PluginManagerInitializeParams): Promise<void>;

    /** load and activate plugins */
    $start(params: PluginManagerStartParams): Promise<void>;

    /** deactivate the plugin */
    $stop(pluginId: string): Promise<void>;

    /** deactivate all plugins */
    $stop(): Promise<void>;

    $updateStoragePath(path: string | undefined): Promise<void>;

    $activateByEvent(event: string): Promise<void>;

    $activatePlugin(id: string): Promise<void>;
}

export interface CommandRegistryMain {
    $registerCommand(command: theia.CommandDescription): void;
    $unregisterCommand(id: string): void;

    $registerHandler(id: string): void;
    $unregisterHandler(id: string): void;

    $executeCommand<T>(id: string, ...args: any[]): PromiseLike<T | undefined>;
    $getCommands(): PromiseLike<string[]>;
    $getKeyBinding(commandId: string): PromiseLike<theia.CommandKeyBinding[] | undefined>;
}

export interface CommandRegistryExt {
    $executeCommand<T>(id: string, ...ars: any[]): PromiseLike<T | undefined>;
    registerArgumentProcessor(processor: ArgumentProcessor): void;
}

export interface TerminalServiceExt {
    $terminalCreated(id: string, name: string): void;
    $terminalNameChanged(id: string, name: string): void;
    $terminalOpened(id: string, processId: number, terminalId: number, cols: number, rows: number): void;
    $terminalClosed(id: string): void;
    $terminalOnInput(id: string, data: string): void;
    $terminalSizeChanged(id: string, cols: number, rows: number): void;
    $currentTerminalChanged(id: string | undefined): void;
    $initEnvironmentVariableCollections(collections: [string, SerializableEnvironmentVariableCollection][]): void;
    getEnvironmentVariableCollection(extensionIdentifier: string): theia.EnvironmentVariableCollection;
}
export interface OutputChannelRegistryExt {
    createOutputChannel(name: string, pluginInfo: PluginInfo): theia.OutputChannel
}

export interface ConnectionMain {
    $createConnection(id: string): Promise<void>;
    $deleteConnection(id: string): Promise<void>;
    $sendMessage(id: string, message: string): void;
    $createConnection(id: string): Promise<void>;
    $deleteConnection(id: string): Promise<void>;
}

export interface ConnectionExt {
    $createConnection(id: string): Promise<void>;
    $deleteConnection(id: string): Promise<void>
    $sendMessage(id: string, message: string): void;
}

export interface TerminalServiceMain {
    /**
     * Create new Terminal with Terminal options.
     * @param options - object with parameters to create new terminal.
     */
    $createTerminal(id: string, options: theia.TerminalOptions, isPseudoTerminal?: boolean): Promise<string>;

    /**
     * Send text to the terminal by id.
     * @param id - terminal widget id.
     * @param text - text content.
     * @param addNewLine - in case true - add new line after the text, otherwise - don't apply new line.
     */
    $sendText(id: string, text: string, addNewLine?: boolean): void;

    /**
     * Write data to the terminal by id.
     * @param id - terminal widget id.
     * @param data - data.
     */
    $write(id: string, data: string): void;

    /**
     * Resize the terminal by id.
     * @param id - terminal widget id.
     * @param cols - columns.
     * @param rows - rows.
     */
    $resize(id: string, cols: number, rows: number): void;

    /**
     * Show terminal on the UI panel.
     * @param id - terminal widget id.
     * @param preserveFocus - set terminal focus in case true value, and don't set focus otherwise.
     */
    $show(id: string, preserveFocus?: boolean): void;

    /**
     * Hide UI panel where is located terminal widget.
     * @param id - terminal widget id.
     */
    $hide(id: string): void;

    /**
     * Destroy terminal.
     * @param id - terminal widget id.
     */
    $dispose(id: string): void;

    /**
     * Send text to the terminal by id.
     * @param id - terminal id.
     * @param text - text content.
     * @param addNewLine - in case true - add new line after the text, otherwise - don't apply new line.
     */
    $sendTextByTerminalId(id: number, text: string, addNewLine?: boolean): void;

    /**
     * Write data to the terminal by id.
     * @param id - terminal id.
     * @param data - data.
     */
    $writeByTerminalId(id: number, data: string): void;

    /**
     * Resize the terminal by id.
     * @param id - terminal id.
     * @param cols - columns.
     * @param rows - rows.
     */
    $resizeByTerminalId(id: number, cols: number, rows: number): void;

    /**
     * Show terminal on the UI panel.
     * @param id - terminal id.
     * @param preserveFocus - set terminal focus in case true value, and don't set focus otherwise.
     */
    $showByTerminalId(id: number, preserveFocus?: boolean): void;

    /**
     * Hide UI panel where is located terminal widget.
     * @param id - terminal id.
     */
    $hideByTerminalId(id: number): void;

    /**
     * Destroy terminal.
     * @param id - terminal id.
     * @param waitOnExit - Whether to wait for a key press before closing the terminal.
     */
    $disposeByTerminalId(id: number, waitOnExit?: boolean | string): void;

    $setEnvironmentVariableCollection(extensionIdentifier: string, persistent: boolean, collection: SerializableEnvironmentVariableCollection | undefined): void;
}

export interface AutoFocus {
    autoFocusFirstEntry?: boolean;
    // TODO
}

export enum MainMessageType {
    Error,
    Warning,
    Info
}

export interface MainMessageOptions {
    modal?: boolean
    onCloseActionHandle?: number
}

export interface MainMessageItem {
    title: string,
    isCloseAffordance?: boolean;
    handle?: number
}

export interface MessageRegistryMain {
    $showMessage(type: MainMessageType, message: string, options: MainMessageOptions, actions: MainMessageItem[]): PromiseLike<number | undefined>;
}

export interface StatusBarMessageRegistryMain {
    $setMessage(id: string,
        text: string | undefined,
        priority: number,
        alignment: theia.StatusBarAlignment,
        color: string | undefined,
        tooltip: string | undefined,
        command: string | undefined,
        args: any[] | undefined): PromiseLike<void>;
    $dispose(id: string): void;
}

export type Item = string | theia.QuickPickItem;

export interface QuickOpenExt {
    $onItemSelected(handle: number): void;
    $validateInput(input: string): Promise<string | null | undefined> | undefined;

    $acceptOnDidAccept(sessionId: number): Promise<void>;
    $acceptDidChangeValue(sessionId: number, changedValue: string): Promise<void>;
    $acceptOnDidHide(sessionId: number): Promise<void>;
    $acceptOnDidTriggerButton(sessionId: number, btn: QuickInputButtonHandle): Promise<void>;
    $onDidChangeActive(sessionId: number, handles: number[]): void;
    $onDidChangeSelection(sessionId: number, handles: number[]): void;

    /* eslint-disable max-len */
    showQuickPick(itemsOrItemsPromise: Array<QuickPickItem> | Promise<Array<QuickPickItem>>, options: theia.QuickPickOptions & { canPickMany: true; },
        token?: theia.CancellationToken): Promise<Array<QuickPickItem> | undefined>;
    showQuickPick(itemsOrItemsPromise: string[] | Promise<string[]>, options?: theia.QuickPickOptions, token?: theia.CancellationToken): Promise<string | undefined>;
    showQuickPick(itemsOrItemsPromise: Array<QuickPickItem> | Promise<Array<QuickPickItem>>, options?: theia.QuickPickOptions, token?: theia.CancellationToken): Promise<theia.QuickPickItem | undefined>;
    showQuickPick(itemsOrItemsPromise: Item[] | Promise<Item[]>, options?: theia.QuickPickOptions, token?: theia.CancellationToken): Promise<Item | Item[] | undefined>;

    showInput(options?: theia.InputBoxOptions, token?: theia.CancellationToken): PromiseLike<string | undefined>;
    // showWorkspaceFolderPick(options?: theia.WorkspaceFolderPickOptions, token?: theia.CancellationToken): Promise<theia.WorkspaceFolder | undefined>
    createQuickPick<T extends theia.QuickPickItem>(plugin: Plugin): theia.QuickPick<T>;
    createInputBox(plugin: Plugin): theia.InputBox;
}

/**
 * Options to configure the behaviour of a file open dialog.
 */
export interface OpenDialogOptionsMain {

    /**
     * Dialog title.
     * This parameter might be ignored, as not all operating systems display a title on open dialogs.
     */
    title?: string;

    /**
     * The resource the dialog shows when opened.
     */
    defaultUri?: string;

    /**
     * A human-readable string for the open button.
     */
    openLabel?: string;

    /**
     * Allow to select files, defaults to `true`.
     */
    canSelectFiles?: boolean;

    /**
     * Allow to select folders, defaults to `false`.
     */
    canSelectFolders?: boolean;

    /**
     * Allow to select many files or folders.
     */
    canSelectMany?: boolean;

    /**
     * A set of file filters that are used by the dialog. Each entry is a human readable label,
     * like "TypeScript", and an array of extensions, e.g.
     * ```ts
     * {
     *  'Images': ['png', 'jpg']
     *  'TypeScript': ['ts', 'tsx']
     * }
     * ```
     */
    filters?: { [name: string]: string[] };
}

/**
 * Options to configure the behaviour of a file save dialog.
 */
export interface SaveDialogOptionsMain {

    /**
     * Dialog title.
     * This parameter might be ignored, as not all operating systems display a title on save dialogs.
     */
    title?: string;

    /**
     * The resource the dialog shows when opened.
     */
    defaultUri?: string;

    /**
     * A human-readable string for the save button.
     */
    saveLabel?: string;

    /**
     * A set of file filters that are used by the dialog. Each entry is a human readable label,
     * like "TypeScript", and an array of extensions, e.g.
     * ```ts
     * {
     *  'Images': ['png', 'jpg']
     *  'TypeScript': ['ts', 'tsx']
     * }
     * ```
     */
    filters?: { [name: string]: string[] };
}

/**
 * Options to configure the behaviour of a file upload dialog.
 */
export interface UploadDialogOptionsMain {
    /**
     * The resource, where files should be uploaded.
     */
    defaultUri?: string;
}

export interface FileUploadResultMain {
    uploaded: string[]
}

/**
 * Options to configure the behaviour of the [workspace folder](#WorkspaceFolder) pick UI.
 */
export interface WorkspaceFolderPickOptionsMain {
    /**
     * An optional string to show as place holder in the input box to guide the user what to pick on.
     */
    placeHolder?: string;

    /**
     * Set to `true` to keep the picker open when focus moves to another part of the editor or to another window.
     */
    ignoreFocusOut?: boolean;
}

export interface TransferQuickPickItems extends theia.QuickPickItem {
    handle: number;
}

export interface TransferQuickInputButton extends theia.QuickInputButton {
    handle?: number;
}

export type TransferQuickInput<T extends theia.QuickPickItem> = TransferQuickPick<T> | TransferInputBox;

export interface BaseTransferQuickInput {
    [key: string]: any;
    id: number;
    type?: 'quickPick' | 'inputBox';
    enabled?: boolean;
    busy?: boolean;
    visible?: boolean;
}

export interface TransferQuickPick<T extends theia.QuickPickItem> extends BaseTransferQuickInput {
    type?: 'quickPick';
    value?: string;
    placeholder?: string;
    buttons?: TransferQuickInputButton[];
    items?: TransferQuickPickItems[];
    activeItems?: ReadonlyArray<T>;
    selectedItems?: ReadonlyArray<T>;
    canSelectMany?: boolean;
    ignoreFocusOut?: boolean;
    matchOnDescription?: boolean;
    matchOnDetail?: boolean;
    sortByLabel?: boolean;
}

export interface TransferInputBox extends BaseTransferQuickInput {
    type?: 'inputBox';
    value?: string;
    placeholder?: string;
    password?: boolean;
    buttons?: TransferQuickInputButton[];
    prompt?: string;
    validationMessage?: string;
}

export interface IInputBoxOptions {
    value?: string;
    valueSelection?: [number, number];
    prompt?: string;
    placeHolder?: string;
    password?: boolean;
    ignoreFocusOut?: boolean;
}

export interface QuickOpenMain {
    $show(instance: number, options: IPickOptions<TransferQuickPickItems>, token: CancellationToken): Promise<number | number[] | undefined>;
    $setItems(instance: number, items: TransferQuickPickItems[]): Promise<any>;
    $setError(instance: number, error: Error): Promise<void>;
    $input(options: theia.InputBoxOptions, validateInput: boolean, token: CancellationToken): Promise<string | undefined>;
    $createOrUpdate<T extends theia.QuickPickItem>(params: TransferQuickInput<T>): Promise<void>;
    $dispose(id: number): Promise<void>;

    $hide(): void;
    $showInputBox(options: TransferInputBox, validateInput: boolean): Promise<string | undefined>;
    $showCustomQuickPick<T extends theia.QuickPickItem>(options: TransferQuickPick<T>): void;
}

export interface WorkspaceMain {
    $pickWorkspaceFolder(options: WorkspaceFolderPickOptionsMain): Promise<theia.WorkspaceFolder | undefined>;
    $startFileSearch(includePattern: string, includeFolder: string | undefined, excludePatternOrDisregardExcludes: string | false,
        maxResults: number | undefined, token: theia.CancellationToken): PromiseLike<UriComponents[]>;
    $findTextInFiles(query: theia.TextSearchQuery, options: theia.FindTextInFilesOptions, searchRequestId: number,
        token?: theia.CancellationToken): Promise<theia.TextSearchComplete>
    $registerTextDocumentContentProvider(scheme: string): Promise<void>;
    $unregisterTextDocumentContentProvider(scheme: string): void;
    $onTextDocumentContentChange(uri: string, content: string): void;
    $updateWorkspaceFolders(start: number, deleteCount?: number, ...rootsToAdd: string[]): Promise<void>;
    $getWorkspace(): Promise<files.FileStat | undefined>;
}

export interface WorkspaceExt {
    $onWorkspaceFoldersChanged(event: WorkspaceRootsChangeEvent): void;
    $onWorkspaceLocationChanged(event: files.FileStat | undefined): void;
    $provideTextDocumentContent(uri: string): Promise<string | undefined>;
    $onTextSearchResult(searchRequestId: number, done: boolean, result?: SearchInWorkspaceResult): void;
}

export interface TimelineExt {
    $getTimeline(source: string, uri: UriComponents, options: theia.TimelineOptions, internalOptions?: InternalTimelineOptions): Promise<Timeline | undefined>;
}

export interface TimelineMain {
    $registerTimelineProvider(provider: TimelineProviderDescriptor): Promise<void>;
    $fireTimelineChanged(e: TimelineChangeEvent): Promise<void>;
    $unregisterTimelineProvider(source: string): Promise<void>;
}

export interface ThemingExt {
    $onColorThemeChange(type: ThemeType): void;
}
export interface ThemingMain extends Disposable {
}

export interface DialogsMain {
    $showOpenDialog(options: OpenDialogOptionsMain): Promise<string[] | undefined>;
    $showSaveDialog(options: SaveDialogOptionsMain): Promise<string | undefined>;
    $showUploadDialog(options: UploadDialogOptionsMain): Promise<string[] | undefined>;
}

export interface TreeViewRevealOptions {
    select: boolean
    focus: boolean
    expand: boolean | number
}

export interface TreeViewsMain {
    $registerTreeDataProvider(treeViewId: string): void;
    $unregisterTreeDataProvider(treeViewId: string): void;
    $refresh(treeViewId: string): Promise<void>;
    $reveal(treeViewId: string, elementParentChain: string[], options: TreeViewRevealOptions): Promise<any>;
    $setMessage(treeViewId: string, message: string): void;
    $setTitle(treeViewId: string, title: string): void;
}

export interface TreeViewsExt {
    $getChildren(treeViewId: string, treeItemId: string | undefined): Promise<TreeViewItem[] | undefined>;
    $setExpanded(treeViewId: string, treeItemId: string, expanded: boolean): Promise<any>;
    $setSelection(treeViewId: string, treeItemIds: string[]): Promise<void>;
    $setVisible(treeViewId: string, visible: boolean): Promise<void>;
}

export interface TreeViewItem {

    id: string;

    label: string;

    description?: string | boolean;

    /* font-awesome icon for compatibility */
    icon?: string;
    iconUrl?: IconUrl;

    themeIconId?: string;

    resourceUri?: UriComponents;

    tooltip?: string;

    collapsibleState?: TreeViewItemCollapsibleState;

    contextValue?: string;

    command?: Command;

}

export interface TreeViewSelection {
    treeViewId: string
    treeItemId: string
}
export namespace TreeViewSelection {
    export function is(arg: Object | any): arg is TreeViewSelection {
        return !!arg && typeof arg === 'object' && 'treeViewId' in arg && 'treeItemId' in arg;
    }
}

/**
 * Collapsible state of the tree item
 */
export enum TreeViewItemCollapsibleState {
    /**
     * Determines an item can be neither collapsed nor expanded. Implies it has no children.
     */
    None = 0,
    /**
     * Determines an item is collapsed
     */
    Collapsed = 1,
    /**
     * Determines an item is expanded
     */
    Expanded = 2
}

export interface WindowMain {
    $openUri(uri: UriComponents): Promise<boolean>;
    $asExternalUri(uri: UriComponents): Promise<UriComponents>;
}

export interface WindowStateExt {
    $onWindowStateChanged(focus: boolean): void;
}

export interface NotificationExt {
    withProgress<R>(
        options: ProgressOptions,
        task: (progress: Progress<{ message?: string; increment?: number }>, token: CancellationToken) => PromiseLike<R>
    ): PromiseLike<R>;
}

export interface ScmCommandArg {
    sourceControlHandle: number
    resourceGroupHandle?: number
    resourceStateHandle?: number
}
export namespace ScmCommandArg {
    export function is(arg: Object | undefined): arg is ScmCommandArg {
        return !!arg && typeof arg === 'object' && 'sourceControlHandle' in arg;
    }
}

export interface ScmExt {
    createSourceControl(plugin: Plugin, id: string, label: string, rootUri?: theia.Uri): theia.SourceControl;
    getLastInputBox(plugin: Plugin): theia.SourceControlInputBox | undefined;
    $onInputBoxValueChange(sourceControlHandle: number, message: string): Promise<void>;
    $executeResourceCommand(sourceControlHandle: number, groupHandle: number, resourceHandle: number): Promise<void>;
    $validateInput(sourceControlHandle: number, value: string, cursorPosition: number): Promise<[string, number] | undefined>;
    $setSelectedSourceControl(selectedSourceControlHandle: number | undefined): Promise<void>;
    $provideOriginalResource(sourceControlHandle: number, uri: string, token: theia.CancellationToken): Promise<UriComponents | undefined>;
}

export namespace TimelineCommandArg {
    export function is(arg: Object | undefined): arg is TimelineCommandArg {
        return !!arg && typeof arg === 'object' && 'timelineHandle' in arg;
    }
}
export interface TimelineCommandArg {
    timelineHandle: string;
    source: string;
    uri: string;
}

export interface DecorationRequest {
    readonly id: number;
    readonly uri: UriComponents;
}

export type DecorationData = [boolean, string, string, ThemeColor];
export interface DecorationReply { [id: number]: DecorationData; }

export namespace CommentsCommandArg {
    export function is(arg: Object | undefined): arg is CommentsCommandArg {
        return !!arg && typeof arg === 'object' && 'commentControlHandle' in arg && 'commentThreadHandle' in arg && 'text' in arg && !('commentUniqueId' in arg);
    }
}
export interface CommentsCommandArg {
    commentControlHandle: number;
    commentThreadHandle: number;
    text: string
}

export namespace CommentsContextCommandArg {
    export function is(arg: Object | undefined): arg is CommentsContextCommandArg {
        return !!arg && typeof arg === 'object' && 'commentControlHandle' in arg && 'commentThreadHandle' in arg && 'commentUniqueId' in arg && !('text' in arg);
    }
}
export interface CommentsContextCommandArg {
    commentControlHandle: number;
    commentThreadHandle: number;
    commentUniqueId: number
}

export namespace CommentsEditCommandArg {
    export function is(arg: Object | undefined): arg is CommentsEditCommandArg {
        return !!arg && typeof arg === 'object' && 'commentControlHandle' in arg && 'commentThreadHandle' in arg && 'commentUniqueId' in arg && 'text' in arg;
    }
}
export interface CommentsEditCommandArg {
    commentControlHandle: number;
    commentThreadHandle: number;
    commentUniqueId: number
    text: string
}

export interface DecorationsExt {
    registerFileDecorationProvider(provider: theia.FileDecorationProvider, pluginInfo: PluginInfo): theia.Disposable
    $provideDecorations(handle: number, requests: DecorationRequest[], token: CancellationToken): Promise<DecorationReply>;
}

export interface DecorationsMain {
    $registerDecorationProvider(handle: number): Promise<void>;
    $unregisterDecorationProvider(handle: number): void;
    $onDidChange(handle: number, resources: UriComponents[] | null): void;
}

export interface ScmMain {
    $registerSourceControl(sourceControlHandle: number, id: string, label: string, rootUri?: UriComponents): Promise<void>;
    $updateSourceControl(sourceControlHandle: number, features: SourceControlProviderFeatures): Promise<void>;
    $unregisterSourceControl(sourceControlHandle: number): Promise<void>;

    $registerGroups(sourceControlHandle: number, groups: ScmRawResourceGroup[], splices: ScmRawResourceSplices[]): void;
    $updateGroup(sourceControlHandle: number, groupHandle: number, features: SourceControlGroupFeatures): void;
    $updateGroupLabel(sourceControlHandle: number, groupHandle: number, label: string): void;
    $unregisterGroup(sourceControlHandle: number, groupHandle: number): void;

    $spliceResourceStates(sourceControlHandle: number, splices: ScmRawResourceSplices[]): void;

    $setInputBoxValue(sourceControlHandle: number, value: string): void;
    $setInputBoxPlaceholder(sourceControlHandle: number, placeholder: string): void;
}

export interface SourceControlProviderFeatures {
    hasQuickDiffProvider?: boolean;
    count?: number;
    commitTemplate?: string;
    acceptInputCommand?: Command;
    statusBarCommands?: Command[];
}

export interface SourceControlGroupFeatures {
    hideWhenEmpty: boolean | undefined;
}

export interface ScmRawResource {
    handle: number,
    sourceUri: UriComponents,
    icons: UriComponents[],
    tooltip: string,
    strikeThrough: boolean,
    faded: boolean,
    contextValue: string,
    command: Command | undefined
}

export interface ScmRawResourceGroup {
    handle: number,
    id: string,
    label: string,
    features: SourceControlGroupFeatures
}

export interface ScmRawResourceSplice {
    start: number,
    deleteCount: number,
    rawResources: ScmRawResource[]
}

export interface ScmRawResourceSplices {
    handle: number,
    splices: ScmRawResourceSplice[]
}

export interface SourceControlResourceState {
    readonly handle: number
    /**
     * The uri of the underlying resource inside the workspace.
     */
    readonly resourceUri: string;

    /**
     * The command which should be run when the resource
     * state is open in the Source Control viewlet.
     */
    readonly command?: Command;

    /**
     * The decorations for this source control
     * resource state.
     */
    readonly decorations?: SourceControlResourceDecorations;

    readonly letter?: string;

    readonly colorId?: string
}

/**
 * The decorations for a [source control resource state](#SourceControlResourceState).
 * Can be independently specified for light and dark themes.
 */
export interface SourceControlResourceDecorations {

    /**
     * Whether the source control resource state should be striked-through in the UI.
     */
    readonly strikeThrough?: boolean;

    /**
     * Whether the source control resource state should be faded in the UI.
     */
    readonly faded?: boolean;

    /**
     * The title for a specific source control resource state.
     */
    readonly tooltip?: string;

    /**
     * The icon path for a specific source control resource state.
     */
    readonly iconPath?: string;
}

export interface NotificationMain {
    $startProgress(options: NotificationMain.StartProgressOptions): Promise<string>;
    $stopProgress(id: string): void;
    $updateProgress(id: string, report: NotificationMain.ProgressReport): void;
}
export namespace NotificationMain {
    export interface StartProgressOptions {
        title: string;
        location?: string;
        cancellable?: boolean;
    }
    export interface ProgressReport {
        message?: string;
        increment?: number;
        total?: number;
    }
}

export enum EditorPosition {
    ONE = 0,
    TWO = 1,
    THREE = 2,
    FOUR = 3,
    FIVE = 4,
    SIX = 5,
    SEVEN = 6,
    EIGHT = 7,
    NINE = 8
}

export interface Position {
    readonly lineNumber: number;
    readonly column: number;
}

export interface Selection {
    /**
     * The line number on which the selection has started.
     */
    readonly selectionStartLineNumber: number;
    /**
     * The column on `selectionStartLineNumber` where the selection has started.
     */
    readonly selectionStartColumn: number;
    /**
     * The line number on which the selection has ended.
     */
    readonly positionLineNumber: number;
    /**
     * The column on `positionLineNumber` where the selection has ended.
     */
    readonly positionColumn: number;
}

export interface TextEditorConfiguration {
    tabSize: number;
    insertSpaces: boolean;
    cursorStyle: TextEditorCursorStyle;
    lineNumbers: TextEditorLineNumbersStyle;
}

export interface TextEditorConfigurationUpdate {
    tabSize?: number | 'auto';
    insertSpaces?: boolean | 'auto';
    cursorStyle?: TextEditorCursorStyle;
    lineNumbers?: TextEditorLineNumbersStyle;
}

export enum TextEditorRevealType {
    Default = 0,
    InCenter = 1,
    InCenterIfOutsideViewport = 2,
    AtTop = 3
}

export interface SelectionChangeEvent {
    selections: Selection[];
    source?: string;
}

export interface EditorChangedPropertiesData {
    options?: TextEditorConfiguration;
    selections?: SelectionChangeEvent;
    visibleRanges?: Range[];
}

export interface TextEditorPositionData {
    [id: string]: EditorPosition;
}

export interface TextEditorsExt {
    $acceptEditorPropertiesChanged(id: string, props: EditorChangedPropertiesData): void;
    $acceptEditorPositionData(data: TextEditorPositionData): void;
}

export interface SingleEditOperation {
    range?: Range;
    text?: string;
    forceMoveMarkers?: boolean;
}

export interface UndoStopOptions {
    undoStopBefore: boolean;
    undoStopAfter: boolean;
}

export interface ApplyEditsOptions extends UndoStopOptions {
    setEndOfLine: EndOfLine;
}

export interface ThemeColor {
    id: string;
}

/**
 * Describes the behavior of decorations when typing/editing near their edges.
 */
export enum TrackedRangeStickiness {
    AlwaysGrowsWhenTypingAtEdges = 0,
    NeverGrowsWhenTypingAtEdges = 1,
    GrowsOnlyWhenTypingBefore = 2,
    GrowsOnlyWhenTypingAfter = 3,
}
export interface ContentDecorationRenderOptions {
    contentText?: string;
    contentIconPath?: UriComponents;

    border?: string;
    borderColor?: string | ThemeColor;
    fontStyle?: string;
    fontWeight?: string;
    textDecoration?: string;
    color?: string | ThemeColor;
    backgroundColor?: string | ThemeColor;

    margin?: string;
    width?: string;
    height?: string;
}

export interface ThemeDecorationRenderOptions {
    backgroundColor?: string | ThemeColor;

    outline?: string;
    outlineColor?: string | ThemeColor;
    outlineStyle?: string;
    outlineWidth?: string;

    border?: string;
    borderColor?: string | ThemeColor;
    borderRadius?: string;
    borderSpacing?: string;
    borderStyle?: string;
    borderWidth?: string;

    fontStyle?: string;
    fontWeight?: string;
    textDecoration?: string;
    cursor?: string;
    color?: string | ThemeColor;
    opacity?: string;
    letterSpacing?: string;

    gutterIconPath?: UriComponents;
    gutterIconSize?: string;

    overviewRulerColor?: string | ThemeColor;

    before?: ContentDecorationRenderOptions;
    after?: ContentDecorationRenderOptions;
}

export interface DecorationRenderOptions extends ThemeDecorationRenderOptions {
    isWholeLine?: boolean;
    rangeBehavior?: TrackedRangeStickiness;
    overviewRulerLane?: OverviewRulerLane;

    light?: ThemeDecorationRenderOptions;
    dark?: ThemeDecorationRenderOptions;
}

export interface ThemeDecorationInstanceRenderOptions {
    before?: ContentDecorationRenderOptions;
    after?: ContentDecorationRenderOptions;
}

export interface DecorationInstanceRenderOptions extends ThemeDecorationInstanceRenderOptions {
    light?: ThemeDecorationInstanceRenderOptions;
    dark?: ThemeDecorationInstanceRenderOptions;
}

export interface DecorationOptions {
    range: Range;
    hoverMessage?: MarkdownString | MarkdownString[];
    renderOptions?: DecorationInstanceRenderOptions;
}

export interface TextEditorsMain {
    // $tryShowTextDocument(resource: UriComponents, options: TextDocumentShowOptions): Promise<string>;
    $registerTextEditorDecorationType(key: string, options: DecorationRenderOptions): void;
    $removeTextEditorDecorationType(key: string): void;
    // $tryShowEditor(id: string, position: EditorPosition): Promise<void>;
    // $tryHideEditor(id: string): Promise<void>;
    $trySetOptions(id: string, options: TextEditorConfigurationUpdate): Promise<void>;
    $trySetDecorations(id: string, key: string, ranges: DecorationOptions[]): Promise<void>;
    $trySetDecorationsFast(id: string, key: string, ranges: number[]): Promise<void>;
    $tryRevealRange(id: string, range: Range, revealType: TextEditorRevealType): Promise<void>;
    $trySetSelections(id: string, selections: Selection[]): Promise<void>;
    $tryApplyEdits(id: string, modelVersionId: number, edits: SingleEditOperation[], opts: ApplyEditsOptions): Promise<boolean>;
    $tryApplyWorkspaceEdit(workspaceEditDto: WorkspaceEditDto): Promise<boolean>;
    $tryInsertSnippet(id: string, template: string, selections: Range[], opts: UndoStopOptions): Promise<boolean>;
    $saveAll(includeUntitled?: boolean): Promise<boolean>;
    // $getDiffInformation(id: string): Promise<editorCommon.ILineChange[]>;
}

export interface ModelAddedData {
    uri: UriComponents;
    versionId: number;
    lines: string[];
    EOL: string;
    modeId: string;
    isDirty: boolean;
}

export interface TextEditorAddData {
    id: string;
    documentUri: UriComponents;
    options: TextEditorConfiguration;
    selections: Selection[];
    visibleRanges: Range[];
    editorPosition?: EditorPosition;
}

export interface EditorsAndDocumentsDelta {
    removedDocuments?: UriComponents[];
    addedDocuments?: ModelAddedData[];
    removedEditors?: string[];
    addedEditors?: TextEditorAddData[];
    /**
     * undefined means no changes
     * null means no active
     * string means id of active
     */
    newActiveEditor?: string | null;
}

export interface EditorsAndDocumentsExt {
    $acceptEditorsAndDocumentsDelta(delta: EditorsAndDocumentsDelta): void;
}

export interface ModelContentChange {
    readonly range: Range;
    readonly rangeOffset: number;
    readonly rangeLength: number;
    readonly text: string;
}
export interface ModelChangedEvent {
    readonly changes: ModelContentChange[];

    readonly eol: string;

    readonly versionId: number;
}

export interface DocumentsExt {
    $acceptModelModeChanged(startUrl: UriComponents, oldModeId: string, newModeId: string): void;
    $acceptModelSaved(strUrl: UriComponents): void;
    $acceptModelWillSave(strUrl: UriComponents, reason: theia.TextDocumentSaveReason, saveTimeout: number): Promise<SingleEditOperation[]>;
    $acceptDirtyStateChanged(strUrl: UriComponents, isDirty: boolean): void;
    $acceptModelChanged(strUrl: UriComponents, e: ModelChangedEvent, isDirty: boolean): void;
}

export interface DocumentsMain {
    $tryCreateDocument(options?: { language?: string; content?: string; }): Promise<UriComponents>;
    $tryShowDocument(uri: UriComponents, options?: TextDocumentShowOptions): Promise<void>;
    $tryOpenDocument(uri: UriComponents): Promise<boolean>;
    $trySaveDocument(uri: UriComponents): Promise<boolean>;
    $tryCloseDocument(uri: UriComponents): Promise<boolean>;
}

export interface EnvMain {
    $getEnvVariable(envVarName: string): Promise<string | undefined>;
    $getClientOperatingSystem(): Promise<theia.OperatingSystem>;
}

export interface PreferenceRegistryMain {
    $updateConfigurationOption(
        target: boolean | ConfigurationTarget | undefined,
        key: string,
        value: any,
        resource?: string
    ): PromiseLike<void>;
    $removeConfigurationOption(
        target: boolean | ConfigurationTarget | undefined,
        key: string,
        resource?: string
    ): PromiseLike<void>;
}

export interface PreferenceChangeExt {
    preferenceName: string,
    newValue: any
}

export interface TerminalOptionsExt {
    attributes?: {
        [key: string]: string;
    }
}

export interface PreferenceRegistryExt {
    $acceptConfigurationChanged(data: { [key: string]: any }, eventData: PreferenceChangeExt[]): void;
}

export interface OutputChannelRegistryMain {
    $append(channelName: string, value: string, pluginInfo: PluginInfo): PromiseLike<void>;
    $clear(channelName: string): PromiseLike<void>;
    $dispose(channelName: string): PromiseLike<void>;
    $reveal(channelName: string, preserveFocus: boolean): PromiseLike<void>;
    $close(channelName: string): PromiseLike<void>;
}

export type CharacterPair = [string, string];

export interface CommentRule {
    lineComment?: string;
    blockComment?: CharacterPair;
}

export interface SerializedRegExp {
    pattern: string;
    flags?: string;
}

export interface SerializedIndentationRule {
    decreaseIndentPattern?: SerializedRegExp;
    increaseIndentPattern?: SerializedRegExp;
    indentNextLinePattern?: SerializedRegExp;
    unIndentedLinePattern?: SerializedRegExp;
}

export interface EnterAction {
    indentAction: IndentAction;
    outdentCurrentLine?: boolean;
    appendText?: string;
    removeText?: number;
}

export interface SerializedOnEnterRule {
    beforeText: SerializedRegExp;
    afterText?: SerializedRegExp;
    action: EnterAction;
}

export interface SerializedLanguageConfiguration {
    comments?: CommentRule;
    brackets?: CharacterPair[];
    wordPattern?: SerializedRegExp;
    indentationRules?: SerializedIndentationRule;
    onEnterRules?: SerializedOnEnterRule[];
}

export interface CodeActionDto {
    title: string;
    edit?: WorkspaceEditDto;
    diagnostics?: MarkerData[];
    command?: Command;
    kind?: string;
    isPreferred?: boolean;
    disabled?: string;
}

export interface WorkspaceEditMetadataDto {
    needsConfirmation: boolean;
    label: string;
    description?: string;
    iconPath?: {
        id: string;
    } | {
        light: UriComponents;
        dark: UriComponents;
    };
}

export interface WorkspaceFileEditDto {
    oldUri?: UriComponents;
    newUri?: UriComponents;
    options?: FileOperationOptions;
    metadata?: WorkspaceEditMetadataDto;
}

export interface WorkspaceTextEditDto {
    resource: UriComponents;
    modelVersionId?: number;
    edit: TextEdit;
    metadata?: WorkspaceEditMetadataDto;

}
export namespace WorkspaceTextEditDto {
    export function is(arg: WorkspaceTextEditDto | WorkspaceFileEditDto): arg is WorkspaceTextEditDto {
        return !!arg
            && 'resource' in arg
            && 'edit' in arg
            && arg.edit !== null
            && typeof arg.edit === 'object';
    }
}

export interface WorkspaceEditDto {
    edits: Array<WorkspaceTextEditDto | WorkspaceFileEditDto>;
}

export interface CommandProperties {
    command: string;
    args?: string[];
    options?: {
        cwd?: string;
        [key: string]: any
    };
}

export interface TaskDto {
    type: string;
    taskType?: 'shell' | 'process' | 'customExecution'; // the task execution type
    executionId?: string,
    label: string;
    source?: string;
    scope: string | number;
    // Provide a more specific type when necessary (see ProblemMatcherContribution)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    problemMatcher?: any;
    group?: string;
    detail?: string;
    presentation?: TaskPresentationOptionsDTO;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

export interface TaskPresentationOptionsDTO {
    reveal?: number;
    focus?: boolean;
    echo?: boolean;
    panel?: number;
    showReuseMessage?: boolean;
}

export interface TaskExecutionDto {
    id: number;
    task: TaskDto;
}

export interface ProcessTaskDto extends TaskDto, CommandProperties {
    windows?: CommandProperties;
}

export interface PluginInfo {
    id: string;
    name: string;
}

export interface LanguagesExt {
    $provideCompletionItems(handle: number, resource: UriComponents, position: Position,
        context: CompletionContext, token: CancellationToken): Promise<CompletionResultDto | undefined>;
    $resolveCompletionItem(handle: number, chainedId: ChainedCacheId, token: CancellationToken): Promise<Completion | undefined>;
    $releaseCompletionItems(handle: number, id: number): void;
    $provideImplementation(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<Definition | undefined>;
    $provideTypeDefinition(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<Definition | undefined>;
    $provideDefinition(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<Definition | undefined>;
    $provideDeclaration(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<Definition | undefined>;
    $provideReferences(handle: number, resource: UriComponents, position: Position, context: ReferenceContext, token: CancellationToken): Promise<Location[] | undefined>;
    $provideSignatureHelp(
        handle: number, resource: UriComponents, position: Position, context: SignatureHelpContext, token: CancellationToken
    ): Promise<SignatureHelp | undefined>;
    $releaseSignatureHelp(handle: number, id: number): void;
    $provideHover(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<Hover | undefined>;
    $provideDocumentHighlights(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<DocumentHighlight[] | undefined>;
    $provideDocumentFormattingEdits(handle: number, resource: UriComponents,
        options: FormattingOptions, token: CancellationToken): Promise<TextEdit[] | undefined>;
    $provideDocumentRangeFormattingEdits(handle: number, resource: UriComponents, range: Range,
        options: FormattingOptions, token: CancellationToken): Promise<TextEdit[] | undefined>;
    $provideOnTypeFormattingEdits(
        handle: number,
        resource: UriComponents,
        position: Position,
        ch: string,
        options: FormattingOptions,
        token: CancellationToken
    ): Promise<TextEdit[] | undefined>;
    $provideDocumentLinks(handle: number, resource: UriComponents, token: CancellationToken): Promise<DocumentLink[] | undefined>;
    $resolveDocumentLink(handle: number, link: DocumentLink, token: CancellationToken): Promise<DocumentLink | undefined>;
    $releaseDocumentLinks(handle: number, ids: number[]): void;
    $provideCodeLenses(handle: number, resource: UriComponents, token: CancellationToken): Promise<CodeLensSymbol[] | undefined>;
    $resolveCodeLens(handle: number, resource: UriComponents, symbol: CodeLensSymbol, token: CancellationToken): Promise<CodeLensSymbol | undefined>;
    $releaseCodeLenses(handle: number, ids: number[]): void;
    $provideCodeActions(
        handle: number,
        resource: UriComponents,
        rangeOrSelection: Range | Selection,
        context: CodeActionContext,
        token: CancellationToken
    ): Promise<CodeAction[] | undefined>;
    $provideDocumentSymbols(handle: number, resource: UriComponents, token: CancellationToken): Promise<DocumentSymbol[] | undefined>;
    $provideWorkspaceSymbols(handle: number, query: string, token: CancellationToken): PromiseLike<SymbolInformation[]>;
    $resolveWorkspaceSymbol(handle: number, symbol: SymbolInformation, token: CancellationToken): PromiseLike<SymbolInformation | undefined>;
    $provideFoldingRange(
        handle: number,
        resource: UriComponents,
        context: FoldingContext,
        token: CancellationToken
    ): PromiseLike<FoldingRange[] | undefined>;
    $provideSelectionRanges(handle: number, resource: UriComponents, positions: Position[], token: CancellationToken): PromiseLike<SelectionRange[][]>;
    $provideDocumentColors(handle: number, resource: UriComponents, token: CancellationToken): PromiseLike<RawColorInfo[]>;
    $provideColorPresentations(handle: number, resource: UriComponents, colorInfo: RawColorInfo, token: CancellationToken): PromiseLike<ColorPresentation[]>;
    $provideRenameEdits(handle: number, resource: UriComponents, position: Position, newName: string, token: CancellationToken): PromiseLike<WorkspaceEditDto | undefined>;
    $resolveRenameLocation(handle: number, resource: UriComponents, position: Position, token: CancellationToken): PromiseLike<RenameLocation | undefined>;
    $provideDocumentSemanticTokens(handle: number, resource: UriComponents, previousResultId: number, token: CancellationToken): Promise<BinaryBuffer | null>;
    $releaseDocumentSemanticTokens(handle: number, semanticColoringResultId: number): void;
    $provideDocumentRangeSemanticTokens(handle: number, resource: UriComponents, range: Range, token: CancellationToken): Promise<BinaryBuffer | null>;
    $provideRootDefinition(handle: number, resource: UriComponents, location: Position, token: CancellationToken): Promise<CallHierarchyDefinition | undefined>;
    $provideCallers(handle: number, definition: CallHierarchyDefinition, token: CancellationToken): Promise<CallHierarchyReference[] | undefined>;
    $provideCallees(handle: number, definition: CallHierarchyDefinition, token: CancellationToken): Promise<CallHierarchyReference[] | undefined>;
}

export const LanguagesMainFactory = Symbol('LanguagesMainFactory');
export interface LanguagesMainFactory {
    (proxy: RPCProtocol): LanguagesMain;
}

export const OutputChannelRegistryFactory = Symbol('OutputChannelRegistryFactory');
export interface OutputChannelRegistryFactory {
    (): OutputChannelRegistryMain;
}

export interface LanguagesMain {
    $getLanguages(): Promise<string[]>;
    $changeLanguage(resource: UriComponents, languageId: string): Promise<void>;
    $setLanguageConfiguration(handle: number, languageId: string, configuration: SerializedLanguageConfiguration): void;
    $unregister(handle: number): void;
    $registerCompletionSupport(handle: number, pluginInfo: PluginInfo,
        selector: SerializedDocumentFilter[], triggerCharacters: string[], supportsResolveDetails: boolean): void;
    $registerImplementationProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerTypeDefinitionProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerDefinitionProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerDeclarationProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerReferenceProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerSignatureHelpProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[], metadata: theia.SignatureHelpProviderMetadata): void;
    $registerHoverProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerDocumentHighlightProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerQuickFixProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[], codeActionKinds?: string[]): void;
    $clearDiagnostics(id: string): void;
    $changeDiagnostics(id: string, delta: [string, MarkerData[]][]): void;
    $registerDocumentFormattingSupport(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerRangeFormattingSupport(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerOnTypeFormattingProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[], autoFormatTriggerCharacters: string[]): void;
    $registerDocumentLinkProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerCodeLensSupport(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[], eventHandle?: number): void;
    $emitCodeLensEvent(eventHandle: number, event?: any): void;
    $registerOutlineSupport(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerWorkspaceSymbolProvider(handle: number, pluginInfo: PluginInfo): void;
    $registerFoldingRangeProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerSelectionRangeProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerDocumentColorProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerRenameProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[], supportsResolveInitialValues: boolean): void;
    $registerDocumentSemanticTokensProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[],
        legend: theia.SemanticTokensLegend, eventHandle: number | undefined): void;
    $emitDocumentSemanticTokensEvent(eventHandle: number): void;
    $registerDocumentRangeSemanticTokensProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[], legend: theia.SemanticTokensLegend): void;
    $registerCallHierarchyProvider(handle: number, selector: SerializedDocumentFilter[]): void;
}

export interface WebviewInitData {
    webviewResourceRoot: string
    webviewCspSource: string
}

export interface WebviewPanelViewState {
    readonly active: boolean;
    readonly visible: boolean;
    readonly position: number;
}

export interface WebviewsExt {
    $onMessage(handle: string, message: any): void;
    $onDidChangeWebviewPanelViewState(handle: string, newState: WebviewPanelViewState): void;
    $onDidDisposeWebviewPanel(handle: string): PromiseLike<void>;
    $deserializeWebviewPanel(newWebviewHandle: string,
        viewType: string,
        title: string,
        state: any,
        viewState: WebviewPanelViewState,
        options: theia.WebviewOptions & theia.WebviewPanelOptions): PromiseLike<void>;
}

export interface WebviewsMain {
    $createWebviewPanel(handle: string,
        viewType: string,
        title: string,
        showOptions: theia.WebviewPanelShowOptions,
        options: theia.WebviewPanelOptions & theia.WebviewOptions): void;
    $disposeWebview(handle: string): void;
    $reveal(handle: string, showOptions: theia.WebviewPanelShowOptions): void;
    $setTitle(handle: string, value: string): void;
    $setIconPath(handle: string, value: IconUrl | undefined): void;
    $setHtml(handle: string, value: string): void;
    $setOptions(handle: string, options: theia.WebviewOptions): void;
    $postMessage(handle: string, value: any): Thenable<boolean>;

    $registerSerializer(viewType: string): void;
    $unregisterSerializer(viewType: string): void;
}

export interface CustomEditorsExt {
    $resolveWebviewEditor(
        resource: UriComponents,
        newWebviewHandle: string,
        viewType: string,
        title: string,
        position: number,
        options: theia.WebviewPanelOptions,
        cancellation: CancellationToken): Promise<void>;
    $createCustomDocument(resource: UriComponents, viewType: string, backupId: string | undefined, cancellation: CancellationToken): Promise<{ editable: boolean }>;
    $disposeCustomDocument(resource: UriComponents, viewType: string): Promise<void>;
    $undo(resource: UriComponents, viewType: string, editId: number, isDirty: boolean): Promise<void>;
    $redo(resource: UriComponents, viewType: string, editId: number, isDirty: boolean): Promise<void>;
    $revert(resource: UriComponents, viewType: string, cancellation: CancellationToken): Promise<void>;
    $disposeEdits(resourceComponents: UriComponents, viewType: string, editIds: number[]): void;
    $onSave(resource: UriComponents, viewType: string, cancellation: CancellationToken): Promise<void>;
    $onSaveAs(resource: UriComponents, viewType: string, targetResource: UriComponents, cancellation: CancellationToken): Promise<void>;
    // $backup(resource: UriComponents, viewType: string, cancellation: CancellationToken): Promise<string>;
    $onMoveCustomEditor(handle: string, newResource: UriComponents, viewType: string): Promise<void>;
}

export interface CustomTextEditorCapabilities {
    readonly supportsMove?: boolean;
}

export interface CustomEditorsMain {
    $registerTextEditorProvider(viewType: string, options: theia.WebviewPanelOptions, capabilities: CustomTextEditorCapabilities): void;
    $registerCustomEditorProvider(viewType: string, options: theia.WebviewPanelOptions, supportsMultipleEditorsPerDocument: boolean): void;
    $unregisterEditorProvider(viewType: string): void;
    $createCustomEditorPanel(handle: string, title: string, viewColumn: theia.ViewColumn | undefined, options: theia.WebviewPanelOptions & theia.WebviewOptions): Promise<void>;
    $onDidEdit(resource: UriComponents, viewType: string, editId: number, label: string | undefined): void;
    $onContentChange(resource: UriComponents, viewType: string): void;
}

export interface StorageMain {
    $set(key: string, value: KeysToAnyValues, isGlobal: boolean): Promise<boolean>;
    $get(key: string, isGlobal: boolean): Promise<KeysToAnyValues>;
    $getAll(isGlobal: boolean): Promise<KeysToKeysToAnyValue>;
}

export interface StorageExt {
    $updatePluginsWorkspaceData(data: KeysToKeysToAnyValue): void;
}

export interface DebugExt {
    $onSessionCustomEvent(sessionId: string, event: string, body?: any): void;
    $breakpointsDidChange(added: Breakpoint[], removed: string[], changed: Breakpoint[]): void;
    $sessionDidCreate(sessionId: string): void;
    $sessionDidDestroy(sessionId: string): void;
    $sessionDidChange(sessionId: string | undefined): void;
    $provideDebugConfigurations(debugType: string, workspaceFolder: string | undefined): Promise<theia.DebugConfiguration[]>;
    $resolveDebugConfigurations(debugConfiguration: theia.DebugConfiguration, workspaceFolder: string | undefined): Promise<theia.DebugConfiguration | undefined>;
    $resolveDebugConfigurationWithSubstitutedVariables(debugConfiguration: theia.DebugConfiguration, workspaceFolder: string | undefined):
        Promise<theia.DebugConfiguration | undefined>;
    $createDebugSession(debugConfiguration: theia.DebugConfiguration): Promise<string>;
    $terminateDebugSession(sessionId: string): Promise<void>;
    $getTerminalCreationOptions(debugType: string): Promise<TerminalOptionsExt | undefined>;
}

export interface DebugMain {
    $appendToDebugConsole(value: string): Promise<void>;
    $appendLineToDebugConsole(value: string): Promise<void>;
    $registerDebuggerContribution(description: DebuggerDescription): Promise<void>;
    $unregisterDebuggerConfiguration(debugType: string): Promise<void>;
    $addBreakpoints(breakpoints: Breakpoint[]): Promise<void>;
    $removeBreakpoints(breakpoints: string[]): Promise<void>;
    $startDebugging(folder: theia.WorkspaceFolder | undefined, nameOrConfiguration: string | theia.DebugConfiguration, options: theia.DebugSessionOptions): Promise<boolean>;
    $customRequest(sessionId: string, command: string, args?: any): Promise<DebugProtocol.Response>;
}

export interface FileSystemExt {
    $stat(handle: number, resource: UriComponents): Promise<files.Stat>;
    $readdir(handle: number, resource: UriComponents): Promise<[string, files.FileType][]>;
    $readFile(handle: number, resource: UriComponents): Promise<BinaryBuffer>;
    $writeFile(handle: number, resource: UriComponents, content: BinaryBuffer, opts: files.FileWriteOptions): Promise<void>;
    $rename(handle: number, resource: UriComponents, target: UriComponents, opts: files.FileOverwriteOptions): Promise<void>;
    $copy(handle: number, resource: UriComponents, target: UriComponents, opts: files.FileOverwriteOptions): Promise<void>;
    $mkdir(handle: number, resource: UriComponents): Promise<void>;
    $delete(handle: number, resource: UriComponents, opts: files.FileDeleteOptions): Promise<void>;
    $watch(handle: number, session: number, resource: UriComponents, opts: files.WatchOptions): void;
    $unwatch(handle: number, session: number): void;
    $open(handle: number, resource: UriComponents, opts: files.FileOpenOptions): Promise<number>;
    $close(handle: number, fd: number): Promise<void>;
    $read(handle: number, fd: number, pos: number, length: number): Promise<BinaryBuffer>;
    $write(handle: number, fd: number, pos: number, data: BinaryBuffer): Promise<number>;
}

export interface IFileChangeDto {
    resource: UriComponents;
    type: files.FileChangeType;
}

export interface FileSystemMain {
    $registerFileSystemProvider(handle: number, scheme: string, capabilities: files.FileSystemProviderCapabilities): void;
    $unregisterProvider(handle: number): void;
    $onFileSystemChange(handle: number, resource: IFileChangeDto[]): void;

    $stat(uri: UriComponents): Promise<files.Stat>;
    $readdir(resource: UriComponents): Promise<[string, files.FileType][]>;
    $readFile(resource: UriComponents): Promise<BinaryBuffer>;
    $writeFile(resource: UriComponents, content: BinaryBuffer): Promise<void>;
    $rename(resource: UriComponents, target: UriComponents, opts: files.FileOverwriteOptions): Promise<void>;
    $copy(resource: UriComponents, target: UriComponents, opts: files.FileOverwriteOptions): Promise<void>;
    $mkdir(resource: UriComponents): Promise<void>;
    $delete(resource: UriComponents, opts: files.FileDeleteOptions): Promise<void>;
}

export interface FileSystemEvents {
    created: UriComponents[];
    changed: UriComponents[];
    deleted: UriComponents[];
}

export interface ExtHostFileSystemEventServiceShape {
    $onFileEvent(events: FileSystemEvents): void;
    $onWillRunFileOperation(operation: files.FileOperation, target: UriComponents, source: UriComponents | undefined, timeout: number, token: CancellationToken): Promise<any>;
    $onDidRunFileOperation(operation: files.FileOperation, target: UriComponents, source: UriComponents | undefined): void;
}

export interface ClipboardMain {
    $readText(): Promise<string>;
    $writeText(value: string): Promise<void>;
}

export interface CommentsExt {
    $createCommentThreadTemplate(commentControllerHandle: number, uriComponents: UriComponents, range: Range): void;
    $updateCommentThreadTemplate(commentControllerHandle: number, threadHandle: number, range: Range): Promise<void>;
    $deleteCommentThread(commentControllerHandle: number, commentThreadHandle: number): Promise<void>;
    $provideCommentingRanges(commentControllerHandle: number, uriComponents: UriComponents, token: CancellationToken): Promise<Range[] | undefined>;
}

export interface CommentProviderFeatures {
    options?: CommentOptions;
}

export type CommentThreadChanges = Partial<{
    range: Range,
    label: string,
    contextValue: string,
    comments: Comment[],
    collapseState: CommentThreadCollapsibleState;
}>;

export interface CommentsMain {
    $registerCommentController(handle: number, id: string, label: string): void;
    $unregisterCommentController(handle: number): void;
    $updateCommentControllerFeatures(handle: number, features: CommentProviderFeatures): void;
    $createCommentThread(handle: number, commentThreadHandle: number, threadId: string, resource: UriComponents, range: Range, extensionId: string): CommentThread | undefined;
    $updateCommentThread(handle: number, commentThreadHandle: number, threadId: string, resource: UriComponents, changes: CommentThreadChanges): void;
    $deleteCommentThread(handle: number, commentThreadHandle: number): void;
    $onDidCommentThreadsChange(handle: number, event: CommentThreadChangedEvent): void;
}

export const PLUGIN_RPC_CONTEXT = {
    AUTHENTICATION_MAIN: <ProxyIdentifier<AuthenticationMain>>createProxyIdentifier<AuthenticationMain>('AuthenticationMain'),
    COMMAND_REGISTRY_MAIN: <ProxyIdentifier<CommandRegistryMain>>createProxyIdentifier<CommandRegistryMain>('CommandRegistryMain'),
    QUICK_OPEN_MAIN: createProxyIdentifier<QuickOpenMain>('QuickOpenMain'),
    DIALOGS_MAIN: createProxyIdentifier<DialogsMain>('DialogsMain'),
    WORKSPACE_MAIN: createProxyIdentifier<WorkspaceMain>('WorkspaceMain'),
    MESSAGE_REGISTRY_MAIN: <ProxyIdentifier<MessageRegistryMain>>createProxyIdentifier<MessageRegistryMain>('MessageRegistryMain'),
    TEXT_EDITORS_MAIN: createProxyIdentifier<TextEditorsMain>('TextEditorsMain'),
    DOCUMENTS_MAIN: createProxyIdentifier<DocumentsMain>('DocumentsMain'),
    STATUS_BAR_MESSAGE_REGISTRY_MAIN: <ProxyIdentifier<StatusBarMessageRegistryMain>>createProxyIdentifier<StatusBarMessageRegistryMain>('StatusBarMessageRegistryMain'),
    ENV_MAIN: createProxyIdentifier<EnvMain>('EnvMain'),
    NOTIFICATION_MAIN: createProxyIdentifier<NotificationMain>('NotificationMain'),
    TERMINAL_MAIN: createProxyIdentifier<TerminalServiceMain>('TerminalServiceMain'),
    TREE_VIEWS_MAIN: createProxyIdentifier<TreeViewsMain>('TreeViewsMain'),
    PREFERENCE_REGISTRY_MAIN: createProxyIdentifier<PreferenceRegistryMain>('PreferenceRegistryMain'),
    OUTPUT_CHANNEL_REGISTRY_MAIN: <ProxyIdentifier<OutputChannelRegistryMain>>createProxyIdentifier<OutputChannelRegistryMain>('OutputChannelRegistryMain'),
    LANGUAGES_MAIN: createProxyIdentifier<LanguagesMain>('LanguagesMain'),
    CONNECTION_MAIN: createProxyIdentifier<ConnectionMain>('ConnectionMain'),
    WEBVIEWS_MAIN: createProxyIdentifier<WebviewsMain>('WebviewsMain'),
    CUSTOM_EDITORS_MAIN: createProxyIdentifier<CustomEditorsMain>('CustomEditorsMain'),
    STORAGE_MAIN: createProxyIdentifier<StorageMain>('StorageMain'),
    TASKS_MAIN: createProxyIdentifier<TasksMain>('TasksMain'),
    DEBUG_MAIN: createProxyIdentifier<DebugMain>('DebugMain'),
    FILE_SYSTEM_MAIN: createProxyIdentifier<FileSystemMain>('FileSystemMain'),
    SCM_MAIN: createProxyIdentifier<ScmMain>('ScmMain'),
    SECRETS_MAIN: createProxyIdentifier<SecretsMain>('SecretsMain'),
    DECORATIONS_MAIN: createProxyIdentifier<DecorationsMain>('DecorationsMain'),
    WINDOW_MAIN: createProxyIdentifier<WindowMain>('WindowMain'),
    CLIPBOARD_MAIN: <ProxyIdentifier<ClipboardMain>>createProxyIdentifier<ClipboardMain>('ClipboardMain'),
    LABEL_SERVICE_MAIN: <ProxyIdentifier<LabelServiceMain>>createProxyIdentifier<LabelServiceMain>('LabelServiceMain'),
    TIMELINE_MAIN: <ProxyIdentifier<TimelineMain>>createProxyIdentifier<TimelineMain>('TimelineMain'),
    THEMING_MAIN: <ProxyIdentifier<ThemingMain>>createProxyIdentifier<ThemingMain>('ThemingMain'),
    COMMENTS_MAIN: <ProxyIdentifier<CommentsMain>>createProxyIdentifier<CommentsMain>('CommentsMain')
};

export const MAIN_RPC_CONTEXT = {
    AUTHENTICATION_EXT: createProxyIdentifier<AuthenticationExt>('AuthenticationExt'),
    HOSTED_PLUGIN_MANAGER_EXT: createProxyIdentifier<PluginManagerExt>('PluginManagerExt'),
    COMMAND_REGISTRY_EXT: createProxyIdentifier<CommandRegistryExt>('CommandRegistryExt'),
    QUICK_OPEN_EXT: createProxyIdentifier<QuickOpenExt>('QuickOpenExt'),
    WINDOW_STATE_EXT: createProxyIdentifier<WindowStateExt>('WindowStateExt'),
    NOTIFICATION_EXT: createProxyIdentifier<NotificationExt>('NotificationExt'),
    WORKSPACE_EXT: createProxyIdentifier<WorkspaceExt>('WorkspaceExt'),
    TEXT_EDITORS_EXT: createProxyIdentifier<TextEditorsExt>('TextEditorsExt'),
    EDITORS_AND_DOCUMENTS_EXT: createProxyIdentifier<EditorsAndDocumentsExt>('EditorsAndDocumentsExt'),
    DOCUMENTS_EXT: createProxyIdentifier<DocumentsExt>('DocumentsExt'),
    TERMINAL_EXT: createProxyIdentifier<TerminalServiceExt>('TerminalServiceExt'),
    OUTPUT_CHANNEL_REGISTRY_EXT: createProxyIdentifier<OutputChannelRegistryExt>('OutputChannelRegistryExt'),
    TREE_VIEWS_EXT: createProxyIdentifier<TreeViewsExt>('TreeViewsExt'),
    PREFERENCE_REGISTRY_EXT: createProxyIdentifier<PreferenceRegistryExt>('PreferenceRegistryExt'),
    LANGUAGES_EXT: createProxyIdentifier<LanguagesExt>('LanguagesExt'),
    CONNECTION_EXT: createProxyIdentifier<ConnectionExt>('ConnectionExt'),
    WEBVIEWS_EXT: createProxyIdentifier<WebviewsExt>('WebviewsExt'),
    CUSTOM_EDITORS_EXT: createProxyIdentifier<CustomEditorsExt>('CustomEditorsExt'),
    STORAGE_EXT: createProxyIdentifier<StorageExt>('StorageExt'),
    TASKS_EXT: createProxyIdentifier<TasksExt>('TasksExt'),
    DEBUG_EXT: createProxyIdentifier<DebugExt>('DebugExt'),
    FILE_SYSTEM_EXT: createProxyIdentifier<FileSystemExt>('FileSystemExt'),
    ExtHostFileSystemEventService: createProxyIdentifier<ExtHostFileSystemEventServiceShape>('ExtHostFileSystemEventService'),
    SCM_EXT: createProxyIdentifier<ScmExt>('ScmExt'),
    SECRETS_EXT: createProxyIdentifier<SecretsExt>('SecretsExt'),
    DECORATIONS_EXT: createProxyIdentifier<DecorationsExt>('DecorationsExt'),
    LABEL_SERVICE_EXT: createProxyIdentifier<LabelServiceExt>('LabelServiceExt'),
    TIMELINE_EXT: createProxyIdentifier<TimelineExt>('TimeLineExt'),
    THEMING_EXT: createProxyIdentifier<ThemingExt>('ThemingExt'),
    COMMENTS_EXT: createProxyIdentifier<CommentsExt>('CommentsExt')
};

export interface TasksExt {
    $provideTasks(handle: number, token?: CancellationToken): Promise<TaskDto[] | undefined>;
    $resolveTask(handle: number, task: TaskDto, token?: CancellationToken): Promise<TaskDto | undefined>;
    $onDidStartTask(execution: TaskExecutionDto, terminalId: number): void;
    $onDidEndTask(id: number): void;
    $onDidStartTaskProcess(processId: number | undefined, execution: TaskExecutionDto): void;
    $onDidEndTaskProcess(exitCode: number | undefined, taskId: number): void;
}

export interface TasksMain {
    $registerTaskProvider(handle: number, type: string): void;
    $fetchTasks(taskVersion: string | undefined, taskType: string | undefined): Promise<TaskDto[]>;
    $executeTask(taskDto: TaskDto): Promise<TaskExecutionDto | undefined>;
    $taskExecutions(): Promise<TaskExecutionDto[]>;
    $unregister(handle: number): void;
    $terminateTask(id: number): void;
    $customExecutionComplete(id: number, exitCode: number | undefined): void;
}

export interface AuthenticationExt {
    $getSessions(id: string): Promise<ReadonlyArray<AuthenticationSession>>;
    $login(id: string, scopes: string[]): Promise<AuthenticationSession>;
    $logout(id: string, sessionId: string): Promise<void>;
    $onDidChangeAuthenticationSessions(id: string, label: string, event: AuthenticationSessionsChangeEvent): Promise<void>;
    $onDidChangeAuthenticationProviders(added: AuthenticationProviderInformation[], removed: AuthenticationProviderInformation[]): Promise<void>;
}

export interface AuthenticationMain {
    $registerAuthenticationProvider(id: string, label: string, supportsMultipleAccounts: boolean): void;
    $unregisterAuthenticationProvider(id: string): void;
    $getProviderIds(): Promise<string[]>;
    $updateSessions(providerId: string, event: AuthenticationSessionsChangeEvent): void;
    $getSession(providerId: string, scopes: string[], extensionId: string, extensionName: string,
        options: { createIfNone?: boolean, clearSessionPreference?: boolean }): Promise<theia.AuthenticationSession | undefined>;
    $logout(providerId: string, sessionId: string): Promise<void>;
}

export interface RawColorInfo {
    color: [number, number, number, number];
    range: Range;
}

export interface LabelServiceExt {
    $registerResourceLabelFormatter(formatter: ResourceLabelFormatter): theia.Disposable;
}

export interface LabelServiceMain {
    $registerResourceLabelFormatter(handle: number, formatter: ResourceLabelFormatter): void;
    $unregisterResourceLabelFormatter(handle: number): void;
}

export interface SecretsExt {
    $onDidChangePassword(e: { extensionId: string, key: string }): Promise<void>;
}

export interface SecretsMain {
    $getPassword(extensionId: string, key: string): Promise<string | undefined>;
    $setPassword(extensionId: string, key: string, value: string): Promise<void>;
    $deletePassword(extensionId: string, key: string): Promise<void>;
}
