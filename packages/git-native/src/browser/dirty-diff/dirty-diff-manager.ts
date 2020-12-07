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

import { inject, injectable, postConstruct } from 'inversify';
import { EditorManager, EditorWidget, TextEditor, TextEditorDocument, TextDocumentChangeEvent } from '@theia/editor/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { Emitter, Event, Disposable, DisposableCollection } from '@theia/core';
import { ContentLines } from '@theia/scm/lib/browser/dirty-diff/content-lines';
import { DirtyDiffUpdate } from '@theia/scm/lib/browser/dirty-diff/dirty-diff-decorator';
import { DiffComputer, DirtyDiff } from '@theia/scm/lib/browser/dirty-diff/diff-computer';
import { GitPreferences, GitConfiguration } from '../git-preferences';
import { PreferenceChangeEvent } from '@theia/core/lib/browser';
import { GIT_RESOURCE_SCHEME } from '@theia/git/lib/browser/git-resource';
import { GitResourceResolver } from '../git-resource-resolver';
import { WorkingDirectoryStatus, GitFileStatus, GitFileChange, Repository, Git, GitStatusChangeEvent } from '@theia/git/lib/common';
import { GitRepositoryTracker } from '../git-repository-tracker';

import throttle = require('lodash.throttle');

@injectable()
export class DirtyDiffManager {

    protected readonly models = new Map<string, DirtyDiffModel>();

    protected readonly onDirtyDiffUpdateEmitter = new Emitter<DirtyDiffUpdate>();
    readonly onDirtyDiffUpdate: Event<DirtyDiffUpdate> = this.onDirtyDiffUpdateEmitter.event;

    @inject(Git)
    protected readonly git: Git;

    @inject(GitRepositoryTracker)
    protected readonly repositoryTracker: GitRepositoryTracker;

    @inject(GitResourceResolver)
    protected readonly gitResourceResolver: GitResourceResolver;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(GitPreferences)
    protected readonly preferences: GitPreferences;

    @postConstruct()
    protected async initialize(): Promise<void> {
        this.editorManager.onCreated(async e => this.handleEditorCreated(e));
        this.repositoryTracker.onGitEvent(throttle(async (event: GitStatusChangeEvent | undefined) =>
            this.handleGitStatusUpdate(event && event.source, event && event.status), 500));
        const gitStatus = this.repositoryTracker.selectedRepositoryStatus;
        const repository = this.repositoryTracker.selectedRepository;
        if (gitStatus && repository) {
            await this.handleGitStatusUpdate(repository, gitStatus);
        }
    }

    protected async handleEditorCreated(editorWidget: EditorWidget): Promise<void> {
        const editor = editorWidget.editor;
        const uri = editor.uri.toString();
        if (editor.uri.scheme !== 'file') {
            return;
        }
        const toDispose = new DisposableCollection();
        const model = this.createNewModel(editor);
        toDispose.push(model);
        this.models.set(uri, model);
        toDispose.push(editor.onDocumentContentChanged(throttle((event: TextDocumentChangeEvent) => model.handleDocumentChanged(event.document), 1000)));
        editorWidget.disposed.connect(() => {
            this.models.delete(uri);
            toDispose.dispose();
        });
        const gitStatus = this.repositoryTracker.selectedRepositoryStatus;
        const repository = this.repositoryTracker.selectedRepository;
        if (gitStatus && repository) {
            const changes = gitStatus.changes.filter(c => c.uri === uri);
            await model.handleGitStatusUpdate(repository, changes);
        }
        model.handleDocumentChanged(editor.document);
    }

    protected createNewModel(editor: TextEditor): DirtyDiffModel {
        const previousRevision = this.createPreviousFileRevision(editor.uri);
        const model = new DirtyDiffModel(editor, this.preferences, previousRevision);
        model.onDirtyDiffUpdate(e => this.onDirtyDiffUpdateEmitter.fire(e));
        return model;
    }

    protected createPreviousFileRevision(fileUri: URI): DirtyDiffModel.PreviousFileRevision {
        return <DirtyDiffModel.PreviousFileRevision>{
            fileUri,
            getContents: async (staged: boolean) => {
                const query = staged ? '' : 'HEAD';
                const uri = fileUri.withScheme(GIT_RESOURCE_SCHEME).withQuery(query);
                const gitResource = await this.gitResourceResolver.getResource(uri);
                return gitResource.readContents();
            },
            isVersionControlled: async () => {
                const repository = this.repositoryTracker.selectedRepository;
                if (repository) {
                    return this.git.lsFiles(repository, fileUri.toString(), { errorUnmatch: true });
                }
                return false;
            }
        };
    }

    protected async handleGitStatusUpdate(repository: Repository | undefined, status: WorkingDirectoryStatus | undefined): Promise<void> {
        const uris = new Set(this.models.keys());
        const relevantChanges = status ? status.changes.filter(c => uris.has(c.uri)) : [];
        for (const model of this.models.values()) {
            const uri = model.editor.uri.toString();
            const changes = relevantChanges.filter(c => c.uri === uri);
            await model.handleGitStatusUpdate(repository, changes);
        }
    }

}

export class DirtyDiffModel implements Disposable {

    protected toDispose = new DisposableCollection();

    protected enabled = true;
    protected staged: boolean;
    protected previousContent: ContentLines | undefined;
    protected currentContent: ContentLines | undefined;

