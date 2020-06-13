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
// copied from https://github.com/microsoft/vscode/blob/1.37.0/src/vs/workbench/api/common/extHostTypes.ts
/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable no-null/no-null */

import { UUID } from '@phosphor/coreutils/lib/uuid';
import { illegalArgument } from '../common/errors';
import * as theia from '@theia/plugin';
import * as crypto from 'crypto';
import { URI } from 'vscode-uri';
import { relative } from '../common/paths-util';
import { startsWithIgnoreCase } from '@theia/languages/lib/common/language-selector/strings';
import { MarkdownString, isMarkdownString } from './markdown-string';
import { SymbolKind } from '../common/plugin-api-rpc-model';

export class Disposable {
    private disposable: undefined | (() => void);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static from(...disposables: { dispose(): any }[]): Disposable {
        return new Disposable(() => {
            if (disposables) {
                for (const disposable of disposables) {
                    if (disposable && typeof disposable.dispose === 'function') {
                        disposable.dispose();
                    }
                }
            }
        });
    }

    constructor(func: () => void) {
        this.disposable = func;
    }
    /**
     * Dispose this object.
     */
    dispose(): void {
        if (this.disposable) {
            this.disposable();
            this.disposable = undefined;
        }
    }

    static create(func: () => void): Disposable {
        return new Disposable(func);
    }
}

export enum StatusBarAlignment {
    Left = 1,
    Right = 2
}

export enum TextEditorLineNumbersStyle {
    Off = 0,
    On = 1,
    Relative = 2
}

/**
 * Denotes a column in the editor window.
 * Columns are used to show editors side by side.
 */
export enum ViewColumn {
    Active = -1,
    Beside = -2,
    One = 1,
    Two = 2,
    Three = 3,
    Four = 4,
    Five = 5,
    Six = 6,
    Seven = 7,
    Eight = 8,
    Nine = 9
}

/**
 * Represents sources that can cause `window.onDidChangeEditorSelection`
 */
export enum TextEditorSelectionChangeKind {
    Keyboard = 1,

    Mouse = 2,

    Command = 3
}

export namespace TextEditorSelectionChangeKind {
    export function fromValue(s: string | undefined): TextEditorSelectionChangeKind | undefined {
        switch (s) {
            case 'keyboard': return TextEditorSelectionChangeKind.Keyboard;
            case 'mouse': return TextEditorSelectionChangeKind.Mouse;
            case 'api': return TextEditorSelectionChangeKind.Command;
        }
        return undefined;
    }
}

export class Position {
    private _line: number;
    private _character: number;
    constructor(line: number, char: number) {
        if (line < 0) {
            throw new Error('line number cannot be negative');
        }
        if (char < 0) {
            throw new Error('char number cannot be negative');
        }
        this._line = line;
        this._character = char;
    }

    get line(): number {
        return this._line;
    }

    get character(): number {
        return this._character;
    }

    isBefore(other: Position): boolean {
        if (this._line < other._line) {
            return true;
        }
        if (other._line < this._line) {
            return false;
        }
        return this._character < other._character;
    }

    isBeforeOrEqual(other: Position): boolean {
        if (this._line < other._line) {
            return true;
        }
        if (other._line < this._line) {
            return false;
        }
        return this._character <= other._character;
    }

    isAfter(other: Position): boolean {
        return !this.isBeforeOrEqual(other);
    }

    isAfterOrEqual(other: Position): boolean {
        return !this.isBefore(other);
    }

    isEqual(other: Position): boolean {
        return this._line === other._line && this._character === other._character;
    }

    compareTo(other: Position): number {
        if (this._line < other._line) {
            return -1;
        } else if (this._line > other.line) {
            return 1;
        } else {
            // equal line
            if (this._character < other._character) {
                return -1;
            } else if (this._character > other._character) {
                return 1;
            } else {
                // equal line and character
                return 0;
            }
        }
    }

    translate(change: { lineDelta?: number; characterDelta?: number; }): Position;
    translate(lineDelta?: number, characterDelta?: number): Position;
    translate(lineDeltaOrChange: number | { lineDelta?: number; characterDelta?: number; } | undefined, characterDelta: number = 0): Position {

        if (lineDeltaOrChange === null || characterDelta === null) {
            throw illegalArgument();
        }

        let lineDelta: number;
        if (typeof lineDeltaOrChange === 'undefined') {
            lineDelta = 0;
        } else if (typeof lineDeltaOrChange === 'number') {
            lineDelta = lineDeltaOrChange;
        } else {
            lineDelta = typeof lineDeltaOrChange.lineDelta === 'number' ? lineDeltaOrChange.lineDelta : 0;
            characterDelta = typeof lineDeltaOrChange.characterDelta === 'number' ? lineDeltaOrChange.characterDelta : 0;
        }

        if (lineDelta === 0 && characterDelta === 0) {
            return this;
        }
        return new Position(this.line + lineDelta, this.character + characterDelta);
    }

    with(change: { line?: number; character?: number; }): Position;
    with(line?: number, character?: number): Position;
    with(lineOrChange: number | { line?: number; character?: number; } | undefined, character: number = this.character): Position {

        if (lineOrChange === null || character === null) {
            throw illegalArgument();
        }

        let line: number;
        if (typeof lineOrChange === 'undefined') {
            line = this.line;

        } else if (typeof lineOrChange === 'number') {
            line = lineOrChange;

        } else {
            line = typeof lineOrChange.line === 'number' ? lineOrChange.line : this.line;
            character = typeof lineOrChange.character === 'number' ? lineOrChange.character : this.character;
        }

        if (line === this.line && character === this.character) {
            return this;
        }
        return new Position(line, character);
    }

    static Min(...positions: Position[]): Position {
        let result = positions.pop();
        for (const p of positions) {
            if (p.isBefore(result!)) {
                result = p;
            }
        }
        return result!;
    }

    static Max(...positions: Position[]): Position {
        let result = positions.pop();
        for (const p of positions) {
            if (p.isAfter(result!)) {
                result = p;
            }
        }
        return result!;
    }

    static isPosition(other: {}): other is Position {
        if (!other) {
            return false;
        }
        if (other instanceof Position) {
            return true;
        }
        const { line, character } = <Position>other;
        if (typeof line === 'number' && typeof character === 'number') {
            return true;
        }
        return false;
    }
}

export class Range {
    protected _start: Position;
    protected _end: Position;

