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

import { inject, injectable, postConstruct } from 'inversify';
import { Event, Emitter, WaitUntilEvent } from '../../common/event';
import { DisposableCollection } from '../../common/disposable';
import { CancellationToken } from '../../common/cancellation';
import { ILogger } from '../../common/logger';
import { SelectionProvider, } from '../../common/selection-service';
import { Tree, TreeNode, CompositeTreeNode } from './tree';
import { TreeSelectionService, SelectableTreeNode, TreeSelection } from './tree-selection';
import { TreeExpansionService, ExpandableTreeNode } from './tree-expansion';
import { TreeNavigationService } from './tree-navigation';
import { TreeIterator, BottomUpTreeIterator, TopDownTreeIterator, Iterators } from './tree-iterator';
import { TreeSearch } from './tree-search';

/**
 * The tree model.
 */
export const TreeModel = Symbol('TreeModel');
export interface TreeModel extends Tree, TreeSelectionService, TreeExpansionService {

    /**
     * Expands the given node. If the `node` argument is `undefined`, then expands the currently selected tree node.
     * If multiple tree nodes are selected, expands the most recently selected tree node.
     */
    expandNode(node?: Readonly<ExpandableTreeNode>): Promise<Readonly<ExpandableTreeNode> | undefined>;

    /**
     * Collapses the given node. If the `node` argument is `undefined`, then collapses the currently selected tree node.
     * If multiple tree nodes are selected, collapses the most recently selected tree node.
     */
    collapseNode(node?: Readonly<ExpandableTreeNode>): Promise<boolean>;

    /**
     * Collapses recursively. If the `node` argument is `undefined`, then collapses the currently selected tree node.
     * If multiple tree nodes are selected, collapses the most recently selected tree node.
     */
    collapseAll(node?: Readonly<CompositeTreeNode>): Promise<boolean>;

    /**
     * Toggles the expansion state of the given node. If not give, then it toggles the expansion state of the currently selected node.
     * If multiple nodes are selected, then the most recently selected tree node's expansion state will be toggled.
     */
    toggleNodeExpansion(node?: Readonly<ExpandableTreeNode>): Promise<void>;

    /**
     * Opens the given node or the currently selected on if the argument is `undefined`.
     * If multiple nodes are selected, open the most recently selected node.
     */
    openNode(node?: Readonly<TreeNode> | undefined): void;

    /**
     * Event when a node should be opened.
     */
    readonly onOpenNode: Event<Readonly<TreeNode>>;

    /**
     * Event when a node's sroll alignment shoud be requested.
     */
    readonly onScrollToNodeRequested: Event<scrollAlignment>;

    /**
     * Selects the parent node relatively to the selected taking into account node expansion.
     */
    selectParent(): void;

    /**
     * Navigates to the given node if it is defined. This method accepts both the tree node and its ID as an argument.
     * Navigation sets a node as a root node and expand it. Resolves to the node if the navigation was successful. Otherwise,
     * resolves to `undefined`.
     */
    navigateTo(nodeOrId: Readonly<TreeNode> | string | undefined): Promise<TreeNode | undefined>;
    /**
     * Tests whether it is possible to navigate forward.
     */
    canNavigateForward(): boolean;

    /**
     * Tests whether it is possible to navigate backward.
     */
    canNavigateBackward(): boolean;

    /**
     * Navigates forward.
     */
    navigateForward(): Promise<void>;
    /**
     * Navigates backward.
     */
    navigateBackward(): Promise<void>;

    /**
     * Selects the previous node relatively to the currently selected one. This method takes the expansion state of the tree into consideration.
     */
    selectPrevNode(type?: TreeSelection.SelectionType): void;

    /**
     * Returns the previous selectable tree node.
     */
    getPrevSelectableNode(node?: TreeNode): SelectableTreeNode | undefined;

    /**
     * Selects the next node relatively to the currently selected one. This method takes the expansion state of the tree into consideration.
     */
    selectNextNode(type?: TreeSelection.SelectionType): void;

    /**
     * Returns the next selectable tree node.
     */
    getNextSelectableNode(node?: TreeNode): SelectableTreeNode | undefined;

    /**
     * Selects the given tree node. Has no effect when the node does not exist in the tree. Discards any previous selection state.
     */
    selectNode(node: Readonly<SelectableTreeNode>): void;

    /**
     * Selects the given node if it was not yet selected, or unselects it if it was. Keeps the previous selection state and updates it
     * with the current toggle selection.
     */
    toggleNode(node: Readonly<SelectableTreeNode>): void;

    /**
     * Selects a range of tree nodes. The target of the selection range is the argument, the from tree node is the previous selected node.
     * If no node was selected previously, invoking this method does nothing.
     */
    selectRange(node: Readonly<SelectableTreeNode>): void;
}

@injectable()
export class TreeModelImpl implements TreeModel, SelectionProvider<ReadonlyArray<Readonly<SelectableTreeNode>>> {

