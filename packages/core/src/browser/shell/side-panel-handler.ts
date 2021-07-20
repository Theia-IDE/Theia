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

import { injectable, inject } from 'inversify';
import { find, map, toArray, some } from '@phosphor/algorithm';
import { TabBar, Widget, DockPanel, Title, Panel, BoxPanel, BoxLayout, SplitPanel, PanelLayout } from '@phosphor/widgets';
import { MimeData } from '@phosphor/coreutils';
import { Drag } from '@phosphor/dragdrop';
import { AttachedProperty } from '@phosphor/properties';
import { TabBarRendererFactory, TabBarRenderer, SHELL_TABBAR_CONTEXT_MENU, SideTabBar } from './tab-bars';
import { SidebarBottomMenuWidget, SidebarBottomMenuWidgetFactory, SidebarBottomMenu } from './sidebar-bottom-menu-widget';
import { SplitPositionHandler, SplitPositionOptions } from './split-panels';
import { animationFrame } from '../browser';
import { FrontendApplicationStateService } from '../frontend-application-state';
import { TheiaDockPanel } from './theia-dock-panel';
import { SidePanelToolbar } from './side-panel-toolbar';
import { TabBarToolbarRegistry, TabBarToolbarFactory, TabBarToolbar } from './tab-bar-toolbar';
import { DisposableCollection, Disposable } from '../../common/disposable';
import { ContextMenuRenderer } from '../context-menu-renderer';
import { MenuPath } from '../../common/menu';

/** The class name added to the left and right area panels. */
export const LEFT_RIGHT_AREA_CLASS = 'theia-app-sides';

/** The class name added to collapsed side panels. */
const COLLAPSED_CLASS = 'theia-mod-collapsed';

export const SidePanelHandlerFactory = Symbol('SidePanelHandlerFactory');

export const SIDE_PANEL_TOOLBAR_CONTEXT_MENU: MenuPath = ['SIDE_PANEL_TOOLBAR_CONTEXT_MENU'];

/**
 * A class which manages a dock panel and a related side bar. This is used for the left and right
 * panel of the application shell.
 */
@injectable()
export class SidePanelHandler {

    /**
     * A property that can be attached to widgets in order to determine the insertion index
     * of their title in the tab bar.
     */
    protected static readonly rankProperty = new AttachedProperty<Widget, number | undefined>({
        name: 'sidePanelRank',
        create: () => undefined
    });

    /**
     * The tab bar displays the titles of the widgets in the side panel. Visibility of the widgets
     * is controlled entirely through tab selection: a widget is revealed by setting the `currentTitle`
     * accordingly in the tab bar, and the panel is hidden by setting that property to `null`. The
     * tab bar itself remains visible as long as there is at least one widget.
     */
    tabBar: SideTabBar;
    /**
     * The menu placed on the sidebar bottom.
     * Displayed as icons.
     * Open menus when on clicks.
     */
    bottomMenu: SidebarBottomMenuWidget;
    /**
     * A tool bar, which displays a title and widget specific command buttons.
     */
    toolBar: SidePanelToolbar;
    /**
     * The widget container is a dock panel in `single-document` mode, which means that the panel
     * cannot be split.
     */
    dockPanel: TheiaDockPanel;
    /**
     * The panel that contains the tab bar and the dock panel. This one is hidden whenever the dock
     * panel is empty.
     */
    container: Panel;
    /**
     * The current state of the side panel.
     */
    readonly state: SidePanel.State = {
        empty: true,
        expansion: SidePanel.ExpansionState.collapsed,
        pendingUpdate: Promise.resolve()
    };

    /**
     * The shell area where the panel is placed. This property should not be modified directly, but
     * only by calling `create`.
     */
    protected side: 'left' | 'right';
    /**
     * Options that control the behavior of the side panel.
     */
    protected options: SidePanel.Options;

    @inject(TabBarToolbarRegistry) protected tabBarToolBarRegistry: TabBarToolbarRegistry;
    @inject(TabBarToolbarFactory) protected tabBarToolBarFactory: () => TabBarToolbar;
    @inject(TabBarRendererFactory) protected tabBarRendererFactory: () => TabBarRenderer;
    @inject(SidebarBottomMenuWidgetFactory) protected sidebarBottomWidgetFactory: () => SidebarBottomMenuWidget;
    @inject(SplitPositionHandler) protected splitPositionHandler: SplitPositionHandler;
    @inject(FrontendApplicationStateService) protected readonly applicationStateService: FrontendApplicationStateService;

