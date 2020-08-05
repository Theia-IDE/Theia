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

import { inject } from 'inversify';
import { KeymapsService } from './keymaps-service';
import { KeybindingItem } from './keybindings-widget';
import { Key } from '@theia/core/lib/browser/keyboard/keys';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { KeybindingScope } from '@theia/core/lib/browser/keybinding';
import { SingleTextInputDialog, SingleTextInputDialogProps } from '@theia/core/lib/browser/dialogs';

/**
 * Dialog used to edit keybindings, and reset custom keybindings.
 */
export class EditKeybindingDialog extends SingleTextInputDialog {

    /**
     * The keybinding item in question.
     */
    protected item: KeybindingItem;

    /**
     * HTMLButtonElement used to reset custom keybindings.
     * Custom keybindings have a `User` scope (exist in `keymaps.json`).
     */
    protected resetButton: HTMLButtonElement | undefined;

    constructor(
        @inject(SingleTextInputDialogProps) protected readonly props: SingleTextInputDialogProps,
        @inject(KeymapsService) protected readonly keymapsService: KeymapsService,
        item: KeybindingItem
    ) {
        super(props);
        this.item = item;
        this.appendInfo();
        // Add the `Reset` button if the command currently has a custom keybinding.
        if (this.item.keybinding && this.item.keybinding.scope === KeybindingScope.USER) {
            this.appendResetButton();
        }
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        if (this.resetButton) {
            this.addResetAction(this.resetButton, 'click');
        }
    }

    /**
     * Add `Reset` action used to reset a custom keybinding, and close the dialog.
     * @param element the HTML element in question.
     * @param additionalEventTypes additional event types.
     */
    protected addResetAction<K extends keyof HTMLElementEventMap>(element: HTMLElement, ...additionalEventTypes: K[]): void {
        this.addKeyListener(element, Key.ENTER, () => {
            this.reset();
            this.close();
        }, ...additionalEventTypes);
    }

    /**
     * Adds additional information to the dialog to display the command label.
     */
    protected appendInfo(): void {
        const container = document.createElement('div');
        const info = document.createElement('span');
        info.textContent = this.item.command.label || this.item.command.id;
        info.title = this.item.command.id;
        container.appendChild(info);
        this.contentNode.insertBefore(container, this.inputField);
    }

    /**
     * Create the `Reset` button, and append it to the dialog.
     *
     * @returns the `Reset` button.
     */
    protected appendResetButton(): HTMLButtonElement {
        // Create the `Reset` button.
        this.resetButton = this.createButton('Reset');
        // Add the `Reset` button to the dialog control panel, before the `Accept` button.
        this.controlPanel.insertBefore(this.resetButton, this.acceptButton!);
        this.resetButton.title = 'Reset Keybinding';
        this.resetButton.classList.add('secondary');
        return this.resetButton;
    }

    /**
     * Perform keybinding reset.
     */
    protected reset(): void {
        this.keymapsService.removeKeybinding(this.item.command.id);
    }

}

export class EditWhenContextDialog extends SingleTextInputDialog {

    /**
     * The keybinding item in question.
     */
    protected item: KeybindingItem;

    constructor(
        @inject(SingleTextInputDialogProps) protected readonly props: SingleTextInputDialogProps,
        @inject(KeymapsService) protected readonly keymapsService: KeymapsService,
        item: KeybindingItem
    ) {
        super(props);
        this.item = item;
        this.appendInfo();
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
    }

    /**
     * Adds additional information to the dialog to display the command label.
     */
    protected appendInfo(): void {
        const container = document.createElement('div');
        const info = document.createElement('span');
        info.textContent = this.item.command.label || this.item.command.id;
        info.title = this.item.command.id;
        container.appendChild(info);
        this.contentNode.insertBefore(container, this.inputField);
    }
}
