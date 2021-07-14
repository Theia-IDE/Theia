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
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
    InputBox, InputOptions, KeybindingRegistry, PickOptions,
    QuickInputButton, QuickInputService, QuickPick, QuickPickItem, QuickPickItemButtonEvent, QuickPickItemHighlights, QuickPickOptions, QuickPickSeparator
} from '@theia/core/lib/browser';
import { CancellationToken, Event } from '@theia/core/lib/common';
import { injectable, inject } from '@theia/core/shared/inversify';
import { MonacoResolvedKeybinding } from './monaco-resolved-keybinding';

@injectable()
export class MonacoQuickInputService implements QuickInputService {
    private monacoService: MonacoQuickInputImplementation;

    @inject(monaco.contextKeyService.ContextKeyService)
    protected readonly contextKeyService: monaco.contextKeyService.ContextKeyService;

    @inject(KeybindingRegistry)
    protected readonly keybindingRegistry: KeybindingRegistry;

    constructor() {
        this.monacoService = new MonacoQuickInputImplementation(this.contextKeyService);
    }

    get backButton(): QuickInputButton {
        return this.monacoService.backButton;
    }

    get onShow(): Event<void> { return this.monacoService.onShow; }
    get onHide(): Event<void> { return this.monacoService.onHide; }

    open(filter: string): void {
        this.monacoService.open(filter);
    }

    createInputBox(): InputBox {
        return this.monacoService.createInputBox();
    }

    input(options?: InputOptions, token?: CancellationToken): Promise<string | undefined> {
        return this.monacoService.input();
    }
    pick<T extends QuickPickItem, O extends PickOptions<T>>(picks: T[] | Promise<T[]>, options?: O, token?: CancellationToken):
        Promise<(O extends { canPickMany: true; } ? T[] : T) | undefined> {
        return this.monacoService.pick(picks, options, token);
    }

    showQuickPick<T extends QuickPickItem>(items: T[], options?: QuickPickOptions<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const quickPick = this.monacoService.createQuickPick<MonacoQuickPickItem<T>>();
            const wrapped = this.wrapQuickPick(quickPick);

            if (options) {
                wrapped.canSelectMany = !!options.canSelectMany;
                wrapped.contextKey = options.contextKey;
                wrapped.description = options.description;
                wrapped.enabled = options.enabled ?? true;
                wrapped.ignoreFocusOut = !!options.ignoreFocusOut;
                wrapped.matchOnDescription = options.matchOnDescription ?? true;
                wrapped.matchOnDetail = options.matchOnDetail ?? true;
                wrapped.placeholder = options.placeholder;
                wrapped.step = options.step;
                wrapped.title = options.title;
                wrapped.totalSteps = options.totalSteps;

                if (options.activeItem) {
                    wrapped.activeItems = [options.activeItem];
                }

                wrapped.onDidAccept(() => {
                    if (options?.onDidAccept) {
                        options.onDidAccept();
                    }
                    wrapped.hide();
                    resolve(wrapped.selectedItems[0]);
                });

                wrapped.onDidHide(() => {
                    if (options.onDidHide) {
                        options.onDidHide();
                    };
                    wrapped.dispose();
                });
                wrapped.onDidChangeValue((filter: string) => {
                    if (options.onDidChangeValue) {
                        options.onDidChangeValue(wrapped, filter);
                    }
                });
                wrapped.onDidChangeActive((activeItems: Array<T>) => {
                    if (options.onDidChangeActive) {
                        options.onDidChangeActive(wrapped, activeItems);
                    }
                });
                wrapped.onDidTriggerButton((button: monaco.quickInput.IQuickInputButton) => {
                    if (options.onDidTriggerButton) {
                        options.onDidTriggerButton(button);
                    }
                });
                wrapped.onDidTriggerItemButton((evt: QuickPickItemButtonEvent<T>) => {
                    if (options.onDidTriggerItemButton) {
                        options.onDidTriggerItemButton(evt);
                    }
                });
                wrapped.onDidChangeSelection((selectedItems: Array<T>) => {
                    if (options.onDidChangeSelection) {
                        options.onDidChangeSelection(wrapped, selectedItems);
                    }
                });
            }

            wrapped.items = items;
            wrapped.show();
        }).then(item => {
            if (item?.execute) {
                item.execute();
            }
            return item;
        });
    }
    wrapQuickPick<T extends QuickPickItem>(wrapped: monaco.quickInput.IQuickPick<MonacoQuickPickItem<T>>): QuickPick<T> {
        return new MonacoQuickPick(wrapped, this.keybindingRegistry);
    }

    protected convertItems<T extends QuickPickItem>(item: T): MonacoQuickPickItem<T> {
        return new MonacoQuickPickItem(item, this.keybindingRegistry);
    }

    hide(): void {
        return this.monacoService.hide();
    }
}

@injectable()
export class MonacoQuickInputImplementation implements monaco.quickInput.IQuickInputService {

    controller: monaco.quickInput.QuickInputController;
    quickAccess: monaco.quickInput.IQuickAccessController;