    @inject(ILogger) protected readonly logger: ILogger;
    @inject(Tree) protected readonly tree: Tree;
    @inject(TreeSelectionService) protected readonly selectionService: TreeSelectionService;
    @inject(TreeExpansionService) protected readonly expansionService: TreeExpansionService;
    @inject(TreeNavigationService) protected readonly navigationService: TreeNavigationService;
    @inject(TreeSearch) protected readonly treeSearch: TreeSearch;

    protected readonly onChangedEmitter = new Emitter<void>();
    protected readonly onOpenNodeEmitter = new Emitter<TreeNode>();
    protected readonly onScrollToNodeRequestEmitter = new Emitter<scrollAlignment>();
    protected readonly toDispose = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        this.toDispose.push(this.tree);
        this.toDispose.push(this.tree.onChanged(() => this.fireChanged()));

        this.toDispose.push(this.selectionService);

        this.toDispose.push(this.expansionService);
        this.toDispose.push(this.expansionService.onExpansionChanged(node => {
            this.fireChanged();
            this.handleExpansion(node);
        }));

        this.toDispose.push(this.onOpenNodeEmitter);
        this.toDispose.push(this.onChangedEmitter);
        this.toDispose.push(this.treeSearch);
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    protected handleExpansion(node: Readonly<ExpandableTreeNode>): void {
        this.selectIfAncestorOfSelected(node);
    }

    /**
     * Select the given node if it is the ancestor of a selected node.
     */
    protected selectIfAncestorOfSelected(node: Readonly<ExpandableTreeNode>): void {
        if (!node.expanded && [...this.selectedNodes].some(selectedNode => CompositeTreeNode.isAncestor(node, selectedNode))) {
            if (SelectableTreeNode.isVisible(node)) {
                this.selectNode(node);
            }
        }
    }

    get root(): TreeNode | undefined {
        return this.tree.root;
    }

    set root(root: TreeNode | undefined) {
        this.tree.root = root;
    }

    get onChanged(): Event<void> {
        return this.onChangedEmitter.event;
    }

    get onOpenNode(): Event<TreeNode> {
        return this.onOpenNodeEmitter.event;
    }

    get onScrollToNodeRequested(): Event<scrollAlignment> {
        return this.onScrollToNodeRequestEmitter.event;
    }

    protected fireChanged(): void {
        this.onChangedEmitter.fire(undefined);
    }

    get onNodeRefreshed(): Event<Readonly<CompositeTreeNode> & WaitUntilEvent> {
        return this.tree.onNodeRefreshed;
    }

    getNode(id: string | undefined): TreeNode | undefined {
        return this.tree.getNode(id);
    }

    validateNode(node: TreeNode | undefined): TreeNode | undefined {
        return this.tree.validateNode(node);
    }

    async refresh(parent?: Readonly<CompositeTreeNode>): Promise<CompositeTreeNode | undefined> {
        if (parent) {
            return this.tree.refresh(parent);
        }
        return this.tree.refresh();
    }

    // tslint:disable-next-line:typedef
    get selectedNodes() {
        return this.selectionService.selectedNodes;
    }

    // tslint:disable-next-line:typedef
    get onSelectionChanged() {
        return this.selectionService.onSelectionChanged;
    }

    get onExpansionChanged(): Event<Readonly<ExpandableTreeNode>> {
        return this.expansionService.onExpansionChanged;
    }

    async expandNode(raw?: Readonly<ExpandableTreeNode>): Promise<ExpandableTreeNode | undefined> {
        for (const node of raw ? [raw] : this.selectedNodes) {
            if (ExpandableTreeNode.is(node)) {
                return this.expansionService.expandNode(node);
            }
        }
        return undefined;
    }

    async collapseNode(raw?: Readonly<ExpandableTreeNode>): Promise<boolean> {
        for (const node of raw ? [raw] : this.selectedNodes) {
            if (ExpandableTreeNode.is(node)) {
                return this.expansionService.collapseNode(node);
            }
        }
        return false;
    }

    async collapseAll(raw?: Readonly<CompositeTreeNode>): Promise<boolean> {
        const node = raw || this.selectedNodes[0];
        if (SelectableTreeNode.is(node)) {
            this.selectNode(node);
        }
        if (CompositeTreeNode.is(node)) {
            return this.expansionService.collapseAll(node);
        }
        return false;
    }

    async toggleNodeExpansion(raw?: Readonly<ExpandableTreeNode>): Promise<void> {
        for (const node of raw ? [raw] : this.selectedNodes) {
            if (ExpandableTreeNode.is(node)) {
                await this.expansionService.toggleNodeExpansion(node);
                return;
            }
        }
    }

    selectPrevNode(type: TreeSelection.SelectionType = TreeSelection.SelectionType.DEFAULT): void {
        const node = this.getPrevSelectableNode();
        if (node) {
            this.addSelection({ node, type });
        }
    }

    getPrevSelectableNode(node: TreeNode = this.selectedNodes[0]): SelectableTreeNode | undefined {
        const iterator = this.createBackwardIterator(node);
        return iterator && this.doGetNextNode(iterator);
    }

