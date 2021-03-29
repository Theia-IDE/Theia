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

import { injectable, inject, named } from 'inversify';
import { Disposable } from './disposable';
import { CommandRegistry, Command } from './command';
import { ContributionProvider } from './contribution-provider';

/**
 * A menu entry representing an action, e.g. "New File".
 */
export interface MenuAction {
    /**
     * The command to execute.
     */
    commandId: string
    /**
     * In addition to the mandatory command property, an alternative command can be defined.
     * It will be shown and invoked when pressing Alt while opening a menu.
     */
    alt?: string;
    /**
     * A specific label for this action. If not specified the command label or command id will be used.
     */
    label?: string
    /**
     * Icon class(es). If not specified the icon class associated with the specified command
     * (i.e. `command.iconClass`) will be used if it exists.
     */
    icon?: string
    /**
     * Menu entries are sorted in ascending order based on their `order` strings. If omitted the determined
     * label will be used instead.
     */
    order?: string
    /**
     * Optional expression which will be evaluated by the {@link ContextKeyService} to determine visibility
     * of the action, e.g. `resourceLangId == markdown`.
     */
    when?: string
}

export namespace MenuAction {
    /* Determine whether object is a MenuAction */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function is(arg: MenuAction | any): arg is MenuAction {
        return !!arg && arg === Object(arg) && 'commandId' in arg;
    }
}

/**
 * Additional options when creating a new submenu.
 */
export interface SubMenuOptions {
    /**
     * The class to use for the submenu icon.
     */
    iconClass?: string
    /**
     * Menu entries are sorted in ascending order based on their `order` strings. If omitted the determined
     * label will be used instead.
     */
    order?: string
}

export type MenuPath = string[];

export const MAIN_MENU_BAR: MenuPath = ['menubar'];

export const SETTINGS_MENU: MenuPath = ['settings_menu'];
export const ACCOUNTS_MENU: MenuPath = ['accounts_menu'];
export const ACCOUNTS_SUBMENU = [...ACCOUNTS_MENU, '1_accounts_submenu'];

export const MenuContribution = Symbol('MenuContribution');

/**
 * Representation of a menu contribution.
 *
 * Note that there are also convenience classes which combine multiple contributions into one.
 * For example to register a view together with a menu and keybinding you could use
 * {@link AbstractViewContribution} instead.
 *
 * ### Example usage
 *
 * ```ts
 * import { MenuContribution, MenuModelRegistry, MAIN_MENU_BAR } from '@theia/core';
 *
 * @injectable()
 * export class NewMenuContribution implements MenuContribution {
 *    registerMenus(menus: MenuModelRegistry): void {
 *         const menuPath = [...MAIN_MENU_BAR, '99_mymenu'];
 *         menus.registerSubmenu(menuPath, 'My Menu');
 *
 *         menus.registerMenuAction(menuPath, {
 *            commandId: MyCommand.id,
 *            label: 'My Action'
 *         });
 *     }
 * }
 * ```
 */
export interface MenuContribution {
    /**
     * Registers menus.
     * @param menus the menu model registry.
     */
    registerMenus(menus: MenuModelRegistry): void;
}

@injectable()
export class MenuNodeFactory {

    constructor(@inject(CommandRegistry) protected readonly commands: CommandRegistry) { }

    createCompositeNode({ id, label, options }: { id: string, label?: string, options?: SubMenuOptions }): CompositeMenuNode {
        return new CompositeMenuNode(id, label, options);
    }

    createActionNode(menuAction: MenuAction): ActionMenuNode {
        return new ActionMenuNode(menuAction, this.commands, this);
    }

}

/**
 * The MenuModelRegistry allows to register and unregister menus, submenus and actions
 * via strings and {@link MenuAction}s without the need to access the underlying UI
 * representation.
 */
@injectable()
export class MenuModelRegistry {

    protected readonly root: CompositeMenuNode;

    constructor(
        @inject(ContributionProvider) @named(MenuContribution) protected readonly contributions: ContributionProvider<MenuContribution>,
        @inject(CommandRegistry) protected readonly commands: CommandRegistry,
        @inject(MenuNodeFactory) protected readonly menuFactory: MenuNodeFactory
    ) {
        this.root = this.menuFactory.createCompositeNode({ id: '' });
    }

    onStart(): void {
        for (const contrib of this.contributions.getContributions()) {
            contrib.registerMenus(this);
        }
    }

