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
import { QuickOpenExt, PLUGIN_RPC_CONTEXT as Ext, QuickOpenMain, TransferInputBox, Plugin, TransferQuickPick, QuickInputTitleButtonHandle } from '../common/plugin-api-rpc';
import { QuickPickOptions, QuickPickItem, InputBoxOptions, InputBox, QuickPick, QuickInput, QuickInputButton } from '@theia/plugin';
import { CancellationToken } from '@theia/core/lib/common/cancellation';
import { RPCProtocol } from '../common/rpc-protocol';
import { anyPromise } from '../common/async-util';
import { hookCancellationToken } from '../common/async-util';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { QuickInputButtons, ThemeIcon } from './types-impl';
import URI from 'vscode-uri';
import * as path from 'path';
import { quickPickItemToPickOpenItem } from './type-converters';
import { QuickOpenItem, QuickOpenItemOptions } from '@theia/core/lib/browser/quick-open/quick-open-model';
import { PluginPackage } from '../common/plugin-protocol';

export type Item = string | QuickPickItem;

export class QuickOpenExtImpl implements QuickOpenExt {
    private proxy: QuickOpenMain;
    private selectItemHandler: undefined | ((handle: number) => void);
    private validateInputHandler: undefined | ((input: string) => string | PromiseLike<string | undefined> | undefined);

    private createdQuickInputs = new Map<number, QuickInputExt>(); // Each quickinput will have a number so that we know where to fire events
    private currentQuickInputs = 0;

    constructor(rpc: RPCProtocol) {
        this.proxy = rpc.getProxy(Ext.QUICK_OPEN_MAIN);
    }
    $onItemSelected(handle: number): void {
        if (this.selectItemHandler) {
            this.selectItemHandler(handle);
        }
    }
    $validateInput(input: string): PromiseLike<string | undefined> | undefined {
        if (this.validateInputHandler) {
            return Promise.resolve(this.validateInputHandler(input));
        }
        return undefined;
    }

    showQuickPick(promiseOrItems: QuickPickItem[] | PromiseLike<QuickPickItem[]>, options?: QuickPickOptions, token?: CancellationToken): PromiseLike<QuickPickItem | undefined>;
    // tslint:disable-next-line:max-line-length
    showQuickPick(promiseOrItems: QuickPickItem[] | PromiseLike<QuickPickItem[]>, options?: QuickPickOptions & { canSelectMany: true; }, token?: CancellationToken): PromiseLike<QuickPickItem[] | undefined>;
    showQuickPick(promiseOrItems: string[] | PromiseLike<string[]>, options?: QuickPickOptions, token?: CancellationToken): PromiseLike<string | undefined>;
    // tslint:disable-next-line:max-line-length
    showQuickPick(promiseOrItems: Item[] | PromiseLike<Item[]>, options?: QuickPickOptions, token: CancellationToken = CancellationToken.None): PromiseLike<Item | Item[] | undefined> {
        this.selectItemHandler = undefined;
        const itemPromise = Promise.resolve(promiseOrItems);
        const widgetPromise = this.proxy.$show({
            canSelectMany: options && options.canPickMany,
            placeHolder: options && options.placeHolder,
            autoFocus: { autoFocusFirstEntry: true },
            matchOnDescription: options && options.matchOnDescription,
            matchOnDetail: options && options.matchOnDetail,
            ignoreFocusLost: options && options.ignoreFocusOut
        });

        const promise = anyPromise(<PromiseLike<number | Item[]>[]>[widgetPromise, itemPromise]).then(values => {
            if (values.key === 0) {
                return undefined;
            }
            return itemPromise.then(items => {

                const pickItems = quickPickItemToPickOpenItem(items);

                if (options && typeof options.onDidSelectItem === 'function') {
                    this.selectItemHandler = handle => {
                        options.onDidSelectItem!(items[handle]);
                    };
                }

                this.proxy.$setItems(pickItems);

                return widgetPromise.then(handle => {
                    if (typeof handle === 'number') {
                        if (options && options.canPickMany) {
                            return Array.of(items[handle]);
                        } else {
                            return items[handle];
                        }

                    } else if (Array.isArray(handle)) {
                        return handle.map(h => items[h]);
                    }
                    return undefined;
                });
            }, err => {
                this.proxy.$setError(err);
                return Promise.reject(err);
            });
        });
        return hookCancellationToken<Item | Item[] | undefined>(token, promise);
    }

