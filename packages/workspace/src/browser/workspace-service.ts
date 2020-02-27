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

import { injectable, inject, postConstruct } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { FileSystem, FileStat, FileSystemError } from '@theia/filesystem/lib/common';
import { FileSystemWatcher, FileChangeEvent } from '@theia/filesystem/lib/browser/filesystem-watcher';
import { WorkspaceServer, THEIA_EXT, VSCODE_EXT, getTemporaryWorkspaceFileUri } from '../common';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import {
    FrontendApplicationContribution, PreferenceServiceImpl, PreferenceScope, PreferenceSchemaProvider
} from '@theia/core/lib/browser';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { ILogger, Disposable, DisposableCollection, Emitter, Event, MaybePromise } from '@theia/core';
import { WorkspacePreferences } from './workspace-preferences';
import * as jsoncparser from 'jsonc-parser';
import { FrontendApplicationConfigProvider } from '@theia/core/lib/browser/frontend-application-config-provider';

export interface WorkspaceFolder extends FileStat {
    name: string
}

export type WorkspaceFolderCreateData = URI | {
    uri: URI
    name?: string
}

/**
 * The workspace service.
 */
@injectable()
export class WorkspaceService implements FrontendApplicationContribution {

    private _workspace: FileStat | undefined;

    private _roots: WorkspaceFolder[] = [];
    private deferredRoots = new Deferred<WorkspaceFolder[]>();

    @inject(FileSystem)
    protected readonly fileSystem: FileSystem;

    @inject(FileSystemWatcher)
    protected readonly watcher: FileSystemWatcher;

    @inject(WorkspaceServer)
    protected readonly server: WorkspaceServer;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    @inject(ILogger)
    protected logger: ILogger;

    @inject(WorkspacePreferences)
    protected preferences: WorkspacePreferences;

    @inject(PreferenceServiceImpl)
    protected readonly preferenceImpl: PreferenceServiceImpl;

    @inject(PreferenceSchemaProvider)
    protected readonly schemaProvider: PreferenceSchemaProvider;

    @inject(EnvVariablesServer)
    protected readonly envVariableServer: EnvVariablesServer;

    protected applicationName: string;

    @postConstruct()
    protected async init(): Promise<void> {
        this.applicationName = FrontendApplicationConfigProvider.get().applicationName;
        const wsUriString = await this.getDefaultWorkspaceUri();
        const wsStat = await this.toFileStat(wsUriString);
        await this.setWorkspace(wsStat);

        this.watcher.onFilesChanged(event => {
            if (this._workspace && FileChangeEvent.isAffected(event, new URI(this._workspace.uri))) {
                this.updateWorkspace();
            }
        });
        this.preferences.onPreferenceChanged(event => {
            const multiRootPrefName = 'workspace.supportMultiRootWorkspace';
            if (event.preferenceName === multiRootPrefName) {
                this.updateWorkspace();
            }
        });
    }

    /**
     * Resolves to the default workspace URI as string.
     *
     * The default implementation tries to extract the default workspace location
     * from the `window.location.hash`, then falls-back to the most recently
     * used workspace root from the server.
     *
     * It is not ensured that the resolved workspace URI is valid, it can point
     * to a non-existing location.
     */
    protected getDefaultWorkspaceUri(): MaybePromise<string | undefined> {
        // Prefer the workspace path specified as the URL fragment, if present.
        if (window.location.hash.length > 1) {
            // Remove the leading # and decode the URI.
            const wpPath = decodeURI(window.location.hash.substring(1));
            return new URI().withPath(wpPath).withScheme('file').toString();
        } else {
            // Else, ask the server for its suggested workspace (usually the one
            // specified on the CLI, or the most recent).
            return this.server.getMostRecentlyUsedWorkspace();
        }
    }

    /**
     * Get the path of the workspace to use initially.
     * @deprecated use `WorkspaceService#getDefaultWorkspaceUri` instead.
     */
    protected getDefaultWorkspacePath(): MaybePromise<string | undefined> {
        return this.getDefaultWorkspaceUri();
    }

    /**
     * Set the URL fragment to the given workspace path.
     */
    protected setURLFragment(workspacePath: string): void {
        window.location.hash = workspacePath;
    }

    get roots(): Promise<WorkspaceFolder[]> {
        return this.deferredRoots.promise;
    }
    tryGetRoots(): WorkspaceFolder[] {
        return this._roots;
    }
    get workspace(): FileStat | undefined {
        return this._workspace;
    }

