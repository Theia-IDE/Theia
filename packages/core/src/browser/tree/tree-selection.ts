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

import { TreeNode } from './tree';
import { Event, Disposable, SelectionProvider } from '../../common';

/**
 * The tree selection service.
 */
export const TreeSelectionService = Symbol('TreeSelectionService');
export interface TreeSelectionService extends Disposable, SelectionProvider<ReadonlyArray<Readonly<SelectableTreeNode>>> {

    /**
     * The tree selection, representing the selected nodes from the tree. If nothing is selected, the
     * result will be empty.
     */
    readonly selectedNodes: ReadonlyArray<Readonly<SelectableTreeNode>>;

    /**
     * Emitted when the selection has changed in the tree.
     */
    readonly onSelectionChanged: Event<ReadonlyArray<Readonly<SelectableTreeNode>>>;

    /**
     * Registers the given selection into the tree selection service. If the selection state changes after adding the
     * `selectionOrTreeNode` argument, a selection changed event will be fired. If the argument is a tree node,
     * a it will be treated as a tree selection with the default selection type.
     */
    addSelection(selectionOrTreeNode: TreeSelection | Readonly<SelectableTreeNode>): void;

    /**
     * Store selection state.
     */
    storeState(): object;

    /**
     * Restore selection state.
     */
    restoreState(state: object): void;

}

/**
 * Representation of a tree selection.
 */
export interface TreeSelection {

    /**
     * The actual item that has been selected.
     */
    readonly node: Readonly<SelectableTreeNode>;

    /**
     * The optional tree selection type. Defaults to `SelectionType.DEFAULT`;
     */
    readonly type?: TreeSelection.SelectionType;

}

export namespace TreeSelection {

    /**
     * Enumeration of selection types.
     */
    export enum SelectionType {
        DEFAULT,
        TOGGLE,
        RANGE
    }

    export function is(arg: Object | undefined): arg is TreeSelection {
        return !!arg && 'node' in arg;
    }

    export function isRange(arg: TreeSelection | SelectionType | undefined): boolean {
        return isSelectionTypeOf(arg, SelectionType.RANGE);
    }

    export function isToggle(arg: TreeSelection | SelectionType | undefined): boolean {
        return isSelectionTypeOf(arg, SelectionType.TOGGLE);
    }

    function isSelectionTypeOf(arg: TreeSelection | SelectionType | undefined, expected: SelectionType): boolean {
        if (arg === undefined) {
            return false;
        }
        const type = typeof arg === 'number' ? arg : arg.type;
        return type === expected;
    }

}

/**
 * A selectable tree node.
 */
export interface SelectableTreeNode extends TreeNode {

    /**
     * `true` if the tree node is selected. Otherwise, `false`.
     */
    selected: boolean;

    /**
     * `true` if the tree node has the focus. Otherwise, `false`. Defaults to `false`.
     */
    focus?: boolean;

}

export namespace SelectableTreeNode {

    export function is(node?: TreeNode): node is SelectableTreeNode {
        // eslint-disable-next-line no-null/no-null
        return typeof node === 'object' && node !== null && 'selected' in node;
    }

    export function isSelected(node?: TreeNode): node is SelectableTreeNode {
        return is(node) && node.selected;
    }

    export function hasFocus(node?: TreeNode): boolean {
        return is(node) && node.focus === true;
    }

    export function isVisible(node?: TreeNode): node is SelectableTreeNode {
        return is(node) && TreeNode.isVisible(node);
    }

    export function getVisibleParent(node?: TreeNode): SelectableTreeNode | undefined {
        if (node) {
            if (isVisible(node.parent)) {
                return node.parent;
            }
            return getVisibleParent(node.parent);
        }
    }
}
