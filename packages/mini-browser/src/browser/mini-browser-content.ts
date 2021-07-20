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

import * as PDFObject from 'pdfobject';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/shared/@phosphor/messaging';
import URI from '@theia/core/lib/common/uri';
import { ILogger } from '@theia/core/lib/common/logger';
import { Emitter } from '@theia/core/lib/common/event';
import { KeybindingRegistry } from '@theia/core/lib/browser/keybinding';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { parseCssTime, Key, KeyCode } from '@theia/core/lib/browser';
import { DisposableCollection, Disposable } from '@theia/core/lib/common/disposable';
import { BaseWidget, addEventListener } from '@theia/core/lib/browser/widgets/widget';
import { LocationMapperService } from './location-mapper-service';
import { ApplicationShellMouseTracker } from '@theia/core/lib/browser/shell/application-shell-mouse-tracker';

import debounce = require('@theia/core/shared/lodash.debounce');
import { MiniBrowserContentStyle } from './mini-browser-content-style';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileChangesEvent, FileChangeType } from '@theia/filesystem/lib/common/files';

/**
 * Initializer properties for the embedded browser widget.
 */
@injectable()
export class MiniBrowserProps {

    /**
     * `show` if the toolbar should be visible. If `read-only`, the toolbar is visible but the address cannot be changed and it acts as a link instead.\
     * `hide` if the toolbar should be hidden. `show` by default. If the `startPage` is not defined, this property is always `show`.
     */
    readonly toolbar?: 'show' | 'hide' | 'read-only';

    /**
     * If defined, the browser will load this page on startup. Otherwise, it show a blank page.
     */
    readonly startPage?: string;

    /**
     * Sandbox options for the underlying `iframe`. Defaults to `SandboxOptions#DEFAULT` if not provided.
     */
    readonly sandbox?: MiniBrowserProps.SandboxOptions[];

    /**
     * The optional icon class for the widget.
     */
    readonly iconClass?: string;

    /**
     * The desired name of the widget.
     */
    readonly name?: string;

    /**
     * `true` if the `iFrame`'s background has to be reset to the default white color. Otherwise, `false`. `false` is the default.
     */
    readonly resetBackground?: boolean;

}

export namespace MiniBrowserProps {

    /**
     * Enumeration of the supported `sandbox` options for the `iframe`.
     */
    export enum SandboxOptions {

        /**
         * Allows form submissions.
         */
        'allow-forms',

        /**
         * Allows popups, such as `window.open()`, `showModalDialog()`, `target=”_blank”`, etc.
         */
        'allow-popups',

        /**
         * Allows pointer lock.
         */
        'allow-pointer-lock',

        /**
         * Allows the document to maintain its origin. Pages loaded from https://example.com/ will retain access to that origin’s data.
         */
        'allow-same-origin',

        /**
         * Allows JavaScript execution. Also allows features to trigger automatically (as they’d be trivial to implement via JavaScript).
         */
        'allow-scripts',

        /**
         * Allows the document to break out of the frame by navigating the top-level `window`.
         */
        'allow-top-navigation',

        /**
         * Allows the embedded browsing context to open modal windows.
         */
        'allow-modals',

        /**
         * Allows the embedded browsing context to disable the ability to lock the screen orientation.
         */
        'allow-orientation-lock',

        /**
         * Allows a sandboxed document to open new windows without forcing the sandboxing flags upon them.
         * This will allow, for example, a third-party advertisement to be safely sandboxed without forcing the same restrictions upon a landing page.
         */
        'allow-popups-to-escape-sandbox',

        /**
         * Allows embedders to have control over whether an iframe can start a presentation session.
         */
        'allow-presentation',

        /**
         * Allows the embedded browsing context to navigate (load) content to the top-level browsing context only when initiated by a user gesture.
         * If this keyword is not used, this operation is not allowed.
         */
        'allow-top-navigation-by-user-activation'
    }

    export namespace SandboxOptions {

        /**
         * The default `sandbox` options, if other is not provided.
         *
         * See: https://www.html5rocks.com/en/tutorials/security/sandboxed-iframes/
         */
        export const DEFAULT: SandboxOptions[] = [
            SandboxOptions['allow-same-origin'],
            SandboxOptions['allow-scripts'],
            SandboxOptions['allow-popups'],
            SandboxOptions['allow-forms'],
            SandboxOptions['allow-modals']
        ];

    }

}

