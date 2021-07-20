/********************************************************************************
 * Copyright (C) 2018-2019 TypeFox and others.
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

import { interfaces, injectable, inject, postConstruct } from 'inversify';
import { IIterator, toArray, find, some, every, map } from '@phosphor/algorithm';
import {
    Widget, EXPANSION_TOGGLE_CLASS, COLLAPSED_CLASS, MessageLoop, Message, SplitPanel, BaseWidget,
    addEventListener, SplitLayout, LayoutItem, PanelLayout, addKeyListener, waitForRevealed
} from './widgets';
import { Event, Emitter } from '../common/event';
import { Disposable, DisposableCollection } from '../common/disposable';
import { CommandRegistry } from '../common/command';
import { MenuModelRegistry, MenuPath, MenuAction } from '../common/menu';
import { ApplicationShell, StatefulWidget, SplitPositionHandler, SplitPositionOptions, SIDE_PANEL_TOOLBAR_CONTEXT_MENU } from './shell';
import { MAIN_AREA_ID, BOTTOM_AREA_ID } from './shell/theia-dock-panel';
import { FrontendApplicationStateService } from './frontend-application-state';
import { ContextMenuRenderer, Anchor } from './context-menu-renderer';
import { parseCssMagnitude } from './browser';
import { WidgetManager } from './widget-manager';
import { TabBarToolbarRegistry, TabBarToolbarFactory, TabBarToolbar } from './shell/tab-bar-toolbar';
import { Key } from './keys';
import { ProgressBarFactory } from './progress-bar-factory';

export interface ViewContainerTitleOptions {
    label: string;
    caption?: string;
    iconClass?: string;
    closeable?: boolean;
}

@injectable()
export class ViewContainerIdentifier {
    id: string;
    progressLocationId?: string;
}

/**
 * A view container holds an arbitrary number of widgets inside a split panel.
 * Each widget is wrapped in a _part_ that displays the widget title and toolbar
 * and allows to collapse / expand the widget content.
 */
@injectable()
export class ViewContainer extends BaseWidget implements StatefulWidget, ApplicationShell.TrackableWidgetProvider {

    protected panel: SplitPanel;

    protected currentPart: ViewContainerPart | undefined;

    @inject(FrontendApplicationStateService)
    protected readonly applicationStateService: FrontendApplicationStateService;

    @inject(ContextMenuRenderer)
    protected readonly contextMenuRenderer: ContextMenuRenderer;

    @inject(CommandRegistry)
    protected readonly commandRegistry: CommandRegistry;

    @inject(MenuModelRegistry)
    protected readonly menuRegistry: MenuModelRegistry;

    @inject(WidgetManager)
    protected readonly widgetManager: WidgetManager;

    @inject(SplitPositionHandler)
    protected readonly splitPositionHandler: SplitPositionHandler;

    @inject(ViewContainerIdentifier)
    readonly options: ViewContainerIdentifier;

    @inject(TabBarToolbarRegistry)
    protected readonly toolbarRegistry: TabBarToolbarRegistry;

    @inject(TabBarToolbarFactory)
    protected readonly toolbarFactory: TabBarToolbarFactory;

    protected readonly onDidChangeTrackableWidgetsEmitter = new Emitter<Widget[]>();
    readonly onDidChangeTrackableWidgets = this.onDidChangeTrackableWidgetsEmitter.event;

    @inject(ProgressBarFactory)
    protected readonly progressBarFactory: ProgressBarFactory;

    @postConstruct()
    protected init(): void {
        this.id = this.options.id;
        this.addClass('theia-view-container');
        const layout = new PanelLayout();
        this.layout = layout;
        this.panel = new SplitPanel({
            layout: new ViewContainerLayout({
                renderer: SplitPanel.defaultRenderer,
                orientation: this.orientation,
                spacing: 2,
                headerSize: ViewContainerPart.HEADER_HEIGHT,
                animationDuration: 200
            }, this.splitPositionHandler)
        });
        this.panel.node.tabIndex = -1;
        this.configureLayout(layout);

        const { commandRegistry, menuRegistry, contextMenuRenderer } = this;
        this.toDispose.pushAll([
            addEventListener(this.node, 'contextmenu', event => {
                if (event.button === 2 && every(this.containerLayout.iter(), part => !!part.isHidden)) {
                    event.stopPropagation();
                    event.preventDefault();
                    contextMenuRenderer.render({ menuPath: this.contextMenuPath, anchor: event });
                }
            }),
            commandRegistry.registerCommand({ id: this.globalHideCommandId }, {
                execute: (anchor: Anchor) => {
                    const toHide = this.findPartForAnchor(anchor);
                    if (toHide && toHide.canHide) {
                        toHide.hide();
                    }
                },
                isVisible: (anchor: Anchor) => {
                    const toHide = this.findPartForAnchor(anchor);
                    if (toHide) {
                        return toHide.canHide && !toHide.isHidden;
                    } else {
                        return some(this.containerLayout.iter(), part => !part.isHidden);
                    }
                }
            }),
            menuRegistry.registerMenuAction([...this.contextMenuPath, '0_global'], {
                commandId: this.globalHideCommandId,
                label: 'Hide'
            }),
            this.onDidChangeTrackableWidgetsEmitter
        ]);
        if (this.options.progressLocationId) {
            this.toDispose.push(this.progressBarFactory({ container: this.node, insertMode: 'prepend', locationId: this.options.progressLocationId }));
        }
    }

