/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
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
/* eslint-disable max-len */

// eslint-disable-next-line spaced-comment
/// <reference types='@theia/monaco-editor-core/monaco'/>

declare module monaco.languages {

    export class ExtensionIdentifier {
        public readonly value: string;
    }

    /**
     * The document formatting provider interface defines the contract between extensions and
     * the formatting-feature.
     */
    export interface DocumentFormattingEditProvider {
        readonly extensionId?: ExtensionIdentifier;
    }

    /**
     * The document formatting provider interface defines the contract between extensions and
     * the formatting-feature.
     */
    export interface DocumentRangeFormattingEditProvider {
        readonly extensionId?: ExtensionIdentifier;
    }

}

declare module monaco.format {

    export const enum FormattingMode {
        Explicit = 1,
        Silent = 2
    }

    export interface IFormattingEditProviderSelector {
        <T extends (monaco.languages.DocumentFormattingEditProvider | monaco.languages.DocumentRangeFormattingEditProvider)>(formatter: T[], document: monaco.editor.ITextModel, mode: FormattingMode): Promise<T | undefined>;
    }

    export abstract class FormattingConflicts {
        static setFormatterSelector(selector: IFormattingEditProviderSelector): monaco.IDisposable;
    }

}

declare module monaco.instantiation {
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/instantiation/common/instantiation.ts#L86
    export interface IInstantiationService {
        invokeFunction: (fn: any, ...args: any) => any
    }
}

declare module monaco.textModel {
    interface ITextStream {
        on(event: 'data', callback: (data: string) => void): void;
        on(event: 'error', callback: (err: Error) => void): void;
        on(event: 'end', callback: () => void): void;
        on(event: string, callback: any): void;
    }
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/model/textModel.ts#L62
    export function createTextBufferFactoryFromStream(stream: ITextStream, filter?: (chunk: any) => string, validator?: (chunk: any) => Error | undefined): Promise<monaco.editor.ITextBufferFactory>;
}

declare module monaco.editor {

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/model.ts#L1264
    export interface ITextBufferFactory {
        getFirstLineText(lengthLimit: number): string;
    }

    export class ResourceEdit {
        protected constructor(readonly metadata?: WorkspaceEditMetadata) { }
        static convert(workspaceEdit: WorkspaceEdit): ResourceEdit[];
    }

    export class ResourceTextEdit extends ResourceEdit {
        constructor(
            readonly resource: monaco.Uri,
            readonly textEdit: monaco.languages.TextEdit,
            readonly versionId?: number,
            readonly metadata?: monaco.languages.WorkspaceEditMetadata
        ) {
            super(metadata);
        }
    }

    export class ResourceFileEdit extends ResourceEdit {
        constructor(
            readonly oldResource: monaco.Uri | undefined,
            readonly newResource: monaco.Uri | undefined,
            readonly options?: monaco.languages.WorkspaceFileEditOptions,
            readonly metadata?: monaco.languages.WorkspaceEditMetadata
        ) {
            super(metadata);
        }
    }

    export interface ICodeEditor {
        protected readonly _instantiationService: monaco.instantiation.IInstantiationService;

        /**
         * @internal
         */
        // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/editorBrowser.ts#L736
        setDecorations(decorationTypeKey: string, ranges: editorCommon.IDecorationOptions[]): void;

