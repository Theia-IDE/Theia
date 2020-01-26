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

/* tslint:disable:no-any */

import { createProxyIdentifier, ProxyIdentifier, RPCProtocol } from './rpc-protocol';
import * as theia from '@theia/plugin';
import { PluginLifecycle, PluginModel, PluginMetadata, PluginPackage, IconUrl } from './plugin-protocol';
import { QueryParameters } from './env';
import { TextEditorCursorStyle } from './editor-options';
import {
    TextEditorLineNumbersStyle,
    EndOfLine,
    OverviewRulerLane,
    IndentAction,
    IFileOperationOptions
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
    Definition,
    DefinitionLink,
    DocumentLink,
    CodeLensSymbol,
    Command,
    TextEdit,
    DocumentSymbol,
    ReferenceContext,
    FileWatcherSubscriberOptions,
    FileChangeEvent,
    TextDocumentShowOptions,
    WorkspaceRootsChangeEvent,
    Location,
    Breakpoint,
    ColorPresentation,
    RenameLocation,
    FileMoveEvent,
    FileWillMoveEvent,
    SignatureHelpContext,
    CodeAction,
    CodeActionContext,
    FoldingContext,
    FoldingRange
} from './plugin-api-rpc-model';
import { ExtPluginApi } from './plugin-ext-api-contribution';
import { KeysToAnyValues, KeysToKeysToAnyValue } from './types';
import { CancellationToken, Progress, ProgressOptions } from '@theia/plugin';
import { DebuggerDescription } from '@theia/debug/lib/common/debug-service';
import { DebugProtocol } from 'vscode-debugprotocol';
import { SymbolInformation } from 'vscode-languageserver-types';
import { ArgumentProcessor } from '../plugin/command-registry';
import { MaybePromise } from '@theia/core/lib/common/types';
import { QuickOpenItem, QuickOpenItemOptions } from '@theia/core/lib/common/quick-open-model';
import { QuickTitleButton } from '@theia/core/lib/common/quick-open-model';

export interface PreferenceData {
    [scope: number]: any;
}

export interface Plugin {
    pluginPath: string;
    pluginFolder: string;
    model: PluginModel;
    rawModel: PluginPackage;
    lifecycle: PluginLifecycle;
}

export interface ConfigStorage {
    hostLogPath: string;
    hostStoragePath?: string;
    hostGlobalStoragePath?: string;
}

export interface EnvInit {
    queryParams: QueryParameters;
    language: string;
    shell: string;
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
        entryPoint: {

        }
    },
    pluginPath: 'empty',
    pluginFolder: 'empty',
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
    $terminalOpened(id: string, processId: number): void;
    $terminalClosed(id: string): void;
    $currentTerminalChanged(id: string | undefined): void;
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
    $createTerminal(id: string, options: theia.TerminalOptions): Promise<string>;

    /**
     * Send text to the terminal by id.
     * @param id - terminal id.
     * @param text - text content.
     * @param addNewLine - in case true - add new line after the text, otherwise - don't apply new line.
     */
    $sendText(id: string, text: string, addNewLine?: boolean): void;

    /**
     * Show terminal on the UI panel.
     * @param id - terminal id.
     * @param preserveFocus - set terminal focus in case true value, and don't set focus otherwise.
     */
    $show(id: string, preserveFocus?: boolean): void;

    /**
     * Hide UI panel where is located terminal widget.
     * @param id - terminal id.
     */
    $hide(id: string): void;

    /**
     * Distroy terminal.
     * @param id - terminal id.
     */
    $dispose(id: string): void;
}

export interface AutoFocus {
    autoFocusFirstEntry?: boolean;
    // TODO
}

export interface PickOptions {
    placeHolder?: string;
    autoFocus?: AutoFocus;
    matchOnDescription?: boolean;
    matchOnDetail?: boolean;
    ignoreFocusLost?: boolean;
    quickNavigationConfiguration?: {}; // TODO
    contextKey?: string;
    canSelectMany?: boolean;
}

export interface PickOpenItem {
    handle: number;
    id?: string;
    label: string;
    description?: string;
    detail?: string;
    picked?: boolean;
    groupLabel?: string;
    showBorder?: boolean;
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

export interface MessageRegistryMain {
    $showMessage(type: MainMessageType, message: string, options: MainMessageOptions, actions: string[]): PromiseLike<number | undefined>;
}

export interface StatusBarMessageRegistryMain {
    $setMessage(id: string,
        text: string | undefined,
        priority: number,
        alignment: theia.StatusBarAlignment,
        color: string | undefined,
        tooltip: string | undefined,
        command: string | undefined): PromiseLike<void>;
    $update(id: string, message: string): void;
    $dispose(id: string): void;
}

export interface QuickOpenExt {
    $onItemSelected(handle: number): void;
    $validateInput(input: string): PromiseLike<string | undefined> | undefined;