    @inject(ContextMenuRenderer)
    protected readonly contextMenuRenderer: ContextMenuRenderer;

    /**
     * Create the side bar and dock panel widgets.
     */
    create(side: 'left' | 'right', options: SidePanel.Options): void {
        this.side = side;
        this.options = options;
        this.tabBar = this.createSideBar();
        this.bottomMenu = this.createSidebarBottomMenu();
        this.toolBar = this.createToolbar();
        this.dockPanel = this.createSidePanel();
        this.container = this.createContainer();

        this.refresh();
    }

    protected createSideBar(): SideTabBar {
        const side = this.side;
        const tabBarRenderer = this.tabBarRendererFactory();
        const sideBar = new SideTabBar({
            // Tab bar options
            orientation: side === 'left' || side === 'right' ? 'vertical' : 'horizontal',
            insertBehavior: 'none',
            removeBehavior: 'select-previous-tab',
            allowDeselect: false,
            tabsMovable: true,
            renderer: tabBarRenderer,
            // Scroll bar options
            handlers: ['drag-thumb', 'keyboard', 'wheel', 'touch'],
            useBothWheelAxes: true,
            scrollYMarginOffset: 8,
            suppressScrollX: true
        });
        tabBarRenderer.tabBar = sideBar;
        sideBar.disposed.connect(() => tabBarRenderer.dispose());
        tabBarRenderer.contextMenuPath = SHELL_TABBAR_CONTEXT_MENU;
        sideBar.addClass('theia-app-' + side);
        sideBar.addClass(LEFT_RIGHT_AREA_CLASS);

        sideBar.tabAdded.connect((sender, { title }) => {
            const widget = title.owner;
            if (!some(this.dockPanel.widgets(), w => w === widget)) {
                this.dockPanel.addWidget(widget);
            }
        }, this);
        sideBar.tabActivateRequested.connect((sender, { title }) => title.owner.activate());
        sideBar.tabCloseRequested.connect((sender, { title }) => title.owner.close());
        sideBar.collapseRequested.connect(() => this.collapse(), this);
        sideBar.currentChanged.connect(this.onCurrentTabChanged, this);
        sideBar.tabDetachRequested.connect(this.onTabDetachRequested, this);
        return sideBar;
    }

    protected createSidePanel(): TheiaDockPanel {
        const sidePanel = new TheiaDockPanel({
            mode: 'single-document'
        });
        sidePanel.id = 'theia-' + this.side + '-side-panel';
        sidePanel.addClass('theia-side-panel');

        sidePanel.widgetActivated.connect((sender, widget) => {
            this.tabBar.currentTitle = widget.title;
        }, this);
        sidePanel.widgetAdded.connect(this.onWidgetAdded, this);
        sidePanel.widgetRemoved.connect(this.onWidgetRemoved, this);
        return sidePanel;
    }

    protected createToolbar(): SidePanelToolbar {
        const toolbar = new SidePanelToolbar(this.tabBarToolBarRegistry, this.tabBarToolBarFactory, this.side);
        toolbar.onContextMenu(e => this.showContextMenu(e));
        return toolbar;
    }

    protected createSidebarBottomMenu(): SidebarBottomMenuWidget {
        const bottomMenu = this.sidebarBottomWidgetFactory();
        bottomMenu.addClass('theia-sidebar-bottom-menu');
        return bottomMenu;
    }

    protected showContextMenu(e: MouseEvent): void {
        const title = this.tabBar.currentTitle;
        if (!title) {
            return;
        }
        e.stopPropagation();
        e.preventDefault();

        this.contextMenuRenderer.render({
            args: [title.owner],
            menuPath: SIDE_PANEL_TOOLBAR_CONTEXT_MENU,
            anchor: e
        });
    }

