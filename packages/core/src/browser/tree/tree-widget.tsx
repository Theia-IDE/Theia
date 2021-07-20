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

import { injectable, inject, postConstruct } from 'inversify';
import { Message } from '@phosphor/messaging';
import { Disposable, MenuPath, SelectionService } from '../../common';
import { Key, KeyCode, KeyModifier } from '../keyboard/keys';
import { ContextMenuRenderer } from '../context-menu-renderer';
import { StatefulWidget } from '../shell';
import { EXPANSION_TOGGLE_CLASS, SELECTED_CLASS, COLLAPSED_CLASS, FOCUS_CLASS, Widget, BUSY_CLASS } from '../widgets';
import { TreeNode, CompositeTreeNode } from './tree';
import { TreeModel } from './tree-model';
import { ExpandableTreeNode } from './tree-expansion';
import { SelectableTreeNode, TreeSelection } from './tree-selection';
import { TreeDecoratorService, TreeDecoration, DecoratedTreeNode } from './tree-decorator';
import { notEmpty } from '../../common/objects';
import { isOSX } from '../../common/os';
import { ReactWidget } from '../widgets/react-widget';
import * as React from 'react';
import { List, ListRowRenderer, ScrollParams, CellMeasurer, CellMeasurerCache } from 'react-virtualized';
import { TopDownTreeIterator } from './tree-iterator';
import { SearchBox, SearchBoxFactory, SearchBoxProps } from './search-box';
import { TreeSearch } from './tree-search';
import { ElementExt } from '@phosphor/domutils';
import { TreeWidgetSelection } from './tree-widget-selection';
import { MaybePromise } from '../../common/types';
import { LabelProvider } from '../label-provider';
import { CorePreferences } from '../core-preferences';

const debounce = require('lodash.debounce');

export const TREE_CLASS = 'theia-Tree';
export const TREE_CONTAINER_CLASS = 'theia-TreeContainer';
export const TREE_NODE_CLASS = 'theia-TreeNode';
export const TREE_NODE_CONTENT_CLASS = 'theia-TreeNodeContent';
export const TREE_NODE_TAIL_CLASS = 'theia-TreeNodeTail';
export const TREE_NODE_SEGMENT_CLASS = 'theia-TreeNodeSegment';
export const TREE_NODE_SEGMENT_GROW_CLASS = 'theia-TreeNodeSegmentGrow';

export const EXPANDABLE_TREE_NODE_CLASS = 'theia-ExpandableTreeNode';
export const COMPOSITE_TREE_NODE_CLASS = 'theia-CompositeTreeNode';
export const TREE_NODE_CAPTION_CLASS = 'theia-TreeNodeCaption';
export const TREE_NODE_INDENT_GUIDE_CLASS = 'theia-tree-node-indent';

export const TreeProps = Symbol('TreeProps');

/**
 * Representation of tree properties.
 */
export interface TreeProps {

    /**
     * The path of the context menu that one can use to contribute context menu items to the tree widget.
     */
    readonly contextMenuPath?: MenuPath;

    /**
     * The size of the padding (in pixels) per hierarchy depth. The root element won't have left padding but
     * the padding for the children will be calculated as `leftPadding * hierarchyDepth` and so on.
     */
    readonly leftPadding: number;

    readonly expansionTogglePadding: number;

    /**
     * `true` if the tree widget support multi-selection. Otherwise, `false`. Defaults to `false`.
     */
    readonly multiSelect?: boolean;

    /**
     * `true` if the tree widget support searching. Otherwise, `false`. Defaults to `false`.
     */
    readonly search?: boolean

    /**
     * `true` if the tree widget should be virtualized searching. Otherwise, `false`. Defaults to `true`.
     */
    readonly virtualized?: boolean

    /**
     * `true` if the selected node should be auto scrolled only if the widget is active. Otherwise, `false`. Defaults to `false`.
     */
    readonly scrollIfActive?: boolean

    /**
     * `true` if a tree widget contributes to the global selection. Defaults to `false`.
     */
    readonly globalSelection?: boolean;

    /**
     *  `true` if the tree widget supports expansion only when clicking the expansion toggle. Defaults to `false`.
     */
    readonly expandOnlyOnExpansionToggleClick?: boolean;

}

/**
 * Representation of node properties.
 */
export interface NodeProps {

    /**
     * A root relative number representing the hierarchical depth of the actual node. Root is `0`, its children have `1` and so on.
     */
    readonly depth: number;

}

/**
 * The default tree properties.
 */
export const defaultTreeProps: TreeProps = {
    leftPadding: 8,
    expansionTogglePadding: 18
};

export namespace TreeWidget {

    /**
     * Bare minimum common interface of the keyboard and the mouse event with respect to the key maskings.
     */
    export interface ModifierAwareEvent {
        /**
         * Determines if the modifier aware event has the `meta` key masking.
         */
        readonly metaKey: boolean;
        /**
         * Determines if the modifier aware event has the `ctrl` key masking.
         */
        readonly ctrlKey: boolean;
        /**
         * Determines if the modifier aware event has the `shift` key masking.
         */
        readonly shiftKey: boolean;
    }

}

@injectable()
export class TreeWidget extends ReactWidget implements StatefulWidget {

    protected searchBox: SearchBox;
    protected searchHighlights: Map<string, TreeDecoration.CaptionHighlight>;

    @inject(TreeDecoratorService)
    protected readonly decoratorService: TreeDecoratorService;
    @inject(TreeSearch)
    protected readonly treeSearch: TreeSearch;
    @inject(SearchBoxFactory)
    protected readonly searchBoxFactory: SearchBoxFactory;

    protected decorations: Map<string, TreeDecoration.Data[]> = new Map();

    @inject(SelectionService)
    protected readonly selectionService: SelectionService;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(CorePreferences)
    protected readonly corePreferences: CorePreferences;

