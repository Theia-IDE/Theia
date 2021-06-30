/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
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

import { injectable, inject, optional, postConstruct } from '@theia/core/shared/inversify';
import { MessageType } from '@theia/core/lib/common/message-service-protocol';
import {
    QuickOpenService, QuickOpenOptions, QuickOpenItem, QuickOpenGroupItem,
    QuickOpenMode, KeySequence, KeybindingRegistry
} from '@theia/core/lib/browser';
import { QuickOpenModel, QuickOpenActionProvider, QuickOpenAction } from '@theia/core/lib/common/quick-open-model';
import { ContextKey } from '@theia/core/lib/browser/context-key-service';
import { MonacoContextKeyService } from './monaco-context-key-service';
import { QuickOpenHideReason } from '@theia/core/lib/common/quick-open-service';
import { MonacoResolvedKeybinding } from './monaco-resolved-keybinding';
import { BrowserMenuBarContribution } from '@theia/core/lib/browser/menu/browser-menu-plugin';
import { compareEntries, setFileNameComparer } from './monaco-comparers';

export interface MonacoQuickOpenControllerOpts extends monaco.quickOpen.IQuickOpenControllerOpts {
    valueSelection?: Readonly<[number, number]>;
    enabled?: boolean;
    readonly prefix?: string;
    readonly password?: boolean;
    readonly ignoreFocusOut?: boolean;
    onType?(lookFor: string, acceptor: (model: monaco.quickOpen.QuickOpenModel) => void): void;
    onClose?(canceled: boolean): void;
}

@injectable()
export class MonacoQuickOpenService extends QuickOpenService {

    protected readonly container: HTMLElement;
    protected _widget: monaco.quickOpen.QuickOpenWidget | undefined;
    protected opts: MonacoQuickOpenControllerOpts | undefined;
    protected previousActiveElement: Element | undefined;
    protected _widgetNode: HTMLElement;

    @inject(MonacoContextKeyService)
    protected readonly contextKeyService: MonacoContextKeyService;

    @inject(KeybindingRegistry)
    protected readonly keybindingRegistry: KeybindingRegistry;

    @inject(BrowserMenuBarContribution) @optional()
    protected readonly browserMenuBarContribution?: BrowserMenuBarContribution;

    protected inQuickOpenKey: ContextKey<boolean>;

    constructor() {
        super();
        const overlayWidgets = document.createElement('div');
        overlayWidgets.classList.add('quick-open-overlay');
        document.body.appendChild(overlayWidgets);

        const container = this.container = document.createElement('quick-open-container');
        container.style.position = 'absolute';
        container.style.top = '0px';
        container.style.right = '50%';
        container.style.zIndex = '1000000';
        overlayWidgets.appendChild(container);
    }

    @postConstruct()
    protected init(): void {
        this.inQuickOpenKey = this.contextKeyService.createKey<boolean>('inQuickOpen', false);

        setFileNameComparer(new monaco.async.IdleValue(() => {
            const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
            const isNumeric = collator.resolvedOptions().numeric;
            return {
                collator: collator,
                collatorIsNumeric: isNumeric
            };
        }));
    }

    open(model: QuickOpenModel, options?: QuickOpenOptions): void {
        this.internalOpen(new MonacoQuickOpenControllerOptsImpl(model, this.keybindingRegistry, options));
    }

    hide(reason?: QuickOpenHideReason): void {
        this.widget.hide(reason as number);
    }

    showDecoration(type: MessageType): void {
        let decoration = monaco.MarkerSeverity.Info;
        if (type === MessageType.Warning) {
            decoration = monaco.MarkerSeverity.Warning;
        } else if (type === MessageType.Error) {
            decoration = monaco.MarkerSeverity.Error;
        }
        this.showInputDecoration(decoration);
    }
    hideDecoration(): void {
        this.clearInputDecoration();
    }

    refresh(): void {
        const inputBox = this.widget.inputBox;
        if (inputBox) {
            this.onType(inputBox.inputElement.value);
        }
    }

