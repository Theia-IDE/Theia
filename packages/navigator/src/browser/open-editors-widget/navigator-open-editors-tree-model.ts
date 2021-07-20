/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
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

import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { FileNode, FileStatNode, FileTreeModel } from '@theia/filesystem/lib/browser';
import {
    ApplicationShell,
    CompositeTreeNode,
    open,
    NavigatableWidget,
    OpenerService,
    SelectableTreeNode,
    TreeNode,
    Widget,
    ExpandableTreeNode,
    TabBar
} from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import debounce = require('@theia/core/shared/lodash.debounce');
import { DisposableCollection } from '@theia/core/lib/common';
export interface OpenEditorNode extends FileStatNode {
    widget: Widget;
};

export namespace OpenEditorNode {
    export function is(node: object | undefined): node is OpenEditorNode {
        return FileStatNode.is(node) && 'widget' in node;
    }
}

@injectable()
export class OpenEditorsModel extends FileTreeModel {
    static GROUP_NODE_ID_PREFIX = 'group-node';
    static AREA_NODE_ID_PREFIX = 'area-node';

    @inject(ApplicationShell) protected readonly applicationShell: ApplicationShell;
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(OpenerService) protected readonly openerService: OpenerService;

    protected toDisposeOnPreviewWidgetReplaced = new DisposableCollection();
    // Returns the collection of editors belonging to a tabbar group in the main area
    protected _editorWidgetsByGroup = new Map<number, { widgets: NavigatableWidget[], tabbar: TabBar<Widget> }>();

    // Returns the collection of editors belonging to an area grouping (main, left, right bottom)
    protected _editorWidgetsByArea = new Map<ApplicationShell.Area, NavigatableWidget[]>();

    // Last collection of editors before a layout modification, used to detect changes in widget ordering
    protected _lastEditorWidgetsByArea = new Map<ApplicationShell.Area, NavigatableWidget[]>();

    get editorWidgets(): NavigatableWidget[] {
        const editorWidgets: NavigatableWidget[] = [];
        this._editorWidgetsByArea.forEach(widgets => editorWidgets.push(...widgets));
        return editorWidgets;
    }

    getTabBarForGroup(id: number): TabBar<Widget> | undefined {
        return this._editorWidgetsByGroup.get(id)?.tabbar;
    }

    @postConstruct()
    protected init(): void {
        super.init();
        this.setupHandlers();
        this.initializeRoot();
    }

    protected setupHandlers(): void {
        this.toDispose.push(this.applicationShell.onDidChangeCurrentWidget(({ newValue }) => {
            const nodeToSelect = this.tree.getNode(newValue?.id);
            if (nodeToSelect && SelectableTreeNode.is(nodeToSelect)) {
                this.selectNode(nodeToSelect);
            }
        }));
        this.toDispose.push(this.applicationShell.onDidAddWidget(() => this.updateOpenWidgets()));
        this.toDispose.push(this.applicationShell.onDidRemoveWidget(() => this.updateOpenWidgets()));
        // Check for tabs rearranged in main and bottom
        this.applicationShell.mainPanel.layoutModified.connect(() => this.doUpdateOpenWidgets('main'));
        this.applicationShell.bottomPanel.layoutModified.connect(() => this.doUpdateOpenWidgets('bottom'));
    }

    protected async initializeRoot(): Promise<void> {
        await this.updateOpenWidgets();
        this.fireChanged();
    }

    protected updateOpenWidgets = debounce(this.doUpdateOpenWidgets, 250);

    protected async doUpdateOpenWidgets(layoutModifiedArea?: ApplicationShell.Area): Promise<void> {
        this._lastEditorWidgetsByArea = this._editorWidgetsByArea;
        this._editorWidgetsByArea = new Map<ApplicationShell.Area, NavigatableWidget[]>();
        let doRebuild = true;
        const areas: ApplicationShell.Area[] = ['main', 'bottom', 'left', 'right', 'top'];
        areas.forEach(area => {
            const editorWidgetsForArea = this.applicationShell.getWidgets(area).filter((widget): widget is NavigatableWidget => NavigatableWidget.is(widget));
            if (editorWidgetsForArea.length) {
                this._editorWidgetsByArea.set(area, editorWidgetsForArea);
            }
        });
        if (this._lastEditorWidgetsByArea.size === 0) {
            this._lastEditorWidgetsByArea = this._editorWidgetsByArea;
        }
        // `layoutModified` can be triggered when tabs are clicked, even if they are not rearraged.
        // This will check for those instances and prevent a rebuild if it is unnecessary. Rebuilding
        // the tree if there is no change can cause the tree's selection to flicker.
        if (layoutModifiedArea) {
            doRebuild = this.shouldRebuildTreeOnLayoutModified(layoutModifiedArea);
        }
        if (doRebuild) {
            this.root = await this.buildRootFromOpenedWidgets(this._editorWidgetsByArea);
        }
    }

