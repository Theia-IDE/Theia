/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
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

import { Position } from 'vscode-languageserver-types';
import { TextDocumentSaveReason, TextDocumentContentChangeEvent } from 'vscode-languageserver-protocol';
import { TextEditorDocument, EncodingMode, FindMatchesOptions, FindMatch, EditorPreferences, DEFAULT_WORD_SEPARATORS } from '@theia/editor/lib/browser';
import { DisposableCollection, Disposable } from '@theia/core/lib/common/disposable';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { CancellationTokenSource, CancellationToken } from '@theia/core/lib/common/cancellation';
import { Resource, ResourceError, ResourceVersion } from '@theia/core/lib/common/resource';
import { Range } from 'vscode-languageserver-types';
import { Saveable, SaveOptions } from '@theia/core/lib/browser/saveable';
import { MonacoToProtocolConverter } from './monaco-to-protocol-converter';
import { ProtocolToMonacoConverter } from './protocol-to-monaco-converter';
import { ILogger, Loggable, Log } from '@theia/core/lib/common/logger';

export {
    TextDocumentSaveReason
};

type ITextEditorModel = monaco.editor.ITextEditorModel;

export interface WillSaveMonacoModelEvent {
    readonly model: MonacoEditorModel;
    readonly reason: TextDocumentSaveReason;
    readonly options?: SaveOptions;
    waitUntil(thenable: Thenable<monaco.editor.IIdentifiedSingleEditOperation[]>): void;
}

export interface MonacoModelContentChangedEvent {
    readonly model: MonacoEditorModel;
    readonly contentChanges: TextDocumentContentChangeEvent[];
}

export class MonacoEditorModel implements ITextEditorModel, TextEditorDocument {

    autoSave: 'on' | 'off' = 'on';
    autoSaveDelay: number = 500;
    /* @deprecated there is no general save timeout, each participant should introduce a sensible timeout  */
    readonly onWillSaveLoopTimeOut = 1500;
    protected bufferSavedVersionId: number;

    protected model: monaco.editor.IModel;
    protected readonly resolveModel: Promise<void>;

    protected readonly toDispose = new DisposableCollection();
    protected readonly toDisposeOnAutoSave = new DisposableCollection();

    protected readonly onDidChangeContentEmitter = new Emitter<MonacoModelContentChangedEvent>();
    readonly onDidChangeContent = this.onDidChangeContentEmitter.event;

    protected readonly onDidSaveModelEmitter = new Emitter<monaco.editor.IModel>();
    readonly onDidSaveModel = this.onDidSaveModelEmitter.event;

    protected readonly onWillSaveModelEmitter = new Emitter<WillSaveMonacoModelEvent>();
    readonly onWillSaveModel = this.onWillSaveModelEmitter.event;

    protected readonly onDidChangeValidEmitter = new Emitter<void>();
    readonly onDidChangeValid = this.onDidChangeValidEmitter.event;

    protected readonly onDidChangeEncodingEmitter = new Emitter<string>();
    readonly onDidChangeEncoding = this.onDidChangeEncodingEmitter.event;

    private preferredEncoding: string | undefined;
    private contentEncoding: string | undefined;

    protected resourceVersion: ResourceVersion | undefined;