    internalOpen(opts: MonacoQuickOpenControllerOpts): void {
        const browserMenuBarContribution = this.browserMenuBarContribution;
        if (browserMenuBarContribution) {
            const browserMenuBar = browserMenuBarContribution.menuBar;
            if (browserMenuBar) {
                const activeMenu = browserMenuBar.activeMenu;
                if (activeMenu) {
                    activeMenu.close();
                }
            }
        }

        // eslint-disable-next-line no-null/no-null
        if (this.widgetNode && this.widgetNode.offsetParent !== null) {
            this.hide();
        }
        this.opts = opts;
        const activeContext = window.document.activeElement || undefined;
        if (!activeContext || !this.container.contains(activeContext)) {
            this.previousActiveElement = activeContext;
            this.contextKeyService.activeContext = activeContext instanceof HTMLElement ? activeContext : undefined;
        }

        this.hideDecoration();
        this.widget.show(this.opts.prefix || '');
        this.setPlaceHolder(opts.inputAriaLabel);
        this.setPassword(opts.password ? true : false);
        this.setEnabled(opts.enabled);
        this.setValueSelected(opts.inputAriaLabel, opts.valueSelection);
        this.inQuickOpenKey.set(true);

        const widget = this.widget;
        if (widget.inputBox) {
            widget.inputBox.inputElement.tabIndex = 1;
            // Position the cursor at the end of the input unless a user has made a selection.
            if (widget.inputBox.inputElement.selectionStart === widget.inputBox.inputElement.selectionEnd) {
                widget.inputBox.inputElement.selectionStart = widget.inputBox.inputElement.value.length;
            }
        }
    }

    setValueSelected(value: string | undefined, selectLocation: Readonly<[number, number]> | undefined): void {
        if (!value) {
            return;
        }

        const widget = this.widget;
        if (widget.inputBox) {

            if (!selectLocation) {
                widget.inputBox.inputElement.setSelectionRange(0, value.length);
                return;
            }

            if (selectLocation[0] === selectLocation[1]) {
                widget.inputBox.inputElement.setSelectionRange(selectLocation[0], selectLocation[0]);
                return;
            }

            widget.inputBox.inputElement.setSelectionRange(selectLocation[0], selectLocation[1]);
        }
    }

    setEnabled(isEnabled: boolean | undefined): void {
        const widget = this.widget;
        if (widget.inputBox) {
            widget.inputBox.inputElement.readOnly = (isEnabled !== undefined) ? !isEnabled : false;
        }
    }

    setValue(value: string | undefined): void {
        if (this.widget && this.widget.inputBox) {
            this.widget.inputBox.inputElement.value = (value !== undefined) ? value : '';
        }
    }

    setPlaceHolder(placeHolder: string): void {
        const widget = this.widget;
        if (widget.inputBox) {
            widget.inputBox.setPlaceHolder(placeHolder);
        }
    }

    setPassword(isPassword: boolean): void {
        const widget = this.widget;
        if (widget.inputBox) {
            widget.inputBox.inputElement.type = isPassword ? 'password' : 'text';
        }
    }

    showInputDecoration(decoration: monaco.MarkerSeverity): void {
        const widget = this.widget;
        if (widget.inputBox) {
            const type = decoration === monaco.MarkerSeverity.Info ? 1 :
                decoration === monaco.MarkerSeverity.Warning ? 2 : 3;
            widget.inputBox.showMessage({ type, content: '' });
        }
    }

    clearInputDecoration(): void {
        const widget = this.widget;
        if (widget.inputBox) {
            widget.inputBox.hideMessage();
        }
    }

    protected get widget(): monaco.quickOpen.QuickOpenWidget {
        if (this._widget) {
            return this._widget;
        }
        const widget = this._widget = new monaco.quickOpen.QuickOpenWidget(this.container, {
            onOk: () => {
                this.previousActiveElement = undefined;
                this.contextKeyService.activeContext = undefined;
                this.onClose(false);
            },
            onCancel: () => {
                if (this.previousActiveElement instanceof HTMLElement) {
                    this.previousActiveElement.focus({ preventScroll: true });
                }
                this.previousActiveElement = undefined;
                this.contextKeyService.activeContext = undefined;
                this.onClose(true);
            },
            onType: lookFor => this.onType(lookFor || ''),
            onFocusLost: () => {
                if (this.opts && this.opts.ignoreFocusOut !== undefined) {
                    if (this.opts.ignoreFocusOut === false) {
                        this.onClose(true);
                    }
                    return this.opts.ignoreFocusOut;
                } else {
                    return false;
                }
            }
        }, {});
        this.attachQuickOpenStyler();
        this._widgetNode = widget.create();
        widget.tree.onDidChangeFocus(() => this.onDidChangeActiveEmitter.fire(this.getActive()));
        return widget;
    }

    get widgetNode(): HTMLElement {
        return this._widgetNode;
    }

    getActive(): QuickOpenItem[] {
        if (this._widget && this._widget.isVisible()) {
            const focus = this._widget.tree.getFocus();
            if (focus instanceof QuickOpenEntry) {
                return [focus.item];
            }
        }
        return [];
    }

