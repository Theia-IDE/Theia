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
import { injectable, inject, postConstruct } from 'inversify';
import { WorkspaceExt, StorageExt, MAIN_RPC_CONTEXT, WorkspaceMain, WorkspaceFolderPickOptionsMain, PLUGIN_RPC_CONTEXT } from '../../common/plugin-api-rpc';
import { RPCProtocol, ProxyIdentifier } from '../../common/rpc-protocol';
import Uri from 'vscode-uri';
import { UriComponents } from '../../common/uri-components';
import { QuickOpenModel, QuickOpenItem, QuickOpenMode } from '@theia/core/lib/browser/quick-open/quick-open-model';
import { MonacoQuickOpenService } from '@theia/monaco/lib/browser/monaco-quick-open-service';
import { FileStat } from '@theia/filesystem/lib/common';
import { FileSearchService } from '@theia/file-search/lib/common/file-search-service';
import URI from '@theia/core/lib/common/uri';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { FileWatcherSubscriberOptions } from '../../common/plugin-api-rpc-model';
import { InPluginFileSystemWatcherManager } from './in-plugin-filesystem-watcher-manager';
import { PluginServer } from '../../common/plugin-protocol';
import { FileSystemPreferences } from '@theia/filesystem/lib/browser';
import { TextContentResourceResolver } from './text-content-resource';
import { RPCProtocolServiceProvider } from './main-context';

