/********************************************************************************
 * Copyright (C) 2018 Ericsson and others.
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

import React = require('react');
import debounce = require('lodash.debounce');
import * as fuzzy from 'fuzzy';
import { injectable, inject, postConstruct } from 'inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { CommandRegistry, Command } from '@theia/core/lib/common/command';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import {
    ConfirmDialog, ContextMenuRenderer, KeySequence,
    KeybindingRegistry, KeybindingScope, Message, ScopedKeybinding
} from '@theia/core/lib/browser';
import { KeymapsService } from './keymaps-service';
import { AlertMessage } from '@theia/core/lib/browser/widgets/alert-message';
import { KeymapsMenus } from './keymaps-menus';
import { EditKeybindingDialog, EditWhenContextDialog } from './keybindings-dialogs';

/**
 * Representation of a keybinding item for the view.
 */
export interface KeybindingItem {
    command: Command
    keybinding?: ScopedKeybinding
    /** human-readable labels can contain highlighting */
    labels: {
        id: string
        command: string
        keybinding: string
        context: string
        source: string
    }
}

/**
 * Representation of an individual table cell.
 */
export interface CellData {
    /**
     * The cell value.
     */
    value: string,
    /**
     * Indicates if a cell's value is currently highlighted.
     */
    highlighted: boolean,
}

@injectable()
export class KeybindingWidget extends ReactWidget {

    @inject(CommandRegistry)
    protected readonly commandRegistry: CommandRegistry;

    @inject(ContextMenuRenderer)
    protected readonly contextMenuRenderer: ContextMenuRenderer;

    @inject(KeybindingRegistry)
    protected readonly keybindingRegistry: KeybindingRegistry;

    @inject(KeymapsService)
    protected readonly keymapsService: KeymapsService;

    static readonly ID = 'keybindings.view.widget';
    static readonly LABEL = 'Keyboard Shortcuts';

    /**
     * The list of all available keybindings.
     */
    protected items: KeybindingItem[] = [];

    /**
     * The current user search query.
     */
    protected query: string = '';

    /**
     * The regular expression used to extract values between fuzzy results.
     */
    protected readonly regexp = /<match>(.*?)<\/match>/g;
    /**
     * The regular expression used to extract values between the keybinding separator.
     */
    protected readonly keybindingSeparator = /<match>\+<\/match>/g;

    /**
     * The fuzzy search options.
     * The `pre` and `post` options are used to wrap fuzzy matches.
     */
    protected readonly fuzzyOptions = {
        pre: '<match>',
        post: '</match>',
    };

    protected readonly onDidUpdateEmitter = new Emitter<void>();
    readonly onDidUpdate: Event<void> = this.onDidUpdateEmitter.event;

    /**
     * Search keybindings.
     */
    protected readonly searchKeybindings: () => void = debounce(() => this.doSearchKeybindings(), 50);

    /**
     * Initialize the widget.
     */
    @postConstruct()
    protected init(): void {
        this.id = KeybindingWidget.ID;
        this.title.label = KeybindingWidget.LABEL;
        this.title.caption = KeybindingWidget.LABEL;
        this.title.iconClass = 'fa fa-bars';
        this.title.closable = true;
        this.update();

        // Initialize the list of keybinding items.
        this.items = this.getItems();

        // Listen to changes made in the `keymaps.json` and update the view accordingly.
        if (this.keymapsService.onDidChangeKeymaps) {
            this.toDispose.push(this.keymapsService.onDidChangeKeymaps(() => {
                this.doSearchKeybindings();
                this.update();
            }));
        }
    }

    /**
     * Determine if there currently is a search term.
     * @returns `true` if a search term is present.
     */
    public hasSearch(): boolean {
        return !!this.query.length;
    }

    /**
     * Clear the search and reset the view.
     */
    public clearSearch(): void {
        const search = this.findSearchField();
        if (search) {
            search.value = '';
            this.query = '';
            this.doSearchKeybindings();
        }
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.focusInputField();
    }