    constructor(start: Position, end: Position);
    constructor(startLine: number, startColumn: number, endLine: number, endColumn: number);
    constructor(startLineOrStart: number | Position, startColumnOrEnd: number | Position, endLine?: number, endColumn?: number) {
        let start: Position | undefined = undefined;
        let end: Position | undefined = undefined;

        if (typeof startLineOrStart === 'number' && typeof startColumnOrEnd === 'number' && typeof endLine === 'number' && typeof endColumn === 'number') {
            start = new Position(startLineOrStart, startColumnOrEnd);
            end = new Position(endLine, endColumn);
        } else if (startLineOrStart instanceof Position && startColumnOrEnd instanceof Position) {
            start = startLineOrStart;
            end = startColumnOrEnd;
        }

        if (!start || !end) {
            throw new Error('Invalid arguments');
        }

        if (start.isBefore(end)) {
            this._start = start;
            this._end = end;
        } else {
            this._start = end;
            this._end = start;
        }
    }

    get start(): Position {
        return this._start;
    }

    get end(): Position {
        return this._end;
    }

    contains(positionOrRange: Position | Range): boolean {
        if (positionOrRange instanceof Range) {
            return this.contains(positionOrRange._start)
                && this.contains(positionOrRange._end);

        } else if (positionOrRange instanceof Position) {
            if (positionOrRange.isBefore(this._start)) {
                return false;
            }
            if (this._end.isBefore(positionOrRange)) {
                return false;
            }
            return true;
        }
        return false;
    }

    isEqual(other: Range): boolean {
        return this._start.isEqual(other._start) && this._end.isEqual(other._end);
    }

    intersection(other: Range): Range | undefined {
        const start = Position.Max(other.start, this._start);
        const end = Position.Min(other.end, this._end);
        if (start.isAfter(end)) {
            // this happens when there is no overlap:
            // |-----|
            //          |----|
            return undefined;
        }
        return new Range(start, end);
    }

    union(other: Range): Range {
        if (this.contains(other)) {
            return this;
        } else if (other.contains(this)) {
            return other;
        }
        const start = Position.Min(other.start, this._start);
        const end = Position.Max(other.end, this.end);
        return new Range(start, end);
    }

    get isEmpty(): boolean {
        return this._start.isEqual(this._end);
    }

    get isSingleLine(): boolean {
        return this._start.line === this._end.line;
    }

    with(change: { start?: Position, end?: Position }): Range;
    with(start?: Position, end?: Position): Range;
    with(startOrChange: Position | { start?: Position, end?: Position } | undefined, end: Position = this.end): Range {

        if (startOrChange === null || end === null) {
            throw illegalArgument();
        }

        let start: Position;
        if (!startOrChange) {
            start = this.start;

        } else if (Position.isPosition(startOrChange)) {
            start = startOrChange;

        } else {
            start = startOrChange.start || this.start;
            end = startOrChange.end || this.end;
        }

        if (start.isEqual(this._start) && end.isEqual(this.end)) {
            return this;
        }
        return new Range(start, end);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static isRange(thing: any): thing is theia.Range {
        if (thing instanceof Range) {
            return true;
        }
        if (!thing) {
            return false;
        }
        return Position.isPosition((<Range>thing).start)
            && Position.isPosition((<Range>thing).end);
    }

}

export class Selection extends Range {
    private _anchor: Position;
    private _active: Position;
    constructor(anchor: Position, active: Position);
    constructor(anchorLine: number, anchorColumn: number, activeLine: number, activeColumn: number);
    constructor(anchorLineOrAnchor: number | Position, anchorColumnOrActive: number | Position, activeLine?: number, activeColumn?: number) {
        let anchor: Position | undefined = undefined;
        let active: Position | undefined = undefined;

        if (typeof anchorLineOrAnchor === 'number' && typeof anchorColumnOrActive === 'number' && typeof activeLine === 'number' && typeof activeColumn === 'number') {
            anchor = new Position(anchorLineOrAnchor, anchorColumnOrActive);
            active = new Position(activeLine, activeColumn);
        } else if (anchorLineOrAnchor instanceof Position && anchorColumnOrActive instanceof Position) {
            anchor = anchorLineOrAnchor;
            active = anchorColumnOrActive;
        }

        if (!anchor || !active) {
            throw new Error('Invalid arguments');
        }

        super(anchor, active);

        this._anchor = anchor;
        this._active = active;
    }

    get active(): Position {
        return this._active;
    }

    get anchor(): Position {
        return this._anchor;
    }

    get isReversed(): boolean {
        return this._anchor === this._end;
    }
}

export enum EndOfLine {
    LF = 1,
    CRLF = 2
}

export class SnippetString {

    static isSnippetString(thing: {}): thing is SnippetString {
        if (thing instanceof SnippetString) {
            return true;
        }
        if (!thing) {
            return false;
        }
        return typeof (<SnippetString>thing).value === 'string';
    }

    private static _escape(value: string): string {
        return value.replace(/\$|}|\\/g, '\\$&');
    }

    private _tabstop: number = 1;

    value: string;

    constructor(value?: string) {
        this.value = value || '';
    }

    appendText(string: string): SnippetString {
        this.value += SnippetString._escape(string);
        return this;
    }

    appendTabstop(number: number = this._tabstop++): SnippetString {
        this.value += '$';
        this.value += number;
        return this;
    }

    appendPlaceholder(value: string | ((snippet: SnippetString) => void), number: number = this._tabstop++): SnippetString {

        if (typeof value === 'function') {
            const nested = new SnippetString();
            nested._tabstop = this._tabstop;
            value(nested);
            this._tabstop = nested._tabstop;
            value = nested.value;
        } else {
            value = SnippetString._escape(value);
        }

        this.value += '${';
        this.value += number;
        this.value += ':';
        this.value += value;
        this.value += '}';

        return this;
    }

    appendVariable(name: string, defaultValue?: string | ((snippet: SnippetString) => void)): SnippetString {

        if (typeof defaultValue === 'function') {
            const nested = new SnippetString();
            nested._tabstop = this._tabstop;
            defaultValue(nested);
            this._tabstop = nested._tabstop;
            defaultValue = nested.value;

        } else if (typeof defaultValue === 'string') {
            defaultValue = defaultValue.replace(/\$|}/g, '\\$&');
        }

        this.value += '${';
        this.value += name;
        if (defaultValue) {
            this.value += ':';
            this.value += defaultValue;
        }
        this.value += '}';

        return this;
    }
}

export class ThemeColor {
    constructor(public id: string) {
    }
}

export class ThemeIcon {

    static readonly File: ThemeIcon = new ThemeIcon('file');

    static readonly Folder: ThemeIcon = new ThemeIcon('folder');

    private constructor(public id: string) {
    }

}

export enum TextEditorRevealType {
    Default = 0,
    InCenter = 1,
    InCenterIfOutsideViewport = 2,
    AtTop = 3
}