    protected readonly onWorkspaceChangeEmitter = new Emitter<WorkspaceFolder[]>();
    get onWorkspaceChanged(): Event<WorkspaceFolder[]> {
        return this.onWorkspaceChangeEmitter.event;
    }

    protected readonly onWorkspaceLocationChangedEmitter = new Emitter<FileStat | undefined>();
    get onWorkspaceLocationChanged(): Event<FileStat | undefined> {
        return this.onWorkspaceLocationChangedEmitter.event;
    }

    protected readonly toDisposeOnWorkspace = new DisposableCollection();
    protected async setWorkspace(workspaceStat: FileStat | undefined): Promise<void> {
        if (FileStat.equals(this._workspace, workspaceStat)) {
            return;
        }
        this.toDisposeOnWorkspace.dispose();
        this._workspace = workspaceStat;
        if (this._workspace) {
            const uri = new URI(this._workspace.uri);
            this.toDisposeOnWorkspace.push(await this.watcher.watchFileChanges(uri));
            this.setURLFragment(uri.path.toString());
        } else {
            this.setURLFragment('');
        }
        this.updateTitle();
        await this.updateWorkspace();
    }

    protected async updateWorkspace(): Promise<void> {
        if (this._workspace) {
            this._workspace = await this.toFileStat(this._workspace.uri);
        }
        await this.updateRoots();
        this.watchRoots();
    }

    protected async updateRoots(): Promise<void> {
        const newRoots = await this.computeRoots();
        let rootsChanged = false;
        if (newRoots.length !== this._roots.length || newRoots.length === 0) {
            rootsChanged = true;
        } else {
            for (const newRoot of newRoots) {
                if (!this._roots.some(r => r.uri === newRoot.uri)) {
                    rootsChanged = true;
                    break;
                }
            }
        }
        if (rootsChanged) {
            this._roots = newRoots;
            this.deferredRoots.resolve(this._roots); // in order to resolve first
            this.deferredRoots = new Deferred<WorkspaceFolder[]>();
            this.deferredRoots.resolve(this._roots);
            this.onWorkspaceChangeEmitter.fire(this._roots);
        }
    }

    protected async computeRoots(): Promise<WorkspaceFolder[]> {
        const roots: WorkspaceFolder[] = [];
        if (this._workspace) {
            if (this._workspace.isDirectory) {
                const uri = new URI(this._workspace.uri);
                return [Object.assign(this._workspace, { name: uri.path.base || uri.authority })];
            }

            const data = await this.readWorkspaceData();
            if (data && typeof data === 'object' && 'folders' in data && Array.isArray(data['folders'])) {
                const relativeTo = new URI(this._workspace.uri).withScheme('file').parent;
                for (const folder of data['folders']) {
                    if (!WorkspaceFolderData.is(folder)) {
                        continue;
                    }
                    let uri = undefined;
                    if (FileWorkspaceFolderData.is(folder)) {
                        if (folder.path.startsWith('file:///')) {
                            // it is for backward compatiblity with theia-workspace format, in code-workspace path never can be uri
                            try {
                                uri = new URI(folder.path);
                            } catch {
                                // no-op
                            }
                        } else {
                            uri = relativeTo.resolve(folder.path);
                        }
                    } else if (UriWorkspaceFolderData.is(folder)) {
                        try {
                            uri = new URI(folder.uri);
                        } catch {
                            // no-op
                        }
                    }
                    if (!uri) {
                        continue;
                    }
                    const name = folder.name || uri.path.base || uri.authority;
                    const valid = await this.toValidRoot(uri);
                    if (valid) {
                        roots.push(Object.assign(valid, { name }));
                    } else {
                        roots.push({
                            uri: uri.toString(),
                            lastModification: Date.now(),
                            isDirectory: true,
                            name
                        });
                    }
                }
            }
        }
        return roots;
    }

    protected formatTitle(title?: string): string {
        const name = this.applicationName;
        return title ? `${title} — ${name}` : name;
    }

    protected updateTitle(): void {
        let title: string | undefined;
        if (this._workspace) {
            const uri = new URI(this._workspace.uri);
            const displayName = uri.displayName;
            if (!this._workspace.isDirectory &&
                (displayName.endsWith(`.${THEIA_EXT}`) || displayName.endsWith(`.${VSCODE_EXT}`))) {
                title = displayName.slice(0, displayName.lastIndexOf('.'));
            } else {
                title = displayName;
            }
        }
        document.title = this.formatTitle(title);
    }