@injectable()
export class WorkspaceMainImpl implements WorkspaceMain, Disposable, RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any> = PLUGIN_RPC_CONTEXT.WORKSPACE_MAIN;

    private proxy: WorkspaceExt;

    private storageProxy: StorageExt;

    @inject(MonacoQuickOpenService)
    private quickOpenService: MonacoQuickOpenService;

    @inject(FileSearchService)
    private fileSearchService: FileSearchService;

    @inject(InPluginFileSystemWatcherManager)
    private inPluginFileSystemWatcherManager: InPluginFileSystemWatcherManager;

    private roots: FileStat[];

    @inject(TextContentResourceResolver)
    private resourceResolver: TextContentResourceResolver;

    @inject(PluginServer)
    private pluginServer: PluginServer;

    @inject(WorkspaceService)
    private workspaceService: WorkspaceService;

    @inject(FileSystemPreferences)
    private fsPreferences: FileSystemPreferences;

    @inject(RPCProtocol)
    private readonly rpc: RPCProtocol;

    protected readonly toDispose = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        this.proxy = this.rpc.getProxy(MAIN_RPC_CONTEXT.WORKSPACE_EXT);
        this.storageProxy = this.rpc.getProxy(MAIN_RPC_CONTEXT.STORAGE_EXT);

        this.processWorkspaceFoldersChanged(this.workspaceService.tryGetRoots());
        this.toDispose.push(this.workspaceService.onWorkspaceChanged(roots => {
            this.processWorkspaceFoldersChanged(roots);
        }));
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    protected async processWorkspaceFoldersChanged(roots: FileStat[]): Promise<void> {
        if (this.isAnyRootChanged(roots) === false) {
            return;
        }
        this.roots = roots;
        this.proxy.$onWorkspaceFoldersChanged({ roots });

        const keyValueStorageWorkspacesData = await this.pluginServer.getAllStorageValues({
            workspace: this.workspaceService.workspace,
            roots: this.workspaceService.tryGetRoots()
        });
        this.storageProxy.$updatePluginsWorkspaceData(keyValueStorageWorkspacesData);

    }

    private isAnyRootChanged(roots: FileStat[]): boolean {
        if (!this.roots || this.roots.length !== roots.length) {
            return true;
        }

        return this.roots.some((root, index) => root.uri !== roots[index].uri);
    }

    $pickWorkspaceFolder(options: WorkspaceFolderPickOptionsMain): Promise<theia.WorkspaceFolder | undefined> {
        return new Promise((resolve, reject) => {
            // Return undefined if workspace root is not set
            if (!this.roots || !this.roots.length) {
                resolve(undefined);
                return;
            }

            // Active before appearing the pick menu
            const activeElement: HTMLElement | undefined = window.document.activeElement as HTMLElement;

            // WorkspaceFolder to be returned
            let returnValue: theia.WorkspaceFolder | undefined;

            const items = this.roots.map(root => {
                const rootUri = Uri.parse(root.uri);
                const rootPathName = rootUri.path.substring(rootUri.path.lastIndexOf('/') + 1);
                return new QuickOpenItem({
                    label: rootPathName,
                    detail: rootUri.path,
                    run: mode => {
                        if (mode === QuickOpenMode.OPEN) {
                            returnValue = {
                                uri: rootUri,
                                name: rootPathName,
                                index: 0
                            } as theia.WorkspaceFolder;
                        }
                        return true;
                    }
                });
            });

            // Create quick open model
            const model = {
                onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): void {
                    acceptor(items);
                }
            } as QuickOpenModel;

            // Show pick menu
            this.quickOpenService.open(model, {
                fuzzyMatchLabel: true,
                fuzzyMatchDetail: true,
                fuzzyMatchDescription: true,
                placeholder: options.placeHolder,
                onClose: () => {
                    if (activeElement) {
                        activeElement.focus({ preventScroll: true });
                    }

                    resolve(returnValue);
                }
            });
        });
    }

    async $startFileSearch(includePattern: string, includeFolderUri: string | undefined, excludePatternOrDisregardExcludes?: string | false,
        maxResults?: number): Promise<UriComponents[]> {
        const roots: FileSearchService.RootOptions = {};
        const rootUris = includeFolderUri ? [includeFolderUri] : this.roots.map(r => r.uri);
        for (const rootUri of rootUris) {
            roots[rootUri] = {};
        }
        const opts: FileSearchService.Options = { rootOptions: roots };
        if (includePattern) {
            opts.includePatterns = [includePattern];
        }
        if (typeof excludePatternOrDisregardExcludes === 'string') {
            opts.excludePatterns = [excludePatternOrDisregardExcludes];
        }
        if (excludePatternOrDisregardExcludes !== false) {
            for (const rootUri of rootUris) {
                const filesExclude = this.fsPreferences.get('files.exclude', undefined, rootUri);
                if (filesExclude) {
                    for (const excludePattern in filesExclude) {
                        if (filesExclude[excludePattern]) {
                            const rootOptions = roots[rootUri];
                            const rootExcludePatterns = rootOptions.excludePatterns || [];
                            rootExcludePatterns.push(excludePattern);
                            rootOptions.excludePatterns = rootExcludePatterns;
                        }
                    }
                }
            }
        }
        if (typeof maxResults === 'number') {
            opts.limit = maxResults;
        }
        const uriStrs = await this.fileSearchService.find('', opts);
        return uriStrs.map(uriStr => Uri.parse(uriStr));
    }

    async $registerFileSystemWatcher(options: FileWatcherSubscriberOptions): Promise<string> {
        const handle = this.inPluginFileSystemWatcherManager.registerFileWatchSubscription(options, this.proxy);
        this.toDispose.push(Disposable.create(() => this.inPluginFileSystemWatcherManager.unregisterFileWatchSubscription(handle)));
        return handle;
    }

    $unregisterFileSystemWatcher(watcherId: string): Promise<void> {
        this.inPluginFileSystemWatcherManager.unregisterFileWatchSubscription(watcherId);
        return Promise.resolve();
    }

    async $registerTextDocumentContentProvider(scheme: string): Promise<void> {
        this.resourceResolver.registerContentProvider(scheme, this.proxy);
        this.toDispose.push(Disposable.create(() => this.resourceResolver.unregisterContentProvider(scheme)));
    }

    $unregisterTextDocumentContentProvider(scheme: string): void {
        this.resourceResolver.unregisterContentProvider(scheme);
    }

    $onTextDocumentContentChange(uri: string, content: string): void {
        this.resourceResolver.onContentChange(uri, content);
    }

    async $updateWorkspaceFolders(start: number, deleteCount?: number, ...rootsToAdd: string[]): Promise<void> {
        await this.workspaceService.spliceRoots(start, deleteCount, ...rootsToAdd.map(root => new URI(root)));
    }

}