export const MiniBrowserContentFactory = Symbol('MiniBrowserContentFactory');
export type MiniBrowserContentFactory = (props: MiniBrowserProps) => MiniBrowserContent;

@injectable()
export class MiniBrowserContent extends BaseWidget {

    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    @inject(LocationMapperService)
    protected readonly locationMapper: LocationMapperService;

    @inject(KeybindingRegistry)
    protected readonly keybindings: KeybindingRegistry;

    @inject(ApplicationShellMouseTracker)
    protected readonly mouseTracker: ApplicationShellMouseTracker;

    @inject(FileService)
    protected readonly fileService: FileService;

    protected readonly submitInputEmitter = new Emitter<string>();
    protected readonly navigateBackEmitter = new Emitter<void>();
    protected readonly navigateForwardEmitter = new Emitter<void>();
    protected readonly refreshEmitter = new Emitter<void>();
    protected readonly openEmitter = new Emitter<void>();

    protected readonly input: HTMLInputElement;
    protected readonly loadIndicator: HTMLElement;
    protected readonly errorBar: HTMLElement & Readonly<{ message: HTMLElement }>;
    protected readonly frame: HTMLIFrameElement;
    // eslint-disable-next-line max-len
    // XXX This is a hack to be able to tack the mouse events when drag and dropping the widgets. On `mousedown` we put a transparent div over the `iframe` to avoid losing the mouse tacking.
    protected readonly transparentOverlay: HTMLElement;
    // XXX It is a hack. Instead of loading the PDF in an iframe we use `PDFObject` to render it in a div.
    protected readonly pdfContainer: HTMLElement;

    protected frameLoadTimeout: number;
    protected readonly initialHistoryLength: number;
    protected readonly toDisposeOnGo = new DisposableCollection();

    constructor(@inject(MiniBrowserProps) protected readonly props: MiniBrowserProps) {
        super();
        this.node.tabIndex = 0;
        this.addClass(MiniBrowserContentStyle.MINI_BROWSER);
        this.input = this.createToolbar(this.node).input;
        const contentArea = this.createContentArea(this.node);
        this.frame = contentArea.frame;
        this.transparentOverlay = contentArea.transparentOverlay;
        this.loadIndicator = contentArea.loadIndicator;
        this.errorBar = contentArea.errorBar;
        this.pdfContainer = contentArea.pdfContainer;
        this.initialHistoryLength = history.length;
        this.toDispose.pushAll([
            this.submitInputEmitter,
            this.navigateBackEmitter,
            this.navigateForwardEmitter,
            this.refreshEmitter,
            this.openEmitter
        ]);
    }

    @postConstruct()
    protected init(): void {
        this.toDispose.push(this.mouseTracker.onMousedown(e => {
            if (this.frame.style.display !== 'none') {
                this.transparentOverlay.style.display = 'block';
            }
        }));
        this.toDispose.push(this.mouseTracker.onMouseup(e => {
            if (this.frame.style.display !== 'none') {
                this.transparentOverlay.style.display = 'none';
            }
        }));
        const { startPage } = this.props;
        if (startPage) {
            setTimeout(() => this.go(startPage), 500);
            this.listenOnContentChange(startPage);
        }
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        if (this.getToolbarProps() !== 'hide') {
            this.input.focus();
        } else {
            this.node.focus();
        }
    }

    protected async listenOnContentChange(location: string): Promise<void> {
        if (await this.fileService.exists(new URI(location))) {
            const fileUri = new URI(location);
            const watcher = this.fileService.watch(fileUri);
            this.toDispose.push(watcher);
            const onFileChange = (event: FileChangesEvent) => {
                if (event.contains(fileUri, FileChangeType.ADDED) || event.contains(fileUri, FileChangeType.UPDATED)) {
                    this.go(location, {
                        showLoadIndicator: false
                    });
                }
            };
            this.toDispose.push(this.fileService.onDidFilesChange(debounce(onFileChange, 500)));
        }
    }

