/********************************************************************************
 * Copyright (C) 2017-2018 TypeFox and others.
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

import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import {
    CommonCommands,
    CompositeTreeNode,
    FrontendApplication,
    FrontendApplicationContribution,
    KeybindingRegistry,
    Navigatable,
    OpenerService,
    PreferenceScope,
    PreferenceService,
    SelectableTreeNode,
    SHELL_TABBAR_CONTEXT_MENU,
    Widget,
} from '@theia/core/lib/browser';
import { FileDownloadCommands } from '@theia/filesystem/lib/browser/download/file-download-command-contribution';
import {
    Command,
    CommandRegistry,
    DisposableCollection,
    isOSX,
    MenuModelRegistry,
    MenuPath,
    Mutable,
    isWindows
} from '@theia/core/lib/common';
import {
    DidCreateNewResourceEvent,
    WorkspaceCommandContribution,
    WorkspaceCommands,
    WorkspacePreferences,
    WorkspaceService
} from '@theia/workspace/lib/browser';
import { EXPLORER_VIEW_CONTAINER_ID } from './navigator-widget-factory';
import { FILE_NAVIGATOR_ID, FileNavigatorWidget } from './navigator-widget';
import { FileNavigatorPreferences } from './navigator-preferences';
import { NavigatorKeybindingContexts } from './navigator-keybinding-context';
import { FileNavigatorFilter } from './navigator-filter';
import { WorkspaceNode } from './navigator-tree';
import { NavigatorContextKeyService } from './navigator-context-key-service';
import {
    TabBarToolbarContribution,
    TabBarToolbarItem,
    TabBarToolbarRegistry
} from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { FileSystemCommands } from '@theia/filesystem/lib/browser/filesystem-frontend-contribution';
import { NavigatorDiff, NavigatorDiffCommands } from './navigator-diff';
import { UriSelection } from '@theia/core/lib/common/selection';
import { DirNode, FileNode } from '@theia/filesystem/lib/browser';
import { FileNavigatorModel } from './navigator-model';
import { ClipboardService } from '@theia/core/lib/browser/clipboard-service';
import { SelectionService } from '@theia/core/lib/common/selection-service';
import { UriAwareCommandHandler } from '@theia/core/lib/common/uri-command-handler';
import URI from '@theia/core/lib/common/uri';
import { nls } from '@theia/core/lib/browser/nls';

export namespace FileNavigatorCommands {
    export const REVEAL_IN_NAVIGATOR: Command = {
        id: 'navigator.reveal',
        label: 'Reveal in Explorer'
    };
    export const TOGGLE_HIDDEN_FILES: Command = {
        id: 'navigator.toggle.hidden.files',
        label: 'Toggle Hidden Files'
    };
    export const TOGGLE_AUTO_REVEAL: Command = {
        id: 'navigator.toggle.autoReveal',
        category: 'File',
        label: 'Auto Reveal'
    };
    export const REFRESH_NAVIGATOR: Command = {
        id: 'navigator.refresh',
        category: 'File',
        label: 'Refresh in Explorer',
        iconClass: 'refresh'
    };
    export const COLLAPSE_ALL: Command = {
        id: 'navigator.collapse.all',
        category: 'File',
        label: 'Collapse Folders in Explorer',
        iconClass: 'theia-collapse-all-icon'
    };
    export const ADD_ROOT_FOLDER: Command = {
        id: 'navigator.addRootFolder'
    };
    export const FOCUS: Command = {
        id: 'workbench.files.action.focusFilesExplorer',
        category: 'File',
        label: 'Focus on Files Explorer'
    };
    export const COPY_RELATIVE_FILE_PATH: Command = {
        id: 'navigator.copyRelativeFilePath'
    };
    export const OPEN: Command = {
        id: 'navigator.open',
        category: 'File',
        label: 'Open'
    };
}

/**
 * Navigator `More Actions...` toolbar item groups.
 * Used in order to group items present in the toolbar.
 */
export namespace NavigatorMoreToolbarGroups {
    export const NEW_OPEN = '1_navigator_new_open';
    export const TOOLS = '2_navigator_tools';
    export const WORKSPACE = '3_navigator_workspace';
}

export const NAVIGATOR_CONTEXT_MENU: MenuPath = ['navigator-context-menu'];

/**
 * Navigator context menu default groups should be aligned
 * with VS Code default groups: https://code.visualstudio.com/api/references/contribution-points#contributes.menus
 */