    /**
     * on unload, we set our workspace root as the last recently used on the backend.
     */
    onStop(): void {
        this.server.setMostRecentlyUsedWorkspace(this._workspace ? this._workspace.uri : '');
    }

    async recentWorkspaces(): Promise<string[]> {
        return this.server.getRecentWorkspaces();
    }

    /**
     * Returns `true` if theia has an opened workspace or folder
     * @returns {boolean}
     */
    get opened(): boolean {
        return !!this._workspace;
    }

    /**
     * Returns `true` if a multiple-root workspace is currently open.
     * @returns {boolean}
     */
    get isMultiRootWorkspaceOpened(): boolean {
        return !!this.workspace && !this.workspace.isDirectory;
    }

    /**
     * Returns `true` if there is an opened workspace, and multi root workspace support is enabled.
     * @returns {boolean}
     */
    get isMultiRootWorkspaceEnabled(): boolean {
        return this.opened && this.preferences['workspace.supportMultiRootWorkspace'];
    }

    /**
     * Opens directory, or recreates a workspace from the file that `uri` points to.
     */
    open(uri: URI, options?: WorkspaceInput): void {
        this.doOpen(uri, options);
    }

    protected async doOpen(uri: URI, options?: WorkspaceInput): Promise<void> {
        const rootUri = uri.toString();
        const stat = await this.toFileStat(rootUri);
        if (stat) {
            // The same window has to be preserved too (instead of opening a new one), if the workspace root is not yet available and we are setting it for the first time.
            // Option passed as parameter has the highest priority (for api developers), then the preference, then the default.
            await this.roots;
            const { preserveWindow } = {
                preserveWindow: this.preferences['workspace.preserveWindow'] || !this.opened,
                ...options
            };
            await this.server.setMostRecentlyUsedWorkspace(rootUri);
            if (preserveWindow) {
                this._workspace = stat;
            }
            this.openWindow(stat, { preserveWindow });
            return;
        }
        throw new Error('Invalid workspace root URI. Expected an existing directory location.');
    }

    /**
     * Adds a root folder to the workspace
     * @param uri URI of the root folder being added
     */
    async addRoot(uri: URI): Promise<void> {
        await this.spliceRoots(this._roots.length, 0, uri);
    }

    /**
     * Removes root folder(s) from workspace.
     */
    async removeRoots(uris: URI[]): Promise<void> {
        if (!this.opened) {
            throw new Error('Folder cannot be removed as there is no active folder in the current workspace.');
        }
        if (this._workspace) {
            const currentData = await this.readWorkspaceData();
            const folders = this._roots.filter(root => uris.findIndex(u => u.toString() === root.uri) < 0).map(({ uri, name }) => ({ uri, name }));
            this._workspace = await this.writeWorkspaceFile(this._workspace, { ...currentData, folders });
        }
    }

    async spliceRoots(start: number, deleteCount?: number, ...rootsToAdd: WorkspaceFolderCreateData[]): Promise<URI[]> {
        if (!this._workspace) {
            throw new Error('There is not active workspace');
        }
        const dedup = new Set<string>();
        const folders: UriWorkspaceFolderData[] = this._roots.map(root => (dedup.add(root.uri), {
            uri: root.uri,
            name: root.name
        }));
        const toAdd: UriWorkspaceFolderData[] = [];
        for (const root of rootsToAdd) {
            const data: UriWorkspaceFolderData = root instanceof URI ? {
                uri: root.toString()
            } : {
                    uri: root.uri.toString(),
                    name: root.name
                };
            if (!dedup.has(data.uri)) {
                dedup.add(data.uri);
                toAdd.push(data);
            }
        }
        const toRemove = folders.splice(start, deleteCount || 0, ...toAdd);
        if (!toRemove.length && !toAdd.length) {
            return [];
        }
        if (this._workspace.isDirectory) {
            const untitledWorkspace = await this.getUntitledWorkspace();
            if (untitledWorkspace) {
                await this.save(untitledWorkspace);
            }
        }
        const currentData = await this.readWorkspaceData();
        await this.writeWorkspaceFile(this._workspace, { ...currentData, folders });
        return toRemove.map(root => new URI(root.uri));
    }