    protected shouldRebuildTreeOnLayoutModified(area: ApplicationShell.Area): boolean {
        const currentOrdering = this._editorWidgetsByArea.get(area);
        const previousOrdering = this._lastEditorWidgetsByArea.get(area);
        if (currentOrdering?.length === 1) {
            return true;
        }
        if (currentOrdering?.length !== previousOrdering?.length) {
            return true;
        }
        if (!!currentOrdering && !!previousOrdering) {
            return !currentOrdering.every((widget, index) => widget === previousOrdering[index]);
        }
        return true;
    }

    protected tryCreateWidgetGroupMap(): Map<Widget, CompositeTreeNode> {
        const mainTabBars = this.applicationShell.mainAreaTabBars;
        this._editorWidgetsByGroup = new Map();
        const widgetGroupMap = new Map<Widget, CompositeTreeNode>();
        if (mainTabBars.length > 1) {
            mainTabBars.forEach((tabbar, index) => {
                const groupNumber = index + 1;
                const newCaption = `GROUP ${groupNumber}`;
                const groupNode = {
                    parent: undefined,
                    id: `${OpenEditorsModel.GROUP_NODE_ID_PREFIX}:${groupNumber}`,
                    name: newCaption,
                    children: []
                };
                const widgets: NavigatableWidget[] = [];
                tabbar.titles.map(title => {
                    const { owner } = title;
                    widgetGroupMap.set(owner, groupNode);
                    if (NavigatableWidget.is(owner)) {
                        widgets.push(owner);
                    }
                });
                this._editorWidgetsByGroup.set(groupNumber, { widgets, tabbar });
            });
        }
        return widgetGroupMap;
    }

    protected async buildRootFromOpenedWidgets(widgetsByArea: Map<ApplicationShell.Area, NavigatableWidget[]>): Promise<CompositeTreeNode> {
        const rootNode: CompositeTreeNode = {
            id: 'open-editors:root',
            parent: undefined,
            visible: false,
            children: [],
        };

        const mainAreaWidgetGroups = this.tryCreateWidgetGroupMap();

        for (const [area, widgetsInArea] of widgetsByArea.entries()) {
            const areaNode: CompositeTreeNode & ExpandableTreeNode = {
                id: `${OpenEditorsModel.AREA_NODE_ID_PREFIX}:${area}`,
                parent: rootNode,
                name: area,
                expanded: true,
                children: []
            };
            for (const widget of widgetsInArea) {
                const uri = widget.getResourceUri();
                if (uri) {
                    const fileStat = await this.fileService.resolve(uri);
                    const openEditorNode: OpenEditorNode = {
                        id: widget.id,
                        fileStat,
                        uri,
                        selected: false,
                        parent: undefined,
                        name: widget.title.label,
                        icon: widget.title.iconClass,
                        widget
                    };
                    // only show groupings for main area widgets if more than one tabbar
                    if ((area === 'main') && (mainAreaWidgetGroups.size > 1)) {
                        const groupNode = mainAreaWidgetGroups.get(widget);
                        if (groupNode) {
                            CompositeTreeNode.addChild(groupNode, openEditorNode);
                            CompositeTreeNode.addChild(areaNode, groupNode);
                        }
                    } else {
                        CompositeTreeNode.addChild(areaNode, openEditorNode);
                    }
                }
            }
            // If widgets are only in the main area and in a single tabbar, then don't show area node
            if (widgetsByArea.size === 1 && widgetsByArea.has('main') && area === 'main') {
                areaNode.children.forEach(child => CompositeTreeNode.addChild(rootNode, child));
            } else {
                CompositeTreeNode.addChild(rootNode, areaNode);
            }

        }
        return rootNode;
    }

    protected doOpenNode(node: TreeNode): void {
        if (node.visible === false) {
            return;
        } else if (FileNode.is(node)) {
            open(this.openerService, node.uri);
        } else {
            super.doOpenNode(node);
        }
    }
}
