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

import { DefaultDebugSessionFactory, } from '@theia/debug/lib/browser/debug-session-contribution';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { BreakpointManager } from '@theia/debug/lib/browser/breakpoint/breakpoint-manager';
import { LabelProvider } from '@theia/core/lib/browser/label-provider';
import { MessageClient } from '@theia/core/lib/common/message-service-protocol';
import { OutputChannelManager } from '@theia/output/lib/common/output-channel';
import { DebugPreferences } from '@theia/debug/lib/browser/debug-preferences';
import { DebugSessionOptions } from '@theia/debug/lib/browser/debug-session-options';
import { DebugSession } from '@theia/debug/lib/browser/debug-session';
import { DebugSessionConnection } from '@theia/debug/lib/browser/debug-session-connection';
import { IWebSocket } from '@theia/core/shared/vscode-ws-jsonrpc';
import { TerminalWidgetOptions, TerminalWidget } from '@theia/terminal/lib/browser/base/terminal-widget';
import { TerminalOptionsExt } from '../../../common/plugin-api-rpc';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { DebugContribution } from '@theia/debug/lib/browser/debug-contribution';
import { ContributionProvider } from '@theia/core';

export class PluginDebugSession extends DebugSession {
    constructor(
        readonly id: string,
        readonly options: DebugSessionOptions,
        readonly parentSession: DebugSession | undefined,
        protected readonly connection: DebugSessionConnection,
        protected readonly terminalServer: TerminalService,
        protected readonly editorManager: EditorManager,
        protected readonly breakpoints: BreakpointManager,
        protected readonly labelProvider: LabelProvider,
        protected readonly messages: MessageClient,
        protected readonly fileService: FileService,
        protected readonly terminalOptionsExt: TerminalOptionsExt | undefined,
        protected readonly debugContributionProvider: ContributionProvider<DebugContribution>) {
        super(id, options, parentSession, connection, terminalServer, editorManager, breakpoints, labelProvider, messages, fileService, debugContributionProvider);
    }

    protected async doCreateTerminal(terminalWidgetOptions: TerminalWidgetOptions): Promise<TerminalWidget> {
        terminalWidgetOptions = Object.assign({}, terminalWidgetOptions, this.terminalOptionsExt);
        return super.doCreateTerminal(terminalWidgetOptions);
    }
}

/**
 * Session factory for a client debug session that communicates with debug adapter contributed as plugin.
 * The main difference is to use a connection factory that creates [IWebSocket](#IWebSocket) over Rpc channel.
 */
export class PluginDebugSessionFactory extends DefaultDebugSessionFactory {
    constructor(
        protected readonly terminalService: TerminalService,
        protected readonly editorManager: EditorManager,
        protected readonly breakpoints: BreakpointManager,
        protected readonly labelProvider: LabelProvider,
        protected readonly messages: MessageClient,
        protected readonly outputChannelManager: OutputChannelManager,
        protected readonly debugPreferences: DebugPreferences,
        protected readonly connectionFactory: (sessionId: string) => Promise<IWebSocket>,
        protected readonly fileService: FileService,
        protected readonly terminalOptionsExt: TerminalOptionsExt | undefined,
        protected readonly debugContributionProvider: ContributionProvider<DebugContribution>
    ) {
        super();
    }

    get(sessionId: string, options: DebugSessionOptions, parentSession?: DebugSession): DebugSession {
        const connection = new DebugSessionConnection(
            sessionId,
            this.connectionFactory,
            this.getTraceOutputChannel());

        return new PluginDebugSession(
            sessionId,
            options,
            parentSession,
            connection,
            this.terminalService,
            this.editorManager,
            this.breakpoints,
            this.labelProvider,
            this.messages,
            this.fileService,
            this.terminalOptionsExt,
            this.debugContributionProvider
        );
    }
}
