/********************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
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

import { injectable, inject, optional } from '@theia/core/shared/inversify';
import { PluginServer } from '../../common';
import { Command } from '@theia/core/lib/common/command';
import { QuickInputService, QuickPick, QuickPickItem } from '@theia/core/lib/browser';

@injectable()
export class PluginExtDeployCommandService /* implements QuickOpenModel */ {
    public static COMMAND: Command = {
        id: 'plugin-ext:deploy-plugin-id',
        category: 'Plugin',
        label: 'Deploy Plugin by Id',
    };

    @inject(QuickInputService) @optional()
    protected readonly quickInputService: QuickInputService;

    @inject(PluginServer)
    protected readonly pluginServer: PluginServer;

    deploy(): void {
        this.quickInputService?.showQuickPick([],
            {
                placeholder: "Plugin's id to deploy.",
                onDidChangeValue: (quickPick: QuickPick<QuickPickItem>, filter: string) => {
                    quickPick.items = [{
                        label: filter,
                        detail: 'Deploy this plugin',
                        execute: () => this.pluginServer.deploy(filter)
                    }];
                }
            }
        );
    }
}
