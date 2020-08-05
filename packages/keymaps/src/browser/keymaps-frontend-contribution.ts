/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
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
import {
    CommandContribution,
    Command,
    CommandRegistry,
    MenuContribution,
    MenuModelRegistry
} from '@theia/core/lib/common';
import { Widget } from '@theia/core/lib/browser';
import { CommonMenus } from '@theia/core/lib/browser/common-frontend-contribution';
import { KeymapsService } from './keymaps-service';
import { KeybindingRegistry, KeybindingScope } from '@theia/core/lib/browser/keybinding';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import { KeybindingWidget, KeybindingItem } from './keybindings-widget';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { KeymapsMenus } from './keymaps-menus';
import { ClipboardService } from '@theia/core/lib/browser/clipboard-service';

export namespace KeymapsCommands {
    export const OPEN_KEYMAPS: Command = {
        id: 'keymaps:open',
        category: 'Settings',
        label: 'Open Keyboard Shortcuts',
    };
    export const OPEN_KEYMAPS_JSON: Command = {
        id: 'keymaps:openJson',
        category: 'Settings',
        label: 'Open Keyboard Shortcuts (JSON)',
    };
    export const OPEN_KEYMAPS_JSON_TOOLBAR: Command = {
        id: 'keymaps:openJson.toolbar',
        iconClass: 'codicon codicon-json'
    };
    export const CLEAR_KEYBINDINGS_SEARCH: Command = {
        id: 'keymaps.clearSearch',
        iconClass: 'codicon codicon-clear-all'
    };
    export const COPY_COMMAND_ID: Command = {
        id: 'keymaps.copyCommandId'
    };
    export const COPY_COMMAND: Command = {
        id: 'keymaps.copyCommand'
    };
    export const EDIT_KEYBINDING: Command = {
        id: 'keymaps.editKeybinding',
    };
    export const RESET_KEYBINDING: Command = {
        id: 'keymaps.resetKeybinding'
    };
    export const CHANGE_WHEN_EXPRESSION: Command = {
        id: 'keymaps.changeWhenExpression',
    };
}

@injectable()
export class KeymapsFrontendContribution extends AbstractViewContribution<KeybindingWidget> implements CommandContribution, MenuContribution, TabBarToolbarContribution {

    @inject(ClipboardService)
    protected clipboardService: ClipboardService;

    @inject(KeymapsService)
    protected readonly keymaps: KeymapsService;