    protected createToolbar(parent: HTMLElement): HTMLDivElement & Readonly<{ input: HTMLInputElement }> {
        const toolbar = document.createElement('div');
        toolbar.classList.add(this.getToolbarProps() === 'read-only' ? MiniBrowserContentStyle.TOOLBAR_READ_ONLY : MiniBrowserContentStyle.TOOLBAR);
        parent.appendChild(toolbar);
        this.createPrevious(toolbar);
        this.createNext(toolbar);
        this.createRefresh(toolbar);
        const input = this.createInput(toolbar);
        input.readOnly = this.getToolbarProps() === 'read-only';
        this.createOpen(toolbar);
        if (this.getToolbarProps() === 'hide') {
            toolbar.style.display = 'none';
        }
        return Object.assign(toolbar, { input });
    }

    protected getToolbarProps(): 'show' | 'hide' | 'read-only' {
        return !this.props.startPage ? 'show' : this.props.toolbar || 'show';
    }

    // eslint-disable-next-line max-len
    protected createContentArea(parent: HTMLElement): HTMLElement & Readonly<{ frame: HTMLIFrameElement, loadIndicator: HTMLElement, errorBar: HTMLElement & Readonly<{ message: HTMLElement }>, pdfContainer: HTMLElement, transparentOverlay: HTMLElement }> {
        const contentArea = document.createElement('div');
        contentArea.classList.add(MiniBrowserContentStyle.CONTENT_AREA);

        const loadIndicator = document.createElement('div');
        loadIndicator.classList.add(MiniBrowserContentStyle.PRE_LOAD);
        loadIndicator.style.display = 'none';

        const loadIcon = document.createElement('div');
        loadIcon.classList.add(MiniBrowserContentStyle.THEIA_LOADER);
        loadIndicator.appendChild(loadIcon);

        const errorBar = this.createErrorBar();

        const frame = this.createIFrame();
        this.submitInputEmitter.event(input => this.go(input, {
            preserveFocus: false
        }));
        this.navigateBackEmitter.event(this.handleBack.bind(this));
        this.navigateForwardEmitter.event(this.handleForward.bind(this));
        this.refreshEmitter.event(this.handleRefresh.bind(this));
        this.openEmitter.event(this.handleOpen.bind(this));

        const transparentOverlay = document.createElement('div');
        transparentOverlay.classList.add(MiniBrowserContentStyle.TRANSPARENT_OVERLAY);
        transparentOverlay.style.display = 'none';

        const pdfContainer = document.createElement('div');
        pdfContainer.classList.add(MiniBrowserContentStyle.PDF_CONTAINER);
        pdfContainer.id = `${this.id}-pdf-container`;
        pdfContainer.style.display = 'none';

        contentArea.appendChild(errorBar);
        contentArea.appendChild(transparentOverlay);
        contentArea.appendChild(pdfContainer);
        contentArea.appendChild(loadIndicator);
        contentArea.appendChild(frame);

        parent.appendChild(contentArea);
        return Object.assign(contentArea, { frame, loadIndicator, errorBar, pdfContainer, transparentOverlay });
    }

    protected createIFrame(): HTMLIFrameElement {
        const frame = document.createElement('iframe');
        const sandbox = (this.props.sandbox || MiniBrowserProps.SandboxOptions.DEFAULT).map(name => MiniBrowserProps.SandboxOptions[name]);
        frame.sandbox.add(...sandbox);
        this.toDispose.push(addEventListener(frame, 'load', this.onFrameLoad.bind(this)));
        this.toDispose.push(addEventListener(frame, 'error', this.onFrameError.bind(this)));
        return frame;
    }

    protected createErrorBar(): HTMLElement & Readonly<{ message: HTMLElement }> {
        const errorBar = document.createElement('div');
        errorBar.classList.add(MiniBrowserContentStyle.ERROR_BAR);
        errorBar.style.display = 'none';

        const icon = document.createElement('span');
        icon.classList.add('fa', 'problem-tab-icon');
        errorBar.appendChild(icon);

        const message = document.createElement('span');
        errorBar.appendChild(message);

        return Object.assign(errorBar, { message });
    }

    protected onFrameLoad(): void {
        clearTimeout(this.frameLoadTimeout);
        this.maybeResetBackground();
        this.hideLoadIndicator();
        this.hideErrorBar();
    }

    protected onFrameError(): void {
        clearTimeout(this.frameLoadTimeout);
        this.maybeResetBackground();
        this.hideLoadIndicator();
        this.showErrorBar('An error occurred while loading this page');
    }