    protected createContainer(): Panel {
        const contentBox = new BoxLayout({ direction: 'top-to-bottom', spacing: 0 });
        BoxPanel.setStretch(this.toolBar, 0);
        contentBox.addWidget(this.toolBar);
        BoxPanel.setStretch(this.dockPanel, 1);
        contentBox.addWidget(this.dockPanel);
        const contentPanel = new BoxPanel({ layout: contentBox });

        const side = this.side;
        let direction: BoxLayout.Direction;
        switch (side) {
            case 'left':
                direction = 'left-to-right';
                break;
            case 'right':
                direction = 'right-to-left';
                break;
            default:
                throw new Error('Illegal argument: ' + side);
        }
        const containerLayout = new BoxLayout({ direction, spacing: 0 });
        const sidebarContainerLayout = new PanelLayout();
        const sidebarContainer = new Panel({ layout: sidebarContainerLayout });
        sidebarContainer.addClass('theia-app-sidebar-container');
        sidebarContainerLayout.addWidget(this.tabBar);
        sidebarContainerLayout.addWidget(this.bottomMenu);

        BoxPanel.setStretch(sidebarContainer, 0);
        BoxPanel.setStretch(contentPanel, 1);
        containerLayout.addWidget(sidebarContainer);
        containerLayout.addWidget(contentPanel);
        const boxPanel = new BoxPanel({ layout: containerLayout });
        boxPanel.id = 'theia-' + side + '-content-panel';
        return boxPanel;
    }

    /**
     * Create an object that describes the current side panel layout. This object may contain references
     * to widgets; these need to be transformed before the layout can be serialized.
     */
    getLayoutData(): SidePanel.LayoutData {
        const currentTitle = this.tabBar.currentTitle;
        const items = toArray(map(this.tabBar.titles, title => <SidePanel.WidgetItem>{
            widget: title.owner,
            rank: SidePanelHandler.rankProperty.get(title.owner),
            expanded: title === currentTitle,
            pinned: title.className.indexOf('theia-mod-pinned') >= 0
        }));
        // eslint-disable-next-line no-null/no-null
        const size = currentTitle !== null ? this.getPanelSize() : this.state.lastPanelSize;
        return { type: 'sidepanel', items, size };
    }

    /**
     * Apply a side panel layout that has been previously created with `getLayoutData`.
     */
    setLayoutData(layoutData: SidePanel.LayoutData): void {
        // eslint-disable-next-line no-null/no-null
        this.tabBar.currentTitle = null;

        let currentTitle: Title<Widget> | undefined;
        if (layoutData.items) {
            for (const { widget, rank, expanded, pinned } of layoutData.items) {
                if (widget) {
                    if (rank) {
                        SidePanelHandler.rankProperty.set(widget, rank);
                    }
                    if (expanded) {
                        currentTitle = widget.title;
                    }
                    if (currentTitle && pinned) {
                        currentTitle.className += ' theia-mod-pinned';
                        currentTitle.closable = false;
                    }
                    // Add the widgets directly to the tab bar in the same order as they are stored
                    this.tabBar.addTab(widget.title);
                }
            }
        }
        if (layoutData.size) {
            this.state.lastPanelSize = layoutData.size;
        }

        // If the layout data contains an expanded item, update the currentTitle property
        // This implies a refresh through the `currentChanged` signal
        if (currentTitle) {
            this.tabBar.currentTitle = currentTitle;
        } else {
            this.refresh();
        }
    }

    /**
     * Activate a widget residing in the side panel by ID.
     *
     * @returns the activated widget if it was found
     */
    activate(id: string): Widget | undefined {
        const widget = this.expand(id);
        if (widget) {
            widget.activate();
        }
        return widget;
    }

