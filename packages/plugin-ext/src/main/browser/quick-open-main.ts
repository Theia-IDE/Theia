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
/* eslint-disable @typescript-eslint/no-explicit-any */

import { InputBoxOptions, QuickPickItem as QuickPickItemExt } from '@theia/plugin';
import { interfaces } from '@theia/core/shared/inversify';
import { RPCProtocol } from '../../common/rpc-protocol';
import {
    QuickOpenExt,
    QuickOpenMain,
    MAIN_RPC_CONTEXT,
    TransferInputBox,
    TransferQuickPick,
    TransferQuickPickItems,
    TransferQuickInput,
    TransferQuickInputButton
} from '../../common/plugin-api-rpc';
import {
    InputOptions, PickOptions, QuickInputButton, QuickInputService, QuickPickItem, QuickPickValue
} from '@theia/core/lib/browser';
import { QuickPickService } from '@theia/core/lib/common/quick-pick-service';
import { DisposableCollection, Disposable } from '@theia/core/lib/common/disposable';
import { CancellationToken } from '@theia/core/lib/common/cancellation';
import { MonacoQuickInputService } from '@theia/monaco/lib/browser/monaco-quick-input-service';
import * as theia from '@theia/plugin';
import { QuickInputButtons } from '../../plugin/types-impl';
import { getIconUris } from '../../plugin/quick-open';

export interface QuickInputSession {
    input: monaco.quickInput.IQuickInput;
    handlesToItems: Map<number, TransferQuickPickItems>;
}

export class QuickOpenMainImpl implements QuickOpenMain, Disposable {

    private quickInputService: QuickInputService;
    private quickPickService: QuickPickService;
    private proxy: QuickOpenExt;
    private delegate: MonacoQuickInputService;
    private readonly items: Record<number, {
        resolve(items: TransferQuickPickItems[]): void;
        reject(error: Error): void;
    }> = {};

    protected readonly toDispose = new DisposableCollection();

