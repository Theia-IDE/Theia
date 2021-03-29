/********************************************************************************
 * Copyright (C) 2020 TypeFox and others.
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

import { injectable, ContainerModule } from 'inversify';
import * as electron from 'electron';
import { isOSX } from '@theia/core/lib/common';
import { CompositeMenuNode, MAIN_MENU_BAR, MenuPath } from '@theia/core/lib/common/menu';
import { ElectronMainMenuFactory, ElectronMenuOptions } from '@theia/core/lib/electron-browser/menu/electron-main-menu-factory';
import { PlaceholderMenuNode } from '../../browser/menu/sample-menu-contribution';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    rebind(ElectronMainMenuFactory).to(SampleElectronMainMenuFactory).inSingletonScope();
});

@injectable()
class SampleElectronMainMenuFactory extends ElectronMainMenuFactory {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected handleDefault(menuNode: CompositeMenuNode, args: any[] = [], options?: ElectronMenuOptions): Electron.MenuItemConstructorOptions[] {
        if (menuNode instanceof PlaceholderMenuNode) {
            return [{
                label: menuNode.label,
                enabled: false,
                visible: true
            }];
        }
        return [];
    }

    createMenuBar(): Electron.Menu {
        const menuModel = this.menuProvider.getMenu(MAIN_MENU_BAR);
        const template = this.fillMenuTemplate([], menuModel);
        if (isOSX) {
            template.unshift(this.createOSXMenu());
        }
        const menu = electron.remote.Menu.buildFromTemplate(this.escapeAmpersand(template));
        this._menu = menu;
        return menu;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createContextMenu(menuPath: MenuPath, args?: any[]): Electron.Menu {
        const menuModel = this.menuProvider.getMenu(menuPath);
        const template = this.fillMenuTemplate([], menuModel, args, { showDisabled: false });
        return electron.remote.Menu.buildFromTemplate(this.escapeAmpersand(template));
    }

    private escapeAmpersand(template: Electron.MenuItemConstructorOptions[]): Electron.MenuItemConstructorOptions[] {
        for (const option of template) {
            if (option.label && option.label.indexOf('&') !== -1) {
                console.log('before', option.label, 'after', option.label.replace(/\&+/g, '&$&'));
                option.label = option.label.replace(/\&+/g, '&$&');
            }
            if (option.submenu) {
                this.escapeAmpersand(option.submenu as Electron.MenuItemConstructorOptions[]);
            }
        }
        return template;
    }

}
