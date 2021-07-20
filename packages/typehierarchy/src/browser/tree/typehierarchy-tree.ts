/********************************************************************************
 * Copyright (C) 2019 TypeFox and others.
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

import { injectable } from '@theia/core/shared/inversify';
import { v4 } from 'uuid';
import URI from '@theia/core/lib/common/uri';
import { Location } from '@theia/editor/lib/browser/editor';
import { TreeDecoration, DecoratedTreeNode } from '@theia/core/lib/browser/tree/tree-decorator';
import { TreeImpl, TreeNode, CompositeTreeNode, ExpandableTreeNode, SelectableTreeNode } from '@theia/core/lib/browser/tree';
import { TypeHierarchyProvider, TypeHierarchyDirection, ResolveTypeHierarchyItemParams, TypeHierarchyItem } from '../typehierarchy-provider';

@injectable()
export class TypeHierarchyTree extends TreeImpl {

    provider: TypeHierarchyProvider | undefined;

    async resolveChildren(parent: CompositeTreeNode): Promise<TreeNode[]> {
        if (TypeHierarchyTree.Node.is(parent)) {
            await this.ensureResolved(parent);
            if (parent.children.length === 0) {
                delete (parent as Partial<TypeHierarchyTree.Node>).children;
                delete (parent as Partial<TypeHierarchyTree.Node>).expanded;
                return [];
            }
            return parent.children.slice();
        }
        return [];
    }

    /**
     * Returns with the direction of the type hierarchy attached to the root node. `undefined` if the root is not set.
     */
    protected get direction(): TypeHierarchyDirection | undefined {
        if (TypeHierarchyTree.RootNode.is(this.root)) {
            return this.root.direction;
        }
        return undefined;
    }

    /**
     * Makes sure, the node and its children are resolved. Resolves it on demand.
     */
    protected async ensureResolved(node: TypeHierarchyTree.Node): Promise<void> {
        if (!node.resolved) {
            const { provider, direction } = this;
            if (provider && direction !== undefined) {
                const { item } = node;
                const param: ResolveTypeHierarchyItemParams = {
                    item,
                    direction,
                    resolve: 1
                };
                const resolvedItem = await provider.resolve(param);
                if (resolvedItem) {
                    node.resolved = true;
                    const items = TypeHierarchyDirection.Children === direction ? resolvedItem.children : resolvedItem.parents;
                    if (items) {
                        node.children = items.map(child => TypeHierarchyTree.Node.create(child, direction, false));
                    } else {
                        node.children = [];
                    }
                }
            }
        }
    }

}

export namespace TypeHierarchyTree {

    export interface InitOptions {
        readonly direction: TypeHierarchyDirection;
        readonly location: Location | undefined;
        readonly languageId: string | undefined;
    }

    export interface RootNode extends Node {
        readonly direction: TypeHierarchyDirection;
    }

    export namespace RootNode {

        export function is(node: TreeNode | undefined): node is RootNode {
            if (Node.is(node) && 'direction' in node) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { direction } = (node as any);
                return direction === TypeHierarchyDirection.Children || direction === TypeHierarchyDirection.Parents;
            }
            return false;
        }

        export function create(item: TypeHierarchyItem, direction: TypeHierarchyDirection): RootNode {
            return {
                ...Node.create(item, direction, true),
                direction
            };
        }

    }

    export interface Node extends CompositeTreeNode, ExpandableTreeNode, SelectableTreeNode, DecoratedTreeNode {
        readonly item: TypeHierarchyItem;
        resolved: boolean;
    }

    export namespace Node {

        export function is(node: TreeNode | undefined): node is Node {
            if (!!node && 'resolved' in node && 'item' in node) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { resolved, item } = (node as any);
                return typeof resolved === 'boolean' && !!item;
            }
            return false;
        }

        export function create(item: TypeHierarchyItem, direction: TypeHierarchyDirection, resolved: boolean = true): Node {
            const items = TypeHierarchyDirection.Children === direction ? item.children : item.parents;
            if (items && items.length > 0) {
                // If the server sent more levels than requested, use them.
                resolved = true;
            }
            const node = {
                id: v4(),
                name: item.name,
                description: item.detail,
                parent: undefined,
                location: Location.create(item.uri, item.selectionRange),
                resolved,
                children: items ? items.map(child => create(child, direction, false)) : [],
                expanded: false,
                visible: true,
                selected: false,
                kind: item.kind,
                decorationData: decorationData(item, direction),
                item
            };
            // Trick: if the node is `resolved` and have zero `children`, make the node non-expandable.
            if (resolved && node.children.length === 0) {
                delete (node as Partial<typeof node>).expanded;
            }
            return node;
        }

        function decorationData(item: TypeHierarchyItem, direction: TypeHierarchyDirection): TreeDecoration.Data {
            const captionSuffixes: TreeDecoration.CaptionAffix[] = [{
                data: new URI(item.uri).displayName,
                fontData: {
                    color: 'var(--theia-descriptionForeground)',
                }
            }];
            if (item.detail) {
                captionSuffixes.unshift({
                    data: item.detail,
                    fontData: {
                        color: 'var(--theia-list-highlightForeground)',
                        style: 'italic'
                    }
                });
            }
            const data = `${TypeHierarchyDirection.Children === direction ? '▼' : '▲'}`;
            const color = `var(${TypeHierarchyDirection.Children === direction ? '--theia-errorForeground' : '--theia-successBackground'})`;
            return {
                captionSuffixes,
                captionPrefixes: [{
                    data,
                    fontData: {
                        color,
                        style: 'bold'
                    }
                }]
            };
        }

    }

}
