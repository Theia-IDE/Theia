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

import { Terminal, RendererType } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { inject, injectable, named, postConstruct } from 'inversify';
import { ContributionProvider, Disposable, Event, Emitter, ILogger, DisposableCollection } from '@theia/core';
import { BaseWidget, Widget, Message, WebSocketConnectionProvider, StatefulWidget, isFirefox, MessageLoop, KeyCode } from '@theia/core/lib/browser';
import { isOSX } from '@theia/core/lib/common';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { ShellTerminalServerProxy } from '../common/shell-terminal-protocol';
import { terminalsPath } from '../common/terminal-protocol';
import { IBaseTerminalServer, TerminalProcessInfo } from '../common/base-terminal-protocol';
import { TerminalWatcher } from '../common/terminal-watcher';
import { MessageConnection } from 'vscode-jsonrpc';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { TerminalPreferences, TerminalRendererType, isTerminalRendererType, DEFAULT_TERMINAL_RENDERER_TYPE, CursorStyle } from './terminal-preferences';
import { TerminalContribution } from './terminal-contribution';
import URI from '@theia/core/lib/common/uri';
import { TerminalService } from './base/terminal-service';
import { TerminalSearchWidgetFactory, TerminalSearchWidget } from './search/terminal-search-widget';
import { TerminalCopyOnSelectionHandler } from './terminal-copy-on-selection-handler';
import { TerminalThemeService } from './terminal-theme-service';
import { CommandLineOptions, ShellCommandBuilder } from '@theia/process/lib/common/shell-command-builder';

export const TERMINAL_WIDGET_FACTORY_ID = 'terminal';

/**
 * Terminal widget options.
 */
export const TerminalWidgetOptions = Symbol('TerminalWidgetOptions');
export interface TerminalWidgetOptions {

    /**
     * Human readable terminal representation on the UI.
     */
    readonly title?: string;

    /**
     * Path to the executable shell. For example: `/bin/bash`, `bash`, `sh`.
     */
    readonly shellPath?: string;

    /**
     * Shell arguments to executable shell, for example: [`-l`] - without login.
     */
    readonly shellArgs?: string[];

    /**
     * Current working directory.
     */
    readonly cwd?: string;

    /**
     * Environment variables for terminal.
     */
    readonly env?: { [key: string]: string | null };

    /**
     * In case `destroyTermOnClose` is true - terminal process will be destroyed on close terminal widget, otherwise will be kept
     * alive.
     */
    readonly destroyTermOnClose?: boolean;

    /**
     * Terminal server side can send to the client `terminal title` to display this value on the UI. If
     * useServerTitle = true then display this title, otherwise display title defined by 'title' argument.
     */
    readonly useServerTitle?: boolean;

    /**
     * Terminal id. Should be unique for all DOM.
     */
    readonly id?: string;

    /**
     * Terminal attributes. Can be useful to apply some implementation specific information.
     */
    readonly attributes?: { [key: string]: string | null };

    /**
     * Terminal kind that indicates whether a terminal is created by a user or by some extension for a user
     */
    readonly kind?: 'user' | string;
}

export interface TerminalWidgetFactoryOptions extends Partial<TerminalWidgetOptions> {
    /* a unique string per terminal */
    created: string
}

@injectable()
export class TerminalWidget extends BaseWidget implements StatefulWidget {

    private readonly TERMINAL = 'Terminal';
    protected terminalKind = 'user';
    protected _terminalId = -1;
    protected readonly onTermDidClose = new Emitter<TerminalWidget>();
    protected fitAddon: FitAddon;
    protected term: Terminal;
    protected searchBox: TerminalSearchWidget;
    protected restored = false;
    protected closeOnDispose = true;
    protected waitForConnection: Deferred<MessageConnection> | undefined;
    protected hoverMessage: HTMLDivElement;
    protected lastTouchEnd: TouchEvent | undefined;

    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(WebSocketConnectionProvider) protected readonly webSocketConnectionProvider: WebSocketConnectionProvider;
    @inject(TerminalWidgetOptions) options: TerminalWidgetOptions;
    @inject(ShellTerminalServerProxy) protected readonly shellTerminalServer: ShellTerminalServerProxy;
    @inject(TerminalWatcher) protected readonly terminalWatcher: TerminalWatcher;
    @inject(ILogger) @named('terminal') protected readonly logger: ILogger;
    @inject('terminal-dom-id') public readonly id: string;
    @inject(TerminalPreferences) protected readonly preferences: TerminalPreferences;
    @inject(ContributionProvider) @named(TerminalContribution) protected readonly terminalContributionProvider: ContributionProvider<TerminalContribution>;
    @inject(TerminalService) protected readonly terminalService: TerminalService;
    @inject(TerminalSearchWidgetFactory) protected readonly terminalSearchBoxFactory: TerminalSearchWidgetFactory;
    @inject(TerminalCopyOnSelectionHandler) protected readonly copyOnSelectionHandler: TerminalCopyOnSelectionHandler;
    @inject(TerminalThemeService) protected readonly themeService: TerminalThemeService;
    @inject(ShellCommandBuilder) protected readonly shellCommandBuilder: ShellCommandBuilder;

