/********************************************************************************
 * Copyright (C) 2018 Ericsson and others.
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
/* eslint-disable no-null/no-null */

import * as jsoncparser from 'jsonc-parser';
import { JSONExt } from '@theia/core/shared/@phosphor/coreutils';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { MessageService } from '@theia/core/lib/common/message-service';
import { Disposable } from '@theia/core/lib/common/disposable';
import { PreferenceProvider, PreferenceSchemaProvider, PreferenceScope, PreferenceProviderDataChange, PreferenceService } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { PreferenceConfigurations } from '@theia/core/lib/browser/preferences/preference-configurations';
import { MonacoTextModelService } from '@theia/monaco/lib/browser/monaco-text-model-service';
import { MonacoEditorModel } from '@theia/monaco/lib/browser/monaco-editor-model';
import { MonacoWorkspace } from '@theia/monaco/lib/browser/monaco-workspace';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { EditorManager } from '@theia/editor/lib/browser';

interface EnqueuedPreferenceChange {
    key: string,
    value: any,
    editResolver: Deferred<boolean | Promise<boolean>>,
}

@injectable()
export abstract class AbstractResourcePreferenceProvider extends PreferenceProvider {

    protected preferences: { [key: string]: any } = {};
    protected model: MonacoEditorModel | undefined;
    protected editQueue: EnqueuedPreferenceChange[] = [];
    protected readonly loading = new Deferred();
    protected dirtyEditorHandled = new Deferred();
    protected pendingTransaction = new Deferred();

    @inject(PreferenceService) protected readonly preferenceService: PreferenceService;
    @inject(MessageService) protected readonly messageService: MessageService;
    @inject(PreferenceSchemaProvider) protected readonly schemaProvider: PreferenceSchemaProvider;

    @inject(PreferenceConfigurations)
    protected readonly configurations: PreferenceConfigurations;

    @inject(MonacoTextModelService)
    protected readonly textModelService: MonacoTextModelService;

    @inject(MonacoWorkspace)
    protected readonly workspace: MonacoWorkspace;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @postConstruct()
    protected async init(): Promise<void> {
        const uri = this.getUri();
        this.toDispose.push(Disposable.create(() => this.loading.reject(new Error(`preference provider for '${uri}' was disposed`))));
        this._ready.resolve();
        this.dirtyEditorHandled.resolve();
        this.pendingTransaction.resolve();

        const reference = await this.textModelService.createModelReference(uri);
        if (this.toDispose.disposed) {
            reference.dispose();
            return;
        }

        this.model = reference.object;
        this.loading.resolve();

        this.toDispose.push(reference);
        this.toDispose.push(Disposable.create(() => this.model = undefined));

        this.readPreferences();
        this.toDispose.push(this.model.onDidChangeContent(() => this.readPreferences()));
        this.toDispose.push(this.model.onDirtyChanged(() => this.readPreferences()));
        this.toDispose.push(this.model.onDidChangeValid(() => this.readPreferences()));

        this.toDispose.push(Disposable.create(() => this.reset()));
    }

    protected abstract getUri(): URI;
    protected abstract getScope(): PreferenceScope;

    protected get valid(): boolean {
        return this.model && this.model.valid || false;
    }

    getConfigUri(): URI;
    getConfigUri(resourceUri: string | undefined): URI | undefined;
    getConfigUri(resourceUri?: string): URI | undefined {
        if (!resourceUri) {
            return this.getUri();
        }
        return this.valid && this.contains(resourceUri) ? this.getUri() : undefined;
    }

    contains(resourceUri: string | undefined): boolean {
        if (!resourceUri) {
            return true;
        }
        const domain = this.getDomain();
        if (!domain) {
            return true;
        }
        const resourcePath = new URI(resourceUri).path;
        return domain.some(uri => new URI(uri).path.relativity(resourcePath) >= 0);
    }

    getPreferences(resourceUri?: string): { [key: string]: any } {
        return this.valid && this.contains(resourceUri) ? this.preferences : {};
    }

    async setPreference(key: string, value: any, resourceUri?: string): Promise<boolean> {
        await this.loading.promise;
        // Wait for save of previous transaction
        await this.pendingTransaction.promise;
        if (!this.model) {
            return false;
        }
        if (!this.contains(resourceUri)) {
            return false;
        }
        const isFirstEditInQueue = !this.editQueue.length;
        const mustHandleDirty = isFirstEditInQueue && this.model.dirty;
        if (mustHandleDirty) {
            this.dirtyEditorHandled = new Deferred();
            this.handleDirtyEditor();
        }
        const editResolver = new Deferred<boolean | Promise<boolean>>();
        this.editQueue.push({ key, value, editResolver });
        if (isFirstEditInQueue) {
            this.doSetPreferences();
        }
        return editResolver.promise;
    }

    async doSetPreferences(): Promise<void> {
        const localPendingChanges = new Deferred<boolean>();
        await this.dirtyEditorHandled.promise;
        while (this.editQueue.length) {
            const { key, value, editResolver } = this.editQueue.shift()!;
            const result = await this.doSetPreference(key, value) ? localPendingChanges.promise : false;
            editResolver.resolve(result);
        }
        let success = true;
        // Defer new actions until transaction complete.
        // Prevents the dirty-editor toast from appearing if save cycle in progress.
        this.pendingTransaction = new Deferred();
        try {
            if (this.model?.dirty) {
                await this.model.save();
                // On save, the file change handler will set ._pendingChanges
                success = await this.pendingChanges;
            }
        } catch {
            success = false;
        }
        this.pendingTransaction.resolve();
        localPendingChanges.resolve(success);
    }

