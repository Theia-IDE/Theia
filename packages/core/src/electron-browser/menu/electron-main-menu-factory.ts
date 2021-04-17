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

import * as electron from '../../../shared/electron';
import { inject, injectable } from 'inversify';
import {
    CommandRegistry, isOSX, ActionMenuNode, CompositeMenuNode,
    MAIN_MENU_BAR, MenuModelRegistry, MenuPath, MenuNode,
    DisposableCollection,
    CommandState
} from '../../common';
import { Keybinding } from '../../common/keybinding';
import { PreferenceService, KeybindingRegistry, CommonCommands } from '../../browser';
import { ContextKeyService } from '../../browser/context-key-service';
import debounce = require('lodash.debounce');
import { ContextMenuContext } from '../../browser/menu/context-menu-context';

/**
 * Representation of possible electron menu options.
 */
export interface ElectronMenuOptions {
    /**
     * Controls whether to render disabled menu items.
     * Defaults to `true`.
     */
    readonly showDisabled?: boolean;

    /**
     * Legacy menu contributions may be untrackable, meaning the isVisible and isEnabled
     * state may change and we won't be notified.  In some cases this is ok, for example
     * in a context menu this is ok because the menu is rebuilt each time it is shown.
     * However for items in the main menu this means we cannot update the menu and we must
     * therefore always show the menu item as visible and enabled.
     * Defaults to `false`.
     */
    untrackableAlwaysActive?: boolean;
}

export interface MenuItemTracker {
    node: ActionMenuNode;
    visible: boolean;
    enabled: boolean;
}

/**
 * Define the action of the menu item, when specified the `click` property will
 * be ignored. See [roles](https://www.electronjs.org/docs/api/menu-item#roles).
 */
export type ElectronMenuItemRole = ('undo' | 'redo' | 'cut' | 'copy' | 'paste' |
    'pasteAndMatchStyle' | 'delete' | 'selectAll' | 'reload' | 'forceReload' |
    'toggleDevTools' | 'resetZoom' | 'zoomIn' | 'zoomOut' | 'togglefullscreen' |
    'window' | 'minimize' | 'close' | 'help' | 'about' |
    'services' | 'hide' | 'hideOthers' | 'unhide' | 'quit' |
    'startSpeaking' | 'stopSpeaking' | 'zoom' | 'front' | 'appMenu' |
    'fileMenu' | 'editMenu' | 'viewMenu' | 'recentDocuments' | 'toggleTabBar' |
    'selectNextTab' | 'selectPreviousTab' | 'mergeAllWindows' | 'clearRecentDocuments' |
    'moveTabToNewWindow' | 'windowMenu');

@injectable()
export class ElectronMainMenuFactory {

    protected _menu: Electron.Menu | undefined;
    protected readonly toDisposeOnMenuRecreation = new DisposableCollection();
    protected _toggledCommands: Set<string> = new Set();

    @inject(ContextKeyService)
    protected readonly contextKeyService: ContextKeyService;

    @inject(ContextMenuContext)
    protected readonly context: ContextMenuContext;

    constructor(
        @inject(CommandRegistry) protected readonly commandRegistry: CommandRegistry,
        @inject(PreferenceService) protected readonly preferencesService: PreferenceService,
        @inject(MenuModelRegistry) protected readonly menuProvider: MenuModelRegistry,
        @inject(KeybindingRegistry) protected readonly keybindingRegistry: KeybindingRegistry
    ) {
        const thisFactory = this;
        preferencesService.onPreferenceChanged(debounce(() => {
            if (thisFactory._menu) {
                for (const item of this._toggledCommands) {
                    thisFactory._menu.getMenuItemById(item).checked = this.commandRegistry.isToggled(item);
                }
                electron.remote.getCurrentWindow().setMenu(thisFactory._menu);
            }
        }, 10));
        keybindingRegistry.onKeybindingsChanged(() => {
            const createdMenuBar = this.createMenuBar();
            this.setMenu(createdMenuBar);
        });
    }

