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

import { Position, Range, Location } from '@theia/core/shared/vscode-languageserver-types';
import * as lsp from '@theia/core/shared/vscode-languageserver-types';
import URI from '@theia/core/lib/common/uri';
import { Event, Disposable, TextDocumentContentChangeDelta, RecursivePartial } from '@theia/core/lib/common';
import { Saveable, Navigatable, Widget, WidgetOpenerOptions, NavigatableWidgetOptions } from '@theia/core/lib/browser';
import { EditorDecoration } from './decorations';
import { Reference } from '@theia/core/lib/common';

export {
    Position, Range, Location
};

export const TextEditorProvider = Symbol('TextEditorProvider');
export type TextEditorProvider = (uri: URI, options?: EditorFactoryOptions) => Promise<TextEditor>;

export interface EditorOpenerOptions extends WidgetOpenerOptions {
    selection?: RecursivePartial<Range>;
    preview?: boolean;
    counter?: number
}

export interface EditorFactoryOptions extends EditorOpenerOptions, NavigatableWidgetOptions { counter: number }

export interface TextEditorDocument extends lsp.TextDocument, Saveable, Disposable {
    getLineContent(lineNumber: number): string;
    getLineMaxColumn(lineNumber: number): number;
    /**
     * @since 1.8.0
     */
    findMatches?(options: FindMatchesOptions): FindMatch[];
}

// Refactoring
export { TextDocumentContentChangeDelta };

export interface TextDocumentChangeEvent {
    readonly document: TextEditorDocument;
    readonly contentChanges: TextDocumentContentChangeDelta[];
}

/**
 * Type of hit element with the mouse in the editor.
 * Copied from monaco editor.
 */
export enum MouseTargetType {
    /**
     * Mouse is on top of an unknown element.
     */
    UNKNOWN = 0,
    /**
     * Mouse is on top of the textarea used for input.
     */
    TEXTAREA = 1,
    /**
     * Mouse is on top of the glyph margin
     */
    GUTTER_GLYPH_MARGIN = 2,
    /**
     * Mouse is on top of the line numbers
     */
    GUTTER_LINE_NUMBERS = 3,
    /**
     * Mouse is on top of the line decorations
     */
    GUTTER_LINE_DECORATIONS = 4,
    /**
     * Mouse is on top of the whitespace left in the gutter by a view zone.
     */
    GUTTER_VIEW_ZONE = 5,
    /**
     * Mouse is on top of text in the content.
     */
    CONTENT_TEXT = 6,
    /**
     * Mouse is on top of empty space in the content (e.g. after line text or below last line)
     */
    CONTENT_EMPTY = 7,
    /**
     * Mouse is on top of a view zone in the content.
     */
    CONTENT_VIEW_ZONE = 8,
    /**
     * Mouse is on top of a content widget.
     */
    CONTENT_WIDGET = 9,
    /**
     * Mouse is on top of the decorations overview ruler.
     */
    OVERVIEW_RULER = 10,
    /**
     * Mouse is on top of a scrollbar.
     */
    SCROLLBAR = 11,
    /**
     * Mouse is on top of an overlay widget.
     */
    OVERLAY_WIDGET = 12,
    /**
     * Mouse is outside of the editor.
     */
    OUTSIDE_EDITOR = 13,
}

export interface MouseTarget {
    /**
     * The target element
     */
    readonly element?: Element;
    /**
     * The target type
     */
    readonly type: MouseTargetType;
    /**
     * The 'approximate' editor position
     */
    readonly position?: Position;
    /**
     * Desired mouse column (e.g. when position.column gets clamped to text length -- clicking after text on a line).
     */
    readonly mouseColumn: number;
    /**
     * The 'approximate' editor range
     */
    readonly range?: Range;
    /**
     * Some extra detail.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly detail: any;
}

export interface EditorMouseEvent {
    readonly event: MouseEvent;
    readonly target: MouseTarget;
}

export const enum EncodingMode {

    /**
     * Instructs the encoding support to encode the current input with the provided encoding
     */
    Encode,

    /**
     * Instructs the encoding support to decode the current input with the provided encoding
     */
    Decode
}

/**
 * Options for searching in an editor.
 */