    protected configureLayout(layout: PanelLayout): void {
        layout.addWidget(this.panel);
    }

    protected readonly toDisposeOnCurrentPart = new DisposableCollection();

    protected updateCurrentPart(part?: ViewContainerPart): void {
        if (part && this.getParts().indexOf(part) !== -1) {
            this.currentPart = part;
        }
        if (this.currentPart && !this.currentPart.isDisposed) {
            return;
        }
        const visibleParts = this.getParts().filter(p => !p.isHidden);
        const expandedParts = visibleParts.filter(p => !p.collapsed);
        this.currentPart = expandedParts[0] || visibleParts[0];
    }

    protected titleOptions: ViewContainerTitleOptions | undefined;

    setTitleOptions(titleOptions: ViewContainerTitleOptions | undefined): void {
        this.titleOptions = titleOptions;
        this.updateTitle();
    }

    protected readonly toDisposeOnUpdateTitle = new DisposableCollection();

    protected updateTitle(): void {
        this.toDisposeOnUpdateTitle.dispose();
        this.toDispose.push(this.toDisposeOnUpdateTitle);
        const title = this.titleOptions;
        if (!title) {
            return;
        }
        const visibleParts = this.getParts().filter(part => !part.isHidden);
        this.title.label = title.label;
        if (visibleParts.length === 1) {
            const part = visibleParts[0];
            this.toDisposeOnUpdateTitle.push(part.onTitleChanged(() => this.updateTitle()));
            const partLabel = part.wrapped.title.label;
            if (partLabel) {
                this.title.label += ': ' + partLabel;
            }
            part.collapsed = false;
            part.hideTitle();
            this.toolbarRegistry.visibleItems(part.wrapped).forEach(partItem => {
                const id = `__${this.id}_title:${partItem.id}`;
                if ('command' in partItem) {
                    const command = this.commandRegistry.getCommand(partItem.id);
                    this.toDisposeOnUpdateTitle.push(this.commandRegistry.registerCommand({ id }, {
                        execute: (arg, ...args) => arg instanceof Widget && arg.id === this.id && this.commandRegistry.executeCommand(partItem.command, part.wrapped, ...args),
                        isEnabled: (arg, ...args) => arg instanceof Widget && arg.id === this.id && this.commandRegistry.isEnabled(partItem.command, part.wrapped, ...args),
                        isVisible: (arg, ...args) => arg instanceof Widget && arg.id === this.id && this.commandRegistry.isVisible(partItem.command, part.wrapped, ...args),
                        isToggled: (arg, ...args) => arg instanceof Widget && arg.id === this.id && this.commandRegistry.isToggled(partItem.command, part.wrapped, ...args),
                    }));
                    const tooltip = partItem.tooltip || (command && command.label);
                    const icon = partItem.icon || (command && command.iconClass);
                    this.toDisposeOnUpdateTitle.push(this.toolbarRegistry.registerItem({ ...partItem, id, command: id, tooltip, icon }));
                } else {
                    this.toDisposeOnUpdateTitle.push(this.toolbarRegistry.registerItem({
                        ...partItem,
                        id,
                        isVisible: widget => widget.id === this.id && (!partItem.isVisible || partItem.isVisible(part.wrapped))
                    }));
                }
            });
        } else {
            visibleParts.forEach(part => part.showTitle());
        }
        const caption = title.caption || title.label;
        if (caption) {
            this.title.caption = caption;
            if (visibleParts.length === 1) {
                const partCaption = visibleParts[0].wrapped.title.caption || visibleParts[0].wrapped.title.label;
                if (partCaption) {
                    this.title.caption += ': ' + partCaption;
                }
            }
        }
        if (title.iconClass) {
            this.title.iconClass = title.iconClass;
        }
        if (title.closeable !== undefined) {
            this.title.closable = title.closeable;
        }
    }

    protected findPartForAnchor(anchor: Anchor): ViewContainerPart | undefined {
        const element = document.elementFromPoint(anchor.x, anchor.y);
        if (element instanceof Element) {
            const closestPart = ViewContainerPart.closestPart(element);
            if (closestPart && closestPart.id) {
                return find(this.containerLayout.iter(), part => part.id === closestPart.id);
            }
        }
        return undefined;
    }

    protected readonly toRemoveWidgets = new Map<string, DisposableCollection>();

    addWidget(widget: Widget, options?: ViewContainer.Factory.WidgetOptions): Disposable {
        const existing = this.toRemoveWidgets.get(widget.id);
        if (existing) {
            return existing;
        }
        const toRemoveWidget = new DisposableCollection();
        this.toDispose.push(toRemoveWidget);
        this.toRemoveWidgets.set(widget.id, toRemoveWidget);
        toRemoveWidget.push(Disposable.create(() => this.toRemoveWidgets.delete(widget.id)));

        const description = this.widgetManager.getDescription(widget);
        const partId = description ? JSON.stringify(description) : widget.id;
        const newPart = this.createPart(widget, partId, options);
        this.registerPart(newPart);
        if (newPart.options && newPart.options.order !== undefined) {
            const index = this.getParts().findIndex(part => part.options.order === undefined || part.options.order > newPart.options.order!);
            if (index >= 0) {
                this.containerLayout.insertWidget(index, newPart);
            } else {
                this.containerLayout.addWidget(newPart);
            }
        } else {
            this.containerLayout.addWidget(newPart);
        }
        this.refreshMenu(newPart);
        this.updateTitle();
        this.updateCurrentPart();
        this.update();
        this.fireDidChangeTrackableWidgets();
        toRemoveWidget.pushAll([
            newPart,
            Disposable.create(() => {
                this.unregisterPart(newPart);
                if (!newPart.isDisposed) {
                    this.containerLayout.removeWidget(newPart);
                }
                if (!this.isDisposed) {
                    this.update();
                    this.updateTitle();
                    this.updateCurrentPart();
                    this.fireDidChangeTrackableWidgets();
                }
            }),
            this.registerDND(newPart),
            newPart.onDidChangeVisibility(() => {
                this.updateTitle();
                this.updateCurrentPart();
            }),
            newPart.onCollapsed(() => {
                this.containerLayout.updateCollapsed(newPart, this.enableAnimation);
                this.updateCurrentPart();
            }),
            newPart.onContextMenu(event => {
                if (event.button === 2) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.contextMenuRenderer.render({ menuPath: this.contextMenuPath, anchor: event });
                }
            }),
            newPart.onTitleChanged(() => this.refreshMenu(newPart)),
            newPart.onDidFocus(() => this.updateCurrentPart(newPart))
        ]);

