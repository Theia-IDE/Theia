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

import { inject, injectable } from '@theia/core/shared/inversify';
import { KeybindingRegistry, KeySequence, QuickCommandService } from '@theia/core/lib/browser';
import { Command } from '@theia/core/lib/common/command';
import { MonacoResolvedKeybinding } from './monaco-resolved-keybinding';
import { filterItems } from '@theia/core/lib/browser/quick-input/quick-input-service';

@injectable()
export class MonacoQuickCommandService extends QuickCommandService implements monaco.quickInput.IQuickAccessDataService {

    private recentItems: Array<monaco.quickInput.IAnythingQuickPickItem> = [];
    private otherItems: Array<monaco.quickInput.IAnythingQuickPickItem> = [];

    @inject(KeybindingRegistry)
    protected readonly keybindingRegistry: KeybindingRegistry;

    registerQuickAccessProvider(): void {
        monaco.platform.Registry.as<monaco.quickInput.IQuickAccessRegistry>('workbench.contributions.quickaccess').registerQuickAccessProvider({
            ctor: CommandsQuickAccessProvider,
            prefix: CommandsQuickAccessProvider.PREFIX,
            placeholder: '',
            helpEntries: [{ description: 'Quick Command', needsEditor: false }]
        });
        CommandsQuickAccessProvider.dataService = this as monaco.quickInput.IQuickAccessDataService;
    }

    reset(): void {
        const { recent, other } = this.getCommands();
        this.recentItems = [];
        this.otherItems = [];
        this.recentItems.push(...recent.map(command => this.toItem(command)));
        this.otherItems.push(...other.map(command => this.toItem(command)));
    }

    getPicks(filter: string, token: monaco.CancellationToken): monaco.quickInput.Picks<monaco.quickInput.IAnythingQuickPickItem> {
        const items: Array<monaco.quickInput.IAnythingQuickPickItem> = [];
        this.reset();
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

    private toItem(command: Command): monaco.quickInput.IAnythingQuickPickItem {
        const label = (command.category) ? `${command.category}: ` + command.label! : command.label!;
        const iconClasses = this.getItemIconClasses(command);
        const activeElement = window.document.activeElement as HTMLElement;

        const originalLabel = command.originalLabel || command.label!;
        const originalCategory = command.originalCategory || command.category;
        let detail: string | undefined = originalCategory ? `${originalCategory}: ${originalLabel}` : originalLabel;
        if (label === detail) {
            detail = undefined;
        }

        return {
            label,
            detail,
            iconClasses,
            alwaysShow: !!this.commandRegistry.getActiveHandler(command.id),
            keybinding: this.getKeybinding(command),
            accept: () => {
                activeElement.focus({ preventScroll: true });
                this.commandRegistry.executeCommand(command.id);
                this.commandRegistry.addRecentCommand(command);
            }
        };
    }

    private getKeybinding(command: Command): monaco.keybindings.ResolvedKeybinding | undefined {
        const keybindings = this.keybindingRegistry.getKeybindingsForCommand(command.id);
        if (!keybindings || keybindings.length === 0) {
            return undefined;
        }

        let keySequence: KeySequence;
        try {
            keySequence = this.keybindingRegistry.resolveKeybinding(keybindings[0]);
        } catch (error) {
            return undefined;
        }
        return new MonacoResolvedKeybinding(keySequence, this.keybindingRegistry);
    }

    private getItemIconClasses(command: Command): string[] | undefined {
        const toggledHandler = this.commandRegistry.getToggledHandler(command.id);
        if (toggledHandler) {
            return ['fa fa-check'];
        }
        return undefined;
    }
}

export class CommandsQuickAccessProvider extends monaco.quickInput.PickerQuickAccessProvider<monaco.quickInput.IQuickPickItem> {
    static PREFIX = '>';
    static dataService: monaco.quickInput.IQuickAccessDataService;

    private static readonly NO_RESULTS_PICK: monaco.quickInput.IAnythingQuickPickItem = {
        label: 'No matching results'
    };

    constructor() {
        super(CommandsQuickAccessProvider.PREFIX, {
            canAcceptInBackground: true,
            noResultsPick: CommandsQuickAccessProvider.NO_RESULTS_PICK
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getPicks(filter: string, disposables: any, token: monaco.CancellationToken): monaco.quickInput.Picks<monaco.quickInput.IAnythingQuickPickItem>
        | Promise<monaco.quickInput.Picks<monaco.quickInput.IAnythingQuickPickItem>>
        | monaco.quickInput.FastAndSlowPicks<monaco.quickInput.IAnythingQuickPickItem>
        | null {
        return CommandsQuickAccessProvider.dataService?.getPicks(filter, token);
    }
}