    protected readonly onDirtyDiffUpdateEmitter = new Emitter<DirtyDiffUpdate>();
    readonly onDirtyDiffUpdate: Event<DirtyDiffUpdate> = this.onDirtyDiffUpdateEmitter.event;

    constructor(
        readonly editor: TextEditor,
        readonly preferences: GitPreferences,
        protected readonly previousRevision: DirtyDiffModel.PreviousFileRevision
    ) {
        this.toDispose.push(this.preferences.onPreferenceChanged(e => this.handlePreferenceChange(e)));
    }

    protected async handlePreferenceChange(event: PreferenceChangeEvent<GitConfiguration>): Promise<void> {
        const { preferenceName, newValue } = event;
        if (preferenceName === 'git.editor.decorations.enabled') {
            const enabled = !!newValue;
            this.enabled = enabled;
            this.update();
        }
        if (preferenceName === 'git.editor.dirtyDiff.linesLimit') {
            this.update();
        }
    }

    protected get linesLimit(): number {
        const limit = this.preferences['git.editor.dirtyDiff.linesLimit'];
        return limit > 0 ? limit : Number.MAX_SAFE_INTEGER;
    }

    protected updateTimeout: number | undefined;

    protected shouldRender(): boolean {
        if (!this.enabled || !this.previousContent || !this.currentContent) {
            return false;
        }
        const limit = this.linesLimit;
        return this.previousContent.length < limit && this.currentContent.length < limit;
    }

    update(): void {
        const editor = this.editor;
        if (!this.shouldRender()) {
            this.onDirtyDiffUpdateEmitter.fire({ editor, added: [], removed: [], modified: [] });
            return;
        }
        if (this.updateTimeout) {
            window.clearTimeout(this.updateTimeout);
        }
        this.updateTimeout = window.setTimeout(() => {
            const previous = this.previousContent;
            const current = this.currentContent;
            if (!previous || !current) {
                return;
            }
            this.updateTimeout = undefined;
            const dirtyDiff = DirtyDiffModel.computeDirtyDiff(previous, current);
            if (!dirtyDiff) {
                // if the computation fails, it might be because of changes in the editor, in that case
                // a new update task should be scheduled anyway.
                return;
            }
            const dirtyDiffUpdate = <DirtyDiffUpdate>{ editor, ...dirtyDiff };
            this.onDirtyDiffUpdateEmitter.fire(dirtyDiffUpdate);
        }, 100);
    }

    handleDocumentChanged(document: TextEditorDocument): void {
        if (this.toDispose.disposed) {
            return;
        }
        this.currentContent = DirtyDiffModel.documentContentLines(document);
        this.update();
    }

    async handleGitStatusUpdate(repository: Repository | undefined, relevantChanges: GitFileChange[]): Promise<void> {
        const noRelevantChanges = relevantChanges.length === 0;
        const isNewAndStaged = relevantChanges.some(c => c.status === GitFileStatus.New && !!c.staged);
        const isNewAndUnstaged = relevantChanges.some(c => c.status === GitFileStatus.New && !c.staged);
        const modifiedChange = relevantChanges.find(c => c.status === GitFileStatus.Modified);
        const isModified = !!modifiedChange;
        const readPreviousRevisionContent = async () => {
            try {
                this.previousContent = await this.getPreviousRevisionContent();
            } catch {
                this.previousContent = undefined;
            }
        };
        if (isModified || isNewAndStaged) {
            this.staged = isNewAndStaged || modifiedChange!.staged || false;
            await readPreviousRevisionContent();
        }
        if (isNewAndUnstaged && !isNewAndStaged) {
            this.previousContent = undefined;
        }
        if (noRelevantChanges) {
            const inGitRepository = await this.isInGitRepository(repository);
            if (inGitRepository) {
                await readPreviousRevisionContent();
            }
        }
        this.update();
    }

    protected async isInGitRepository(repository: Repository | undefined): Promise<boolean> {
        if (!repository) {
            return false;
        }
        const modelUri = this.editor.uri.withScheme('file').toString();
        const repoUri = new URI(repository.localUri).withScheme('file').toString();
        return modelUri.startsWith(repoUri) && this.previousRevision.isVersionControlled();
    }

    protected async getPreviousRevisionContent(): Promise<ContentLines | undefined> {
        const contents = await this.previousRevision.getContents(this.staged);
        return contents ? ContentLines.fromString(contents) : undefined;
    }

    dispose(): void {
        this.toDispose.dispose();
        this.onDirtyDiffUpdateEmitter.dispose();
    }
}

export namespace DirtyDiffModel {

    const diffComputer = new DiffComputer();

    /**
     * Returns an eventually consistent result. E.g. it can happen, that lines are deleted during the computation,
     * which will internally produce 'line out of bound' errors, then it will return `undefined`.
     *
     * `ContentLines` are to avoid copying contents which improves the performance, therefore handling of the `undefined`
     * result, and rescheduling of the computation should be done by caller.
     */
    export function computeDirtyDiff(previous: ContentLines, current: ContentLines): DirtyDiff | undefined {
        try {
            return diffComputer.computeDirtyDiff(ContentLines.arrayLike(previous), ContentLines.arrayLike(current));
        } catch {
            return undefined;
        }
    }

    export function documentContentLines(document: TextEditorDocument): ContentLines {
        return {
            length: document.lineCount,
            getLineContent: line => document.getLineContent(line + 1),
        };
    }

    export interface PreviousFileRevision {
        readonly fileUri: URI;
        getContents(staged: boolean): Promise<string>;
        isVersionControlled(): Promise<boolean>;
    }

}