/**
 * These values match very carefully the values of `TrackedRangeStickiness`
 */
export enum DecorationRangeBehavior {
    /**
     * TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges
     */
    OpenOpen = 0,
    /**
     * TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
     */
    ClosedClosed = 1,
    /**
     * TrackedRangeStickiness.GrowsOnlyWhenTypingBefore
     */
    OpenClosed = 2,
    /**
     * TrackedRangeStickiness.GrowsOnlyWhenTypingAfter
     */
    ClosedOpen = 3
}

/**
 * Vertical Lane in the overview ruler of the editor.
 */
export enum OverviewRulerLane {
    Left = 1,
    Center = 2,
    Right = 4,
    Full = 7
}

export enum ConfigurationTarget {
    Global = 1,
    Workspace,
    WorkspaceFolder,
    Default,
    Memory
}

export class RelativePattern {

    base: string;

    constructor(base: theia.WorkspaceFolder | string, public pattern: string) {
        if (typeof base !== 'string') {
            if (!base || !URI.isUri(base.uri)) {
                throw illegalArgument('base');
            }
        }

        if (typeof pattern !== 'string') {
            throw illegalArgument('pattern');
        }

        this.base = typeof base === 'string' ? base : base.uri.fsPath;
    }

    pathToRelative(from: string, to: string): string {
        return relative(from, to);
    }
}

export enum IndentAction {
    None = 0,
    Indent = 1,
    IndentOutdent = 2,
    Outdent = 3
}

export class TextEdit {

    protected _range: Range;
    protected _newText: string;
    protected _newEol: EndOfLine;

    get range(): Range {
        return this._range;
    }

    set range(value: Range) {
        if (value && !Range.isRange(value)) {
            throw illegalArgument('range');
        }
        this._range = value;
    }

    get newText(): string {
        return this._newText || '';
    }

    set newText(value: string) {
        if (value && typeof value !== 'string') {
            throw illegalArgument('newText');
        }
        this._newText = value;
    }

    get newEol(): EndOfLine {
        return this._newEol;
    }

    set newEol(value: EndOfLine) {
        if (value && typeof value !== 'number') {
            throw illegalArgument('newEol');
        }
        this._newEol = value;
    }

    constructor(range: Range | undefined, newText: string | undefined) {
        this.range = range!;
        this.newText = newText!;
    }

    static isTextEdit(thing: {}): thing is TextEdit {
        if (thing instanceof TextEdit) {
            return true;
        }
        if (!thing) {
            return false;
        }
        return Range.isRange((<TextEdit>thing).range)
            && typeof (<TextEdit>thing).newText === 'string';
    }

    static replace(range: Range, newText: string): TextEdit {
        return new TextEdit(range, newText);
    }

    static insert(position: Position, newText: string): TextEdit {
        return TextEdit.replace(new Range(position, position), newText);
    }

    static delete(range: Range): TextEdit {
        return TextEdit.replace(range, '');
    }

    static setEndOfLine(eol: EndOfLine): TextEdit {
        const ret = new TextEdit(undefined, undefined);
        ret.newEol = eol;
        return ret;
    }
}

export enum CompletionTriggerKind {
    Invoke = 0,
    TriggerCharacter = 1,
    TriggerForIncompleteCompletions = 2
}

export enum CompletionItemKind {
    Text = 0,
    Method = 1,
    Function = 2,
    Constructor = 3,
    Field = 4,
    Variable = 5,
    Class = 6,
    Interface = 7,
    Module = 8,
    Property = 9,
    Unit = 10,
    Value = 11,
    Enum = 12,
    Keyword = 13,
    Snippet = 14,
    Color = 15, // eslint-disable-line no-shadow
    File = 16,
    Reference = 17,
    Folder = 18,
    EnumMember = 19,
    Constant = 20,
    Struct = 21,
    Event = 22,
    Operator = 23,
    TypeParameter = 24
}

export class CompletionItem implements theia.CompletionItem {

    label: string;
    kind?: CompletionItemKind;
    detail: string;
    documentation: string | MarkdownString;
    sortText: string;
    filterText: string;
    preselect: boolean;
    insertText: string | SnippetString;
    range: Range;
    textEdit: TextEdit;
    additionalTextEdits: TextEdit[];
    command: theia.Command;

    constructor(label: string, kind?: CompletionItemKind) {
        this.label = label;
        this.kind = kind;
    }
}

export class CompletionList {

    isIncomplete?: boolean;

    items: theia.CompletionItem[];

    constructor(items: theia.CompletionItem[] = [], isIncomplete: boolean = false) {
        this.items = items;
        this.isIncomplete = isIncomplete;
    }
}

export enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3
}

export class DiagnosticRelatedInformation {
    location: Location;
    message: string;

    constructor(location: Location, message: string) {
        this.location = location;
        this.message = message;
    }
}

export class Location {
    uri: URI;
    range: Range;

    constructor(uri: URI, rangeOrPosition: Range | Position | undefined) {
        this.uri = uri;
        if (rangeOrPosition instanceof Range) {
            this.range = rangeOrPosition;
        } else if (rangeOrPosition instanceof Position) {
            this.range = new Range(rangeOrPosition, rangeOrPosition);
        }
    }

    static isLocation(thing: {}): thing is theia.Location {
        if (thing instanceof Location) {
            return true;
        }
        if (!thing) {
            return false;
        }
        return Range.isRange((<Location>thing).range)
            && URI.isUri((<Location>thing).uri);
    }
}

export enum DiagnosticTag {
    Unnecessary = 1,
}

export class Diagnostic {
    range: Range;
    message: string;
    severity: DiagnosticSeverity;
    source?: string;
    code?: string | number;
    relatedInformation?: DiagnosticRelatedInformation[];
    tags?: DiagnosticTag[];

    constructor(range: Range, message: string, severity: DiagnosticSeverity = DiagnosticSeverity.Error) {
        this.range = range;
        this.message = message;
        this.severity = severity;
    }
}

export enum MarkerSeverity {
    Hint = 1,
    Info = 2,
    Warning = 4,
    Error = 8,
}

export enum MarkerTag {
    Unnecessary = 1,
}

export class ParameterInformation {
    label: string | [number, number];
    documentation?: string | MarkdownString;

    constructor(label: string | [number, number], documentation?: string | MarkdownString) {
        this.label = label;
        this.documentation = documentation;
    }
}

export class SignatureInformation {
    label: string;
    documentation?: string | MarkdownString;
    parameters: ParameterInformation[];

    constructor(label: string, documentation?: string | MarkdownString) {
        this.label = label;
        this.documentation = documentation;
        this.parameters = [];
    }
}