    protected async getUntitledWorkspace(): Promise<URI | undefined> {
        return getTemporaryWorkspaceFileUri(this.envVariableServer);
    }

    private async writeWorkspaceFile(workspaceFile: FileStat | undefined, workspaceData: WorkspaceData): Promise<FileStat | undefined> {
        if (workspaceFile) {
            const data = JSON.stringify(workspaceData);
            const edits = jsoncparser.format(data, undefined, { tabSize: 3, insertSpaces: true, eol: '' });
            const result = jsoncparser.applyEdits(data, edits);
            const stat = await this.fileSystem.setContent(workspaceFile, result);
            return stat;
        }
    }

    /**
     * Clears current workspace root.
     */
    async close(): Promise<void> {
        this._workspace = undefined;
        this._roots.length = 0;

        await this.server.setMostRecentlyUsedWorkspace('');
        this.reloadWindow();
    }

    /**
     * returns a FileStat if the argument URI points to an existing directory. Otherwise, `undefined`.
     */
    protected async toValidRoot(uri: URI | string | undefined): Promise<FileStat | undefined> {
        const fileStat = await this.toFileStat(uri);
        if (fileStat && fileStat.isDirectory) {
            return fileStat;
        }
        return undefined;
    }

    /**
     * returns a FileStat if the argument URI points to a file or directory. Otherwise, `undefined`.
     */
    protected async toFileStat(uri: URI | string | undefined): Promise<FileStat | undefined> {
        if (!uri) {
            return undefined;
        }
        let uriStr = uri.toString();
        try {
            if (uriStr.endsWith('/')) {
                uriStr = uriStr.slice(0, -1);
            }
            const fileStat = await this.fileSystem.getFileStat(uriStr);
            if (!fileStat) {
                return undefined;
            }
            return fileStat;
        } catch (error) {
            return undefined;
        }
    }

    protected openWindow(uri: FileStat, options?: WorkspaceInput): void {
        const workspacePath = new URI(uri.uri).path.toString();

        if (this.shouldPreserveWindow(options)) {
            this.reloadWindow();
        } else {
            try {
                this.openNewWindow(workspacePath);
            } catch (error) {
                // Fall back to reloading the current window in case the browser has blocked the new window
                this._workspace = uri;
                this.logger.error(error.toString()).then(() => this.reloadWindow());
            }
        }
    }

    protected reloadWindow(): void {
        // Set the new workspace path as the URL fragment.
        if (this._workspace !== undefined) {
            this.setURLFragment(new URI(this._workspace.uri).path.toString());
        } else {
            this.setURLFragment('');
        }

        window.location.reload(true);
    }

    protected openNewWindow(workspacePath: string): void {
        const url = new URL(window.location.href);
        url.hash = workspacePath;
        this.windowService.openNewWindow(url.toString());
    }

    protected shouldPreserveWindow(options?: WorkspaceInput): boolean {
        return options !== undefined && !!options.preserveWindow;
    }

    /**
     * Return true if one of the paths in paths array is present in the workspace
     * NOTE: You should always explicitly use `/` as the separator between the path segments.
     */
    async containsSome(paths: string[]): Promise<boolean> {
        await this.roots;
        if (this.opened) {
            for (const root of this._roots) {
                const uri = new URI(root.uri);
                for (const path of paths) {
                    const fileUri = uri.resolve(path).toString();
                    const exists = await this.fileSystem.exists(fileUri);
                    if (exists) {
                        return exists;
                    }
                }
            }
        }
        return false;
    }

    get saved(): boolean {
        return !!this._workspace && !this._workspace.isDirectory;
    }

    /**
     * Save workspace data into a file
     * @param uri URI or FileStat of the workspace file
     */
    async save(uri: URI | FileStat): Promise<void> {
        const uriStr = uri instanceof URI ? uri.toString() : uri.uri;
        if (!await this.fileSystem.exists(uriStr)) {
            await this.fileSystem.createFile(uriStr);
        }
        const workspaceData: Required<WorkspaceData> = { folders: [], settings: {} };
        if (!this.saved) {
            for (const p of Object.keys(this.schemaProvider.getCombinedSchema().properties)) {
                if (this.schemaProvider.isValidInScope(p, PreferenceScope.Folder)) {
                    continue;
                }
                const preferences = this.preferenceImpl.inspect(p);
                if (preferences && preferences.workspaceValue) {
                    workspaceData.settings[p] = preferences.workspaceValue;
                }
            }
        }
        let stat = await this.toFileStat(uriStr);
        Object.assign(workspaceData, await this.readWorkspaceData());
        workspaceData.folders = this._roots.map(({ uri, name }) => ({ uri, name }));
        stat = await this.writeWorkspaceFile(stat, workspaceData);
        await this.server.setMostRecentlyUsedWorkspace(uriStr);
        await this.setWorkspace(stat);
        this.onWorkspaceLocationChangedEmitter.fire(stat);
    }

