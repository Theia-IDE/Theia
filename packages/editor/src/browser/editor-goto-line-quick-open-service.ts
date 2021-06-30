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

import { inject, injectable } from '@theia/core/shared/inversify';
import { CommandService } from '@theia/core/lib/common';
import { QuickOpenModel } from '@theia/core/lib/common/quick-open-model';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import {
    PrefixQuickOpenService,
    QuickOpenContribution,
    QuickOpenGroupItem,
    QuickOpenHandler,
    QuickOpenHandlerRegistry,
    QuickOpenOptions
} from '@theia/core/lib/browser';

@injectable()
export class EditorGotoLineQuickOpenService implements QuickOpenModel, QuickOpenHandler {

    @inject(PrefixQuickOpenService)
    protected prefixQuickOpenService: PrefixQuickOpenService;

    @inject(CommandService)
    protected readonly commandService: CommandService;

    readonly prefix = ':';
    readonly description = 'Go to Line';

    getModel(): QuickOpenModel {
        return this;
    }

    getOptions(): QuickOpenOptions {
        return {};
    }

    open(): void {
        this.prefixQuickOpenService.open(this.prefix);
    }

    async onType(lookFor: string, acceptor: (items: QuickOpenGroupItem[]) => void): Promise<void> {
        // Execute the builtin `gotoLine` command.
        this.commandService.executeCommand('editor.action.gotoLine');
        acceptor([]);
    }
}

@injectable()
export class EditorGotoLineQuickOpenContribution implements CommandContribution, QuickOpenContribution {

    @inject(EditorGotoLineQuickOpenService)
    protected readonly gettingStartedQuickOpenService: EditorGotoLineQuickOpenService;

    registerQuickOpenHandlers(handlers: QuickOpenHandlerRegistry): void {
        handlers.registerHandler(this.gettingStartedQuickOpenService);
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand({ id: 'editor.goto.line' }, {
            execute: () => this.gettingStartedQuickOpenService.open()
        });
    }

}