export namespace NavigatorContextMenu {
    export const NAVIGATION = [...NAVIGATOR_CONTEXT_MENU, 'navigation'];
    /** @deprecated use NAVIGATION */
    export const OPEN = NAVIGATION;
    /** @deprecated use NAVIGATION */
    export const NEW = NAVIGATION;

    export const WORKSPACE = [...NAVIGATOR_CONTEXT_MENU, '2_workspace'];

    export const COMPARE = [...NAVIGATOR_CONTEXT_MENU, '3_compare'];
    /** @deprecated use COMPARE */
    export const DIFF = COMPARE;

    export const SEARCH = [...NAVIGATOR_CONTEXT_MENU, '4_search'];
    export const CLIPBOARD = [...NAVIGATOR_CONTEXT_MENU, '5_cutcopypaste'];

    export const MODIFICATION = [...NAVIGATOR_CONTEXT_MENU, '7_modification'];
    /** @deprecated use MODIFICATION */
    export const MOVE = MODIFICATION;
    /** @deprecated use MODIFICATION */
    export const ACTIONS = MODIFICATION;

    export const OPEN_WITH = [...NAVIGATION, 'open_with'];
}

export const FILE_NAVIGATOR_TOGGLE_COMMAND_ID = 'fileNavigator:toggle';

@injectable()
export class FileNavigatorContribution extends AbstractViewContribution<FileNavigatorWidget> implements FrontendApplicationContribution, TabBarToolbarContribution {

    @inject(ClipboardService)
    protected readonly clipboardService: ClipboardService;

    @inject(CommandRegistry)
    protected readonly commandRegistry: CommandRegistry;

    @inject(TabBarToolbarRegistry)
    protected readonly tabbarToolbarRegistry: TabBarToolbarRegistry;

    @inject(NavigatorContextKeyService)
    protected readonly contextKeyService: NavigatorContextKeyService;

    @inject(MenuModelRegistry)
    protected readonly menuRegistry: MenuModelRegistry;

    @inject(NavigatorDiff)
    protected readonly navigatorDiff: NavigatorDiff;

    @inject(PreferenceService)
    protected readonly preferenceService: PreferenceService;

    @inject(SelectionService)
    protected readonly selectionService: SelectionService;

    @inject(WorkspaceCommandContribution)
    protected readonly workspaceCommandContribution: WorkspaceCommandContribution;

    constructor(
        @inject(FileNavigatorPreferences) protected readonly fileNavigatorPreferences: FileNavigatorPreferences,
        @inject(OpenerService) protected readonly openerService: OpenerService,
        @inject(FileNavigatorFilter) protected readonly fileNavigatorFilter: FileNavigatorFilter,
        @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService,
        @inject(WorkspacePreferences) protected readonly workspacePreferences: WorkspacePreferences
    ) {
        super({
            viewContainerId: EXPLORER_VIEW_CONTAINER_ID,
            widgetId: FILE_NAVIGATOR_ID,
            widgetName: 'Explorer',
            defaultWidgetOptions: {
                area: 'left',
                rank: 100
            },
            toggleCommandId: FILE_NAVIGATOR_TOGGLE_COMMAND_ID,
            toggleKeybinding: 'ctrlcmd+shift+e'
        });
    }

    @postConstruct()
    protected async init(): Promise<void> {
        await this.fileNavigatorPreferences.ready;
        this.shell.currentChanged.connect(() => this.onCurrentWidgetChangedHandler());

        const updateFocusContextKeys = () => {
            const hasFocus = this.shell.activeWidget instanceof FileNavigatorWidget;
            this.contextKeyService.explorerViewletFocus.set(hasFocus);
            this.contextKeyService.filesExplorerFocus.set(hasFocus);
        };
        updateFocusContextKeys();
        this.shell.activeChanged.connect(updateFocusContextKeys);
        this.workspaceCommandContribution.onDidCreateNewFile(async event => this.onDidCreateNewResource(event));
        this.workspaceCommandContribution.onDidCreateNewFolder(async event => this.onDidCreateNewResource(event));
    }