export enum SignatureHelpTriggerKind {
    Invoke = 1,
    TriggerCharacter = 2,
    ContentChange = 3,
}

export class SignatureHelp {
    signatures: SignatureInformation[];
    activeSignature: number;
    activeParameter: number;

    constructor() {
        this.signatures = [];
    }
}

export class Hover {

    public contents: MarkdownString[] | theia.MarkedString[];
    public range?: Range;

    constructor(
        contents: MarkdownString | theia.MarkedString | MarkdownString[] | theia.MarkedString[],
        range?: Range
    ) {
        if (!contents) {
            illegalArgument('contents must be defined');
        }
        if (Array.isArray(contents)) {
            this.contents = <MarkdownString[] | theia.MarkedString[]>contents;
        } else if (isMarkdownString(contents)) {
            this.contents = [contents];
        } else {
            this.contents = [contents];
        }
        this.range = range;
    }
}

export enum DocumentHighlightKind {
    Text = 0,
    Read = 1,
    Write = 2
}

export class DocumentHighlight {

    public range: Range;
    public kind?: DocumentHighlightKind;

    constructor(
        range: Range,
        kind?: DocumentHighlightKind
    ) {
        this.range = range;
        this.kind = kind;
    }
}

export type Definition = Location | Location[];

export class DocumentLink {
    range: Range;
    target: URI;

    constructor(range: Range, target: URI) {
        if (target && !(target instanceof URI)) {
            throw illegalArgument('target');
        }
        if (!Range.isRange(range) || range.isEmpty) {
            throw illegalArgument('range');
        }
        this.range = range;
        this.target = target;
    }
}

export class CodeLens {

    range: Range;

    command?: theia.Command;

    get isResolved(): boolean {
        return !!this.command;
    }

    constructor(range: Range, command?: theia.Command) {
        this.range = range;
        this.command = command;
    }
}

export enum CodeActionTrigger {
    Automatic = 1,
    Manual = 2,
}

export class CodeActionKind {
    private static readonly sep = '.';

    public static readonly Empty = new CodeActionKind('');
    public static readonly QuickFix = CodeActionKind.Empty.append('quickfix');
    public static readonly Refactor = CodeActionKind.Empty.append('refactor');
    public static readonly RefactorExtract = CodeActionKind.Refactor.append('extract');
    public static readonly RefactorInline = CodeActionKind.Refactor.append('inline');
    public static readonly RefactorRewrite = CodeActionKind.Refactor.append('rewrite');
    public static readonly Source = CodeActionKind.Empty.append('source');
    public static readonly SourceOrganizeImports = CodeActionKind.Source.append('organizeImports');
    public static readonly SourceFixAll = CodeActionKind.Source.append('fixAll');

    constructor(
        public readonly value: string
    ) { }

    public append(parts: string): CodeActionKind {
        return new CodeActionKind(this.value ? this.value + CodeActionKind.sep + parts : parts);
    }

    public contains(other: CodeActionKind): boolean {
        return this.value === other.value || startsWithIgnoreCase(other.value, this.value + CodeActionKind.sep);
    }

    public intersects(other: CodeActionKind): boolean {
        return this.contains(other) || other.contains(this);
    }
}

export enum TextDocumentSaveReason {
    Manual = 1,
    AfterDelay = 2,
    FocusOut = 3
}

export class CodeAction {
    title: string;

    command?: theia.Command;

    edit?: WorkspaceEdit;

    diagnostics?: Diagnostic[];

    kind?: CodeActionKind;

    constructor(title: string, kind?: CodeActionKind) {
        this.title = title;
        this.kind = kind;
    }
}

export interface FileOperationOptions {
    overwrite?: boolean;
    ignoreIfExists?: boolean;
    ignoreIfNotExists?: boolean;
    recursive?: boolean;
}
export interface FileOperation {
    _type: 1;
    from: URI | undefined;
    to: URI | undefined;
    options?: FileOperationOptions;
}

export interface FileTextEdit {
    _type: 2;
    uri: URI;
    edit: TextEdit;
}

export class WorkspaceEdit implements theia.WorkspaceEdit {

    private _edits = new Array<FileOperation | FileTextEdit | undefined>();

    renameFile(from: theia.Uri, to: theia.Uri, options?: { overwrite?: boolean, ignoreIfExists?: boolean }): void {
        this._edits.push({ _type: 1, from, to, options });
    }

    createFile(uri: theia.Uri, options?: { overwrite?: boolean, ignoreIfExists?: boolean }): void {
        this._edits.push({ _type: 1, from: undefined, to: uri, options });
    }

    deleteFile(uri: theia.Uri, options?: { recursive?: boolean, ignoreIfNotExists?: boolean }): void {
        this._edits.push({ _type: 1, from: uri, to: undefined, options });
    }

    replace(uri: URI, range: Range, newText: string): void {
        this._edits.push({ _type: 2, uri, edit: new TextEdit(range, newText) });
    }

    insert(resource: URI, position: Position, newText: string): void {
        this.replace(resource, new Range(position, position), newText);
    }

    delete(resource: URI, range: Range): void {
        this.replace(resource, range, '');
    }

    has(uri: URI): boolean {
        for (const edit of this._edits) {
            if (edit && edit._type === 2 && edit.uri.toString() === uri.toString()) {
                return true;
            }
        }
        return false;
    }

    set(uri: URI, edits: TextEdit[]): void {
        if (!edits) {
            // remove all text edits for `uri`
            for (let i = 0; i < this._edits.length; i++) {
                const element = this._edits[i];
                if (element && element._type === 2 && element.uri.toString() === uri.toString()) {
                    this._edits[i] = undefined;
                }
            }
            this._edits = this._edits.filter(e => !!e);
        } else {
            // append edit to the end
            for (const edit of edits) {
                if (edit) {
                    this._edits.push({ _type: 2, uri, edit });
                }
            }
        }
    }

    get(uri: URI): TextEdit[] {
        const res: TextEdit[] = [];
        for (const candidate of this._edits) {
            if (candidate && candidate._type === 2 && candidate.uri.toString() === uri.toString()) {
                res.push(candidate.edit);
            }
        }
        if (res.length === 0) {
            return undefined!;
        }
        return res;
    }

    entries(): [URI, TextEdit[]][] {
        const textEdits = new Map<string, [URI, TextEdit[]]>();
        for (const candidate of this._edits) {
            if (candidate && candidate._type === 2) {
                let textEdit = textEdits.get(candidate.uri.toString());
                if (!textEdit) {
                    textEdit = [candidate.uri, []];
                    textEdits.set(candidate.uri.toString(), textEdit);
                }
                textEdit[1].push(candidate.edit);
            }
        }
        const result: [URI, TextEdit[]][] = [];
        textEdits.forEach(v => result.push(v));
        return result;
    }