    selectNextNode(type: TreeSelection.SelectionType = TreeSelection.SelectionType.DEFAULT): void {
        const node = this.getNextSelectableNode();
        if (node) {
            this.addSelection({ node, type });
        }
    }

    getNextSelectableNode(node: TreeNode = this.selectedNodes[0]): SelectableTreeNode | undefined {
        const iterator = this.createIterator(node);
        return iterator && this.doGetNextNode(iterator);
    }

    protected doGetNextNode(iterator: TreeIterator): SelectableTreeNode | undefined {
        // Skip the first item. // TODO: clean this up, and skip the first item in a different way without loading everything.
        iterator.next();
        let result = iterator.next();
        while (!result.done && !SelectableTreeNode.isVisible(result.value)) {
            result = iterator.next();
        }
        const node = result.value;
        if (SelectableTreeNode.isVisible(node)) {
            return node;
        }
        return undefined;
    }

    protected createBackwardIterator(node: TreeNode | undefined): TreeIterator | undefined {
        const { filteredNodes } = this.treeSearch;
        if (filteredNodes.length === 0) {
            return node ? new BottomUpTreeIterator(node!, { pruneCollapsed: true }) : undefined;
        }
        if (node && filteredNodes.indexOf(node) === -1) {
            return undefined;
        }
        return Iterators.cycle(filteredNodes.slice().reverse(), node);
    }

    protected createIterator(node: TreeNode | undefined): TreeIterator | undefined {
        const { filteredNodes } = this.treeSearch;
        if (filteredNodes.length === 0) {
            return node ? new TopDownTreeIterator(node!, { pruneCollapsed: true }) : undefined;
        }
        if (node && filteredNodes.indexOf(node) === -1) {
            return undefined;
        }
        return Iterators.cycle(filteredNodes, node);
    }

    openNode(raw?: TreeNode | undefined): void {
        const node = raw || this.selectedNodes[0];
        if (node) {
            this.doOpenNode(node);
            this.onOpenNodeEmitter.fire(node);
        }
    }

    protected doOpenNode(node: TreeNode): void {
        if (ExpandableTreeNode.is(node)) {
            this.toggleNodeExpansion(node);
        }
    }

    selectParent(): void {
        if (this.selectedNodes.length === 1) {
            const node = this.selectedNodes[0];
            const parent = SelectableTreeNode.getVisibleParent(node);
            if (parent) {
                this.selectNode(parent);
            }
        }
    }

    async navigateTo(nodeOrId: TreeNode | string | undefined): Promise<TreeNode | undefined> {
        if (nodeOrId) {
            const node = typeof nodeOrId === 'string' ? this.getNode(nodeOrId) : nodeOrId;
            if (node) {
                this.navigationService.push(node);
                await this.doNavigate(node);
                return node;
            }
        }
        return undefined;
    }

    canNavigateForward(): boolean {
        return !!this.navigationService.next;
    }

    canNavigateBackward(): boolean {
        return !!this.navigationService.prev;
    }

    async navigateForward(): Promise<void> {
        const node = this.navigationService.advance();
        if (node) {
            await this.doNavigate(node);
        }
    }

    async navigateBackward(): Promise<void> {
        const node = this.navigationService.retreat();
        if (node) {
            await this.doNavigate(node);
        }
    }

    protected async doNavigate(node: TreeNode): Promise<void> {
        this.tree.root = node;
        if (ExpandableTreeNode.is(node)) {
            await this.expandNode(node);
        }
        if (SelectableTreeNode.is(node)) {
            this.selectNode(node);
        }
    }

    addSelection(selectionOrTreeNode: TreeSelection | Readonly<SelectableTreeNode>): void {
        this.selectionService.addSelection(selectionOrTreeNode);
    }

    selectNode(node: Readonly<SelectableTreeNode>, selectedByNavigator?: boolean): void {
        this.onScrollToNodeRequestEmitter.fire(selectedByNavigator ? 'center' : 'auto');
        this.addSelection(node);
    }

    toggleNode(node: Readonly<SelectableTreeNode>): void {
        this.addSelection({ node, type: TreeSelection.SelectionType.TOGGLE });
    }

    selectRange(node: Readonly<SelectableTreeNode>): void {
        this.addSelection({ node, type: TreeSelection.SelectionType.RANGE });
    }

    storeState(): TreeModelImpl.State {
        return {
            selection: this.selectionService.storeState()
        };
    }

    restoreState(state: TreeModelImpl.State): void {
        if (state.selection) {
            this.selectionService.restoreState(state.selection);
        }
    }

    get onDidChangeBusy(): Event<TreeNode> {
        return this.tree.onDidChangeBusy;
    }

    markAsBusy(node: Readonly<TreeNode>, ms: number, token: CancellationToken): Promise<void> {
        return this.tree.markAsBusy(node, ms, token);
    }

}
export type scrollAlignment = 'auto' | 'end' | 'start' | 'center' | undefined;
export namespace TreeModelImpl {
    export interface State {
        selection: object
    }
}