        newPart.disposed.connect(() => toRemoveWidget.dispose());
        return toRemoveWidget;
    }

    protected createPart(widget: Widget, partId: string, options?: ViewContainer.Factory.WidgetOptions | undefined): ViewContainerPart {
        return new ViewContainerPart(widget, partId, this.id, this.toolbarRegistry, this.toolbarFactory, options);
    }

    removeWidget(widget: Widget): boolean {
        const disposable = this.toRemoveWidgets.get(widget.id);
        if (disposable) {
            disposable.dispose();
            return true;
        }
        return false;
    }

    getParts(): ViewContainerPart[] {
        return this.containerLayout.widgets;
    }

    getPartFor(widget: Widget): ViewContainerPart | undefined {
        return this.getParts().find(p => p.wrapped.id === widget.id);
    }

    get containerLayout(): ViewContainerLayout {
        const layout = this.panel.layout;
        if (layout instanceof ViewContainerLayout) {
            return layout;
        }
        throw new Error('view container is disposed');
    }

    protected get orientation(): SplitLayout.Orientation {
        return ViewContainer.getOrientation(this.node);
    }

    protected get enableAnimation(): boolean {
        return this.applicationStateService.state === 'ready';
    }

    protected lastVisibleState: ViewContainer.State | undefined;

    storeState(): ViewContainer.State {
        if (!this.isVisible && this.lastVisibleState) {
            return this.lastVisibleState;
        }
        return this.doStoreState();
    }
    protected doStoreState(): ViewContainer.State {
        const parts = this.getParts();
        const availableSize = this.containerLayout.getAvailableSize();
        const orientation = this.orientation;
        const partStates = parts.map(part => {
            let size = this.containerLayout.getPartSize(part);
            if (size && size > ViewContainerPart.HEADER_HEIGHT && orientation === 'vertical') {
                size -= ViewContainerPart.HEADER_HEIGHT;
            }
            return <ViewContainerPart.State>{
                widget: part.wrapped,
                partId: part.partId,
                collapsed: part.collapsed,
                hidden: part.isHidden,
                relativeSize: size && availableSize ? size / availableSize : undefined
            };
        });
        return { parts: partStates, title: this.titleOptions };
    }

    restoreState(state: ViewContainer.State): void {
        this.lastVisibleState = state;
        this.doRestoreState(state);
    }
    protected doRestoreState(state: ViewContainer.State): void {
        this.setTitleOptions(state.title);
        // restore widgets
        for (const part of state.parts) {
            if (part.widget) {
                this.addWidget(part.widget);
            }
        }
        const partStates = state.parts.filter(partState => some(this.containerLayout.iter(), p => p.partId === partState.partId));

        // Reorder the parts according to the stored state
        for (let index = 0; index < partStates.length; index++) {
            const partState = partStates[index];
            const currentIndex = this.getParts().findIndex(p => p.partId === partState.partId);
            if (currentIndex > index) {
                this.containerLayout.moveWidget(currentIndex, index, this.getParts()[currentIndex]);
            }
        }

        // Restore visibility and collapsed state
        const parts = this.getParts();
        for (let index = 0; index < parts.length; index++) {
            const part = parts[index];
            const partState = partStates.find(s => part.partId === s.partId);
            if (partState) {
                part.setHidden(partState.hidden);
                part.collapsed = partState.collapsed || !partState.relativeSize;
            } else if (part.canHide) {
                part.hide();
            }
            this.refreshMenu(part);
        }

        // Restore part sizes
        waitForRevealed(this).then(() => {
            this.containerLayout.setPartSizes(partStates.map(partState => partState.relativeSize));
        });
    }

    /**
     * Register a command to toggle the visibility of the new part.
     */
    protected registerPart(toRegister: ViewContainerPart): void {
        const commandId = this.toggleVisibilityCommandId(toRegister);
        this.commandRegistry.registerCommand({ id: commandId }, {
            execute: () => {
                const toHide = find(this.containerLayout.iter(), part => part.id === toRegister.id);
                if (toHide) {
                    toHide.setHidden(!toHide.isHidden);
                }
            },
            isToggled: () => {
                if (!toRegister.canHide) {
                    return true;
                }
                const widgetToToggle = find(this.containerLayout.iter(), part => part.id === toRegister.id);
                if (widgetToToggle) {
                    return !widgetToToggle.isHidden;
                }
                return false;
            },
            isEnabled: arg => toRegister.canHide && (!this.titleOptions || !(arg instanceof Widget) || (arg instanceof ViewContainer && arg.id === this.id)),
            isVisible: arg => !this.titleOptions || !(arg instanceof Widget) || (arg instanceof ViewContainer && arg.id === this.id)
        });
    }

    /**
     * Register a menu action to toggle the visibility of the new part.
     * The menu action is unregistered first to enable refreshing the order of menu actions.
     */
    protected refreshMenu(part: ViewContainerPart): void {
        const commandId = this.toggleVisibilityCommandId(part);
        this.menuRegistry.unregisterMenuAction(commandId);
        if (!part.wrapped.title.label) {
            return;
        }
        const action: MenuAction = {
            commandId: commandId,
            label: part.wrapped.title.label,
            order: this.getParts().indexOf(part).toString()
        };
        this.menuRegistry.registerMenuAction([...this.contextMenuPath, '1_widgets'], action);
        if (this.titleOptions) {
            this.menuRegistry.registerMenuAction([...SIDE_PANEL_TOOLBAR_CONTEXT_MENU, 'navigation'], action);
        }
    }

    protected unregisterPart(part: ViewContainerPart): void {
        const commandId = this.toggleVisibilityCommandId(part);
        this.commandRegistry.unregisterCommand(commandId);
        this.menuRegistry.unregisterMenuAction(commandId);
    }

    protected get contextMenuPath(): MenuPath {
        return [`${this.id}-context-menu`];
    }

    protected toggleVisibilityCommandId(part: ViewContainerPart): string {
        return `${this.id}:toggle-visibility-${part.id}`;
    }

    protected get globalHideCommandId(): string {
        return `${this.id}:toggle-visibility`;
    }

    protected moveBefore(toMovedId: string, moveBeforeThisId: string): void {
        const parts = this.getParts();
        const toMoveIndex = parts.findIndex(part => part.id === toMovedId);
        const moveBeforeThisIndex = parts.findIndex(part => part.id === moveBeforeThisId);
        if (toMoveIndex >= 0 && moveBeforeThisIndex >= 0) {
            this.containerLayout.moveWidget(toMoveIndex, moveBeforeThisIndex, parts[toMoveIndex]);
            for (let index = Math.min(toMoveIndex, moveBeforeThisIndex); index < parts.length; index++) {
                this.refreshMenu(parts[index]);
                this.activate();
            }
        }
    }

    getTrackableWidgets(): Widget[] {
        return this.getParts().map(w => w.wrapped);
    }

    protected fireDidChangeTrackableWidgets(): void {
        this.onDidChangeTrackableWidgetsEmitter.fire(this.getTrackableWidgets());
    }

    activateWidget(id: string): Widget | undefined {
        const part = this.revealPart(id);
        if (!part) {
            return undefined;
        }
        this.updateCurrentPart(part);
        return part.wrapped;
    }

    revealWidget(id: string): Widget | undefined {
        const part = this.revealPart(id);
        return part && part.wrapped;
    }

    protected revealPart(id: string): ViewContainerPart | undefined {
        const part = this.getParts().find(p => p.wrapped.id === id);
        if (!part) {
            return undefined;
        }
        part.setHidden(false);
        return part;
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        if (this.currentPart) {
            this.currentPart.activate();
        } else {
            this.panel.node.focus({ preventScroll: true });
        }
    }

    protected onAfterAttach(msg: Message): void {
        const orientation = this.orientation;
        this.containerLayout.orientation = orientation;
        if (orientation === 'horizontal') {
            for (const part of this.getParts()) {
                part.collapsed = false;
            }
        }
        super.onAfterAttach(msg);
    }

    protected onBeforeHide(msg: Message): void {
        super.onBeforeHide(msg);
        this.lastVisibleState = this.storeState();
    }

    protected onAfterShow(msg: Message): void {
        super.onAfterShow(msg);
        this.lastVisibleState = undefined;
    }

    protected draggingPart: ViewContainerPart | undefined;

    protected registerDND(part: ViewContainerPart): Disposable {
        part['header'].draggable = true;
        const style = (event: DragEvent) => {
            if (!this.draggingPart) {
                return;
            }
            event.preventDefault();
            const enclosingPartNode = ViewContainerPart.closestPart(event.target);
            if (enclosingPartNode && enclosingPartNode !== this.draggingPart.node) {
                enclosingPartNode.classList.add('drop-target');
            }
        };
        const unstyle = (event: DragEvent) => {
            if (!this.draggingPart) {
                return;
            }
            event.preventDefault();
            const enclosingPartNode = ViewContainerPart.closestPart(event.target);
            if (enclosingPartNode) {
                enclosingPartNode.classList.remove('drop-target');
            }
        };
        return new DisposableCollection(
            addEventListener(part['header'], 'dragstart', event => {
                const { dataTransfer } = event;
                if (dataTransfer) {
                    this.draggingPart = part;
                    dataTransfer.effectAllowed = 'move';
                    dataTransfer.setData('view-container-dnd', part.id);
                    const dragImage = document.createElement('div');
                    dragImage.classList.add('theia-view-container-drag-image');
                    dragImage.innerText = part.wrapped.title.label;
                    document.body.appendChild(dragImage);
                    dataTransfer.setDragImage(dragImage, -10, -10);
                    setTimeout(() => document.body.removeChild(dragImage), 0);
                }
            }, false),
            addEventListener(part.node, 'dragend', () => this.draggingPart = undefined, false),
            addEventListener(part.node, 'dragover', style, false),
            addEventListener(part.node, 'dragleave', unstyle, false),
            addEventListener(part.node, 'drop', event => {
                const { dataTransfer } = event;
                if (dataTransfer) {
                    const moveId = dataTransfer.getData('view-container-dnd');
                    if (moveId && moveId !== part.id) {
                        this.moveBefore(moveId, part.id);
                    }
                    unstyle(event);
                }
            }, false)
        );
    }

}