    protected shouldScrollToRow = true;

    constructor(
        @inject(TreeProps) readonly props: TreeProps,
        @inject(TreeModel) readonly model: TreeModel,
        @inject(ContextMenuRenderer) protected readonly contextMenuRenderer: ContextMenuRenderer,
    ) {
        super();
        this.scrollOptions = {
            suppressScrollX: true,
            minScrollbarLength: 35
        };
        this.addClass(TREE_CLASS);
        this.node.tabIndex = 0;
    }

    @postConstruct()
    protected init(): void {
        if (this.props.search) {
            this.searchBox = this.searchBoxFactory({ ...SearchBoxProps.DEFAULT, showButtons: true, showFilter: true });
            this.searchBox.node.addEventListener('focus', () => {
                this.node.focus();
            });
            this.toDispose.pushAll([
                this.searchBox,
                this.searchBox.onTextChange(async data => {
                    await this.treeSearch.filter(data);
                    this.searchHighlights = this.treeSearch.getHighlights();
                    this.searchBox.updateHighlightInfo({
                        filterText: data,
                        total: this.rows.size,
                        matched: this.searchHighlights.size
                    });
                    this.update();
                }),
                this.searchBox.onClose(data => this.treeSearch.filter(undefined)),
                this.searchBox.onNext(() => {
                    // Enable next selection if there are currently highlights.
                    if (this.searchHighlights.size > 1) {
                        this.model.selectNextNode();
                    }
                }),
                this.searchBox.onPrevious(() => {
                    // Enable previous selection if there are currently highlights.
                    if (this.searchHighlights.size > 1) {
                        this.model.selectPrevNode();
                    }
                }),
                this.searchBox.onFilterToggled(e => {
                    this.updateRows();
                }),
                this.treeSearch,
                this.treeSearch.onFilteredNodesChanged(nodes => {
                    if (this.searchBox.isFiltering) {
                        this.updateRows();
                    }
                    const node = nodes.find(SelectableTreeNode.is);
                    if (node) {
                        this.model.selectNode(node);
                    }
                }),
            ]);
        }
        this.toDispose.pushAll([
            this.model,
            this.model.onChanged(() => this.updateRows()),
            this.model.onSelectionChanged(() => this.updateScrollToRow({ resize: false })),
            this.model.onDidChangeBusy(() => this.update()),
            this.model.onNodeRefreshed(() => this.updateDecorations()),
            this.model.onExpansionChanged(() => this.updateDecorations()),
            this.decoratorService,
            this.decoratorService.onDidChangeDecorations(() => this.updateDecorations()),
            this.labelProvider.onDidChange(e => {
                for (const row of this.rows.values()) {
                    if (e.affects(row)) {
                        this.forceUpdate();
                        return;
                    }
                }
            })
        ]);
        setTimeout(() => {
            this.updateRows();
            this.updateDecorations();
        });
        if (this.props.globalSelection) {
            this.toDispose.pushAll([
                this.model.onSelectionChanged(() => {
                    if (this.node.contains(document.activeElement)) {
                        this.updateGlobalSelection();
                    }
                }),
                Disposable.create(() => {
                    const selection = this.selectionService.selection;
                    if (TreeWidgetSelection.isSource(selection, this)) {
                        this.selectionService.selection = undefined;
                    }
                })
            ]);
        }
        this.toDispose.push(this.corePreferences.onPreferenceChanged(preference => {
            if (preference.preferenceName === 'workbench.tree.renderIndentGuides') {
                this.update();
            }
        }));
    }

    /**
     * Update the global selection for the tree.
     */
    protected updateGlobalSelection(): void {
        this.selectionService.selection = TreeWidgetSelection.create(this);
    }

    protected rows = new Map<string, TreeWidget.NodeRow>();
    protected updateRows = debounce(() => this.doUpdateRows(), 10);
    protected doUpdateRows(): void {
        const root = this.model.root;
        const rowsToUpdate: Array<[string, TreeWidget.NodeRow]> = [];
        if (root) {
            const depths = new Map<CompositeTreeNode | undefined, number>();
            let index = 0;
            for (const node of new TopDownTreeIterator(root, {
                pruneCollapsed: true,
                pruneSiblings: true
            })) {
                if (this.shouldDisplayNode(node)) {
                    const parentDepth = depths.get(node.parent);
                    const depth = parentDepth === undefined ? 0 : TreeNode.isVisible(node.parent) ? parentDepth + 1 : parentDepth;
                    if (CompositeTreeNode.is(node)) {
                        depths.set(node, depth);
                    }
                    rowsToUpdate.push([node.id, {
                        index: index++,
                        node,
                        depth
                    }]);
                }
            }
        }
        this.rows = new Map(rowsToUpdate);
        this.updateScrollToRow();
    }

    protected shouldDisplayNode(node: TreeNode): boolean {
        return TreeNode.isVisible(node) && (!this.searchBox?.isFiltering || this.treeSearch.passesFilters(node));
    }

    /**
     * Row index to ensure visibility.
     * - Used to forcefully scroll if necessary.
     */
    protected scrollToRow: number | undefined;
    /**
     * Update the `scrollToRow`.
     * @param updateOptions the tree widget force update options.
     */
    protected updateScrollToRow(updateOptions?: TreeWidget.ForceUpdateOptions): void {
        this.scrollToRow = this.getScrollToRow();
        this.forceUpdate(updateOptions);
    }

    /**
     * Get the `scrollToRow`.
     *
     * @returns the `scrollToRow` if available.
     */
    protected getScrollToRow(): number | undefined {
        if (!this.shouldScrollToRow) {
            return undefined;
        }
        const selected = this.model.selectedNodes;
        const node: TreeNode | undefined = selected.find(SelectableTreeNode.hasFocus) || selected[0];
        const row = node && this.rows.get(node.id);
        return row && row.index;
    }

