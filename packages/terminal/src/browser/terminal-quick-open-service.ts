/********************************************************************************
 * Copyright (C) 2019 Ericsson and others.
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

import { inject, injectable, optional } from '@theia/core/shared/inversify';
import {
    QuickAccessContribution,
    QuickAccessProvider,
    QuickAccessRegistry,
    QuickInputService
} from '@theia/core/lib/browser';
import { CancellationToken, CommandContribution, CommandRegistry, CommandService } from '@theia/core/lib/common';
import { TerminalWidget } from './base/terminal-widget';
import { TerminalService } from './base/terminal-service';
import { TerminalCommands } from './terminal-frontend-contribution';
import { filterItems, QuickPickItem, QuickPicks } from '@theia/core/lib/browser/quick-input/quick-input-service';

@injectable()
export class TerminalQuickOpenService implements QuickAccessProvider {
    static readonly PREFIX = 'term ';

    @inject(QuickInputService) @optional()
    protected readonly quickInputService: QuickInputService;

    @inject(QuickAccessRegistry)
    protected readonly quickAccessRegistry: QuickAccessRegistry;

    @inject(CommandService)
    protected readonly commandService: CommandService;

    @inject(TerminalService)
    protected readonly terminalService: TerminalService;

    open(): void {
        this.quickInputService?.open(TerminalQuickOpenService.PREFIX);
    }

    async getPicks(filter: string, token: CancellationToken): Promise<QuickPicks> {
        const items: QuickPickItem[] = [];

        // Get the sorted list of currently opened terminal widgets
        const widgets: TerminalWidget[] = this.terminalService.all
            .sort((a: TerminalWidget, b: TerminalWidget) => this.compareItems(a, b));

        for (const widget of widgets) {
            items.push(this.toItem(widget));
        }
        // Append a quick open item to create a new terminal.
        items.push({
            label: 'Open New Terminal',
            iconClasses: ['fa fa-plus'],
            execute: () => this.doCreateNewTerminal()
        });

        return filterItems(items, filter);
    }

    registerQuickAccessProvider(): void {
        this.quickAccessRegistry.registerQuickAccessProvider({
            getInstance: () => this,
            prefix: TerminalQuickOpenService.PREFIX,
            placeholder: '',
            helpEntries: [{ description: 'Show All Opened Terminals', needsEditor: false }]
        });
    }

    /**
     * Compare two terminal widgets by label. If labels are identical, compare by the widget id.
     * @param a `TerminalWidget` for comparison
     * @param b `TerminalWidget` for comparison
     */
    protected compareItems(a: TerminalWidget, b: TerminalWidget): number {
        const normalize = (str: string) => str.trim().toLowerCase();

        if (normalize(a.title.label) !== normalize(b.title.label)) {
            return normalize(a.title.label).localeCompare(normalize(b.title.label));
        } else {
            return normalize(a.id).localeCompare(normalize(b.id));
        }
    }

    protected doCreateNewTerminal(): void {
        this.commandService.executeCommand(TerminalCommands.NEW.id);
    }

    /**
     * Convert the terminal widget to the quick pick item.
     * @param {TerminalWidget} widget - the terminal widget.
     * @returns quick pick item.
     */
    protected toItem(widget: TerminalWidget): QuickPickItem {
        return {
            label: widget.title.label,
            description: widget.id,
            ariaLabel: widget.title.label,
            execute: () => this.terminalService.open(widget)
        };
    }
}

/**
 * TODO: merge it to TerminalFrontendContribution.
 */
@injectable()
export class TerminalQuickOpenContribution implements CommandContribution, QuickAccessContribution {

    @inject(TerminalQuickOpenService)
    protected readonly terminalQuickOpenService: TerminalQuickOpenService;

    registerQuickAccessProvider(): void {
        this.terminalQuickOpenService.registerQuickAccessProvider();
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(TerminalCommands.SHOW_ALL_OPENED_TERMINALS, {
            execute: () => this.terminalQuickOpenService.open()
        });
    }
}
