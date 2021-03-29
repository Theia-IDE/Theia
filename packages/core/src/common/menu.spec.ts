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

import { CommandContribution, CommandRegistry } from './command';
import { CompositeMenuNode, MenuContribution, MenuModelRegistry, MenuNodeFactory } from './menu';
import * as chai from 'chai';

const expect = chai.expect;

describe('menu-model-registry', () => {

    describe('01 #register', () => {
        it('Should allow to register menu actions.', () => {
            const fileMenu = ['main', 'File'];
            const fileOpenMenu = [...fileMenu, '0_open'];
            const service = createMenuRegistry({
                registerMenus(menuRegistry: MenuModelRegistry): void {
                    menuRegistry.registerSubmenu(fileMenu, 'File');
                    menuRegistry.registerMenuAction(fileOpenMenu, {
                        commandId: 'open'
                    });
                    menuRegistry.registerMenuAction(fileOpenMenu, {
                        commandId: 'open.with'
                    });
                }
            }, {
                registerCommands(reg: CommandRegistry): void {
                    reg.registerCommand({
                        id: 'open',
                        label: 'A'
                    });
                    reg.registerCommand({
                        id: 'open.with',
                        label: 'B'
                    });
                }
            });
            const all = service.getMenu();
            const main = all.children[0] as CompositeMenuNode;
            expect(main.children.length).equals(1);
            expect(main.id, 'main');
            expect(all.children.length).equals(1);
            const file = main.children[0] as CompositeMenuNode;
            expect(file.children.length).equals(1);
            expect(file.label, 'File');
            const openGroup = file.children[0] as CompositeMenuNode;
            expect(openGroup.children.length).equals(2);
            // eslint-disable-next-line no-unused-expressions
            expect(openGroup.label).undefined;
        });
    });
});

function createMenuRegistry(menuContrib: MenuContribution, commandContrib: CommandContribution): MenuModelRegistry {
    const cmdReg = new CommandRegistry({ getContributions: () => [commandContrib] });
    cmdReg.onStart();
    const menuNodeFactory = new MenuNodeFactory(cmdReg);
    const menuReg = new MenuModelRegistry({ getContributions: () => [menuContrib] }, cmdReg, menuNodeFactory);
    menuReg.onStart();
    return menuReg;
}
