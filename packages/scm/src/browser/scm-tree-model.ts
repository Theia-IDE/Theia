/********************************************************************************
 * Copyright (C) 2020 Arm and others.
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

import { injectable, inject } from '@theia/core/shared/inversify';
import { TreeModelImpl, TreeNode, TreeProps, CompositeTreeNode, SelectableTreeNode, ExpandableTreeNode } from '@theia/core/lib/browser/tree';
import URI from '@theia/core/lib/common/uri';
import { ScmProvider, ScmResourceGroup, ScmResource, ScmResourceDecorations } from './scm-provider';
import { ScmContextKeyService } from './scm-context-key-service';
import { ScmViewMode } from './scm-preferences';

export const ScmTreeModelProps = Symbol('ScmTreeModelProps');
export interface ScmTreeModelProps {
    defaultExpansion?: 'collapsed' | 'expanded';
    nestingThreshold?: number;
}

export interface ScmFileChangeRootNode extends CompositeTreeNode {
    rootUri: string;
    children: ScmFileChangeGroupNode[];
}

export interface ScmFileChangeGroupNode extends ExpandableTreeNode {
    groupId: string;
    groupLabel: string;
    children: (ScmFileChangeFolderNode | ScmFileChangeNode)[];
}

export namespace ScmFileChangeGroupNode {
    export function is(node: TreeNode): node is ScmFileChangeGroupNode {
        return 'groupId' in node && 'children' in node
            && !ScmFileChangeFolderNode.is(node);
    }
}

export interface ScmFileChangeFolderNode extends ExpandableTreeNode, SelectableTreeNode {
    groupId: string;
    path: string;
    sourceUri: string;
    children: (ScmFileChangeFolderNode | ScmFileChangeNode)[];
}

export namespace ScmFileChangeFolderNode {
    export function is(node: TreeNode): node is ScmFileChangeFolderNode {
        return 'groupId' in node && 'sourceUri' in node && 'path' in node && 'children' in node;
    }
}

export interface ScmFileChangeNode extends SelectableTreeNode {
    sourceUri: string;
    decorations?: ScmResourceDecorations;
}

export namespace ScmFileChangeNode {
    export function is(node: TreeNode): node is ScmFileChangeNode {
        return 'sourceUri' in node
            && !ScmFileChangeFolderNode.is(node);
    }
    export function getGroupId(node: ScmFileChangeNode): string {
        const parentNode = node.parent;
        if (!(parentNode && (ScmFileChangeFolderNode.is(parentNode) || ScmFileChangeGroupNode.is(parentNode)))) {
            throw new Error('bad node');
        }
        return parentNode.groupId;
    }

}

@injectable()
export abstract class ScmTreeModel extends TreeModelImpl {

    private _languageId: string | undefined;

    protected provider: ScmProvider | undefined;

    @inject(TreeProps) protected readonly props: ScmTreeModelProps;

    @inject(ScmContextKeyService) protected readonly contextKeys: ScmContextKeyService;

    get languageId(): string | undefined {
        return this._languageId;
    }

    abstract canTabToWidget(): boolean;

    protected _viewMode: ScmViewMode = 'list';
    set viewMode(id: ScmViewMode) {
        const oldSelection = this.selectedNodes;
        this._viewMode = id;
        if (this.root) {
            this.root = this.createTree();

            for (const oldSelectedNode of oldSelection) {
                const newNode = this.getNode(oldSelectedNode.id);
                if (SelectableTreeNode.is(newNode)) {
                    this.revealNode(newNode);  // this call can run asynchronously
                }
            }
        }
    }
    get viewMode(): ScmViewMode {
        return this._viewMode;
    }

    abstract get rootUri(): string | undefined;
    abstract get groups(): ScmResourceGroup[];

    protected createTree(): ScmFileChangeRootNode {
        const root = {
            id: 'file-change-tree-root',
            parent: undefined,
            visible: false,
            rootUri: this.rootUri,
            children: []
        } as ScmFileChangeRootNode;

        const groupNodes = this.groups
            .filter(group => !!group.resources.length || !group.hideWhenEmpty)
            .map(group => this.toGroupNode(group, root));
        root.children = groupNodes;

        return root;
    }

    protected toGroupNode(group: ScmResourceGroup, parent: CompositeTreeNode): ScmFileChangeGroupNode {
        const groupNode: ScmFileChangeGroupNode = {
            id: `${group.id}`,
            groupId: group.id,
            groupLabel: group.label,
            parent,
            children: [],
            expanded: true,
        };

        const sortedResources = group.resources.sort((r1, r2) =>
            r1.sourceUri.toString().localeCompare(r2.sourceUri.toString())
        );

        switch (this._viewMode) {
            case 'list':
                groupNode.children = sortedResources.map(resource => this.toFileChangeNode(resource, groupNode));
                break;
            case 'tree':
                const rootUri = group.provider.rootUri;
                if (rootUri) {
                    const resourcePaths = sortedResources.map(resource => {
                        const relativePath = new URI(rootUri).relative(resource.sourceUri);
                        const pathParts = relativePath ? relativePath.toString().split('/') : [];
                        return { resource, pathParts };
                    });
                    groupNode.children = this.buildFileChangeTree(resourcePaths, 0, sortedResources.length, 0, groupNode);
                }
                break;
        }

        return groupNode;
    }

    protected buildFileChangeTree(
        sortedResources: { resource: ScmResource, pathParts: string[] }[],
        start: number,
        end: number,
        level: number,
        parent: (ScmFileChangeGroupNode | ScmFileChangeFolderNode)
    ): (ScmFileChangeFolderNode | ScmFileChangeNode)[] {
        const result: (ScmFileChangeFolderNode | ScmFileChangeNode)[] = [];

        let folderStart = start;
        while (folderStart < end) {
            const firstFileChange = sortedResources[folderStart];
            if (level === firstFileChange.pathParts.length - 1) {
                result.push(this.toFileChangeNode(firstFileChange.resource, parent));
                folderStart++;
            } else {
                let index = folderStart + 1;
                while (index < end) {
                    if (sortedResources[index].pathParts[level] !== firstFileChange.pathParts[level]) {
                        break;
                    }
                    index++;
                }
                const folderEnd = index;

                const nestingThreshold = this.props.nestingThreshold || 1;
                if (folderEnd - folderStart < nestingThreshold) {
                    // Inline these (i.e. do not create another level in the tree)
                    for (let i = folderStart; i < folderEnd; i++) {
                        result.push(this.toFileChangeNode(sortedResources[i].resource, parent));
                    }
                } else {
                    const firstFileParts = firstFileChange.pathParts;
                    const lastFileParts = sortedResources[folderEnd - 1].pathParts;
                    // Multiple files with first folder.
                    // See if more folder levels match and include those if so.
                    let thisLevel = level + 1;
                    while (thisLevel < firstFileParts.length - 1 && thisLevel < lastFileParts.length - 1 && firstFileParts[thisLevel] === lastFileParts[thisLevel]) {
                        thisLevel++;
                    }
                    const nodeRelativePath = firstFileParts.slice(level, thisLevel).join('/');
                    result.push(this.toFileChangeFolderNode(sortedResources, folderStart, folderEnd, thisLevel, nodeRelativePath, parent));
                }
                folderStart = folderEnd;
            }
        };
        return result.sort(this.compareNodes);
    }

    protected compareNodes = (a: ScmFileChangeFolderNode | ScmFileChangeNode, b: ScmFileChangeFolderNode | ScmFileChangeNode) => this.doCompareNodes(a, b);
    protected doCompareNodes(a: ScmFileChangeFolderNode | ScmFileChangeNode, b: ScmFileChangeFolderNode | ScmFileChangeNode): number {
        const isFolderA = ScmFileChangeFolderNode.is(a);
        const isFolderB = ScmFileChangeFolderNode.is(b);
        if (isFolderA && !isFolderB) {
            return -1;
        }
        if (isFolderB && !isFolderA) {
            return 1;
        }
        return a.sourceUri.localeCompare(b.sourceUri);
    }

    protected toFileChangeFolderNode(
        resources: { resource: ScmResource, pathParts: string[] }[],
        start: number,
        end: number,
        level: number,
        nodeRelativePath: string,
        parent: (ScmFileChangeGroupNode | ScmFileChangeFolderNode)
    ): ScmFileChangeFolderNode {
        const rootUri = this.getRoot(parent).rootUri;
        let parentPath: string = rootUri;
        if (ScmFileChangeFolderNode.is(parent)) {
            parentPath = parent.sourceUri;
        }
        const sourceUri = new URI(parentPath).resolve(nodeRelativePath);

        const defaultExpansion = this.props.defaultExpansion ? (this.props.defaultExpansion === 'expanded') : true;
        const id = `${parent.groupId}:${String(sourceUri)}`;
        const oldNode = this.getNode(id);
        const folderNode: ScmFileChangeFolderNode = {
            id,
            groupId: parent.groupId,
            path: nodeRelativePath,
            sourceUri: String(sourceUri),
            children: [],
            parent,
            expanded: ExpandableTreeNode.is(oldNode) ? oldNode.expanded : defaultExpansion,
            selected: SelectableTreeNode.is(oldNode) && oldNode.selected,
        };
        folderNode.children = this.buildFileChangeTree(resources, start, end, level, folderNode);
        return folderNode;
    }

    protected getRoot(node: ScmFileChangeGroupNode | ScmFileChangeFolderNode): ScmFileChangeRootNode {
        let parent = node.parent!;
        while (ScmFileChangeGroupNode.is(parent) && ScmFileChangeFolderNode.is(parent)) {
            parent = parent.parent!;
        }
        return parent as ScmFileChangeRootNode;
    }

    protected toFileChangeNode(resource: ScmResource, parent: CompositeTreeNode): ScmFileChangeNode {
        const id = `${resource.group.id}:${String(resource.sourceUri)}`;
        const oldNode = this.getNode(id);
        const node = {
            id,
            sourceUri: String(resource.sourceUri),
            decorations: resource.decorations,
            parent,
            selected: SelectableTreeNode.is(oldNode) && oldNode.selected,
        };
        if (node.selected) {
            this.selectionService.addSelection(node);
        }
        return node;
    }

    protected async revealNode(node: TreeNode): Promise<void> {
        if (ScmFileChangeFolderNode.is(node) || ScmFileChangeNode.is(node)) {
            const parentNode = node.parent;
            if (ExpandableTreeNode.is(parentNode)) {
                await this.revealNode(parentNode);
                if (!parentNode.expanded) {
                    await this.expandNode(parentNode);
                }
            }
        }
    }

    getResourceFromNode(node: ScmFileChangeNode): ScmResource | undefined {
        const groupId = ScmFileChangeNode.getGroupId(node);
        const group = this.findGroup(groupId);
        if (group) {
            return group.resources.find(r => String(r.sourceUri) === node.sourceUri)!;
        }
    }

    getResourceGroupFromNode(node: ScmFileChangeGroupNode): ScmResourceGroup | undefined {
        return this.findGroup(node.groupId);
    }

    getResourcesFromFolderNode(node: ScmFileChangeFolderNode): ScmResource[] {
        const resources: ScmResource[] = [];
        const group = this.findGroup(node.groupId);
        if (group) {
            this.collectResources(resources, node, group);
        }
        return resources;

    }
    getSelectionArgs(selectedNodes: Readonly<SelectableTreeNode[]>): ScmResource[] {
        const resources: ScmResource[] = [];
        for (const node of selectedNodes) {
            if (ScmFileChangeNode.is(node)) {
                const groupId = ScmFileChangeNode.getGroupId(node);
                const group = this.findGroup(groupId);
                if (group) {
                    const selectedResource = group.resources.find(r => String(r.sourceUri) === node.sourceUri);
                    if (selectedResource) {
                        resources.push(selectedResource);
                    }
                }
            }
            if (ScmFileChangeFolderNode.is(node)) {
                const group = this.findGroup(node.groupId);
                if (group) {
                    this.collectResources(resources, node, group);
                }
            }
        }
        // Remove duplicates which may occur if user selected folder and nested folder
        return resources.filter((item1, index) => resources.findIndex(item2 => item1.sourceUri === item2.sourceUri) === index);
    }

    protected collectResources(resources: ScmResource[], node: TreeNode, group: ScmResourceGroup): void {
        if (ScmFileChangeFolderNode.is(node)) {
            for (const child of node.children) {
                this.collectResources(resources, child, group);
            }
        } else if (ScmFileChangeNode.is(node)) {
            const resource = group.resources.find(r => String(r.sourceUri) === node.sourceUri)!;
            resources.push(resource);
        }
    }

    execInNodeContext(node: TreeNode, callback: () => void): void {
        if (!this.provider) {
            return;
        }

        let groupId: string;
        if (ScmFileChangeGroupNode.is(node) || ScmFileChangeFolderNode.is(node)) {
            groupId = node.groupId;
        } else if (ScmFileChangeNode.is(node)) {
            groupId = ScmFileChangeNode.getGroupId(node);
        } else {
            return;
        }

        this.contextKeys.scmProvider.set(this.provider.id);
        this.contextKeys.scmResourceGroup.set(groupId);
        try {
            callback();
        } finally {
        }
    }

    /*
     * Normally the group would always be expected to be found.  However if the tree is restored
     * in restoreState then the tree may be rendered before the groups have been created
     * in the provider.  The provider's groups property will be empty in such a situation.
     * We want to render the tree (as that is the point of restoreState, we can render
     * the tree in the saved state before the provider has provided status).  We therefore must
     * be prepared to render the tree without having the ScmResourceGroup or ScmResource
     * objects.
     */
    findGroup(groupId: string): ScmResourceGroup | undefined {
        return this.groups.find(g => g.id === groupId);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storeState(): any {
        return {
            ...super.storeState(),
            mode: this.viewMode,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    restoreState(oldState: any): void {
        super.restoreState(oldState);
        this.viewMode = oldState.mode === 'tree' ? 'tree' : 'list';
    }

}