    constructor(
        protected readonly resource: Resource,
        protected readonly m2p: MonacoToProtocolConverter,
        protected readonly p2m: ProtocolToMonacoConverter,
        protected readonly logger?: ILogger,
        protected readonly editorPreferences?: EditorPreferences
    ) {
        this.toDispose.push(resource);
        this.toDispose.push(this.toDisposeOnAutoSave);
        this.toDispose.push(this.onDidChangeContentEmitter);
        this.toDispose.push(this.onDidSaveModelEmitter);
        this.toDispose.push(this.onWillSaveModelEmitter);
        this.toDispose.push(this.onDirtyChangedEmitter);
        this.toDispose.push(this.onDidChangeValidEmitter);
        this.toDispose.push(Disposable.create(() => this.cancelSave()));
        this.toDispose.push(Disposable.create(() => this.cancelSync()));
        this.resolveModel = this.readContents().then(
            content => this.initialize(content || '')
        );
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    setEncoding(encoding: string, mode: EncodingMode): Promise<void> {
        if (mode === EncodingMode.Decode && this.dirty) {
            return Promise.resolve();
        }
        if (!this.setPreferredEncoding(encoding)) {
            return Promise.resolve();
        }
        if (mode === EncodingMode.Decode) {
            return this.sync();
        }
        return this.scheduleSave(TextDocumentSaveReason.Manual, this.cancelSave(), true);
    }

    getEncoding(): string | undefined {
        return this.preferredEncoding || this.contentEncoding;
    }

    protected setPreferredEncoding(encoding: string): boolean {
        if (encoding === this.preferredEncoding || (!this.preferredEncoding && encoding === this.contentEncoding)) {
            return false;
        }
        this.preferredEncoding = encoding;
        this.onDidChangeEncodingEmitter.fire(encoding);
        return true;
    }

    protected updateContentEncoding(): void {
        const contentEncoding = this.resource.encoding;
        if (!contentEncoding || this.contentEncoding === contentEncoding) {
            return;
        }
        this.contentEncoding = contentEncoding;
        if (!this.preferredEncoding) {
            this.onDidChangeEncodingEmitter.fire(contentEncoding);
        }
    }

    /**
     * #### Important
     * Only this method can create an instance of `monaco.editor.IModel`,
     * there should not be other calls to `monaco.editor.createModel`.
     */
    protected initialize(value: string | monaco.editor.ITextBufferFactory): void {
        if (!this.toDispose.disposed) {
            const uri = monaco.Uri.parse(this.resource.uri.toString());
            let firstLine;
            if (typeof value === 'string') {
                firstLine = value;
                const firstLF = value.indexOf('\n');
                if (firstLF !== -1) {
                    firstLine = value.substring(0, firstLF);
                }
            } else {
                firstLine = value.getFirstLineText(1000);
            }
            const languageSelection = monaco.services.StaticServices.modeService.get().createByFilepathOrFirstLine(uri, firstLine);
            this.model = monaco.services.StaticServices.modelService.get().createModel(value, languageSelection, uri);
            this.resourceVersion = this.resource.version;
            this.updateSavedVersionId();
            this.toDispose.push(this.model);
            this.toDispose.push(this.model.onDidChangeContent(event => this.fireDidChangeContent(event)));
            if (this.resource.onDidChangeContents) {
                this.toDispose.push(this.resource.onDidChangeContents(() => this.sync()));
            }
        }
    }

    /**
     * Use `valid` to access it.
     * Use `setValid` to mutate it.
     */
    protected _valid = false;
    /**
     * Whether it is possible to load content from the underlying resource.
     */
    get valid(): boolean {
        return this._valid;
    }
    protected setValid(valid: boolean): void {
        if (valid === this._valid) {
            return;
        }
        this._valid = valid;
        this.onDidChangeValidEmitter.fire(undefined);
    }

    protected _dirty = false;
    get dirty(): boolean {
        return this._dirty;
    }
    protected setDirty(dirty: boolean): void {
        if (dirty === this._dirty) {
            return;
        }
        this._dirty = dirty;
        if (dirty === false) {
            this.updateSavedVersionId();
        }
        this.onDirtyChangedEmitter.fire(undefined);
    }

    private updateSavedVersionId(): void {
        this.bufferSavedVersionId = this.model.getAlternativeVersionId();
    }

    protected readonly onDirtyChangedEmitter = new Emitter<void>();
    get onDirtyChanged(): Event<void> {
        return this.onDirtyChangedEmitter.event;
    }

    get uri(): string {
        return this.resource.uri.toString();
    }

    protected _languageId: string | undefined;
    get languageId(): string {
        return this._languageId !== undefined ? this._languageId : this.model.getModeId();
    }
    /**
     * It's a hack to dispatch close notification with an old language id, don't use it.
     */
    setLanguageId(languageId: string | undefined): void {
        this._languageId = languageId;
    }

    get version(): number {
        return this.model.getVersionId();
    }

    /**
     * Return selected text by Range or all text by default
     */
    getText(range?: Range): string {
        if (!range) {
            return this.model.getValue();
        } else {
            return this.model.getValueInRange(this.p2m.asRange(range));
        }
    }

    positionAt(offset: number): Position {
        const { lineNumber, column } = this.model.getPositionAt(offset);
        return this.m2p.asPosition(lineNumber, column);
    }

    offsetAt(position: Position): number {
        return this.model.getOffsetAt(this.p2m.asPosition(position));
    }

    get lineCount(): number {
        return this.model.getLineCount();
    }

    /**
     * Retrieves a line in a text document expressed as a one-based position.
     */
    getLineContent(lineNumber: number): string {
        return this.model.getLineContent(lineNumber);
    }

    getLineMaxColumn(lineNumber: number): number {
        return this.model.getLineMaxColumn(lineNumber);
    }

    get readOnly(): boolean {
        return this.resource.saveContents === undefined;
    }

    get onDispose(): monaco.IEvent<void> {
        return this.toDispose.onDispose;
    }

    get textEditorModel(): monaco.editor.IModel {
        return this.model;
    }

    /**
     * Find all matches in an editor for the given options.
     * @param options the options for finding matches.
     *
     * @returns the list of matches.
     */
    findMatches(options: FindMatchesOptions): FindMatch[] {
        const wordSeparators = this.editorPreferences ? this.editorPreferences['editor.wordSeparators'] : DEFAULT_WORD_SEPARATORS;
        const results: monaco.editor.FindMatch[] = this.model.findMatches(
            options.searchString,
            false,
            options.isRegex,
            options.matchCase,
            // eslint-disable-next-line no-null/no-null
            options.matchWholeWord ? wordSeparators : null,
            true,
            options.limitResultCount
        );
        const extractedMatches: FindMatch[] = [];
        results.forEach(r => {
            if (r.matches) {
                extractedMatches.push({
                    matches: r.matches,
                    range: Range.create(r.range.startLineNumber, r.range.startColumn, r.range.endLineNumber, r.range.endColumn)
                });
            }
        });
        return extractedMatches;
    }

    async load(): Promise<MonacoEditorModel> {
        await this.resolveModel;
        return this;
    }

    save(options?: SaveOptions): Promise<void> {
        return this.scheduleSave(TextDocumentSaveReason.Manual, undefined, undefined, options);
    }

    protected pendingOperation = Promise.resolve();
    protected async run(operation: () => Promise<void>): Promise<void> {
        if (this.toDispose.disposed) {
            return;
        }
        return this.pendingOperation = this.pendingOperation.then(async () => {
            try {
                await operation();
            } catch (e) {
                console.error(e);
                throw e;
            }
        });
    }

    protected syncCancellationTokenSource = new CancellationTokenSource();
    protected cancelSync(): CancellationToken {
        this.trace(log => log('MonacoEditorModel.cancelSync'));
        this.syncCancellationTokenSource.cancel();
        this.syncCancellationTokenSource = new CancellationTokenSource();
        return this.syncCancellationTokenSource.token;
    }

    async sync(): Promise<void> {
        const token = this.cancelSync();
        return this.run(() => this.doSync(token));
    }
    protected async doSync(token: CancellationToken): Promise<void> {
        this.trace(log => log('MonacoEditorModel.doSync - enter'));
        if (token.isCancellationRequested) {
            this.trace(log => log('MonacoEditorModel.doSync - exit - cancelled'));
            return;
        }

        const value = await this.readContents();
        if (value === undefined) {
            this.trace(log => log('MonacoEditorModel.doSync - exit - resource not found'));
            return;
        }
        if (token.isCancellationRequested) {
            this.trace(log => log('MonacoEditorModel.doSync - exit - cancelled while looking for a resource'));
            return;
        }
        if (this._dirty) {
            this.trace(log => log('MonacoEditorModel.doSync - exit - pending dirty changes'));
            return;
        }

        this.resourceVersion = this.resource.version;
        this.updateModel(() => monaco.services.StaticServices.modelService.get().updateModel(this.model, value), {
            ignoreDirty: true,
            ignoreContentChanges: true
        });
        this.trace(log => log('MonacoEditorModel.doSync - exit'));
    }
    protected async readContents(): Promise<string | monaco.editor.ITextBufferFactory | undefined> {
        try {
            const options = { encoding: this.getEncoding() };
            const content = await (this.resource.readStream ? this.resource.readStream(options) : this.resource.readContents(options));
            let value;
            if (typeof content === 'string') {
                value = content;
            } else {
                value = monaco.textModel.createTextBufferFactoryFromStream(content);
            }
            this.updateContentEncoding();
            this.setValid(true);
            return value;
        } catch (e) {
            this.setValid(false);
            if (ResourceError.NotFound.is(e)) {
                return undefined;
            }
            throw e;
        }
    }

    protected ignoreDirtyEdits = false;
    protected markAsDirty(): void {
        this.trace(log => log('MonacoEditorModel.markAsDirty - enter'));
        if (this.ignoreDirtyEdits) {
            this.trace(log => log('MonacoEditorModel.markAsDirty - exit - ignoring dirty changes enabled'));
            return;
        }
        this.cancelSync();
        this.setDirty(true);
        this.doAutoSave();
        this.trace(log => log('MonacoEditorModel.markAsDirty - exit'));
    }

    protected doAutoSave(): void {
        if (this.autoSave === 'on') {
            const token = this.cancelSave();
            this.toDisposeOnAutoSave.dispose();
            const handle = window.setTimeout(() => {
                this.scheduleSave(TextDocumentSaveReason.AfterDelay, token);
            }, this.autoSaveDelay);
            this.toDisposeOnAutoSave.push(Disposable.create(() =>
                window.clearTimeout(handle))
            );
        }
    }

    protected saveCancellationTokenSource = new CancellationTokenSource();
    protected cancelSave(): CancellationToken {
        this.trace(log => log('MonacoEditorModel.cancelSave'));
        this.saveCancellationTokenSource.cancel();
        this.saveCancellationTokenSource = new CancellationTokenSource();
        return this.saveCancellationTokenSource.token;
    }

    protected scheduleSave(reason: TextDocumentSaveReason, token: CancellationToken = this.cancelSave(), overwriteEncoding?: boolean, options?: SaveOptions): Promise<void> {
        return this.run(() => this.doSave(reason, token, overwriteEncoding, options));
    }

    protected ignoreContentChanges = false;
    protected readonly contentChanges: TextDocumentContentChangeEvent[] = [];
    protected pushContentChanges(contentChanges: TextDocumentContentChangeEvent[]): void {
        if (!this.ignoreContentChanges) {
            this.contentChanges.push(...contentChanges);
        }
    }

    protected fireDidChangeContent(event: monaco.editor.IModelContentChangedEvent): void {
        this.trace(log => log(`MonacoEditorModel.fireDidChangeContent - enter - ${JSON.stringify(event, undefined, 2)}`));
        if (this.model.getAlternativeVersionId() === this.bufferSavedVersionId) {
            this.setDirty(false);
        } else {
            this.markAsDirty();
        }

        const changeContentEvent = this.asContentChangedEvent(event);
        this.onDidChangeContentEmitter.fire(changeContentEvent);
        this.pushContentChanges(changeContentEvent.contentChanges);
        this.trace(log => log('MonacoEditorModel.fireDidChangeContent - exit'));
    }
    protected asContentChangedEvent(event: monaco.editor.IModelContentChangedEvent): MonacoModelContentChangedEvent {
        const contentChanges = event.changes.map(change => this.asTextDocumentContentChangeEvent(change));
        return { model: this, contentChanges };
    }
    protected asTextDocumentContentChangeEvent(change: monaco.editor.IModelContentChange): TextDocumentContentChangeEvent {
        const range = this.m2p.asRange(change.range);
        const rangeLength = change.rangeLength;
        const text = change.text;
        return { range, rangeLength, text };
    }

    protected applyEdits(
        operations: monaco.editor.IIdentifiedSingleEditOperation[],
        options?: Partial<MonacoEditorModel.ApplyEditsOptions>
    ): monaco.editor.IIdentifiedSingleEditOperation[] {
        return this.updateModel(() => this.model.applyEdits(operations), options);
    }

    protected updateModel<T>(doUpdate: () => T, options?: Partial<MonacoEditorModel.ApplyEditsOptions>): T {
        const resolvedOptions: MonacoEditorModel.ApplyEditsOptions = {
            ignoreDirty: false,
            ignoreContentChanges: false,
            ...options
        };
        const { ignoreDirtyEdits, ignoreContentChanges } = this;
        this.ignoreDirtyEdits = resolvedOptions.ignoreDirty;
        this.ignoreContentChanges = resolvedOptions.ignoreContentChanges;
        try {
            return doUpdate();
        } finally {
            this.ignoreDirtyEdits = ignoreDirtyEdits;
            this.ignoreContentChanges = ignoreContentChanges;
        }
    }

    protected async doSave(reason: TextDocumentSaveReason, token: CancellationToken, overwriteEncoding?: boolean, options?: SaveOptions): Promise<void> {
        if (token.isCancellationRequested || !this.resource.saveContents) {
            return;
        }

        await this.fireWillSaveModel(reason, token, options);
        if (token.isCancellationRequested) {
            return;
        }

        const changes = [...this.contentChanges];
        if (changes.length === 0 && !overwriteEncoding && reason !== TextDocumentSaveReason.Manual) {
            return;
        }

        const contentLength = this.model.getValueLength();
        const content = this.model.createSnapshot() || this.model.getValue();
        try {
            const encoding = this.getEncoding();
            const version = this.resourceVersion;
            await Resource.save(this.resource, { changes, content, contentLength, options: { encoding, overwriteEncoding, version } }, token);
            this.contentChanges.splice(0, changes.length);
            this.resourceVersion = this.resource.version;
            this.updateContentEncoding();
            this.setValid(true);

            if (token.isCancellationRequested) {
                return;
            }

            this.setDirty(false);
            this.fireDidSaveModel();
        } catch (e) {
            if (!ResourceError.OutOfSync.is(e)) {
                throw e;
            }
        }
    }

    protected async fireWillSaveModel(reason: TextDocumentSaveReason, token: CancellationToken, options?: SaveOptions): Promise<void> {
        type EditContributor = Thenable<monaco.editor.IIdentifiedSingleEditOperation[]>;

        const firing = this.onWillSaveModelEmitter.sequence(async listener => {
            if (token.isCancellationRequested) {
                return false;
            }
            const waitables: EditContributor[] = [];
            const { version } = this;

            const event = {
                model: this, reason, options,
                waitUntil: (thenable: EditContributor) => {
                    if (Object.isFrozen(waitables)) {
                        throw new Error('waitUntil cannot be called asynchronously.');
                    }
                    waitables.push(thenable);
                }
            };

            // Fire.
            try {
                listener(event);
            } catch (err) {
                console.error(err);
                return true;
            }

            // Asynchronous calls to `waitUntil` should fail.
            Object.freeze(waitables);

            // Wait for all promises.
            const edits = await Promise.all(waitables).then(allOperations =>
                ([] as monaco.editor.IIdentifiedSingleEditOperation[]).concat(...allOperations)
            );
            if (token.isCancellationRequested) {
                return false;
            }

            // In a perfect world, we should only apply edits if document is clean.
            if (version !== this.version) {
                console.error('onWillSave listeners should provide edits, not directly alter the document.');
            }

            // Finally apply edits provided by this listener before firing the next.
            if (edits && edits.length > 0) {
                this.applyEdits(edits, {
                    ignoreDirty: true,
                });
            }

            return true;
        });

        try {
            await firing;
        } catch (e) {
            console.error(e);
        }
    }

    protected fireDidSaveModel(): void {
        this.onDidSaveModelEmitter.fire(this.model);
    }

    async revert(options?: Saveable.RevertOptions): Promise<void> {
        this.trace(log => log('MonacoEditorModel.revert - enter'));
        this.cancelSave();
        const soft = options && options.soft;
        if (soft !== true) {
            const dirty = this._dirty;
            this._dirty = false;
            try {
                await this.sync();
            } finally {
                this._dirty = dirty;
            }
        }
        this.setDirty(false);
        this.trace(log => log('MonacoEditorModel.revert - exit'));
    }

    createSnapshot(): object {
        return {
            value: this.getText()
        };
    }

    applySnapshot(snapshot: { value: string }): void {
        this.model.setValue(snapshot.value);
    }

    protected trace(loggable: Loggable): void {
        if (this.logger) {
            this.logger.debug((log: Log) =>
                loggable((message, ...params) => log(message, ...params, this.resource.uri.toString(true)))
            );
        }
    }

}
export namespace MonacoEditorModel {
    export interface ApplyEditsOptions {
        ignoreDirty: boolean
        ignoreContentChanges: boolean
    }
}
