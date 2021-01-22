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
import { FileTree, DirNode } from '@theia/filesystem/lib/browser';
import { FileStat } from '@theia/filesystem/lib/common/files';
import URI from '@theia/core/lib/common/uri';
import { TreeNode, CompositeTreeNode, SelectableTreeNode } from '@theia/core/lib/browser';
import { FileNavigatorFilter } from './navigator-filter';

@injectable()
export class FileNavigatorTree extends FileTree {

    @inject(FileNavigatorFilter) protected readonly filter: FileNavigatorFilter;

    @postConstruct()
    protected init(): void {
        this.toDispose.push(this.filter.onFilterChanged(() => this.refresh()));
    }

    async resolveChildren(parent: CompositeTreeNode): Promise<TreeNode[]> {
        if (WorkspaceNode.is(parent)) {
            return parent.children;
        }
        return this.filter.filter(super.resolveChildren(parent));
    }

    protected toNodeId(uri: URI, parent: CompositeTreeNode): string {
        const workspaceRootNode = WorkspaceRootNode.find(parent);
        if (workspaceRootNode) {
            return this.createId(workspaceRootNode, uri);
        }
        return super.toNodeId(uri, parent);
    }
    createId(root: WorkspaceRootNode, uri: URI): string {
        const id = super.toNodeId(uri, root);
        return id === root.id ? id : `${root.id}:${id}`;
    }

    async createWorkspaceRoot(rootFolder: (FileStat & { rootName?: string }), workspaceNode: WorkspaceNode): Promise<WorkspaceRootNode> {
        const node = this.toNode(rootFolder, workspaceNode) as WorkspaceRootNode;
        Object.assign(node, {
            visible: workspaceNode.name !== WorkspaceNode.name,
            rootName: rootFolder.rootName,
        });
        return node;
    }
}

/**
 * File tree root node for multi-root workspaces.
 */
export interface WorkspaceNode extends CompositeTreeNode, SelectableTreeNode {
    children: WorkspaceRootNode[];
}
export namespace WorkspaceNode {

    export const id = 'WorkspaceNodeId';
    export const name = 'WorkspaceNode';

    export function is(node: TreeNode | undefined): node is WorkspaceNode {
        return CompositeTreeNode.is(node) && node.id === WorkspaceNode.id;
    }

    /**
     * Create a `WorkspaceNode` that can be used as a `Tree` root.
     */
    export function createRoot(multiRootName?: string): WorkspaceNode {
        return {
            id: WorkspaceNode.id,
            name: multiRootName || WorkspaceNode.name,
            parent: undefined,
            children: [],
            visible: false,
            selected: false
        };
    }
}

/**
 * A node representing a folder from a multi-root workspace.
 */
export interface WorkspaceRootNode extends DirNode {
    parent: WorkspaceNode;
    rootName?: string;
}
export namespace WorkspaceRootNode {

    export function is(node: Object | undefined): node is WorkspaceRootNode {
        return DirNode.is(node) && WorkspaceNode.is(node.parent);
    }

    export function find(node: TreeNode | undefined): WorkspaceRootNode | undefined {
        if (node) {
            if (is(node)) {
                return node;
            }
            return find(node.parent);
        }
    }
}