export namespace ViewContainer {

    export const Factory = Symbol('ViewContainerFactory');
    export interface Factory {
        (options: ViewContainerIdentifier): ViewContainer;
    }

    export namespace Factory {

        export interface WidgetOptions {
            readonly order?: number;
            readonly weight?: number;
            readonly initiallyCollapsed?: boolean;
            readonly canHide?: boolean;
            readonly initiallyHidden?: boolean;
        }

        export interface WidgetDescriptor {
            readonly widget: Widget | interfaces.ServiceIdentifier<Widget>;
            readonly options?: WidgetOptions;
        }

    }

    export interface State {
        title?: ViewContainerTitleOptions;
        parts: ViewContainerPart.State[]
    }

    export function getOrientation(node: HTMLElement): 'horizontal' | 'vertical' {
        if (node.closest(`#${MAIN_AREA_ID}`) || node.closest(`#${BOTTOM_AREA_ID}`)) {
            return 'horizontal';
        }
        return 'vertical';
    }
}

/**
 * Wrapper around a widget held by a view container. Adds a header to display the
 * title, toolbar, and collapse / expand handle.
 */
export class ViewContainerPart extends BaseWidget {

    protected readonly header: HTMLElement;
    protected readonly body: HTMLElement;
    protected readonly collapsedEmitter = new Emitter<boolean>();
    protected readonly contextMenuEmitter = new Emitter<MouseEvent>();
    /**
     * @deprecated since 0.11.0, use `onDidChangeVisibility` instead
     */
    readonly onVisibilityChanged = this.onDidChangeVisibility;
    protected readonly onTitleChangedEmitter = new Emitter<void>();
    readonly onTitleChanged = this.onTitleChangedEmitter.event;
    protected readonly onDidFocusEmitter = new Emitter<this>();
    readonly onDidFocus = this.onDidFocusEmitter.event;

