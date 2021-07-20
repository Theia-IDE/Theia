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

import * as theia from '@theia/plugin';
import { UriComponents } from './uri-components';
import { CompletionItemTag } from '../plugin/types-impl';
import { Event as TheiaEvent } from '@theia/core/lib/common/event';
import { URI } from '@theia/core/shared/vscode-uri';

// Should contains internal Plugin API types

/**
 * Represents options to configure the behavior of showing a document in an editor.
 */
export interface TextDocumentShowOptions {
    /**
     * An optional selection to apply for the document in the editor.
     */
    selection?: Range;

    /**
     * An optional flag that when `true` will stop the editor from taking focus.
     */
    preserveFocus?: boolean;

    /**
     * An optional flag that controls if an editor-tab will be replaced
     * with the next editor or if it will be kept.
     */
    preview?: boolean;

    /**
     * Denotes a location of an editor in the window. Editors can be arranged in a grid
     * and each column represents one editor location in that grid by counting the editors
     * in order of their appearance.
     */
    viewColumn?: theia.ViewColumn;
}

export interface Range {
    /**
     * Line number on which the range starts (starts at 1).
     */
    readonly startLineNumber: number;
    /**
     * Column on which the range starts in line `startLineNumber` (starts at 1).
     */
    readonly startColumn: number;
    /**
     * Line number on which the range ends.
     */
    readonly endLineNumber: number;
    /**
     * Column on which the range ends in line `endLineNumber`.
     */
    readonly endColumn: number;
}

export interface MarkdownString {
    value: string;
    isTrusted?: boolean;
    uris?: {
        [href: string]: UriComponents;
    };
}

export interface SerializedDocumentFilter {
    $serialized: true;
    language?: string;
    scheme?: string;
    pattern?: theia.GlobPattern;
}

export enum CompletionTriggerKind {
    Invoke = 0,
    TriggerCharacter = 1,
    TriggerForIncompleteCompletions = 2
}

export interface CompletionContext {
    triggerKind: CompletionTriggerKind;
    triggerCharacter?: string;
}

export enum CompletionItemInsertTextRule {
    KeepWhitespace = 1,
    InsertAsSnippet = 4
}

export interface Completion {
    label: string;
    label2?: string;
    kind: CompletionItemKind;
    detail?: string;
    documentation?: string | MarkdownString;
    sortText?: string;
    filterText?: string;
    preselect?: boolean;
    insertText: string;
    insertTextRules?: CompletionItemInsertTextRule;
    range?: Range | {
        insert: Range;
        replace: Range;
    };
    commitCharacters?: string[];
    additionalTextEdits?: SingleEditOperation[];
    command?: Command;
    tags?: CompletionItemTag[];
    /** @deprecated use tags instead. */
    deprecated?: boolean;
}

export interface SingleEditOperation {
    range: Range;
    text: string | null;
    /**
     * This indicates that this operation has "insert" semantics.
     * i.e. forceMoveMarkers = true => if `range` is collapsed, all markers at the position will be moved.
     */
    forceMoveMarkers?: boolean;
}

export interface Command {
    id: string;
    title: string;
    tooltip?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    arguments?: any[];
}

export enum CompletionItemKind {
    Method = 0,
    Function = 1,
    Constructor = 2,
    Field = 3,
    Variable = 4,
    Class = 5,
    Struct = 6,
    Interface = 7,
    Module = 8,
    Property = 9,
    Event = 10,
    Operator = 11,
    Unit = 12,
    Value = 13,
    Constant = 14,
    Enum = 15,
    EnumMember = 16,
    Keyword = 17,
    Text = 18,
    Color = 19,
    File = 20,
    Reference = 21,
    Customcolor = 22,
    Folder = 23,
    TypeParameter = 24,
    Snippet = 25
}

export class IdObject {
    id?: number;
}
export interface CompletionDto extends Completion {
    id: number;
    parentId: number;
}

export interface CompletionResultDto extends IdObject {
    id: number;
    defaultRange: {
        insert: Range,
        replace: Range
    }
    completions: CompletionDto[];
    incomplete?: boolean;
}

export interface MarkerData {
    code?: string;
    severity: MarkerSeverity;
    message: string;
    source?: string;
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
    relatedInformation?: RelatedInformation[];
    tags?: MarkerTag[];
}

export interface RelatedInformation {
    resource: string;
    message: string;
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
}

export enum MarkerSeverity {
    Hint = 1,
    Info = 2,
    Warning = 4,
    Error = 8,
}

export enum MarkerTag {
    Unnecessary = 1,
    Deprecated = 2,
}

export interface ParameterInformation {
    label: string | [number, number];
    documentation?: string | MarkdownString;
}

export interface SignatureInformation {
    label: string;
    documentation?: string | MarkdownString;
    parameters: ParameterInformation[];
}

export interface SignatureHelp extends IdObject {
    signatures: SignatureInformation[];
    activeSignature: number;
    activeParameter: number;
}

export interface SignatureHelpContext {
    triggerKind: theia.SignatureHelpTriggerKind;
    triggerCharacter?: string;
    isRetrigger: boolean;
    activeSignatureHelp?: SignatureHelp;
}

