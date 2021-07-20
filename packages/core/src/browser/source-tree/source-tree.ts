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

import { injectable } from 'inversify';
import { MaybePromise } from '../../common/types';
import { TreeImpl, CompositeTreeNode, TreeNode, SelectableTreeNode, ExpandableTreeNode } from '../tree';
import { TreeElement, CompositeTreeElement, TreeSource } from './tree-source';

@injectable()
export class SourceTree extends TreeImpl {

    async resolveChildren(parent: TreeElementNodeParent): Promise<TreeNode[]> {
        const elements = await this.resolveElements(parent);
        const nodes: TreeNode[] = [];
        let index = 0;
        for (const element of elements) {
            if (element.visible !== false) {
                nodes.push(this.toNode(element, index++, parent));
            }
        }
        return nodes;
    }

    protected resolveElements(parent: TreeElementNodeParent): MaybePromise<IterableIterator<TreeElement>> {
        if (TreeSourceNode.is(parent)) {
            return parent.source.getElements();
        }
        return parent.element.getElements();
    }

    /**
     * Convert a parent's elements into `TreeElementNode` or `CompositeTreeElementNode`.
     *
     * If a node already exists in this tree, we'll mutate it rather than create a new updated one.
     */
    protected toNode(element: TreeElement, index: number, parent: TreeElementNodeParent): TreeElementNode | CompositeTreeElementNode {
        const id: string = element.id === undefined ? `${parent.id}:${index}` : String(element.id);
        // The base `TreeImpl` class expects to store simple `TreeNode` instances,
        // but we know for a fact that we handle `TreeElementNode` in this `SourceTree` class.
        // TODO: `Tree` should be generic and require something like `T extends TreeNode`?
        const existing = this.getNode(id) as TreeElementNode | CompositeTreeElementNode | undefined;
        if (existing) {
            existing.element = element;
            existing.parent = parent;
        }
        if (CompositeTreeElement.hasElements(element)) {
            if (existing) {
                if (!ExpandableTreeNode.is(existing)) {
                    (existing as Partial<ExpandableTreeNode>).expanded = false;
                }
                if (!CompositeTreeNode.is(existing)) {
                    (existing as Partial<CompositeTreeNode>).children = [];
                }
                return existing;
            }
            return {
                element,
                parent,
                id,
                name: id,
                selected: false,
                expanded: false,
                children: []
            };
        }
        if (existing) {
            if (ExpandableTreeNode.is(existing)) {
                delete (existing as Partial<ExpandableTreeNode>).expanded;
            }
            if (CompositeTreeNode.is(existing)) {
                delete (existing as Partial<CompositeTreeNode>).children;
            }
            return existing;
        }
        return {
            element,
            parent,
            id,
            name: id,
            selected: false,
        };
    }

}

export type TreeElementNodeParent = CompositeTreeElementNode | TreeSourceNode;

export interface TreeElementNode extends TreeNode, SelectableTreeNode {
    element: TreeElement
    parent: TreeElementNodeParent
}
export namespace TreeElementNode {
    export function is(node?: TreeNode): node is TreeElementNode {
        return SelectableTreeNode.is(node) && 'element' in node;
    }
}

export interface CompositeTreeElementNode extends TreeElementNode, CompositeTreeNode, ExpandableTreeNode {
    element: CompositeTreeElement
    children: TreeElementNode[]
    parent: TreeElementNodeParent
}
export namespace CompositeTreeElementNode {
    export function is(node?: TreeNode): node is CompositeTreeElementNode {
        return TreeElementNode.is(node) && CompositeTreeNode.is(node) && ExpandableTreeNode.is(node) && !!node.visible;
    }
}

export interface TreeSourceNode extends CompositeTreeNode, SelectableTreeNode {
    visible: false
    children: TreeElementNode[]
    parent: undefined
    source: TreeSource
}
export namespace TreeSourceNode {
    export function is(node?: TreeNode): node is TreeSourceNode {
        return CompositeTreeNode.is(node) && !node.visible && 'source' in node;
    }
    export function to(source: undefined): undefined;
    export function to(source: TreeSource): TreeSourceNode;
    export function to(source?: TreeSource): TreeSourceNode | undefined;
    export function to(source?: TreeSource): TreeSourceNode | undefined {
        if (!source) {
            return;
        }
        const id = source.id || '__source__';
        return {
            id,
            name: id,
            visible: false,
            children: [],
            source,
            parent: undefined,
            selected: false
        };
    }
}