    protected _collapsed: boolean;

    uncollapsedSize: number | undefined;
    animatedSize: number | undefined;

    protected readonly toNoDisposeWrapped: Disposable;

    constructor(
        readonly wrapped: Widget,
        readonly partId: string,
        viewContainerId: string,
        protected readonly toolbarRegistry: TabBarToolbarRegistry,
        protected readonly toolbarFactory: TabBarToolbarFactory,
        readonly options: ViewContainer.Factory.WidgetOptions = {}
    ) {
        super();
        wrapped.parent = this;
        wrapped.disposed.connect(() => this.dispose());
        this.id = `${viewContainerId}--${wrapped.id}`;
        this.addClass('part');

        const fireTitleChanged = () => this.onTitleChangedEmitter.fire(undefined);
        this.wrapped.title.changed.connect(fireTitleChanged);
        this.toDispose.push(Disposable.create(() => this.wrapped.title.changed.disconnect(fireTitleChanged)));

        const { header, body, disposable } = this.createContent();
        this.header = header;
        this.body = body;

        this.toNoDisposeWrapped = this.toDispose.push(wrapped);
        this.toDispose.pushAll([
            disposable,
            this.collapsedEmitter,
            this.contextMenuEmitter,
            this.onTitleChangedEmitter,
            this.registerContextMenu(),
            this.onDidFocusEmitter,
            // focus event does not bubble, capture it
            addEventListener(this.node, 'focus', () => this.onDidFocusEmitter.fire(this), true)
        ]);
        this.scrollOptions = {
            suppressScrollX: true,
            minScrollbarLength: 35
        };
        this.collapsed = !!options.initiallyCollapsed;
        if (options.initiallyHidden && this.canHide) {
            this.hide();
        }
    }

    get collapsed(): boolean {
        return this._collapsed;
    }

    set collapsed(collapsed: boolean) {
        // Cannot collapse/expand if the orientation of the container is `horizontal`.
        const orientation = ViewContainer.getOrientation(this.node);
        if (this._collapsed === collapsed || orientation === 'horizontal' && collapsed) {
            return;
        }
        this._collapsed = collapsed;
        if (collapsed && this.wrapped.node.contains(document.activeElement)) {
            this.header.focus();
        }
        this.wrapped.setHidden(collapsed);
        const toggleIcon = this.header.querySelector(`span.${EXPANSION_TOGGLE_CLASS}`);
        if (toggleIcon) {
            if (collapsed) {
                toggleIcon.classList.add(COLLAPSED_CLASS);
            } else {
                toggleIcon.classList.remove(COLLAPSED_CLASS);
            }
        }
        this.update();
        this.collapsedEmitter.fire(collapsed);
    }

    setHidden(hidden: boolean): void {
        if (!this.canHide) {
            return;
        }
        super.setHidden(hidden);
    }

    get canHide(): boolean {
        return this.options.canHide === undefined || this.options.canHide;
    }

    get onCollapsed(): Event<boolean> {
        return this.collapsedEmitter.event;
    }

