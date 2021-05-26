/********************************************************************************
 * Copyright (C) 2020 TypeFox and others.
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

// @ts-check
describe('Saveable', function () {
    this.timeout(5000);

    const { assert } = chai;

    const { EditorManager } = require('@theia/editor/lib/browser/editor-manager');
    const { EditorWidget } = require('@theia/editor/lib/browser/editor-widget');
    const { PreferenceService } = require('@theia/core/lib/browser/preferences/preference-service');
    const { PreferenceScope } = require('@theia/core/lib/browser/preferences/preference-scope');
    const { Saveable, SaveableWidget } = require('@theia/core/lib/browser/saveable');
    const { WorkspaceService } = require('@theia/workspace/lib/browser/workspace-service');
    const { FileService } = require('@theia/filesystem/lib/browser/file-service');
    const { FileResource } = require('@theia/filesystem/lib/browser/file-resource');
    const { ETAG_DISABLED } = require('@theia/filesystem/lib/common/files');
    const { MonacoEditor } = require('@theia/monaco/lib/browser/monaco-editor');
    const { MonacoEditorModel } = require('@theia/monaco/lib/browser/monaco-editor-model');
    const { Deferred } = require('@theia/core/lib/common/promise-util');
    const { Disposable, DisposableCollection } = require('@theia/core/lib/common/disposable');
    const { AbstractResourcePreferenceProvider } = require('@theia/preferences/lib/browser/abstract-resource-preference-provider');

    const container = window.theia.container;
    const editorManager = container.get(EditorManager);
    const workspaceService = container.get(WorkspaceService);
    const fileService = container.get(FileService);
    /** @type {import('@theia/core/lib/browser/preferences/preference-service').PreferenceService} */
    const preferences = container.get(PreferenceService);

    /** @type {EditorWidget & SaveableWidget} */
    let widget;
    /** @type {MonacoEditor} */
    let editor;

    const rootUri = workspaceService.tryGetRoots()[0].resource;
    const fileUri = rootUri.resolve('.test/foo.txt');

    const closeOnFileDelete = 'workbench.editor.closeOnFileDelete';

    /**
     * @param {FileResource['shouldOverwrite']} shouldOverwrite
     * @returns {Disposable}
     */
    function setShouldOverwrite(shouldOverwrite) {
        const resource = editor.document['resource'];
        assert.isTrue(resource instanceof FileResource);
        const fileResource = /** @type {FileResource} */ (resource);
        const originalShouldOverwrite = fileResource['shouldOverwrite'];
        fileResource['shouldOverwrite'] = shouldOverwrite;
        return Disposable.create(() => fileResource['shouldOverwrite'] = originalShouldOverwrite);
    }

    /**
     * @param {MonacoEditorModel} modelToSpyOn
     * @returns {{restore: Disposable, record: {calls: number}}}
     */
    function spyOnSave(modelToSpyOn) {
        assert.isTrue(modelToSpyOn instanceof MonacoEditorModel);
        const toRestore = modelToSpyOn.save;
        const callable = toRestore.bind(modelToSpyOn);
        const record = { calls: 0 };
        modelToSpyOn.save = () => {
            record.calls++;
            return callable();
        };
        const restore = Disposable.create(() => modelToSpyOn.save = toRestore);
        return { restore, record };
    }

    /** @typedef {Object} PrefTest
     * @property {{calls: number}} record
     * @property {boolean[]} initialValues
     * @property {EditorWidget & SaveableWidget} editorWidget
     * @property {MonacoEditor} prefEditor
     * @property {AbstractResourcePreferenceProvider} provider
     */

    /**
     * @param {string[]} preferencesToModify
     * @returns {Promise<undefined | PrefTest>}
     */
    async function setUpPrefsTest(preferencesToModify) {
        const preferenceFile = preferences.getConfigUri(PreferenceScope.Folder, rootUri.toString());
        assert.isDefined(preferenceFile);
        if (!preferenceFile) { return; }

        const provider = preferences
            .preferenceProviders
            .get(PreferenceScope.Folder)
            .providers
            .get(preferenceFile.toString());

        assert.isDefined(provider);
        assert.isTrue(provider instanceof AbstractResourcePreferenceProvider);

        await Promise.all(preferencesToModify.map(name => preferences.set(name, undefined, undefined, rootUri.toString())));

        const editorWidget =  /** @type {EditorWidget & SaveableWidget} */
            (await editorManager.open(preferenceFile, { mode: 'reveal' }));
        const prefEditor = MonacoEditor.get(editorWidget);
        assert.isDefined(prefEditor);
        if (!prefEditor) { return; }
        assert.isFalse(Saveable.isDirty(editorWidget), 'should NOT be dirty on open');
        const model = prefEditor?.document;
        assert.isDefined(model);

        if (!model) { return; }
        const { restore, record } = spyOnSave(model);
        toTearDown.push(restore);
        /** @type {boolean[]} */
        const initialValues = preferencesToModify.map(name =>
            /** @type {boolean | undefined} */
            !!preferences.get(name, undefined, rootUri.toString())
        );

        return { record, initialValues, editorWidget, prefEditor, provider };
    }

    const toTearDown = new DisposableCollection();

    /** @type {string | undefined} */
    const autoSave = preferences.get('editor.autoSave', undefined, rootUri.toString());

    beforeEach(async () => {
        await preferences.set('editor.autoSave', 'off', undefined, rootUri.toString());
        await preferences.set(closeOnFileDelete, true);
        await editorManager.closeAll({ save: false });
        await fileService.create(fileUri, 'foo', { fromUserGesture: false, overwrite: true });
        widget =  /** @type {EditorWidget & SaveableWidget} */
            (await editorManager.open(fileUri, { mode: 'reveal' }));
        editor = /** @type {MonacoEditor} */ (MonacoEditor.get(widget));
    });

    afterEach(async () => {
        toTearDown.dispose();
        await preferences.set('editor.autoSave', autoSave, undefined, rootUri.toString());
        // @ts-ignore
        editor = undefined;
        // @ts-ignore
        widget = undefined;
        await editorManager.closeAll({ save: false });
        await fileService.delete(fileUri.parent, { fromUserGesture: false, useTrash: false, recursive: true });
    });

    it('normal save', async function () {
        for (const edit of ['bar', 'baz']) {
            assert.isFalse(Saveable.isDirty(widget), `should NOT be dirty before '${edit}' edit`);
            editor.getControl().setValue(edit);
            assert.isTrue(Saveable.isDirty(widget), `should be dirty before '${edit}' save`);
            await Saveable.save(widget);
            assert.isFalse(Saveable.isDirty(widget), `should NOT be dirty after '${edit}' save`);
            assert.equal(editor.getControl().getValue().trimRight(), edit, `model should be updated with '${edit}'`);
            const state = await fileService.read(fileUri);
            assert.equal(state.value.trimRight(), edit, `fs should be updated with '${edit}'`);
        }
    });

    it('reject save with incremental update', async function () {
        let longContent = 'foobarbaz';
        for (let i = 0; i < 5; i++) {
            longContent += longContent + longContent;
        }
        editor.getControl().setValue(longContent);
        await Saveable.save(widget);

        // @ts-ignore
        editor.getControl().getModel().applyEdits([{
            range: monaco.Range.fromPositions({ lineNumber: 1, column: 1 }, { lineNumber: 1, column: 4 }),
            forceMoveMarkers: false,
            text: ''
        }]);
        assert.isTrue(Saveable.isDirty(widget), 'should be dirty before save');

        const resource = editor.document['resource'];
        const version = resource.version;
        // @ts-ignore
        await resource.saveContents('baz');
        assert.notEqual(version, resource.version, 'latest version should be different after write');

        let outOfSync = false;
        let outOfSyncCount = 0;
        toTearDown.push(setShouldOverwrite(async () => {
            outOfSync = true;
            outOfSyncCount++;
            return false;
        }));

        let incrementalUpdate = false;
        const saveContentChanges = resource.saveContentChanges;
        resource.saveContentChanges = async (changes, options) => {
            incrementalUpdate = true;
            // @ts-ignore
            return saveContentChanges.bind(resource)(changes, options);
        };
        try {
            await Saveable.save(widget);
        } finally {
            resource.saveContentChanges = saveContentChanges;
        }

        assert.isTrue(incrementalUpdate, 'should tried to update incrementaly');
        assert.isTrue(outOfSync, 'file should be out of sync');
        assert.equal(outOfSyncCount, 1, 'user should be prompted only once with out of sync dialog');
        assert.isTrue(Saveable.isDirty(widget), 'should be dirty after rejected save');
        assert.equal(editor.getControl().getValue().trimRight(), longContent.substring(3), 'model should be updated');
        const state = await fileService.read(fileUri);
        assert.equal(state.value, 'baz', 'fs should NOT be updated');
    });

    it('accept rejected save', async function () {
        let outOfSync = false;
        toTearDown.push(setShouldOverwrite(async () => {
            outOfSync = true;
            return false;
        }));
        editor.getControl().setValue('bar');
        assert.isTrue(Saveable.isDirty(widget), 'should be dirty before save');

        const resource = editor.document['resource'];
        const version = resource.version;
        // @ts-ignore
        await resource.saveContents('bazz');
        assert.notEqual(version, resource.version, 'latest version should be different after write');

        await Saveable.save(widget);
        assert.isTrue(outOfSync, 'file should be out of sync');
        assert.isTrue(Saveable.isDirty(widget), 'should be dirty after rejected save');
        assert.equal(editor.getControl().getValue().trimRight(), 'bar', 'model should be updated');
        let state = await fileService.read(fileUri);
        assert.equal(state.value, 'bazz', 'fs should NOT be updated');

        outOfSync = false;
        toTearDown.push(setShouldOverwrite(async () => {
            outOfSync = true;
            return true;
        }));
        assert.isTrue(Saveable.isDirty(widget), 'should be dirty before save');
        await Saveable.save(widget);
        assert.isTrue(outOfSync, 'file should be out of sync');
        assert.isFalse(Saveable.isDirty(widget), 'should NOT be dirty after save');
        assert.equal(editor.getControl().getValue().trimRight(), 'bar', 'model should be updated');
        state = await fileService.read(fileUri);
        assert.equal(state.value.trimRight(), 'bar', 'fs should be updated');
    });

    it('accept new save', async () => {
        let outOfSync = false;
        toTearDown.push(setShouldOverwrite(async () => {
            outOfSync = true;
            return true;
        }));
        editor.getControl().setValue('bar');
        assert.isTrue(Saveable.isDirty(widget), 'should be dirty before save');
        await fileService.write(fileUri, 'foo2', { etag: ETAG_DISABLED });
        await Saveable.save(widget);
        assert.isTrue(outOfSync, 'file should be out of sync');
        assert.isFalse(Saveable.isDirty(widget), 'should NOT be dirty after save');
        assert.equal(editor.getControl().getValue().trimRight(), 'bar', 'model should be updated');
        const state = await fileService.read(fileUri);
        assert.equal(state.value.trimRight(), 'bar', 'fs should be updated');
    });

    it('cancel save on close', async () => {
        editor.getControl().setValue('bar');
        assert.isTrue(Saveable.isDirty(widget), 'should be dirty before close');

        await widget.closeWithSaving({
            shouldSave: () => undefined
        });
        assert.isTrue(Saveable.isDirty(widget), 'should be still dirty after canceled close');
        assert.isFalse(widget.isDisposed, 'should NOT be disposed after canceled close');
        const state = await fileService.read(fileUri);
        assert.equal(state.value, 'foo', 'fs should NOT be updated after canceled close');
    });

    it('reject save on close', async () => {
        editor.getControl().setValue('bar');
        assert.isTrue(Saveable.isDirty(widget), 'should be dirty before rejected close');
        await widget.closeWithSaving({
            shouldSave: () => false
        });
        assert.isTrue(widget.isDisposed, 'should be disposed after rejected close');
        const state = await fileService.read(fileUri);
        assert.equal(state.value, 'foo', 'fs should NOT be updated after rejected close');
    });

    it('accept save on close and reject it', async () => {
        let outOfSync = false;
        toTearDown.push(setShouldOverwrite(async () => {
            outOfSync = true;
            return false;
        }));
        editor.getControl().setValue('bar');
        assert.isTrue(Saveable.isDirty(widget), 'should be dirty before rejecting save on close');
        await fileService.write(fileUri, 'foo2', { etag: ETAG_DISABLED });
        await widget.closeWithSaving({
            shouldSave: () => true
        });
        assert.isTrue(outOfSync, 'file should be out of sync');
        assert.isTrue(widget.isDisposed, 'model should be disposed after close');
        const state = await fileService.read(fileUri);
        assert.equal(state.value, 'foo2', 'fs should NOT be updated');
    });

    it('accept save on close and accept new save', async () => {
        let outOfSync = false;
        toTearDown.push(setShouldOverwrite(async () => {
            outOfSync = true;
            return true;
        }));
        editor.getControl().setValue('bar');
        assert.isTrue(Saveable.isDirty(widget), 'should be dirty before accepting save on close');
        await fileService.write(fileUri, 'foo2', { etag: ETAG_DISABLED });
        await widget.closeWithSaving({
            shouldSave: () => true
        });
        assert.isTrue(outOfSync, 'file should be out of sync');
        assert.isTrue(widget.isDisposed, 'model should be disposed after close');
        const state = await fileService.read(fileUri);
        assert.equal(state.value.trimRight(), 'bar', 'fs should be updated');
    });

    it('normal close', async () => {
        editor.getControl().setValue('bar');
        assert.isTrue(Saveable.isDirty(widget), 'should be dirty before before close');
        await widget.closeWithSaving({
            shouldSave: () => true
        });
        assert.isTrue(widget.isDisposed, 'model should be disposed after close');
        const state = await fileService.read(fileUri);
        assert.equal(state.value.trimRight(), 'bar', 'fs should be updated');
    });

    it('delete and add again file for dirty', async () => {
        editor.getControl().setValue('bar');
        assert.isTrue(Saveable.isDirty(widget), 'should be dirty before delete');
        assert.isTrue(editor.document.valid, 'should be valid before delete');
        let waitForDidChangeTitle = new Deferred();
        const listener = () => waitForDidChangeTitle.resolve();
        widget.title.changed.connect(listener);
        try {
            await fileService.delete(fileUri);
            await waitForDidChangeTitle.promise;
            assert.isTrue(widget.title.label.endsWith('(deleted)'), 'should be marked as deleted');
            assert.isTrue(Saveable.isDirty(widget), 'should be dirty after delete');
            assert.isFalse(widget.isDisposed, 'model should NOT be disposed after delete');
        } finally {
            widget.title.changed.disconnect(listener);
        }

        waitForDidChangeTitle = new Deferred();
        widget.title.changed.connect(listener);
        try {
            await fileService.create(fileUri, 'foo');
            await waitForDidChangeTitle.promise;
            assert.isFalse(widget.title.label.endsWith('(deleted)'), 'should NOT be marked as deleted');
            assert.isTrue(Saveable.isDirty(widget), 'should be dirty after added again');
            assert.isFalse(widget.isDisposed, 'model should NOT be disposed after added again');
        } finally {
            widget.title.changed.disconnect(listener);
        }
    });

    it('save deleted file for dirty', async function () {
        editor.getControl().setValue('bar');
        assert.isTrue(Saveable.isDirty(widget), 'should be dirty before save deleted');

        assert.isTrue(editor.document.valid, 'should be valid before delete');
        const waitForInvalid = new Deferred();
        const listener = editor.document.onDidChangeValid(() => waitForInvalid.resolve());
        try {
            await fileService.delete(fileUri);
            await waitForInvalid.promise;
            assert.isFalse(editor.document.valid, 'should be invalid after delete');
        } finally {
            listener.dispose();
        }

        assert.isTrue(Saveable.isDirty(widget), 'should be dirty before save');
        await Saveable.save(widget);
        assert.isFalse(Saveable.isDirty(widget), 'should NOT be dirty after save');
        assert.isTrue(editor.document.valid, 'should be valid after save');
        const state = await fileService.read(fileUri);
        assert.equal(state.value.trimRight(), 'bar', 'fs should be updated');
    });

    it('move file for saved', async function () {
        assert.isFalse(Saveable.isDirty(widget), 'should NOT be dirty before move');

        const targetUri = fileUri.parent.resolve('bar.txt');
        await fileService.move(fileUri, targetUri, { overwrite: true });
        assert.isTrue(widget.isDisposed, 'old model should be disposed after move');

        const renamed = /** @type {EditorWidget} */ (await editorManager.getByUri(targetUri));
        assert.equal(String(renamed.getResourceUri()), targetUri.toString(), 'new model should be created after move');
        assert.equal(renamed.editor.document.getText(), 'foo', 'new model should be created after move');
        assert.isFalse(Saveable.isDirty(renamed), 'new model should NOT be dirty after move');
    });

    it('move file for dirty', async function () {
        editor.getControl().setValue('bar');
        assert.isTrue(Saveable.isDirty(widget), 'should be dirty before move');

        const targetUri = fileUri.parent.resolve('bar.txt');

        await fileService.move(fileUri, targetUri, { overwrite: true });
        assert.isTrue(widget.isDisposed, 'old model should be disposed after move');

        const renamed = /** @type {EditorWidget} */ (await editorManager.getByUri(targetUri));
        assert.equal(String(renamed.getResourceUri()), targetUri.toString(), 'new model should be created after move');
        assert.equal(renamed.editor.document.getText(), 'bar', 'new model should be created after move');
        assert.isTrue(Saveable.isDirty(renamed), 'new model should be dirty after move');

        await Saveable.save(renamed);
        assert.isFalse(Saveable.isDirty(renamed), 'new model should NOT be dirty after save');
    });

    it('fail to open invalid file', async function () {
        const invalidFile = fileUri.parent.resolve('invalid_file.txt');
        try {
            await editorManager.open(invalidFile, { mode: 'reveal' });
            assert.fail('should not be possible to open an editor for invalid file');
        } catch (e) {
            assert.equal(e.code, 'MODEL_IS_INVALID');
        }
    });

    it('decode without save', async function () {
        assert.strictEqual('utf8', editor.document.getEncoding());
        assert.strictEqual('foo', editor.document.getText());
        await editor.setEncoding('utf16le', 1 /* EncodingMode.Decode */);
        assert.strictEqual('utf16le', editor.document.getEncoding());
        assert.notEqual('foo', editor.document.getText().trimRight());
        assert.isFalse(Saveable.isDirty(widget), 'should not be dirty after decode');

        await widget.closeWithSaving({
            shouldSave: () => undefined
        });
        assert.isTrue(widget.isDisposed, 'widget should be disposed after close');

        widget =  /** @type {EditorWidget & SaveableWidget} */
            (await editorManager.open(fileUri, { mode: 'reveal' }));
        editor = /** @type {MonacoEditor} */ (MonacoEditor.get(widget));

        assert.strictEqual('utf8', editor.document.getEncoding());
        assert.strictEqual('foo', editor.document.getText().trimRight());
    });

    it('decode with save', async function () {
        assert.strictEqual('utf8', editor.document.getEncoding());
        assert.strictEqual('foo', editor.document.getText());
        await editor.setEncoding('utf16le', 1 /* EncodingMode.Decode */);
        assert.strictEqual('utf16le', editor.document.getEncoding());
        assert.notEqual('foo', editor.document.getText().trimRight());
        assert.isFalse(Saveable.isDirty(widget), 'should not be dirty after decode');

        await Saveable.save(widget);

        await widget.closeWithSaving({
            shouldSave: () => undefined
        });
        assert.isTrue(widget.isDisposed, 'widget should be disposed after close');

        widget =  /** @type {EditorWidget & SaveableWidget} */
            (await editorManager.open(fileUri, { mode: 'reveal' }));
        editor = /** @type {MonacoEditor} */ (MonacoEditor.get(widget));

        assert.strictEqual('utf16le', editor.document.getEncoding());
        assert.notEqual('foo', editor.document.getText().trimRight());
    });

    it('encode', async function () {
        assert.strictEqual('utf8', editor.document.getEncoding());
        assert.strictEqual('foo', editor.document.getText());
        await editor.setEncoding('utf16le', 0 /* EncodingMode.Encode */);
        assert.strictEqual('utf16le', editor.document.getEncoding());
        assert.strictEqual('foo', editor.document.getText().trimRight());
        assert.isFalse(Saveable.isDirty(widget), 'should not be dirty after encode');

        await widget.closeWithSaving({
            shouldSave: () => undefined
        });
        assert.isTrue(widget.isDisposed, 'widget should be disposed after close');

        widget =  /** @type {EditorWidget & SaveableWidget} */
            (await editorManager.open(fileUri, { mode: 'reveal' }));
        editor = /** @type {MonacoEditor} */ (MonacoEditor.get(widget));

        assert.strictEqual('utf16le', editor.document.getEncoding());
        assert.strictEqual('foo', editor.document.getText().trimRight());
    });

    it('delete file for saved', async () => {
        assert.isFalse(Saveable.isDirty(widget), 'should NOT be dirty before delete');
        const waitForDisposed = new Deferred();
        const listener = editor.onDispose(() => waitForDisposed.resolve());
        try {
            await fileService.delete(fileUri);
            await waitForDisposed.promise;
            assert.isTrue(widget.isDisposed, 'model should be disposed after delete');
        } finally {
            listener.dispose();
        }
    });

    it(`'${closeOnFileDelete}' should keep the editor opened when set to 'false'`, async () => {

        await preferences.set(closeOnFileDelete, false);
        assert.isFalse(preferences.get(closeOnFileDelete));
        assert.isFalse(Saveable.isDirty(widget));

        const waitForDidChangeTitle = new Deferred();
        const listener = () => waitForDidChangeTitle.resolve();
        widget.title.changed.connect(listener);
        try {
            await fileService.delete(fileUri);
            await waitForDidChangeTitle.promise;
            assert.isTrue(widget.title.label.endsWith('(deleted)'));
            assert.isFalse(widget.isDisposed);
        } finally {
            widget.title.changed.disconnect(listener);
        }
    });

    it(`'${closeOnFileDelete}' should close the editor when set to 'true'`, async () => {

        await preferences.set(closeOnFileDelete, true);
        assert.isTrue(preferences.get(closeOnFileDelete));
        assert.isFalse(Saveable.isDirty(widget));

        const waitForDisposed = new Deferred();
        const listener = editor.onDispose(() => waitForDisposed.resolve());
        try {
            await fileService.delete(fileUri);
            await waitForDisposed.promise;
            assert.isTrue(widget.isDisposed);
        } finally {
            listener.dispose();
        }
    });

    it('saves preference file when open and not dirty', async function () {
        const prefName = 'editor.copyWithSyntaxHighlighting';
        const prefTest = await setUpPrefsTest([prefName]);
        if (!prefTest) { return; }
        const { record, initialValues: [initialCopyWithHighlightPref], editorWidget } = prefTest;
        await preferences.set(prefName, !initialCopyWithHighlightPref, undefined, rootUri.toString());
        /** @type {boolean | undefined} */
        const newValue = preferences.get(prefName, undefined, rootUri.toString());
        assert.equal(newValue, !initialCopyWithHighlightPref);
        assert.isFalse(Saveable.isDirty(editorWidget), "editor should not be dirty if it wasn't dirty before");
        assert.equal(1, record.calls, 'save should have been called one time.');
    });

    it('saves once when many edits are made (editor open)', async function () {
        const prefNames = ['editor.copyWithSyntaxHighlighting', 'debug.inlineValues'];
        const prefTest = await setUpPrefsTest(prefNames);
        if (!prefTest) { return; }

        const { record, initialValues, editorWidget } = prefTest;

        /** @type {Promise<void>[]} */
        const attempts = [];
        while (attempts.length < 250) {
            prefNames.forEach((prefName, index) => {
                const value = attempts.length % 2 === 0 ? !initialValues[index] : initialValues[index];
                attempts.push(preferences.set(prefName, value, undefined, rootUri.toString()));
            });
        }
        await Promise.all(attempts);
        assert.isFalse(Saveable.isDirty(editorWidget), "editor should not be dirty if it wasn't dirty before");
        assert.equal(1, record.calls, 'save should have been called one time.');
    });

    it('saves once when many edits are made (editor closed)', async function () {
        const prefNames = ['editor.copyWithSyntaxHighlighting', 'debug.inlineValues'];
        const prefTest = await setUpPrefsTest(prefNames);
        if (!prefTest) { return; }

        const { record, initialValues, editorWidget } = prefTest;
        await editorWidget.closeWithoutSaving();

        /** @type {Promise<void>[]} */
        const attempts = [];
        while (attempts.length < 250) {
            prefNames.forEach((prefName, index) => {
                const value = attempts.length % 2 === 0 ? !initialValues[index] : initialValues[index];
                attempts.push(preferences.set(prefName, value, undefined, rootUri.toString()));
            });
        }
        await Promise.all(attempts);
        assert.equal(1, record.calls, 'save should have been called one time.');
    });

    it('displays the toast once no matter how many edits are queued', async function () {
        const prefNames = ['editor.copyWithSyntaxHighlighting', 'debug.inlineValues'];
        const prefTest = await setUpPrefsTest(prefNames);
        if (!prefTest) { return; }

        const { record, initialValues, editorWidget, prefEditor, provider } = prefTest;
        const initialContent = prefEditor.getControl().getValue();
        prefEditor.getControl().setValue('anything dirty will do.');
        prefEditor.getControl().setValue(initialContent);
        assert.isTrue(Saveable.isDirty(editorWidget));

        const toRestore = provider['handleDirtyEditor'];
        const callable = provider['handleDirtyEditor'].bind(provider);
        const dirtyEditorRecord = { calls: 0 };
        const spy = () => {
            dirtyEditorRecord.calls++;
            return callable();
        };
        provider['handleDirtyEditor'] = spy;
        toTearDown.push(Disposable.create(() => provider['handleDirtyEditor'] = toRestore));
        /** @type {Promise<void>[]} */
        const attempts = [];
        while (attempts.length < 250) {
            prefNames.forEach((prefName, index) => {
                const value = attempts.length % 2 === 0 ? !initialValues[index] : initialValues[index];
                attempts.push(preferences.set(prefName, value, undefined, rootUri.toString()));
            });
        }
        assert.equal(0, record.calls, 'should not have been saved yet');
        await Saveable.save(editorWidget); // Simulate the user saving and retrying.
        provider['dirtyEditorHandled'].resolve();
        await Promise.all(attempts);
        assert.equal(record.calls, 2, 'should have saved twice');
        assert.equal(dirtyEditorRecord.calls, 1, 'should have displayed the toast once');
        assert.equal(provider['editQueue'].length, 0, 'there should be no pending edits');
    });
});
