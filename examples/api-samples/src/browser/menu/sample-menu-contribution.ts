/********************************************************************************
 * Copyright (C) 2020 TORO Limited and others.
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

import { injectable, interfaces } from 'inversify';
import {
    Command,
    CommandContribution,
    CommandRegistry,
    MAIN_MENU_BAR,
    MenuContribution,
    MenuModelRegistry,
    MenuNode,
    MenuNodeFactory,
    SubMenuOptions,
    CompositeMenuNode,
    MenuAction,
    ActionMenuNode
} from '@theia/core/lib/common';

const SampleCommand: Command = {
    id: 'sample-command',
    label: 'Sample Command'
};
const SampleCommand2: Command = {
    id: 'sample-command2',
    label: 'Sample Command2'
};

const SampleFoo1Command: Command = {
    id: 'sample-foo-1-command',
    label: 'Sample & Foo 1'
};
const SampleFoo2Command: Command = {
    id: 'sample-foo-2-command',
    label: 'sample & foo 2'
};
const SampleFoo3Command: Command = {
    id: 'sample-foo-3-command',
    label: 'SAMPLE & FOO 3'
};

@injectable()
export class SampleCommandContribution implements CommandContribution {
    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(SampleCommand, {
            execute: () => {
                alert('This is a sample command!');
            }
        });
        commands.registerCommand(SampleCommand2, {
            execute: () => {
                alert('This is sample command2!');
            }
        });
        [SampleFoo1Command, SampleFoo2Command, SampleFoo3Command].forEach(command => commands.registerCommand(command, { execute: () => { } }));
    }

}

@injectable()
export class SampleMenuContribution implements MenuContribution {
    registerMenus(menus: MenuModelRegistry): void {
        const subMenuPath = [...MAIN_MENU_BAR, 'sample-menu'];
        menus.registerSubmenu(subMenuPath, 'Sample Menu', {
            order: '2' // that should put the menu right next to the File menu
        });
        menus.registerMenuAction(subMenuPath, {
            commandId: SampleCommand.id,
            order: '0'
        });
        menus.registerMenuAction(subMenuPath, {
            commandId: SampleCommand2.id,
            order: '2'
        });
        const subSubMenuPath = [...subMenuPath, 'sample-sub-menu'];
        menus.registerSubmenu(subSubMenuPath, 'Sample sub menu', { order: '2' });
        menus.registerMenuAction(subSubMenuPath, {
            commandId: SampleCommand.id,
            order: '1'
        });
        menus.registerMenuAction(subSubMenuPath, {
            commandId: SampleCommand2.id,
            order: '3'
        });
        const placeholder = new PlaceholderMenuNode([...subSubMenuPath, 'placeholder'].join('-'), 'Placeholder', { order: '0' });
        menus.registerMenuNode(subSubMenuPath, placeholder);
        const fooSubmenu = [...subMenuPath, 'foo'];
        menus.registerSubmenu(fooSubmenu, 'Foo Submenu');
        [SampleFoo1Command, SampleFoo2Command, SampleFoo3Command].forEach(({ id }) => menus.registerMenuAction(fooSubmenu, { commandId: id }));
    }

}

/**
 * Special menu node that is not backed by any commands and is always disabled.
 */
export class PlaceholderMenuNode implements MenuNode {

    constructor(readonly id: string, public readonly label: string, protected options?: SubMenuOptions) { }

    get icon(): string | undefined {
        return this.options?.iconClass;
    }

    get sortString(): string {
        return this.options?.order || this.label;
    }

}

@injectable()
class SampleMenuNodeFactory extends MenuNodeFactory {

    createCompositeNode({ id, label, options }: { id: string, label?: string, options?: SubMenuOptions }): CompositeMenuNode {
        return new CompositeMenuNode(id, label, options);
    }

    createActionNode(menuAction: MenuAction): ActionMenuNode {
        return new SampleActionMenuNode(menuAction, this.commands, this);
    }

}

class SampleActionMenuNode extends ActionMenuNode {

    get sortString(): string {
        return (this.action.order || this.label).toLocaleLowerCase();
    }

}

export const bindSampleMenu = (bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind) => {
    bind(CommandContribution).to(SampleCommandContribution).inSingletonScope();
    bind(MenuContribution).to(SampleMenuContribution).inSingletonScope();
    bind(SampleMenuNodeFactory).toSelf().inSingletonScope();
    rebind(MenuNodeFactory).toService(SampleMenuNodeFactory);
};