    get onContextMenu(): Event<MouseEvent> {
        return this.contextMenuEmitter.event;
    }

    get minSize(): number {
        const style = getComputedStyle(this.body);
        if (ViewContainer.getOrientation(this.node) === 'horizontal') {
            return parseCssMagnitude(style.minWidth, 0);
        } else {
            return parseCssMagnitude(style.minHeight, 0);
        }
    }

    protected readonly toShowHeader = new DisposableCollection();
    showTitle(): void {
        this.toShowHeader.dispose();
    }

    hideTitle(): void {
        if (this.titleHidden) {
            return;
        }
        const display = this.header.style.display;
        const height = this.body.style.height;
        this.body.style.height = '100%';
        this.header.style.display = 'none';
        this.toShowHeader.push(Disposable.create(() => {
            this.header.style.display = display;
            this.body.style.height = height;
        }));
    }

    get titleHidden(): boolean {
        return !this.toShowHeader.disposed || this.collapsed;
    }

    protected getScrollContainer(): HTMLElement {
        return this.body;
    }

    protected registerContextMenu(): Disposable {
        return new DisposableCollection(
            addEventListener(this.header, 'contextmenu', event => {
                this.contextMenuEmitter.fire(event);
            })
        );
    }

    protected createContent(): { header: HTMLElement, body: HTMLElement, disposable: Disposable } {
        const disposable = new DisposableCollection();
        const { header, disposable: headerDisposable } = this.createHeader();
        const body = document.createElement('div');
        body.classList.add('body');
        this.node.appendChild(header);
        this.node.appendChild(body);
        disposable.push(headerDisposable);
        return {
            header,
            body,
            disposable,
        };
    }

    protected createHeader(): { header: HTMLElement, disposable: Disposable } {
        const disposable = new DisposableCollection();
        const header = document.createElement('div');
        header.tabIndex = 0;
        header.classList.add('theia-header', 'header');
        disposable.push(addEventListener(header, 'click', event => {
            if (this.toolbar && this.toolbar.shouldHandleMouseEvent(event)) {
                return;
            }
            this.collapsed = !this.collapsed;
        }));
        disposable.push(addKeyListener(header, Key.ARROW_LEFT, () => this.collapsed = true));
        disposable.push(addKeyListener(header, Key.ARROW_RIGHT, () => this.collapsed = false));
        disposable.push(addKeyListener(header, Key.ENTER, () => this.collapsed = !this.collapsed));

        const toggleIcon = document.createElement('span');
        toggleIcon.classList.add(EXPANSION_TOGGLE_CLASS);
        if (this.collapsed) {
            toggleIcon.classList.add(COLLAPSED_CLASS);
        }
        header.appendChild(toggleIcon);

        const title = document.createElement('span');
        title.classList.add('label', 'noselect');
        const updateTitle = () => title.innerText = this.wrapped.title.label;
        const updateCaption = () => title.title = this.wrapped.title.caption || this.wrapped.title.label;
        updateTitle();
        updateCaption();
        disposable.pushAll([
            this.onTitleChanged(updateTitle),
            this.onTitleChanged(updateCaption)
        ]);
        header.appendChild(title);
        return {
            header,
            disposable
        };
    }

    protected toolbar: TabBarToolbar | undefined;

    protected readonly toHideToolbar = new DisposableCollection();
    hideToolbar(): void {
        this.toHideToolbar.dispose();
    }

    showToolbar(): void {
        if (this.toolbarHidden) {
            return;
        }
        this.toDisposeOnDetach.push(this.toHideToolbar);

        const toolbar = this.toolbarFactory();
        toolbar.addClass('theia-view-container-part-title');
        this.toHideToolbar.push(toolbar);

        Widget.attach(toolbar, this.header);
        this.toHideToolbar.push(Disposable.create(() => Widget.detach(toolbar)));

        this.toolbar = toolbar;
        this.toHideToolbar.push(Disposable.create(() => this.toolbar = undefined));

        const items = this.toolbarRegistry.visibleItems(this.wrapped);
        toolbar.updateItems(items, this.wrapped);
    }

    get toolbarHidden(): boolean {
        return !this.toHideToolbar.disposed || this.titleHidden;
    }

    protected onResize(msg: Widget.ResizeMessage): void {
        if (this.wrapped.isAttached && !this.collapsed) {
            MessageLoop.sendMessage(this.wrapped, Widget.ResizeMessage.UnknownSize);
        }
        super.onResize(msg);
    }

    protected onUpdateRequest(msg: Message): void {
        if (this.collapsed) {
            this.hideToolbar();
        } else if (this.node.matches(':hover')) {
            this.showToolbar();
        }
        if (this.wrapped.isAttached && !this.collapsed) {
            MessageLoop.sendMessage(this.wrapped, msg);
        }
        super.onUpdateRequest(msg);
    }

    protected onBeforeAttach(msg: Message): void {
        super.onBeforeAttach(msg);
        this.addEventListener(this.node, 'mouseenter', () => this.showToolbar());
        this.addEventListener(this.node, 'mouseleave', () => this.hideToolbar());
    }

    protected onAfterAttach(msg: Message): void {
        if (!this.wrapped.isAttached) {
            MessageLoop.sendMessage(this.wrapped, Widget.Msg.BeforeAttach);
            // eslint-disable-next-line no-null/no-null
            this.body.insertBefore(this.wrapped.node, null);
            MessageLoop.sendMessage(this.wrapped, Widget.Msg.AfterAttach);
        }
        super.onAfterAttach(msg);
    }