export interface Hover {
    contents: MarkdownString[];
    range?: Range;
}

export interface HoverProvider {
    provideHover(model: monaco.editor.ITextModel, position: monaco.Position, token: monaco.CancellationToken): Hover | undefined | Thenable<Hover | undefined>;
}

export enum DocumentHighlightKind {
    Text = 0,
    Read = 1,
    Write = 2
}

export interface DocumentHighlight {
    range: Range;
    kind?: DocumentHighlightKind;
}

export interface DocumentHighlightProvider {
    provideDocumentHighlights(model: monaco.editor.ITextModel, position: monaco.Position, token: monaco.CancellationToken): DocumentHighlight[] | undefined;
}

export interface FormattingOptions {
    tabSize: number;
    insertSpaces: boolean;
}

export interface TextEdit {
    range: Range;
    text: string;
    eol?: monaco.editor.EndOfLineSequence;
}

export interface Location {
    uri: UriComponents;
    range: Range;
}

export type Definition = Location | Location[] | LocationLink[];

export interface LocationLink {
    uri: UriComponents;
    range: Range;
    originSelectionRange?: Range;
    targetSelectionRange?: Range;
}

export interface DefinitionProvider {
    provideDefinition(model: monaco.editor.ITextModel, position: monaco.Position, token: monaco.CancellationToken): Definition | undefined;
}

export interface DeclarationProvider {
    provideDeclaration(model: monaco.editor.ITextModel, position: monaco.Position, token: monaco.CancellationToken): Definition | undefined;
}

/**
 * Value-object that contains additional information when
 * requesting references.
 */
export interface ReferenceContext {

    /**
     * Include the declaration of the current symbol.
     */
    includeDeclaration: boolean;
}

export type CacheId = number;
export type ChainedCacheId = [CacheId, CacheId];

export interface DocumentLink {
    cacheId?: ChainedCacheId,
    range: Range;
    url?: UriComponents | string;
    tooltip?: string;
}

export interface DocumentLinkProvider {
    provideLinks(model: monaco.editor.ITextModel, token: monaco.CancellationToken): DocumentLink[] | undefined | PromiseLike<DocumentLink[] | undefined>;
    resolveLink?: (link: DocumentLink, token: monaco.CancellationToken) => DocumentLink | PromiseLike<DocumentLink[]>;
}

export interface CodeLensSymbol {
    range: Range;
    command?: Command;
}

export interface CodeAction {
    title: string;
    command?: Command;
    edit?: WorkspaceEdit;
    diagnostics?: MarkerData[];
    kind?: string;
}

export interface CodeActionContext {
    only?: string;
}

export interface CodeActionProvider {
    provideCodeActions(
        model: monaco.editor.ITextModel,
        range: Range | Selection,
        context: monaco.languages.CodeActionContext,
        token: monaco.CancellationToken
    ): CodeAction[] | PromiseLike<CodeAction[]>;

    providedCodeActionKinds?: string[];
}

// copied from https://github.com/microsoft/vscode/blob/b165e20587dd0797f37251515bc9e4dbe513ede8/src/vs/editor/common/modes.ts
export interface WorkspaceEditMetadata {
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

export interface WorkspaceFileEdit {
    oldUri?: UriComponents;
    newUri?: UriComponents;
    options?: { overwrite?: boolean, ignoreIfNotExists?: boolean, ignoreIfExists?: boolean, recursive?: boolean };
    metadata?: WorkspaceEditMetadata;
}

export interface WorkspaceTextEdit {
    resource: UriComponents;
    modelVersionId?: number;
    edit: TextEdit;
    metadata?: WorkspaceEditMetadata;
}

export interface WorkspaceEdit {
    edits: Array<WorkspaceTextEdit | WorkspaceFileEdit>;
}

export enum SymbolKind {
    File = 0,
    Module = 1,
    Namespace = 2,
    Package = 3,
    Class = 4,
    Method = 5,
    Property = 6,
    Field = 7,
    Constructor = 8,
    Enum = 9,
    Interface = 10,
    Function = 11,
    Variable = 12,
    Constant = 13,
    String = 14,
    Number = 15,
    Boolean = 16,
    Array = 17,
    Object = 18,
    Key = 19,
    Null = 20,
    EnumMember = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25
}

export enum SymbolTag {
    Deprecated = 1
}

export interface DocumentSymbol {
    name: string;
    detail: string;
    kind: SymbolKind;
    tags: ReadonlyArray<SymbolTag>;
    containerName?: string;
    range: Range;
    selectionRange: Range;
    children?: DocumentSymbol[];
}

export interface WorkspaceRootsChangeEvent {
    roots: string[];
}

export interface WorkspaceFolder {
    uri: UriComponents;
    name: string;
    index: number;
}

export interface Breakpoint {
    readonly id: string;
    readonly enabled: boolean;
    readonly condition?: string;
    readonly hitCondition?: string;
    readonly logMessage?: string;
    readonly location?: Location;
    readonly functionName?: string;
}

export interface WorkspaceSymbolParams {
    query: string
}

export interface FoldingContext {
}

export interface FoldingRange {
    start: number;
    end: number;
    kind?: FoldingRangeKind;
}

export class FoldingRangeKind {
    static readonly Comment = new FoldingRangeKind('comment');
    static readonly Imports = new FoldingRangeKind('imports');
    static readonly Region = new FoldingRangeKind('region');
    public constructor(public value: string) { }
}

export interface SelectionRange {
    range: Range;
}

export interface Color {
    readonly red: number;
    readonly green: number;
    readonly blue: number;
    readonly alpha: number;
}

export interface ColorPresentation {
    label: string;
    textEdit?: TextEdit;
    additionalTextEdits?: TextEdit[];
}

export interface ColorInformation {
    range: Range;
    color: Color;
}

export interface DocumentColorProvider {
    provideDocumentColors(model: monaco.editor.ITextModel): PromiseLike<ColorInformation[]>;
    provideColorPresentations(model: monaco.editor.ITextModel, colorInfo: ColorInformation): PromiseLike<ColorPresentation[]>;
}

export interface Rejection {
    rejectReason?: string;
}

export interface RenameLocation {
    range: Range;
    text: string;
}

export interface RenameProvider {
    provideRenameEdits(model: monaco.editor.ITextModel, position: monaco.Position, newName: string): PromiseLike<WorkspaceEdit & Rejection>;
    resolveRenameLocation?(model: monaco.editor.ITextModel, position: monaco.Position): PromiseLike<RenameLocation & Rejection>;
}

export interface CallHierarchyDefinition {
    name: string;
    kind: SymbolKind;
    detail?: string;
    uri: UriComponents;
    range: Range;
    selectionRange: Range;
}

export interface CallHierarchyReference {
    callerDefinition: CallHierarchyDefinition,
    references: Range[]
}

export interface CallHierarchyItem {
    _sessionId?: string;
    _itemId?: string;