    /**
     * Expand a widget residing in the side panel by ID. If no ID is given and the panel is
     * currently collapsed, the last active tab of this side panel is expanded. If no tab
     * was expanded previously, the first one is taken.
     *
     * @returns the expanded widget if it was found
     */
    expand(id?: string): Widget | undefined {
        if (id) {
            const widget = find(this.dockPanel.widgets(), w => w.id === id);
            if (widget) {
                this.tabBar.currentTitle = widget.title;
            }
            return widget;
        } else if (this.tabBar.currentTitle) {
            return this.tabBar.currentTitle.owner;
        } else if (this.tabBar.titles.length > 0) {
            let index = this.state.lastActiveTabIndex;
            if (!index) {
                index = 0;
            } else if (index >= this.tabBar.titles.length) {
                index = this.tabBar.titles.length - 1;
            }
            const title = this.tabBar.titles[index];
            this.tabBar.currentTitle = title;
            return title.owner;
        } else {
            // Reveal the tab bar and dock panel even if there is no widget
            // The next call to `refreshVisibility` will collapse them again
            this.state.expansion = SidePanel.ExpansionState.expanding;
            let relativeSizes: number[] | undefined;
            const parent = this.container.parent;
            if (parent instanceof SplitPanel) {
                relativeSizes = parent.relativeSizes();
            }
            this.container.removeClass(COLLAPSED_CLASS);
            this.container.show();
            this.tabBar.show();
            this.dockPanel.node.style.minWidth = '0';
            this.dockPanel.show();
            if (relativeSizes && parent instanceof SplitPanel) {
                // Make sure that the expansion animation starts at zero size
                parent.setRelativeSizes(relativeSizes);
            }
            this.setPanelSize(this.options.emptySize).then(() => {
                if (this.state.expansion === SidePanel.ExpansionState.expanding) {
                    this.state.expansion = SidePanel.ExpansionState.expanded;
                }
            });
        }
    }

    /**
     * Collapse the sidebar so no items are expanded.
     */
    collapse(): Promise<void> {
        if (this.tabBar.currentTitle) {
            // eslint-disable-next-line no-null/no-null
            this.tabBar.currentTitle = null;
        } else {
            this.refresh();
        }
        return animationFrame();
    }

    /**
     * Add a widget and its title to the dock panel and side bar.
     *
     * If the widget is already added, it will be moved.
     */
    addWidget(widget: Widget, options: SidePanel.WidgetOptions): void {
        if (options.rank) {
            SidePanelHandler.rankProperty.set(widget, options.rank);
        }
        this.dockPanel.addWidget(widget);
    }

    /**
     * Add a menu to the sidebar bottom.
     *
     * If the menu is already added, it will be ignored.
     */
    addMenu(menu: SidebarBottomMenu): void {
        this.bottomMenu.addMenu(menu);
    }

    /**
     * Remove a menu from the sidebar bottom.
     *
     * @param menuId id of the menu to remove
     */
    removeMenu(menuId: string): void {
        this.bottomMenu.removeMenu(menuId);
    }

    // should be a property to preserve fn identity
    protected updateToolbarTitle = (): void => {
        const currentTitle = this.tabBar && this.tabBar.currentTitle;
        this.toolBar.toolbarTitle = currentTitle || undefined;
    };

    /**
     * Refresh the visibility of the side bar and dock panel.
     */
    refresh(): void {
        const container = this.container;
        const parent = container.parent;
        const tabBar = this.tabBar;
        const dockPanel = this.dockPanel;
        const isEmpty = tabBar.titles.length === 0;
        const currentTitle = tabBar.currentTitle;
        // eslint-disable-next-line no-null/no-null
        const hideDockPanel = currentTitle === null;
        let relativeSizes: number[] | undefined;

        if (hideDockPanel) {
            container.addClass(COLLAPSED_CLASS);
            if (this.state.expansion === SidePanel.ExpansionState.expanded && !this.state.empty) {
                // Update the lastPanelSize property
                const size = this.getPanelSize();
                if (size) {
                    this.state.lastPanelSize = size;
                }
            }
            this.state.expansion = SidePanel.ExpansionState.collapsed;
        } else {
            container.removeClass(COLLAPSED_CLASS);
            let size: number | undefined;
            if (this.state.expansion !== SidePanel.ExpansionState.expanded) {
                if (this.state.lastPanelSize) {
                    size = this.state.lastPanelSize;
                } else {
                    size = this.getDefaultPanelSize();
                }
            }
            if (size) {
                // Restore the panel size to the last known size or the default size
                this.state.expansion = SidePanel.ExpansionState.expanding;
                if (parent instanceof SplitPanel) {
                    relativeSizes = parent.relativeSizes();
                }
                this.setPanelSize(size).then(() => {
                    if (this.state.expansion === SidePanel.ExpansionState.expanding) {
                        this.state.expansion = SidePanel.ExpansionState.expanded;
                    }
                });
            } else {
                this.state.expansion = SidePanel.ExpansionState.expanded;
            }
        }
        container.setHidden(isEmpty && hideDockPanel);
        tabBar.setHidden(isEmpty);
        dockPanel.setHidden(hideDockPanel);
        this.state.empty = isEmpty;
        if (currentTitle) {
            dockPanel.selectWidget(currentTitle.owner);
        }
        if (relativeSizes && parent instanceof SplitPanel) {
            // Make sure that the expansion animation starts at the smallest possible size
            parent.setRelativeSizes(relativeSizes);
        }
    }