    protected readonly onDidOpenEmitter = new Emitter<void>();
    readonly onDidOpen: Event<void> = this.onDidOpenEmitter.event;

    protected readonly onDidOpenFailureEmitter = new Emitter<void>();
    readonly onDidOpenFailure: Event<void> = this.onDidOpenFailureEmitter.event;

    protected readonly toDisposeOnConnect = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        this.setTitle(this.options.title || this.TERMINAL);
        this.title.iconClass = 'fa fa-terminal';

        if (this.options.kind) {
            this.terminalKind = this.options.kind;
        }

        if (this.options.destroyTermOnClose === true) {
            this.toDispose.push(Disposable.create(() =>
                this.term.dispose()
            ));
        }

        this.title.closable = true;
        this.addClass('terminal-container');

        this.term = new Terminal({
            cursorBlink: this.preferences['terminal.integrated.cursorBlinking'],
            cursorStyle: this.getCursorStyle(),
            cursorWidth: this.preferences['terminal.integrated.cursorWidth'],
            fontFamily: this.preferences['terminal.integrated.fontFamily'],
            fontSize: this.preferences['terminal.integrated.fontSize'],
            fontWeight: this.preferences['terminal.integrated.fontWeight'],
            fontWeightBold: this.preferences['terminal.integrated.fontWeightBold'],
            drawBoldTextInBrightColors: this.preferences['terminal.integrated.drawBoldTextInBrightColors'],
            letterSpacing: this.preferences['terminal.integrated.letterSpacing'],
            lineHeight: this.preferences['terminal.integrated.lineHeight'],
            scrollback: this.preferences['terminal.integrated.scrollback'],
            fastScrollSensitivity: this.preferences['terminal.integrated.fastScrollSensitivity'],
            rendererType: this.getTerminalRendererType(this.preferences['terminal.integrated.rendererType']),
            theme: this.themeService.theme
        });

        this.fitAddon = new FitAddon();
        this.term.loadAddon(this.fitAddon);

        this.hoverMessage = document.createElement('div');
        this.hoverMessage.textContent = 'Cmd + click to follow link';
        this.hoverMessage.style.position = 'fixed';
        // TODO use `var(--theia-editorHoverWidget-foreground) with a newer Monaco version
        this.hoverMessage.style.color = 'var(--theia-editorWidget-foreground)';
        this.hoverMessage.style.backgroundColor = 'var(--theia-editorHoverWidget-background)';
        this.hoverMessage.style.borderColor = 'var(--theia-editorHoverWidget-border)';
        this.hoverMessage.style.borderWidth = '0.5px';
        this.hoverMessage.style.borderStyle = 'solid';
        this.hoverMessage.style.padding = '5px';
        // Above the xterm.js canvas layers:
        // https://github.com/xtermjs/xterm.js/blob/ff790236c1b205469f17a21246141f512d844295/src/renderer/Renderer.ts#L41-L46
        this.hoverMessage.style.zIndex = '10';
        // Initially invisible:
        this.hoverMessage.style.display = 'none';
        this.node.appendChild(this.hoverMessage);

        this.toDispose.push(this.preferences.onPreferenceChanged(change => {
            const lastSeparator = change.preferenceName.lastIndexOf('.');
            if (lastSeparator > 0) {
                let preferenceName = change.preferenceName.substr(lastSeparator + 1);
                let preferenceValue = this.preferences[change.preferenceName];

                if (preferenceName === 'rendererType') {
                    const newRendererType: string = this.preferences[change.preferenceName] as string;
                    if (newRendererType !== this.getTerminalRendererType(newRendererType)) {
                        // given terminal renderer type is not supported or invalid
                        preferenceValue = DEFAULT_TERMINAL_RENDERER_TYPE;
                    }
                }

                // Convert the terminal preference into a valid `xterm` option.
                if (preferenceName === 'cursorBlinking') {
                    preferenceName = 'cursorBlink';
                } else if (preferenceName === 'cursorStyle') {
                    preferenceValue = this.getCursorStyle();
                }

                this.term.setOption(preferenceName, preferenceValue);
                this.needsResize = true;
                this.update();
            }
        }));