    constructor() {
        super({
            widgetId: KeybindingWidget.ID,
            widgetName: KeybindingWidget.LABEL,
            defaultWidgetOptions: {
                area: 'main'
            },
        });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(KeymapsCommands.OPEN_KEYMAPS, {
            isEnabled: () => true,
            execute: () => this.openView({ activate: true })
        });
        commands.registerCommand(KeymapsCommands.OPEN_KEYMAPS_JSON, {
            isEnabled: () => true,
            execute: () => this.keymaps.open()
        });
        commands.registerCommand(KeymapsCommands.OPEN_KEYMAPS_JSON_TOOLBAR, {
            isEnabled: w => this.withWidget(w, () => true),
            isVisible: w => this.withWidget(w, () => true),
            execute: w => this.withWidget(w, widget => this.keymaps.open(widget)),
        });
        commands.registerCommand(KeymapsCommands.CLEAR_KEYBINDINGS_SEARCH, {
            isEnabled: w => this.withWidget(w, widget => widget.hasSearch()),
            isVisible: w => this.withWidget(w, () => true),
            execute: w => this.withWidget(w, widget => widget.clearSearch()),
        });
        commands.registerCommand(KeymapsCommands.COPY_COMMAND, {
            isEnabled: w => this.withWidget(w, () => true),
            isVisible: w => this.withWidget(w, () => true),
            execute: (w, { id, value }: { id: string, value: KeybindingItem }) => this.withWidget(w, widget => {
                this.clipboardService.writeText(this.toStringifiedCommand(value));
            })
        });
        commands.registerCommand(KeymapsCommands.COPY_COMMAND_ID, {
            isEnabled: w => this.withWidget(w, () => true),
            isVisible: w => this.withWidget(w, () => true),
            execute: (w, { id, value }: { id: string, value: KeybindingItem }) => this.withWidget(w, () => {
                this.clipboardService.writeText(id);
            })
        });
        commands.registerCommand(KeymapsCommands.EDIT_KEYBINDING, {
            isEnabled: w => this.withWidget(w, () => true),
            isVisible: w => this.withWidget(w, () => true),
            execute: (w, { id, value }: { id: string, value: KeybindingItem }) => this.withWidget(w, widget => {
                widget.triggerEditKeybinding(value);
            })
        });
        commands.registerCommand(KeymapsCommands.RESET_KEYBINDING, {
            isEnabled: (w, { id, value }: { id: string, value: KeybindingItem }) => this.withWidget(w, () => value.keybinding?.scope === KeybindingScope.USER),
            isVisible: (w, { id, value }: { id: string, value: KeybindingItem }) => this.withWidget(w, () => value.keybinding?.scope === KeybindingScope.USER),
            execute: (w, { id, value }: { id: string, value: KeybindingItem }) => this.withWidget(w, widget => {
                widget.triggerResetKeybinding(value);
            })
        });
        commands.registerCommand(KeymapsCommands.CHANGE_WHEN_EXPRESSION, {
            isEnabled: w => this.withWidget(w, () => true),
            isVisible: w => this.withWidget(w, () => true),
            execute: (w, { id, value }: { id: string, value: KeybindingItem }) => this.withWidget(w, widget => {
                widget.triggerChangeWhenExpression(value);
            })
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.FILE_SETTINGS_SUBMENU_OPEN, {
            commandId: KeymapsCommands.OPEN_KEYMAPS.id,
            order: 'a20'
        });
        menus.registerMenuAction(KeymapsMenus.KEYBINDINGS_WIDGET_COPY, {
            commandId: KeymapsCommands.COPY_COMMAND.id,
            label: 'Copy',
            order: 'a10',
        });
        menus.registerMenuAction(KeymapsMenus.KEYBINDINGS_WIDGET_COPY, {
            commandId: KeymapsCommands.COPY_COMMAND_ID.id,
            label: 'Copy Command ID',
            order: 'a20',
        });
        menus.registerMenuAction(KeymapsMenus.KEYBINDINGS_WIDGET_ACTIONS, {
            commandId: KeymapsCommands.EDIT_KEYBINDING.id,
            label: 'Edit Keybinding',
            order: 'a10'
        });
        menus.registerMenuAction(KeymapsMenus.KEYBINDINGS_WIDGET_ACTIONS, {
            commandId: KeymapsCommands.RESET_KEYBINDING.id,
            label: 'Reset Keybinding',
            order: 'a20'
        });
        menus.registerMenuAction(KeymapsMenus.KEYBINDINGS_WIDGET_ACTIONS, {
            commandId: KeymapsCommands.CHANGE_WHEN_EXPRESSION.id,
            label: 'Change When Expression',
            order: 'a30'
        });
    }

    registerKeybindings(keybindings: KeybindingRegistry): void {
        keybindings.registerKeybinding({
            command: KeymapsCommands.OPEN_KEYMAPS.id,
            keybinding: 'ctrl+alt+,'
        });
    }

    async registerToolbarItems(toolbar: TabBarToolbarRegistry): Promise<void> {
        const widget = await this.widget;
        const onDidChange = widget.onDidUpdate;
        toolbar.registerItem({
            id: KeymapsCommands.OPEN_KEYMAPS_JSON_TOOLBAR.id,
            command: KeymapsCommands.OPEN_KEYMAPS_JSON_TOOLBAR.id,
            tooltip: 'Open Keyboard Shortcuts in JSON',
            priority: 0,
        });
        toolbar.registerItem({
            id: KeymapsCommands.CLEAR_KEYBINDINGS_SEARCH.id,
            command: KeymapsCommands.CLEAR_KEYBINDINGS_SEARCH.id,
            tooltip: 'Clear Keybindings Search Input',
            priority: 1,
            onDidChange,
        });
    }

    /**
     * Determine if the current widget is the keybindings widget.
     */
    protected withWidget<T>(widget: Widget | undefined = this.tryGetWidget(), fn: (widget: KeybindingWidget) => T): T | false {
        if (widget instanceof KeybindingWidget && widget.id === KeybindingWidget.ID) {
            return fn(widget);
        }
        return false;
    }

    /**
     * Converts a keybinding item to a human-readable form.
     * @param item the keybinding item.
     */
    protected toStringifiedCommand(item: KeybindingItem): string {
        return JSON.stringify({
            key: item.labels.keybinding,
            command: item.labels.id,
            when: item.labels.context
        }, undefined, '\t');
    }
}