    protected readonly rootWatchers = new Map<string, Disposable>();

    protected watchRoots(): void {
        const rootUris = new Set(this._roots.map(r => r.uri));
        for (const [uri, watcher] of this.rootWatchers.entries()) {
            if (!rootUris.has(uri)) {
                watcher.dispose();
            }
        }
        for (const root of this._roots) {
            this.watchRoot(root);
        }
    }

    protected watchRoot(root: FileStat): void {
        const uriStr = root.uri;
        if (this.rootWatchers.has(uriStr)) {
            return;
        }
        const watcher = this.watcher.watchFileChanges(new URI(uriStr));
        this.rootWatchers.set(uriStr, Disposable.create(() => {
            watcher.then(disposable => disposable.dispose());
            this.rootWatchers.delete(uriStr);
        }));
    }

    /**
     * Returns the workspace root uri that the given file belongs to.
     * In case that the file is found in more than one workspace roots, returns the root that is closest to the file.
     * If the file is not from the current workspace, returns `undefined`.
     * @param uri URI of the file
     */
    getWorkspaceRootUri(uri: URI | undefined): URI | undefined {
        if (!uri) {
            const root = this.tryGetRoots()[0];
            if (root) {
                return new URI(root.uri);
            }
            return undefined;
        }
        const rootUris: URI[] = [];
        for (const root of this.tryGetRoots()) {
            const rootUri = new URI(root.uri);
            if (rootUri && rootUri.isEqualOrParent(uri)) {
                rootUris.push(rootUri);
            }
        }
        return rootUris.sort((r1, r2) => r2.toString().length - r1.toString().length)[0];
    }

    areWorkspaceRoots(uris: URI[]): boolean {
        if (!uris.length) {
            return false;
        }
        const rootUris = new Set(this.tryGetRoots().map(root => root.uri));
        return uris.every(uri => rootUris.has(uri.toString()));
    }

    protected async readWorkspaceData(): Promise<any> {
        if (!this._workspace || this._workspace.isDirectory) {
            return undefined;
        }
        try {
            const { content } = await this.fileSystem.resolveContent(this._workspace.uri);
            const strippedContent = jsoncparser.stripComments(content);
            return jsoncparser.parse(strippedContent);
        } catch (e) {
            if (FileSystemError.FileIsDirectory.is(e) || FileSystemError.FileNotFound.is(e)) {
                return undefined;
            }
            throw e;
        }
    }

}

export interface WorkspaceInput {

    /**
     * Tests whether the same window should be used or a new one has to be opened after setting the workspace root. By default it is `false`.
     */
    preserveWindow?: boolean;

}

export interface FileWorkspaceFolderData {
    path: string
    name?: string
}
export namespace FileWorkspaceFolderData {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function is(data: any): data is FileWorkspaceFolderData {
        return (data && typeof data === 'object') &&
            ('path' in data && typeof data['path'] === 'string') &&
            (!('name' in data) || typeof data['name'] === 'string')
    }
}

export interface UriWorkspaceFolderData {
    uri: string
    name?: string
}
export namespace UriWorkspaceFolderData {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function is(data: any): data is UriWorkspaceFolderData {
        return (data && typeof data === 'object') &&
            ('uri' in data && typeof data['uri'] === 'string') &&
            (!('name' in data) || typeof data['name'] === 'string')
    }
}

export type WorkspaceFolderData = FileWorkspaceFolderData | UriWorkspaceFolderData;
export namespace WorkspaceFolderData {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function is(data: any): data is WorkspaceFolderData {
        return FileWorkspaceFolderData.is(data) || UriWorkspaceFolderData.is(data);
    }
}

export interface WorkspaceData {
    folders: WorkspaceFolderData[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    settings?: { [id: string]: any };
}
