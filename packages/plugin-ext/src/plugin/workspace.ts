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
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// copied and modified from https://github.com/Microsoft/vscode/blob/master/src/vs/workbench/services/workspace/node/workspaceEditingService.ts

import * as paths from 'path';
import * as theia from '@theia/plugin';
import { Event, Emitter } from '@theia/core/lib/common/event';
import { CancellationToken } from '@theia/core/lib/common/cancellation';
import {
    WorkspaceExt,
    WorkspaceFolderPickOptionsMain,
    WorkspaceMain,
    PLUGIN_RPC_CONTEXT as Ext,
    MainMessageType,
} from '../common/plugin-api-rpc';
import { Path } from '@theia/core/lib/common/path';
import { RPCProtocol } from '../common/rpc-protocol';
import { WorkspaceRootsChangeEvent, SearchInWorkspaceResult, Range } from '../common/plugin-api-rpc-model';
import { EditorsAndDocumentsExtImpl } from './editors-and-documents';
import { URI } from 'vscode-uri';
import { normalize } from '@theia/callhierarchy/lib/common/paths';
import { relative } from '../common/paths-util';
import { Schemes } from '../common/uri-components';
import { toWorkspaceFolder } from './type-converters';
import { MessageRegistryExt } from './message-registry';
import * as Converter from './type-converters';

export class WorkspaceExtImpl implements WorkspaceExt {

    private proxy: WorkspaceMain;

    private workspaceFoldersChangedEmitter = new Emitter<theia.WorkspaceFoldersChangeEvent>();
    public readonly onDidChangeWorkspaceFolders: Event<theia.WorkspaceFoldersChangeEvent> = this.workspaceFoldersChangedEmitter.event;

    private folders: theia.WorkspaceFolder[] | undefined;
    private documentContentProviders = new Map<string, theia.TextDocumentContentProvider>();
    private searchInWorkspaceEmitter: Emitter<{ result?: theia.TextSearchResult, searchId: number }> = new Emitter<{ result?: theia.TextSearchResult, searchId: number }>();
    protected workspaceSearchSequence: number = 0;

    constructor(rpc: RPCProtocol,
        private editorsAndDocuments: EditorsAndDocumentsExtImpl,
        private messageService: MessageRegistryExt) {
        this.proxy = rpc.getProxy(Ext.WORKSPACE_MAIN);
    }

    get rootPath(): string | undefined {
        const folder = this.folders && this.folders[0];
        return folder && folder.uri.fsPath;
    }

    get workspaceFolders(): theia.WorkspaceFolder[] | undefined {
        if (this.folders && this.folders.length === 0) {
            return undefined;
        }
        return this.folders;
    }

    get name(): string | undefined {
        if (this.workspaceFolders && this.workspaceFolders.length > 0) {
            return new Path(this.workspaceFolders[0].uri.path).base;
        }

        return undefined;
    }

    $onWorkspaceFoldersChanged(event: WorkspaceRootsChangeEvent): void {
        const newRoots = event.roots || [];
        const newFolders = newRoots.map((root, index) => this.toWorkspaceFolder(root, index));
        const delta = this.deltaFolders(this.folders, newFolders);

        this.folders = newFolders;

        this.workspaceFoldersChangedEmitter.fire(delta);
    }

    $onTextSearchResult(searchRequestId: number, done: boolean, result?: SearchInWorkspaceResult): void {
        if (result) {
            result.matches.map(next => {
                const range: Range = {
                    endColumn: next.character + next.length,
                    endLineNumber: next.line + 1,
                    startColumn: next.character,
                    startLineNumber: next.line + 1
                };
                const tRange = <theia.Range>Converter.toRange(range);
                const searchResult: theia.TextSearchMatch = {
                    uri: URI.parse(result.fileUri),
                    preview: {
                        text: typeof next.lineText === 'string' ? next.lineText : next.lineText.text,
                        matches: tRange
                    },
                    ranges: tRange
                };
                return searchResult;
            }).forEach(next => this.searchInWorkspaceEmitter.fire({ result: next, searchId: searchRequestId }));
        } else if (done) {
            this.searchInWorkspaceEmitter.fire({ searchId: searchRequestId });
        }
    }

    private deltaFolders(currentFolders: theia.WorkspaceFolder[] = [], newFolders: theia.WorkspaceFolder[] = []): {
        added: theia.WorkspaceFolder[]
        removed: theia.WorkspaceFolder[]
    } {
        const added = this.foldersDiff(newFolders, currentFolders);
        const removed = this.foldersDiff(currentFolders, newFolders);
        return { added, removed };
    }

    private foldersDiff(folder1: theia.WorkspaceFolder[] = [], folder2: theia.WorkspaceFolder[] = []): theia.WorkspaceFolder[] {
        const map = new Map();
        folder1.forEach(folder => map.set(folder.uri.toString(), folder));
        folder2.forEach(folder => map.delete(folder.uri.toString()));

        return folder1.filter(folder => map.has(folder.uri.toString()));
    }