    protected container: HTMLElement;
    private quickInputList: monaco.list.List<monaco.list.IListElement>;

    get backButton(): monaco.quickInput.IQuickInputButton { return this.controller.backButton; }
    get onShow(): Event<void> { return this.controller.onShow; }
    get onHide(): Event<void> { return this.controller.onHide; }

    constructor(protected readonly contextKeyService: monaco.contextKeyService.ContextKeyService) {
        this.initContainer();
        this.initController();
        this.quickAccess = new monaco.quickInput.QuickAccessController(this, monaco.services.StaticServices.instantiationService.get());
    }

    setContextKey(key: string | undefined): void {
        if (key) {
            this.contextKeyService.createKey<string>(key, undefined);
        }
    }

    createQuickPick<T extends monaco.quickInput.IQuickPickItem>(): monaco.quickInput.IQuickPick<T> {
        return this.controller.createQuickPick<T>();
    }

    createInputBox(): monaco.quickInput.IInputBox {
        return this.controller.createInputBox();
    }

    open(filter: string): void {
        this.quickAccess.show(filter);
        setTimeout(() => {
            this.quickInputList.focusNth(0);
        }, 300);
    }

    input(options?: monaco.quickInput.IInputOptions, token?: CancellationToken): Promise<string | undefined> {
        return this.controller.input(options, token);
    }

    pick<T extends monaco.quickInput.IQuickPickItem, O extends monaco.quickInput.IPickOptions<T>>(
        picks: Promise<T[]> | T[], options: O = <O>{}, token?: CancellationToken): Promise<(O extends { canPickMany: true } ? T[] : T) | undefined> {
        return this.controller.pick(picks, options, token);
    }

    hide(): void {
        this.controller.hide();
    }

    focus(): void {
        this.controller.focus();
    }

    toggle(): void {
        this.controller.toggle();
    }

    applyStyles(styles: monaco.quickInput.IQuickInputStyles): void {
        this.controller.applyStyles(styles);
    }

    layout(dimension: monaco.editor.IDimension, titleBarOffset: number): void {
        this.controller.layout(dimension, titleBarOffset);
    }

    navigate?(next: boolean, quickNavigate?: monaco.quickInput.IQuickNavigateConfiguration): void {
        this.controller.navigate(next, quickNavigate);
    }

    dispose(): void {
        this.controller.dispose();
    }

    async cancel(): Promise<void> {
        this.controller.cancel();
    }

    async back(): Promise<void> {
        this.controller.back();
    }

    async accept?(keyMods?: monaco.quickInput.IKeyMods): Promise<void> {
        this.controller.accept(keyMods);
    }

    private initContainer(): void {
        const overlayWidgets = document.createElement('div');
        overlayWidgets.classList.add('quick-input-overlay');
        document.body.appendChild(overlayWidgets);
        const container = this.container = document.createElement('quick-input-container');
        container.style.position = 'absolute';
        container.style.top = '0px';
        container.style.right = '50%';
        container.style.zIndex = '1000000';
        overlayWidgets.appendChild(container);
    }

    private initController(): void {
        this.controller = new monaco.quickInput.QuickInputController(this.getOptions());
        this.controller.layout({ width: 600, height: 1200 }, 0);
    }

    private getOptions(): monaco.quickInput.IQuickInputOptions {
        return {
            idPrefix: 'quickInput_',
            container: this.container,
            ignoreFocusOut: () => false,
            isScreenReaderOptimized: () => true,
            backKeybindingLabel: () => undefined,
            setContextKey: (id?: string) => this.setContextKey(id),
            returnFocus: () => this.container.focus(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            createList: (user: string, containr: HTMLElement, delegate: any, renderers: any, options: any) => {
                this.quickInputList = new monaco.list.List(user, containr, delegate, renderers, options);
                return this.quickInputList;
            },
            styles: {
                widget: {},
                list: {},
                inputBox: {},
                countBadge: {},
                button: {},
                progressBar: {}
            }
        };
    }
}

class MonacoQuickInput {
    constructor(protected readonly wrapped: monaco.quickInput.IQuickInput) {
    }

    readonly onDidHide: Event<void> = this.wrapped.onDidHide;
    readonly onDispose: Event<void> = this.wrapped.onDispose;

    get title(): string | undefined {
        return this.wrapped.title;
    }

    set title(v: string | undefined) {
        this.wrapped.title = v;
    }

    get description(): string | undefined {
        return this.wrapped.description;
    }

    set description(v: string | undefined) {
        this.wrapped.description = v;
    }
    get step(): number | undefined {
        return this.wrapped.step;
    }

    set step(v: number | undefined) {
        this.wrapped.step = v;
    }

    get enabled(): boolean {
        return this.wrapped.enabled;
    }

    set enabled(v: boolean) {
        this.wrapped.enabled = v;
    }
    get totalSteps(): number | undefined {
        return this.wrapped.totalSteps;
    }

    set totalSteps(v: number | undefined) {
        this.wrapped.totalSteps = v;
    }
    get contextKey(): string | undefined {
        return this.wrapped.contextKey;
    }