    private async onDidCreateNewResource(event: DidCreateNewResourceEvent): Promise<void> {
        const navigator = this.tryGetWidget();
        if (!navigator || !navigator.isVisible) {
            return;
        }
        const model: FileNavigatorModel = navigator.model;
        const parent = await model.revealFile(event.parent);
        if (DirNode.is(parent)) {
            await model.refresh(parent);
        }
        const node = await model.revealFile(event.uri);
        if (SelectableTreeNode.is(node)) {
            model.selectNode(node);
            if (DirNode.is(node)) {
                this.openView({ activate: true });
            }
        }
    }

    async onStart(app: FrontendApplication): Promise<void> {
        this.workspacePreferences.ready.then(() => {
            this.updateAddRemoveFolderActions(this.menuRegistry);
            this.workspacePreferences.onPreferenceChanged(change => {
                if (change.preferenceName === 'workspace.supportMultiRootWorkspace') {
                    this.updateAddRemoveFolderActions(this.menuRegistry);
                }
            });
        });
    }

    async initializeLayout(app: FrontendApplication): Promise<void> {
        await this.openView();
    }

    registerCommands(registry: CommandRegistry): void {
        super.registerCommands(registry);
        registry.registerCommand(FileNavigatorCommands.FOCUS, {
            execute: () => this.openView({ activate: true })
        });
        registry.registerCommand(FileNavigatorCommands.REVEAL_IN_NAVIGATOR, {
            execute: (event?: Event) => {
                const widget = this.shell.findTargetedWidget(event);
                this.openView({ activate: true }).then(() => this.selectWidgetFileNode(widget || this.shell.currentWidget));
            },
            isEnabled: (event?: Event) => {
                const widget = this.shell.findTargetedWidget(event);
                return widget ? Navigatable.is(widget) : Navigatable.is(this.shell.currentWidget);
            },
            isVisible: (event?: Event) => {
                const widget = this.shell.findTargetedWidget(event);
                return widget ? Navigatable.is(widget) : Navigatable.is(this.shell.currentWidget);
            }
        });
        registry.registerCommand(FileNavigatorCommands.TOGGLE_HIDDEN_FILES, {
            execute: () => {
                this.fileNavigatorFilter.toggleHiddenFiles();
            },
            isEnabled: () => true,
            isVisible: () => true
        });
        registry.registerCommand(FileNavigatorCommands.TOGGLE_AUTO_REVEAL, {
            isEnabled: widget => this.withWidget(widget, () => this.workspaceService.opened),
            isVisible: widget => this.withWidget(widget, () => this.workspaceService.opened),
            execute: () => {
                const autoReveal = !this.fileNavigatorPreferences['explorer.autoReveal'];
                this.preferenceService.set('explorer.autoReveal', autoReveal, PreferenceScope.User);
                if (autoReveal) {
                    this.selectWidgetFileNode(this.shell.currentWidget);
                }
            },
            isToggled: () => this.fileNavigatorPreferences['explorer.autoReveal']
        });
        registry.registerCommand(FileNavigatorCommands.COLLAPSE_ALL, {
            execute: widget => this.withWidget(widget, () => this.collapseFileNavigatorTree()),
            isEnabled: widget => this.withWidget(widget, () => this.workspaceService.opened),
            isVisible: widget => this.withWidget(widget, () => this.workspaceService.opened)
        });
        registry.registerCommand(FileNavigatorCommands.REFRESH_NAVIGATOR, {
            execute: widget => this.withWidget(widget, () => this.refreshWorkspace()),
            isEnabled: widget => this.withWidget(widget, () => this.workspaceService.opened),
            isVisible: widget => this.withWidget(widget, () => this.workspaceService.opened)
        });
        registry.registerCommand(FileNavigatorCommands.ADD_ROOT_FOLDER, {
            execute: (...args) => registry.executeCommand(WorkspaceCommands.ADD_FOLDER.id, ...args),
            isEnabled: (...args) => registry.isEnabled(WorkspaceCommands.ADD_FOLDER.id, ...args),
            isVisible: (...args) => {
                if (!registry.isVisible(WorkspaceCommands.ADD_FOLDER.id, ...args)) {
                    return false;
                }
                const navigator = this.tryGetWidget();
                const model = navigator && navigator.model;
                const uris = UriSelection.getUris(model && model.selectedNodes);
                return this.workspaceService.areWorkspaceRoots(uris);
            }
        });

        registry.registerCommand(NavigatorDiffCommands.COMPARE_FIRST, {
            execute: () => {
                this.navigatorDiff.addFirstComparisonFile();
            },
            isEnabled: () => true,
            isVisible: () => true
        });
        registry.registerCommand(NavigatorDiffCommands.COMPARE_SECOND, {
            execute: () => {
                this.navigatorDiff.compareFiles();
            },
            isEnabled: () => this.navigatorDiff.isFirstFileSelected,
            isVisible: () => this.navigatorDiff.isFirstFileSelected
        });
        registry.registerCommand(FileNavigatorCommands.COPY_RELATIVE_FILE_PATH, UriAwareCommandHandler.MultiSelect(this.selectionService, {
            isEnabled: uris => !!uris.length,
            isVisible: uris => !!uris.length,
            execute: async uris => {
                const lineDelimiter = isWindows ? '\r\n' : '\n';
                const text = uris.map((uri: URI) => {
                    const workspaceRoot = this.workspaceService.getWorkspaceRootUri(uri);
                    if (workspaceRoot) {
                        return workspaceRoot.relative(uri);
                    }
                }).join(lineDelimiter);
                await this.clipboardService.writeText(text);
            }
        }));
        registry.registerCommand(FileNavigatorCommands.OPEN, {
            isEnabled: () => this.getSelectedFileNodes().length > 0,
            isVisible: () => this.getSelectedFileNodes().length > 0,
            execute: () => {
                this.getSelectedFileNodes().forEach(async node => {
                    const opener = await this.openerService.getOpener(node.uri);
                    opener.open(node.uri);
                });
            }
        });
    }