    /**
     * Adds the given menu action to the menu denoted by the given path.
     *
     * @returns a disposable which, when called, will remove the menu action again.
     */
    registerMenuAction(menuPath: MenuPath, item: MenuAction): Disposable {
        const menuNode = this.menuFactory.createActionNode(item);
        return this.registerMenuNode(menuPath, menuNode);
    }

    /**
     * Adds the given menu node to the menu denoted by the given path.
     *
     * @returns a disposable which, when called, will remove the menu node again.
     */
    registerMenuNode(menuPath: MenuPath, menuNode: MenuNode): Disposable {
        const parent = this.findGroup(menuPath);
        return parent.addNode(menuNode);
    }

    /**
     * Register a new menu at the given path with the given label.
     * (If the menu already exists without a label, iconClass or order this method can be used to set them.)
     *
     * @param menuPath the path for which a new submenu shall be registered.
     * @param label the label to be used for the new submenu.
     * @param options optionally allows to set an icon class and specify the order of the new menu.
     *
     * @returns if the menu was successfully created a disposable will be returned which,
     * when called, will remove the menu again. If the menu already existed a no-op disposable
     * will be returned.
     *
     * Note that if the menu already existed and was registered with a different label an error
     * will be thrown.
     */
    registerSubmenu(menuPath: MenuPath, label: string, options?: SubMenuOptions): Disposable {
        if (menuPath.length === 0) {
            throw new Error('The sub menu path cannot be empty.');
        }
        const index = menuPath.length - 1;
        const menuId = menuPath[index];
        const groupPath = index === 0 ? [] : menuPath.slice(0, index);
        const parent = this.findGroup(groupPath, options);
        let groupNode = this.findSubMenu(parent, menuId, options);
        if (!groupNode) {
            groupNode = this.menuFactory.createCompositeNode({ id: menuId, label, options });
            return parent.addNode(groupNode);
        } else {
            if (!groupNode.label) {
                groupNode.label = label;
            } else if (groupNode.label !== label) {
                throw new Error("The group '" + menuPath.join('/') + "' already has a different label.");
            }
            if (options) {
                if (!groupNode.iconClass) {
                    groupNode.iconClass = options.iconClass;
                }
                if (!groupNode.order) {
                    groupNode.order = options.order;
                }
            }
            return { dispose: () => { } };
        }
    }

    /**
     * Unregister all menu nodes with the same id as the given menu action.
     *
     * @param item the item whose id will be used.
     * @param menuPath if specified only nodes within the path will be unregistered.
     */
    unregisterMenuAction(item: MenuAction, menuPath?: MenuPath): void;
    /**
     * Unregister all menu nodes with the same id as the given command.
     *
     * @param command the command whose id will be used.
     * @param menuPath if specified only nodes within the path will be unregistered.
     */
    unregisterMenuAction(command: Command, menuPath?: MenuPath): void;
    /**
     * Unregister all menu nodes with the given id.
     *
     * @param id the id which shall be removed.
     * @param menuPath if specified only nodes within the path will be unregistered.
     */
    unregisterMenuAction(id: string, menuPath?: MenuPath): void;
    unregisterMenuAction(itemOrCommandOrId: MenuAction | Command | string, menuPath?: MenuPath): void {
        const id = MenuAction.is(itemOrCommandOrId) ? itemOrCommandOrId.commandId
            : Command.is(itemOrCommandOrId) ? itemOrCommandOrId.id
                : itemOrCommandOrId;

        if (menuPath) {
            const parent = this.findGroup(menuPath);
            parent.removeNode(id);
            return;
        }

        this.unregisterMenuNode(id);
    }

    /**
     * Recurse all menus, removing any menus matching the `id`.
     *
     * @param id technical identifier of the `MenuNode`.
     */
    unregisterMenuNode(id: string): void {
        const recurse = (root: CompositeMenuNode) => {
            root.children.forEach(node => {
                if (node instanceof CompositeMenuNode) {
                    node.removeNode(id);
                    recurse(node);
                }
            });
        };
        recurse(this.root);
    }

    protected findGroup(menuPath: MenuPath, options?: SubMenuOptions): CompositeMenuNode {
        let currentMenu = this.root;
        for (const segment of menuPath) {
            currentMenu = this.findSubMenu(currentMenu, segment, options);
        }
        return currentMenu;
    }