    protected async doSetPreference(key: string, value: any): Promise<boolean> {
        if (!this.model) {
            return false;
        }
        const path = this.getPath(key);
        if (!path) {
            return false;
        }
        try {
            const content = this.model.getText().trim();
            if (!content && value === undefined) {
                return true;
            }
            const textModel = this.model.textEditorModel;
            const editOperations: monaco.editor.IIdentifiedSingleEditOperation[] = [];
            if (path.length || value !== undefined) {
                const { insertSpaces, tabSize, defaultEOL } = textModel.getOptions();
                for (const edit of jsoncparser.modify(content, path, value, {
                    formattingOptions: {
                        insertSpaces,
                        tabSize,
                        eol: defaultEOL === monaco.editor.DefaultEndOfLine.LF ? '\n' : '\r\n'
                    }
                })) {
                    const start = textModel.getPositionAt(edit.offset);
                    const end = textModel.getPositionAt(edit.offset + edit.length);
                    editOperations.push({
                        range: monaco.Range.fromPositions(start, end),
                        text: edit.content || null,
                        forceMoveMarkers: false
                    });
                }
            } else {
                editOperations.push({
                    range: textModel.getFullModelRange(),
                    text: null,
                    forceMoveMarkers: false
                });
            }
            await this.workspace.applyBackgroundEdit(this.model, editOperations, false);
            return true;
        } catch (e) {
            const message = `Failed to update the value of '${key}' in '${this.getUri()}'.`;
            this.messageService.error(`${message} Please check if it is corrupted.`);
            console.error(`${message}`, e);
            return false;
        }
    }

    protected async handleDirtyEditor(): Promise<void> {
        const msg = await this.messageService.error(
            'Unable to write preference change because the settings file is dirty. Please save the file and try again.',
            'Save and Retry', 'Open File');

        if (this.model) {
            if (msg === 'Open File') {
                this.editorManager.open(new URI(this.model.uri));
            } else if (msg === 'Save and Retry') {
                await this.model.save();
            }
        }
        if (msg !== 'Save and Retry') {
            this.editQueue.forEach(({ editResolver }) => editResolver.resolve(false));
            this.editQueue = [];
        }
        this.dirtyEditorHandled.resolve();
    }

    protected getPath(preferenceName: string): string[] | undefined {
        return [preferenceName];
    }

    /**
     * It HAS to be sync to ensure that `setPreference` returns only when values are updated
     * or any other operation modifying the monaco model content.
     */
    protected readPreferences(): void {
        const model = this.model;
        if (!model || model.dirty) {
            return;
        }
        try {
            let preferences;
            if (model.valid) {
                const content = model.getText();
                const jsonContent = this.parse(content);
                preferences = this.getParsedContent(jsonContent);
            } else {
                preferences = {};
            }
            this.handlePreferenceChanges(preferences);
        } catch (e) {
            console.error(`Failed to load preferences from '${this.getUri()}'.`, e);
        }
    }

    protected parse(content: string): any {
        content = content.trim();
        if (!content) {
            return undefined;
        }
        const strippedContent = jsoncparser.stripComments(content);
        return jsoncparser.parse(strippedContent);
    }

    protected handlePreferenceChanges(newPrefs: { [key: string]: any }): void {
        const oldPrefs = Object.assign({}, this.preferences);
        this.preferences = newPrefs;
        const prefNames = new Set([...Object.keys(oldPrefs), ...Object.keys(newPrefs)]);
        const prefChanges: PreferenceProviderDataChange[] = [];
        const uri = this.getUri();
        for (const prefName of prefNames.values()) {
            const oldValue = oldPrefs[prefName];
            const newValue = newPrefs[prefName];
            const schemaProperties = this.schemaProvider.getCombinedSchema().properties[prefName];
            if (schemaProperties) {
                const scope = schemaProperties.scope;
                // do not emit the change event if the change is made out of the defined preference scope
                if (!this.schemaProvider.isValidInScope(prefName, this.getScope())) {
                    console.warn(`Preference ${prefName} in ${uri} can only be defined in scopes: ${PreferenceScope.getScopeNames(scope).join(', ')}.`);
                    continue;
                }
            }
            if (newValue === undefined && oldValue !== newValue
                || oldValue === undefined && newValue !== oldValue // JSONExt.deepEqual() does not support handling `undefined`
                || !JSONExt.deepEqual(oldValue, newValue)) {
                prefChanges.push({
                    preferenceName: prefName, newValue, oldValue, scope: this.getScope(), domain: this.getDomain()
                });
            }
        }

        if (prefChanges.length > 0) { // do not emit the change event if the pref value is not changed
            this.emitPreferencesChangedEvent(prefChanges);
        }
    }

    protected reset(): void {
        const preferences = this.preferences;
        this.preferences = {};
        const changes: PreferenceProviderDataChange[] = [];
        for (const prefName of Object.keys(preferences)) {
            const value = preferences[prefName];
            if (value !== undefined) {
                changes.push({
                    preferenceName: prefName, newValue: undefined, oldValue: value, scope: this.getScope(), domain: this.getDomain()
                });
            }
        }
        if (changes.length > 0) {
            this.emitPreferencesChangedEvent(changes);
        }
    }

}