    protected getSelectedFileNodes(): FileNode[] {
        return this.tryGetWidget()?.model.selectedNodes.filter(FileNode.is) || [];
    }

    protected withWidget<T>(widget: Widget | undefined = this.tryGetWidget(), cb: (navigator: FileNavigatorWidget) => T): T | false {
        if (widget instanceof FileNavigatorWidget && widget.id === FILE_NAVIGATOR_ID) {
            return cb(widget);
        }
        return false;
    }

    registerMenus(registry: MenuModelRegistry): void {
        super.registerMenus(registry);
        registry.registerMenuAction(SHELL_TABBAR_CONTEXT_MENU, {
            commandId: FileNavigatorCommands.REVEAL_IN_NAVIGATOR.id,
            label: FileNavigatorCommands.REVEAL_IN_NAVIGATOR.label,
            order: '5'
        });

        registry.registerMenuAction(NavigatorContextMenu.NAVIGATION, {
            commandId: FileNavigatorCommands.OPEN.id,
            label: 'Open'
        });
        registry.registerSubmenu(NavigatorContextMenu.OPEN_WITH, 'Open With');
        this.openerService.getOpeners().then(openers => {
            for (const opener of openers) {
                const openWithCommand = WorkspaceCommands.FILE_OPEN_WITH(opener);
                registry.registerMenuAction(NavigatorContextMenu.OPEN_WITH, {
                    commandId: openWithCommand.id,
                    label: opener.label,
                    icon: opener.iconClass
                });
            }
        });

        // registry.registerMenuAction([CONTEXT_MENU_PATH, CUT_MENU_GROUP], {
        //     commandId: Commands.FILE_CUT
        // });

        registry.registerMenuAction(NavigatorContextMenu.CLIPBOARD, {
            commandId: CommonCommands.COPY.id,
            order: 'a'
        });
        registry.registerMenuAction(NavigatorContextMenu.CLIPBOARD, {
            commandId: CommonCommands.PASTE.id,
            order: 'b'
        });
        registry.registerMenuAction(NavigatorContextMenu.CLIPBOARD, {
            commandId: CommonCommands.COPY_PATH.id,
            order: 'c'
        });
        registry.registerMenuAction(NavigatorContextMenu.CLIPBOARD, {
            commandId: FileNavigatorCommands.COPY_RELATIVE_FILE_PATH.id,
            label: nls.localize('vscode/fileActions.contribution/copyRelativePath', 'Copy Relative Path'),
            order: 'd'
        });
        registry.registerMenuAction(NavigatorContextMenu.CLIPBOARD, {
            commandId: FileDownloadCommands.COPY_DOWNLOAD_LINK.id,
            order: 'z'
        });

        registry.registerMenuAction(NavigatorContextMenu.MODIFICATION, {
            commandId: WorkspaceCommands.FILE_RENAME.id
        });
        registry.registerMenuAction(NavigatorContextMenu.MODIFICATION, {
            commandId: WorkspaceCommands.FILE_DELETE.id
        });
        registry.registerMenuAction(NavigatorContextMenu.MODIFICATION, {
            commandId: WorkspaceCommands.FILE_DUPLICATE.id
        });

        const downloadUploadMenu = [...NAVIGATOR_CONTEXT_MENU, '6_downloadupload'];
        registry.registerMenuAction(downloadUploadMenu, {
            commandId: FileSystemCommands.UPLOAD.id,
            order: 'a'
        });
        registry.registerMenuAction(downloadUploadMenu, {
            commandId: FileDownloadCommands.DOWNLOAD.id,
            order: 'b'
        });

        registry.registerMenuAction(NavigatorContextMenu.NAVIGATION, {
            commandId: WorkspaceCommands.NEW_FILE.id
        });
        registry.registerMenuAction(NavigatorContextMenu.NAVIGATION, {
            commandId: WorkspaceCommands.NEW_FOLDER.id
        });
        registry.registerMenuAction(NavigatorContextMenu.COMPARE, {
            commandId: WorkspaceCommands.FILE_COMPARE.id
        });
        registry.registerMenuAction(NavigatorContextMenu.MODIFICATION, {
            commandId: FileNavigatorCommands.COLLAPSE_ALL.id,
            label: nls.localize('vscode/treeView/collapseAll', 'Collapse All'),
            order: 'z2'
        });

        registry.registerMenuAction(NavigatorContextMenu.COMPARE, {
            commandId: NavigatorDiffCommands.COMPARE_FIRST.id,
            order: 'za'
        });
        registry.registerMenuAction(NavigatorContextMenu.COMPARE, {
            commandId: NavigatorDiffCommands.COMPARE_SECOND.id,
            order: 'zb'
        });
    }