    _allEntries(): ([URI, TextEdit[]] | [URI, URI, FileOperationOptions])[] {
        const res: ([URI, TextEdit[]] | [URI, URI, FileOperationOptions])[] = [];
        for (const edit of this._edits) {
            if (!edit) {
                continue;
            }
            if (edit._type === 1) {
                res.push([edit.from!, edit.to!, edit.options!]);
            } else {
                res.push([edit.uri, [edit.edit]]);
            }
        }
        return res;
    }

    get size(): number {
        return this.entries().length;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toJSON(): any {
        return this.entries();
    }
}

export class TreeItem {

    label?: string | theia.TreeItemLabel;

    id?: string;

    iconPath?: string | URI | { light: string | URI; dark: string | URI } | ThemeIcon;

    resourceUri?: URI;

    tooltip?: string | undefined;

    command?: theia.Command;

    contextValue?: string;

    constructor(label: string | theia.TreeItemLabel, collapsibleState?: theia.TreeItemCollapsibleState)
    constructor(resourceUri: URI, collapsibleState?: theia.TreeItemCollapsibleState)
    constructor(arg1: string | theia.TreeItemLabel | URI, public collapsibleState: theia.TreeItemCollapsibleState = TreeItemCollapsibleState.None) {
        if (arg1 instanceof URI) {
            this.resourceUri = arg1;
        } else {
            this.label = arg1;
        }
    }
}

export enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2
}

export enum SymbolTag {
    Deprecated = 1
}

export class SymbolInformation {

    static validate(candidate: SymbolInformation): void {
        if (!candidate.name) {
            throw new Error('Should provide a name inside candidate field');
        }
    }

    name: string;
    location: Location;
    kind: SymbolKind;
    tags?: SymbolTag[];
    containerName: undefined | string;
    constructor(name: string, kind: SymbolKind, containerName: string, location: Location);
    constructor(name: string, kind: SymbolKind, range: Range, uri?: URI, containerName?: string);
    constructor(name: string, kind: SymbolKind, rangeOrContainer: string | Range, locationOrUri?: Location | URI, containerName?: string) {
        this.name = name;
        this.kind = kind;
        this.containerName = containerName;

        if (typeof rangeOrContainer === 'string') {
            this.containerName = rangeOrContainer;
        }

        if (locationOrUri instanceof Location) {
            this.location = locationOrUri;
        } else if (rangeOrContainer instanceof Range) {
            this.location = new Location(locationOrUri!, rangeOrContainer);
        }

        SymbolInformation.validate(this);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toJSON(): any {
        return {
            name: this.name,
            kind: SymbolKind[this.kind],
            location: this.location,
            containerName: this.containerName
        };
    }
}

export class DocumentSymbol {

    static validate(candidate: DocumentSymbol): void {
        if (!candidate.name) {
            throw new Error('Should provide a name inside candidate field');
        }
        if (!candidate.range.contains(candidate.selectionRange)) {
            throw new Error('selectionRange must be contained in fullRange');
        }
        if (candidate.children) {
            candidate.children.forEach(DocumentSymbol.validate);
        }
    }

    name: string;
    detail: string;
    kind: SymbolKind;
    tags?: SymbolTag[];
    range: Range;
    selectionRange: Range;
    children: DocumentSymbol[];

    constructor(name: string, detail: string, kind: SymbolKind, range: Range, selectionRange: Range) {
        this.name = name;
        this.detail = detail;
        this.kind = kind;
        this.range = range;
        this.selectionRange = selectionRange;
        this.children = [];

        DocumentSymbol.validate(this);
    }
}

export enum FileChangeType {
    Changed = 1,
    Created = 2,
    Deleted = 3,
}

export enum CommentThreadCollapsibleState {
    Collapsed = 0,
    Expanded = 1
}

export interface QuickInputButton {
    readonly iconPath: URI | { light: string | URI; dark: string | URI } | ThemeIcon;
    readonly tooltip?: string | undefined;
}

export class QuickInputButtons {
    static readonly Back: QuickInputButton = {
        iconPath: {
            id: 'Back'
        },
        tooltip: 'Back'
    };
}

export enum CommentMode {
    Editing = 0,
    Preview = 1
}

export class FileSystemError extends Error {

    static FileExists(messageOrUri?: string | URI): FileSystemError {
        return new FileSystemError(messageOrUri, 'EntryExists', FileSystemError.FileExists);
    }
    static FileNotFound(messageOrUri?: string | URI): FileSystemError {
        return new FileSystemError(messageOrUri, 'EntryNotFound', FileSystemError.FileNotFound);
    }
    static FileNotADirectory(messageOrUri?: string | URI): FileSystemError {
        return new FileSystemError(messageOrUri, 'EntryNotADirectory', FileSystemError.FileNotADirectory);
    }
    static FileIsADirectory(messageOrUri?: string | URI): FileSystemError {
        return new FileSystemError(messageOrUri, 'EntryIsADirectory', FileSystemError.FileIsADirectory);
    }
    static NoPermissions(messageOrUri?: string | URI): FileSystemError {
        return new FileSystemError(messageOrUri, 'NoPermissions', FileSystemError.NoPermissions);
    }
    static Unavailable(messageOrUri?: string | URI): FileSystemError {
        return new FileSystemError(messageOrUri, 'Unavailable', FileSystemError.Unavailable);
    }

    constructor(uriOrMessage?: string | URI, code?: string, terminator?: Function) {
        super(URI.isUri(uriOrMessage) ? uriOrMessage.toString(true) : uriOrMessage);
        this.name = code ? `${code} (FileSystemError)` : 'FileSystemError';

        if (typeof Object.setPrototypeOf === 'function') {
            Object.setPrototypeOf(this, FileSystemError.prototype);
        }

        if (typeof Error.captureStackTrace === 'function' && typeof terminator === 'function') {
            Error.captureStackTrace(this, terminator);
        }
    }
}

export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64
}

export interface FileStat {
    readonly type: FileType;
    readonly ctime: number;
    readonly mtime: number;
    readonly size: number;
}