    /**
     * Update tree decorations.
     * - Updating decorations are debounced in order to limit the number of expensive updates.
     */
    protected readonly updateDecorations = debounce(() => this.doUpdateDecorations(), 150);
    protected async doUpdateDecorations(): Promise<void> {
        this.decorations = await this.decoratorService.getDecorations(this.model);
        this.forceUpdate();
    }

    /**
     * Force deep resizing and rendering of rows.
     * https://github.com/bvaughn/react-virtualized/blob/master/docs/List.md#recomputerowheights-index-number
     */
    protected forceUpdate({ resize }: TreeWidget.ForceUpdateOptions = { resize: false }): void {
        if (this.view && this.view.list) {
            if (resize && this.isVisible) {
                this.view.cache.clearAll();
                this.view.list.recomputeRowHeights();
            } else {
                this.view.list.forceUpdateGrid();
            }
        }
        this.update();
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.node.focus({ preventScroll: true });
    }

    /**
     * Actually focus the tree node.
     */
    protected doFocus(): void {
        if (!this.model.selectedNodes.length) {
            const node = this.getNodeToFocus();
            if (SelectableTreeNode.is(node)) {
                this.model.selectNode(node);
            }
        }
        // It has to be called after nodes are selected.
        if (this.props.globalSelection) {
            this.updateGlobalSelection();
        }
        this.forceUpdate();
    }

    /**
     * Get the tree node to focus.
     *
     * @returns the node to focus if available.
     */
    protected getNodeToFocus(): SelectableTreeNode | undefined {
        const root = this.model.root;
        if (SelectableTreeNode.isVisible(root)) {
            return root;
        }
        return this.model.getNextSelectableNode(root);
    }

    protected onUpdateRequest(msg: Message): void {
        if (!this.isAttached || !this.isVisible) {
            return;
        }
        super.onUpdateRequest(msg);
    }

    protected onResize(msg: Widget.ResizeMessage): void {
        super.onResize(msg);
        this.forceUpdate({ resize: true });
    }

    protected render(): React.ReactNode {
        return React.createElement('div', this.createContainerAttributes(), this.renderTree(this.model));
    }

    /**
     * Create the container attributes for the widget.
     */
    protected createContainerAttributes(): React.HTMLAttributes<HTMLElement> {
        const classNames = [TREE_CONTAINER_CLASS];
        if (!this.rows.size) {
            classNames.push('empty');
        }
        return {
            className: classNames.join(' '),
            onContextMenu: event => this.handleContextMenuEvent(this.getContainerTreeNode(), event)
        };
    }
    /**
     * Get the container tree node.
     *
     * @returns the tree node for the container if available.
     */
    protected getContainerTreeNode(): TreeNode | undefined {
        return this.model.root;
    }

    protected view: TreeWidget.View | undefined;
    /**
     * Render the tree widget.
     * @param model the tree model.
     */
    protected renderTree(model: TreeModel): React.ReactNode {
        if (model.root) {
            const rows = Array.from(this.rows.values());
            if (this.props.virtualized === false) {
                this.onRender.push(Disposable.create(() => this.scrollToSelected()));
                return rows.map(row => <div key={row.index}>{this.renderNodeRow(row)}</div>);
            }
            return <TreeWidget.View
                ref={view => this.view = (view || undefined)}
                width={this.node.offsetWidth}
                height={this.node.offsetHeight}
                rows={rows}
                renderNodeRow={this.renderNodeRow}
                scrollToRow={this.scrollToRow}
                handleScroll={this.handleScroll}
            />;
        }
        // eslint-disable-next-line no-null/no-null
        return null;
    }

    scrollArea: Element = this.node;
    /**
     * Scroll to the selected tree node.
     */
    protected scrollToSelected(): void {
        if (this.props.scrollIfActive === true && !this.node.contains(document.activeElement)) {
            return;
        }
        const focus = this.node.getElementsByClassName(FOCUS_CLASS)[0];
        if (focus) {
            ElementExt.scrollIntoViewIfNeeded(this.scrollArea, focus);
        } else {
            const selected = this.node.getElementsByClassName(SELECTED_CLASS)[0];
            if (selected) {
                ElementExt.scrollIntoViewIfNeeded(this.scrollArea, selected);
            }
        }
    }

    /**
     * Handle the scroll event.
     */
    protected readonly handleScroll = (info: ScrollParams) => {
        this.node.scrollTop = info.scrollTop;
    };

    /**
     * Render the node row.
     */
    protected readonly renderNodeRow = (row: TreeWidget.NodeRow) => this.doRenderNodeRow(row);
    /**
     * Actually render the node row.
     */
    protected doRenderNodeRow({ index, node, depth }: TreeWidget.NodeRow): React.ReactNode {
        return <React.Fragment>
            {this.renderIndent(node, { depth })}
            {this.renderNode(node, { depth })}
        </React.Fragment>;
    }

    /**
     * Render the tree node given the node properties.
     * @param node the tree node.
     * @param props the node properties.
     */
    protected renderIcon(node: TreeNode, props: NodeProps): React.ReactNode {
        // eslint-disable-next-line no-null/no-null
        return null;
    }

    /**
     * Toggle the node.
     */
    protected readonly toggle = (event: React.MouseEvent<HTMLElement>) => this.doToggle(event);
    /**
     * Actually toggle the tree node.
     * @param event the mouse click event.
     */
    protected doToggle(event: React.MouseEvent<HTMLElement>): void {
        const nodeId = event.currentTarget.getAttribute('data-node-id');
        if (nodeId) {
            const node = this.model.getNode(nodeId);
            if (node && this.props.expandOnlyOnExpansionToggleClick) {
                if (this.isExpandable(node) && !this.hasShiftMask(event) && !this.hasCtrlCmdMask(event)) {
                    this.model.toggleNodeExpansion(node);
                }
            } else {
                this.handleClickEvent(node, event);
            }
        }
        event.stopPropagation();
    }