    createMenuBar(): Electron.Menu {
        this.toDisposeOnMenuRecreation.dispose();
        const menuModel = this.menuProvider.getMenu(MAIN_MENU_BAR);
        const template = this.fillMenuTemplate([], menuModel, [], { untrackableAlwaysActive: true });
        if (isOSX) {
            template.unshift(this.createOSXMenu());
        }
        const menu = electron.remote.Menu.buildFromTemplate(template);
        this._menu = menu;
        return menu;
    }

    createContextMenu(menuPath: MenuPath, args?: any[]): Electron.Menu {
        const menuModel = this.menuProvider.getMenu(menuPath);
        const template = this.fillMenuTemplate([], menuModel, args, { showDisabled: false, untrackableAlwaysActive: false });
        return electron.remote.Menu.buildFromTemplate(template);
    }

    protected setMenu = debounce((createdMenuBar: Electron.Menu) => {
        if (isOSX) {
            electron.remote.Menu.setApplicationMenu(createdMenuBar);
        } else {
            electron.remote.getCurrentWindow().setMenu(createdMenuBar);
        }
    }, 10);

    protected fillMenuTemplate(items: Electron.MenuItemConstructorOptions[],
        menuModel: CompositeMenuNode,
        args: any[] = [],
        options?: ElectronMenuOptions
    ): Electron.MenuItemConstructorOptions[] {
        const untrackableAlwaysActive = options ? !!options.untrackableAlwaysActive : false;

        for (const menu of menuModel.children) {
            if (menu instanceof CompositeMenuNode) {
                if (menu.children.length > 0) {
                    // do not render empty nodes

                    if (menu.isSubmenu) { // submenu node

                        const submenu = this.fillMenuTemplate([], menu, args, options);
                        if (submenu.length === 0) {
                            continue;
                        }

                        items.push({
                            label: menu.label,
                            submenu
                        });

                    } else { // group node

                        // process children
                        const submenu = this.fillMenuTemplate([], menu, args, options);
                        if (submenu.length === 0) {
                            continue;
                        }

                        if (items.length > 0) {
                            // do not put a separator above the first group

                            items.push({
                                type: 'separator'
                            });
                        }

                        // render children
                        items.push(...submenu);
                    }
                }
            } else if (menu instanceof ActionMenuNode) {
                const node = menu.altNode && this.context.altPressed ? menu.altNode : menu;
                const commandId = node.action.commandId;

                // That is only a sanity check at application startup.
                if (!this.commandRegistry.getCommand(commandId)) {
                    throw new Error(`Unknown command with ID: ${commandId}.`);
                }

                const stateTracker = this.commandRegistry.trackActiveState(commandId, ...args);
                this.toDisposeOnMenuRecreation.push(stateTracker);

                const bindings = this.keybindingRegistry.getKeybindingsForCommand(commandId);

                let accelerator;

                /* Only consider the first keybinding. */
                if (bindings.length > 0) {
                    const binding = bindings[0];
                    accelerator = this.acceleratorFor(binding);
                }

                const itemTracker = {
                    node,
                    enabled: this.isMenuItemEnabled(node, stateTracker.value, options),
                    visible: this.isMenuItemVisible(node, stateTracker.value, options),
                };

                const menuItem = {
                    id: node.id,
                    label: node.label,
                    type: this.commandRegistry.getToggledHandler(commandId, ...args) ? 'checkbox' : 'normal',
                    checked: this.commandRegistry.isToggled(commandId, ...args),
                    enabled: (untrackableAlwaysActive && stateTracker.untrackable) || itemTracker.enabled,
                    visible: (untrackableAlwaysActive && stateTracker.untrackable) || itemTracker.visible,
                    accelerator,
                    click: () => this.execute(commandId, args)
                } as Electron.MenuItemConstructorOptions;

                if (isOSX) {
                    const role = this.roleFor(node.id);
                    if (role) {
                        menuItem.role = role;
                        delete menuItem.click;
                    }
                }

                stateTracker.onChange(v => this.updateMenuItemState(itemTracker, v, options));

                items.push(menuItem);

                if (this.commandRegistry.getToggledHandler(commandId, ...args)) {
                    this._toggledCommands.add(commandId);
                }
            } else {
                items.push(...this.handleDefault(menu, args, options));
            }
        }
        return items;
    }

