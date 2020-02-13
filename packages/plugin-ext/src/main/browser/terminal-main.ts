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

import { injectable, inject, postConstruct } from 'inversify';
import { ApplicationShell, WidgetOpenerOptions } from '@theia/core/lib/browser';
import { TerminalOptions } from '@theia/plugin';
import { TerminalWidget } from '@theia/terminal/lib/browser/base/terminal-widget';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { TerminalServiceMain, TerminalServiceExt, MAIN_RPC_CONTEXT, PLUGIN_RPC_CONTEXT } from '../../common/plugin-api-rpc';
import { RPCProtocol, ProxyIdentifier } from '../../common/rpc-protocol';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { RPCProtocolServiceProvider } from './main-context';

/**
 * Plugin api service allows working with terminal emulator.
 */
@injectable()
export class TerminalServiceMainImpl implements TerminalServiceMain, Disposable, RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any> = PLUGIN_RPC_CONTEXT.TERMINAL_MAIN;

    @inject(TerminalService)
    private readonly terminals: TerminalService;

    @inject(ApplicationShell)
    private readonly shell: ApplicationShell;

    @inject(RPCProtocol)
    private readonly rpc: RPCProtocol;

    private extProxy: TerminalServiceExt;

    private readonly toDispose = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        this.extProxy = this.rpc.getProxy(MAIN_RPC_CONTEXT.TERMINAL_EXT);
        this.toDispose.push(this.terminals.onDidCreateTerminal(terminal => this.trackTerminal(terminal)));
        for (const terminal of this.terminals.all) {
            this.trackTerminal(terminal);
        }
        this.toDispose.push(this.terminals.onDidChangeCurrentTerminal(() => this.updateCurrentTerminal()));
        this.updateCurrentTerminal();
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    protected updateCurrentTerminal(): void {
        const { currentTerminal } = this.terminals;
        this.extProxy.$currentTerminalChanged(currentTerminal && currentTerminal.id);
    }

    protected async trackTerminal(terminal: TerminalWidget): Promise<void> {
        let name = terminal.title.label;
        this.extProxy.$terminalCreated(terminal.id, name);
        const updateTitle = () => {
            if (name !== terminal.title.label) {
                name = terminal.title.label;
                this.extProxy.$terminalNameChanged(terminal.id, name);
            }
        };
        terminal.title.changed.connect(updateTitle);
        this.toDispose.push(Disposable.create(() => terminal.title.changed.disconnect(updateTitle)));

        const updateProcessId = () => terminal.processId.then(
            processId => this.extProxy.$terminalOpened(terminal.id, processId),
            () => {/* no-op */ }
        );
        updateProcessId();
        this.toDispose.push(terminal.onDidOpen(() => updateProcessId()));
        this.toDispose.push(terminal.onTerminalDidClose(() => this.extProxy.$terminalClosed(terminal.id)));
    }

    async $createTerminal(id: string, options: TerminalOptions): Promise<string> {
        try {
            const terminal = await this.terminals.newTerminal({
                id,
                title: options.name,
                shellPath: options.shellPath,
                shellArgs: options.shellArgs,
                cwd: options.cwd,
                env: options.env,
                destroyTermOnClose: true,
                useServerTitle: false,
                attributes: options.attributes
            });
            terminal.start();
            return terminal.id;
        } catch (error) {
            throw new Error('Failed to create terminal. Cause: ' + error);
        }
    }

    $sendText(id: string, text: string, addNewLine?: boolean): void {
        const terminal = this.terminals.getById(id);
        if (terminal) {
            text = text.replace(/\r?\n/g, '\r');
            if (addNewLine && text.charAt(text.length - 1) !== '\r') {
                text += '\r';
            }
            terminal.sendText(text);
        }
    }

    $show(id: string, preserveFocus?: boolean): void {
        const terminal = this.terminals.getById(id);
        if (terminal) {
            const options: WidgetOpenerOptions = {};
            if (preserveFocus) {
                options.mode = 'reveal';
            }
            this.terminals.open(terminal, options);
        }
    }

    $hide(id: string): void {
        const terminal = this.terminals.getById(id);
        if (terminal && terminal.isVisible) {
            const area = this.shell.getAreaFor(terminal);
            if (area) {
                this.shell.collapsePanel(area);
            }
        }
    }

    $dispose(id: string): void {
        const terminal = this.terminals.getById(id);
        if (terminal) {
            terminal.dispose();
        }
    }
}