        this.toDispose.push(this.themeService.onDidChange(() => this.term.setOption('theme', this.themeService.theme)));
        this.attachCustomKeyEventHandler();
        const titleChangeListenerDispose = this.term.onTitleChange((title: string) => {
            if (this.options.useServerTitle) {
                this.title.label = title;
            }
        });
        this.toDispose.push(titleChangeListenerDispose);

        this.toDispose.push(this.terminalWatcher.onTerminalError(({ terminalId, error }) => {
            if (terminalId === this.terminalId) {
                this.dispose();
                this.onTermDidClose.fire(this);
                this.onTermDidClose.dispose();
                this.logger.error(`The terminal process terminated. Cause: ${error}`);
            }
        }));
        this.toDispose.push(this.terminalWatcher.onTerminalExit(({ terminalId }) => {
            if (terminalId === this.terminalId) {
                this.dispose();
                this.onTermDidClose.fire(this);
                this.onTermDidClose.dispose();
            }
        }));
        this.toDispose.push(this.toDisposeOnConnect);
        this.toDispose.push(this.shellTerminalServer.onDidCloseConnection(() => {
            const disposable = this.shellTerminalServer.onDidOpenConnection(() => {
                disposable.dispose();
                this.reconnectTerminalProcess();
            });
            this.toDispose.push(disposable);
        }));
        this.toDispose.push(this.onTermDidClose);
        this.toDispose.push(this.onDidOpenEmitter);
        this.toDispose.push(this.onDidOpenFailureEmitter);

        const touchEndListener = (event: TouchEvent) => {
            if (this.node.contains(event.target as Node)) {
                this.lastTouchEnd = event;
            }
        };
        document.addEventListener('touchend', touchEndListener, { passive: true });
        this.onDispose(() => {
            document.removeEventListener('touchend', touchEndListener);
        });

        this.toDispose.push(this.term.onSelectionChange(() => {
            if (this.copyOnSelection) {
                this.copyOnSelectionHandler.copy(this.term.getSelection());
            }
        }));

        for (const contribution of this.terminalContributionProvider.getContributions()) {
            contribution.onCreate(this);
        }