export interface FindMatchesOptions {
    /**
     * The string used to search. If it is a regular expression, set `isRegex` to true.
     */
    searchString: string;
    /**
     * Used to indicate that `searchString` is a regular expression.
     */
    isRegex: boolean;
    /**
     * Force the matching to match lower/upper case exactly.
     */
    matchCase: boolean;
    /**
     * Force the matching to match entire words only.
     */
    matchWholeWord: boolean;
    /**
     * Limit the number of results.
     */
    limitResultCount?: number;
}

/**
 * Representation of a find match.
 */
export interface FindMatch {
    /**
     * The textual match.
     */
    readonly matches: string[];
    /**
     * The range for the given match.
     */
    readonly range: Range;
}

export interface TextEditor extends Disposable, TextEditorSelection, Navigatable {
    readonly node: HTMLElement;

    readonly uri: URI;
    readonly document: TextEditorDocument;
    readonly onDocumentContentChanged: Event<TextDocumentChangeEvent>;

    cursor: Position;
    readonly onCursorPositionChanged: Event<Position>;

    selection: Range;
    readonly onSelectionChanged: Event<Range>;

    /**
     * The text editor should be revealed,
     * otherwise it won't receive the focus.
     */
    focus(): void;
    blur(): void;
    isFocused(): boolean;
    readonly onFocusChanged: Event<boolean>;

    readonly onMouseDown: Event<EditorMouseEvent>;

    readonly onScrollChanged: Event<void>;
    getVisibleRanges(): Range[];

    revealPosition(position: Position, options?: RevealPositionOptions): void;
    revealRange(range: Range, options?: RevealRangeOptions): void;

    /**
     * Rerender the editor.
     */
    refresh(): void;
    /**
     * Resize the editor to fit its node.
     */
    resizeToFit(): void;
    setSize(size: Dimension): void;

    /**
     * Applies given new decorations, and removes old decorations identified by ids.
     *
     * @returns identifiers of applied decorations, which can be removed in next call.
     */
    deltaDecorations(params: DeltaDecorationParams): string[];

    /**
     * Gets all the decorations for the lines between `startLineNumber` and `endLineNumber` as an array.
     * @param startLineNumber The start line number.
     * @param endLineNumber The end line number.
     * @return An array with the decorations.
     */
    getLinesDecorations(startLineNumber: number, endLineNumber: number): EditorDecoration[];

    getVisibleColumn(position: Position): number;

    /**
     * Replaces the text of source given in ReplaceTextParams.
     * @param params: ReplaceTextParams
     */
    replaceText(params: ReplaceTextParams): Promise<boolean>;

    /**
     * Execute edits on the editor.
     * @param edits: edits created with `lsp.TextEdit.replace`, `lsp.TextEdit.insert`, `lsp.TextEdit.del`
     */
    executeEdits(edits: lsp.TextEdit[]): boolean;

    storeViewState(): object;
    restoreViewState(state: object): void;

    detectLanguage(): void;
    setLanguage(languageId: string): void;
    readonly onLanguageChanged: Event<string>;

    /**
     * Gets the encoding of the input if known.
     */
    getEncoding(): string;

    /**
     * Sets the encoding for the input for saving.
     */
    setEncoding(encoding: string, mode: EncodingMode): void;

    readonly onEncodingChanged: Event<string>;
}

export interface Dimension {
    width: number;
    height: number;
}

export interface TextEditorSelection {
    uri: URI
    cursor?: Position
    selection?: Range
}

export interface RevealPositionOptions {
    vertical: 'auto' | 'center' | 'centerIfOutsideViewport';
    horizontal?: boolean;
}

export interface RevealRangeOptions {
    at: 'auto' | 'center' | 'top' | 'centerIfOutsideViewport';
}

export interface DeltaDecorationParams {
    oldDecorations: string[];
    newDecorations: EditorDecoration[];
}

export interface ReplaceTextParams {
    /**
     * the source to edit
     */
    source: string;
    /**
     * the replace operations
     */
    replaceOperations: ReplaceOperation[];
}

export interface ReplaceOperation {
    /**
     * the position that shall be replaced
     */
    range: Range;
    /**
     * the text to replace with
     */
    text: string;
}

export namespace TextEditorSelection {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function is(e: any): e is TextEditorSelection {
        return e && e['uri'] instanceof URI;
    }
}

export namespace CustomEditorWidget {
    export function is(arg: Widget | undefined): arg is CustomEditorWidget {
        return !!arg && 'modelRef' in arg;
    }
}

export interface CustomEditorWidget extends Widget {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly modelRef: Reference<any>;
}