    /**
     * Perform a search based on the user's search query.
     */
    protected doSearchKeybindings(): void {
        this.onDidUpdateEmitter.fire(undefined);
        this.items = [];
        const searchField = this.findSearchField();
        this.query = searchField ? searchField.value.trim().toLocaleLowerCase() : '';
        const items = this.getItems();
        items.forEach(item => {
            const keys: (keyof KeybindingItem['labels'])[] = ['command', 'keybinding', 'context', 'source'];
            let matched = false;
            for (const key of keys) {
                const string = item.labels[key];
                if (string) {
                    const fuzzyMatch = fuzzy.match(this.query, string, this.fuzzyOptions);
                    if (fuzzyMatch) {
                        item.labels[key] = fuzzyMatch.rendered;
                        matched = true;
                    } else {
                        // Match identical keybindings that have different orders.
                        if (key === 'keybinding') {
                            const queryItems = this.query.split('+');

                            // Handle key chords.
                            const tempItems = string.split(' ');
                            // Store positions of `space` in the keybinding string.
                            const spaceIndexArr = [0];
                            let bindingItems: string[] = [];
                            if (tempItems.length > 1) {
                                tempItems.forEach(tItem => {
                                    const tKeys = tItem.split('+');
                                    spaceIndexArr.push(tKeys.length + spaceIndexArr[-1]);
                                    bindingItems.push(...tKeys);
                                });
                            } else {
                                bindingItems = string.split('+');
                            }
                            spaceIndexArr.shift();

                            const renderedResult = [...bindingItems];
                            let matchCounter = 0;

                            queryItems.forEach(queryItem => {
                                let keyFuzzyMatch: fuzzy.MatchResult = { rendered: '', score: 0 };
                                let keyIndex = -1;
                                if (string) {
                                    bindingItems.forEach((bindingItem: string) => {
                                        // Match every key in user query with every key in keybinding string.
                                        const tempFuzzyMatch = fuzzy.match(queryItem, bindingItem, this.fuzzyOptions);
                                        // Select the match with the highest matching score.
                                        if (tempFuzzyMatch && tempFuzzyMatch.score > keyFuzzyMatch.score) {
                                            keyFuzzyMatch = tempFuzzyMatch;
                                            // Get index in the keybinding array.
                                            keyIndex = renderedResult.indexOf(bindingItem);
                                        }
                                    });

                                    const keyRendered = keyFuzzyMatch.rendered;
                                    if (keyRendered) {
                                        if (keyIndex > -1) {
                                            renderedResult[keyIndex] = keyRendered;
                                        }
                                        // Remove key from keybinding items if it is matched.
                                        bindingItems.splice(keyIndex, 1, '');
                                        matchCounter += 1;
                                    }
                                }
                            });
                            if (matchCounter === queryItems.length) {
                                // Handle rendering of key chords.
                                if (spaceIndexArr.length > 0) {
                                    const chordRenderedResult = '';
                                    renderedResult.forEach((resultKey, index) => {
                                        if (index === 0) {
                                            chordRenderedResult.concat(resultKey);
                                        } else if (spaceIndexArr.indexOf(index) !== -1) {
                                            chordRenderedResult.concat(' ' + resultKey);
                                        } else {
                                            chordRenderedResult.concat('+' + resultKey);
                                        }
                                    });
                                    item.labels[key] = chordRenderedResult;
                                }

                                item.labels[key] = renderedResult.join('+');
                                matched = true;
                            }
                        }
                    }
                }
            }

            if (matched) {
                this.items.push(item);
            }
        });
        this.update();
    }

    /**
     * Get the search input if available.
     * @returns the search input if available.
     */
    protected findSearchField(): HTMLInputElement | null {
        return document.getElementById('search-kb') as HTMLInputElement;
    }

    /**
     * Set the focus the search input field if available.
     */
    protected focusInputField(): void {
        const input = document.getElementById('search-kb');
        if (input) {
            (input as HTMLInputElement).focus();
            (input as HTMLInputElement).select();
        }
    }

    /**
     * Render the view.
     */
    protected render(): React.ReactNode {
        return <div id='kb-main-container'>
            {this.renderSearch()}
            {(this.items.length > 0) ? this.renderTable() : this.renderMessage()}
        </div>;
    }

    /**
     * Render the search container with the search input.
     */
    protected renderSearch(): React.ReactNode {
        return <div>
            <div className='search-kb-container'>
                <input
                    id='search-kb'
                    className={`theia-input${(this.items.length > 0) ? '' : ' no-kb'}`}
                    type='text'
                    placeholder='Search keybindings'
                    autoComplete='off'
                    onKeyUp={this.searchKeybindings}
                />
            </div>
        </div>;
    }