    /**
     * Render the node expansion toggle.
     * @param node the tree node.
     * @param props the node properties.
     */
    protected renderExpansionToggle(node: TreeNode, props: NodeProps): React.ReactNode {
        if (!this.isExpandable(node)) {
            // eslint-disable-next-line no-null/no-null
            return null;
        }
        const classes = [TREE_NODE_SEGMENT_CLASS, EXPANSION_TOGGLE_CLASS];
        if (!node.expanded) {
            classes.push(COLLAPSED_CLASS);
        }
        if (node.busy) {
            classes.push(BUSY_CLASS);
        }
        const className = classes.join(' ');
        return <div
            data-node-id={node.id}
            className={className}
            onClick={this.toggle}
            onDoubleClick={this.handleExpansionToggleDblClickEvent}>
        </div>;
    }

    /**
     * Render the tree node caption given the node properties.
     * @param node the tree node.
     * @param props the node properties.
     */
    protected renderCaption(node: TreeNode, props: NodeProps): React.ReactNode {
        const tooltip = this.getDecorationData(node, 'tooltip').filter(notEmpty).join(' • ');
        const classes = [TREE_NODE_SEGMENT_CLASS];
        if (!this.hasTrailingSuffixes(node)) {
            classes.push(TREE_NODE_SEGMENT_GROW_CLASS);
        }
        const className = classes.join(' ');
        let attrs = this.decorateCaption(node, {
            className, id: node.id
        });
        if (tooltip.length > 0) {
            attrs = {
                ...attrs,
                title: tooltip
            };
        }
        const children: React.ReactNode[] = [];
        const caption = this.toNodeName(node);
        const highlight = this.getDecorationData(node, 'highlight')[0];
        if (highlight) {
            children.push(this.toReactNode(caption, highlight));
        }
        const searchHighlight = this.searchHighlights ? this.searchHighlights.get(node.id) : undefined;
        if (searchHighlight) {
            children.push(...this.toReactNode(caption, searchHighlight));
        } else if (!highlight) {
            children.push(caption);
        }
        return React.createElement('div', attrs, ...children);
    }

    /**
     * Update the node given the caption and highlight.
     * @param caption the caption.
     * @param highlight the tree decoration caption highlight.
     */
    protected toReactNode(caption: string, highlight: TreeDecoration.CaptionHighlight): React.ReactNode[] {
        let style: React.CSSProperties = {};
        if (highlight.color) {
            style = {
                ...style,
                color: highlight.color
            };
        }
        if (highlight.backgroundColor) {
            style = {
                ...style,
                backgroundColor: highlight.backgroundColor
            };
        }
        const createChildren = (fragment: TreeDecoration.CaptionHighlight.Fragment, index: number) => {
            const { data } = fragment;
            if (fragment.highlight) {
                return <mark className={TreeDecoration.Styles.CAPTION_HIGHLIGHT_CLASS} style={style} key={index}>{data}</mark>;
            } else {
                return data;
            }
        };
        return TreeDecoration.CaptionHighlight.split(caption, highlight).map(createChildren);
    }

    /**
     * Decorate the tree caption.
     * @param node the tree node.
     * @param attrs the additional attributes.
     */
    protected decorateCaption(node: TreeNode, attrs: React.HTMLAttributes<HTMLElement>): React.Attributes & React.HTMLAttributes<HTMLElement> {
        const style = this.getDecorationData(node, 'fontData')
            .filter(notEmpty)
            .reverse()
            .map(fontData => this.applyFontStyles({}, fontData))
            .reduce((acc, current) => ({
                ...acc,
                ...current
            }), {});
        return {
            ...attrs,
            style
        };
    }

    /**
     * Determine if the tree node contains trailing suffixes.
     * @param node the tree node.
     *
     * @returns `true` if the tree node contains trailing suffices.
     */
    protected hasTrailingSuffixes(node: TreeNode): boolean {
        return this.getDecorationData(node, 'captionSuffixes').filter(notEmpty).reduce((acc, current) => acc.concat(current), []).length > 0;
    }

    /**
     * Apply font styles to the tree.
     * @param original the original css properties.
     * @param fontData the optional `fontData`.
     */
    protected applyFontStyles(original: React.CSSProperties, fontData: TreeDecoration.FontData | undefined): React.CSSProperties {
        if (fontData === undefined) {
            return original;
        }
        const modified = { ...original }; // make a copy to mutate
        const { color, style } = fontData;
        if (color) {
            modified.color = color;
        }
        if (style) {
            (Array.isArray(style) ? style : [style]).forEach(s => {
                switch (s) {
                    case 'bold':
                        modified.fontWeight = s;
                        break;
                    case 'normal':
                    case 'oblique':
                    case 'italic':
                        modified.fontStyle = s;
                        break;
                    case 'underline':
                    case 'line-through':
                        modified.textDecoration = s;
                        break;
                    default:
                        throw new Error(`Unexpected font style: "${s}".`);
                }
            });
        }
        return modified;
    }

    /**
     * Render caption affixes for the given tree node.
     * @param node the tree node.
     * @param props the node properties.
     * @param affixKey the affix key.
     */
    protected renderCaptionAffixes(node: TreeNode, props: NodeProps, affixKey: 'captionPrefixes' | 'captionSuffixes'): React.ReactNode {
        const suffix = affixKey === 'captionSuffixes';
        const affixClass = suffix ? TreeDecoration.Styles.CAPTION_SUFFIX_CLASS : TreeDecoration.Styles.CAPTION_PREFIX_CLASS;
        const classes = [TREE_NODE_SEGMENT_CLASS, affixClass];
        const affixes = this.getDecorationData(node, affixKey).filter(notEmpty).reduce((acc, current) => acc.concat(current), []);
        const children: React.ReactNode[] = [];
        for (let i = 0; i < affixes.length; i++) {
            const affix = affixes[i];
            if (suffix && i === affixes.length - 1) {
                classes.push(TREE_NODE_SEGMENT_GROW_CLASS);
            }
            const style = this.applyFontStyles({}, affix.fontData);
            const className = classes.join(' ');
            const key = node.id + '_' + i;
            const attrs = {
                className,
                style,
                key
            };
            children.push(React.createElement('div', attrs, affix.data));
        }
        return <React.Fragment>{children}</React.Fragment>;
    }