    showCustomQuickPick<T extends QuickPickItem>(options: TransferQuickPick<T>): void {
        this.proxy.$showCustomQuickPick(options);
    }

    createQuickPick<T extends QuickPickItem>(plugin: Plugin): QuickPick<T> {
        const newQuickInput = new QuickPickExt<T>(this, this.proxy, plugin, this.currentQuickInputs);
        this.createdQuickInputs.set(this.currentQuickInputs, newQuickInput);
        this.currentQuickInputs += 1;
        return newQuickInput;
    }

    showInput(options?: InputBoxOptions, token: CancellationToken = CancellationToken.None): PromiseLike<string | undefined> {
        this.validateInputHandler = options && options.validateInput;

        if (!options) {
            options = {
                placeHolder: ''
            };
        }

        const promise = this.proxy.$input(options, typeof this.validateInputHandler === 'function');
        return hookCancellationToken(token, promise);
    }

    hide(): void {
        this.proxy.$hide();
    }
    showInputBox(options: TransferInputBox): void {
        this.validateInputHandler = options && options.validateInput;
        this.proxy.$showInputBox(options, typeof this.validateInputHandler === 'function');
    }

    createInputBox(plugin: Plugin): InputBox {
        const newQuickInput = new InputBoxExt(this, this.proxy, plugin, this.currentQuickInputs);
        this.createdQuickInputs.set(this.currentQuickInputs, newQuickInput);
        this.currentQuickInputs += 1;
        return newQuickInput;
    }

    async $acceptOnDidAccept(createdQuickInputNumber: number): Promise<void> {
        const currentQuickInput = this.createdQuickInputs.get(createdQuickInputNumber);
        if (currentQuickInput) {
            currentQuickInput._fireAccept();
        }
    }

    async $acceptDidChangeValue(createdQuickInputNumber: number, changedValue: string): Promise<void> {
        const currentQuickInput = this.createdQuickInputs.get(createdQuickInputNumber);
        if (currentQuickInput) {
            currentQuickInput._fireChangedValue(changedValue);
        }
    }

    async $acceptOnDidHide(createdQuickInputNumber: number): Promise<void> {
        const currentQuickInput = this.createdQuickInputs.get(createdQuickInputNumber);
        if (currentQuickInput) {
            currentQuickInput._fireHide();
        }
    }

    async $acceptOnDidTriggerButton(createdQuickInputNumber: number, btn: QuickInputTitleButtonHandle): Promise<void> {
        const thisQuickInput = this.createdQuickInputs.get(createdQuickInputNumber);
        if (thisQuickInput) {
            if (btn.index === -1) {
                thisQuickInput._fireButtonTrigger(QuickInputButtons.Back);
            } else if (thisQuickInput && (thisQuickInput instanceof InputBoxExt || thisQuickInput instanceof QuickPickExt)) {
                const btnFromIndex = thisQuickInput.buttons[btn.index];
                thisQuickInput._fireButtonTrigger(btnFromIndex as QuickInputButton);
            }
        }
    }

    async $acceptDidChangeActive(createdQuickInputNumber: number, changedItems: QuickOpenItem<QuickOpenItemOptions>[]): Promise<void> {
        const thisQuickInput = this.createdQuickInputs.get(createdQuickInputNumber);
        if (thisQuickInput && thisQuickInput instanceof QuickPickExt) {
            thisQuickInput._fireChangedActiveItem(changedItems);
        }
    }