    /**
     * Render the warning message when no search results are found.
     */
    protected renderMessage(): React.ReactNode {
        return <AlertMessage
            type='WARNING'
            header='No results found!'
        />;
    }

    /**
     * Render the keybindings table.
     */
    protected renderTable(): React.ReactNode {
        return <div id='kb-table-container'>
            <div className='kb'>
                <table>
                    <thead>
                        <tr>
                            <th className='th-action'></th>
                            <th className='th-label'>Command</th>
                            <th className='th-keybinding'>Keybinding</th>
                            <th className='th-context'>Context / When</th>
                            <th className='th-source'>Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        {this.renderRows()}
                    </tbody>
                </table>
            </div>
        </div>;
    }

    /**
     * Render the table rows.
     */
    protected renderRows(): React.ReactNode {
        return <React.Fragment>
            {this.items.map((item, index) => this.renderRow(item, index))}
        </React.Fragment>;
    }

    protected renderRow(item: KeybindingItem, index: number): React.ReactNode {
        const { command, keybinding } = item;
        // TODO get rid of array functions in event handlers
        return <tr
            className='kb-item-row'
            key={index}
            onDoubleClick={this.editKeybinding(item)}
            onContextMenu={this.handleContextMenu(item)}>
            <td className='kb-actions'>
                {this.renderActions(item)}
            </td>
            <td className='kb-label' title={this.getCommandLabel(command)}>
                {this.renderMatchedData(item.labels.command)}
            </td>
            <td title={this.getKeybindingLabel(keybinding)} className='kb-keybinding monaco-keybinding'>
                {this.renderKeybinding(item.labels.keybinding)}
            </td>
            <td className='kb-context' title={this.getContextLabel(keybinding)}>
                <code>{this.renderMatchedData(item.labels.context)}</code>
            </td>
            <td className='kb-source' title={this.getScopeLabel(keybinding)}>
                <code className='td-source'>{this.renderMatchedData(item.labels.source)}</code>
            </td>
        </tr>;
    }

    /**
     * Render the actions container with action icons.
     * @param item the keybinding item for the row.
     */
    protected renderActions(item: KeybindingItem): React.ReactNode {
        return <span className='kb-actions-icons'>{this.renderEdit(item)}</span>;
    }

    /**
     * Render the edit action used to update a keybinding.
     * @param item the keybinding item for the row.
     */
    protected renderEdit(item: KeybindingItem): React.ReactNode {
        return <a title='Edit Keybinding' href='#' onClick={this.editKeybinding(item)}><i className='codicon codicon-edit kb-action-item'></i></a>;
    }

    /**
     * Render the keybinding.
     * @param keybinding the keybinding value.
     */
    protected renderKeybinding(keybinding: string): React.ReactNode {
        if (!keybinding.length) {
            return undefined;
        }
        const regex = new RegExp(this.keybindingSeparator);
        keybinding = keybinding.replace(regex, '+');
        const keys = keybinding.split('+');

        return <React.Fragment>
            {
                keys.map((key, index) => {
                    if (index === 0) {
                        return <span key={index} className='monaco-keybinding-key'>
                            {this.renderMatchedData(key)}
                        </span>;
                    } else if (key.includes(' ')) {
                        // Handle key chords, which have space as the separator
                        // Example: `k Ctrl` in key chords `Ctrl+k Ctrl+p`
                        let chordKeys = key.split('<match> </match>');
                        if (chordKeys.length === 1) {
                            chordKeys = key.split(' ');
                        }
                        return <React.Fragment key={index}>
                            <span className='monaco-keybinding-separator'>+</span>
                            <span className='monaco-keybinding-key'>{this.renderKeybinding(chordKeys[0])}</span>
                            <span className='monaco-keybinding-separator'>&nbsp;&nbsp;</span>
                            <span className='monaco-keybinding-key'>{this.renderKeybinding(chordKeys[1])}</span>
                        </React.Fragment>;
                    } else {
                        return <React.Fragment key={index}>
                            <span className='monaco-keybinding-separator'>+</span>
                            <span className='monaco-keybinding-key'>{this.renderKeybinding(key)}</span>
                        </React.Fragment>;
                    }
                })
            }
        </React.Fragment>;
    }

