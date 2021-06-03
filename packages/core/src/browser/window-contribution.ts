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

import { inject, injectable } from 'inversify';
import { Command, CommandContribution, CommandRegistry, environment } from '../common';
import { WindowService } from './window/window-service';
import { KeybindingContribution, KeybindingRegistry } from './keybinding';
import { MenuContribution, MenuModelRegistry } from '../common/menu';
import { CommonMenus } from '../browser/common-frontend-contribution';

export namespace WindowCommands {

    export const NEW_WINDOW: Command = {
        id: 'workbench.action.newWindow',
        label: 'New Window'
    };
}

@injectable()
export class WindowContribution implements CommandContribution, KeybindingContribution, MenuContribution {

    @inject(WindowService)
    protected windowService: WindowService;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(WindowCommands.NEW_WINDOW, {
            execute: () => {
                this.windowService.openNewDefaultWindow();
            }
        });
    }

    registerKeybindings(registry: KeybindingRegistry): void {
        registry.registerKeybindings({
            command: WindowCommands.NEW_WINDOW.id,
            keybinding: this.isElectron() ? 'ctrlcmd+shift+n' : 'ctrlcmd+alt+n'
        });
    }

    registerMenus(registry: MenuModelRegistry): void {
        registry.registerMenuAction(CommonMenus.FILE_NEW, {
            commandId: WindowCommands.NEW_WINDOW.id,
            order: 'c'
        });
    }

    private isElectron(): boolean {
        return environment.electron.is();
    }

}