    async $acceptDidChangeSelection(createdQuickInputNumber: number, selection: string): Promise<void> {
        const currentQuickInput = this.createdQuickInputs.get(createdQuickInputNumber);
        if (currentQuickInput && currentQuickInput instanceof QuickPickExt) {
            // Find the item that matches that particular label
            const findMatchingItem = currentQuickInput.items.filter(x => x.label === selection);
            currentQuickInput._fireChangedSelection(findMatchingItem);
        }
    }
}

export class QuickInputExt implements QuickInput {

    private _busy: boolean;
    private _enabled: boolean;
    private _ignoreFocusOut: boolean;
    private _step: number | undefined;
    private _title: string | undefined;
    private _totalSteps: number | undefined;
    private _value: string;

    protected visible: boolean;

    protected disposableCollection: DisposableCollection;

    private onDidAcceptEmitter: Emitter<void>;
    private onDidChangeValueEmitter: Emitter<string>;
    private onDidHideEmitter: Emitter<void>;
    private onDidTriggerButtonEmitter: Emitter<QuickInputButton>;

    constructor(readonly quickOpen: QuickOpenExtImpl, readonly quickOpenMain: QuickOpenMain, readonly plugin: Plugin) {
        this.title = undefined;
        this.step = undefined;
        this.totalSteps = undefined;
        this.enabled = true;
        this.busy = false;
        this.ignoreFocusOut = false;
        this.value = '';

        this.visible = false;

        this.disposableCollection = new DisposableCollection();
        this.disposableCollection.push(this.onDidAcceptEmitter = new Emitter());
        this.disposableCollection.push(this.onDidChangeValueEmitter = new Emitter());
        this.disposableCollection.push(this.onDidHideEmitter = new Emitter());
        this.disposableCollection.push(this.onDidTriggerButtonEmitter = new Emitter());
    }

    get title(): string | undefined {
        return this._title;
    }

    set title(title: string | undefined) {
        this._title = title;
        this.update({ title });
    }

    get step(): number | undefined {
        return this._step;
    }

    set step(step: number | undefined) {
        this._step = step;
        this.update({ step });
    }

    get totalSteps(): number | undefined {
        return this._totalSteps;
    }

    set totalSteps(totalSteps: number | undefined) {
        this._totalSteps = totalSteps;
        this.update({ totalSteps });
    }

    get enabled(): boolean {
        return this._enabled;
    }

    set enabled(enabled: boolean) {
        this._enabled = enabled;
        this.update({ enabled });
    }

    get busy(): boolean {
        return this._busy;
    }

    set busy(busy: boolean) {
        this._busy = busy;
        this.update({ busy });
    }

    get ignoreFocusOut(): boolean {
        return this._ignoreFocusOut;
    }

    set ignoreFocusOut(ignoreFocusOut: boolean) {
        this._ignoreFocusOut = ignoreFocusOut;
        this.update({ ignoreFocusOut });
    }

    get value(): string {
        return this._value;
    }

    set value(value: string) {
        this._value = value;
        this.update({ value });
    }

    show(): void {
        throw new Error('Method implementation must be provided by extenders');
    }

    dispose(): void {
        this.disposableCollection.dispose();
    }

    protected update(changed: object): void {
        /**
         * The args are just going to be set when we call show for the first time.
         * We return early when its invisible to avoid race condition
         */
        if (!this.visible || changed === undefined) {
            return;
        }

        this.quickOpenMain.$setQuickInputChanged(changed);
    }

    hide(): void {
        this.quickOpen.hide();
        this.dispose();
    }