    $acceptOnDidAccept(quickInputNumber: number): Promise<void>;
    $acceptDidChangeValue(quickInputNumber: number, changedValue: string): Promise<void>;
    $acceptOnDidHide(quickInputNumber: number): Promise<void>;
    $acceptOnDidTriggerButton(quickInputNumber: number, btn: QuickTitleButton): Promise<void>;
    $acceptDidChangeActive(quickInputNumber: number, changedItems: QuickOpenItem<QuickOpenItemOptions>[]): Promise<void>;
    $acceptDidChangeSelection(quickInputNumber: number, selection: string): Promise<void>;
}

/**
 * Options to configure the behaviour of a file open dialog.
 */
export interface OpenDialogOptionsMain {
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
     * 	'Images': ['png', 'jpg']
     * 	'TypeScript': ['ts', 'tsx']
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
     * 	'Images': ['png', 'jpg']
     * 	'TypeScript': ['ts', 'tsx']
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

export interface QuickInputTitleButtonHandle extends QuickTitleButton {
    index: number; // index of where they are in buttons array if QuickInputButton or -1 if QuickInputButtons.Back
}

export interface TransferQuickInput {
    quickInputIndex: number;
    title: string | undefined;
    step: number | undefined;
    totalSteps: number | undefined;
    enabled: boolean;
    busy: boolean;
    ignoreFocusOut: boolean;
}

export interface TransferInputBox extends TransferQuickInput {
    value: string;
    placeholder: string | undefined;
    password: boolean;
    buttons: ReadonlyArray<theia.QuickInputButton>;
    prompt: string | undefined;
    validationMessage: string | undefined;
    validateInput(value: string): MaybePromise<string | undefined>;
}

export interface TransferQuickPick<T extends theia.QuickPickItem> extends TransferQuickInput {
    value: string;
    placeholder: string | undefined;
    buttons: ReadonlyArray<theia.QuickInputButton>;
    items: PickOpenItem[];
    canSelectMany: boolean;
    matchOnDescription: boolean;
    matchOnDetail: boolean;
    activeItems: ReadonlyArray<T>;
    selectedItems: ReadonlyArray<T>;
}

export interface QuickOpenMain {
    $show(options: PickOptions): Promise<number | number[]>;
    $setItems(items: PickOpenItem[]): Promise<any>;
    $setError(error: Error): Promise<any>;
    $input(options: theia.InputBoxOptions, validateInput: boolean): Promise<string | undefined>;
    $hide(): void;
    $showInputBox(inputBox: TransferInputBox, validateInput: boolean): void;
    $showCustomQuickPick<T extends theia.QuickPickItem>(inputBox: TransferQuickPick<T>): void;
    $setQuickInputChanged(changed: object): void;
    $refreshQuickInput(): void;
}

export interface WorkspaceMain {
    $pickWorkspaceFolder(options: WorkspaceFolderPickOptionsMain): Promise<theia.WorkspaceFolder | undefined>;
    $startFileSearch(includePattern: string, includeFolder: string | undefined, excludePatternOrDisregardExcludes: string | false,
        maxResults: number | undefined, token: theia.CancellationToken): PromiseLike<UriComponents[]>;
    $registerTextDocumentContentProvider(scheme: string): Promise<void>;
    $unregisterTextDocumentContentProvider(scheme: string): void;
    $onTextDocumentContentChange(uri: string, content: string): void;
    $registerFileSystemWatcher(options: FileWatcherSubscriberOptions): Promise<string>;
    $unregisterFileSystemWatcher(watcherId: string): Promise<void>;
    $updateWorkspaceFolders(start: number, deleteCount?: number, ...rootsToAdd: string[]): Promise<void>;
}

export interface WorkspaceExt {
    $onWorkspaceFoldersChanged(event: WorkspaceRootsChangeEvent): void;
    $provideTextDocumentContent(uri: string): Promise<string | undefined>;
    $fileChanged(event: FileChangeEvent): void;
    $onFileRename(event: FileMoveEvent): void;
    $onWillRename(event: FileWillMoveEvent): Promise<any>;
}

export interface DialogsMain {
    $showOpenDialog(options: OpenDialogOptionsMain): Promise<string[] | undefined>;
    $showSaveDialog(options: SaveDialogOptionsMain): Promise<string | undefined>;
    $showUploadDialog(options: UploadDialogOptionsMain): Promise<string[] | undefined>;
}

export interface TreeViewsMain {
    $registerTreeDataProvider(treeViewId: string): void;
    $unregisterTreeDataProvider(treeViewId: string): void;
    $refresh(treeViewId: string): void;
    $reveal(treeViewId: string, treeItemId: string): Promise<any>;
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