    /**
     * Decorate the tree node icon.
     * @param node the tree node.
     * @param icon the icon.
     */
    protected decorateIcon(node: TreeNode, icon: React.ReactNode | null): React.ReactNode {
        // eslint-disable-next-line no-null/no-null
        if (icon === null) {
            // eslint-disable-next-line no-null/no-null
            return null;
        }

        const overlayIcons: React.ReactNode[] = [];
        new Map(this.getDecorationData(node, 'iconOverlay').reverse().filter(notEmpty)
            .map(overlay => [overlay.position, overlay] as [TreeDecoration.IconOverlayPosition, TreeDecoration.IconOverlay | TreeDecoration.IconClassOverlay]))
            .forEach((overlay, position) => {
                const iconClasses = [TreeDecoration.Styles.DECORATOR_SIZE_CLASS, TreeDecoration.IconOverlayPosition.getStyle(position)];
                const style = (color?: string) => color === undefined ? {} : { color };
                if (overlay.background) {
                    overlayIcons.push(<span key={node.id + 'bg'} className={this.getIconClass(overlay.background.shape, iconClasses)} style={style(overlay.background.color)}>
                    </span>);
                }
                const overlayIcon = (overlay as TreeDecoration.IconOverlay).icon || (overlay as TreeDecoration.IconClassOverlay).iconClass;
                overlayIcons.push(<span key={node.id} className={this.getIconClass(overlayIcon, iconClasses)} style={style(overlay.color)}></span>);
            });

        if (overlayIcons.length > 0) {
            return <div className={TreeDecoration.Styles.ICON_WRAPPER_CLASS}>{icon}{overlayIcons}</div>;
        }

        return icon;
    }

    /**
     * Render the tree node tail decorations.
     * @param node the tree node.
     * @param props the node properties.
     */
    protected renderTailDecorations(node: TreeNode, props: NodeProps): React.ReactNode {
        return <React.Fragment>
            {this.getDecorationData(node, 'tailDecorations').filter(notEmpty).reduce((acc, current) => acc.concat(current), []).map((decoration, index) => {
                const { tooltip } = decoration;
                const { data, fontData } = decoration as TreeDecoration.TailDecoration;
                const color = (decoration as TreeDecoration.TailDecorationIcon).color;
                const icon = (decoration as TreeDecoration.TailDecorationIcon).icon || (decoration as TreeDecoration.TailDecorationIconClass).iconClass;
                const className = [TREE_NODE_SEGMENT_CLASS, TREE_NODE_TAIL_CLASS].join(' ');
                const style = fontData ? this.applyFontStyles({}, fontData) : color ? { color } : undefined;
                const content = data ? data : icon ? <span key={node.id + 'icon' + index} className={this.getIconClass(icon)}></span> : '';
                return <div key={node.id + className + index} className={className} style={style} title={tooltip}>
                    {content}
                </div>;
            })}
        </React.Fragment>;
    }

    /**
     * Determine the classes to use for an icon
     * - Assumes a Font Awesome name when passed a single string, otherwise uses the passed string array
     * @param iconName the icon name or list of icon names.
     * @param additionalClasses additional CSS classes.
     *
     * @returns the icon class name.
     */
    private getIconClass(iconName: string | string[], additionalClasses: string[] = []): string {
        const iconClass = (typeof iconName === 'string') ? ['a', 'fa', `fa-${iconName}`] : ['a'].concat(iconName);
        return iconClass.concat(additionalClasses).join(' ');
    }

    /**
     * Render indent for the file tree based on the depth
     * @param node the tree node.
     * @param depth the depth of the tree node.
     */
    protected renderIndent(node: TreeNode, props: NodeProps): React.ReactNode {
        const renderIndentGuides = this.corePreferences['workbench.tree.renderIndentGuides'];
        if (renderIndentGuides === 'none') {
            return undefined;
        }

        const indentDivs: React.ReactNode[] = [];
        let current: TreeNode | undefined = node;
        let depth = props.depth;
        while (current && depth) {
            const classNames: string[] = [TREE_NODE_INDENT_GUIDE_CLASS];
            if (this.needsActiveIndentGuideline(current)) {
                classNames.push('active');
            } else {
                classNames.push(renderIndentGuides === 'onHover' ? 'hover' : 'always');
            }
            const paddingLeft = this.props.leftPadding * depth;
            indentDivs.unshift(<div key={depth} className={classNames.join(' ')} style={{
                paddingLeft: `${paddingLeft}px`
            }} />);
            current = current.parent;
            depth--;
        }
        return indentDivs;
    }