        /**
         * @internal
         */
        // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/editorBrowser.ts#L746
        removeDecorations(decorationTypeKey: string): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/undoRedo/common/undoRedo.ts#L92-L111
    export class UndoRedoSource { }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/services/bulkEditService.ts#L67
    export interface IBulkEditOptions {
        editor?: ICodeEditor;
        progress?: IProgress<IProgressStep>;
        token?: CancellationToken;
        showPreview?: boolean;
        label?: string;
        quotableLabel?: string;
        undoRedoSource?: UndoRedoSource;
        undoRedoGroupId?: number;
        confirmBeforeUndo?: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/services/bulkEditService.ts#L79
    export interface IBulkEditResult {
        ariaSummary: string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/services/bulkEditService.ts#L83
    export type IBulkEditPreviewHandler = (edit: ResourceEdit[], options?: IBulkEditOptions) => Promise<ResourceEdit[]>;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/services/bulkEditService.ts#L85
    export interface IBulkEditService {
        apply(edit: ResourceEdit[], options?: IBulkEditOptions): Promise<IBulkEditResult>;
        hasPreviewHandler(): boolean;
        setPreviewHandler(handler: IBulkEditPreviewHandler): monaco.IDisposable;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/widget/diffNavigator.ts#L43
    export interface IDiffNavigator {
        readonly ranges: IDiffRange[];
        readonly nextIdx: number;
        readonly revealFirst: boolean;
        _initIdx(fwd: boolean): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/widget/diffNavigator.ts#L16
    export interface IDiffRange {
        readonly range: Range;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/standalone/browser/standaloneCodeEditor.ts#L245
    export interface IStandaloneCodeEditor extends CommonCodeEditor {
        setDecorations(decorationTypeKey: string, ranges: IDecorationOptions[]): void;
        setDecorationsFast(decorationTypeKey: string, ranges: IRange[]): void;
        trigger(source: string, handlerId: string, payload: any): void
        _standaloneKeybindingService: {
            _store: {
                _toDispose: monaco.IDisposable[]
            }
            resolveKeybinding(keybinding: monaco.keybindings.ChordKeybinding): monaco.keybindings.ResolvedKeybinding[];
            resolveKeyboardEvent(keyboardEvent: monaco.IKeyboardEvent): monaco.keybindings.ResolvedKeybinding;
        }
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/widget/codeEditorWidget.ts#L107
    export interface CommonCodeEditor {
        readonly _commandService: monaco.commands.ICommandService;
        readonly _instantiationService: monaco.instantiation.IInstantiationService;
        readonly _contributions: {
            'editor.contrib.referencesController': monaco.referenceSearch.ReferencesController
            'editor.contrib.hover': ModesHoverController
            'css.editor.codeLens': CodeLensContribution
            'editor.contrib.quickFixController': QuickFixController,
            'editor.contrib.suggestController': monaco.suggest.SuggestController
        }
        readonly _modelData: {
            cursor: ICursor
        } | null;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/codeAction/codeActionCommands.ts#L68
    export interface QuickFixController {
        readonly _ui: {
            rawValue?: CodeActionUi
        }
    }
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/codeAction/codeActionUi.ts#L21
    export interface CodeActionUi {
        readonly _lightBulbWidget: {
            rawValue?: LightBulbWidget
        }
    }
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/codeAction/lightBulbWidget.ts#L48
    export interface LightBulbWidget {
        readonly _domNode: HTMLDivElement;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/codelens/codelensController.ts#L28
    export interface CodeLensContribution {
        readonly _lenses: CodeLensWidget[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/codelens/codelensWidget.ts#L178
    export interface CodeLensWidget {
        readonly _contentWidget?: CodeLensContentWidget;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/codelens/codelensWidget.ts#L49
    export interface CodeLensContentWidget {
        readonly _domNode: HTMLElement;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/hover/hover.ts#L30
    export interface ModesHoverController {
        readonly _contentWidget: ModesContentHoverWidget | null;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/browser/ui/hover/hoverWidget.ts#L13-L39
    export class HoverWidget extends Disposable {
        readonly contentsDomNode: HTMLElement;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/hover/modesContentHover.ts#L177
    export interface ModesContentHoverWidget {
        readonly _isVisible: boolean;
        readonly _hover: HoverWidget;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/controller/cursor.ts#L122
    export interface ICursor {
        trigger(source: string, handlerId: string, payload: any): void;
    }

    export interface IEditorOverrideServices {
        codeEditorService?: ICodeEditorService;
        textModelService?: ITextModelService;
        contextMenuService?: IContextMenuService;
        commandService?: monaco.commands.ICommandService;
        IWorkspaceEditService?: IBulkEditService;
        contextKeyService?: monaco.contextKeyService.IContextKeyService;
        quickInputService?: monaco.quickInput.IQuickInputService;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/editor/common/editor.ts#L68
    export interface IResourceEditorInput {
        resource: monaco.Uri;
        options?: IResourceInputOptions;
    }

    export interface IResourceInputOptions {
        /**
         * Tells the editor to not receive keyboard focus when the editor is being opened. By default,
         * the editor will receive keyboard focus on open.
         */
        // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/editor/common/editor.ts#L150
        readonly preserveFocus?: boolean;

        /**
         * Will reveal the editor if it is already opened and visible in any of the opened editor groups.
         */
        // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/editor/common/editor.ts#L175
        readonly revealIfVisible?: boolean;

        /**
         * Text editor selection.
         */
        // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/editor/common/editor.ts#L270
        readonly selection?: Partial<monaco.IRange>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/services/codeEditorService.ts#L16
    export interface ICodeEditorService {
        getFocusedCodeEditor(): monaco.editor.ICodeEditor | undefined;
        getActiveCodeEditor(): monaco.editor.ICodeEditor | undefined;
        openCodeEditor(input: monaco.editor.IResourceEditorInput, source?: monaco.editor.ICodeEditor, sideBySide?: boolean): Promise<monaco.editor.CommonCodeEditor | undefined>;
        registerDecorationType(key: string, options: IDecorationRenderOptions, parentTypeKey?: string, editor?: monaco.editor.ICodeEditor): void;
        removeDecorationType(key: string): void;
        resolveDecorationOptions(typeKey: string, writable: boolean): IModelDecorationOptions;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/lifecycle.ts#L253
    export interface IReference<T> extends monaco.IDisposable {
        readonly object: T;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/services/resolverService.ts#L14
    export interface ITextModelService {
        /**
         * Provided a resource URI, it will return a model reference
         * which should be disposed once not needed anymore.
         */
        createModelReference(resource: monaco.Uri): Promise<IReference<ITextEditorModel>>;

        /**
         * Registers a specific `scheme` content provider.
         */
        registerTextModelContentProvider(scheme: string, provider: ITextModelContentProvider): monaco.IDisposable;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/services/resolverService.ts#L34
    export interface ITextModelContentProvider {
        /**
         * Given a resource, return the content of the resource as IModel.
         */
        provideTextContent(resource: monaco.Uri): Promise<monaco.editor.IModel | null> | null;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/services/resolverService.ts#L42 &&
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/editor/common/editor.ts#L9
    export interface ITextEditorModel {
        readonly onDispose: monaco.IEvent<void>;
        /**
         * Loads the model.
         */
        load(): Promise<ITextEditorModel>;

        /**
         * Dispose associated resources
         */
        dispose(): void;
        /**
         * Provides access to the underlying IModel.
         */
        textEditorModel: monaco.editor.IModel;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/browser/contextmenu.ts#L18
    export interface IContextMenuDelegate {
        /**
         * Returns with an HTML element or the client coordinates as the anchor of the context menu to open.
         */
        getAnchor(): HTMLElement | { x: number; y: number; width?: number; height?: number };

        /**
         * Returns the actions for the menu
         */
        getActions(): ReadonlyArray<IAction>;

        /**
         * Needs to be called with the context menu closes again.
         */
        onHide(wasCancelled: boolean): void
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/actions.ts#L26
    export interface IAction extends IDisposable {
        readonly id: string;
        label: string;
        tooltip: string;
        class: string | undefined;
        enabled: boolean;
        checked: boolean;
        run(event?: any): Promise<any>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/contextview/browser/contextView.ts#L39
    export interface IContextMenuService {
        /**
         * Shows the native Monaco context menu in the editor.
         */
        showContextMenu(delegate: IContextMenuDelegate): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/editorCommon.ts#L680
    export interface IDecorationOptions {
        range: IRange;
        hoverMessage?: IMarkdownString | IMarkdownString[];
        renderOptions?: IDecorationInstanceRenderOptions;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/editorCommon.ts#L664
    export interface IThemeDecorationInstanceRenderOptions {
        before?: IContentDecorationRenderOptions;
        after?: IContentDecorationRenderOptions;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/editorCommon.ts#L672
    export interface IDecorationInstanceRenderOptions extends IThemeDecorationInstanceRenderOptions {
        light?: IThemeDecorationInstanceRenderOptions;
        dark?: IThemeDecorationInstanceRenderOptions;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/editorCommon.ts#L628
    export interface IContentDecorationRenderOptions {
        contentText?: string;
        contentIconPath?: UriComponents;

        border?: string;
        borderColor?: string | ThemeColor;
        fontStyle?: string;
        fontWeight?: string;
        textDecoration?: string;
        color?: string | ThemeColor;
        opacity?: string; // does not exist in vs code
        backgroundColor?: string | ThemeColor;

        margin?: string;
        width?: string;
        height?: string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/editorCommon.ts#L652
    export interface IDecorationRenderOptions extends IThemeDecorationRenderOptions {
        isWholeLine?: boolean;
        rangeBehavior?: TrackedRangeStickiness;
        overviewRulerLane?: OverviewRulerLane;

        light?: IThemeDecorationRenderOptions;
        dark?: IThemeDecorationRenderOptions;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/editorCommon.ts#L592
    export interface IThemeDecorationRenderOptions {
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
        fontSize?: string;
        textDecoration?: string;
        cursor?: string;
        color?: string | ThemeColor;
        opacity?: string;
        letterSpacing?: string;

        gutterIconPath?: UriComponents;
        gutterIconSize?: string;

        overviewRulerColor?: string | ThemeColor;

        before?: IContentDecorationRenderOptions;
        after?: IContentDecorationRenderOptions;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/model.ts#L522
    export interface ITextSnapshot {
        read(): string | null;
    }

    export interface ITextModel {
        /**
         * Get the tokens for the line `lineNumber`.
         * The tokens might be inaccurate. Use `forceTokenization` to ensure accurate tokens.
         * @internal
         */
        // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/model.ts#L890
        getLineTokens(lineNumber: number): LineTokens;

        /**
         * Force tokenization information for `lineNumber` to be accurate.
         * @internal
         */
        // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/model.ts#L869
        forceTokenization(lineNumber: number): void;

        // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/model.ts#L617
        createSnapshot(): ITextSnapshot | null;

        /**
         * Get the language associated with this model.
         * @internal
         */
        // https://github.com/theia-ide/vscode/blob/standalone/0.19.x/src/vs/editor/common/model.ts#L833-L837
        getLanguageIdentifier(): monaco.services.LanguageIdentifier;

    }

}

declare module monaco.commands {

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/commands/common/commands.ts#L60
    export const CommandsRegistry: {
        getCommands(): Map<string, { id: string, handler: (...args: any) => any }>;
    };

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/commands/common/commands.ts#L16
    export interface ICommandEvent {
        commandId: string;
        args: any[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/commands/common/commands.ts#L21
    export interface ICommandService {
        onWillExecuteCommand: monaco.Event<ICommandEvent>;
        onDidExecuteCommand: monaco.Event<ICommandEvent>;
        executeCommand<T = any>(commandId: string, ...args: any[]): Promise<T | undefined>;
    }

}

declare module monaco.actions {

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/actions/common/actions.ts#L21
    export interface ILocalizedString {
        value: string;
        original: string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/actions/common/actions.ts#L41
    export interface ICommandAction {
        id: string;
        title: string | ILocalizedString;
        category?: string | ILocalizedString;
        icon?: { dark?: monaco.Uri; light?: monaco.Uri; } | monaco.theme.ThemeIcon;
        precondition?: monaco.contextkey.ContextKeyExpression;
        toggled?: monaco.contextkey.ContextKeyExpression;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/actions/common/actions.ts#L53
    export interface IMenuItem {
        command: ICommandAction;
        when?: monaco.contextkey.ContextKeyExpression;
        group?: 'navigation' | string;
        order?: number;
        alt?: ICommandAction;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/actions/common/actions.ts#L61
    export interface ISubmenuItem {
        title: string | ILocalizedString;
        submenu: number; // enum MenuId
        when?: monaco.contextkey.ContextKeyExpression;
        group?: 'navigation' | string;
        order?: number;
    }

    export class MenuId {

        private static _idPool = 0;

        static readonly CommandPalette = new MenuId('CommandPalette');
        static readonly DebugBreakpointsContext = new MenuId('DebugBreakpointsContext');
        static readonly DebugCallStackContext = new MenuId('DebugCallStackContext');
        static readonly DebugConsoleContext = new MenuId('DebugConsoleContext');
        static readonly DebugVariablesContext = new MenuId('DebugVariablesContext');
        static readonly DebugWatchContext = new MenuId('DebugWatchContext');
        static readonly DebugToolBar = new MenuId('DebugToolBar');
        static readonly EditorContext = new MenuId('EditorContext');
        static readonly EditorContextPeek = new MenuId('EditorContextPeek');
        static readonly EditorTitle = new MenuId('EditorTitle');
        static readonly EditorTitleRun = new MenuId('EditorTitleRun');
        static readonly EditorTitleContext = new MenuId('EditorTitleContext');
        static readonly EmptyEditorGroupContext = new MenuId('EmptyEditorGroupContext');
        static readonly ExplorerContext = new MenuId('ExplorerContext');
        static readonly ExtensionContext = new MenuId('ExtensionContext');
        static readonly GlobalActivity = new MenuId('GlobalActivity');
        static readonly MenubarAppearanceMenu = new MenuId('MenubarAppearanceMenu');
        static readonly MenubarDebugMenu = new MenuId('MenubarDebugMenu');
        static readonly MenubarEditMenu = new MenuId('MenubarEditMenu');
        static readonly MenubarFileMenu = new MenuId('MenubarFileMenu');
        static readonly MenubarGoMenu = new MenuId('MenubarGoMenu');
        static readonly MenubarHelpMenu = new MenuId('MenubarHelpMenu');
        static readonly MenubarLayoutMenu = new MenuId('MenubarLayoutMenu');
        static readonly MenubarNewBreakpointMenu = new MenuId('MenubarNewBreakpointMenu');
        static readonly MenubarPreferencesMenu = new MenuId('MenubarPreferencesMenu');
        static readonly MenubarRecentMenu = new MenuId('MenubarRecentMenu');
        static readonly MenubarSelectionMenu = new MenuId('MenubarSelectionMenu');
        static readonly MenubarSwitchEditorMenu = new MenuId('MenubarSwitchEditorMenu');
        static readonly MenubarSwitchGroupMenu = new MenuId('MenubarSwitchGroupMenu');
        static readonly MenubarTerminalMenu = new MenuId('MenubarTerminalMenu');
        static readonly MenubarViewMenu = new MenuId('MenubarViewMenu');
        static readonly MenubarHomeMenu = new MenuId('MenubarHomeMenu');
        static readonly OpenEditorsContext = new MenuId('OpenEditorsContext');
        static readonly ProblemsPanelContext = new MenuId('ProblemsPanelContext');
        static readonly SCMChangeContext = new MenuId('SCMChangeContext');
        static readonly SCMResourceContext = new MenuId('SCMResourceContext');
        static readonly SCMResourceFolderContext = new MenuId('SCMResourceFolderContext');
        static readonly SCMResourceGroupContext = new MenuId('SCMResourceGroupContext');
        static readonly SCMSourceControl = new MenuId('SCMSourceControl');
        static readonly SCMTitle = new MenuId('SCMTitle');
        static readonly SearchContext = new MenuId('SearchContext');
        static readonly StatusBarWindowIndicatorMenu = new MenuId('StatusBarWindowIndicatorMenu');
        static readonly TestItem = new MenuId('TestItem');
        static readonly TouchBarContext = new MenuId('TouchBarContext');
        static readonly TitleBarContext = new MenuId('TitleBarContext');
        static readonly TunnelContext = new MenuId('TunnelContext');
        static readonly TunnelPortInline = new MenuId('TunnelInline');
        static readonly TunnelTitle = new MenuId('TunnelTitle');
        static readonly TunnelLocalAddressInline = new MenuId('TunnelLocalAddressInline');
        static readonly TunnelOriginInline = new MenuId('TunnelOriginInline');
        static readonly ViewItemContext = new MenuId('ViewItemContext');
        static readonly ViewContainerTitle = new MenuId('ViewContainerTitle');
        static readonly ViewContainerTitleContext = new MenuId('ViewContainerTitleContext');
        static readonly ViewTitle = new MenuId('ViewTitle');
        static readonly ViewTitleContext = new MenuId('ViewTitleContext');
        static readonly CommentThreadTitle = new MenuId('CommentThreadTitle');
        static readonly CommentThreadActions = new MenuId('CommentThreadActions');
        static readonly CommentTitle = new MenuId('CommentTitle');
        static readonly CommentActions = new MenuId('CommentActions');
        static readonly NotebookCellTitle = new MenuId('NotebookCellTitle');
        static readonly NotebookCellInsert = new MenuId('NotebookCellInsert');
        static readonly NotebookCellBetween = new MenuId('NotebookCellBetween');
        static readonly NotebookCellListTop = new MenuId('NotebookCellTop');
        static readonly NotebookDiffCellInputTitle = new MenuId('NotebookDiffCellInputTitle');
        static readonly NotebookDiffCellMetadataTitle = new MenuId('NotebookDiffCellMetadataTitle');
        static readonly NotebookDiffCellOutputsTitle = new MenuId('NotebookDiffCellOutputsTitle');
        static readonly BulkEditTitle = new MenuId('BulkEditTitle');
        static readonly BulkEditContext = new MenuId('BulkEditContext');
        static readonly TimelineItemContext = new MenuId('TimelineItemContext');
        static readonly TimelineTitle = new MenuId('TimelineTitle');
        static readonly TimelineTitleContext = new MenuId('TimelineTitleContext');
        static readonly AccountsContext = new MenuId('AccountsContext');
        static readonly PanelTitle = new MenuId('PanelTitle');
        static readonly TerminalContext = new MenuId('TerminalContext');

        readonly id: number;
        readonly _debugName: string;

        constructor(debugName: string) {
            this.id = MenuId._idPool++;
            this._debugName = debugName;
        }
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/actions/common/actions.ts#L191
    export interface IMenuRegistry {
        /**
         * Retrieves all the registered menu items for the given menu.
         * @param menuId - see https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/actions/common/actions.ts#L89
         */
        getMenuItems(menuId: MenuId): Array<IMenuItem | ISubmenuItem>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/actions/common/actions.ts#L70
    export function isIMenuItem(item: IMenuItem | ISubmenuItem): item is IMenuItem;

    /**
     * The shared menu registry singleton.
     */
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/actions/common/actions.ts#L202
    export const MenuRegistry: IMenuRegistry;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/actions/common/actions.ts#L356
    export class MenuItemAction { }
}

declare module monaco.platform {
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/platform.ts#L245
    export const enum OperatingSystem {
        Windows = 1,
        Macintosh = 2,
        Linux = 3
    }
    export const OS: OperatingSystem;

    export class Registry {
        static add(id: string, data: any): void;

        /**
         * Returns true iff there is an extension with the provided id.
         * @param id an extension identifier
         */
        static knows(id: string): boolean;

        /**
         * Returns the extension functions and properties defined by the specified key or null.
         * @param id an extension identifier
         */
        static as<T>(id: string): T;
    }
}

declare module monaco.keybindings {

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/keybinding/common/keybindingResolver.ts#L19
    export class KeybindingResolver {
        static contextMatchesRules(context: monaco.contextKeyService.IContext, rules: monaco.contextkey.ContextKeyExpression | null | undefined): boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/keyCodes.ts#L443
    export class SimpleKeybinding {
        public readonly ctrlKey: boolean;
        public readonly shiftKey: boolean;
        public readonly altKey: boolean;
        public readonly metaKey: boolean;
        public readonly keyCode: KeyCode;

        constructor(ctrlKey: boolean, shiftKey: boolean, altKey: boolean, metaKey: boolean, keyCode: KeyCode);
        toChord(): ChordKeybinding;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/keyCodes.ts#L503
    export class ChordKeybinding {
        readonly parts: SimpleKeybinding[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/keyCodes.ts#L540
    export type Keybinding = ChordKeybinding;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/keybinding/common/keybindingsRegistry.ts#L12
    export interface IKeybindingItem {
        keybinding: Keybinding;
        command: string;
        when?: monaco.contextkey.ContextKeyExpression;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/keybinding/common/keybindingsRegistry.ts#L73
    export interface IKeybindingsRegistry {
        /**
         * Returns with all the default, static keybindings.
         */
        getDefaultKeybindings(): IKeybindingItem[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/keybinding/common/keybindingsRegistry.ts#L243
    export const KeybindingsRegistry: IKeybindingsRegistry;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/keyCodes.ts#L542
    export class ResolvedKeybindingPart {
        readonly ctrlKey: boolean;
        readonly shiftKey: boolean;
        readonly altKey: boolean;
        readonly metaKey: boolean;

        readonly keyLabel: string | null;
        readonly keyAriaLabel: string | null;

        constructor(ctrlKey: boolean, shiftKey: boolean, altKey: boolean, metaKey: boolean, kbLabel: string | null, kbAriaLabel: string | null);
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/keyCodes.ts#L564
    export abstract class ResolvedKeybinding {
        public abstract getLabel(): string | null;
        public abstract getAriaLabel(): string | null;
        public abstract getElectronAccelerator(): string | null;
        public abstract getUserSettingsLabel(): string | null;
        public abstract isWYSIWYG(): boolean;
        public abstract isChord(): boolean;
        public abstract getParts(): ResolvedKeybindingPart[];
        public abstract getDispatchParts(): (string | null)[];
        public abstract getSingleModifierDispatchParts(): (string | null)[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/keybinding/common/usLayoutResolvedKeybinding.ts#L13
    export class USLayoutResolvedKeybinding {
        public static getDispatchStr(keybinding: SimpleKeybinding): string | null;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/keybindingLabels.ts#L17
    export interface Modifiers {
        readonly ctrlKey: boolean;
        readonly shiftKey: boolean;
        readonly altKey: boolean;
        readonly metaKey: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/keybindingLabels.ts#L24
    export interface KeyLabelProvider<T extends Modifiers> {
        (keybinding: T): string | null;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/keybindingLabels.ts#L28
    export interface ModifierLabelProvider {
        toLabel<T extends Modifiers>(OS: monaco.platform.OperatingSystem, parts: T[], keyLabelProvider: KeyLabelProvider<T>): string | null;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/keybindingLabels.ts#L61
    export const UILabelProvider: ModifierLabelProvider;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/keybindingLabels.ts#L88
    export const AriaLabelProvider: ModifierLabelProvider;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/keybindingLabels.ts#L116
    export const ElectronAcceleratorLabelProvider: ModifierLabelProvider;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/keybindingLabels.ts#L136
    export const UserSettingsLabelProvider: ModifierLabelProvider;

}

declare module monaco.services {

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/standalone/browser/standaloneLanguages.ts#L107
    export class TokenizationSupport2Adapter implements monaco.modes.ITokenizationSupport {
        constructor(standaloneThemeService: IStandaloneThemeService, languageIdentifier: LanguageIdentifier, actual: monaco.languages.TokensProvider)
        tokenize(line: string, state: monaco.languages.IState, offsetDelta: number): any;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/services/resolverService.ts#L12
    export const ITextModelService: any;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/opener/common/opener.ts#L15
    export interface OpenInternalOptions {
        readonly openToSide?: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/opener/common/opener.ts#L35
    export interface OpenExternalOptions {
        readonly openExternal?: boolean
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/opener/common/opener.ts#L49
    export interface IOpener {
        open(resource: monaco.Uri | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/services/openerService.ts#L94
    export class OpenerService {
        constructor(editorService: monaco.editor.ICodeEditorService, commandService: monaco.commands.ICommandService);
        registerOpener(opener: IOpener): monaco.IDisposable;
        open(resource: monaco.Uri | string, options?: OpenInternalOptions & OpenExternalOptions): Promise<boolean>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/services/codeEditorService.ts#L14
    export const ICodeEditorService: any;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/configuration/common/configuration.ts#L16
    export const IConfigurationService: any;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/configuration/common/configurationModels.ts#L377
    export interface Configuration {
        getValue(section: string | undefined, overrides: any, workspace: any | undefined): any;
        toData(): any;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/configuration/common/configuration.ts#L30-L38
    export const enum ConfigurationTarget {
        USER = 1,
        USER_LOCAL,
        USER_REMOTE,
        WORKSPACE,
        WORKSPACE_FOLDER,
        DEFAULT,
        MEMORY
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/configuration/common/configuration.ts#L51
    export interface IConfigurationChange {
        keys: string[];
        overrides: [string, string[]][];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/configuration/common/configuration.ts#L56
    export class IConfigurationChangeEvent {

        readonly source: ConfigurationTarget;
        readonly affectedKeys: string[];
        readonly change: IConfigurationChange;

        affectsConfiguration(configuration: string, overrides?: IConfigurationOverrides): boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/configuration/common/configuration.ts#L25
    export interface IConfigurationOverrides {
        overrideIdentifier?: string | null;
        resource?: monaco.Uri | null;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/standalone/browser/simpleServices.ts#L445
    export interface IConfigurationService {
        _onDidChangeConfiguration: monaco.Emitter<IConfigurationChangeEvent>;
        _configuration: Configuration;
    }

    // https://github.com/microsoft/vscode/blob/standalone/0.23.x/src/vs/editor/common/services/textResourceConfigurationService.ts#L71
    export interface ITextResourcePropertiesService {
        getEOL(resource: monaco.Uri | undefined, language?: string): string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/services/codeEditorServiceImpl.ts#L84
    export class CodeEditorServiceImpl implements monaco.editor.ICodeEditorService {
        constructor(styleSheet: any, themeService: IStandaloneThemeService);

        getActiveCodeEditor(): monaco.editor.ICodeEditor | undefined;
        openCodeEditor(input: monaco.editor.IResourceEditorInput, source?: monaco.editor.ICodeEditor,
            sideBySide?: boolean): Promise<monaco.editor.CommonCodeEditor | undefined>;
        registerDecorationType: monaco.editor.ICodeEditorService['registerDecorationType'];
        removeDecorationType: monaco.editor.ICodeEditorService['removeDecorationType'];
        resolveDecorationOptions: monaco.editor.ICodeEditorService['resolveDecorationOptions'];
        /**
         * It respects inline and emebedded editors in comparison to `getActiveCodeEditor`
         * which only respect standalone and diff modified editors.
         */
        getFocusedCodeEditor(): monaco.editor.ICodeEditor | undefined;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/standalone/browser/simpleServices.ts#L264
    export class StandaloneCommandService implements monaco.commands.ICommandService {
        constructor(instantiationService: monaco.instantiation.IInstantiationService);
        private readonly _onWillExecuteCommand: monaco.Emitter<monaco.commands.ICommandEvent>;
        private readonly _onDidExecuteCommand: monaco.Emitter<monaco.commands.ICommandEvent>;

        executeCommand<T>(commandId: string, ...args: any[]): Promise<T>;
        executeCommand(commandId: string, ...args: any[]): Promise<any>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/standalone/browser/standaloneServices.ts#L66
    export class LazyStaticService<T> {
        get(overrides?: monaco.editor.IEditorOverrideServices): T;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/theme/common/themeService.ts#L86
    export interface ITokenStyle {
        readonly foreground?: number;
        readonly bold?: boolean;
        readonly underline?: boolean;
        readonly italic?: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/standalone/common/standaloneThemeService.ts#L29
    export interface IStandaloneThemeService extends monaco.theme.IThemeService {
        // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/standalone/browser/standaloneThemeServiceImpl.ts#L200
        readonly _knownThemes: Map<string, IStandaloneTheme>;
        setTheme(themeName: string): void;
        setAutoDetectHighContrast(autoDetectHighContrast: boolean): void;
        defineTheme(themeName: string, themeData: monaco.editor.IStandaloneThemeData): void;
        getColorTheme(): IStandaloneTheme;
        setColorMapOverride(colorMapOverride: monaco.color.Color[] | null): void;
    }

    export class StandaloneThemeServiceImpl implements IStandaloneThemeService {
        readonly _knownThemes: Map<string, IStandaloneTheme>;
        setTheme(themeName: string): void { }
        setAutoDetectHighContrast(autoDetectHighContrast: boolean): void { }
        defineTheme(themeName: string, themeData: monaco.editor.IStandaloneThemeData): void { }
        getColorTheme(): IStandaloneTheme { }
        setColorMapOverride(colorMapOverride: monaco.color.Color[] | null): void { }
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/standalone/common/standaloneThemeService.ts#L24
    export interface IStandaloneTheme extends monaco.theme.IColorTheme {
        // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/standalone/browser/standaloneThemeServiceImpl.ts#L33
        themeData: monaco.editor.IStandaloneThemeData

        tokenTheme: TokenTheme;

        // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/theme/common/themeService.ts#L105
        getColor(color: string, useDefault?: boolean): monaco.color.Color | undefined;

        getTokenStyleMetadata(type: string, modifiers: string[], modelLanguage: string): ITokenStyle | undefined;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/modes/supports/tokenization.ts#L188
    export interface TokenTheme {
        match(languageId: LanguageId, scope: string): number;
        _match(token: string): any;
        getColorMap(): monaco.color.Color[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/modes.ts#L27
    export const enum LanguageId {
        Null = 0,
        PlainText = 1
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/modes.ts#L35
    export class LanguageIdentifier {
        public readonly id: LanguageId;
        readonly language: string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/modes.ts#L58
    export interface IMode {
        getId(): string;
        getLanguageIdentifier(): LanguageIdentifier;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/services/modeService.ts#L30
    export interface IModeService {
        // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/services/modeServiceImpl.ts#L46
        private readonly _instantiatedModes: { [modeId: string]: IMode; };
        private readonly _onLanguagesMaybeChanged: Emitter<void>;
        readonly onDidCreateMode: monaco.IEvent<IMode>;
        createByFilepathOrFirstLine(rsource: monaco.Uri | null, firstLine?: string): ILanguageSelection;
        getLanguageIdentifier(modeId: string | LanguageId): LanguageIdentifier | null;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/services/modeService.ts#L25
    export interface ILanguageSelection {
        readonly languageIdentifier: LanguageIdentifier;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/instantiation/common/serviceCollection.ts#L9
    export interface ServiceCollection {
        set<T>(id: any, instanceOrDescriptor: T): T;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/markers/common/markers.ts#L12
    export interface IMarkerService {
        read(filter?: { owner?: string; resource?: monaco.Uri; severities?: number, take?: number; }): editor.IMarker[];
    }

    // https://github.com/microsoft/vscode/blob/e683ace9e5acadba0e8bde72d793cb2cb83e58a7/src/vs/editor/common/services/modelService.ts#L18
    export interface IModelService {
        createModel(value: string | monaco.editor.ITextBufferFactory, languageSelection: ILanguageSelection | null, resource?: monaco.URI, isForSimpleWidget?: boolean): monaco.editor.ITextModel;
        updateModel(model: monaco.editor.ITextModel, value: string | monaco.editor.ITextBufferFactory): void;
    }

    // https://github.com/microsoft/vscode/blob/standalone/0.23.x/src/vs/editor/common/services/editorWorkerService.ts#L21
    export interface IEditorWorkerService {
        computeMoreMinimalEdits(resource: monaco.Uri, edits: monaco.languages.TextEdit[] | null | undefined): Promise<monaco.languages.TextEdit[] | undefined>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/standalone/browser/standaloneServices.ts#L62
    export module StaticServices {
        export function init(overrides: monaco.editor.IEditorOverrideServices): [ServiceCollection, monaco.instantiation.IInstantiationService];
        export const standaloneThemeService: LazyStaticService<IStandaloneThemeService>;
        export const modeService: LazyStaticService<IModeService>;
        export const codeEditorService: LazyStaticService<monaco.editor.ICodeEditorService>;
        export const configurationService: LazyStaticService<IConfigurationService>;
        export const resourcePropertiesService: LazyStaticService<ITextResourcePropertiesService>;
        export const instantiationService: LazyStaticService<monaco.instantiation.IInstantiationService>;
        export const markerService: LazyStaticService<IMarkerService>;
        export const modelService: LazyStaticService<IModelService>;
        export const editorWorkerService: LazyStaticService<IEditorWorkerService>;
    }
}

declare module monaco.theme {
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/theme/common/themeService.ts#L93

    export type ColorIdentifier = string;

    export interface IColorTheme {
        readonly type: ColorScheme;

        readonly label: string;

        /**
         * Resolves the color of the given color identifier. If the theme does not
         * specify the color, the default color is returned unless <code>useDefault</code> is set to false.
         * @param color the id of the color
         * @param useDefault specifies if the default color should be used. If not set, the default is used.
         */
        getColor(color: ColorIdentifier, useDefault?: boolean): monaco.color.Color | undefined;

        /**
         * Returns whether the theme defines a value for the color. If not, that means the
         * default color will be used.
         */
        defines(color: ColorIdentifier): boolean;

        /**
         * Returns the token style for a given classification. The result uses the <code>MetadataConsts</code> format
         */
        getTokenStyleMetadata(type: string, modifiers: string[], modelLanguage: string): monaco.services.ITokenStyle | undefined;

        /**
         * List of all colors used with tokens. <code>getTokenStyleMetadata</code> references the colors by index into this list.
         */
        readonly tokenColorMap: string[];

        /**
         * Defines whether semantic highlighting should be enabled for the theme.
         */
        readonly semanticHighlighting: boolean;
    }

    export interface IFileIconTheme {
        readonly hasFileIcons: boolean;
        readonly hasFolderIcons: boolean;
        readonly hidesExplorerArrows: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/theme/common/themeService.ts#L143
    export interface IThemeService {
        getColorTheme(): IColorTheme;
        getFileIconTheme(): IFileIconTheme;
        readonly onDidColorThemeChange: monaco.IEvent<IColorTheme>;
        readonly onDidFileIconThemeChange: monaco.IEvent<IFileIconTheme>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/styler.ts#L10
    export interface IThemable { }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/theme/common/styler.ts#L171
    export function attachQuickOpenStyler(widget: IThemable, themeService: IThemeService): monaco.IDisposable;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/theme/common/themeService.ts#L38
    export interface ThemeIcon {
        readonly id: string;
    }
    export namespace ThemeIcon {
        export function fromString(value: string): ThemeIcon | undefined;
        export function asClassName(icon: ThemeIcon): string | undefined;
    }
}

declare module monaco.color {

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/color.ts#L13
    export class RGBA {
        readonly r: number;
        readonly g: number;
        readonly b: number;
        readonly a: number;

        constructor(r: number, g: number, b: number, a?: number);
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/color.ts#L48
    export class HSLA {
        readonly h: number;
        readonly s: number;
        readonly l: number;
        readonly a: number;

        constructor(h: number, s: number, l: number, a: number);
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/color.ts#L256
    export class Color {
        readonly rgba: RGBA;

        constructor(arg: RGBA | HSLA);
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/theme/common/colorRegistry.ts#L19
    export interface ColorContribution {
        readonly id: string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/theme/common/colorRegistry.ts#L28
    export type ColorFunction = (theme: monaco.theme.IColorTheme) => Color | undefined;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/theme/common/colorRegistry.ts#L41
    export type ColorValue = string | Color | ColorFunction;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/theme/common/colorRegistry.ts#L32
    export interface ColorDefaults {
        light?: ColorValue;
        dark?: ColorValue;
        hc?: ColorValue;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/theme/common/colorRegistry.ts#L48
    export interface IColorRegistry {
        getColors(): ColorContribution[];
        registerColor(id: string, defaults: ColorDefaults | undefined, description: string): string;
        deregisterColor(id: string): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/theme/common/colorRegistry.ts#L170
    export function getColorRegistry(): IColorRegistry;
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/theme/common/colorRegistry.ts#L475
    export function darken(colorValue: ColorValue, factor: number): ColorFunction;
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/theme/common/colorRegistry.ts#L485
    export function lighten(colorValue: ColorValue, factor: number): ColorFunction;
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/theme/common/colorRegistry.ts#L495
    export function transparent(colorValue: ColorValue, factor: number): ColorFunction;
}

declare module monaco.referenceSearch {

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/modes.ts#L943
    export interface Location {
        uri: Uri,
        range: IRange
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/gotoSymbol/referencesModel.ts#L22
    export interface OneReference { }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/gotoSymbol/referencesModel.ts#L142
    export interface ReferencesModel implements IDisposable {
        readonly references: OneReference[]
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/gotoSymbol/peek/referencesWidget.ts#L193
    export interface ReferenceWidget {
        show(range: IRange): void;
        hide(): void;
        focusOnReferenceTree(): void;
        focusOnPreviewEditor(): void;
        isPreviewEditorFocused(): boolean;
        _tree: ReferenceTree;
        _preview: ICodeEditor;
    }

    // it's used as return value for referenceWidget._tree
    // see https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/gotoSymbol/peek/referencesWidget.ts#L204
    export interface ReferenceTree {
        getFocus(): ReferenceTreeElement[]
    }
    export interface ReferenceTreeElement { }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/gotoSymbol/peek/referencesController.ts#L32
    export interface ReferencesController extends IDisposable {
        static readonly ID: string;
        _widget?: ReferenceWidget;
        _model?: ReferencesModel;
        _ignoreModelChangeEvent: boolean;
        _editorService: monaco.editor.ICodeEditorService;
        closeWidget(focusEditor?: boolean): void;
        _gotoReference(ref: Location): Promise<any>;
        toggleWidget(range: IRange, modelPromise: Promise<ReferencesModel> & { cancel: () => void }, peekMode: boolean): void;
    }
}

declare module monaco.quickInput {
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/quickinput/common/quickInput.ts#L18
    export interface IQuickInputService {
        readonly _serviceBrand?: undefined;
        /**
         * Provides access to the back button in quick input.
         */
        readonly backButton?: IQuickInputButton;
        /**
         * Provides access to the quick access providers.
         */
        readonly quickAccess: IQuickAccessController;
        /**
         * Allows to register on the event that quick input is showing.
         */
        readonly onShow?: Event<void>;
        /**
         * Allows to register on the event that quick input is hiding.
         */
        readonly onHide?: Event<void>;
        /**
         * Opens the quick input box for selecting items and returns a promise
         * with the user selected item(s) if any.
         */
        pick?<T extends IQuickPickItem>(picks: Promise<QuickPickItem[]> | QuickPickItem[], options?: IPickOptions<T> & { canPickMany: true }, token?: CancellationToken): Promise<T[] | undefined>;
        pick?<T extends IQuickPickItem>(picks: Promise<QuickPickItem[]> | QuickPickItem[], options?: IPickOptions<T> & { canPickMany: false }, token?: CancellationToken): Promise<T | undefined>;
        pick?<T extends IQuickPickItem>(picks: Promise<QuickPickItem[]> | QuickPickItem[], options?: Omit<IPickOptions<T>, 'canPickMany'>, token?: CancellationToken): Promise<T | undefined>;
        /**
         * Opens the quick input box for text input and returns a promise with the user typed value if any.
         */
        input?(options?: IInputOptions, token?: CancellationToken): Promise<string | undefined>;
        /**
         * Provides raw access to the quick pick controller.
         */
        createQuickPick<T extends IQuickPickItem>(): IQuickPick<T>;
        /**
         * Provides raw access to the quick input controller.
         */
        createInputBox(): IInputBox;
        /**
         * Moves focus into quick input.
         */
        focus?(): void;
        /**
         * Toggle the checked state of the selected item.
         */
        toggle?(): void;
        /**
         * Navigate inside the opened quick input list.
         */
        navigate?(next: boolean, quickNavigate?: IQuickNavigateConfiguration): void;
        /**
         * Navigate back in a multi-step quick input.
         */
        back?(): Promise<void>;
        /**
         * Accept the selected item.
         *
         * @param keyMods allows to override the state of key
         * modifiers that should be present when invoking.
         */
        accept?(keyMods?: IKeyMods): Promise<void>;
        /**
         * Cancels quick input and closes it.
         */
        cancel?(): Promise<void>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/common/quickInput.ts#L55
    export interface IQuickNavigateConfiguration {
        keybindings: monaco.keybindings.ResolvedKeybinding[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/common/quickInput.ts#L186
    export enum ItemActivation {
        NONE,
        FIRST,
        SECOND,
        LAST
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/common/quickInput.ts#L151
    export interface IQuickInput extends Disposable {
        readonly onDidHide: Event<void>;
        readonly onDispose: Event<void>;
        title: string | undefined;
        description: string | undefined;
        step: number | undefined;
        totalSteps: number | undefined;
        enabled: boolean;
        contextKey: string | undefined;
        busy: boolean;
        ignoreFocusOut: boolean;
        show(): void;
        hide(): void;
        dispose(): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.ts
    export class StandaloneGotoLineQuickAccessProvider {
        constructor(private readonly editorService: ICodeEditorService);
        provide(picker: monaco.quickInput.IQuickPick<monaco.quickInput.IQuickPickItem>, token: CancellationToken): IDisposable;
        protected get activeTextEditorControl(): IEditor | undefined;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/standalone/browser/quickAccess/standaloneGotoSymbolQuickAccess.ts
    export class StandaloneGotoSymbolQuickAccessProvider {
        constructor(private readonly editorService: ICodeEditorService);
        provide(picker: monaco.quickInput.IQuickPick<monaco.quickInput.IQuickPickItem>, token: CancellationToken): IDisposable;
        protected get activeTextEditorControl(): IEditor | undefined;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/browser/quickInput.ts#L1112
    export class QuickInputController implements IDisposable {
        constructor(private options: IQuickInputOptions);
        readonly backButton: IQuickInputButton;
        readonly onShow: Event<void>;
        readonly onHide: Event<void>;
        pick<T extends IQuickPickItem, O extends IPickOptions<T>>(picks: Promise<QuickPickValue<T>[]> | QuickPickValue<T>[],
            options: O = <O>{},
            token: CancellationToken = CancellationToken.None): Promise<(O extends { canPickMany: true } ? T[] : T) | undefined>;
        input(options: IInputOptions = {}, token: CancellationToken = CancellationToken.None): Promise<string | undefined>;

        createQuickPick<T extends IQuickPickItem>(): IQuickPick<T>;
        createInputBox(): IInputBox;

        hide(): void;
        focus(): void;
        toggle(): void;
        navigate(next: boolean, quickNavigate?: IQuickNavigateConfiguration): void;
        async accept(keyMods: IKeyMods = { alt: false, ctrlCmd: false }): Promise<void>;
        async back(): Promise<void>;
        async cancel(): Promise<void>;
        layout(dimension: monaco.editor.IDimension, titleBarOffset: number): void;
        applyStyles(styles: IQuickInputStyles): void;
        dispose(): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/browser/quickInput.ts#L35
    export interface IQuickInputOptions {
        idPrefix: string;
        container: HTMLElement;
        ignoreFocusOut?(): boolean;
        isScreenReaderOptimized?(): boolean;
        backKeybindingLabel?(): string | undefined;
        setContextKey?(id?: string): void;
        returnFocus?(): void;
        createList?<T>(
            user: string,
            container: HTMLElement,
            delegate: monaco.list.IListVirtualDelegate<T>,
            renderers: monaco.list.IListRenderer<T, any>[],
            options: monaco.list.IListOptions<T>,
        ): QuickInputItemList<T>;
        styles?: IQuickInputStyles;
    }

    export class QuickInputOptions implements monaco.quickInput.IQuickInputOptions {
        idPrefix: string;
        container: HTMLElement;
        styles?: IQuickInputStyles;
        ignoreFocusOut: monaco.quickInput.IQuickInputOptions['ignoreFocusOut'];
        isScreenReaderOptimized: monaco.quickInput.IQuickInputOptions['isScreenReaderOptimized'];
        backKeybindingLabel: monaco.quickInput.IQuickInputOptions['backKeybindingLabel'];
        setContextKey: monaco.quickInput.IQuickInputOptions['setContextKey'];
        returnFocus: monaco.quickInput.IQuickInputOptions['returnFocus'];
        createList: monaco.quickInput.IQuickInputOptions['createList'];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/browser/quickInput.ts#L53
    export interface IQuickInputStyles {
        widget: IQuickInputWidgetStyles;
        inputBox: IInputBoxStyles;
        countBadge: ICountBadgeStyles;
        button: IButtonStyles;
        progressBar: IProgressBarStyles;
        list: monaco.list.IListStyles & { pickerGroupBorder?: monaco.color.Color; pickerGroupForeground?: monaco.color.Color; };
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/browser/quickInput.ts#L62
    export interface IQuickInputWidgetStyles {
        quickInputBackground?: monaco.color.Color;
        quickInputForeground?: monaco.color.Color;
        quickInputTitleBackground?: monaco.color.Color;
        contrastBorder?: monaco.color.Color;
        widgetShadow?: monaco.color.Color;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/common/quickInput.ts#L14
    export interface IQuickPickItemHighlights {
        label?: monaco.filters.IMatch[];
        description?: monaco.filters.IMatch[];
        detail?: monaco.filters.IMatch[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/quickinput/browser/helpQuickAccess.ts#L12
    interface IHelpQuickAccessPickItem extends monaco.quickInput.IAnythingQuickPickItem {
        prefix: string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/common/quickInput.ts#L333
    export type IQuickPickItemWithResource = IQuickPickItem & { resource?: URI };

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/workbench/contrib/search/browser/anythingQuickAccess.ts#L55
    export interface IAnythingQuickPickItem extends IPickerQuickAccessItem, IQuickPickItemWithResource { }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/common/quickInput.ts#L20
    export interface IQuickPickItem {
        type?: 'item' | 'separator';
        id?: string;
        label: string;
        meta?: string;
        ariaLabel?: string;
        description?: string;
        detail?: string;
        /**
         * Allows to show a keybinding next to the item to indicate
         * how the item can be triggered outside of the picker using
         * keyboard shortcut.
         */
        keybinding?: monaco.keybindings.ResolvedKeybinding;
        iconClasses?: string[];
        italic?: boolean;
        strikethrough?: boolean;
        highlights?: IQuickPickItemHighlights;
        buttons?: IQuickInputButton[];
        picked?: boolean;
        alwaysShow?: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/common/quickInput.ts#L306
    export interface IQuickInputButton {
        /** iconPath or iconClass required */
        iconPath?: URI | { light: URI; dark: URI } | { id: string }; // { dark: URI; light: URI; };
        /** iconPath or iconClass required */
        iconClass?: string;
        tooltip?: string;
        /**
         * Whether to always show the button. By default buttons
         * are only visible when hovering over them with the mouse
         */
        alwaysVisible?: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/common/quickInput.ts#L43
    export interface IQuickPickSeparator {
        type: 'separator';
        label?: string;
    }

    export type QuickPickValue<T = IQuickPickItem> = T | IQuickPickSeparator;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/common/quickInput.ts#L48
    export interface IKeyMods {
        readonly ctrlCmd: boolean;
        readonly alt: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/common/quickInput.ts#L55
    export interface IQuickNavigateConfiguration {
        keybindings: monaco.keybindings.ResolvedKeybinding[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/common/quickInput.ts#L193
    export interface IQuickPick<T extends IQuickPickItem> extends IQuickInput {
        value: string;
        /**
         * A method that allows to massage the value used
         * for filtering, e.g, to remove certain parts.
         */
        filterValue: (value: string) => string;
        ariaLabel: string | undefined;
        placeholder: string | undefined;
        readonly onDidChangeValue: Event<string>;
        readonly onDidAccept: Event<IQuickPickAcceptEvent>;
        /**
         * If enabled, will fire the `onDidAccept` event when
         * pressing the arrow-right key with the idea of accepting
         * the selected item without closing the picker.
         */
        canAcceptInBackground: boolean;
        ok: boolean | 'default';
        readonly onDidCustom: Event<void>;
        customButton: boolean;
        customLabel: string | undefined;
        customHover: string | undefined;
        buttons: ReadonlyArray<IQuickInputButton>;
        readonly onDidTriggerButton: Event<IQuickInputButton>;
        readonly onDidTriggerItemButton: Event<IQuickPickItemButtonEvent<T>>;
        items: ReadonlyArray<T | IQuickPickSeparator>;
        canSelectMany: boolean;
        matchOnDescription: boolean;
        matchOnDetail: boolean;
        matchOnLabel: boolean;
        sortByLabel: boolean;
        autoFocusOnList: boolean;
        quickNavigate: IQuickNavigateConfiguration | undefined;
        activeItems: ReadonlyArray<T>;
        readonly onDidChangeActive: Event<T[]>;
        /**
         * Allows to control which entry should be activated by default.
         */
        itemActivation: ItemActivation;
        selectedItems: ReadonlyArray<T>;
        readonly onDidChangeSelection: Event<T[]>;
        readonly keyMods: IKeyMods;
        valueSelection: Readonly<[number, number]> | undefined;
        validationMessage: string | undefined;
        inputHasFocus(): boolean;
        focusOnInput(): void;
        /**
         * Hides the input box from the picker UI. This is typically used
         * in combination with quick-navigation where no search UI should
         * be presented.
         */
        hideInput: boolean;
        hideCheckAll: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/common/quickInput.ts#L283
    export interface IInputBox extends IQuickInput {
        value: string;
        valueSelection: Readonly<[number, number]> | undefined;
        placeholder: string | undefined;
        password: boolean;
        readonly onDidChangeValue: Event<string>;
        readonly onDidAccept: Event<void>;
        buttons: ReadonlyArray<IQuickInputButton>;
        readonly onDidTriggerButton: Event<IQuickInputButton>;
        prompt: string | undefined;
        validationMessage: string | undefined;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/common/quickInput.ts#L116
    export interface IInputOptions {
        /**
         * the value to prefill in the input box
         */
        value?: string;
        /**
         * the selection of value, default to the whole word
         */
        valueSelection?: [number, number];
        /**
         * the text to display underneath the input box
         */
        prompt?: string;
        /**
         * an optional string to show as placeholder in the input box to guide the user what to type
         */
        placeHolder?: string;
        /**
         * Controls if a password input is shown. Password input hides the typed text.
         */
        password?: boolean;

        ignoreFocusLost?: boolean;
        /**
         * an optional function that is used to validate user input.
         */
        validateInput?: (input: string) => Promise<string | null | undefined>;
    }
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/browser/ui/inputbox/inputBox.ts#L39
    export interface IInputBoxStyles {
        readonly inputBackground?: monaco.color.Color;
        readonly inputForeground?: monaco.color.Color;
        readonly inputBorder?: monaco.color.Color;
        readonly inputValidationInfoBorder?: monaco.color.Color;
        readonly inputValidationInfoBackground?: monaco.color.Color;
        readonly inputValidationInfoForeground?: monaco.color.Color;
        readonly inputValidationWarningBorder?: monaco.color.Color;
        readonly inputValidationWarningBackground?: monaco.color.Color;
        readonly inputValidationWarningForeground?: monaco.color.Color;
        readonly inputValidationErrorBorder?: monaco.color.Color;
        readonly inputValidationErrorBackground?: monaco.color.Color;
        readonly inputValidationErrorForeground?: monaco.color.Color;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/browser/ui/countBadge/countBadge.ts#L19
    export interface ICountBadgeStyles {
        badgeBackground?: monaco.color.Color;
        badgeForeground?: monaco.color.Color;
        badgeBorder?: monaco.color.Color;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/browser/ui/button/button.ts#L26
    export interface IButtonStyles {
        buttonBackground?: monaco.color.Color;
        buttonHoverBackground?: monaco.color.Color;
        buttonForeground?: monaco.color.Color;
        buttonSecondaryBackground?: monaco.color.Color;
        buttonSecondaryHoverBackground?: monaco.color.Color;
        buttonSecondaryForeground?: monaco.color.Color;
        buttonBorder?: monaco.color.Color;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/browser/ui/progressbar/progressbar.ts#L22
    export interface IProgressBarStyles {
        progressBarBackground?: monaco.color.Color;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/common/quickInput.ts#L59
    export interface IPickOptions<T extends IQuickPickItem> {
        /**
         * an optional string to show as placeholder in the input box to guide the user what she picks on
         */
        placeHolder?: string;
        /**
         * an optional flag to include the description when filtering the picks
         */
        matchOnDescription?: boolean;
        /**
         * an optional flag to include the detail when filtering the picks
         */
        matchOnDetail?: boolean;
        /**
         * an optional flag to filter the picks based on label. Defaults to true.
         */
        matchOnLabel?: boolean;
        /**
         * an option flag to control whether focus is always automatically brought to a list item. Defaults to true.
         */
        autoFocusOnList?: boolean;
        /**
         * an optional flag to not close the picker on focus lost
         */
        ignoreFocusLost?: boolean;
        /**
         * an optional flag to make this picker multi-select
         */
        canPickMany?: boolean;
        /**
         * enables quick navigate in the picker to open an element without typing
         */
        quickNavigate?: IQuickNavigateConfiguration;
        /**
         * a context key to set when this picker is active
         */
        contextKey?: string;
        /**
         * an optional property for the item to focus initially.
         */
        activeItem?: Promise<T> | T;
        onKeyMods?: (keyMods: IKeyMods) => void;
        onDidFocus?: (entry: T) => void;
        onDidTriggerItemButton?: (context: IQuickPickItemButtonContext<T>) => void;
    }

    export type Pick<T> = T | IQuickPickSeparator;
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    export type PicksWithActive<T> = { items: Array<Pick<T>>, active?: T };
    export type Picks<T> = Array<Pick<T>> | PicksWithActive<T>;
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    export type FastAndSlowPicks<T> = { picks: Picks<T>, additionalPicks: Promise<Picks<T>> };

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/quickinput/browser/pickerQuickAccess.ts#L92
    export class PickerQuickAccessProvider<T extends IPickerQuickAccessItem> extends Disposable implements IQuickAccessProvider {
        constructor(prefix: string, options?: IPickerQuickAccessProviderOptions<T>);

        provide(picker: IQuickPick<T>, token: CancellationToken): IDisposable;
        protected getPicks(filter: string, disposables: any, token: CancellationToken): Picks<T> | Promise<Picks<T>> | FastAndSlowPicks<T> | null;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/quickinput/browser/pickerQuickAccess.ts#L62
    export interface IPickerQuickAccessProviderOptions<T extends IPickerQuickAccessItem> {
        /**
         * Enables support for opening picks in the background via gesture.
         */
        canAcceptInBackground?: boolean;

        /**
         * Enables to show a pick entry when no results are returned from a search.
         */
        noResultsPick?: T;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/quickinput/browser/pickerQuickAccess.ts#L36
    export interface IPickerQuickAccessItem extends IQuickPickItem {
        /**
         * A method that will be executed when the pick item is accepted from
         * the picker. The picker will close automatically before running this.
         *
         * @param keyMods the state of modifier keys when the item was accepted.
         * @param event the underlying event that caused the accept to trigger.
         */
        accept?(keyMods?: IKeyMods, event?: IQuickPickAcceptEvent): void;

        /**
         * A method that will be executed when a button of the pick item was
         * clicked on.
         *
         * @param buttonIndex index of the button of the item that
         * was clicked.
         *
         * @param keyMods the state of modifier keys when the button was triggered.
         *
         * @returns a value that indicates what should happen after the trigger
         * which can be a `Promise` for long running operations.
         */
        trigger?(buttonIndex: number, keyMods: IKeyMods): TriggerAction | Promise<TriggerAction>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/common/quickInput.ts#L177
    export interface IQuickPickAcceptEvent {
        /**
         * Signals if the picker item is to be accepted
         * in the background while keeping the picker open.
         */
        inBackground: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/quickinput/common/quickAccess.ts#L41
    export enum DefaultQuickAccessFilterValue {
        /**
         * Keep the value as it is given to quick access.
         */
        PRESERVE = 0,

        /**
         * Use the value that was used last time something was accepted from the picker.
         */
        LAST = 1
    }
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/quickinput/browser/pickerQuickAccess.ts#L13
    export enum TriggerAction {
        /**
         * Do nothing after the button was clicked.
         */
        NO_ACTION,

        /**
         * Close the picker.
         */
        CLOSE_PICKER,

        /**
         * Update the results of the picker.
         */
        REFRESH_PICKER,

        /**
         * Remove the item from the picker.
         */
        REMOVE_ITEM
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/quickinput/common/quickAccess.ts#L54
    export interface IQuickAccessProvider {
        /**
         * Allows to set a default filter value when the provider opens. This can be:
         * - `undefined` to not specify any default value
         * - `DefaultFilterValues.PRESERVE` to use the value that was last typed
         * - `string` for the actual value to use
         *
         * Note: the default filter will only be used if quick access was opened with
         * the exact prefix of the provider. Otherwise the filter value is preserved.
         */
        readonly defaultFilterValue?: string | DefaultQuickAccessFilterValue;

        /**
         * Called whenever a prefix was typed into quick pick that matches the provider.
         *
         * @param picker the picker to use for showing provider results. The picker is
         * automatically shown after the method returns, no need to call `show()`.
         * @param token providers have to check the cancellation token everytime after
         * a long running operation or from event handlers because it could be that the
         * picker has been closed or changed meanwhile. The token can be used to find out
         * that the picker was closed without picking an entry (e.g. was canceled by the user).
         * @return a disposable that will automatically be disposed when the picker
         * closes or is replaced by another picker.
         */
        provide(picker: monaco.quickInput.IQuickPick<monaco.quickInput.IQuickPickItem>, token: CancellationToken): IDisposable;
    }

    export interface IQuickAccessProviderHelp {

        /**
         * The prefix to show for the help entry. If not provided,
         * the prefix used for registration will be taken.
         */
        prefix?: string;

        /**
         * A description text to help understand the intent of the provider.
         */
        description: string;

        /**
         * Separation between provider for editors and global ones.
         */
        needsEditor: boolean;
    }
    export interface IQuickAccessProviderDescriptor {
        /**
         * The actual provider that will be instantiated as needed.
         */
        readonly ctor: { new(...services: any /* TS BrandedService but no clue how to type this properly */[]): IQuickAccessProvider };

        /**
         * The prefix for quick access picker to use the provider for.
         */
        readonly prefix: string;

        /**
         * A placeholder to use for the input field when the provider is active.
         * This will also be read out by screen readers and thus helps for
         * accessibility.
         */
        readonly placeholder?: string;

        /**
         * Documentation for the provider in the quick access help.
         */
        readonly helpEntries: IQuickAccessProviderHelp[];

        /**
         * A context key that will be set automatically when the
         * picker for the provider is showing.
         */
        readonly contextKey?: string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/quickinput/common/quickAccess.ts#L136
    export interface IQuickAccessRegistry {
        /**
         * Registers a quick access provider to the platform.
         */
        registerQuickAccessProvider(provider: IQuickAccessProviderDescriptor): IDisposable;

        /**
         * Get all registered quick access providers.
         */
        getQuickAccessProviders(): IQuickAccessProviderDescriptor[];

        /**
         * Get a specific quick access provider for a given prefix.
         */
        getQuickAccessProvider(prefix: string): IQuickAccessProviderDescriptor | undefined;

        /**
         * Clear all existing quick access providers
         */
        clear(): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/quickinput/common/quickAccess.ts#L154
    export class QuickAccessRegistry implements IQuickAccessRegistry {
        registerQuickAccessProvider(provider: IQuickAccessProviderDescriptor): IDisposable;
        getQuickAccessProviders(): IQuickAccessProviderDescriptor[];
        getQuickAccessProvider(prefix: string): IQuickAccessProviderDescriptor | undefined;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/quickinput/common/quickAccess.ts#L33
    export interface IQuickAccessController {
        /**
         * Open the quick access picker with the optional value prefilled.
         */
        show(value?: string, options?: IQuickAccessOptions): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/quickinput/common/quickAccess.ts#L13
    export interface IQuickAccessOptions {
        /**
         * Allows to enable quick navigate support in quick input.
         */
        quickNavigateConfiguration?: IQuickNavigateConfiguration;

        /**
         * Allows to configure a different item activation strategy.
         * By default the first item in the list will get activated.
         */
        itemActivation?: ItemActivation;

        /**
         * Whether to take the input value as is and not restore it
         * from any existing value if quick access is visible.
         */
        preserveValue?: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/quickinput/browser/quickAccess.ts#L14
    export class QuickAccessController extends Disposable implements IQuickAccessController {
        constructor(quickInputService: monaco.quickInput.IQuickInputService,
            instantiationService: monaco.instantiation.IInstantiationService
        ) {
        }
        show(value?: string, options?: IQuickAccessOptions): void { }
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/parts/quickinput/common/quickInput.ts#L319
    export interface IQuickPickItemButtonEvent<T extends IQuickPickItem> {
        button: IQuickInputButton;
        item: T;
    }
}

declare module monaco.quickOpen {
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/browser/ui/inputbox/inputBox.ts#L58
    export interface IMessage {
        content: string;
        formatContent?: boolean; // defaults to false
        type?: 1 /* INFO */ | 2  /* WARNING */ | 3 /* ERROR */;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/browser/ui/inputbox/inputBox.ts#L90
    export class InputBox {
        inputElement: HTMLInputElement;
        setPlaceHolder(placeHolder: string): void;
        showMessage(message: IMessage, force?: boolean): void;
        hideMessage(): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/browser/ui/iconLabel/iconLabel.ts#L34
    export interface IIconLabelValueOptions {
        title?: string;
        descriptionTitle?: string;
        hideIcon?: boolean;
        extraClasses?: string[];
        italic?: boolean;
        matches?: monaco.filters.IMatch[];
        labelEscapeNewLines?: boolean;
        descriptionMatches?: monaco.filters.IMatch[];
        readonly separator?: string;
        readonly domId?: string;
    }
}

declare module monaco.filters {
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/filters.ts#L15
    export interface IMatch {
        start: number;
        end: number;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/filters.ts#L337
    export function matchesFuzzy(word: string, wordToMatchAgainst: string, enableSeparateSubstringMatching?: boolean): IMatch[] | undefined;
}

declare module monaco.editorExtensions {

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/editorExtensions.ts#L215
    export abstract class EditorCommand {
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/editorExtensions.ts#L279
    export abstract class EditorAction extends EditorCommand {
        id: string;
        label: string;
    }

    export module EditorExtensionsRegistry {
        // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/editorExtensions.ts#L497
        export function getEditorActions(): EditorAction[];

        // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/browser/editorExtensions.ts#L493
        export function getEditorCommand(commandId: string): EditorCommand | undefined;
    }
}
declare module monaco.modes {

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/modes.ts#L209
    export interface ITokenizationSupport {
        tokenize(line: string, state: monaco.languages.IState, offsetDelta: number): any;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/modes.ts#L1927
    export interface TokenizationRegistry {
        get(language: string): ITokenizationSupport | null;
        getColorMap(): monaco.color.Color[] | null;
        readonly onDidChange: monaco.IEvent<any>;
    }
    export const TokenizationRegistry: TokenizationRegistry;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/modes.ts#L70
    export const enum FontStyle {
        NotSet = -1,
        None = 0,
        Italic = 1,
        Bold = 2,
        Underline = 4
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/modes.ts#L148
    export class TokenMetadata {

        public static getLanguageId(metadata: number): number;

        public static getFontStyle(metadata: number): number;

        public static getForeground(metadata: number): number;

        public static getBackground(metadata: number): number;

        public static getClassNameFromMetadata(metadata: number): string;

        public static getInlineStyleFromMetadata(metadata: number, colorMap: string[]): string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/glob.ts#L17
    export interface IRelativePattern {
        base: string;
        pattern: string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/modes/languageSelector.ts#L10
    export interface LanguageFilter {
        language?: string;
        scheme?: string;
        pattern?: string | IRelativePattern;
        /**
         * This provider is implemented in the UI thread.
         */
        hasAccessToAllModels?: boolean;
        exclusive?: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/modes/languageSelector.ts#L21
    export type LanguageSelector = string | LanguageFilter | Array<string | LanguageFilter>;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/modes/languageFeatureRegistry.ts#L32
    export interface LanguageFeatureRegistry<T> {
        has(model: monaco.editor.ITextModel): boolean;
        all(model: monaco.editor.ITextModel): T[];
        register(selector: LanguageSelector, provider: T): IDisposable;
        readonly onDidChange: monaco.IEvent<number>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/modes.ts#L1824
    export const DocumentSymbolProviderRegistry: LanguageFeatureRegistry<monaco.languages.DocumentSymbolProvider>;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/modes.ts#L1799
    export const CompletionProviderRegistry: LanguageFeatureRegistry<monaco.languages.CompletionItemProvider>;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/modes.ts#L1869
    export const CodeActionProviderRegistry: LanguageFeatureRegistry<monaco.languages.CodeActionProvider & { providedCodeActionKinds?: string[] }>;
}

declare module monaco.suggest {

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/suggest/suggest.ts#L145
    export const enum SnippetSortOrder {
        Top, Inline, Bottom
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/suggest/suggestController.ts#L99
    export interface SuggestController {
        readonly widget: monaco.async.IdleValue<SuggestWidget>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/suggest/suggestWidget.ts#L635
    export interface SuggestWidget {
        getFocusedItem(): ISelectedSuggestion | undefined;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/suggest/suggestWidget.ts#L55
    export interface ISelectedSuggestion {
        item: CompletionItem;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/suggest/suggest.ts#L38
    export interface CompletionItem {
        completion: monaco.languages.CompletionItem;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/suggest/suggest.ts#L149
    export class CompletionOptions {

        constructor(
            snippetSortOrder?: SnippetSortOrder,
            kindFilter?: Set<languages.CompletionItemKind>,
            providerFilter?: Set<languages.CompletionItemProvider>,
        );

    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/suggest/suggest.ts#L192
    export function provideSuggestionItems(
        model: monaco.editor.ITextModel,
        position: Position,
        options?: CompletionOptions,
        context?: monaco.languages.CompletionContext,
        token?: monaco.CancellationToken
    ): Promise<CompletionItem[]>;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/suggest/suggest.ts#L166
    export function setSnippetSuggestSupport(support: monaco.languages.CompletionItemProvider): monaco.languages.CompletionItemProvider;
}

declare module monaco.snippetParser {
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/contrib/snippet/snippetParser.ts#L583
    export class SnippetParser {
        parse(value: string): TextmateSnippet;
    }
    export class TextmateSnippet {
    }
}

declare module monaco.contextKeyService {

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/contextkey/common/contextkey.ts#L1313
    export interface IContextKey<T> {
        set(value: T): void;
        reset(): void;
        get(): T | undefined;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/contextkey/common/contextkey.ts#L1337
    export interface IContextKeyService {
        // vs code has another object as argument https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/contextkey/common/contextkey.ts#L1348
        // which contains restricted number of HTMLElement methods
        onDidChangeContext: monaco.IEvent<IContextKeyChangeEvent>;
        bufferChangeEvents(callback: Function): void;

        createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T>;
        contextMatchesRules(rules: monaco.contextkey.ContextKeyExpression | undefined): boolean;
        getContextKeyValue<T>(key: string): T | undefined;

        createScoped(target?: HTMLElement): IContextKeyService;
        createOverlay(overlay: Iterable<[string, any]>): IContextKeyService;
        getContext(target?: HTMLElement): IContext;

        updateParent(parentContextKeyService: IContextKeyService): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/contextkey/common/contextkey.ts#L1309
    export interface IContext {
        getValue<T>(key: string): T | undefined;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/contextkey/common/contextkey.ts#L1333
    export interface IContextKeyChangeEvent {
        affectsSome(keys: Set<string>): boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/contextkey/browser/contextKeyService.ts#L352
    export class ContextKeyService implements IContextKeyService {
        constructor(configurationService: monaco.services.IConfigurationService);
        onDidChangeContext: monaco.IEvent<IContextKeyChangeEvent>;
        bufferChangeEvents(callback: Function): void;

        createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T>;
        contextMatchesRules(rules: monaco.contextkey.ContextKeyExpression | undefined): boolean;
        getContextKeyValue<T>(key: string): T | undefined;

        createScoped(target?: HTMLElement): IContextKeyService;
        createOverlay(overlay: Iterable<[string, any]>): IContextKeyService;
        getContext(target?: HTMLElement): IContext;

        updateParent(parentContextKeyService: IContextKeyService): void;
    }
}

declare module monaco.contextkey {
    export const enum ContextKeyExprType {
        False = 0,
        True = 1,
        Defined = 2,
        Not = 3,
        Equals = 4,
        NotEquals = 5,
        And = 6,
        Regex = 7,
        NotRegex = 8,
        Or = 9,
        In = 10,
        NotIn = 11,
        Greater = 12,
        GreaterEquals = 13,
        Smaller = 14,
        SmallerEquals = 15,
    }

    export class ContextKeyFalseExpr extends ContextKeyExpr { }
    export class ContextKeyTrueExpr extends ContextKeyExpr { }
    export class ContextKeyDefinedExpr extends ContextKeyExpr {
        static create(key: string): ContextKeyExpression;
    }
    export class ContextKeyNotExpr extends ContextKeyExpr {
        static create(key: string): ContextKeyExpression;
    }
    export class ContextKeyEqualsExpr extends ContextKeyExpr {
        static create(key: string, value: any): ContextKeyExpression;
    }
    export class ContextKeyNotEqualsExpr extends ContextKeyExpr {
        static create(key: string, value: any): ContextKeyExpression
    }
    export class ContextKeyRegexExpr extends ContextKeyExpr {
        static create(key: string, regexp: RegExp | null): ContextKeyRegexExpr;
    }
    export class ContextKeyNotRegexExpr extends ContextKeyExpr {
        static create(actual: ContextKeyRegexExpr): ContextKeyExpression;
    }
    export class ContextKeyAndExpr extends ContextKeyExpr {
        static create(_expr: ReadonlyArray<ContextKeyExpression | null | undefined>): ContextKeyExpression | undefined;
    }
    export class ContextKeyOrExpr extends ContextKeyExpr {
        static create(_expr: ReadonlyArray<ContextKeyExpression | null | undefined>): ContextKeyExpression | undefined;
    }
    export class ContextKeyInExpr extends ContextKeyExpr {
        static create(key: string, valueKey: string): ContextKeyInExpr
    }
    export class ContextKeyNotInExpr extends ContextKeyExpr {
        static create(actual: ContextKeyInExpr): ContextKeyNotInExpr;
    }
    export class ContextKeyGreaterExpr extends ContextKeyExpr {
        static create(key: string, value: any): ContextKeyExpression;
    }
    export class ContextKeyGreaterEqualsExpr extends ContextKeyExpr {
        static create(key: string, value: any): ContextKeyExpression
    }
    export class ContextKeySmallerExpr extends ContextKeyExpr {
        static create(key: string, value: any): ContextKeyExpression
    }
    export class ContextKeySmallerEqualsExpr extends ContextKeyExpr {
        static create(key: string, value: any): ContextKeyExpression
    }

    export type ContextKeyExpression = (
        ContextKeyFalseExpr | ContextKeyTrueExpr | ContextKeyDefinedExpr | ContextKeyNotExpr
        | ContextKeyEqualsExpr | ContextKeyNotEqualsExpr | ContextKeyRegexExpr
        | ContextKeyNotRegexExpr | ContextKeyAndExpr | ContextKeyOrExpr | ContextKeyInExpr
        | ContextKeyNotInExpr | ContextKeyGreaterExpr | ContextKeyGreaterEqualsExpr
        | ContextKeySmallerExpr | ContextKeySmallerEqualsExpr
    );

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/contextkey/common/contextkey.ts#L1327
    export const IContextKeyService: any;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/platform/contextkey/common/contextkey.ts#L79
    export class ContextKeyExpr {
        keys(): string[];
        static deserialize(serialized: string | null | undefined, strict: boolean = false): ContextKeyExpression | undefined;
        serialize(): string;
    }
}

declare module monaco.mime {

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/mime.ts#L17
    export interface ITextMimeAssociation {
        readonly id: string;
        readonly mime: string;
        readonly filename?: string;
        readonly extension?: string;
        readonly filepattern?: string;
        readonly firstline?: RegExp;
        readonly userConfigured?: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/mime.ts#L41
    export function registerTextMime(association: monaco.mime.ITextMimeAssociation, warnOnOverwrite: boolean): void;

    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/mime.ts#L97
    export function clearTextMimes(onlyUserConfigured?: boolean): void;
}

declare module monaco.error {
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/errors.ts#L79
    export function onUnexpectedError(e: any): undefined;
}

declare module monaco.path {
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/path.ts#L1494
    export function normalize(uriPath: string): string;
}

declare module monaco.wordHelper {
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/common/model/wordHelper.ts#L30
    export const DEFAULT_WORD_REGEXP: RegExp;
}

declare module monaco.strings {
    // https://github.com/theia-ide/vscode/blob/standalone/0.19.x/src/vs/base/common/strings.ts#L384
    export function startsWith(haystack: string, needle: string): boolean;

    // https://github.com/theia-ide/vscode/blob/standalone/0.19.x/src/vs/base/common/strings.ts#L171
    export function endsWith(haystack: string, needle: string): boolean;
}

declare module monaco.async {
    // https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/base/common/async.ts#L842-L878
    export class IdleValue<T> {
        constructor(executor: () => T) { }
        get value(): T;
    }
}

/**
 * overloading languages register functions to accept LanguageSelector,
 * check that all register functions passing a selector to registries:
 * https://github.com/theia-ide/vscode/blob/standalone/0.23.x/src/vs/editor/standalone/browser/standaloneLanguages.ts#L368-L546
 */
declare module monaco.languages {
    export function registerReferenceProvider(selector: monaco.modes.LanguageSelector, provider: ReferenceProvider): IDisposable;
    export function registerRenameProvider(selector: monaco.modes.LanguageSelector, provider: RenameProvider): IDisposable;
    export function registerSignatureHelpProvider(selector: monaco.modes.LanguageSelector, provider: SignatureHelpProvider): IDisposable;
    export function registerHoverProvider(selector: monaco.modes.LanguageSelector, provider: HoverProvider): IDisposable;
    export function registerDocumentSymbolProvider(selector: monaco.modes.LanguageSelector, provider: DocumentSymbolProvider): IDisposable;
    export function registerDocumentHighlightProvider(selector: monaco.modes.LanguageSelector, provider: DocumentHighlightProvider): IDisposable;
    export function registerDefinitionProvider(selector: monaco.modes.LanguageSelector, provider: DefinitionProvider): IDisposable;
    export function registerImplementationProvider(selector: monaco.modes.LanguageSelector, provider: ImplementationProvider): IDisposable;
    export function registerTypeDefinitionProvider(selector: monaco.modes.LanguageSelector, provider: TypeDefinitionProvider): IDisposable;
    export function registerCodeLensProvider(selector: monaco.modes.LanguageSelector, provider: CodeLensProvider): IDisposable;
    export function registerCodeActionProvider(selector: monaco.modes.LanguageSelector, provider: CodeActionProvider): IDisposable;
    export function registerDocumentFormattingEditProvider(selector: monaco.modes.LanguageSelector, provider: DocumentFormattingEditProvider): IDisposable;
    export function registerDocumentRangeFormattingEditProvider(selector: monaco.modes.LanguageSelector, provider: DocumentRangeFormattingEditProvider): IDisposable;
    export function registerOnTypeFormattingEditProvider(selector: monaco.modes.LanguageSelector, provider: OnTypeFormattingEditProvider): IDisposable;
    export function registerLinkProvider(selector: monaco.modes.LanguageSelector, provider: LinkProvider): IDisposable;
    export function registerCompletionItemProvider(selector: monaco.modes.LanguageSelector, provider: CompletionItemProvider): IDisposable;
    export function registerColorProvider(selector: monaco.modes.LanguageSelector, provider: DocumentColorProvider): IDisposable;
    export function registerFoldingRangeProvider(selector: monaco.modes.LanguageSelector, provider: FoldingRangeProvider): IDisposable;
    export function registerDeclarationProvider(selector: monaco.modes.LanguageSelector, provider: DeclarationProvider): IDisposable;
    export function registerSelectionRangeProvider(selector: monaco.modes.LanguageSelector, provider: SelectionRangeProvider): IDisposable;
    export function registerDocumentSemanticTokensProvider(selector: monaco.modes.LanguageSelector, provider: DocumentSemanticTokensProvider): IDisposable;
    export function registerDocumentRangeSemanticTokensProvider(selector: monaco.modes.LanguageSelector, provider: DocumentRangeSemanticTokensProvider): IDisposable;
}

declare module monaco.list {
    export class List<T> extends Disposable {
        constructor(
            private user: string,
            container: HTMLElement,
            virtualDelegate: IListVirtualDelegate<T>,
            renderers: IListRenderer<any /* TODO@joao */, any>[],
            private _options: IListOptions<T> = DefaultOptions
        )

        focusNth(n: number, browserEvent?: UIEvent, filter?: (element: T) => boolean): void;
    }

    export interface IListStyles {
        listBackground?: monaco.color.Color;
        listFocusBackground?: monaco.color.Color;
        listFocusForeground?: monaco.color.Color;
        listActiveSelectionBackground?: monaco.color.Color;
        listActiveSelectionForeground?: monaco.color.Color;
        listFocusAndSelectionBackground?: monaco.color.Color;
        listFocusAndSelectionForeground?: monaco.color.Color;
        listInactiveSelectionBackground?: monaco.color.Color;
        listInactiveSelectionForeground?: monaco.color.Color;
        listInactiveFocusForeground?: monaco.color.Color;
        listInactiveFocusBackground?: monaco.color.Color;
        listHoverBackground?: monaco.color.Color;
        listHoverForeground?: monaco.color.Color;
        listDropBackground?: monaco.color.Color;
        listFocusOutline?: monaco.color.Color;
        listInactiveFocusOutline?: monaco.color.Color;
        listSelectionOutline?: monaco.color.Color;
        listHoverOutline?: monaco.color.Color;
        listFilterWidgetBackground?: monaco.color.Color;
        listFilterWidgetOutline?: monaco.color.Color;
        listFilterWidgetNoMatchesOutline?: monaco.color.Color;
        listMatchesShadow?: monaco.color.Color;
        treeIndentGuidesStroke?: monaco.color.Color;
        tableColumnsBorder?: monaco.color.Color;
    }

    export interface IListOptions<T> {
        readonly identityProvider?: IIdentityProvider<T>;
        readonly dnd?: IListDragAndDrop<T>;
        readonly enableKeyboardNavigation?: boolean;
        readonly automaticKeyboardNavigation?: boolean;
        readonly keyboardNavigationLabelProvider?: IKeyboardNavigationLabelProvider<T>;
        readonly keyboardNavigationDelegate?: IKeyboardNavigationDelegate;
        readonly keyboardSupport?: boolean;
        readonly multipleSelectionSupport?: boolean;
        readonly multipleSelectionController?: IMultipleSelectionController<T>;
        readonly styleController?: (suffix: string) => IStyleController;
        readonly accessibilityProvider?: IListAccessibilityProvider<T>;

        // list view options
        readonly useShadows?: boolean;
        readonly verticalScrollMode?: ScrollbarVisibility;
        readonly setRowLineHeight?: boolean;
        readonly setRowHeight?: boolean;
        readonly supportDynamicHeights?: boolean;
        readonly mouseSupport?: boolean;
        readonly horizontalScrolling?: boolean;
        readonly additionalScrollHeight?: number;
        readonly transformOptimization?: boolean;
        readonly smoothScrolling?: boolean;
        readonly alwaysConsumeMouseWheel?: boolean;
    }

    export interface IListRenderer<T, TTemplateData> {
        readonly templateId: string;
        renderTemplate(container: HTMLElement): TTemplateData;
        renderElement(element: T, index: number, templateData: TTemplateData, height: number | undefined): void;
        disposeElement?(element: T, index: number, templateData: TTemplateData, height: number | undefined): void;
        disposeTemplate(templateData: TTemplateData): void;
    }

    export interface IListVirtualDelegate<T> {
        getHeight(element: T): number;
        getTemplateId(element: T): string;
        hasDynamicHeight?(element: T): boolean;
        setDynamicHeight?(element: T, height: number): void;
    }

    export interface IListElement {
        readonly index: number;
        readonly item: monaco.quickInput.IQuickPickItem;
        readonly saneLabel: string;
        readonly saneMeta?: string;
        readonly saneAriaLabel: string;
        readonly saneDescription?: string;
        readonly saneDetail?: string;
        readonly labelHighlights?: monaco.filters.IMatch[];
        readonly descriptionHighlights?: monaco.filters.IMatch[];
        readonly detailHighlights?: monaco.filters.IMatch[];
        readonly checked: boolean;
        readonly separator?: monaco.quickInput.IQuickPickSeparator;
        readonly fireButtonTriggered: (event: monaco.quickInput.IQuickPickItemButtonEvent<IQuickPickItem>) => void;
    }
}