    protected onFrameTimeout(): void {
        clearTimeout(this.frameLoadTimeout);
        this.maybeResetBackground();
        this.hideLoadIndicator();
        this.showErrorBar('Still loading...');
    }

    protected showLoadIndicator(): void {
        this.loadIndicator.classList.remove(MiniBrowserContentStyle.FADE_OUT);
        this.loadIndicator.style.display = 'flex';
    }

    protected hideLoadIndicator(): void {
        // Start the fade-out transition.
        this.loadIndicator.classList.add(MiniBrowserContentStyle.FADE_OUT);
        // Actually hide the load indicator after the transition is finished.
        const preloadStyle = window.getComputedStyle(this.loadIndicator);
        const transitionDuration = parseCssTime(preloadStyle.transitionDuration, 0);
        setTimeout(() => {
            // But don't hide it if it was shown again since the transition started.
            if (this.loadIndicator.classList.contains(MiniBrowserContentStyle.FADE_OUT)) {
                this.loadIndicator.style.display = 'none';
                this.loadIndicator.classList.remove(MiniBrowserContentStyle.FADE_OUT);
            }
        }, transitionDuration);
    }

    protected showErrorBar(message: string): void {
        this.errorBar.message.textContent = message;
        this.errorBar.style.display = 'block';
    }

    protected hideErrorBar(): void {
        this.errorBar.message.textContent = '';
        this.errorBar.style.display = 'none';
    }

    protected maybeResetBackground(): void {
        if (this.props.resetBackground === true) {
            this.frame.style.backgroundColor = 'white';
        }
    }

    protected handleBack(): void {
        if (history.length - this.initialHistoryLength > 0) {
            history.back();
        }
    }

    protected handleForward(): void {
        if (history.length > this.initialHistoryLength) {
            history.forward();
        }
    }

    protected handleRefresh(): void {
        // Initial pessimism; use the location of the input.
        let location: string | undefined = this.props.startPage;
        // Use the the location from the `input`.
        if (this.input && this.input.value) {
            location = this.input.value;
        }
        try {
            const { contentDocument } = this.frame;
            if (contentDocument && contentDocument.location) {
                location = contentDocument.location.href;
            }
        } catch {
            // Security exception due to CORS when trying to access the `location.href` of the content document.
        }
        if (location) {
            this.go(location, {
                preserveFocus: false
            });
        }
    }

    protected handleOpen(): void {
        const location = this.frameSrc() || this.input.value;
        if (location) {
            this.windowService.openNewWindow(location);
        }
    }