    registerKeybindings(registry: KeybindingRegistry): void {
        super.registerKeybindings(registry);
        registry.registerKeybinding({
            command: FileNavigatorCommands.REVEAL_IN_NAVIGATOR.id,
            keybinding: 'alt+r'
        });

        registry.registerKeybinding({
            command: WorkspaceCommands.FILE_DELETE.id,
            keybinding: isOSX ? 'cmd+backspace' : 'del',
            context: NavigatorKeybindingContexts.navigatorActive
        });

        registry.registerKeybinding({
            command: WorkspaceCommands.FILE_RENAME.id,
            keybinding: 'f2',
            context: NavigatorKeybindingContexts.navigatorActive
        });

        registry.registerKeybinding({
            command: FileNavigatorCommands.TOGGLE_HIDDEN_FILES.id,
            keybinding: 'ctrlcmd+i',
            context: NavigatorKeybindingContexts.navigatorActive
        });

        registry.registerKeybinding({
            command: FileNavigatorCommands.COPY_RELATIVE_FILE_PATH.id,
            keybinding: isWindows ? 'ctrl+k ctrl+shift+c' : 'ctrlcmd+shift+alt+c',
            when: '!editorFocus'
        });
    }

    async registerToolbarItems(toolbarRegistry: TabBarToolbarRegistry): Promise<void> {
        toolbarRegistry.registerItem({
            id: FileNavigatorCommands.REFRESH_NAVIGATOR.id,
            command: FileNavigatorCommands.REFRESH_NAVIGATOR.id,
            tooltip: nls.localize('vscode/explorerView/refreshExplorer', 'Refresh Explorer'),
            priority: 0,
        });
        toolbarRegistry.registerItem({
            id: FileNavigatorCommands.COLLAPSE_ALL.id,
            command: FileNavigatorCommands.COLLAPSE_ALL.id,
            tooltip: nls.localize('vscode/explorerView/collapseExplorerFolders', 'Collapse All'),
            priority: 1,
        });
        this.registerMoreToolbarItem({
            id: WorkspaceCommands.NEW_FILE.id,
            command: WorkspaceCommands.NEW_FILE.id,
            tooltip: WorkspaceCommands.NEW_FILE.label,
            group: NavigatorMoreToolbarGroups.NEW_OPEN,
        });
        this.registerMoreToolbarItem({
            id: WorkspaceCommands.NEW_FOLDER.id,
            command: WorkspaceCommands.NEW_FOLDER.id,
            tooltip: WorkspaceCommands.NEW_FOLDER.label,
            group: NavigatorMoreToolbarGroups.NEW_OPEN,
        });
        this.registerMoreToolbarItem({
            id: FileNavigatorCommands.TOGGLE_AUTO_REVEAL.id,
            command: FileNavigatorCommands.TOGGLE_AUTO_REVEAL.id,
            tooltip: FileNavigatorCommands.TOGGLE_AUTO_REVEAL.label,
            group: NavigatorMoreToolbarGroups.TOOLS,
        });
        this.registerMoreToolbarItem({
            id: WorkspaceCommands.ADD_FOLDER.id,
            command: WorkspaceCommands.ADD_FOLDER.id,
            tooltip: WorkspaceCommands.ADD_FOLDER.label,
            group: NavigatorMoreToolbarGroups.WORKSPACE,
        });
    }