    protected convertURL(iconPath: QuickInputButton['iconPath']): URI | { light: string | URI; dark: string | URI } | ThemeIcon {
        const toUrl = (arg: string | URI) => {
            arg = arg instanceof URI && arg.scheme === 'file' ? arg.fsPath : arg;
            if (typeof arg !== 'string') {
                return arg.toString(true);
            }
            const { packagePath } = this.plugin.rawModel;
            const absolutePath = path.isAbsolute(arg) ? arg : path.join(packagePath, arg);
            const normalizedPath = path.normalize(absolutePath);
            const relativePath = path.relative(packagePath, normalizedPath);
            return PluginPackage.toPluginUrl(this.plugin.rawModel, relativePath);
        };
        if ('id' in iconPath || iconPath instanceof ThemeIcon) {
            return iconPath;
        } else if (typeof iconPath === 'string' || iconPath instanceof URI) {
            return URI.parse(toUrl(iconPath));
        } else {
            const { light, dark } = iconPath as { light: string | URI, dark: string | URI };
            return {
                light: toUrl(light),
                dark: toUrl(dark)
            };
        }
    }

    _fireAccept(): void {
        this.onDidAcceptEmitter.fire(undefined);
    }

    _fireChangedValue(changedValue: string): void {
        this.onDidChangeValueEmitter.fire(changedValue);
    }

    _fireHide(): void {
        this.onDidHideEmitter.fire(undefined);
    }

    _fireButtonTrigger(btn: QuickInputButton): void {
        this.onDidTriggerButtonEmitter.fire(btn);
    }

    get onDidHide(): Event<void> {
        return this.onDidHideEmitter.event;
    }

    get onDidAccept(): Event<void> {
        return this.onDidAcceptEmitter.event;
    }

    get onDidChangeValue(): Event<string> {
        return this.onDidChangeValueEmitter.event;
    }

    get onDidTriggerButton(): Event<QuickInputButton> {
        return this.onDidTriggerButtonEmitter.event;
    }
}

/**
 * Base implementation of {@link InputBox} that uses {@link QuickOpenExt}.
 * Missing functionality is going to be implemented in the scope of https://github.com/eclipse-theia/theia/issues/5109
 */
export class InputBoxExt extends QuickInputExt implements InputBox {

    /**
     * Input Box API Start
     */
    private _placeholder: string | undefined;
    private _password: boolean;

    private _buttons: ReadonlyArray<QuickInputButton>;
    private _prompt: string | undefined;
    private _validationMessage: string | undefined;
    /**
     * Input Box API End
     */

    constructor(readonly quickOpen: QuickOpenExtImpl,
        readonly quickOpenMain: QuickOpenMain,
        readonly plugin: Plugin,
        readonly quickInputIndex: number) {

        super(quickOpen, quickOpenMain, plugin);

        this.buttons = [];
        this.password = false;
        this.value = '';
    }

    get buttons(): ReadonlyArray<QuickInputButton> {
        return this._buttons;
    }

    set buttons(buttons: ReadonlyArray<QuickInputButton>) {
        this._buttons = buttons;
        this.update({ buttons });
    }

    get password(): boolean {
        return this._password;
    }

    set password(password: boolean) {
        this._password = password;
        this.update({ password });
    }

    get placeholder(): string | undefined {
        return this._placeholder;
    }

    set placeholder(placeholder: string | undefined) {
        this._placeholder = placeholder;
        this.update({ placeholder });
    }

    get prompt(): string | undefined {
        return this._prompt;
    }

    set prompt(prompt: string | undefined) {
        this._prompt = prompt;
        this.update({ prompt });
    }

    get validationMessage(): string | undefined {
        return this._validationMessage;
    }

    set validationMessage(validationMessage: string | undefined) {
        if (this._validationMessage !== validationMessage) {
            this._validationMessage = validationMessage;
            this.update({ validationMessage });
            this.quickOpenMain.$refreshQuickInput();
        }
    }