export class ProgressOptions {
    /**
     * The location at which progress should show.
     */
    location: ProgressLocation;
    /**
     * A human-readable string which will be used to describe the
     * operation.
     */
    title?: string;
    /**
     * Controls if a cancel button should show to allow the user to
     * cancel the long running operation.  Note that currently only
     * `ProgressLocation.Notification` is supporting to show a cancel
     * button.
     */
    cancellable?: boolean;
    constructor(location: ProgressLocation, title?: string, cancellable?: boolean) {
        this.location = location;
    }
}
export class Progress<T> {
    /**
     * Report a progress update.
     * @param value A progress item, like a message and/or an
     * report on how much work finished
     */
    report(value: T): void {
    }
}
export enum ProgressLocation {
    /**
     * Show progress for the source control viewlet, as overlay for the icon and as progress bar
     * inside the viewlet (when visible). Neither supports cancellation nor discrete progress.
     */
    SourceControl = 1,
    /**
     * Show progress in the status bar of the editor. Neither supports cancellation nor discrete progress.
     */
    Window = 10,
    /**
     * Show progress as notification with an optional cancel button. Supports to show infinite and discrete progress.
     */
    Notification = 15
}

export class ProcessExecution {
    private executionProcess: string;
    private arguments: string[];
    private executionOptions: theia.ProcessExecutionOptions | undefined;

    constructor(process: string, options?: theia.ProcessExecutionOptions);
    constructor(process: string, args: string[], options?: theia.ProcessExecutionOptions);
    constructor(process: string, varg1?: string[] | theia.ProcessExecutionOptions, varg2?: theia.ProcessExecutionOptions) {
        if (typeof process !== 'string') {
            throw illegalArgument('process');
        }
        this.executionProcess = process;
        if (varg1 !== undefined) {
            if (Array.isArray(varg1)) {
                this.arguments = varg1;
                this.executionOptions = varg2;
            } else {
                this.executionOptions = varg1;
            }
        }
        if (this.arguments === undefined) {
            this.arguments = [];
        }
    }

    get process(): string {
        return this.executionProcess;
    }

    set process(value: string) {
        if (typeof value !== 'string') {
            throw illegalArgument('process');
        }
        this.executionProcess = value;
    }

    get args(): string[] {
        return this.arguments;
    }

    set args(value: string[]) {
        if (!Array.isArray(value)) {
            value = [];
        }
        this.arguments = value;
    }

    get options(): theia.ProcessExecutionOptions | undefined {
        return this.executionOptions;
    }

    set options(value: theia.ProcessExecutionOptions | undefined) {
        this.executionOptions = value;
    }

    public computeId(): string {
        const hash = crypto.createHash('md5');
        hash.update('process');
        if (this.executionProcess !== undefined) {
            hash.update(this.executionProcess);
        }
        if (this.arguments && this.arguments.length > 0) {
            for (const arg of this.arguments) {
                hash.update(arg);
            }
        }
        return hash.digest('hex');
    }

    public static is(value: theia.ShellExecution | theia.ProcessExecution): boolean {
        const candidate = value as ProcessExecution;
        return candidate && !!candidate.process;
    }
}

export enum ShellQuoting {
    Escape = 1,
    Strong = 2,
    Weak = 3
}

export enum TaskPanelKind {
    Shared = 1,
    Dedicated = 2,
    New = 3
}

export enum TaskRevealKind {
    Always = 1,
    Silent = 2,
    Never = 3
}

export class ShellExecution {
    private shellCommandLine: string;
    private shellCommand: string | theia.ShellQuotedString;
    private arguments: (string | theia.ShellQuotedString)[];
    private shellOptions: theia.ShellExecutionOptions | undefined;

    constructor(commandLine: string, options?: theia.ShellExecutionOptions);
    constructor(command: string | theia.ShellQuotedString, args: (string | theia.ShellQuotedString)[], options?: theia.ShellExecutionOptions);

    constructor(arg0: string | theia.ShellQuotedString, arg1?: theia.ShellExecutionOptions | (string | theia.ShellQuotedString)[], arg2?: theia.ShellExecutionOptions) {
        if (Array.isArray(arg1) || typeof arg1 === 'string') {
            if (!arg0) {
                throw illegalArgument('command can\'t be undefined or null');
            }
            if (typeof arg0 !== 'string' && typeof arg0.value !== 'string') {
                throw illegalArgument('command');
            }
            this.shellCommand = arg0;
            this.arguments = arg1 as (string | theia.ShellQuotedString)[];
            this.shellOptions = arg2;
        } else {
            if (typeof arg0 !== 'string') {
                throw illegalArgument('commandLine');
            }
            this.shellCommandLine = arg0;
            this.shellOptions = arg1;
        }
    }

    get commandLine(): string {
        return this.shellCommandLine;
    }

    set commandLine(value: string) {
        if (typeof value !== 'string') {
            throw illegalArgument('commandLine');
        }
        this.shellCommandLine = value;
    }

    get command(): string | theia.ShellQuotedString {
        return this.shellCommand;
    }

    set command(value: string | theia.ShellQuotedString) {
        if (typeof value !== 'string' && typeof value.value !== 'string') {
            throw illegalArgument('command');
        }
        this.shellCommand = value;
    }

    get args(): (string | theia.ShellQuotedString)[] {
        return this.arguments;
    }

    set args(value: (string | theia.ShellQuotedString)[]) {
        this.arguments = value || [];
    }

    get options(): theia.ShellExecutionOptions | undefined {
        return this.shellOptions;
    }

    set options(value: theia.ShellExecutionOptions | undefined) {
        this.shellOptions = value;
    }

    public computeId(): string {
        const hash = crypto.createHash('md5');
        hash.update('shell');
        if (this.shellCommandLine !== undefined) {
            hash.update(this.shellCommandLine);
        }
        if (this.shellCommand !== undefined) {
            hash.update(typeof this.shellCommand === 'string' ? this.shellCommand : this.shellCommand.value);
        }
        if (this.arguments && this.arguments.length > 0) {
            for (const arg of this.arguments) {
                hash.update(typeof arg === 'string' ? arg : arg.value);
            }
        }
        return hash.digest('hex');
    }

    public static is(value: theia.ShellExecution | theia.ProcessExecution): boolean {
        const candidate = value as ShellExecution;
        return candidate && (!!candidate.commandLine || !!candidate.command);
    }
}

export class TaskGroup {
    private groupId: string;

    public static Clean: TaskGroup = new TaskGroup('clean', 'Clean');
    public static Build: TaskGroup = new TaskGroup('build', 'Build');
    public static Rebuild: TaskGroup = new TaskGroup('rebuild', 'Rebuild');
    public static Test: TaskGroup = new TaskGroup('test', 'Test');

    public static from(value: string): TaskGroup | undefined {
        switch (value) {
            case 'clean':
                return TaskGroup.Clean;
            case 'build':
                return TaskGroup.Build;
            case 'rebuild':
                return TaskGroup.Rebuild;
            case 'test':
                return TaskGroup.Test;
            default:
                return undefined;
        }
    }

