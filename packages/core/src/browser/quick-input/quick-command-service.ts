/********************************************************************************
 * Copyright (c) 2021 SAP SE or an SAP affiliate company and others.
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
import { KeybindingRegistry } from '../keybinding';
import { Disposable, Command, CommandRegistry, CancellationToken } from '../../common';
import { ContextKeyService } from '../context-key-service';
import { CorePreferences } from '../core-preferences';
import { QuickAccessContribution, QuickAccessProvider, QuickAccessRegistry } from './quick-access';
import { filterItems, QuickPickItem, QuickPicks } from './quick-input-service';
import { KeySequence } from '../keys';

export const quickCommand: Command = {
    id: 'workbench.action.showCommands'
};

export const CLEAR_COMMAND_HISTORY: Command = {
    id: 'clear.command.history',
    label: 'Clear Command History'
};

@injectable()
export class QuickCommandService implements QuickAccessContribution, QuickAccessProvider {
    static PREFIX = '>';

    @inject(ContextKeyService)
    protected readonly contextKeyService: ContextKeyService;

    @inject(CommandRegistry)
    protected readonly commandRegistry: CommandRegistry;

    @inject(CorePreferences)
    protected readonly corePreferences: CorePreferences;

    @inject(QuickAccessRegistry)
    protected readonly quickAccessRegistry: QuickAccessRegistry;

    constructor(@inject(KeybindingRegistry) protected readonly keybindingRegistry: KeybindingRegistry) {
    }

    // The list of exempted commands not to be displayed in the recently used list.
    readonly exemptedCommands: Command[] = [
        CLEAR_COMMAND_HISTORY,
    ];

    private recentItems: QuickPickItem[] = [];
    private otherItems: QuickPickItem[] = [];

    registerQuickAccessProvider(): void {
        this.quickAccessRegistry.registerQuickAccessProvider({
            getInstance: () => this,
            prefix: QuickCommandService.PREFIX,
            placeholder: '',
            helpEntries: [{ description: 'Quick Command', needsEditor: false }]
        });
    }

    reset(): void {
        const { recent, other } = this.getCommands();
        this.recentItems = [];
        this.otherItems = [];
        this.recentItems.push(...recent.map(command => this.toItem(command)));
        this.otherItems.push(...other.map(command => this.toItem(command)));
    }

    getPicks(filter: string, token: CancellationToken): QuickPicks {
        const items: QuickPicks = [];
        if (this.recentItems.length === 0 && this.otherItems.length === 0) {
            this.reset();
        }
        const recentItems = filterItems(this.recentItems.slice(), filter);
        const otherItems = filterItems(this.otherItems.slice(), filter);

        if (recentItems.length > 0) {
            items.push({ type: 'separator', label: 'recently used' }, ...recentItems);
        }

        if (otherItems.length > 0) {
            items.push({ type: 'separator', label: 'other commands' }, ...otherItems);
        }
        return items;
    }

    private toItem(command: Command): QuickPickItem {
        const label = (command.category) ? `${command.category}: ` + command.label! : command.label!;
        const iconClasses = this.getItemIconClasses(command);
        const activeElement = window.document.activeElement as HTMLElement;

        return {
            label,
            iconClasses,
            alwaysShow: !!this.commandRegistry.getActiveHandler(command.id),
            keySequence: this.getKeybinding(command),
            execute: () => {
                activeElement.focus({ preventScroll: true });
                this.commandRegistry.executeCommand(command.id);
                this.commandRegistry.addRecentCommand(command);
            }
        };
    }

    private getKeybinding(command: Command): KeySequence | undefined {
        const keybindings = this.keybindingRegistry.getKeybindingsForCommand(command.id);
        if (!keybindings || keybindings.length === 0) {
            return undefined;
        }

        try {
            return this.keybindingRegistry.resolveKeybinding(keybindings[0]);
        } catch (error) {
            return undefined;
        }
    }

    private getItemIconClasses(command: Command): string[] | undefined {
        const toggledHandler = this.commandRegistry.getToggledHandler(command.id);
        if (toggledHandler) {
            return ['fa fa-check'];
        }
        return undefined;
    }

    protected readonly contexts = new Map<string, string[]>();
    pushCommandContext(commandId: string, when: string): Disposable {
        const contexts = this.contexts.get(commandId) || [];
        contexts.push(when);
        this.contexts.set(commandId, contexts);
        return Disposable.create(() => {
            const index = contexts.indexOf(when);
            if (index !== -1) {
                contexts.splice(index, 1);
            }
        });
    }

    /**
     * Get the list of valid commands.
     *
     * @param commands the list of raw commands.
     * @returns the list of valid commands.
     */
    protected getValidCommands(raw: Command[]): Command[] {
        const valid: Command[] = [];
        raw.forEach(command => {
            if (command.label) {
                const contexts = this.contexts.get(command.id);
                if (!contexts || contexts.some(when => this.contextKeyService.match(when))) {
                    valid.push(command);
                }
            }
        });
        return valid;
    }

    /**
     * Get the list of recently used and other commands.
     *
     * @returns the list of recently used commands and other commands.
     */
    protected getCommands(): { recent: Command[], other: Command[] } {

        // Get the list of recent commands.
        const recentCommands = this.commandRegistry.recent;

        // Get the list of all valid commands.
        const allCommands = this.getValidCommands(this.commandRegistry.commands);

        // Get the max history limit.
        const limit = this.corePreferences['workbench.commandPalette.history'];

        // Build the list of recent commands.
        let rCommands: Command[] = [];
        if (limit > 0) {
            rCommands.push(...recentCommands.filter(r =>
                !this.exemptedCommands.some(c => Command.equals(r, c)) &&
                allCommands.some(c => Command.equals(r, c)))
            );
            if (rCommands.length > limit) {
                rCommands = rCommands.slice(0, limit);
            }
        }

        // Build the list of other commands.
        const oCommands = allCommands.filter(c => !rCommands.some(r => Command.equals(r, c)));

        // Normalize the list of recent commands.
        const recent = this.normalize(rCommands);

        // Normalize, and sort the list of other commands.
        const other = this.sort(
            this.normalize(oCommands)
        );

        return { recent, other };
    }

    /**
     * Normalizes a list of commands.
     * Normalization includes obtaining commands that have labels, are visible, and are enabled.
     *
     * @param commands the list of commands.
     * @returns the list of normalized commands.
     */
    private normalize(commands: Command[]): Command[] {
        return commands.filter((a: Command) => a.label && (this.commandRegistry.isVisible(a.id) && this.commandRegistry.isEnabled(a.id)));
    }

    /**
     * Sorts a list of commands alphabetically.
     *
     * @param commands the list of commands.
     * @returns the list of sorted commands.
     */
    private sort(commands: Command[]): Command[] {
        return commands.sort((a: Command, b: Command) => Command.compareCommands(a, b));
    }
}