    themeIconId?: 'folder' | 'file';

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
    $updateInputBox(sourceControlHandle: number, message: string): Promise<void>;
    $executeResourceCommand(sourceControlHandle: number, groupHandle: number, resourceHandle: number): Promise<void>;
    $provideOriginalResource(sourceControlHandle: number, uri: string, token: CancellationToken): Promise<UriComponents | undefined>;
    $setSourceControlSelection(sourceControlHandle: number, selected: boolean): Promise<void>;
}

export interface DecorationsExt {
    registerDecorationProvider(provider: theia.DecorationProvider): theia.Disposable
    $provideDecoration(id: number, uri: string): Promise<DecorationData | undefined>
}

export interface DecorationsMain {
    $registerDecorationProvider(id: number, provider: DecorationProvider): Promise<number>;
    $fireDidChangeDecorations(id: number, arg: undefined | string | string[]): Promise<void>;
    $dispose(id: number): Promise<void>;
}

export interface DecorationData {
    letter?: string;
    title?: string;
    color?: ThemeColor;
    priority?: number;
    bubble?: boolean;
    source?: string;
}

export interface ScmMain {
    $registerSourceControl(sourceControlHandle: number, id: string, label: string, rootUri?: string): Promise<void>
    $updateSourceControl(sourceControlHandle: number, features: SourceControlProviderFeatures): Promise<void>;
    $unregisterSourceControl(sourceControlHandle: number): Promise<void>;

    $registerGroup(sourceControlHandle: number, groupHandle: number, id: string, label: string): Promise<void>;
    $updateGroup(sourceControlHandle: number, groupHandle: number, features: SourceControlGroupFeatures): Promise<void>;
    $updateGroupLabel(sourceControlHandle: number, groupHandle: number, label: string): Promise<void>;
    $updateResourceState(sourceControlHandle: number, groupHandle: number, resources: SourceControlResourceState[]): Promise<void>;
    $unregisterGroup(sourceControlHandle: number, groupHandle: number): Promise<void>;