    constructor(id: string, label: string) {
        if (typeof id !== 'string') {
            throw illegalArgument('id');
        }
        if (typeof label !== 'string') {
            throw illegalArgument('name');
        }
        this.groupId = id;
    }

    get id(): string {
        return this.groupId;
    }
}

export enum TaskScope {
    Global = 1,
    Workspace = 2
}

export class Task {
    private static ProcessType: string = 'process';
    private static ShellType: string = 'shell';
    private static EmptyType: string = '$empty';

    private taskDefinition: theia.TaskDefinition;
    private taskScope: theia.TaskScope.Global | theia.TaskScope.Workspace | theia.WorkspaceFolder | undefined;
    private taskName: string;
    private taskExecution: ProcessExecution | ShellExecution | undefined;
    private taskProblemMatchers: string[];
    private hasTaskProblemMatchers: boolean;
    private isTaskBackground: boolean;
    private taskSource: string;
    private taskGroup: TaskGroup | undefined;
    private taskPresentationOptions: theia.TaskPresentationOptions | undefined;
    constructor(
        taskDefinition: theia.TaskDefinition,
        scope: theia.WorkspaceFolder | theia.TaskScope.Global | theia.TaskScope.Workspace,
        name: string,
        source: string,
        execution?: ProcessExecution | ShellExecution,
        problemMatchers?: string | string[]
    );

    // Deprecated constructor used by Jake vscode built-in
    constructor(
        taskDefinition: theia.TaskDefinition,
        name: string,
        source: string,
        execution?: ProcessExecution | ShellExecution,
        problemMatchers?: string | string[],
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
        let taskDefinition: theia.TaskDefinition;
        let scope: theia.WorkspaceFolder | theia.TaskScope.Global | theia.TaskScope.Workspace | undefined;
        let name: string;
        let source: string;
        let execution: ProcessExecution | ShellExecution | undefined;
        let problemMatchers: string | string[] | undefined;

        if (typeof args[1] === 'string') {
            [
                taskDefinition,
                name,
                source,
                execution,
                problemMatchers,
            ] = args;
        } else {
            [
                taskDefinition,
                scope,
                name,
                source,
                execution,
                problemMatchers,
            ] = args;
        }

        this.definition = taskDefinition;
        this.scope = scope;
        this.name = name;
        this.source = source;
        this.execution = execution;

        if (typeof problemMatchers === 'string') {
            this.taskProblemMatchers = [problemMatchers];
            this.hasTaskProblemMatchers = true;
        } else if (Array.isArray(problemMatchers)) {
            this.taskProblemMatchers = problemMatchers;
            this.hasTaskProblemMatchers = true;
        } else {
            this.taskProblemMatchers = [];
            this.hasTaskProblemMatchers = false;
        }
        this.isTaskBackground = false;
    }

    get definition(): theia.TaskDefinition {
        return this.taskDefinition;
    }

    set definition(value: theia.TaskDefinition) {
        if (value === undefined || value === null) {
            throw illegalArgument('Kind can\'t be undefined or null');
        }
        this.taskDefinition = value;
    }

    get scope(): theia.TaskScope.Global | theia.TaskScope.Workspace | theia.WorkspaceFolder | undefined {
        return this.taskScope;
    }

    set scope(value: theia.TaskScope.Global | theia.TaskScope.Workspace | theia.WorkspaceFolder | undefined) {
        if (value === null) {
            value = undefined;
        }
        this.taskScope = value;
    }

    get name(): string {
        return this.taskName;
    }

    set name(value: string) {
        if (typeof value !== 'string') {
            throw illegalArgument('name');
        }
        this.taskName = value;
    }

    get execution(): ProcessExecution | ShellExecution | undefined {
        return this.taskExecution;
    }

    set execution(value: ProcessExecution | ShellExecution | undefined) {
        if (value === null) {
            value = undefined;
        }
        this.taskExecution = value;
        this.updateDefinitionBasedOnExecution();
    }

    get problemMatchers(): string[] {
        return this.taskProblemMatchers;
    }

    set problemMatchers(value: string[]) {
        if (!Array.isArray(value)) {
            this.taskProblemMatchers = [];
            this.hasTaskProblemMatchers = false;
            return;
        }
        this.taskProblemMatchers = value;
        this.hasTaskProblemMatchers = true;
    }

    get hasProblemMatchers(): boolean {
        return this.hasTaskProblemMatchers;
    }

    get isBackground(): boolean {
        return this.isTaskBackground;
    }

    set isBackground(value: boolean) {
        if (value !== true && value !== false) {
            value = false;
        }
        this.isTaskBackground = value;
    }

    get source(): string {
        return this.taskSource;
    }

    set source(value: string) {
        if (typeof value !== 'string' || value.length === 0) {
            throw illegalArgument('source must be a string of length > 0');
        }
        this.taskSource = value;
    }

    get group(): TaskGroup | undefined {
        return this.taskGroup;
    }

    set group(value: TaskGroup | undefined) {
        if (value === undefined || value === null) {
            this.taskGroup = undefined;
            return;
        }
        this.taskGroup = value;
    }

    get presentationOptions(): theia.TaskPresentationOptions | undefined {
        return this.taskPresentationOptions;
    }

    set presentationOptions(value: theia.TaskPresentationOptions | undefined) {
        if (value === null) {
            value = undefined;
        }
        this.taskPresentationOptions = value;
    }

    private updateDefinitionBasedOnExecution(): void {
        if (this.taskExecution instanceof ProcessExecution) {
            Object.assign(this.taskDefinition, {
                type: Task.ProcessType,
                id: this.taskExecution.computeId(),
                taskType: this.taskDefinition!.type
            });
        } else if (this.taskExecution instanceof ShellExecution) {
            Object.assign(this.taskDefinition, {
                type: Task.ShellType,
                id: this.taskExecution.computeId(),
                taskType: this.taskDefinition!.type
            });
        } else {
            Object.assign(this.taskDefinition, {
                type: Task.EmptyType,
                id: UUID.uuid4(),
                taskType: this.taskDefinition!.type
            });
        }
    }
}

export class DebugAdapterExecutable {
    /**
     * The command or path of the debug adapter executable.
     * A command must be either an absolute path of an executable or the name of an command to be looked up via the PATH environment variable.
     * The special value 'node' will be mapped to VS Code's built-in Node.js runtime.
     */
    readonly command: string;

    /**
     * The arguments passed to the debug adapter executable. Defaults to an empty array.
     */
    readonly args?: string[];