    protected findSubMenu(current: CompositeMenuNode, menuId: string, options?: SubMenuOptions): CompositeMenuNode {
        const sub = current.children.find(e => e.id === menuId);
        if (sub instanceof CompositeMenuNode) {
            return sub;
        }
        if (sub) {
            throw new Error(`'${menuId}' is not a menu group.`);
        }
        const newSub = this.menuFactory.createCompositeNode({ id: menuId, options });
        current.addNode(newSub);
        return newSub;
    }

    /**
     * Returns the menu at the given path.
     *
     * @param menuPath the path specifying the menu to return. If not given the empty path will be used.
     *
     * @returns the root menu when `menuPath` is empty. If `menuPath` is not empty the specified menu is
     * returned if it exists, otherwise an error is thrown.
     */
    getMenu(menuPath: MenuPath = []): CompositeMenuNode {
        return this.findGroup(menuPath);
    }
}

/**
 * Base interface of the nodes used in the menu tree structure.
 */
export interface MenuNode {
    /**
     * the optional label for this specific node.
     */
    readonly label?: string
    /**
     * technical identifier.
     */
    readonly id: string
    /**
     * Menu nodes are sorted in ascending order based on their `sortString`.
     */
    readonly sortString: string
}

/**
 * Node representing a (sub)menu in the menu tree structure.
 */
export class CompositeMenuNode implements MenuNode {
    protected readonly _children: MenuNode[] = [];
    public iconClass?: string;
    public order?: string;

    constructor(
        public readonly id: string,
        public label?: string,
        options?: SubMenuOptions
    ) {
        if (options) {
            this.iconClass = options.iconClass;
            this.order = options.order;
        }
    }

    get children(): ReadonlyArray<MenuNode> {
        return this._children;
    }

    /**
     * Inserts the given node at the position indicated by `sortString`.
     *
     * @returns a disposable which, when called, will remove the given node again.
     */
    public addNode(node: MenuNode): Disposable {
        this._children.push(node);
        this._children.sort((m1, m2) => {
            // The navigation group is special as it will always be sorted to the top/beginning of a menu.
            if (CompositeMenuNode.isNavigationGroup(m1)) {
                return -1;
            }
            if (CompositeMenuNode.isNavigationGroup(m2)) {
                return 1;
            }
            if (m1.sortString < m2.sortString) {
                return -1;
            } else if (m1.sortString > m2.sortString) {
                return 1;
            } else {
                return 0;
            }
        });
        return {
            dispose: () => {
                const idx = this._children.indexOf(node);
                if (idx >= 0) {
                    this._children.splice(idx, 1);
                }
            }
        };
    }

    /**
     * Removes the first node with the given id.
     *
     * @param id node id.
     */
    public removeNode(id: string): void {
        const node = this._children.find(n => n.id === id);
        if (node) {
            const idx = this._children.indexOf(node);
            if (idx >= 0) {
                this._children.splice(idx, 1);
            }
        }
    }

    get sortString(): string {
        return this.order || this.id;
    }

    get isSubmenu(): boolean {
        return this.label !== undefined;
    }

    /**
     * Indicates whether the given node is the special `navigation` menu.
     *
     * @param node the menu node to check.
     * @returns `true` when the given node is a {@link CompositeMenuNode} with id `navigation`,
     * `false` otherwise.
     */
    static isNavigationGroup(node: MenuNode): node is CompositeMenuNode {
        return node instanceof CompositeMenuNode && node.id === 'navigation';
    }
}

/**
 * Node representing an action in the menu tree structure.
 * It's based on {@link MenuAction} for which it tries to determine the
 * best label, icon and sortString with the given data.
 */
export class ActionMenuNode implements MenuNode {

    readonly altNode: ActionMenuNode | undefined;

    constructor(
        public readonly action: MenuAction,
        protected readonly commands: CommandRegistry,
        protected readonly factory: MenuNodeFactory
    ) {
        if (action.alt) {
            this.altNode = this.factory.createActionNode({ commandId: action.alt });
        }
    }

    get id(): string {
        return this.action.commandId;
    }

    get label(): string {
        if (this.action.label) {
            return this.action.label;
        }
        const cmd = this.commands.getCommand(this.action.commandId);
        if (!cmd) {
            throw new Error(`A command with id '${this.action.commandId}' does not exist.`);
        }
        return cmd.label || cmd.id;
    }

    get icon(): string | undefined {
        if (this.action.icon) {
            return this.action.icon;
        }
        const command = this.commands.getCommand(this.action.commandId);
        return command && command.iconClass;
    }

    get sortString(): string {
        return this.action.order || this.label;
    }
}