    kind: SymbolKind;
    name: string;
    detail?: string;
    uri: UriComponents;
    range: Range;
    selectionRange: Range;
}

export interface CallHierarchyIncomingCall {
    from: CallHierarchyItem;
    fromRanges: Range[];
}

export interface CallHierarchyOutgoingCall {
    to: CallHierarchyItem;
    fromRanges: Range[];
}

export interface SearchInWorkspaceResult {
    root: string;
    fileUri: string;
    matches: SearchMatch[];
}

export interface SearchMatch {
    line: number;
    character: number;
    length: number;
    lineText: string | LinePreview;

}
export interface LinePreview {
    text: string;
    character: number;
}

export interface AuthenticationSession {
    id: string;
    accessToken: string;
    account: { id: string, label: string };
    scopes: ReadonlyArray<string>;
}

export interface AuthenticationSessionsChangeEvent {
    added: ReadonlyArray<string>;
    removed: ReadonlyArray<string>;
    changed: ReadonlyArray<string>;
}

export interface AuthenticationProviderInformation {
    id: string;
    label: string;
}

export interface CommentOptions {
    /**
     * An optional string to show on the comment input box when it's collapsed.
     */
    prompt?: string;

    /**
     * An optional string to show as placeholder in the comment input box when it's focused.
     */
    placeHolder?: string;
}

export enum CommentMode {
    Editing = 0,
    Preview = 1
}

export interface Comment {
    readonly uniqueIdInThread: number;
    readonly body: MarkdownString;
    readonly userName: string;
    readonly userIconPath?: string;
    readonly contextValue?: string;
    readonly label?: string;
    readonly mode?: CommentMode;
}

export enum CommentThreadCollapsibleState {
    /**
     * Determines an item is collapsed
     */
    Collapsed = 0,
    /**
     * Determines an item is expanded
     */
    Expanded = 1
}

export interface CommentInput {
    value: string;
    uri: URI;
}

export interface CommentThread {
    commentThreadHandle: number;
    controllerHandle: number;
    extensionId?: string;
    threadId: string;
    resource: string | null;
    range: Range;
    label: string | undefined;
    contextValue: string | undefined;
    comments: Comment[] | undefined;
    onDidChangeComments: TheiaEvent<Comment[] | undefined>;
    collapsibleState?: CommentThreadCollapsibleState;
    input?: CommentInput;
    onDidChangeInput: TheiaEvent<CommentInput | undefined>;
    onDidChangeRange: TheiaEvent<Range>;
    onDidChangeLabel: TheiaEvent<string | undefined>;
    onDidChangeCollapsibleState: TheiaEvent<CommentThreadCollapsibleState | undefined>;
    isDisposed: boolean;
}

export interface CommentThreadChangedEventMain extends CommentThreadChangedEvent {
    owner: string;
}

export interface CommentThreadChangedEvent {
    /**
     * Added comment threads.
     */
    readonly added: CommentThread[];

    /**
     * Removed comment threads.
     */
    readonly removed: CommentThread[];

    /**
     * Changed comment threads.
     */
    readonly changed: CommentThread[];
}

export interface CommentingRanges {
    readonly resource: URI;
    ranges: Range[];
}

export interface CommentInfo {
    extensionId?: string;
    threads: CommentThread[];
    commentingRanges: CommentingRanges;
}
