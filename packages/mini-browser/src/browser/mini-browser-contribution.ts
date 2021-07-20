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

import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common';
import { MiniBrowserOpenHandler } from './mini-browser-open-handler';

export const OPEN_MINIBROWSER_COMMAND = {
    id: 'minibrowser.openPreview',
    label: 'Open Minibrowser as Preview'
};

@injectable()
export class MiniBrowserCommandContribution implements CommandContribution {
    @inject(MiniBrowserOpenHandler) protected readonly openHandler: MiniBrowserOpenHandler;
    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(OPEN_MINIBROWSER_COMMAND, {
            execute: () => this.openHandler.openPreview('https://www.google.com')
        });
    }
}