    /**
     * Sets the size of the side panel.
     *
     * @param size the desired size (width) of the panel in pixels.
     */
    resize(size: number): void {
        if (this.dockPanel.isHidden) {
            this.state.lastPanelSize = size;
        } else {
            this.setPanelSize(size);
        }
    }

    /**
     * Compute the current width of the panel. This implementation assumes that the parent of
     * the panel container is a `SplitPanel`.
     */
    protected getPanelSize(): number | undefined {
        const parent = this.container.parent;
        if (parent instanceof SplitPanel && parent.isVisible) {
            const index = parent.widgets.indexOf(this.container);
            if (this.side === 'left') {
                const handle = parent.handles[index];
                if (!handle.classList.contains('p-mod-hidden')) {
                    return handle.offsetLeft;
                }
            } else if (this.side === 'right') {
                const handle = parent.handles[index - 1];
                if (!handle.classList.contains('p-mod-hidden')) {
                    const parentWidth = parent.node.clientWidth;
                    return parentWidth - handle.offsetLeft;
                }
            }
        }
    }

    /**
     * Determine the default size to apply when the panel is expanded for the first time.
     */
    protected getDefaultPanelSize(): number | undefined {
        const parent = this.container.parent;
        if (parent && parent.isVisible) {
            return parent.node.clientWidth * this.options.initialSizeRatio;
        }
    }

    /**
     * Modify the width of the panel. This implementation assumes that the parent of the panel
     * container is a `SplitPanel`.
     */
    protected setPanelSize(size: number): Promise<void> {
        const enableAnimation = this.applicationStateService.state === 'ready';
        const options: SplitPositionOptions = {
            side: this.side,
            duration: enableAnimation ? this.options.expandDuration : 0,
            referenceWidget: this.dockPanel
        };
        const promise = this.splitPositionHandler.setSidePanelSize(this.container, size, options);
        const result = new Promise<void>(resolve => {
            // Resolve the resulting promise in any case, regardless of whether resizing was successful
            promise.then(() => resolve(), () => resolve());
        });
        this.state.pendingUpdate = this.state.pendingUpdate.then(() => result);
        return result;
    }

    protected readonly toDisposeOnCurrentTabChanged = new DisposableCollection();

    /**
     * Handle a `currentChanged` signal from the sidebar. The side panel is refreshed so it displays
     * the new selected widget.
     */
    protected onCurrentTabChanged(sender: SideTabBar, { currentTitle, currentIndex }: TabBar.ICurrentChangedArgs<Widget>): void {
        this.toDisposeOnCurrentTabChanged.dispose();
        if (currentTitle) {
            this.updateToolbarTitle();
            currentTitle.changed.connect(this.updateToolbarTitle);
            this.toDisposeOnCurrentTabChanged.push(Disposable.create(() => currentTitle.changed.disconnect(this.updateToolbarTitle)));
        }
        if (currentIndex >= 0) {
            this.state.lastActiveTabIndex = currentIndex;
            sender.revealTab(currentIndex);
        }
        this.refresh();
    }