    protected updateMenuItemState(item: MenuItemTracker, menuItemState: CommandState, options?: ElectronMenuOptions): void {
        // The menu will most likely have been built by the time the first change comes in, but just
        // in case not, update the menu item options before updating the menu itself.
        const visible = this.isMenuItemVisible(item.node, menuItemState, options);
        const enabled = this.isMenuItemEnabled(item.node, menuItemState, options);
        if (item.visible !== visible || item.enabled !== enabled) {
            item.visible = visible;
            item.enabled = enabled;
            if (this._menu) {
                const menuItem = this._menu.getMenuItemById(item.node.id);
                menuItem.visible = visible;
                menuItem.enabled = enabled;
                this.setMenu(this._menu);
            }
        }
    }

    protected isMenuItemVisible(node: ActionMenuNode, menuItemState: CommandState, options?: ElectronMenuOptions): boolean {
        // We should omit rendering context-menu items which are disabled.
        const showDisabled = (options?.showDisabled === undefined) ? true : options.showDisabled;
        return menuItemState !== CommandState.Hidden
            && (showDisabled || menuItemState === CommandState.Active)
            && (!node.action.when || this.contextKeyService.match(node.action.when));
    }

    protected isMenuItemEnabled(node: ActionMenuNode, menuItemState: CommandState, options?: ElectronMenuOptions): boolean {
        return menuItemState === CommandState.Active;
    }

    protected handleDefault(menuNode: MenuNode, args: any[] = [], options?: ElectronMenuOptions): Electron.MenuItemConstructorOptions[] {
        return [];
    }

    /**
     * Return a user visible representation of a keybinding.
     */
    protected acceleratorFor(keybinding: Keybinding): string {
        const bindingKeySequence = this.keybindingRegistry.resolveKeybinding(keybinding);
        // FIXME see https://github.com/electron/electron/issues/11740
        // Key Sequences can't be represented properly in the electron menu.
        //
        // We can do what VS Code does, and append the chords as a suffix to the menu label.
        // https://github.com/eclipse-theia/theia/issues/1199#issuecomment-430909480
        if (bindingKeySequence.length > 1) {
            return '';
        }

        const keyCode = bindingKeySequence[0];
        return this.keybindingRegistry.acceleratorForKeyCode(keyCode, '+');
    }

    protected roleFor(id: string): ElectronMenuItemRole | undefined {
        let role: ElectronMenuItemRole | undefined;
        switch (id) {
            case CommonCommands.UNDO.id:
                role = 'undo';
                break;
            case CommonCommands.REDO.id:
                role = 'redo';
                break;
            case CommonCommands.CUT.id:
                role = 'cut';
                break;
            case CommonCommands.COPY.id:
                role = 'copy';
                break;
            case CommonCommands.PASTE.id:
                role = 'paste';
                break;
            case CommonCommands.SELECT_ALL.id:
                role = 'selectAll';
                break;
            default:
                break;
        }
        return role;
    }

    protected async execute(command: string, args: any[]): Promise<void> {
        try {
            // This is workaround for https://github.com/eclipse-theia/theia/issues/446.
            // Electron menus do not always update based on the `isEnabled`, `isVisible` property of the command.
            // We need to check if we can execute it.
            if (this.commandRegistry.isEnabled(command, ...args)) {
                await this.commandRegistry.executeCommand(command, ...args);
                if (this._menu && this.commandRegistry.isVisible(command, ...args)) {
                    this._menu.getMenuItemById(command).checked = this.commandRegistry.isToggled(command, ...args);
                    electron.remote.getCurrentWindow().setMenu(this._menu);
                }
            }
        } catch {
            // no-op
        }
    }

    protected createOSXMenu(): Electron.MenuItemConstructorOptions {
        return {
            label: 'Theia',
            submenu: [
                {
                    role: 'about'
                },
                {
                    type: 'separator'
                },
                {
                    role: 'services',
                    submenu: []
                },
                {
                    type: 'separator'
                },
                {
                    role: 'hide'
                },
                {
                    role: 'hideOthers'
                },
                {
                    role: 'unhide'
                },
                {
                    type: 'separator'
                },
                {
                    role: 'quit'
                }
            ]
        };
    }

}