    private toWorkspaceFolder(root: string, index: number): theia.WorkspaceFolder {
        const uri = URI.parse(root);
        const path = new Path(uri.path);
        return {
            uri: uri,
            name: path.base,
            index: index
        };
    }

    pickWorkspaceFolder(options?: theia.WorkspaceFolderPickOptions): PromiseLike<theia.WorkspaceFolder | undefined> {
        return new Promise((resolve, reject) => {
            const optionsMain: WorkspaceFolderPickOptionsMain = {
                placeHolder: options && options.placeHolder ? options.placeHolder : undefined,
                ignoreFocusOut: options && options.ignoreFocusOut
            };

            this.proxy.$pickWorkspaceFolder(optionsMain).then(value => {
                resolve(value);
            });
        });
    }

    findFiles(include: theia.GlobPattern, exclude?: theia.GlobPattern | null, maxResults?: number,
        token: CancellationToken = CancellationToken.None): PromiseLike<URI[]> {
        let includePattern: string;
        let includeFolderUri: string | undefined;
        if (include) {
            if (typeof include === 'string') {
                includePattern = include;
            } else {
                includePattern = include.pattern;
                includeFolderUri = URI.file(include.base).toString();
            }
        } else {
            includePattern = '';
        }

        let excludePatternOrDisregardExcludes: string | false;
        if (exclude === undefined) {
            excludePatternOrDisregardExcludes = ''; // default excludes
        } else if (exclude) {
            if (typeof exclude === 'string') {
                excludePatternOrDisregardExcludes = exclude;
            } else {
                excludePatternOrDisregardExcludes = exclude.pattern;
            }
        } else {
            excludePatternOrDisregardExcludes = false; // no excludes
        }

        if (token && token.isCancellationRequested) {
            return Promise.resolve([]);
        }

        return this.proxy.$startFileSearch(includePattern, includeFolderUri, excludePatternOrDisregardExcludes, maxResults, token)
            .then(data => Array.isArray(data) ? data.map(uri => URI.revive(uri)) : []);
    }

    findTextInFiles(query: theia.TextSearchQuery, optionsOrCallback: theia.FindTextInFilesOptions | ((result: theia.TextSearchResult) => void),
        callbackOrToken?: CancellationToken | ((result: theia.TextSearchResult) => void), token?: CancellationToken): Promise<theia.TextSearchComplete> {
        let options: theia.FindTextInFilesOptions;
        let callback: (result: theia.TextSearchResult) => void;

        if (typeof optionsOrCallback === 'object') {
            options = optionsOrCallback;
            callback = callbackOrToken as (result: theia.TextSearchResult) => void;
        } else {
            options = {};
            callback = optionsOrCallback;
            token = callbackOrToken as CancellationToken;
        }
        const nextSearchID = this.workspaceSearchSequence + 1;
        this.workspaceSearchSequence = nextSearchID;
        const disposable = this.searchInWorkspaceEmitter.event(searchResult => {
            if (searchResult.searchId === nextSearchID) {
                if (searchResult.result) {
                    callback(searchResult.result);
                } else {
                    disposable.dispose();
                }
            }
        });
        if (token) {
            token.onCancellationRequested(() => {
                disposable.dispose();
            });
        }
        return this.proxy.$findTextInFiles(query, options || {}, nextSearchID, token);
    }

    registerTextDocumentContentProvider(scheme: string, provider: theia.TextDocumentContentProvider): theia.Disposable {
        // `file` and `untitled` schemas are reserved by `workspace.openTextDocument` API:
        // `file`-scheme for opening a file
        // `untitled`-scheme for opening a new file that should be saved
        if (scheme === Schemes.file || scheme === Schemes.untitled || this.documentContentProviders.has(scheme)) {
            throw new Error(`Text Content Document Provider for scheme '${scheme}' is already registered`);
        }

        this.documentContentProviders.set(scheme, provider);
        this.proxy.$registerTextDocumentContentProvider(scheme);

        let onDidChangeSubscription: theia.Disposable;
        if (typeof provider.onDidChange === 'function') {
            onDidChangeSubscription = provider.onDidChange(async uri => {
                if (uri.scheme === scheme && this.editorsAndDocuments.getDocument(uri.toString())) {
                    const content = await this.$provideTextDocumentContent(uri.toString());
                    if (content) {
                        this.proxy.$onTextDocumentContentChange(uri.toString(), content);
                    }
                }
            });
        }

        const instance = this;
        return {
            dispose(): void {
                if (instance.documentContentProviders.delete(scheme)) {
                    instance.proxy.$unregisterTextDocumentContentProvider(scheme);
                }

                if (onDidChangeSubscription) {
                    onDidChangeSubscription.dispose();
                }
            }
        };
    }