    protected attachQuickOpenStyler(): void {
        if (!this._widget) {
            return;
        }
        const themeService = monaco.services.StaticServices.standaloneThemeService.get();
        const detach = monaco.theme.attachQuickOpenStyler(this._widget, themeService);
        const dispose = themeService.onThemeChange(() => {
            detach.dispose();
            this.attachQuickOpenStyler();
            dispose.dispose();
        });
    }

    protected onClose(cancelled: boolean): void {
        if (this.opts && this.opts.onClose) {
            this.opts.onClose(cancelled);
        }
        this.inQuickOpenKey.set(false);
    }

    protected async onType(lookFor: string): Promise<void> {
        const opts = this.opts;
        if (this.widget && opts) {
            if (opts.onType) {
                opts.onType(lookFor, model =>
                    this.widget.setInput(model, opts.getAutoFocus(lookFor), opts.inputAriaLabel));
            } else {
                const m = opts.getModel(lookFor);
                this.widget.setInput(m, opts.getAutoFocus(lookFor), opts.inputAriaLabel);
            }
        }
    }

}

export class MonacoQuickOpenControllerOptsImpl implements MonacoQuickOpenControllerOpts {

    protected readonly options: QuickOpenOptions.Resolved;
    readonly password?: boolean;

    constructor(
        protected readonly model: QuickOpenModel,
        protected readonly keybindingService: KeybindingRegistry,
        options?: QuickOpenOptions
    ) {
        this.model = model;
        this.options = QuickOpenOptions.resolve(options);
        this.password = this.options.password;
    }

    get enabled(): boolean {
        return this.options.enabled;
    }

    get prefix(): string {
        return this.options.prefix;
    }

    get ignoreFocusOut(): boolean {
        return this.options.ignoreFocusOut;
    }

    get inputAriaLabel(): string {
        return this.options.placeholder || '';
    }

    get valueSelection(): Readonly<[number, number]> {
        return this.options.valueSelection || [-1, -1];
    }

    onClose(cancelled: boolean): void {
        this.options.onClose(cancelled);
    }

    protected toOpenModel(lookFor: string, items: QuickOpenItem[], actionProvider?: QuickOpenActionProvider): monaco.quickOpen.QuickOpenModel {
        const entries: monaco.quickOpen.QuickOpenEntry[] = [];
        for (const item of items) {
            const entry = this.createEntry(item, lookFor);
            if (entry) {
                entries.push(entry);
            }
        }
        if (this.options.fuzzySort) {
            entries.sort((a, b) => compareEntries(a, b, lookFor));
        }
        return new monaco.quickOpen.QuickOpenModel(entries, actionProvider ? new MonacoQuickOpenActionProvider(actionProvider) : undefined);
    }

    getModel(lookFor: string): monaco.quickOpen.QuickOpenModel {
        throw new Error('getModel not supported!');
    }

    onType(lookFor: string, acceptor: (model: monaco.quickOpen.QuickOpenModel) => void): void {
        this.model.onType(lookFor, (items, actionProvider) => {
            const result = this.toOpenModel(lookFor, items, actionProvider);
            acceptor(result);
        });
    }

    protected createEntry(item: QuickOpenItem, lookFor: string): monaco.quickOpen.QuickOpenEntry | undefined {
        if (this.options.skipPrefix) {
            lookFor = lookFor.substr(this.options.skipPrefix);
        }
        if (this.options.trimInput) {
            lookFor = lookFor.trim();
        }
        const { fuzzyMatchLabel, fuzzyMatchDescription, fuzzyMatchDetail } = this.options;
        const labelHighlights = fuzzyMatchLabel ? this.matchesFuzzy(lookFor, item.getLabel(), fuzzyMatchLabel) : item.getLabelHighlights();
        const descriptionHighlights = fuzzyMatchDescription ? this.matchesFuzzy(lookFor, item.getDescription(), fuzzyMatchDescription) : item.getDescriptionHighlights();
        const detailHighlights = fuzzyMatchDetail ? this.matchesFuzzy(lookFor, item.getDetail(), fuzzyMatchDetail) : item.getDetailHighlights();
        if ((lookFor && !labelHighlights && !descriptionHighlights && !detailHighlights)
            && !this.options.showItemsWithoutHighlight) {
            return undefined;
        }
        const entry = item instanceof QuickOpenGroupItem
            ? new QuickOpenEntryGroup(item, this.keybindingService)
            : new QuickOpenEntry(item, this.keybindingService);
        entry.setHighlights(labelHighlights || [], descriptionHighlights, detailHighlights);
        return entry;
    }

