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

import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandRegistry, CommandContribution } from '@theia/core/lib/common';
import { PluginExtDeployCommandService } from './plugin-ext-deploy-command';
import { OpenUriCommandHandler } from './commands';
import URI from '@theia/core/lib/common/uri';

@injectable()
export class PluginApiFrontendContribution implements CommandContribution {

    @inject(PluginExtDeployCommandService)
    protected readonly pluginExtDeployCommandService: PluginExtDeployCommandService;

    @inject(OpenUriCommandHandler)
    protected readonly openUriCommandHandler: OpenUriCommandHandler;

    registerCommands(commands: CommandRegistry): void {

        commands.registerCommand(PluginExtDeployCommandService.DEPLOY_PLUGIN_BY_ID_COMMAND, {
            execute: () => this.pluginExtDeployCommandService.deploy()
        });

        commands.registerCommand(OpenUriCommandHandler.COMMAND_METADATA, {
            execute: (arg: URI) => this.openUriCommandHandler.execute(arg),
            isVisible: () => false
        });
    }
}
