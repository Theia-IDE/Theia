/********************************************************************************
 * Copyright (C) 2020 Ericsson and others.
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

import { shell } from '../../shared/electron';
import { injectable, inject } from 'inversify';
import { ElectronMainWindowService } from '../electron-common/electron-main-window-service';
import { ElectronMainApplication } from './electron-main-application';
import { NewWindowOptions } from '../browser/window/window-service';

@injectable()
export class ElectronMainWindowServiceImpl implements ElectronMainWindowService {

    @inject(ElectronMainApplication)
    protected readonly app: ElectronMainApplication;

    openNewWindow(url: string, { external }: NewWindowOptions): undefined {
        if (external) {
            shell.openExternal(url);
        } else {
            this.app.createWindow().then(electronWindow => {
                electronWindow.loadURL(url);
            });
        }
        return undefined;
    }

    openNewDefaultWindow(): void {
        this.app.openDefaultWindow();
    }

}