    async $provideTextDocumentContent(documentURI: string): Promise<string | undefined> {
        const uri = URI.parse(documentURI);
        const provider = this.documentContentProviders.get(uri.scheme);
        if (provider) {
            return provider.provideTextDocumentContent(uri, CancellationToken.None);
        }

        return undefined;
    }

    getWorkspaceFolder(uri: theia.Uri, resolveParent?: boolean): theia.WorkspaceFolder | undefined {
        if (!this.folders || !this.folders.length) {
            return undefined;
        }

        function dirname(resource: URI): URI {
            if (resource.scheme === 'file') {
                return URI.file(paths.dirname(resource.fsPath));
            }
            return resource.with({
                path: paths.dirname(resource.path)
            });
        }

        if (resolveParent && this.hasFolder(uri)) {
            uri = dirname(uri);
        }

        const resourcePath = uri.toString();

        let workspaceFolder: theia.WorkspaceFolder | undefined;
        for (let i = 0; i < this.folders.length; i++) {
            const folder = this.folders[i];
            const folderPath = folder.uri.toString();

            if (resourcePath === folderPath) {
                return toWorkspaceFolder(folder);
            }

            if (resourcePath.startsWith(folderPath)
                && resourcePath[folderPath.length] === '/'
                && (!workspaceFolder || folderPath.length > workspaceFolder.uri.toString().length)) {
                workspaceFolder = folder;
            }
        }
        return workspaceFolder;
    }

    private hasFolder(uri: URI): boolean {
        if (!this.folders) {
            return false;
        }
        return this.folders.some(folder => folder.uri.toString() === uri.toString());
    }

    getRelativePath(pathOrUri: string | theia.Uri, includeWorkspace?: boolean): string | undefined {
        let path: string | undefined;
        if (typeof pathOrUri === 'string') {
            path = pathOrUri;
        } else if (typeof pathOrUri !== 'undefined') {
            path = pathOrUri.fsPath;
        }

        if (!path) {
            return path;
        }

        const folder = this.getWorkspaceFolder(
            typeof pathOrUri === 'string' ? URI.file(pathOrUri) : pathOrUri,
            true
        ) as theia.WorkspaceFolder;

        if (!folder) {
            return path;
        }

        if (typeof includeWorkspace === 'undefined') {
            includeWorkspace = this.folders!.length > 1;
        }

        let result = relative(folder.uri.fsPath, path);
        if (includeWorkspace) {
            result = `${folder.name}/${result}`;
        }
        return normalize(result, true);
    }

    updateWorkspaceFolders(start: number, deleteCount: number, ...workspaceFoldersToAdd: { uri: theia.Uri, name?: string }[]): boolean {
        const rootsToAdd = new Set<string>();
        const rootsNameMap = new Map<string, string | undefined>();
        if (Array.isArray(workspaceFoldersToAdd)) {
            workspaceFoldersToAdd.forEach(folderToAdd => {
                const uri = URI.isUri(folderToAdd.uri) && folderToAdd.uri.toString();
                if (uri && !rootsToAdd.has(uri)) {
                    rootsToAdd.add(uri);
                    rootsNameMap.set(uri, folderToAdd.name);
                }
            });
        }

        if ([start, deleteCount].some(i => typeof i !== 'number' || i < 0)) {
            return false; // validate numbers
        }

        if (deleteCount === 0 && rootsToAdd.size === 0) {
            return false; // nothing to delete or add
        }

        const currentWorkspaceFolders = this.workspaceFolders || [];
        if (start + deleteCount > currentWorkspaceFolders.length) {
            return false; // cannot delete more than we have
        }

        // Simulate the updateWorkspaceFolders method on our data to do more validation
        const newWorkspaceFolders = currentWorkspaceFolders.slice(0);
        newWorkspaceFolders.splice(start, deleteCount, ...[...rootsToAdd].map(uri => ({ uri: URI.parse(uri), name: undefined!, index: undefined! })));

        for (let i = 0; i < newWorkspaceFolders.length; i++) {
            const folder = newWorkspaceFolders[i];
            if (newWorkspaceFolders.some((otherFolder, index) => index !== i && folder.uri.toString() === otherFolder.uri.toString())) {
                return false; // cannot add the same folder multiple times
            }
        }

        const { added, removed } = this.deltaFolders(currentWorkspaceFolders, newWorkspaceFolders);
        if (added.length === 0 && removed.length === 0) {
            return false; // nothing actually changed
        }

        // Trigger on main side
        this.proxy.$updateWorkspaceFolders(start, deleteCount, ...Array.from(rootsToAdd).map(uri => ({ uri, name: rootsNameMap.get(uri) }))).then(undefined, error =>
            this.messageService.showMessage(MainMessageType.Error, `Failed to update workspace folders: ${error}`)
        );

        return true;
    }

}