    $setInputBoxValue(sourceControlHandle: number, value: string): Promise<void>;
    $setInputBoxPlaceholder(sourceControlHandle: number, placeholder: string): Promise<void>;
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

export interface DecorationProvider {
    provideDecoration(uri: string): Promise<DecorationData | undefined>;
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
    range: Range;
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
    newActiveEditor?: string;
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
}

export interface ResourceFileEditDto {
    oldUri: UriComponents;
    newUri: UriComponents;
    options: IFileOperationOptions;
}

export interface ResourceTextEditDto {
    resource: UriComponents;
    modelVersionId?: number;
    edits: TextEdit[];
}
export namespace ResourceTextEditDto {
    export function is(arg: Object): arg is ResourceTextEditDto {
        return !!arg && typeof arg === 'object' && 'resource' in arg && 'edits' in arg;
    }
}

export interface WorkspaceEditDto {
    edits: (ResourceFileEditDto | ResourceTextEditDto)[];
    rejectReason?: string;
}

export interface LanguagesContributionExt {
    $start(languageServerInfo: theia.LanguageServerInfo): void;
}

export interface LanguagesContributionMain {
    $registerLanguageServerProvider(languageServerInfo: theia.LanguageServerInfo): void
    $stop(id: string): void
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
    label: string;
    source?: string;
    scope?: string;
    // tslint:disable-next-line:no-any
    [key: string]: any;
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
    $resolveCompletionItem(handle: number, resource: UriComponents, position: Position, completion: Completion, token: CancellationToken): Promise<Completion>;
    $releaseCompletionItems(handle: number, id: number): void;
    $provideImplementation(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<Definition | DefinitionLink[] | undefined>;
    $provideTypeDefinition(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<Definition | DefinitionLink[] | undefined>;
    $provideDefinition(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<Definition | DefinitionLink[] | undefined>;
    $provideDeclaration(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<Definition | DefinitionLink[] | undefined>;
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
    $provideCodeLenses(handle: number, resource: UriComponents, token: CancellationToken): Promise<CodeLensSymbol[] | undefined>;
    $resolveCodeLens(handle: number, resource: UriComponents, symbol: CodeLensSymbol, token: CancellationToken): Promise<CodeLensSymbol | undefined>;
    $provideCodeActions(
        handle: number,
        resource: UriComponents,
        rangeOrSelection: Range | Selection,
        context: CodeActionContext,
        token: CancellationToken
    ): Promise<CodeAction[] | undefined>;
    $provideDocumentSymbols(handle: number, resource: UriComponents, token: CancellationToken): Promise<DocumentSymbol[] | undefined>;
    $provideWorkspaceSymbols(handle: number, query: string, token: CancellationToken): PromiseLike<SymbolInformation[]>;
    $resolveWorkspaceSymbol(handle: number, symbol: SymbolInformation, token: CancellationToken): PromiseLike<SymbolInformation>;
    $provideFoldingRange(
        handle: number,
        resource: UriComponents,
        context: FoldingContext,
        token: CancellationToken
    ): PromiseLike<FoldingRange[] | undefined>;
    $provideDocumentColors(handle: number, resource: UriComponents, token: CancellationToken): PromiseLike<RawColorInfo[]>;
    $provideColorPresentations(handle: number, resource: UriComponents, colorInfo: RawColorInfo, token: CancellationToken): PromiseLike<ColorPresentation[]>;
    $provideRenameEdits(handle: number, resource: UriComponents, position: Position, newName: string, token: CancellationToken): PromiseLike<WorkspaceEditDto | undefined>;
    $resolveRenameLocation(handle: number, resource: UriComponents, position: Position, token: CancellationToken): PromiseLike<RenameLocation | undefined>;
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
    $registerRangeFormattingProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerOnTypeFormattingProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[], autoFormatTriggerCharacters: string[]): void;
    $registerDocumentLinkProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerCodeLensSupport(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[], eventHandle?: number): void;
    $emitCodeLensEvent(eventHandle: number, event?: any): void;
    $registerOutlineSupport(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerWorkspaceSymbolProvider(handle: number, pluginInfo: PluginInfo): void;
    $registerFoldingRangeProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerDocumentColorProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void;
    $registerRenameProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[], supportsResoveInitialValues: boolean): void;
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
    $startDebugging(folder: theia.WorkspaceFolder | undefined, nameOrConfiguration: string | theia.DebugConfiguration): Promise<boolean>;
    $customRequest(sessionId: string, command: string, args?: any): Promise<DebugProtocol.Response>;
}

export interface FileSystemExt {
    $readFile(handle: number, resource: UriComponents, options?: { encoding?: string }): Promise<string>;
    $writeFile(handle: number, resource: UriComponents, content: string, options?: { encoding?: string }): Promise<void>;
}

export interface FileSystemMain {
    $registerFileSystemProvider(handle: number, scheme: string): void;
    $unregisterProvider(handle: number): void;
}

export interface ClipboardMain {
    $readText(): Promise<string>;
    $writeText(value: string): Promise<void>;
}

export const PLUGIN_RPC_CONTEXT = {
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
    STORAGE_MAIN: createProxyIdentifier<StorageMain>('StorageMain'),
    TASKS_MAIN: createProxyIdentifier<TasksMain>('TasksMain'),
    LANGUAGES_CONTRIBUTION_MAIN: createProxyIdentifier<LanguagesContributionMain>('LanguagesContributionMain'),
    DEBUG_MAIN: createProxyIdentifier<DebugMain>('DebugMain'),
    FILE_SYSTEM_MAIN: createProxyIdentifier<FileSystemMain>('FileSystemMain'),
    SCM_MAIN: createProxyIdentifier<ScmMain>('ScmMain'),
    DECORATIONS_MAIN: createProxyIdentifier<DecorationsMain>('DecorationsMain'),
    WINDOW_MAIN: createProxyIdentifier<WindowMain>('WindowMain'),
    CLIPBOARD_MAIN: <ProxyIdentifier<ClipboardMain>>createProxyIdentifier<ClipboardMain>('ClipboardMain')
};

export const MAIN_RPC_CONTEXT = {
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
    STORAGE_EXT: createProxyIdentifier<StorageExt>('StorageExt'),
    TASKS_EXT: createProxyIdentifier<TasksExt>('TasksExt'),
    LANGUAGES_CONTRIBUTION_EXT: createProxyIdentifier<LanguagesContributionExt>('LanguagesContributionExt'),
    DEBUG_EXT: createProxyIdentifier<DebugExt>('DebugExt'),
    FILE_SYSTEM_EXT: createProxyIdentifier<FileSystemExt>('FileSystemExt'),
    SCM_EXT: createProxyIdentifier<ScmExt>('ScmExt'),
    DECORATIONS_EXT: createProxyIdentifier<DecorationsExt>('DecorationsExt')
};

export interface TasksExt {
    $provideTasks(handle: number, token?: CancellationToken): Promise<TaskDto[] | undefined>;
    $resolveTask(handle: number, task: TaskDto, token?: CancellationToken): Promise<TaskDto | undefined>;
    $onDidStartTask(execution: TaskExecutionDto): void;
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
}

export interface RawColorInfo {
    color: [number, number, number, number];
    range: Range;
}