    protected matchesFuzzy(lookFor: string, value: string | undefined, options?: QuickOpenOptions.FuzzyMatchOptions | boolean): monaco.quickOpen.IHighlight[] | undefined {
        if (!lookFor || !value) {
            return undefined;
        }
        const enableSeparateSubstringMatching = typeof options === 'object' && options.enableSeparateSubstringMatching;
        return monaco.filters.matchesFuzzy(lookFor, value, enableSeparateSubstringMatching);
    }

    getAutoFocus(lookFor: string): monaco.quickOpen.IAutoFocus {
        if (this.options.selectIndex) {
            const idx = this.options.selectIndex(lookFor);
            if (idx >= 0) {
                return {
                    autoFocusIndex: idx
                };
            }
        }
        return {
            autoFocusFirstEntry: true,
            autoFocusPrefixMatch: lookFor
        };
    }

}

export class QuickOpenEntry extends monaco.quickOpen.QuickOpenEntry {

    constructor(
        public readonly item: QuickOpenItem,
        protected readonly keybindingService: KeybindingRegistry
    ) {
        super();
    }

    getLabel(): string | undefined {
        return this.item.getLabel();
    }

    getAriaLabel(): string {
        return this.item.getTooltip() || '';
    }

    getDetail(): string | undefined {
        return this.item.getDetail();
    }

    getDescription(): string | undefined {
        return this.item.getDescription();
    }

    isHidden(): boolean {
        return super.isHidden() || this.item.isHidden();
    }

    getResource(): monaco.Uri | undefined {
        const uri = this.item.getUri();
        return uri ? monaco.Uri.parse(uri.toString()) : undefined;
    }

    getIcon(): string | undefined {
        return this.item.getIconClass();
    }

    getKeybinding(): monaco.keybindings.ResolvedKeybinding | undefined {
        const keybinding = this.item.getKeybinding();
        if (!keybinding) {
            return undefined;
        }

        let keySequence: KeySequence;
        try {
            keySequence = this.keybindingService.resolveKeybinding(keybinding);
        } catch (error) {
            return undefined;
        }
        return new MonacoResolvedKeybinding(keySequence, this.keybindingService);
    }

    run(mode: monaco.quickOpen.Mode): boolean {
        if (mode === 1) {
            return this.item.run(QuickOpenMode.OPEN);
        }
        if (mode === 2) {
            return this.item.run(QuickOpenMode.OPEN_IN_BACKGROUND);
        }
        if (mode === 0) {
            return this.item.run(QuickOpenMode.PREVIEW);
        }
        return false;
    }

}

export class QuickOpenEntryGroup extends monaco.quickOpen.QuickOpenEntryGroup {

    constructor(
        public readonly item: QuickOpenGroupItem,
        protected readonly keybindingService: KeybindingRegistry
    ) {
        super(new QuickOpenEntry(item, keybindingService));
    }

    getGroupLabel(): string {
        return this.item.getGroupLabel() || '';
    }

    showBorder(): boolean {
        return this.item.showBorder();
    }

    getKeybinding(): monaco.keybindings.ResolvedKeybinding | undefined {
        const entry = this.getEntry();
        return entry ? entry.getKeybinding() : super.getKeybinding();
    }

}

export class MonacoQuickOpenAction implements monaco.editor.IAction {
    constructor(public readonly action: QuickOpenAction) { }

    get id(): string {
        return this.action.id;
    }

    get label(): string {
        return this.action.label || '';
    }

    get tooltip(): string {
        return this.action.tooltip || '';
    }

    get class(): string | undefined {
        return this.action.class;
    }

    get enabled(): boolean {
        return this.action.enabled || true;
    }

    get checked(): boolean {
        return this.action.checked || false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    run(entry: QuickOpenEntry | QuickOpenEntryGroup): Promise<any> {
        return this.action.run(entry.item);
    }

    dispose(): void {
        this.action.dispose();
    }
}

export class MonacoQuickOpenActionProvider implements monaco.quickOpen.IActionProvider {
    constructor(public readonly provider: QuickOpenActionProvider) { }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hasActions(element: any, entry: QuickOpenEntry | QuickOpenEntryGroup): boolean {
        return this.provider.hasActions(entry.item);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getActions(element: any, entry: QuickOpenEntry | QuickOpenEntryGroup): ReadonlyArray<monaco.editor.IAction> {
        const actions = this.provider.getActions(entry.item);
        return actions.map(action => new MonacoQuickOpenAction(action));
    }
}