        this.searchBox = this.terminalSearchBoxFactory(this.term);
        this.toDispose.push(this.searchBox);
    }

    get kind(): 'user' | string {
        return this.terminalKind;
    }

    /**
     * Get the cursor style compatible with `xterm`.
     * @returns CursorStyle
     */
    private getCursorStyle(): CursorStyle {
        const value = this.preferences['terminal.integrated.cursorStyle'];
        return value === 'line' ? 'bar' : value;
    }

    /**
     * Returns given renderer type if it is valid and supported or default renderer otherwise.
     *
     * @param terminalRendererType desired terminal renderer type
     */
    private getTerminalRendererType(terminalRendererType?: string | TerminalRendererType): RendererType {
        if (terminalRendererType && isTerminalRendererType(terminalRendererType)) {
            return terminalRendererType;
        }
        return DEFAULT_TERMINAL_RENDERER_TYPE;
    }

    showHoverMessage(x: number, y: number, message: string): void {
        this.hoverMessage.innerText = message;
        this.hoverMessage.style.display = 'inline';
        this.hoverMessage.style.top = `${y - 30}px`;
        this.hoverMessage.style.left = `${x - 60}px`;
    }

    hideHover(): void {
        this.hoverMessage.style.display = 'none';
    }

    getTerminal(): Terminal {
        return this.term;
    }

    getSearchBox(): TerminalSearchWidget {
        return this.searchBox;
    }

    get cwd(): Promise<URI> {
        if (!IBaseTerminalServer.validateId(this.terminalId)) {
            return Promise.reject(new Error('terminal is not started'));
        }
        if (this.terminalService.getById(this.id)) {
            return this.shellTerminalServer.getCwdURI(this.terminalId)
                .then(cwdUrl => new URI(cwdUrl));
        }
        return Promise.resolve(new URI());
    }

    get processId(): Promise<number> {
        if (!IBaseTerminalServer.validateId(this.terminalId)) {
            return Promise.reject(new Error('terminal is not started'));
        }
        return this.shellTerminalServer.getProcessId(this.terminalId);
    }

    get processInfo(): Promise<TerminalProcessInfo> {
        if (!IBaseTerminalServer.validateId(this.terminalId)) {
            return Promise.reject(new Error('terminal is not started'));
        }
        return this.shellTerminalServer.getProcessInfo(this.terminalId);
    }

    get terminalId(): number {
        return this._terminalId;
    }

    get lastTouchEndEvent(): TouchEvent | undefined {
        return this.lastTouchEnd;
    }

    onDispose(onDispose: () => void): void {
        this.toDispose.push(Disposable.create(onDispose));
    }

    clearOutput(): void {
        this.term.clear();
    }

    async hasChildProcesses(): Promise<boolean> {
        return this.shellTerminalServer.hasChildProcesses(await this.processId);
    }

    storeState(): object {
        this.closeOnDispose = false;
        return { terminalId: this.terminalId, titleLabel: this.title.label };
    }

    restoreState(oldState: object): void {
        if (this.restored === false) {
            const state = oldState as { terminalId: number, titleLabel: string };
            /* This is a workaround to issue #879 */
            this.restored = true;
            this.title.label = state.titleLabel;
            this.start(state.terminalId);
        }
    }

    /**
     * Create a new shell terminal in the back-end and attach it to a
     * new terminal widget.
     * If id is provided attach to the terminal for this id.
     */
    async start(id?: number): Promise<number> {
        this._terminalId = typeof id !== 'number' ? await this.createTerminal() : await this.attachTerminal(id);
        this.resizeTerminalProcess();
        this.connectTerminalProcess();
        if (IBaseTerminalServer.validateId(this.terminalId)) {
            this.onDidOpenEmitter.fire(undefined);
            return this.terminalId;
        }
        this.onDidOpenFailureEmitter.fire(undefined);
        throw new Error('Failed to start terminal' + (id ? ` for id: ${id}.` : '.'));
    }

    protected async attachTerminal(id: number): Promise<number> {
        const terminalId = await this.shellTerminalServer.attach(id);
        if (IBaseTerminalServer.validateId(terminalId)) {
            return terminalId;
        }
        this.logger.error(`Error attaching to terminal id ${id}, the terminal is most likely gone. Starting up a new terminal instead.`);
        if (this.kind === 'user') {
            return this.createTerminal();
        } else {
            return -1;
        }
    }

    protected async createTerminal(): Promise<number> {
        let rootURI = this.options.cwd;
        if (!rootURI) {
            const root = (await this.workspaceService.roots)[0];
            rootURI = root && root.uri;
        }
        const { cols, rows } = this.term;

        const terminalId = await this.shellTerminalServer.create({
            shell: this.options.shellPath,
            args: this.options.shellArgs,
            env: this.options.env,
            rootURI,
            cols,
            rows
        });
        if (IBaseTerminalServer.validateId(terminalId)) {
            return terminalId;
        }
        throw new Error('Error creating terminal widget, see the backend error log for more information.');
    }

    processMessage(msg: Message): void {
        super.processMessage(msg);
        switch (msg.type) {
            case 'fit-request':
                this.onFitRequest(msg);
                break;
            default:
                break;
        }
    }
    protected onFitRequest(msg: Message): void {
        super.onFitRequest(msg);
        MessageLoop.sendMessage(this, Widget.ResizeMessage.UnknownSize);
    }
    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.term.focus();
    }
    protected onAfterShow(msg: Message): void {
        super.onAfterShow(msg);
        this.update();
    }
    protected onAfterAttach(msg: Message): void {
        Widget.attach(this.searchBox, this.node);
        super.onAfterAttach(msg);
        this.update();
    }
    protected onResize(msg: Widget.ResizeMessage): void {
        super.onResize(msg);
        this.needsResize = true;
        this.update();
    }

    protected needsResize = true;
    protected onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        if (!this.isVisible || !this.isAttached) {
            return;
        }

        this.open();

        if (this.needsResize) {
            this.resizeTerminal();
            this.needsResize = false;

            this.resizeTerminalProcess();
        }
    }

    // Device status code emitted by Xterm.js
    // Check: https://github.com/xtermjs/xterm.js/blob/release/3.14/src/InputHandler.ts#L1055-L1082
    protected readonly deviceStatusCodes = new Set(['\u001B[>0;276;0c', '\u001B[>85;95;0c', '\u001B[>83;40003;0c', '\u001B[?1;2c', '\u001B[?6c']);

    protected connectTerminalProcess(): void {
        if (typeof this.terminalId !== 'number') {
            return;
        }
        this.toDisposeOnConnect.dispose();
        this.toDispose.push(this.toDisposeOnConnect);
        const waitForConnection = this.waitForConnection = new Deferred<MessageConnection>();
        this.webSocketConnectionProvider.listen({
            path: `${terminalsPath}/${this.terminalId}`,
            onConnection: connection => {
                connection.onNotification('onData', (data: string) => this.write(data));

                // Excludes the device status code emitted by Xterm.js
                const sendData = (data?: string) => {
                    if (data && !this.deviceStatusCodes.has(data)) {
                        return connection.sendRequest('write', data);
                    }
                };

                const disposable = this.term.onData(sendData);
                connection.onDispose(() => disposable.dispose());

                this.toDisposeOnConnect.push(connection);
                connection.listen();
                if (waitForConnection) {
                    waitForConnection.resolve(connection);
                }
            }
        }, { reconnecting: false });
    }
    protected async reconnectTerminalProcess(): Promise<void> {
        if (typeof this.terminalId === 'number') {
            await this.start(this.terminalId);
        }
    }

    protected termOpened = false;
    protected initialData = '';
    protected open(): void {
        if (this.termOpened) {
            return;
        }
        this.term.open(this.node);
        if (this.initialData) {
            this.term.write(this.initialData);
        }
        this.termOpened = true;
        this.initialData = '';

        if (isFirefox) {
            // The software scrollbars don't work with xterm.js, so we disable the scrollbar if we are on firefox.
            if (this.term.element) {
                (this.term.element.children.item(0) as HTMLElement).style.overflow = 'hidden';
            }
        }
    }
    protected write(data: string): void {
        if (this.termOpened) {
            this.term.write(data);
        } else {
            this.initialData += data;
        }
    }

    sendText(text: string): void {
        if (this.waitForConnection) {
            this.waitForConnection.promise.then(connection =>
                connection.sendRequest('write', text)
            );
        }
    }

    async executeCommand(commandOptions: CommandLineOptions): Promise<void> {
        this.sendText(this.shellCommandBuilder.buildCommand(await this.processInfo, commandOptions) + '\n');
    }

    scrollLineUp(): void {
        this.term.scrollLines(-1);
    }

    scrollLineDown(): void {
        this.term.scrollLines(1);
    }

    scrollToTop(): void {
        this.term.scrollToTop();
    }

    scrollToBottom(): void {
        this.term.scrollToBottom();
    }

    scrollPageUp(): void {
        this.term.scrollPages(-1);
    }

    scrollPageDown(): void {
        this.term.scrollPages(1);
    }

    resetTerminal(): void {
        this.term.reset();
    }

    writeLine(text: string): void {
        this.term.writeln(text);
    }

    get onTerminalDidClose(): Event<TerminalWidget> {
        return this.onTermDidClose.event;
    }

    dispose(): void {
        /* Close the backend terminal only when explicitly closing the terminal
         * a refresh for example won't close it.  */
        if (this.closeOnDispose === true && typeof this.terminalId === 'number') {
            this.shellTerminalServer.close(this.terminalId);
            this.onTermDidClose.fire(this);
        }
        super.dispose();
    }

    protected resizeTerminal(): void {
        const geo = this.fitAddon.proposeDimensions();
        const cols = geo.cols;
        const rows = geo.rows - 1; // subtract one row for margin
        this.term.resize(cols, rows);
    }

    protected resizeTerminalProcess(): void {
        if (!IBaseTerminalServer.validateId(this.terminalId)
            && !this.terminalService.getById(this.id)) {
            return;
        }
        const { cols, rows } = this.term;
        this.shellTerminalServer.resize(this.terminalId, cols, rows);
    }

    protected get enableCopy(): boolean {
        return this.preferences['terminal.enableCopy'];
    }

    protected get enablePaste(): boolean {
        return this.preferences['terminal.enablePaste'];
    }

    protected customKeyHandler(event: KeyboardEvent): boolean {
        const keyBindings = KeyCode.createKeyCode(event).toString();
        const ctrlCmdCopy = (isOSX && keyBindings === 'meta+c') || (!isOSX && keyBindings === 'ctrl+c');
        const ctrlCmdPaste = (isOSX && keyBindings === 'meta+v') || (!isOSX && keyBindings === 'ctrl+v');
        if (ctrlCmdCopy && this.enableCopy && this.term.hasSelection()) {
            return false;
        }
        if (ctrlCmdPaste && this.enablePaste) {
            return false;
        }
        return true;
    }

    protected get copyOnSelection(): boolean {
        return this.preferences['terminal.integrated.copyOnSelection'];
    }

    protected attachCustomKeyEventHandler(): void {
        this.term.attachCustomKeyEventHandler(e => this.customKeyHandler(e));
    }

    setTitle(title: string): void {
        this.title.caption = title;
        this.title.label = title;
    }
}

/**
 * @since 1.1.0
 * @deprecated since 1.1.0. Use `TerminalWidget` instead.
 */
export class TerminalWidgetImpl extends TerminalWidget { }
