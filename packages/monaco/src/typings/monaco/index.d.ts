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
    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/instantiation/common/instantiation.ts#L86
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
    // https://github.com/microsoft/vscode/blob/e683ace9e5acadba0e8bde72d793cb2cb83e58a7/src/vs/editor/common/model/textModel.ts#L58
    export function createTextBufferFactoryFromStream(stream: ITextStream, filter?: (chunk: any) => string, validator?: (chunk: any) => Error | undefined): Promise<monaco.editor.ITextBufferFactory>;
}

declare module monaco.editor {

    // https://github.com/microsoft/vscode/blob/e683ace9e5acadba0e8bde72d793cb2cb83e58a7/src/vs/editor/common/model.ts#L1263
    export interface ITextBufferFactory {
        getFirstLineText(lengthLimit: number): string;
    }

    export interface ICodeEditor {
        protected readonly _instantiationService: monaco.instantiation.IInstantiationService;

        /**
         * @internal
         */
        // https://github.com/theia-ide/vscode/blob/standalone/0.19.x/src/vs/editor/browser/editorBrowser.ts#L644-L647
        setDecorations(decorationTypeKey: string, ranges: editorCommon.IDecorationOptions[]): void;

        /**
         * @internal
         */
        // https://github.com/theia-ide/vscode/blob/standalone/0.19.x/src/vs/editor/browser/editorBrowser.ts#L654-L657
        removeDecorations(decorationTypeKey: string): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/browser/services/bulkEditService.ts#L14
    export interface IBulkEditOptions {
        editor?: ICodeEditor;
        progress?: IProgress<IProgressStep>;
        showPreview?: boolean;
        label?: string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/browser/services/bulkEditService.ts#L21
    export interface IBulkEditResult {
        ariaSummary: string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/browser/services/bulkEditService.ts#L25
    export type IBulkEditPreviewHandler = (edit: monaco.languages.WorkspaceEdit, options?: IBulkEditOptions) => Promise<monaco.languages.WorkspaceEdit>;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/browser/services/bulkEditService.ts#L27
    export interface IBulkEditService {
        apply(edit: monaco.languages.WorkspaceEdit): Promise<IBulkEditResult>;
        hasPreviewHandler(): boolean;
        setPreviewHandler(handler: IBulkEditPreviewHandler): monaco.IDisposable;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/browser/widget/diffNavigator.ts#L43
    export interface IDiffNavigator {
        readonly ranges: IDiffRange[];
        readonly nextIdx: number;
        readonly revealFirst: boolean;
        _initIdx(fwd: boolean): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/browser/widget/diffNavigator.ts#L16
    export interface IDiffRange {
        readonly range: Range;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/standalone/browser/standaloneCodeEditor.ts#L206
    export interface IStandaloneCodeEditor extends CommonCodeEditor {
        setDecorations(decorationTypeKey: string, ranges: IDecorationOptions[]): void;
        setDecorationsFast(decorationTypeKey: string, ranges: IRange[]): void;
        trigger(source: string, handlerId: string, payload: any): void
        _standaloneKeybindingService: {
            _commandService: monaco.services.StandaloneCommandService;
            _store: {
                _toDispose: monaco.IDisposable[]
            }
            resolveKeybinding(keybinding: monaco.keybindings.ChordKeybinding): monaco.keybindings.ResolvedKeybinding[];
            resolveKeyboardEvent(keyboardEvent: monaco.IKeyboardEvent): monaco.keybindings.ResolvedKeybinding;
            addDynamicKeybinding(commandId: string, _keybinding: number, handler: ICommandHandler, when: monaco.contextkey.ContextKeyExpr | undefined): IDisposable;
        }
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/browser/widget/codeEditorWidget.ts#L106
    export interface CommonCodeEditor {
        readonly _commandService: monaco.commands.ICommandService;
        readonly _instantiationService: monaco.instantiation.IInstantiationService;
        readonly _contributions: {
            'editor.controller.quickOpenController': monaco.quickOpen.QuickOpenController
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

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/codeAction/codeActionCommands.ts#L68
    export interface QuickFixController {
        readonly _ui: {
            rawValue?: CodeActionUi
        }
    }
    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/codeAction/codeActionUi.ts#L22
    export interface CodeActionUi {
        readonly _lightBulbWidget: {
            rawValue?: LightBulbWidget
        }
    }
    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/codeAction/lightBulbWidget.ts#L47
    export interface LightBulbWidget {
        readonly _domNode: HTMLDivElement;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/codelens/codelensController.ts#L24
    export interface CodeLensContribution {
        readonly _lenses: CodeLensWidget[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/codelens/codelensWidget.ts#L182
    export interface CodeLensWidget {
        readonly _contentWidget?: CodeLensContentWidget;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/codelens/codelensWidget.ts#L50
    export interface CodeLensContentWidget {
        readonly _domNode: HTMLElement;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/hover/hover.ts#L31
    export interface ModesHoverController {
        readonly contentWidget: ModesContentHoverWidget;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/hover/modesContentHover.ts#L195
    export interface ModesContentHoverWidget {
        readonly isVisible: boolean;
        readonly _domNode: HTMLElement;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/controller/cursor.ts#L169
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
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/editor/common/editor.ts#L63
    export interface IResourceInput {
        resource: monaco.Uri;
        options?: IResourceInputOptions;
    }

    export interface IResourceInputOptions {
        /**
         * Tells the editor to not receive keyboard focus when the editor is being opened. By default,
         * the editor will receive keyboard focus on open.
         */
        // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/editor/common/editor.ts#L132
        readonly preserveFocus?: boolean;

        /**
         * Will reveal the editor if it is already opened and visible in any of the opened editor groups.
         */
        // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/editor/common/editor.ts#L157
        readonly revealIfVisible?: boolean;

        /**
         * Text editor selection.
         */
        // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/editor/common/editor.ts#L223
        readonly selection?: Partial<monaco.IRange>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/browser/services/codeEditorService.ts#L15
    export interface ICodeEditorService {
        getActiveCodeEditor(): monaco.editor.ICodeEditor | undefined;
        openCodeEditor(input: monaco.editor.IResourceInput, source?: monaco.editor.ICodeEditor, sideBySide?: boolean): Promise<monaco.editor.CommonCodeEditor | undefined>;
        registerDecorationType(key: string, options: IDecorationRenderOptions, parentTypeKey?: string, editor?: monaco.editor.ICodeEditor): void;
        removeDecorationType(key: string): void;
        resolveDecorationOptions(typeKey: string, writable: boolean): IModelDecorationOptions;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/lifecycle.ts#L209
    export interface IReference<T> extends monaco.IDisposable {
        readonly object: T;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/services/resolverService.ts#L14
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

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/services/resolverService.ts#L34
    export interface ITextModelContentProvider {
        /**
         * Given a resource, return the content of the resource as IModel.
         */
        provideTextContent(resource: monaco.Uri): Promise<monaco.editor.IModel | null> | null;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/services/resolverService.ts#L42 &&
    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/editor/common/editor.ts#L9
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

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/browser/contextmenu.ts#L25
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

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/actions.ts#L25
    export interface IAction extends IDisposable {
        readonly id: string;
        label: string;
        tooltip: string;
        class: string | undefined;
        enabled: boolean;
        checked: boolean;
        run(event?: any): Promise<any>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/contextview/browser/contextView.ts#L38
    export interface IContextMenuService {
        /**
         * Shows the native Monaco context menu in the editor.
         */
        showContextMenu(delegate: IContextMenuDelegate): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/editorCommon.ts#L623
    export interface IDecorationOptions {
        range: IRange;
        hoverMessage?: IMarkdownString | IMarkdownString[];
        renderOptions?: IDecorationInstanceRenderOptions;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/editorCommon.ts#L607
    export interface IThemeDecorationInstanceRenderOptions {
        before?: IContentDecorationRenderOptions;
        after?: IContentDecorationRenderOptions;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/editorCommon.ts#L615
    export interface IDecorationInstanceRenderOptions extends IThemeDecorationInstanceRenderOptions {
        light?: IThemeDecorationInstanceRenderOptions;
        dark?: IThemeDecorationInstanceRenderOptions;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/editorCommon.ts#L575
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

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/editorCommon.ts#L595
    export interface IDecorationRenderOptions extends IThemeDecorationRenderOptions {
        isWholeLine?: boolean;
        rangeBehavior?: TrackedRangeStickiness;
        overviewRulerLane?: OverviewRulerLane;

        light?: IThemeDecorationRenderOptions;
        dark?: IThemeDecorationRenderOptions;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/editorCommon.ts#L540
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

    // https://github.com/microsoft/vscode/blob/e683ace9e5acadba0e8bde72d793cb2cb83e58a7/src/vs/editor/common/model.ts#L522
    export interface ITextSnapshot {
        read(): string | null;
    }

    export interface ITextModel {
        /**
         * Get the tokens for the line `lineNumber`.
         * The tokens might be inaccurate. Use `forceTokenization` to ensure accurate tokens.
         * @internal
         */
        // https://github.com/theia-ide/vscode/blob/standalone/0.19.x/src/vs/editor/common/model.ts#L826-L831
        getLineTokens(lineNumber: number): LineTokens;

        /**
         * Force tokenization information for `lineNumber` to be accurate.
         * @internal
         */
        // https://github.com/theia-ide/vscode/blob/standalone/0.19.x/src/vs/editor/common/model.ts#L806-L810
        forceTokenization(lineNumber: number): void;

        // https://github.com/microsoft/vscode/blob/e683ace9e5acadba0e8bde72d793cb2cb83e58a7/src/vs/editor/common/model.ts#L623
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

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/commands/common/commands.ts#L55
    export const CommandsRegistry: {
        getCommands(): Map<string, { id: string, handler: (...args: any) => any }>;
    };

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/commands/common/commands.ts#L16
    export interface ICommandEvent {
        commandId: string;
        args: any[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/commands/common/commands.ts#L21
    export interface ICommandService {
        onWillExecuteCommand: monaco.Event<ICommandEvent>;
        onDidExecuteCommand: monaco.Event<ICommandEvent>;
        executeCommand<T = any>(commandId: string, ...args: any[]): Promise<T | undefined>;
    }

}

declare module monaco.actions {

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/actions/common/actions.ts#L17
    export interface ILocalizedString {
        value: string;
        original: string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/actions/common/actions.ts#L22
    export interface ICommandAction {
        id: string;
        title: string | ILocalizedString;
        category?: string | ILocalizedString;
        icon?: { dark?: monaco.Uri; light?: monaco.Uri; } | monaco.theme.ThemeIcon;
        precondition?: monaco.contextkey.ContextKeyExpr;
        toggled?: monaco.contextkey.ContextKeyExpr;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/actions/common/actions.ts#L35
    export interface IMenuItem {
        command: ICommandAction;
        when?: monaco.contextkey.ContextKeyExpr;
        group?: 'navigation' | string;
        order?: number;
        alt?: ICommandAction;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/actions/common/actions.ts#L43
    export interface ISubmenuItem {
        title: string | ILocalizedString;
        submenu: number; // enum MenuId
        when?: monaco.contextkey.ContextKeyExpr;
        group?: 'navigation' | string;
        order?: number;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/actions/common/actions.ts#L137
    export interface IMenuRegistry {
        /**
         * Retrieves all the registered menu items for the given menu.
         * @param menuId - see https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/actions/common/actions.ts#L67
         */
        getMenuItems(menuId: 7 /* EditorContext */ | 8 /* EditorContextPeek */ | 25 /* MenubarSelectionMenu */): IMenuItem | ISubmenuItem[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/actions/common/actions.ts#L51
    export function isIMenuItem(item: IMenuItem | ISubmenuItem): item is IMenuItem;

    /**
     * The shared menu registry singleton.
     */
    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/actions/common/actions.ts#L146
    export const MenuRegistry: IMenuRegistry;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/actions/common/actions.ts#L250
    export class MenuItemAction { }
}

declare module monaco.platform {
    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/platform.ts#L206
    export const enum OperatingSystem {
        Windows = 1,
        Macintosh = 2,
        Linux = 3
    }
    export const OS: OperatingSystem;
}

declare module monaco.keybindings {

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/keybinding/common/keybindingResolver.ts#L20
    export class KeybindingResolver {
        static contextMatchesRules(context: monaco.contextKeyService.IContext, rules: monaco.contextkey.ContextKeyExpr | null | undefined): boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/keyCodes.ts#L443
    export class SimpleKeybinding {
        public readonly ctrlKey: boolean;
        public readonly shiftKey: boolean;
        public readonly altKey: boolean;
        public readonly metaKey: boolean;
        public readonly keyCode: KeyCode;

        constructor(ctrlKey: boolean, shiftKey: boolean, altKey: boolean, metaKey: boolean, keyCode: KeyCode);
        toChord(): ChordKeybinding;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/keyCodes.ts#L503
    export class ChordKeybinding {
        readonly parts: SimpleKeybinding[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/keyCodes.ts#L540
    export type Keybinding = ChordKeybinding;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/keybinding/common/keybindingsRegistry.ts#L12
    export interface IKeybindingItem {
        keybinding: Keybinding;
        command: string;
        when?: monaco.contextkey.ContextKeyExpr;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/keybinding/common/keybindingsRegistry.ts#L69
    export interface IKeybindingsRegistry {
        /**
         * Returns with all the default, static keybindings.
         */
        getDefaultKeybindings(): IKeybindingItem[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/keybinding/common/keybindingsRegistry.ts#L76
    export const KeybindingsRegistry: IKeybindingsRegistry;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/keyCodes.ts#L542
    export class ResolvedKeybindingPart {
        readonly ctrlKey: boolean;
        readonly shiftKey: boolean;
        readonly altKey: boolean;
        readonly metaKey: boolean;

        readonly keyLabel: string | null;
        readonly keyAriaLabel: string | null;

        constructor(ctrlKey: boolean, shiftKey: boolean, altKey: boolean, metaKey: boolean, kbLabel: string | null, kbAriaLabel: string | null);
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/keyCodes.ts#L564
    export abstract class ResolvedKeybinding {
        public abstract getLabel(): string | null;
        public abstract getAriaLabel(): string | null;
        public abstract getElectronAccelerator(): string | null;
        public abstract getUserSettingsLabel(): string | null;
        public abstract isWYSIWYG(): boolean;
        public abstract isChord(): boolean;
        public abstract getParts(): ResolvedKeybindingPart[];
        public abstract getDispatchParts(): (string | null)[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/keybinding/common/usLayoutResolvedKeybinding.ts#L13
    export class USLayoutResolvedKeybinding {
        public static getDispatchStr(keybinding: SimpleKeybinding): string | null;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/keybindingLabels.ts#L17
    export interface Modifiers {
        readonly ctrlKey: boolean;
        readonly shiftKey: boolean;
        readonly altKey: boolean;
        readonly metaKey: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/keybindingLabels.ts#L24
    export interface KeyLabelProvider<T extends Modifiers> {
        (keybinding: T): string | null;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/keybindingLabels.ts#L28
    export interface ModifierLabelProvider {
        toLabel<T extends Modifiers>(OS: monaco.platform.OperatingSystem, parts: T[], keyLabelProvider: KeyLabelProvider<T>): string | null;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/keybindingLabels.ts#L61
    export const UILabelProvider: ModifierLabelProvider;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/keybindingLabels.ts#L88
    export const AriaLabelProvider: ModifierLabelProvider;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/keybindingLabels.ts#L116
    export const ElectronAcceleratorLabelProvider: ModifierLabelProvider;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/keybindingLabels.ts#L136
    export const UserSettingsLabelProvider: ModifierLabelProvider;

}

declare module monaco.services {

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/standalone/browser/standaloneLanguages.ts#L101
    export class TokenizationSupport2Adapter implements monaco.modes.ITokenizationSupport {
        constructor(standaloneThemeService: IStandaloneThemeService, languageIdentifier: LanguageIdentifier, actual: monaco.languages.TokensProvider)
        tokenize(line: string, state: monaco.languages.IState, offsetDelta: number): any;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/services/resolverService.ts#L12
    export const ITextModelService: any;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/opener/common/opener.ts#L13
    export interface OpenInternalOptions {
        readonly openToSide?: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/opener/common/opener.ts#L28
    export interface OpenExternalOptions {
        readonly openExternal?: boolean
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/opener/common/opener.ts#L38
    export interface IOpener {
        open(resource: monaco.Uri | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/browser/services/openerService.ts#L89
    export class OpenerService {
        constructor(editorService: monaco.editor.ICodeEditorService, commandService: monaco.commands.ICommandService);
        registerOpener(opener: IOpener): monaco.IDisposable;
        open(resource: monaco.Uri | string, options?: OpenInternalOptions & OpenExternalOptions): Promise<boolean>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/browser/services/codeEditorService.ts#L13
    export const ICodeEditorService: any;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/configuration/common/configuration.ts#L16
    export const IConfigurationService: any;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/configuration/common/configurationModels.ts#L337
    export interface Configuration {
        getValue(section: string | undefined, overrides: any, workspace: any | undefined): any;
        toData(): any;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/configuration/common/configuration.ts#L30-L37
    export const enum ConfigurationTarget {
        USER = 1,
        USER_LOCAL,
        USER_REMOTE,
        WORKSPACE,
        WORKSPACE_FOLDER,
        DEFAULT,
        MEMORY
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/configuration/common/configuration.ts#L51
    export interface IConfigurationChange {
        keys: string[];
        overrides: [string, string[]][];
    }

    // https://github.com/theia-ide/vscode/blob/b0b47123a5da83d42c2675f2bfff5bb9f1b2673c/src/vs/platform/configuration/common/configuration.ts#L56
    export class IConfigurationChangeEvent {

        readonly source: ConfigurationTarget;
        readonly affectedKeys: string[];
        readonly change: IConfigurationChange;

        affectsConfiguration(configuration: string, overrides?: IConfigurationOverrides): boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/configuration/common/configuration.ts#L25
    export interface IConfigurationOverrides {
        overrideIdentifier?: string | null;
        resource?: monaco.Uri | null;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/standalone/browser/simpleServices.ts#L434
    export interface IConfigurationService {
        _onDidChangeConfiguration: monaco.Emitter<IConfigurationChangeEvent>;
        _configuration: Configuration;
    }

    // https://github.com/microsoft/vscode/blob/standalone/0.20.x/src/vs/editor/common/services/textResourceConfigurationService.ts#L71
    export interface ITextResourcePropertiesService {
        getEOL(resource: monaco.Uri | undefined, language?: string): string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/browser/services/codeEditorServiceImpl.ts#L58
    export abstract class CodeEditorServiceImpl implements monaco.editor.ICodeEditorService {
        constructor(themeService: IStandaloneThemeService);
        abstract getActiveCodeEditor(): monaco.editor.ICodeEditor | undefined;
        abstract openCodeEditor(input: monaco.editor.IResourceInput, source?: monaco.editor.ICodeEditor,
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

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/standalone/browser/simpleServices.ts#L249
    export class StandaloneCommandService implements monaco.commands.ICommandService {
        constructor(instantiationService: monaco.instantiation.IInstantiationService);
        private readonly _onWillExecuteCommand: monaco.Emitter<monaco.commands.ICommandEvent>;
        private readonly _onDidExecuteCommand: monaco.Emitter<monaco.commands.ICommandEvent>;

        executeCommand<T>(commandId: string, ...args: any[]): Promise<T>;
        executeCommand(commandId: string, ...args: any[]): Promise<any>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/standalone/browser/standaloneServices.ts#L60
    export class LazyStaticService<T> {
        get(overrides?: monaco.editor.IEditorOverrideServices): T;
    }

    // https://github.com/microsoft/vscode/blob/0eb3a02ca2bcfab5faa3dc6e52d7c079efafcab0/src/vs/platform/theme/common/themeService.ts#L78
    export interface ITokenStyle {
        readonly foreground?: number;
        readonly bold?: boolean;
        readonly underline?: boolean;
        readonly italic?: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/standalone/common/standaloneThemeService.ts#L28
    export interface IStandaloneThemeService extends monaco.theme.IThemeService {
        // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/standalone/browser/standaloneThemeServiceImpl.ts#L178
        readonly _knownThemes: Map<string, IStandaloneTheme>;

        getTheme(): IStandaloneTheme;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/standalone/common/standaloneThemeService.ts#L23
    export interface IStandaloneTheme {
        // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/standalone/browser/standaloneThemeServiceImpl.ts#L31
        themeData: monaco.editor.IStandaloneThemeData

        tokenTheme: TokenTheme;

        // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/theme/common/themeService.ts#L98
        getColor(color: string, useDefault?: boolean): monaco.color.Color | undefined;

        getTokenStyleMetadata(type: string, modifiers: string[], modelLanguage: string): ITokenStyle | undefined;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/modes/supports/tokenization.ts#L188
    export interface TokenTheme {
        match(languageId: LanguageId, scope: string): number;
        _match(token: string): any;
        getColorMap(): monaco.color.Color[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/modes.ts#L27
    export const enum LanguageId {
        Null = 0,
        PlainText = 1
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/modes.ts#L35
    export class LanguageIdentifier {
        public readonly id: LanguageId;
        readonly language: string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/modes.ts#L58
    export interface IMode {
        getId(): string;
        getLanguageIdentifier(): LanguageIdentifier;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/services/modeService.ts#L30
    export interface IModeService {
        // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/services/modeServiceImpl.ts#L46
        private readonly _instantiatedModes: { [modeId: string]: IMode; };
        private readonly _onLanguagesMaybeChanged: Emitter<void>;
        readonly onDidCreateMode: monaco.IEvent<IMode>;
        createByFilepathOrFirstLine(rsource: monaco.Uri | null, firstLine?: string): ILanguageSelection;
        getLanguageIdentifier(modeId: string | LanguageId): LanguageIdentifier | null;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/services/modeService.ts#L25
    export interface ILanguageSelection {
        readonly languageIdentifier: LanguageIdentifier;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/instantiation/common/serviceCollection.ts#L9
    export interface ServiceCollection {
        set<T>(id: any, instanceOrDescriptor: T): T;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/markers/common/markers.ts#L12
    export interface IMarkerService {
        read(filter?: { owner?: string; resource?: monaco.Uri; severities?: number, take?: number; }): editor.IMarker[];
    }

    // https://github.com/microsoft/vscode/blob/e683ace9e5acadba0e8bde72d793cb2cb83e58a7/src/vs/editor/common/services/modelService.ts#L18
    export interface IModelService {
        createModel(value: string | monaco.editor.ITextBufferFactory, languageSelection: ILanguageSelection | null, resource?: monaco.URI, isForSimpleWidget?: boolean): monaco.editor.ITextModel;
        updateModel(model: monaco.editor.ITextModel, value: string | monaco.editor.ITextBufferFactory): void;
    }

    // https://github.com/microsoft/vscode/blob/standalone/0.20.x/src/vs/editor/common/services/editorWorkerService.ts#L21
    export interface IEditorWorkerService {
        computeMoreMinimalEdits(resource: monaco.Uri, edits: monaco.languages.TextEdit[] | null | undefined): Promise<monaco.languages.TextEdit[] | undefined>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/standalone/browser/standaloneServices.ts#L56
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
    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/theme/common/themeService.ts#L89
    export interface ITheme { }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/theme/common/themeService.ts#L131
    export interface IThemeService {
        readonly onThemeChange: monaco.IEvent<ITheme>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/styler.ts#L10
    export interface IThemable { }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/theme/common/styler.ts#L166
    export function attachQuickOpenStyler(widget: IThemable, themeService: IThemeService): monaco.IDisposable;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/theme/common/themeService.ts#L25
    export interface ThemeIcon {
        readonly id: string;
    }
    export namespace ThemeIcon {
        export function fromString(value: string): ThemeIcon | undefined;
        export function asClassName(icon: ThemeIcon): string | undefined;
    }
}

declare module monaco.color {

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/color.ts#L13
    export class RGBA {
        readonly r: number;
        readonly g: number;
        readonly b: number;
        readonly a: number;

        constructor(r: number, g: number, b: number, a?: number);
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/color.ts#L48
    export class HSLA {
        readonly h: number;
        readonly s: number;
        readonly l: number;
        readonly a: number;

        constructor(h: number, s: number, l: number, a: number);
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/color.ts#L256
    export class Color {
        readonly rgba: RGBA;

        constructor(arg: RGBA | HSLA);
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/theme/common/colorRegistry.ts#L20
    export interface ColorContribution {
        readonly id: string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/theme/common/colorRegistry.ts#L29
    export type ColorFunction = (theme: monaco.theme.ITheme) => Color | undefined;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/theme/common/colorRegistry.ts#L42
    export type ColorValue = string | Color | ColorFunction;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/theme/common/colorRegistry.ts#L33
    export interface ColorDefaults {
        light?: ColorValue;
        dark?: ColorValue;
        hc?: ColorValue;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/theme/common/colorRegistry.ts#L49
    export interface IColorRegistry {
        getColors(): ColorContribution[];
        registerColor(id: string, defaults: ColorDefaults | undefined, description: string): string;
        deregisterColor(id: string): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/theme/common/colorRegistry.ts#L173
    export function getColorRegistry(): IColorRegistry;
    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/theme/common/colorRegistry.ts#L434
    export function darken(colorValue: ColorValue, factor: number): ColorFunction;
    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/theme/common/colorRegistry.ts#L444
    export function lighten(colorValue: ColorValue, factor: number): ColorFunction;
    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/theme/common/colorRegistry.ts#L454
    export function transparent(colorValue: ColorValue, factor: number): ColorFunction;
}

declare module monaco.referenceSearch {

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/modes.ts#L784
    export interface Location {
        uri: Uri,
        range: IRange
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/gotoSymbol/referencesModel.ts#L20
    export interface OneReference { }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/gotoSymbol/referencesModel.ts#L148
    export interface ReferencesModel implements IDisposable {
        readonly references: OneReference[]
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/gotoSymbol/peek/referencesWidget.ts#L187
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
    // see https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/gotoSymbol/peek/referencesWidget.ts#L198
    export interface ReferenceTree {
        getFocus(): ReferenceTreeElement[]
    }
    export interface ReferenceTreeElement { }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/gotoSymbol/peek/referencesController.ts#L32
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

declare module monaco.quickOpen {

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/browser/ui/inputbox/inputBox.ts#L59
    export interface IMessage {
        content: string;
        formatContent?: boolean; // defaults to false
        type?: 1 /* INFO */ | 2  /* WARNING */ | 3 /* ERROR */;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/browser/ui/inputbox/inputBox.ts#L91
    export class InputBox {
        inputElement: HTMLInputElement;
        setPlaceHolder(placeHolder: string): void;
        showMessage(message: IMessage, force?: boolean): void;
        hideMessage(): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/tree/browser/tree.ts#L17
    export interface QuickOpenTree {
        onDidChangeFocus: monaco.Event<any>;
        getFocus(): monaco.quickOpen.QuickOpenEntry;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/browser/quickOpenWidget.ts#L96
    export class QuickOpenWidget implements IDisposable {
        inputBox?: InputBox;
        tree: QuickOpenTree;
        constructor(container: HTMLElement, callbacks: IQuickOpenCallbacks, options: IQuickOpenOptions);
        dispose(): void;
        isVisible(): boolean;
        create(): HTMLElement;
        setInput(input: IModel<any>, autoFocus?: IAutoFocus, ariaLabel?: string): void;
        layout(dimension: monaco.editor.IDimension): void;
        show(prefix: string, options?: IShowOptions): void;
        show(input: IModel<any>, options?: IShowOptions): void;
        hide(reason?: HideReason): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/browser/quickOpenWidget.ts#L79
    export enum HideReason {
        ELEMENT_SELECTED,
        FOCUS_LOST,
        CANCELED
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/browser/quickOpenWidget.ts#L28
    export interface IQuickOpenCallbacks {
        onOk: () => void;
        onCancel: () => void;
        onType: (lookFor: string) => void;
        onShow?: () => void;
        onHide?: (reason: HideReason) => void;
        onFocusLost?: () => boolean /* veto close */;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/browser/quickOpenWidget.ts#L37
    export interface IQuickOpenOptions /* extends IQuickOpenStyles */ {
        minItemsToShow?: number;
        maxItemsToShow?: number;
        inputPlaceHolder?: string;
        inputAriaLabel?: string;
        actionProvider?: IActionProvider;
        keyboardSupport?: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/browser/quickOpenWidget.ts#L57
    export interface IShowOptions {
        quickNavigateConfiguration?: IQuickNavigateConfiguration;
        autoFocus?: IAutoFocus;
        inputSelection?: IRange;
        value?: string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/common/quickOpen.ts#L8
    export interface IQuickNavigateConfiguration {
        keybindings: monaco.keybindings.ResolvedKeybinding[];
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/common/quickOpen.ts#L12
    export interface IAutoFocus {

        /**
         * The index of the element to focus in the result list.
         */
        autoFocusIndex?: number;

        /**
         * If set to true, will automatically select the first entry from the result list.
         */
        autoFocusFirstEntry?: boolean;

        /**
         * If set to true, will automatically select the second entry from the result list.
         */
        autoFocusSecondEntry?: boolean;

        /**
         * If set to true, will automatically select the last entry from the result list.
         */
        autoFocusLastEntry?: boolean;

        /**
         * If set to true, will automatically select any entry whose label starts with the search
         * value. Since some entries to the top might match the query but not on the prefix, this
         * allows to select the most accurate match (matching the prefix) while still showing other
         * elements.
         */
        autoFocusPrefixMatch?: string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/common/quickOpen.ts#L43-L47
    export type Mode = 0 /* PREVIEW */ | 1 /* OPEN */ | 2 /* OPEN_IN_BACKGROUND */;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/common/quickOpen.ts#L49
    export interface IEntryRunContext {
        event: any;
        keymods: IKeyMods;
        quickNavigateConfiguration: IQuickNavigateConfiguration | undefined;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/common/quickOpen.ts#L55
    export interface IKeyMods {
        ctrlCmd: boolean;
        alt: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/common/quickOpen.ts#L60
    export interface IDataSource<T> {
        getId(entry: T): string;
        getLabel(entry: T): string | null;
    }
    /**
     * See vs/base/parts/tree/browser/tree.ts - IRenderer
     */
    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/common/quickOpen.ts#L68
    export interface IRenderer<T> {
        getHeight(entry: T): number;
        getTemplateId(entry: T): string;
        renderTemplate(templateId: string, container: HTMLElement, styles: any): any;
        renderElement(entry: T, templateId: string, templateData: any, styles: any): void;
        disposeTemplate(templateId: string, templateData: any): void;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/common/quickOpen.ts#L76
    export interface IFilter<T> {
        isVisible(entry: T): boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/common/quickOpen.ts#L80
    export interface IAccessiblityProvider<T> {
        getAriaLabel(entry: T): string;
    }
    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/common/quickOpen.ts#L84
    export interface IRunner<T> {
        run(entry: T, mode: Mode, context: IEntryRunContext): boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/common/quickOpen.ts#L88
    export interface IModel<T> {
        entries: T[];
        dataSource: IDataSource<T>;
        renderer: IRenderer<T>;
        runner: IRunner<T>;
        filter?: IFilter<T>;
        accessibilityProvider?: IAccessiblityProvider<T>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/browser/quickOpenModel.ts#L29
    export interface IHighlight {
        start: number;
        end: number;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/browser/ui/iconLabel/iconLabel.ts#L20
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

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/browser/quickOpenModel.ts#L55
    export class QuickOpenEntry {
        constructor(highlights?: IHighlight[]);
        getLabel(): string | undefined;
        getLabelOptions(): IIconLabelValueOptions | undefined;
        getAriaLabel(): string;
        getDetail(): string | undefined;
        getIcon(): string | undefined;
        getDescription(): string | undefined;
        getKeybinding(): monaco.keybindings.ResolvedKeybinding | undefined;
        getResource(): Uri | undefined;
        isHidden(): boolean;
        setHidden(hidden: boolean): void;
        setHighlights(labelHighlights?: IHighlight[], descriptionHighlights?: IHighlight[], detailHighlights?: IHighlight[]): void;
        getHighlights(): [IHighlight[] | undefined /* Label */, IHighlight[] | undefined /* Description */, IHighlight[] | undefined /* Detail */];
        run(mode: Mode, context: IEntryRunContext): boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/browser/quickOpenModel.ts#L197
    export class QuickOpenEntryGroup extends QuickOpenEntry {
        constructor(entry?: QuickOpenEntry, groupLabel?: string, withBorder?: boolean);
        getGroupLabel(): string | undefined;
        setGroupLabel(groupLabel: string | undefined): void;
        showBorder(): boolean;
        setShowBorder(showBorder: boolean): void;
        getEntry(): QuickOpenEntry | undefined;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/tree/browser/tree.ts#L571
    export interface IActionProvider {
        hasActions(element: any, item: any): boolean;
        getActions(element: any, item: any): ReadonlyArray<monaco.editor.IAction> | null;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/parts/quickopen/browser/quickOpenModel.ts#L489
    export class QuickOpenModel implements
        IModel<QuickOpenEntry>,
        IDataSource<QuickOpenEntry>,
        IFilter<QuickOpenEntry>,
        IRunner<QuickOpenEntry>,
        IAccessiblityProvider<QuickOpenEntry> {

        constructor(entries?: QuickOpenEntry[], actionProvider?: IActionProvider);
        addEntries(entries: QuickOpenEntry[]): void;
        entries: QuickOpenEntry[];
        dataSource: IDataSource<QuickOpenEntry>;
        renderer: IRenderer<QuickOpenEntry>;
        runner: IRunner<QuickOpenEntry>;
        filter?: IFilter<QuickOpenEntry>;
        accessibilityProvider?: IAccessiblityProvider<QuickOpenEntry>;
        getId(entry: QuickOpenEntry): string;
        getLabel(entry: QuickOpenEntry): string | null;
        isVisible(entry: QuickOpenEntry): boolean;
        run(entry: QuickOpenEntry, mode: Mode, context: IEntryRunContext): boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/standalone/browser/quickOpen/editorQuickOpen.ts#L19
    export interface IQuickOpenControllerOpts {
        readonly inputAriaLabel: string;
        getModel(lookFor: string): QuickOpenModel;
        getAutoFocus(lookFor: string): IAutoFocus;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/standalone/browser/quickOpen/editorQuickOpen.ts#L25
    export interface QuickOpenController extends IDisposable {
        static readonly ID: string;
        dispose(): void;
        run(opts: IQuickOpenControllerOpts): void;

        // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/standalone/browser/quickOpen/editorQuickOpen.ts#L169
        clearDecorations(): void;
    }
}

declare module monaco.filters {
    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/filters.ts#L15
    export interface IMatch {
        start: number;
        end: number;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/filters.ts#L337
    export function matchesFuzzy(word: string, wordToMatchAgainst: string, enableSeparateSubstringMatching?: boolean): IMatch[] | undefined;
}

declare module monaco.editorExtensions {

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/browser/editorExtensions.ts#L141
    export abstract class EditorCommand {
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/browser/editorExtensions.ts#L205
    export abstract class EditorAction extends EditorCommand {
        id: string;
        label: string;
    }

    export module EditorExtensionsRegistry {
        // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/browser/editorExtensions.ts#L395
        export function getEditorActions(): EditorAction[];

        // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/browser/editorExtensions.ts#L391
        export function getEditorCommand(commandId: string): EditorCommand | undefined;
    }
}
declare module monaco.modes {

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/modes.ts#L209
    export interface ITokenizationSupport {
        tokenize(line: string, state: monaco.languages.IState, offsetDelta: number): any;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/modes.ts#L1692
    export interface TokenizationRegistry {
        get(language: string): ITokenizationSupport | null;
        getColorMap(): monaco.color.Color[] | null;
        readonly onDidChange: monaco.IEvent<any>;
    }
    export const TokenizationRegistry: TokenizationRegistry;

    // https://github.com/microsoft/vscode/blob/0eb3a02ca2bcfab5faa3dc6e52d7c079efafcab0/src/vs/editor/common/modes.ts#L66-L76
    export const enum FontStyle {
        NotSet = -1,
        None = 0,
        Italic = 1,
        Bold = 2,
        Underline = 4
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/modes.ts#L148
    export class TokenMetadata {

        public static getLanguageId(metadata: number): number;

        public static getFontStyle(metadata: number): number;

        public static getForeground(metadata: number): number;

        public static getBackground(metadata: number): number;

        public static getClassNameFromMetadata(metadata: number): string;

        public static getInlineStyleFromMetadata(metadata: number, colorMap: string[]): string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/glob.ts#L18
    export interface IRelativePattern {
        base: string;
        pattern: string;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/modes/languageSelector.ts#L9
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

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/modes/languageSelector.ts#L20
    export type LanguageSelector = string | LanguageFilter | Array<string | LanguageFilter>;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/modes/languageFeatureRegistry.ts#L29
    export interface LanguageFeatureRegistry<T> {
        has(model: monaco.editor.ITextModel): boolean;
        all(model: monaco.editor.ITextModel): T[];
        register(selector: LanguageSelector, provider: T): IDisposable;
        readonly onDidChange: monaco.IEvent<number>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/modes.ts#L1599
    export const DocumentSymbolProviderRegistry: LanguageFeatureRegistry<monaco.languages.DocumentSymbolProvider>;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/modes.ts#L1584
    export const CompletionProviderRegistry: LanguageFeatureRegistry<monaco.languages.CompletionItemProvider>;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/common/modes.ts#L1634
    export const CodeActionProviderRegistry: LanguageFeatureRegistry<monaco.languages.CodeActionProvider & { providedCodeActionKinds?: string[] }>;
}

declare module monaco.suggest {

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/suggest/suggest.ts#L115
    export const enum SnippetSortOrder {
        Top, Inline, Bottom
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/suggest/suggestController.ts#L97
    export interface SuggestController {
        readonly widget: {
            getValue(): SuggestWidget
        }
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/suggest/suggestWidget.ts#L462
    export interface SuggestWidget {
        getFocusedItem(): ISelectedSuggestion | undefined;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/suggest/suggestWidget.ts#L456
    export interface ISelectedSuggestion {
        item: CompletionItem;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/suggest/suggest.ts#L28
    export interface CompletionItem {
        completion: monaco.languages.CompletionItem;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/suggest/suggest.ts#L119
    export class CompletionOptions {

        constructor(
            snippetSortOrder?: SnippetSortOrder,
            kindFilter?: Set<languages.CompletionItemKind>,
            providerFilter?: Set<languages.CompletionItemProvider>,
        );

    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/suggest/suggest.ts#L142
    export function provideSuggestionItems(
        model: monaco.editor.ITextModel,
        position: Position,
        options?: CompletionOptions,
        context?: monaco.languages.CompletionContext,
        token?: monaco.CancellationToken
    ): Promise<CompletionItem[]>;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/suggest/suggest.ts#L136
    export function setSnippetSuggestSupport(support: monaco.languages.CompletionItemProvider): monaco.languages.CompletionItemProvider;
}

declare module monaco.snippetParser {
    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/contrib/snippet/snippetParser.ts#L583
    export class SnippetParser {
        parse(value: string): TextmateSnippet;
    }
    export class TextmateSnippet {
    }
}

declare module monaco.contextKeyService {

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/contextkey/common/contextkey.ts#L803
    export interface IContextKey<T> {
        set(value: T): void;
        reset(): void;
        get(): T | undefined;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/contextkey/common/contextkey.ts#L827
    export interface IContextKeyService {
        // vs code has another object as argument https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/contextkey/common/contextkey.ts#L809
        // which contains restcicted number of HTMLElement methods
        createScoped(target?: HTMLElement): IContextKeyService;
        getContext(target?: HTMLElement): IContext;
        createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T>;
        contextMatchesRules(rules: monaco.contextkey.ContextKeyExpr | undefined): boolean;
        onDidChangeContext: monaco.IEvent<IContextKeyChangeEvent>;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/contextkey/common/contextkey.ts#L799
    export interface IContext {
        getValue<T>(key: string): T | undefined;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/contextkey/common/contextkey.ts#L823
    export interface IContextKeyChangeEvent {
        affectsSome(keys: Set<string>): boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/contextkey/browser/contextKeyService.ts#L321
    export class ContextKeyService implements IContextKeyService {
        constructor(configurationService: monaco.services.IConfigurationService);
        createScoped(target?: HTMLElement): IContextKeyService;
        getContext(target?: HTMLElement): IContext;
        createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T>;
        contextMatchesRules(rules: monaco.contextkey.ContextKeyExpr | undefined): boolean;
        onDidChangeContext: monaco.IEvent<IContextKeyChangeEvent>;
    }
}

declare module monaco.contextkey {

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/contextkey/common/contextkey.ts#L817
    export const IContextKeyService: any;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/platform/contextkey/common/contextkey.ts#L29
    export class ContextKeyExpr {
        keys(): string[];
        static deserialize(when: string): ContextKeyExpr;
        serialize(): string;
    }
}

declare module monaco.mime {

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/mime.ts#L18
    export interface ITextMimeAssociation {
        readonly id: string;
        readonly mime: string;
        readonly filename?: string;
        readonly extension?: string;
        readonly filepattern?: string;
        readonly firstline?: RegExp;
        readonly userConfigured?: boolean;
    }

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/mime.ts#L42
    export function registerTextMime(association: monaco.mime.ITextMimeAssociation, warnOnOverwrite: boolean): void;

    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/mime.ts#L98
    export function clearTextMimes(onlyUserConfigured?: boolean): void;
}

declare module monaco.error {
    // https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/base/common/errors.ts#L77
    export function onUnexpectedError(e: any): undefined;
}

declare module monaco.path {
    // https://github.com/microsoft/vscode/blob/320fbada86c113835aef4fb9d7c4bc5b74678166/src/vs/base/common/path.ts#L1494
    export function normalize(uriPath: string): string;
}

declare module monaco.wordHelper {
    // https://github.com/theia-ide/vscode/blob/standalone/0.19.x/src/vs/editor/common/model/wordHelper.ts#L30
    export const DEFAULT_WORD_REGEXP: RegExp;
}

declare module monaco.strings {
    // https://github.com/theia-ide/vscode/blob/standalone/0.19.x/src/vs/base/common/strings.ts#L150
    export function startsWith(haystack: string, needle: string): boolean;

    // https://github.com/theia-ide/vscode/blob/standalone/0.19.x/src/vs/base/common/strings.ts#L171
    export function endsWith(haystack: string, needle: string): boolean;
}

declare module monaco.async {
    // https://github.com/theia-ide/vscode/blob/standalone/0.19.x/src/vs/base/common/async.ts#L721
    export class IdleValue<T> {
        constructor(executor: () => T) { }
        getValue(): T;
    }
}

/**
 * overloading languages register functions to accept LanguageSelector,
 * check that all register functions passing a selector to registries:
 * https://github.com/theia-ide/vscode/blob/standalone/0.20.x/src/vs/editor/standalone/browser/standaloneLanguages.ts#L338-L511
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
