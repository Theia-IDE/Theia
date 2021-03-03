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
import { CompositeTreeNode, TreeModelImpl, TreeNode, ConfirmDialog } from '@theia/core/lib/browser';
import { FileStatNode, DirNode, FileNode } from './file-tree';
import { LocationService } from '../location';
import { LabelProvider } from '@theia/core/lib/browser/label-provider';
import { FileService } from '../file-service';
import { FileOperationError, FileOperationResult, FileChangesEvent, FileChangeType, FileChange, FileOperation, FileOperationEvent } from '../../common/files';
import { MessageService } from '@theia/core/lib/common/message-service';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { FileSystemUtils } from '../../common/filesystem-utils';

@injectable()
export class FileTreeModel extends TreeModelImpl implements LocationService {

    @inject(LabelProvider) protected readonly labelProvider: LabelProvider;

    @inject(FileService)
    protected readonly fileService: FileService;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(EnvVariablesServer)
    protected readonly environments: EnvVariablesServer;

    @postConstruct()
    protected init(): void {
        super.init();
        this.toDispose.push(this.fileService.onDidFilesChange(changes => this.onFilesChanged(changes)));
        this.toDispose.push(this.fileService.onDidRunOperation(event => this.onDidMove(event)));
    }

    get location(): URI | undefined {
        const root = this.root;
        if (FileStatNode.is(root)) {
            return root.uri;
        }
        return undefined;
    }

    set location(uri: URI | undefined) {
        if (uri) {
            this.fileService.resolve(uri).then(fileStat => {
                if (fileStat) {
                    const node = DirNode.createRoot(fileStat);
                    this.navigateTo(node);
                }
            }).catch(() => {
                // no-op, allow failures for file dialog text input
            });
        } else {
            this.navigateTo(undefined);
        }
    }

    async drives(): Promise<URI[]> {
        try {
            const drives = await this.environments.getDrives();
            return drives.map(uri => new URI(uri));
        } catch (e) {
            this.logger.error('Error when loading drives.', e);
            return [];
        }
    }

    get selectedFileStatNodes(): Readonly<FileStatNode>[] {
        return this.selectedNodes.filter(FileStatNode.is);
    }

    *getNodesByUri(uri: URI): IterableIterator<TreeNode> {
        const node = this.getNode(uri.toString());
        if (node) {
            yield node;
        }
    }

    /**
     * to workaround https://github.com/Axosoft/nsfw/issues/42
     */
    protected onDidMove(event: FileOperationEvent): void {
        if (!event.isOperation(FileOperation.MOVE)) {
            return;
        }
        if (event.resource.parent.toString() === event.target.resource.parent.toString()) {
            // file rename
            return;
        }
        this.refreshAffectedNodes([
            event.resource,
            event.target.resource
        ]);
    }

    protected onFilesChanged(changes: FileChangesEvent): void {
        if (!this.refreshAffectedNodes(this.getAffectedUris(changes)) && this.isRootAffected(changes)) {
            this.refresh();
        }
    }

    protected isRootAffected(changes: FileChangesEvent): boolean {
        const root = this.root;
        if (FileStatNode.is(root)) {
            return changes.contains(root.uri, FileChangeType.ADDED) || changes.contains(root.uri, FileChangeType.UPDATED);
        }
        return false;
    }

    protected getAffectedUris(changes: FileChangesEvent): URI[] {
        return changes.changes.filter(change => !this.isFileContentChanged(change)).map(change => change.resource);
    }

    protected isFileContentChanged(change: FileChange): boolean {
        return change.type === FileChangeType.UPDATED && FileNode.is(this.getNodesByUri(change.resource).next().value);
    }

    protected refreshAffectedNodes(uris: URI[]): boolean {
        const nodes = this.getAffectedNodes(uris);
        for (const node of nodes.values()) {
            this.refresh(node);
        }
        return nodes.size !== 0;
    }

    protected getAffectedNodes(uris: URI[]): Map<string, CompositeTreeNode> {
        const nodes = new Map<string, CompositeTreeNode>();
        for (const uri of uris) {
            for (const node of this.getNodesByUri(uri.parent)) {
                if (DirNode.is(node) && node.expanded) {
                    nodes.set(node.id, node);
                }
            }
        }
        return nodes;
    }

    async copy(source: URI, target: Readonly<FileStatNode>): Promise<URI> {
        let targetUri = target.uri.resolve(source.path.base);
        // duplicate file or folder
        if (source.path.toString() === target.uri.path.toString()) {
            const parent = await this.fileService.resolve(source.parent);
            const name = source.path.name + '_copy';
            targetUri = FileSystemUtils.generateUniqueResourceURI(source.parent, parent, name, source.path.ext);
        }
        try {
            await this.fileService.copy(source, targetUri);
        } catch (e) {
            this.messageService.error(e.message);
        }
        return targetUri;
    }

    /**
     * Move the given source file or directory to the given target directory.
     */
    async move(source: TreeNode, target: TreeNode): Promise<URI | undefined> {
        if (DirNode.is(target) && FileStatNode.is(source)) {
            const name = source.fileStat.name;
            const targetUri = target.uri.resolve(name);
            try {
                await this.fileService.move(source.uri, targetUri);
                return targetUri;
            } catch (e) {
                if (e instanceof FileOperationError && e.fileOperationResult === FileOperationResult.FILE_MOVE_CONFLICT) {
                    const fileName = this.labelProvider.getName(source);
                    if (await this.shouldReplace(fileName)) {
                        try {
                            await this.fileService.move(source.uri, targetUri, { overwrite: true });
                            return targetUri;
                        } catch (e2) {
                            this.messageService.error(e2.message);
                        }
                    }
                } else {
                    this.messageService.error(e.message);
                }
            }
        }
        return undefined;
    }

    protected async shouldReplace(fileName: string): Promise<boolean> {
        const dialog = new ConfirmDialog({
            title: 'Replace file',
            msg: `File '${fileName}' already exists in the destination folder. Do you want to replace it?`,
            ok: 'Yes',
            cancel: 'No'
        });
        return !!await dialog.open();
    }

}