    protected createInput(parent: HTMLElement): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'text';
        input.classList.add('theia-input');
        this.toDispose.pushAll([
            addEventListener(input, 'keydown', this.handleInputChange.bind(this)),
            addEventListener(input, 'click', () => {
                if (this.getToolbarProps() === 'read-only') {
                    this.handleOpen();
                } else {
                    if (input.value) {
                        input.select();
                    }
                }
            })
        ]);
        parent.appendChild(input);
        return input;
    }

    protected handleInputChange(e: KeyboardEvent): void {
        const { key } = KeyCode.createKeyCode(e);
        if (key && Key.ENTER.keyCode === key.keyCode && this.getToolbarProps() === 'show') {
            const { target } = e;
            if (target instanceof HTMLInputElement) {
                this.mapLocation(target.value).then(location => this.submitInputEmitter.fire(location));
            }
        }
    }

    protected createPrevious(parent: HTMLElement): HTMLElement {
        return this.onClick(this.createButton(parent, 'Show The Previous Page', MiniBrowserContentStyle.PREVIOUS), this.navigateBackEmitter);
    }

    protected createNext(parent: HTMLElement): HTMLElement {
        return this.onClick(this.createButton(parent, 'Show The Next Page', MiniBrowserContentStyle.NEXT), this.navigateForwardEmitter);
    }

    protected createRefresh(parent: HTMLElement): HTMLElement {
        return this.onClick(this.createButton(parent, 'Reload This Page', MiniBrowserContentStyle.REFRESH), this.refreshEmitter);
    }

    protected createOpen(parent: HTMLElement): HTMLElement {
        const button = this.onClick(this.createButton(parent, 'Open In A New Window', MiniBrowserContentStyle.OPEN), this.openEmitter);
        return button;
    }

    protected createButton(parent: HTMLElement, title: string, ...className: string[]): HTMLElement {
        const button = document.createElement('div');
        button.title = title;
        button.classList.add(...className, MiniBrowserContentStyle.BUTTON);
        parent.appendChild(button);
        return button;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected onClick(element: HTMLElement, emitter: Emitter<any>): HTMLElement {
        this.toDispose.push(addEventListener(element, 'click', () => {
            if (!element.classList.contains(MiniBrowserContentStyle.DISABLED)) {
                emitter.fire(undefined);
            }
        }));
        return element;
    }

    protected mapLocation(location: string): Promise<string> {
        return this.locationMapper.map(location);
    }

    protected setInput(value: string): void {
        if (this.input.value !== value) {
            this.input.value = value;
        }
    }

    protected frameSrc(): string {
        let src = this.frame.src;
        try {
            const { contentWindow } = this.frame;
            if (contentWindow) {
                src = contentWindow.location.href;
            }
        } catch {
            // CORS issue. Ignored.
        }
        if (src === 'about:blank') {
            src = '';
        }
        return src;
    }

    protected contentDocument(): Document | null {
        try {
            let { contentDocument } = this.frame;
            // eslint-disable-next-line no-null/no-null
            if (contentDocument === null) {
                const { contentWindow } = this.frame;
                if (contentWindow) {
                    contentDocument = contentWindow.document;
                }
            }
            return contentDocument;
        } catch {
            // eslint-disable-next-line no-null/no-null
            return null;
        }
    }

    protected async go(location: string, options?: Partial<{
        /* default: true */
        showLoadIndicator: boolean,
        /* default: true */
        preserveFocus: boolean
    }>): Promise<void> {
        const { showLoadIndicator, preserveFocus } = {
            showLoadIndicator: true,
            preserveFocus: true,
            ...options
        };
        if (location) {
            try {
                this.toDisposeOnGo.dispose();
                const url = await this.mapLocation(location);
                this.setInput(url);
                if (this.getToolbarProps() === 'read-only') {
                    this.input.title = `Open ${url} In A New Window`;
                }
                clearTimeout(this.frameLoadTimeout);
                this.frameLoadTimeout = window.setTimeout(this.onFrameTimeout.bind(this), 4000);
                if (showLoadIndicator) {
                    this.showLoadIndicator();
                }
                if (url.endsWith('.pdf')) {
                    this.pdfContainer.style.display = 'block';
                    this.frame.style.display = 'none';
                    PDFObject.embed(url, this.pdfContainer, {
                        // eslint-disable-next-line max-len, @typescript-eslint/quotes
                        fallbackLink: `<p style="padding: 0px 15px 0px 15px">Your browser does not support inline PDFs. Click on this <a href='[url]' target="_blank">link</a> to open the PDF in a new tab.</p>`
                    });
                    clearTimeout(this.frameLoadTimeout);
                    this.hideLoadIndicator();
                    if (!preserveFocus) {
                        this.pdfContainer.focus();
                    }
                } else {
                    this.pdfContainer.style.display = 'none';
                    this.frame.style.display = 'block';
                    this.frame.src = url;
                    // The load indicator will hide itself if the content of the iframe was loaded.
                    if (!preserveFocus) {
                        this.frame.addEventListener('load', () => {
                            const window = this.frame.contentWindow;
                            if (window) {
                                window.focus();
                            }
                        }, { once: true });
                    }
                }
                // Delegate all the `keypress` events from the `iframe` to the application.
                this.toDisposeOnGo.push(addEventListener(this.frame, 'load', () => {
                    try {
                        const { contentDocument } = this.frame;
                        if (contentDocument) {
                            const keypressHandler = (e: KeyboardEvent) => this.keybindings.run(e);
                            contentDocument.addEventListener('keypress', keypressHandler, true);
                            this.toDisposeOnDetach.push(Disposable.create(() => contentDocument.removeEventListener('keypress', keypressHandler)));
                        }
                    } catch {
                        // There is not much we could do with the security exceptions due to CORS.
                    }
                }));
            } catch (e) {
                clearTimeout(this.frameLoadTimeout);
                this.hideLoadIndicator();
                this.showErrorBar(String(e));
                console.log(e);
            }
        }
    }

}