    /**
     * Optional options to be used when the debug adapter is started.
     * Defaults to undefined.
     */
    readonly options?: theia.DebugAdapterExecutableOptions;

    /**
     * Creates a description for a debug adapter based on an executable program.
     *
     * @param command The command or executable path that implements the debug adapter.
     * @param args Optional arguments to be passed to the command or executable.
     * @param options Optional options to be used when starting the command or executable.
     */
    constructor(command: string, args?: string[], options?: theia.DebugAdapterExecutableOptions) {
        this.command = command;
        this.args = args;
        this.options = options;
    }
}

/**
 * Represents a debug adapter running as a socket based server.
 */
export class DebugAdapterServer {

    /**
     * The port.
     */
    readonly port: number;

    /**
     * The host.
     */
    readonly host?: string;

    /**
     * Create a description for a debug adapter running as a socket based server.
     */
    constructor(port: number, host?: string) {
        this.port = port;
        this.host = host;
    }
}

export enum LogLevel {
    Trace = 1,
    Debug = 2,
    Info = 3,
    Warning = 4,
    Error = 5,
    Critical = 6,
    Off = 7
}

/**
 * The base class of all breakpoint types.
 */
export class Breakpoint {
    /**
     * Is breakpoint enabled.
     */
    enabled: boolean;
    /**
     * An optional expression for conditional breakpoints.
     */
    condition?: string;
    /**
     * An optional expression that controls how many hits of the breakpoint are ignored.
     */
    hitCondition?: string;
    /**
     * An optional message that gets logged when this breakpoint is hit. Embedded expressions within {} are interpolated by the debug adapter.
     */
    logMessage?: string;

    protected constructor(enabled?: boolean, condition?: string, hitCondition?: string, logMessage?: string) {
        this.enabled = enabled || false;
        this.condition = condition;
        this.hitCondition = hitCondition;
        this.logMessage = logMessage;
    }

    private _id: string | undefined;
    /**
     * The unique ID of the breakpoint.
     */
    get id(): string {
        if (!this._id) {
            this._id = UUID.uuid4();
        }
        return this._id;
    }

}

/**
 * A breakpoint specified by a source location.
 */
export class SourceBreakpoint extends Breakpoint {
    /**
     * The source and line position of this breakpoint.
     */
    location: Location;

    /**
     * Create a new breakpoint for a source location.
     */
    constructor(location: Location, enabled?: boolean, condition?: string, hitCondition?: string, logMessage?: string) {
        super(enabled, condition, hitCondition, logMessage);
        this.location = location;
    }
}

/**
 * A breakpoint specified by a function name.
 */
export class FunctionBreakpoint extends Breakpoint {
    /**
     * The name of the function to which this breakpoint is attached.
     */
    functionName: string;

    /**
     * Create a new function breakpoint.
     */
    constructor(functionName: string, enabled?: boolean, condition?: string, hitCondition?: string, logMessage?: string) {
        super(enabled, condition, hitCondition, logMessage);
        this.functionName = functionName;
    }
}

export class Color {
    readonly red: number;
    readonly green: number;
    readonly blue: number;
    readonly alpha: number;

    constructor(red: number, green: number, blue: number, alpha: number) {
        this.red = red;
        this.green = green;
        this.blue = blue;
        this.alpha = alpha;
    }
}

export class ColorInformation {
    range: Range;
    color: Color;

    constructor(range: Range, color: Color) {
        if (color && !(color instanceof Color)) {
            throw illegalArgument('color');
        }
        if (!Range.isRange(range)) {
            throw illegalArgument('range');
        }
        this.range = range;
        this.color = color;
    }
}

export class ColorPresentation {
    label: string;
    textEdit?: TextEdit;
    additionalTextEdits?: TextEdit[];

    constructor(label: string) {
        if (!label || typeof label !== 'string') {
            throw illegalArgument('label');
        }
        this.label = label;
    }
}

export enum ColorFormat {
    RGB = 0,
    HEX = 1,
    HSL = 2
}

export class FoldingRange {
    start: number;
    end: number;
    kind?: FoldingRangeKind;

    constructor(start: number, end: number, kind?: FoldingRangeKind) {
        this.start = start;
        this.end = end;
        this.kind = kind;
    }
}

export enum FoldingRangeKind {
    Comment = 1,
    Imports = 2,
    Region = 3
}

export class SelectionRange {

    range: Range;
    parent?: SelectionRange;

    constructor(range: Range, parent?: SelectionRange) {
        this.range = range;
        this.parent = parent;

        if (parent && !parent.range.contains(this.range)) {
            throw new Error('Invalid argument: parent must contain this range');
        }
    }
}

/**
 * Enumeration of the supported operating systems.
 */
export enum OperatingSystem {
    Windows = 'Windows',
    Linux = 'Linux',
    OSX = 'OSX'
}

/** The areas of the application shell where webview panel can reside. */
export enum WebviewPanelTargetArea {
    Main = 'main',
    Left = 'left',
    Right = 'right',
    Bottom = 'bottom'
}
export class CallHierarchyItem {
    _sessionId?: string;
    _itemId?: string;

    kind: SymbolKind;
    name: string;
    detail?: string;
    uri: URI;
    range: Range;
    selectionRange: Range;

    constructor(kind: SymbolKind, name: string, detail: string, uri: URI, range: Range, selectionRange: Range) {
        this.kind = kind;
        this.name = name;
        this.detail = detail;
        this.uri = uri;
        this.range = range;
        this.selectionRange = selectionRange;
    }

    static isCallHierarchyItem(thing: {}): thing is theia.CallHierarchyItem {
        if (thing instanceof CallHierarchyItem) {
            return true;
        }
        if (!thing) {
            return false;
        }
        return typeof (<CallHierarchyItem>thing).kind === 'number' &&
            typeof (<CallHierarchyItem>thing).name === 'string' &&
            URI.isUri((<CallHierarchyItem>thing).uri) &&
            Range.isRange((<CallHierarchyItem>thing).range) &&
            Range.isRange((<CallHierarchyItem>thing).selectionRange);
    }
}

export class CallHierarchyIncomingCall {

    from: theia.CallHierarchyItem;
    fromRanges: theia.Range[];

    constructor(item: theia.CallHierarchyItem, fromRanges: theia.Range[]) {
        this.fromRanges = fromRanges;
        this.from = item;
    }
}

export class CallHierarchyOutgoingCall {

    to: theia.CallHierarchyItem;
    fromRanges: theia.Range[];

    constructor(item: theia.CallHierarchyItem, fromRanges: theia.Range[]) {
        this.fromRanges = fromRanges;
        this.to = item;
    }
}