    set contextKey(v: string | undefined) {
        this.wrapped.contextKey = v;
    }

    get busy(): boolean {
        return this.wrapped.busy;
    }

    set busy(v: boolean) {
        this.wrapped.busy = v;
    }

    get ignoreFocusOut(): boolean {
        return this.wrapped.ignoreFocusOut;
    }

    set ignoreFocusOut(v: boolean) {
        this.wrapped.ignoreFocusOut = v;
    }

    show(): void {
        this.wrapped.show();
    }
    hide(): void {
        this.wrapped.hide();
    }
    dispose(): void {
        this.wrapped.dispose();
    }

}

class MonacoQuickPick<T extends QuickPickItem> extends MonacoQuickInput implements QuickPick<T> {
    constructor(protected readonly wrapped: monaco.quickInput.IQuickPick<MonacoQuickPickItem<T>>, protected readonly keybindingRegistry: KeybindingRegistry) {
        super(wrapped);
    }

    get value(): string {
        return this.wrapped.value;
    };

    set value(v: string) {
        this.wrapped.value = v;
    }

    get placeholder(): string | undefined {
        return this.wrapped.placeholder;
    }

    set placeholder(v: string | undefined) {
        this.wrapped.placeholder = v;
    }

    get canSelectMany(): boolean {
        return this.wrapped.canSelectMany;
    }

    set canSelectMany(v: boolean) {
        this.wrapped.canSelectMany = v;
    }

    get matchOnDescription(): boolean {
        return this.wrapped.matchOnDescription;
    }

    set matchOnDescription(v: boolean) {
        this.wrapped.matchOnDescription = v;
    }

    get matchOnDetail(): boolean {
        return this.wrapped.matchOnDetail;
    }

    set matchOnDetail(v: boolean) {
        this.wrapped.matchOnDetail = v;
    }

    get items(): readonly (T | QuickPickSeparator)[] {
        return this.wrapped.items.map(item => QuickPickSeparator.is(item) ? item : item.item);
    }

    set items(itms: readonly (T | QuickPickSeparator)[]) {
        this.wrapped.items = itms.map(item => QuickPickSeparator.is(item) ? item : new MonacoQuickPickItem<T>(item, this.keybindingRegistry));
    }

    set activeItems(itms: readonly T[]) {
        this.wrapped.activeItems = itms.map(item => new MonacoQuickPickItem<T>(item, this.keybindingRegistry));
    }

    get activeItems(): readonly (T)[] {
        return this.wrapped.activeItems.map(item => item.item);
    }

    set selectedItems(itms: readonly T[]) {
        this.wrapped.selectedItems = itms.map(item => new MonacoQuickPickItem<T>(item, this.keybindingRegistry));
    }

    get selectedItems(): readonly (T)[] {
        return this.wrapped.selectedItems.map(item => item.item);
    }

    readonly onDidAccept: Event<void> = this.wrapped.onDidAccept;
    readonly onDidChangeValue: Event<string> = this.wrapped.onDidChangeValue;
    readonly onDidTriggerButton: Event<QuickInputButton> = this.wrapped.onDidTriggerButton;
    readonly onDidTriggerItemButton: Event<QuickPickItemButtonEvent<T>> =
        Event.map(this.wrapped.onDidTriggerItemButton, (evt: monaco.quickInput.IQuickPickItemButtonEvent<MonacoQuickPickItem<T>>) => ({
            item: evt.item.item,
            button: evt.button
        }));
    readonly onDidChangeActive: Event<T[]> = Event.map(this.wrapped.onDidChangeActive, (items: MonacoQuickPickItem<T>[]) => items.map(item => item.item));
    readonly onDidChangeSelection: Event<T[]> = Event.map(this.wrapped.onDidChangeSelection, (items: MonacoQuickPickItem<T>[]) => items.map(item => item.item));
}

export class MonacoQuickPickItem<T extends QuickPickItem> implements monaco.quickInput.IQuickPickItem {
    readonly type?: 'item' | 'separator';
    readonly id?: string;
    readonly label: string;
    readonly meta?: string;
    readonly ariaLabel?: string;
    readonly description?: string;
    readonly detail?: string;
    readonly keybinding?: monaco.keybindings.ResolvedKeybinding;
    readonly iconClasses?: string[];
    buttons?: monaco.quickInput.IQuickInputButton[];
    readonly alwaysShow?: boolean;
    readonly highlights?: QuickPickItemHighlights;

    constructor(readonly item: T, kbRegistry: KeybindingRegistry) {
        this.type = item.type;
        this.id = item.id;
        this.label = item.label;
        this.meta = item.meta;
        this.ariaLabel = item.ariaLabel;
        this.description = item.description;
        this.detail = item.detail;
        this.keybinding = item.keySequence ? new MonacoResolvedKeybinding(item.keySequence, kbRegistry) : undefined;
        this.iconClasses = item.iconClasses;
        this.buttons = item.buttons;
        this.alwaysShow = item.alwaysShow;
        this.highlights = item.highlights;
    }

    accept(): void {
        if (this.item.execute) {
            this.item.execute();
        }
    }
}