    protected needsActiveIndentGuideline(node: TreeNode): boolean {
        const parent = node.parent;
        if (!parent || !this.isExpandable(parent)) {
            return false;
        }
        if (SelectableTreeNode.isSelected(parent)) {
            return true;
        }
        if (parent.expanded) {
            for (const sibling of parent.children) {
                if (SelectableTreeNode.isSelected(sibling) && !(this.isExpandable(sibling) && sibling.expanded)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Render the node given the tree node and node properties.
     * @param node the tree node.
     * @param props the node properties.
     */
    protected renderNode(node: TreeNode, props: NodeProps): React.ReactNode {
        if (!TreeNode.isVisible(node)) {
            return undefined;
        }
        const attributes = this.createNodeAttributes(node, props);
        const content = <div className={TREE_NODE_CONTENT_CLASS}>
            {this.renderExpansionToggle(node, props)}
            {this.decorateIcon(node, this.renderIcon(node, props))}
            {this.renderCaptionAffixes(node, props, 'captionPrefixes')}
            {this.renderCaption(node, props)}
            {this.renderCaptionAffixes(node, props, 'captionSuffixes')}
            {this.renderTailDecorations(node, props)}
        </div>;
        return React.createElement('div', attributes, content);
    }

    /**
     * Create node attributes for the tree node given the node properties.
     * @param node the tree node.
     * @param props the node properties.
     */
    protected createNodeAttributes(node: TreeNode, props: NodeProps): React.Attributes & React.HTMLAttributes<HTMLElement> {
        const className = this.createNodeClassNames(node, props).join(' ');
        const style = this.createNodeStyle(node, props);
        return {
            className,
            style,
            onClick: event => this.handleClickEvent(node, event),
            onDoubleClick: event => this.handleDblClickEvent(node, event),
            onContextMenu: event => this.handleContextMenuEvent(node, event)
        };
    }

    /**
     * Create the node class names.
     * @param node the tree node.
     * @param props the node properties.
     *
     * @returns the list of tree node class names.
     */
    protected createNodeClassNames(node: TreeNode, props: NodeProps): string[] {
        const classNames = [TREE_NODE_CLASS];
        if (CompositeTreeNode.is(node)) {
            classNames.push(COMPOSITE_TREE_NODE_CLASS);
        }
        if (this.isExpandable(node)) {
            classNames.push(EXPANDABLE_TREE_NODE_CLASS);
        }
        if (SelectableTreeNode.isSelected(node)) {
            classNames.push(SELECTED_CLASS);
        }
        if (SelectableTreeNode.hasFocus(node)) {
            classNames.push(FOCUS_CLASS);
        }
        return classNames;
    }

    /**
     * Get the default node style.
     * @param node the tree node.
     * @param props the node properties.
     *
     * @returns the CSS properties if available.
     */
    protected getDefaultNodeStyle(node: TreeNode, props: NodeProps): React.CSSProperties | undefined {
        const paddingLeft = this.getPaddingLeft(node, props) + 'px';
        return { paddingLeft };
    }

    protected getPaddingLeft(node: TreeNode, props: NodeProps): number {
        return props.depth * this.props.leftPadding + (this.needsExpansionTogglePadding(node) ? this.props.expansionTogglePadding : 0);
    }

    /**
     * If the node is a composite, a toggle will be rendered.
     * Otherwise we need to add the width and the left, right padding => 18px
     */
    protected needsExpansionTogglePadding(node: TreeNode): boolean {
        return !this.isExpandable(node);
    }

    /**
     * Create the tree node style.
     * @param node the tree node.
     * @param props the node properties.
     */
    protected createNodeStyle(node: TreeNode, props: NodeProps): React.CSSProperties | undefined {
        return this.decorateNodeStyle(node, this.getDefaultNodeStyle(node, props));
    }

    /**
     * Decorate the node style.
     * @param node the tree node.
     * @param style the optional CSS properties.
     *
     * @returns the CSS styles if available.
     */
    protected decorateNodeStyle(node: TreeNode, style: React.CSSProperties | undefined): React.CSSProperties | undefined {
        const backgroundColor = this.getDecorationData(node, 'backgroundColor').filter(notEmpty).shift();
        if (backgroundColor) {
            style = {
                ...(style || {}),
                backgroundColor
            };
        }
        return style;
    }

    /**
     * Determine if the tree node is expandable.
     * @param node the tree node.
     *
     * @returns `true` if the tree node is expandable.
     */
    protected isExpandable(node: TreeNode): node is ExpandableTreeNode {
        return ExpandableTreeNode.is(node);
    }

    /**
     * Get the tree node decorations.
     * @param node the tree node.
     *
     * @returns the list of tree decoration data.
     */
    protected getDecorations(node: TreeNode): TreeDecoration.Data[] {
        const decorations: TreeDecoration.Data[] = [];
        if (DecoratedTreeNode.is(node)) {
            decorations.push(node.decorationData);
        }
        if (this.decorations.has(node.id)) {
            decorations.push(...this.decorations.get(node.id)!);
        }
        return decorations.sort(TreeDecoration.Data.comparePriority);
    }

    /**
     * Get the tree decoration data for the given key.
     * @param node the tree node.
     * @param key the tree decoration data key.
     *
     * @returns the tree decoration data at the given key.
     */
    protected getDecorationData<K extends keyof TreeDecoration.Data>(node: TreeNode, key: K): TreeDecoration.Data[K][] {
        return this.getDecorations(node).filter(data => data[key] !== undefined).map(data => data[key]).filter(notEmpty);
    }

    /**
     * Store the last scroll state.
     */
    protected lastScrollState: {
        /**
         * The scroll top value.
         */
        scrollTop: number,
        /**
         * The scroll left value.
         */
        scrollLeft: number
    } | undefined;

    /**
     * Get the scroll container.
     */
    protected getScrollContainer(): MaybePromise<HTMLElement> {
        this.toDisposeOnDetach.push(Disposable.create(() => {
            const { scrollTop, scrollLeft } = this.node;
            this.lastScrollState = { scrollTop, scrollLeft };
        }));
        if (this.lastScrollState) {
            const { scrollTop, scrollLeft } = this.lastScrollState;
            this.node.scrollTop = scrollTop;
            this.node.scrollLeft = scrollLeft;
        }
        return this.node;
    }

    protected onAfterAttach(msg: Message): void {
        const up = [
            Key.ARROW_UP,
            KeyCode.createKeyCode({ first: Key.ARROW_UP, modifiers: [KeyModifier.Shift] })
        ];
        const down = [
            Key.ARROW_DOWN,
            KeyCode.createKeyCode({ first: Key.ARROW_DOWN, modifiers: [KeyModifier.Shift] })
        ];
        if (this.props.search) {
            if (this.searchBox.isAttached) {
                Widget.detach(this.searchBox);
            }
            Widget.attach(this.searchBox, this.node.parentElement!);
            this.addKeyListener(this.node, this.searchBox.keyCodePredicate.bind(this.searchBox), this.searchBox.handle.bind(this.searchBox));
            this.toDisposeOnDetach.push(Disposable.create(() => {
                Widget.detach(this.searchBox);
            }));
        }
        super.onAfterAttach(msg);
        this.addKeyListener(this.node, Key.ARROW_LEFT, event => this.handleLeft(event));
        this.addKeyListener(this.node, Key.ARROW_RIGHT, event => this.handleRight(event));
        this.addKeyListener(this.node, up, event => this.handleUp(event));
        this.addKeyListener(this.node, down, event => this.handleDown(event));
        this.addKeyListener(this.node, Key.ENTER, event => this.handleEnter(event));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.addEventListener<any>(this.node, 'ps-scroll-y', (e: Event & { target: { scrollTop: number } }) => {
            if (this.view && this.view.list && this.view.list.Grid) {
                const { scrollTop } = e.target;
                this.view.list.Grid.handleScrollEvent({ scrollTop });
            }
        });
        this.addEventListener(this.node, 'focus', () => this.doFocus());
    }

    /**
     * Handle the `left arrow` keyboard event.
     * @param event the `left arrow` keyboard event.
     */
    protected async handleLeft(event: KeyboardEvent): Promise<void> {
        if (!!this.props.multiSelect && (this.hasCtrlCmdMask(event) || this.hasShiftMask(event))) {
            return;
        }
        if (! await this.model.collapseNode()) {
            this.model.selectParent();
        }
    }

    /**
     * Handle the `right arrow` keyboard event.
     * @param event the `right arrow` keyboard event.
     */
    protected async handleRight(event: KeyboardEvent): Promise<void> {
        if (!!this.props.multiSelect && (this.hasCtrlCmdMask(event) || this.hasShiftMask(event))) {
            return;
        }
        if (! await this.model.expandNode()) {
            this.model.selectNextNode();
        }
    }

    /**
     * Handle the `up arrow` keyboard event.
     * @param event the `up arrow` keyboard event.
     */
    protected handleUp(event: KeyboardEvent): void {
        if (!!this.props.multiSelect && this.hasShiftMask(event)) {
            this.model.selectPrevNode(TreeSelection.SelectionType.RANGE);
        } else {
            this.model.selectPrevNode();
        }
    }

    /**
     * Handle the `down arrow` keyboard event.
     * @param event the `down arrow` keyboard event.
     */
    protected handleDown(event: KeyboardEvent): void {
        if (!!this.props.multiSelect && this.hasShiftMask(event)) {
            this.model.selectNextNode(TreeSelection.SelectionType.RANGE);
        } else {
            this.model.selectNextNode();
        }
    }

    /**
     * Handle the `enter key` keyboard event.
     * - `enter` opens the tree node.
     * @param event the `enter key` keyboard event.
     */
    protected handleEnter(event: KeyboardEvent): void {
        this.model.openNode();
    }

    /**
     * Handle the single-click mouse event.
     * @param node the tree node if available.
     * @param event the mouse single-click event.
     */
    protected handleClickEvent(node: TreeNode | undefined, event: React.MouseEvent<HTMLElement>): void {
        if (node) {
            const shiftMask = this.hasShiftMask(event);
            const ctrlCmdMask = this.hasCtrlCmdMask(event);
            if (!!this.props.multiSelect) {
                if (SelectableTreeNode.is(node)) {
                    if (shiftMask) {
                        this.model.selectRange(node);
                    } else if (ctrlCmdMask) {
                        this.model.toggleNode(node);
                    } else {
                        this.model.selectNode(node);
                    }
                }
            } else {
                if (SelectableTreeNode.is(node)) {
                    this.model.selectNode(node);
                }
            }
            if (!this.props.expandOnlyOnExpansionToggleClick) {
                if (this.isExpandable(node) && !shiftMask && !ctrlCmdMask) {
                    this.model.toggleNodeExpansion(node);
                }
            }
            event.stopPropagation();
        }
    }

    /**
     * Handle the double-click mouse event.
     * @param node the tree node if available.
     * @param event the double-click mouse event.
     */
    protected handleDblClickEvent(node: TreeNode | undefined, event: React.MouseEvent<HTMLElement>): void {
        this.model.openNode(node);
        event.stopPropagation();
    }

    /**
     * Handle the context menu click event.
     * - The context menu click event is triggered by the right-click.
     * @param node the tree node if available.
     * @param event the right-click mouse event.
     */
    protected handleContextMenuEvent(node: TreeNode | undefined, event: React.MouseEvent<HTMLElement>): void {
        if (SelectableTreeNode.is(node)) {
            // Keep the selection for the context menu, if the widget support multi-selection and the right click happens on an already selected node.
            if (!this.props.multiSelect || !node.selected) {
                const type = !!this.props.multiSelect && this.hasCtrlCmdMask(event) ? TreeSelection.SelectionType.TOGGLE : TreeSelection.SelectionType.DEFAULT;
                this.model.addSelection({ node, type });
            }
            const contextMenuPath = this.props.contextMenuPath;
            if (contextMenuPath) {
                const { x, y } = event.nativeEvent;
                const args = this.toContextMenuArgs(node);
                this.onRender.push(Disposable.create(() =>
                    setTimeout(() => this.contextMenuRenderer.render({
                        menuPath: contextMenuPath,
                        anchor: { x, y },
                        args
                    }))
                ));
            }
            this.doFocus();
        }
        event.stopPropagation();
        event.preventDefault();
    }

    /**
     * Handle the double-click mouse event on the expansion toggle.
     * @param event the double-click mouse event.
     */
    protected handleExpansionToggleDblClickEvent(event: React.MouseEvent<HTMLElement>): void {
        if (this.props.expandOnlyOnExpansionToggleClick) {
            // Ignore the double-click event.
            event.stopPropagation();
        }
    }

    /**
     * Convert the tree node to context menu arguments.
     * @param node the selectable tree node.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected toContextMenuArgs(node: SelectableTreeNode): any[] | undefined {
        return undefined;
    }

    /**
     * Determine if the tree modifier aware event has a `ctrlcmd` mask.
     * @param event the tree modifier aware event.
     *
     * @returns `true` if the tree modifier aware event contains the `ctrlcmd` mask.
     */
    protected hasCtrlCmdMask(event: TreeWidget.ModifierAwareEvent): boolean {
        const { metaKey, ctrlKey } = event;
        return (isOSX && metaKey) || ctrlKey;
    }

    /**
     * Determine if the tree modifier aware event has a `shift` mask.
     * @param event the tree modifier aware event.
     *
     * @returns `true` if the tree modifier aware event contains the `shift` mask.
     */
    protected hasShiftMask(event: TreeWidget.ModifierAwareEvent): boolean {
        // Ctrl/Cmd mask overrules the Shift mask.
        if (this.hasCtrlCmdMask(event)) {
            return false;
        }
        return event.shiftKey;
    }

    /**
     * Deflate the tree node for storage.
     * @param node the tree node.
     */
    protected deflateForStorage(node: TreeNode): object {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const copy = Object.assign({}, node) as any;
        if (copy.parent) {
            delete copy.parent;
        }
        if ('previousSibling' in copy) {
            delete copy.previousSibling;
        }
        if ('nextSibling' in copy) {
            delete copy.nextSibling;
        }
        if ('busy' in copy) {
            delete copy.busy;
        }
        if (CompositeTreeNode.is(node)) {
            copy.children = [];
            for (const child of node.children) {
                copy.children.push(this.deflateForStorage(child));
            }
        }
        return copy;
    }

    /**
     * Inflate the tree node from storage.
     * @param node the tree node.
     * @param parent the optional tree node.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected inflateFromStorage(node: any, parent?: TreeNode): TreeNode {
        if (node.selected) {
            node.selected = false;
        }
        if (parent) {
            node.parent = parent;
        }
        if (Array.isArray(node.children)) {
            for (const child of node.children as TreeNode[]) {
                this.inflateFromStorage(child, node);
            }
        }
        return node;
    }

    /**
     * Store the tree state.
     */
    storeState(): object {
        const decorations = this.decoratorService.deflateDecorators(this.decorations);
        let state: object = {
            decorations
        };
        if (this.model.root) {
            state = {
                ...state,
                root: this.deflateForStorage(this.model.root),
                model: this.model.storeState()
            };
        }

        return state;
    }

    /**
     * Restore the state.
     * @param oldState the old state object.
     */
    restoreState(oldState: object): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { root, decorations, model } = (oldState as any);
        if (root) {
            this.model.root = this.inflateFromStorage(root);
        }
        if (decorations) {
            this.decorations = this.decoratorService.inflateDecorators(decorations);
        }
        if (model) {
            this.model.restoreState(model);
        }
    }

    protected toNodeIcon(node: TreeNode): string {
        return this.labelProvider.getIcon(node);
    }

    protected toNodeName(node: TreeNode): string {
        return this.labelProvider.getName(node);
    }

    protected toNodeDescription(node: TreeNode): string {
        return this.labelProvider.getLongName(node);
    }

}
export namespace TreeWidget {
    /**
     * Representation of the tree force update options.
     */
    export interface ForceUpdateOptions {
        /**
         * Controls whether to force a resize of the widget.
         */
        resize: boolean
    }
    /**
     * Representation of a tree node row.
     */
    export interface NodeRow {
        /**
         * The node row index.
         */
        index: number
        /**
         * The actual node.
         */
        node: TreeNode
        /**
         * A root relative number representing the hierarchical depth of the actual node. Root is `0`, its children have `1` and so on.
         */
        depth: number
    }
    /**
     * Representation of the tree view properties.
     */
    export interface ViewProps {
        /**
         * The width property.
         */
        width: number
        /**
         * The height property.
         */
        height: number
        /**
         * The scroll to row value.
         */
        scrollToRow?: number
        /**
         * The list of node rows.
         */
        rows: NodeRow[]
        handleScroll: (info: ScrollParams) => void
        renderNodeRow: (row: NodeRow) => React.ReactNode
    }
    export class View extends React.Component<ViewProps> {
        list: List | undefined;
        readonly cache = new CellMeasurerCache({
            fixedWidth: true
        });
        render(): React.ReactNode {
            const { rows, width, height, scrollToRow, handleScroll } = this.props;
            return <List
                ref={list => this.list = (list || undefined)}
                width={width}
                height={height}
                rowCount={rows.length}
                rowHeight={this.cache.rowHeight}
                rowRenderer={this.renderTreeRow}
                scrollToIndex={scrollToRow}
                onScroll={handleScroll}
                tabIndex={-1}
            />;
        }
        protected renderTreeRow: ListRowRenderer = ({ key, index, style, parent }) => {
            const row = this.props.rows[index]!;
            return <CellMeasurer
                cache={this.cache}
                columnIndex={0}
                key={key}
                parent={parent}
                rowIndex={index}>
                <div key={key} style={style}>{this.props.renderNodeRow(row)}</div>
            </CellMeasurer>;
        };
    }
}
