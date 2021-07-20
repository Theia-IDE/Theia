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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { injectable, inject, postConstruct } from 'inversify';
import { Emitter, Event, Disposable } from '../../common';
import { CompositeTreeNode, TreeNode, Tree } from './tree';

export const TreeExpansionService = Symbol('TreeExpansionService');

/**
 * The tree expandable service.
 */
export interface TreeExpansionService extends Disposable {
    /**
     * Emit when the node is expanded or collapsed.
     */
    readonly onExpansionChanged: Event<Readonly<ExpandableTreeNode>>;
    /**
     * Expand a node for the given node id if it is valid and collapsed.
     * Expanding a node refreshes all its children.
     *
     * Return a valid expanded refreshed node or `undefined` if such does not exist.
     */
    expandNode(node: Readonly<ExpandableTreeNode>): Promise<Readonly<ExpandableTreeNode> | undefined>;
    /**
     * If the given node is valid and expanded then collapse it.
     *
     * Return true if a node has been collapsed; otherwise false.
     */
    collapseNode(node: Readonly<ExpandableTreeNode>): Promise<boolean>;
    /**
     * If the given node is valid then collapse it recursively.
     *
     * Return true if a node has been collapsed; otherwise false.
     */
    collapseAll(node: Readonly<CompositeTreeNode>): Promise<boolean>;
    /**
     * If the given node is invalid then does nothing.
     * If the given node is collapsed then expand it; otherwise collapse it.
     */
    toggleNodeExpansion(node: Readonly<ExpandableTreeNode>): Promise<void>;
}

/**
 * The expandable tree node.
 */
export interface ExpandableTreeNode extends CompositeTreeNode {
    /**
     * Test whether this tree node is expanded.
     */
    expanded: boolean;
}

export namespace ExpandableTreeNode {
    export function is(node?: any): node is ExpandableTreeNode {
        // eslint-disable-next-line no-null/no-null
        return typeof node === 'object' && node !== null && CompositeTreeNode.is(node) && 'expanded' in node;
    }

    export function isExpanded(node?: any): node is ExpandableTreeNode {
        return ExpandableTreeNode.is(node) && node.expanded;
    }

    export function isCollapsed(node?: any): node is ExpandableTreeNode {
        return ExpandableTreeNode.is(node) && !node.expanded;
    }
}

@injectable()
export class TreeExpansionServiceImpl implements TreeExpansionService {

    @inject(Tree) protected readonly tree: Tree;
    protected readonly onExpansionChangedEmitter = new Emitter<ExpandableTreeNode>();

    @postConstruct()
    protected init(): void {
        this.tree.onNodeRefreshed(node => {
            for (const child of node.children) {
                if (ExpandableTreeNode.isExpanded(child)) {
                    node.waitUntil(this.tree.refresh(child));
                }
            }
        });
    }

    dispose(): void {
        this.onExpansionChangedEmitter.dispose();
    }

    get onExpansionChanged(): Event<ExpandableTreeNode> {
        return this.onExpansionChangedEmitter.event;
    }

    protected fireExpansionChanged(node: ExpandableTreeNode): void {
        this.onExpansionChangedEmitter.fire(node);
    }

    async expandNode(raw: ExpandableTreeNode): Promise<ExpandableTreeNode | undefined> {
        const node = this.tree.validateNode(raw);
        if (ExpandableTreeNode.isCollapsed(node)) {
            return this.doExpandNode(node);
        }
        return undefined;
    }

    protected async doExpandNode(node: ExpandableTreeNode): Promise<ExpandableTreeNode | undefined> {
        const refreshed = await this.tree.refresh(node);
        if (ExpandableTreeNode.is(refreshed)) {
            refreshed.expanded = true;
            this.fireExpansionChanged(refreshed);
            return refreshed;
        }
        return undefined;
    }

    async collapseNode(raw: ExpandableTreeNode): Promise<boolean> {
        const node = this.tree.validateNode(raw);
        return this.doCollapseNode(node);
    }

    async collapseAll(raw: CompositeTreeNode): Promise<boolean> {
        const node = this.tree.validateNode(raw);
        return this.doCollapseAll(node);
    }

    protected doCollapseAll(node: TreeNode | undefined): boolean {
        let result = false;
        if (CompositeTreeNode.is(node)) {
            for (const child of node.children) {
                result = this.doCollapseAll(child) || result;
            }
        }
        return this.doCollapseNode(node) || result;
    }

    protected doCollapseNode(node: TreeNode | undefined): boolean {
        if (!ExpandableTreeNode.isExpanded(node)) {
            return false;
        }
        node.expanded = false;
        this.fireExpansionChanged(node);
        return true;
    }

    async toggleNodeExpansion(node: ExpandableTreeNode): Promise<void> {
        if (node.expanded) {
            await this.collapseNode(node);
        } else {
            await this.expandNode(node);
        }
    }

}