    /**
     * Register commands to the `More Actions...` navigator toolbar item.
     */
    public registerMoreToolbarItem = (item: Mutable<TabBarToolbarItem>) => {
        const commandId = item.command;
        const id = 'navigator.tabbar.toolbar.' + commandId;
        const command = this.commandRegistry.getCommand(commandId);
        this.commandRegistry.registerCommand({ id, iconClass: command && command.iconClass }, {
            execute: (w, ...args) => w instanceof FileNavigatorWidget
                && this.commandRegistry.executeCommand(commandId, ...args),
            isEnabled: (w, ...args) => w instanceof FileNavigatorWidget
                && this.commandRegistry.isEnabled(commandId, ...args),
            isVisible: (w, ...args) => w instanceof FileNavigatorWidget
                && this.commandRegistry.isVisible(commandId, ...args),
            isToggled: (w, ...args) => w instanceof FileNavigatorWidget
                && this.commandRegistry.isToggled(commandId, ...args),
        });
        item.command = id;
        this.tabbarToolbarRegistry.registerItem(item);
    };

    /**
     * Reveals and selects node in the file navigator to which given widget is related.
     * Does nothing if given widget undefined or doesn't have related resource.
     *
     * @param widget widget file resource of which should be revealed and selected
     */
    async selectWidgetFileNode(widget: Widget | undefined): Promise<void> {
        if (Navigatable.is(widget)) {
            const resourceUri = widget.getResourceUri();
            if (resourceUri) {
                const { model } = await this.widget;
                const node = await model.revealFile(resourceUri);
                if (SelectableTreeNode.is(node)) {
                    model.selectNode(node);
                }
            }
        }
    }

    protected onCurrentWidgetChangedHandler(): void {
        if (this.fileNavigatorPreferences['explorer.autoReveal']) {
            this.selectWidgetFileNode(this.shell.currentWidget);
        }
    }

    /**
     * Collapse file navigator nodes and set focus on first visible node
     * - single root workspace: collapse all nodes except root
     * - multiple root workspace: collapse all nodes, even roots
     */
    async collapseFileNavigatorTree(): Promise<void> {
        const { model } = await this.widget;

        // collapse all child nodes which are not the root (single root workspace)
        // collapse all root nodes (multiple root workspace)
        let root = model.root as CompositeTreeNode;
        if (WorkspaceNode.is(root) && root.children.length === 1) {
            root = root.children[0];
        }
        root.children.forEach(child => CompositeTreeNode.is(child) && model.collapseAll(child));

        // select first visible node
        const firstChild = WorkspaceNode.is(root) ? root.children[0] : root;
        if (SelectableTreeNode.is(firstChild)) {
            model.selectNode(firstChild);
        }
    }

    /**
     * force refresh workspace in navigator
     */
    async refreshWorkspace(): Promise<void> {
        const { model } = await this.widget;
        await model.refresh();
    }

    private readonly toDisposeAddRemoveFolderActions = new DisposableCollection();
    private updateAddRemoveFolderActions(registry: MenuModelRegistry): void {
        this.toDisposeAddRemoveFolderActions.dispose();
        if (this.workspacePreferences['workspace.supportMultiRootWorkspace']) {
            this.toDisposeAddRemoveFolderActions.push(registry.registerMenuAction(NavigatorContextMenu.WORKSPACE, {
                commandId: FileNavigatorCommands.ADD_ROOT_FOLDER.id,
                label: WorkspaceCommands.ADD_FOLDER.label!
            }));
            this.toDisposeAddRemoveFolderActions.push(registry.registerMenuAction(NavigatorContextMenu.WORKSPACE, {
                commandId: WorkspaceCommands.REMOVE_FOLDER.id
            }));
        }
    }

}