    protected onBeforeDetach(msg: Message): void {
        super.onBeforeDetach(msg);
        if (this.wrapped.isAttached) {
            MessageLoop.sendMessage(this.wrapped, Widget.Msg.BeforeDetach);
            this.wrapped.node.parentNode!.removeChild(this.wrapped.node);
            MessageLoop.sendMessage(this.wrapped, Widget.Msg.AfterDetach);
        }
    }

    protected onBeforeShow(msg: Message): void {
        if (this.wrapped.isAttached && !this.collapsed) {
            MessageLoop.sendMessage(this.wrapped, msg);
        }
        super.onBeforeShow(msg);
    }

    protected onAfterShow(msg: Message): void {
        super.onAfterShow(msg);
        if (this.wrapped.isAttached && !this.collapsed) {
            MessageLoop.sendMessage(this.wrapped, msg);
        }
    }

    protected onBeforeHide(msg: Message): void {
        if (this.wrapped.isAttached && !this.collapsed) {
            MessageLoop.sendMessage(this.wrapped, msg);
        }
        super.onBeforeShow(msg);
    }

    protected onAfterHide(msg: Message): void {
        super.onAfterHide(msg);
        if (this.wrapped.isAttached && !this.collapsed) {
            MessageLoop.sendMessage(this.wrapped, msg);
        }
    }

    protected onChildRemoved(msg: Widget.ChildMessage): void {
        super.onChildRemoved(msg);
        // if wrapped is not disposed, but detached then we should not dispose it, but only get rid of this part
        this.toNoDisposeWrapped.dispose();
        this.dispose();
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        if (this.collapsed) {
            this.header.focus();
        } else {
            this.wrapped.activate();
        }
    }

}

export namespace ViewContainerPart {

    /**
     * Make sure to adjust the `line-height` of the `.theia-view-container .part > .header` CSS class when modifying this, and vice versa.
     */
    export const HEADER_HEIGHT = 22;

    export interface State {
        widget?: Widget
        partId: string;
        collapsed: boolean;
        hidden: boolean;
        relativeSize?: number;
    }

    export function closestPart(element: Element | EventTarget | null, selector: string = 'div.part'): Element | undefined {
        if (element instanceof Element) {
            const part = element.closest(selector);
            if (part instanceof Element) {
                return part;
            }
        }
        return undefined;
    }
}

export class ViewContainerLayout extends SplitLayout {

    constructor(protected options: ViewContainerLayout.Options, protected readonly splitPositionHandler: SplitPositionHandler) {
        super(options);
    }