    /**
     * Handle a `tabDetachRequested` signal from the sidebar. A drag is started so the widget can be
     * moved to another application shell area.
     */
    protected onTabDetachRequested(sender: SideTabBar,
        { title, tab, clientX, clientY }: TabBar.ITabDetachRequestedArgs<Widget>): void {
        // Release the tab bar's hold on the mouse
        sender.releaseMouse();

        // Clone the selected tab and use that as drag image
        const clonedTab = tab.cloneNode(true) as HTMLElement;
        clonedTab.style.width = '';
        clonedTab.style.height = '';
        const label = clonedTab.getElementsByClassName('p-TabBar-tabLabel')[0] as HTMLElement;
        label.style.width = '';
        label.style.height = '';

        // Create and start a drag to move the selected tab to another panel
        const mimeData = new MimeData();
        mimeData.setData('application/vnd.phosphor.widget-factory', () => title.owner);
        const drag = new Drag({
            mimeData,
            dragImage: clonedTab,
            proposedAction: 'move',
            supportedActions: 'move',
        });

        tab.classList.add('p-mod-hidden');
        drag.start(clientX, clientY).then(() => {
            // The promise is resolved when the drag has ended
            tab.classList.remove('p-mod-hidden');
        });
    }

    /*
     * Handle the `widgetAdded` signal from the dock panel. The widget's title is inserted into the
     * tab bar according to the `rankProperty` value that may be attached to the widget.
     */
    protected onWidgetAdded(sender: DockPanel, widget: Widget): void {
        const titles = this.tabBar.titles;
        if (!find(titles, t => t.owner === widget)) {
            const rank = SidePanelHandler.rankProperty.get(widget);
            let index = titles.length;
            if (rank !== undefined) {
                for (let i = index - 1; i >= 0; i--) {
                    const r = SidePanelHandler.rankProperty.get(titles[i].owner);
                    if (r !== undefined && r > rank) {
                        index = i;
                    }
                }
            }
            this.tabBar.insertTab(index, widget.title);
            this.refresh();
        }
    }

    /*
     * Handle the `widgetRemoved` signal from the dock panel. The widget's title is also removed
     * from the tab bar.
     */
    protected onWidgetRemoved(sender: DockPanel, widget: Widget): void {
        this.tabBar.removeTab(widget.title);
        this.refresh();
    }

}

export namespace SidePanel {
    /**
     * Options that control the behavior of side panels.
     */
    export interface Options {
        /**
         * When a widget is being dragged and the distance of the mouse cursor to the shell border
         * is below this threshold, the respective side panel is expanded so the widget can be dropped
         * into that panel. Set this to `-1` to disable expanding the side panel while dragging.
         */
        expandThreshold: number;
        /**
         * The duration in milliseconds of the animation shown when a side panel is expanded.
         * Set this to `0` to disable expansion animation.
         */
        expandDuration: number;
        /**
         * The ratio of the available shell size to use as initial size for the side panel.
         */
        initialSizeRatio: number
        /**
         * How large the panel should be when it's expanded and empty.
         */
        emptySize: number;
    }

    /**
     * The options for adding a widget to a side panel.
     */
    export interface WidgetOptions {
        /**
         * The rank order of the widget among its siblings.
         */
        rank?: number;
    }

    /**
     * Data to save and load the layout of a side panel.
     */
    export interface LayoutData {
        type: 'sidepanel',
        items?: WidgetItem[];
        size?: number;
    }

    /**
     * Data structure used to save and restore the side panel layout.
     */
    export interface WidgetItem extends WidgetOptions {
        /** Can be undefined in case the widget could not be restored. */
        widget?: Widget;
        expanded?: boolean;
        pinned?: boolean;
    }

    export interface State {
        /**
         * Indicates whether the panel is empty.
         */
        empty: boolean;
        /**
         * Indicates whether the panel is expanded, collapsed, or in a transition between the two.
         */
        expansion: ExpansionState;
        /**
         * A promise that is resolved when the currently pending side panel updates are done.
         */
        pendingUpdate: Promise<void>;
        /**
         * The index of the last tab that was selected. When the panel is expanded, it tries to restore
         * the tab selection to the previous state.
         */
        lastActiveTabIndex?: number;
        /**
         * The width or height of the panel before it was collapsed. When the panel is expanded, it tries
         * to restore its size to this value.
         */
        lastPanelSize?: number;
    }

    export enum ExpansionState {
        collapsed = 'collapsed',
        expanding = 'expanding',
        expanded = 'expanded',
        collapsing = 'collapsing'
    }
}