    show(): void {
        this.visible = true;
        const update = (value: string) => {
            this.value = value;
            // this.onDidChangeValueEmitter.fire(value);
            if (this.validationMessage && this.validationMessage.length > 0) {
                return this.validationMessage;
            }
        };
        this.quickOpen.showInputBox({
            quickInputIndex: this.quickInputIndex,
            busy: this.busy,
            buttons: this.buttons.map(btn => ({
                'iconPath': this.convertURL(btn.iconPath),
                'tooltip': btn.tooltip
            })),
            enabled: this.enabled,
            ignoreFocusOut: this.ignoreFocusOut,
            password: this.password,
            placeholder: this.placeholder,
            prompt: this.prompt,
            step: this.step,
            title: this.title,
            totalSteps: this.totalSteps,
            validationMessage: this.validationMessage,
            value: this.value,
            validateInput(value: string): string | undefined {
                if (value.length > 0) {
                    return update(value);
                }
            }
        });
    }
}

/**
 * Base implementation of {@link QuickPick} that uses {@link QuickOpenExt}.
 * Missing functionality is going to be implemented in the scope of https://github.com/eclipse-theia/theia/issues/5059
 */
export class QuickPickExt<T extends QuickPickItem> extends QuickInputExt implements QuickPick<T> {

    buttons: ReadonlyArray<QuickInputButton>;
    canSelectMany: boolean;
    matchOnDescription: boolean;
    matchOnDetail: boolean;
    selectedItems: ReadonlyArray<T>;
    value: string;

    private _items: T[];
    private _activeItems: T[];
    private _placeholder: string | undefined;
    private readonly onDidChangeActiveEmitter: Emitter<T[]>;
    private readonly onDidChangeSelectionEmitter: Emitter<T[]>;

    constructor(readonly quickOpen: QuickOpenExtImpl,
        readonly quickOpenMain: QuickOpenMain,
        readonly plugin: Plugin,
        readonly quickInputIndex: number) {

        super(quickOpen, quickOpenMain, plugin);
        this._items = [];
        this._activeItems = [];
        this._placeholder = '';
        this.buttons = [];
        this.value = '';

        this.disposableCollection.push(this.onDidChangeActiveEmitter = new Emitter());
        this.disposableCollection.push(this.onDidChangeSelectionEmitter = new Emitter());
    }

    get items(): T[] {
        return this._items;
    }

    set items(items: T[]) {
        this._items = items;
        this.update({ items });
    }

    get activeItems(): T[] {
        return this._activeItems;
    }

    set activeItems(activeItems: T[]) {
        this._activeItems = activeItems;
        this.update({ activeItems });
    }

    get placeholder(): string | undefined {
        return this._placeholder;
    }

    set placeholder(placeholder: string | undefined) {
        this._placeholder = placeholder;
        this.update({ placeholder });
    }

    _fireChangedSelection(selections: T[]): void {
        this.onDidChangeSelectionEmitter.fire(selections);
    }

    _fireChangedActiveItem(changedItems: QuickOpenItem<QuickOpenItemOptions>[]): void {
        this.onDidChangeActiveEmitter.fire(changedItems as unknown as T[]);
    }

    get onDidChangeActive(): Event<T[]> {
        return this.onDidChangeActiveEmitter.event;
    }

    get onDidChangeSelection(): Event<T[]> {
        return this.onDidChangeSelectionEmitter.event;
    }

    show(): void {
        this.visible = true;
        this.quickOpen.showCustomQuickPick({
            quickInputIndex: this.quickInputIndex,
            title: this.title,
            step: this.step,
            totalSteps: this.totalSteps,
            enabled: this.enabled,
            busy: this.busy,
            ignoreFocusOut: this.ignoreFocusOut,
            value: this.value,
            placeholder: this.placeholder,
            buttons: this.buttons.map(btn => ({
                'iconPath': this.convertURL(btn.iconPath),
                'tooltip': btn.tooltip
            })),
            items: quickPickItemToPickOpenItem(this.items),
            canSelectMany: this.canSelectMany,
            matchOnDescription: this.matchOnDescription,
            matchOnDetail: this.matchOnDetail,
            activeItems: this.activeItems,
            selectedItems: this.selectedItems
        });
    }

}