    protected get items(): ReadonlyArray<LayoutItem & ViewContainerLayout.Item> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this as any)._items as Array<LayoutItem & ViewContainerLayout.Item>;
    }

    iter(): IIterator<ViewContainerPart> {
        return map(this.items, item => item.widget);
    }

    // @ts-expect-error (TS2611)
    get widgets(): ViewContainerPart[] {
        return toArray(this.iter());
    }

    moveWidget(fromIndex: number, toIndex: number, widget: Widget): void {
        const ref = this.widgets[toIndex < fromIndex ? toIndex : toIndex + 1];
        super.moveWidget(fromIndex, toIndex, widget);
        if (ref) {
            this.parent!.node.insertBefore(this.handles[toIndex], ref.node);
        } else {
            this.parent!.node.appendChild(this.handles[toIndex]);
        }
        MessageLoop.sendMessage(widget, Widget.Msg.BeforeDetach);
        this.parent!.node.removeChild(widget.node);
        MessageLoop.sendMessage(widget, Widget.Msg.AfterDetach);

        MessageLoop.sendMessage(widget, Widget.Msg.BeforeAttach);
        this.parent!.node.insertBefore(widget.node, this.handles[toIndex]);
        MessageLoop.sendMessage(widget, Widget.Msg.AfterAttach);
    }

    getPartSize(part: ViewContainerPart): number | undefined {
        if (part.collapsed || part.isHidden) {
            return part.uncollapsedSize;
        }
        if (this.orientation === 'horizontal') {
            return part.node.offsetWidth;
        } else {
            return part.node.offsetHeight;
        }
    }

    /**
     * Set the sizes of the view container parts according to the given weights
     * by moving the split handles. This is similar to `setRelativeSizes` defined
     * in `SplitLayout`, but here we properly consider the collapsed / expanded state.
     */
    setPartSizes(weights: (number | undefined)[]): void {
        const parts = this.widgets;
        const availableSize = this.getAvailableSize();

        // Sum up the weights of visible parts
        let totalWeight = 0;
        let weightCount = 0;
        for (let index = 0; index < weights.length && index < parts.length; index++) {
            const part = parts[index];
            const weight = weights[index];
            if (weight && !part.isHidden && !part.collapsed) {
                totalWeight += weight;
                weightCount++;
            }
        }
        if (weightCount === 0 || availableSize === 0) {
            return;
        }

        // Add the average weight for visible parts without weight
        const averageWeight = totalWeight / weightCount;
        for (let index = 0; index < weights.length && index < parts.length; index++) {
            const part = parts[index];
            const weight = weights[index];
            if (!weight && !part.isHidden && !part.collapsed) {
                totalWeight += averageWeight;
            }
        }

        // Apply the weights to compute actual sizes
        let position = 0;
        for (let index = 0; index < weights.length && index < parts.length - 1; index++) {
            const part = parts[index];
            if (!part.isHidden) {
                if (this.orientation === 'vertical') {
                    position += this.options.headerSize;
                }
                const weight = weights[index];
                if (part.collapsed) {
                    if (weight) {
                        part.uncollapsedSize = weight / totalWeight * availableSize;
                    }
                } else {
                    let contentSize = (weight || averageWeight) / totalWeight * availableSize;
                    const minSize = part.minSize;
                    if (contentSize < minSize) {
                        contentSize = minSize;
                    }
                    position += contentSize;
                }
                this.setHandlePosition(index, position);
                position += this.spacing;
            }
        }
    }

    /**
     * Determine the size of the split panel area that is available for widget content,
     * i.e. excluding part headers and split handles.
     */
    getAvailableSize(): number {
        if (!this.parent || !this.parent.isAttached) {
            return 0;
        }
        const parts = this.widgets;
        const visiblePartCount = parts.filter(part => !part.isHidden).length;
        let availableSize: number;
        if (this.orientation === 'horizontal') {
            availableSize = this.parent.node.offsetWidth;
        } else {
            availableSize = this.parent.node.offsetHeight;
            availableSize -= visiblePartCount * this.options.headerSize;
        }
        availableSize -= (visiblePartCount - 1) * this.spacing;
        if (availableSize < 0) {
            return 0;
        }
        return availableSize;
    }

    /**
     * Update a view container part that has been collapsed or expanded. The transition
     * to the new state is animated.
     */
    updateCollapsed(part: ViewContainerPart, enableAnimation: boolean): void {
        const index = this.items.findIndex(item => item.widget === part);
        if (index < 0 || !this.parent || part.isHidden) {
            return;
        }

        // Do not store the height of the "stretched item". Otherwise, we mess up the "hint height".
        // Store the height only if there are other expanded items.
        const currentSize = this.orientation === 'horizontal' ? part.node.offsetWidth : part.node.offsetHeight;
        if (part.collapsed && this.items.some(item => !item.widget.collapsed && !item.widget.isHidden)) {
            part.uncollapsedSize = currentSize;
        }

        if (!enableAnimation || this.options.animationDuration <= 0) {
            MessageLoop.postMessage(this.parent, Widget.Msg.FitRequest);
            return;
        }
        let startTime: number | undefined = undefined;
        const duration = this.options.animationDuration;
        const direction = part.collapsed ? 'collapse' : 'expand';
        let fullSize: number;
        if (direction === 'collapse') {
            fullSize = currentSize - this.options.headerSize;
        } else {
            fullSize = Math.max((part.uncollapsedSize || 0) - this.options.headerSize, part.minSize);
            if (this.items.filter(item => !item.widget.collapsed && !item.widget.isHidden).length === 1) {
                // Expand to full available size
                fullSize = Math.max(fullSize, this.getAvailableSize());
            }
        }

        // The update function is called on every animation frame until the predefined duration has elapsed.
        const updateFunc = (time: number) => {
            if (!this.parent) {
                part.animatedSize = undefined;
                return;
            }
            if (startTime === undefined) {
                startTime = time;
            }
            if (time - startTime < duration) {
                // Render an intermediate state for the animation
                const t = this.tween((time - startTime) / duration);
                if (direction === 'collapse') {
                    part.animatedSize = (1 - t) * fullSize;
                } else {
                    part.animatedSize = t * fullSize;
                }
                requestAnimationFrame(updateFunc);
            } else {
                // The animation is finished
                if (direction === 'collapse') {
                    part.animatedSize = undefined;
                } else {
                    part.animatedSize = fullSize;
                    // Request another frame to reset the part to variable size
                    requestAnimationFrame(() => {
                        part.animatedSize = undefined;
                        if (this.parent) {
                            MessageLoop.sendMessage(this.parent, Widget.Msg.FitRequest);
                        }
                    });
                }
            }
            MessageLoop.sendMessage(this.parent, Widget.Msg.FitRequest);
        };
        requestAnimationFrame(updateFunc);
    }

    protected onFitRequest(msg: Message): void {
        for (const part of this.widgets) {
            const style = part.node.style;
            if (part.animatedSize !== undefined) {
                // The part size has been fixed for animating the transition to collapsed / expanded state
                const fixedSize = `${this.options.headerSize + part.animatedSize}px`;
                style.minHeight = fixedSize;
                style.maxHeight = fixedSize;
            } else if (part.collapsed) {
                // The part size is fixed to the header size
                const fixedSize = `${this.options.headerSize}px`;
                style.minHeight = fixedSize;
                style.maxHeight = fixedSize;
            } else {
                const minSize = `${this.options.headerSize + part.minSize}px`;
                style.minHeight = minSize;
                style.maxHeight = '';
            }
        }
        super.onFitRequest(msg);
    }

    /**
     * Sinusoidal tween function for smooth animation.
     */
    protected tween(t: number): number {
        return 0.5 * (1 - Math.cos(Math.PI * t));
    }

    setHandlePosition(index: number, position: number): Promise<void> {
        const options: SplitPositionOptions = {
            referenceWidget: this.widgets[index],
            duration: 0
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return this.splitPositionHandler.setSplitHandlePosition(this.parent as SplitPanel, index, position, options) as Promise<any>;
    }

}

export namespace ViewContainerLayout {

    export interface Options extends SplitLayout.IOptions {
        headerSize: number;
        animationDuration: number;
    }

    export interface Item {
        readonly widget: ViewContainerPart;
    }

}
