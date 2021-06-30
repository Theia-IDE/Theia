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
import { QuickOpenService } from './quick-open-service';
import { QuickOpenItem, QuickOpenMode } from './quick-open-model';
import { Deferred } from '../../common/promise-util';
import { MaybePromise } from '../../common/types';
import { MessageType } from '../../common/message-service-protocol';
import { Emitter, Event } from '../../common/event';
import { QuickTitleBar } from './quick-title-bar';
import { QuickTitleButton } from '../../common/quick-open-model';
import { CancellationToken } from '../../common/cancellation';
import { QuickOpenHideReason } from '../../common/quick-open-service';

export interface QuickInputOptions {

    /**
     * Show the progress indicator if true
     */
    busy?: boolean

    /**
     * Allow user input
     */
    enabled?: boolean;

    /**
     * Current step count
     */
    step?: number | undefined

    /**
     * The title of the input
     */
    title?: string | undefined

    /**
     * Total number of steps
     */
    totalSteps?: number | undefined

    /**
     * Buttons that are displayed on the title panel
     */
    buttons?: ReadonlyArray<QuickTitleButton>

    /**
     * Text for when there is a problem with the current input value
     */
    validationMessage?: string | undefined;

    /**
     * The prefill value.
     */
    value?: string;

    /**
     * The text to display under the input box.
     */
    prompt?: string;

    /**
     * The place holder in the input box to guide the user what to type.
     */
    placeHolder?: string;

    /**
     * Set to `true` to show a password prompt that will not show the typed value.
     */
    password?: boolean;

    /**
     * Set to `true` to keep the input box open when focus moves to another part of the editor or to another window.
     */
    ignoreFocusOut?: boolean;

    /**
     * Selection of the prefilled [`value`](#InputBoxOptions.value). Defined as tuple of two number where the
     * first is the inclusive start index and the second the exclusive end index. When `undefined` the whole
     * word will be selected, when empty (start equals end) only the cursor will be set,
     * otherwise the defined range will be selected.
     */
    valueSelection?: [number, number]

    /**
     * An optional function that will be called to validate input and to give a hint
     * to the user.
     *
     * @param value The current value of the input box.
     * @return Return `undefined`, or the empty string when 'value' is valid.
     */
    validateInput?(value: string): MaybePromise<string | undefined>;
}

@injectable()
export class QuickInputService {

    @inject(QuickOpenService)
    protected readonly quickOpenService: QuickOpenService;

    @inject(QuickTitleBar)
    protected readonly quickTitleBar: QuickTitleBar;

    open(options: QuickInputOptions, token: CancellationToken = CancellationToken.None): Promise<string | undefined> {
        const result = new Deferred<string | undefined>();
        const prompt = this.createPrompt(options.prompt);
        let label = prompt;
        let currentText = '';
        const validateInput = options && options.validateInput;
        let initial: boolean = true;

        const toDispose = token.onCancellationRequested(() =>
            this.quickOpenService.hide()
        );
        const resolve = (value: string | undefined) => {
            toDispose.dispose();
            result.resolve(value);
            this.quickTitleBar.hide();
        };
        this.quickOpenService.open({
            onType: async (lookFor, acceptor) => {
                let error: string | undefined;
                if (initial) {
                    initial = false;
                } else {
                    this.onDidChangeValueEmitter.fire(lookFor);
                    error = validateInput && lookFor !== undefined ? await validateInput(lookFor) : undefined;
                }
                label = error || prompt;
                if (error) {
                    this.quickOpenService.showDecoration(MessageType.Error);
                } else {
                    this.quickOpenService.hideDecoration();
                }
                acceptor([new QuickOpenItem({
                    label,
                    run: mode => {
                        if (!error && mode === QuickOpenMode.OPEN) {
                            if (validateInput && lookFor !== undefined) {
                                Promise.resolve(validateInput(lookFor))
                                    .then(errorMessage => {
                                        if (errorMessage) {
                                            label = errorMessage;
                                            this.quickOpenService.showDecoration(MessageType.Error);
                                        } else {
                                            this.onDidAcceptEmitter.fire(undefined);
                                            resolve(currentText);
                                            this.quickOpenService.hide(QuickOpenHideReason.ELEMENT_SELECTED);
                                        }
                                    });
                            } else {
                                this.onDidAcceptEmitter.fire(undefined);
                                resolve(currentText);
                                return true;
                            }
                        }
                        return false;
                    }
                })]);
                currentText = lookFor;
            }
        }, {
                prefix: options.value,
                placeholder: options.placeHolder,
                password: options.password,
                ignoreFocusOut: options.ignoreFocusOut,
                enabled: options.enabled,
                valueSelection: options.valueSelection,
                onClose: () => {
                    result.resolve(undefined);
                    this.quickTitleBar.hide();
                }
            });

        if (options && this.quickTitleBar.shouldShowTitleBar(options.title, options.step)) {
            this.quickTitleBar.attachTitleBar(this.quickOpenService.widgetNode, options.title, options.step, options.totalSteps, options.buttons);
        }

        return result.promise;
    }

    refresh(): void {
        this.quickOpenService.refresh();
    }

    protected defaultPrompt = "Press 'Enter' to confirm your input or 'Escape' to cancel";
    protected createPrompt(prompt?: string): string {
        return prompt ? `${prompt} (${this.defaultPrompt})` : this.defaultPrompt;
    }

    readonly onDidAcceptEmitter: Emitter<void> = new Emitter();
    get onDidAccept(): Event<void> {
        return this.onDidAcceptEmitter.event;
    }

    readonly onDidChangeValueEmitter: Emitter<string> = new Emitter();
    get onDidChangeValue(): Event<string> {
        return this.onDidChangeValueEmitter.event;
    }

}