    /**
     * Get the list of keybinding items.
     *
     * @returns the list of keybinding items.
     */
    protected getItems(): KeybindingItem[] {
        // Sort the commands alphabetically.
        const commands = this.commandRegistry.commands;
        const items: KeybindingItem[] = [];
        // Build the keybinding items.
        for (let i = 0; i < commands.length; i++) {
            const command = commands[i];
            // Skip internal commands prefixed by `_`.
            if (command.id.startsWith('_')) {
                continue;
            }
            const keybinding = this.keybindingRegistry.getKeybindingsForCommand(command.id)[0];
            items.push({
                command,
                keybinding,
                labels: {
                    id: command.id,
                    command: this.getCommandLabel(command),
                    keybinding: this.getKeybindingLabel(keybinding) || '',
                    context: this.getContextLabel(keybinding) || '',
                    source: this.getScopeLabel(keybinding) || ''
                }
            });
        }
        // Sort the keybinding item by label.
        const sorted: KeybindingItem[] = items.sort((a, b) => this.compareItem(a.command, b.command));
        // Get the list of keybinding item with keybindings (visually put them at the top of the table).
        const keyItems: KeybindingItem[] = sorted.filter(a => !!a.labels.keybinding);
        // Get the remaining keybinding items (without keybindings).
        const otherItems: KeybindingItem[] = sorted.filter(a => !a.labels.keybinding);

        // Return the list of keybinding items prioritizing those with a defined keybinding.
        return [...keyItems, ...otherItems];
    }

    /**
     * Get the human-readable label for a given command.
     * @param command the command.
     *
     * @returns a human-readable label for the given command.
     */
    protected getCommandLabel(command: Command): string {
        if (command.label) {
            // Prefix the command label with the category if it exists, else return the simple label.
            return command.category ? `${command.category}: ${command.label}` : command.label;
        }
        return command.id;
    }

    protected getKeybindingLabel(keybinding: ScopedKeybinding | undefined): string | undefined {
        return keybinding && keybinding.keybinding;
    }

    protected getContextLabel(keybinding: ScopedKeybinding | undefined): string | undefined {
        return keybinding ? keybinding.context || keybinding.when : undefined;
    }

    protected getScopeLabel(keybinding: ScopedKeybinding | undefined): string | undefined {
        let scope = keybinding && keybinding.scope;
        if (scope !== undefined) {
            if (scope < KeybindingScope.USER) {
                scope = KeybindingScope.DEFAULT;
            }
            return KeybindingScope[scope].toLocaleLowerCase();
        }
        return undefined;
    }

    /**
     * Compare two commands.
     * - Commands with a label should be prioritized and alphabetically sorted.
     * - Commands without a label (id) should be placed at the bottom.
     * @param a the first command.
     * @param b the second command.
     *
     * @returns an integer indicating whether `a` comes before, after or is equivalent to `b`.
     * - returns `-1` if `a` occurs before `b`.
     * - returns `1` if `a` occurs after `b`.
     * - returns `0` if they are equivalent.
     */
    protected compareItem(a: Command, b: Command): number {
        const labelA = this.getCommandLabel(a);
        const labelB = this.getCommandLabel(b);
        if (labelA === a.id && labelB === b.id) {
            return labelA.toLowerCase().localeCompare(labelB.toLowerCase());
        }
        if (labelA === a.id) {
            return 1;
        }
        if (labelB === b.id) {
            return -1;
        }
        return labelA.toLowerCase().localeCompare(labelB.toLowerCase());
    }

    public triggerEditKeybinding(item: KeybindingItem): void {
        this.editKeybinding(item)();
    };

    public triggerResetKeybinding(item: KeybindingItem): void {
        this.resetKeybinding(item);
    }

    public triggerChangeWhenExpression(item: KeybindingItem): void {
        this.changeWhenExpression(item)();
    }

    /**
     * Prompt users to update the keybinding for the given command.
     * @param item the keybinding item.
     */
    protected editKeybinding = (item: KeybindingItem) => () => {
        const command = item.command.id;
        const oldKeybinding = item.keybinding && item.keybinding.keybinding;
        const dialog = new EditKeybindingDialog({
            title: 'Edit Keybinding',
            initialValue: oldKeybinding,
            validate: newKeybinding => this.validateKeybinding(command, oldKeybinding, newKeybinding),
        }, this.keymapsService, item);
        dialog.open().then(async keybinding => {
            if (keybinding) {
                await this.keymapsService.setKeybinding({
                    ...item.keybinding,
                    command,
                    keybinding
                }, oldKeybinding);
            }
        });
    };