    constructor(rpc: RPCProtocol, container: interfaces.Container) {
        this.proxy = rpc.getProxy(MAIN_RPC_CONTEXT.QUICK_OPEN_EXT);
        this.delegate = container.get(MonacoQuickInputService);
        this.quickInputService = container.get(QuickInputService);
        this.quickPickService = container.get(QuickPickService);
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    async $show(instance: number, options: PickOptions<TransferQuickPickItems>, token: CancellationToken): Promise<number | number[] | undefined> {
        const contents = new Promise<TransferQuickPickItems[]>((resolve, reject) => {
            this.items[instance] = { resolve, reject };
        });

        options = {
            ...options,
            onDidFocus: (el: any) => {
                if (el) {
                    this.proxy.$onItemSelected((<TransferQuickPickItems>el).handle);
                }
            }
        };

        if (options.canPickMany) {
            return this.delegate.pick(contents, options as { canPickMany: true }, token).then(items => {
                if (items) {
                    return items.map(item => item.handle);
                }
                return undefined;
            });
        } else {
            return this.delegate.pick(contents, options, token).then(item => {
                if (item) {
                    return item.handle;
                }
                return undefined;
            });
        }
    }

    $setItems(instance: number, items: TransferQuickPickItems[]): Promise<any> {
        if (this.items[instance]) {
            this.items[instance].resolve(items);
            delete this.items[instance];
        }
        return Promise.resolve();
    }

    $setError(instance: number, error: Error): Promise<void> {
        if (this.items[instance]) {
            this.items[instance].reject(error);
            delete this.items[instance];
        }
        return Promise.resolve();
    }

    $input(options: InputBoxOptions, validateInput: boolean, token: CancellationToken): Promise<string | undefined> {
        const inputOptions: InputOptions = Object.create(null);

        if (options) {
            inputOptions.password = options.password;
            inputOptions.placeHolder = options.placeHolder;
            inputOptions.valueSelection = options.valueSelection;
            inputOptions.prompt = options.prompt;
            inputOptions.value = options.value;
            inputOptions.ignoreFocusLost = options.ignoreFocusOut;
        }

        if (validateInput) {
            inputOptions.validateInput = (val: string) => this.proxy.$validateInput(val);
        }

        return this.quickInputService?.input(inputOptions, token);
    }

    async $showInputBox(options: TransferInputBox, validateInput: boolean): Promise<string | undefined> {
        return new Promise<string | undefined>((resolve, reject) => {
            const sessionId = options.id;
            const toDispose = new DisposableCollection();

            const inputBox = this.quickInputService?.createInputBox();
            inputBox.prompt = options.prompt;
            inputBox.placeholder = options.placeHolder;
            inputBox.value = options.value;
            if (options.busy) {
                inputBox.busy = options.busy;
            }
            if (options.enabled) {
                inputBox.enabled = options.enabled;
            }
            inputBox.ignoreFocusOut = options.ignoreFocusOut;
            inputBox.contextKey = options.contextKey;
            if (options.password) {
                inputBox.password = options.password;
            }
            inputBox.step = options.step;
            inputBox.title = options.title;
            inputBox.description = options.description;
            inputBox.totalSteps = options.totalSteps;
            inputBox.buttons = options.buttons ? this.convertToQuickInputButtons(options.buttons) : [];
            inputBox.validationMessage = options.validationMessage;
            if (validateInput) {
                options.validateInput = (val: string) => {
                    this.proxy.$validateInput(val);
                };
            }

            toDispose.push(inputBox.onDidAccept(() => {
                this.proxy.$acceptOnDidAccept(sessionId);
                resolve(inputBox.value);
            }));
            toDispose.push(inputBox.onDidChangeValue((value: string) => {
                this.proxy.$acceptDidChangeValue(sessionId, value);
                inputBox.validationMessage = options.validateInput(value);
            }));
            toDispose.push(inputBox.onDidTriggerButton((button: any) => {
                this.proxy.$acceptOnDidTriggerButton(sessionId, button);
            }));

            toDispose.push(inputBox.onDidHide(() => {
                if (toDispose.disposed) {
                    return;
                }
                this.proxy.$acceptOnDidHide(sessionId);
                toDispose.dispose();
                resolve(undefined);
            }));
            this.toDispose.push(toDispose);

            inputBox.show();
        });
    }

    private sessions = new Map<number, QuickInputSession>();

    $createOrUpdate<T extends theia.QuickPickItem>(params: TransferQuickInput<T>): Promise<void> {
        const sessionId = params.id;
        const session = this.sessions.get(sessionId);
        // if (!session) {
        //     if (params.type === 'quickPick') {
        //         const quickPick = this.quickInputService.createQuickPick();
        //         quickPick.onDidAccept(() => {
        //             this.proxy.$acceptOnDidAccept(sessionId);
        //         });
        //         quickPick.onDidChangeActive((items: Array<monaco.quickInput.IQuickPickItem>) => {
        //             this.proxy.$onDidChangeActive(sessionId, items.map(item => (item as TransferQuickPickItems).handle));
        //         });
        //         quickPick.onDidChangeSelection((items: Array<monaco.quickInput.IQuickPickItem>) => {
        //             this.proxy.$onDidChangeSelection(sessionId, items.map(item => (item as TransferQuickPickItems).handle));
        //         });
        //         quickPick.onDidTriggerButton((button: QuickInputButtonHandle) => {
        //             this.proxy.$acceptOnDidTriggerButton(sessionId, button);
        //         });
        //         quickPick.onDidChangeValue((value: string) => {
        //             this.proxy.$acceptDidChangeValue(sessionId, value);
        //         });
        //         quickPick.onDidHide(() => {
        //             this.proxy.$acceptOnDidHide(sessionId);
        //         });
        //         session = {
        //             input: quickPick,
        //             handlesToItems: new Map()
        //         };
        //     } else {
        //         const inputBox = this.quickInputService.createInputBox();
        //         inputBox.onDidAccept(() => {
        //             this.proxy.$acceptOnDidAccept(sessionId);
        //         });
        //         inputBox.onDidTriggerButton((button: QuickInputButtonHandle) => {
        //             this.proxy.$acceptOnDidTriggerButton(sessionId, button);
        //         });
        //         inputBox.onDidChangeValue((value: string) => {
        //             this.proxy.$acceptDidChangeValue(sessionId, value);
        //         });
        //         inputBox.onDidHide(() => {
        //             this.proxy.$acceptOnDidHide(sessionId);
        //         });
        //         session = {
        //             input: inputBox,
        //             handlesToItems: new Map()
        //         };
        //     }
        // }
        if (session) {
            const { input, handlesToItems } = session;
            for (const param in params) {
                if (param === 'id' || param === 'type') {
                    continue;
                }
                if (param === 'visible') {
                    if (params.visible) {
                        input.show();
                    } else {
                        input.hide();
                    }
                } else if (param === 'items') {
                    handlesToItems.clear();
                    params[param].forEach((item: TransferQuickPickItems) => {
                        handlesToItems.set(item.handle, item);
                    });
                    (input as any)[param] = params[param];
                } else if (param === 'activeItems' || param === 'selectedItems') {
                    (input as any)[param] = params[param]
                        .filter((handle: number) => handlesToItems.has(handle))
                        .map((handle: number) => handlesToItems.get(handle));
                } else if (param === 'buttons') {
                    (input as any)[param] = params.buttons!.map(button => {
                        if (button.handle === -1) {
                            return this.quickInputService.backButton;
                        }
                        const { iconPath, tooltip, handle } = button;
                        if ('id' in iconPath) {
                            return {
                                iconClass: monaco.theme.ThemeIcon.asClassName(iconPath),
                                tooltip,
                                handle
                            };
                        } else {
                            const monacoIconPath = (iconPath as unknown as { light: monaco.Uri, dark: monaco.Uri });
                            return {
                                iconPath: {
                                    dark: monaco.Uri.revive(monacoIconPath.dark),
                                    light: monacoIconPath.light && monaco.Uri.revive(monacoIconPath.light)
                                },
                                tooltip,
                                handle
                            };
                        }
                    });
                } else {
                    (input as any)[param] = params[param];
                }
            }
        }

        return Promise.resolve(undefined);
    }

    async $showCustomQuickPick<T extends QuickPickItemExt>(options: TransferQuickPick<T>): Promise<void> {
        const sessionId = options.id;
        const toDispose = new DisposableCollection();

        toDispose.push(this.quickPickService.onDidAccept(() => {
            this.proxy.$acceptOnDidAccept(sessionId);
        }));
        toDispose.push(this.quickPickService.onDidChangeActive((e: { quickPick: any, activeItems: Array<QuickPickValue<number>> }) => {
            this.proxy.$onDidChangeActive(sessionId, e.activeItems.map(item => item.value!));
        }));
        toDispose.push(this.quickPickService.onDidChangeSelection((e: { quickPick: any, selectedItems: Array<QuickPickValue<number>> }) => {
            this.proxy.$onDidChangeSelection(sessionId, e.selectedItems.map(item => item.value!));
        }));
        toDispose.push(this.quickPickService.onDidChangeValue((e: { quickPick: any, filter: string }) => {
            this.proxy.$acceptDidChangeValue(sessionId, e.filter);
        }));
        toDispose.push(this.quickPickService.onDidTriggerButton(button => {
            this.proxy.$acceptOnDidTriggerButton(sessionId, button);
        }));
        toDispose.push(this.quickPickService.onDidHide(() => {
            this.proxy.$acceptOnDidHide(sessionId);
            if (!toDispose.disposed) {
                toDispose.dispose();
            }
        }));
        this.toDispose.push(toDispose);

        this.quickPickService.show(this.convertToQuickPickItem(options.items), {
            buttons: options.buttons ? this.convertToQuickInputButtons(options.buttons) : [],
            placeholder: options.placeholder,
            matchOnDescription: options.matchOnDescription,
            step: options.step,
            title: options.title,
            totalSteps: options.totalSteps,
            ignoreFocusOut: options.ignoreFocusOut,
            value: options.value,
            matchOnLabel: true,
            runIfSingle: false,
        });
    }

    $hide(): void {
        this.delegate.hide();
    }

    $dispose(sessionId: number): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.input.dispose();
            this.sessions.delete(sessionId);
        }
        return Promise.resolve(undefined);
    }

    private convertToQuickPickItem(items: TransferQuickPickItems[] | undefined): Array<QuickPickItem> {
        const convertedItems: QuickPickValue<number>[] = [];
        if (items) {
            for (const i of items) {
                convertedItems.push({
                    label: i.label,
                    description: i.description,
                    detail: i.detail,
                    value: i.handle
                });
            }
        }
        return convertedItems;
    }

    private convertToQuickInputButtons(buttons: Array<TransferQuickInputButton>): Array<QuickInputButton> {
        return buttons.map((button, i) => ({
            iconPath: getIconUris(button.iconPath),
            tooltip: button.tooltip,
            handle: button === QuickInputButtons.Back ? -1 : i,
        } as QuickInputButton));
    }
}