    /**
     * Prompt users to update the `when` expression for the given command.
     * @param item the keybinding item.
     */
    protected changeWhenExpression = (item: KeybindingItem) => () => {
        const command = item.command.id;
        const keybinding = item.keybinding?.keybinding || '';
        const dialog = new EditWhenContextDialog({
            title: 'Change When Expression',
            initialValue: item.labels.context
        }, this.keymapsService, item);
        dialog.open().then(async when => {
            console.log(`when: ${when}`);
            if (when) {
                await this.keymapsService.setKeybinding(
                    { ...item.keybinding, command, keybinding, when },
                    { ...item.keybinding, command, keybinding, when: item.keybinding?.when }
                );
            }
        });
    };

    /**
     * Prompt users for confirmation before resetting.
     * @param command the command label.
     *
     * @returns a Promise which resolves to `true` if a user accepts resetting.
     */
    protected async confirmResetKeybinding(item: KeybindingItem): Promise<boolean> {
        const dialog = new ConfirmDialog({
            title: `Reset keybinding for '${this.getCommandLabel(item.command)}'`,
            msg: 'Do you really want to reset this keybinding to its default value?'
        });
        return !!await dialog.open();
    }

    /**
     * Reset the keybinding to its default value.
     * @param item the keybinding item.
     */
    protected async resetKeybinding(item: KeybindingItem): Promise<void> {
        const confirmed = await this.confirmResetKeybinding(item);
        if (confirmed) {
            this.keymapsService.removeKeybinding(item.command.id);
        }
    }

    /**
     * Validate the provided keybinding value against its previous value.
     * @param command the command label.
     * @param oldKeybinding the old keybinding value.
     * @param keybinding the new keybinding value.
     *
     * @returns the end user message to display.
     */
    protected validateKeybinding(command: string, oldKeybinding: string | undefined, keybinding: string): string {
        if (!keybinding) {
            return 'keybinding value is required';
        }
        try {
            const binding = { command, keybinding };
            KeySequence.parse(keybinding);
            if (oldKeybinding === keybinding) {
                return ' '; // if old and new keybindings match, quietly reject update
            }
            if (this.keybindingRegistry.containsKeybindingInScope(binding)) {
                return 'keybinding currently collides';
            }
            return '';
        } catch (error) {
            return error;
        }
    }

    /**
     * Build the cell data with highlights if applicable.
     * @param raw the raw cell value.
     *
     * @returns the list of cell data.
     */
    protected buildCellData(raw: string): CellData[] {
        const data: CellData[] = [];

        if (this.query === '') {
            return data;
        }

        let following = raw;
        let leading;
        let result;

        const regexp = new RegExp(this.regexp);

        while (result = regexp.exec(raw)) {
            const splitLeftIndex = following.indexOf(result[0]);
            const splitRightIndex = splitLeftIndex + result[0].length;

            leading = following.slice(0, splitLeftIndex);
            following = following.slice(splitRightIndex);

            if (leading) {
                data.push({ value: leading, highlighted: false });
            }
            data.push({ value: result[1], highlighted: true });
        }

        if (following) {
            data.push({ value: following, highlighted: false });
        }

        return data;
    }

    /**
     * Render the fuzzy representation of a matched result.
     * @param property one of the `KeybindingItem` properties.
     */
    protected renderMatchedData(property: string): React.ReactNode {
        if (this.query !== '') {
            const cellData = this.buildCellData(property);
            return <React.Fragment>
                {
                    cellData.map((data, index) => (data.highlighted) ? <span key={index} className='fuzzy-match'>{data.value}</span> : <span key={index}>{data.value}</span>)
                }
            </React.Fragment>;
        } else {
            return property;
        }
    }

    protected handleContextMenu = (item: KeybindingItem) => (e: React.SyntheticEvent) => {
        const target = e.nativeEvent.target as HTMLElement;
        const domRect = target.getBoundingClientRect();
        this.contextMenuRenderer.render({
            menuPath: KeymapsMenus.KEYBINDINGS_WIDGET_CONTEXT_MENU,
            anchor: { x: domRect.left, y: domRect.bottom },
            args: [this, { id: item.command.id, value: item }]
        });
    };
}
