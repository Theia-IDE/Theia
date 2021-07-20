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

import { injectable, inject, named, postConstruct } from '@theia/core/shared/inversify';
import { MessageClient } from '@theia/core/lib/common';
import { LabelProvider } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser/messaging/ws-connection-provider';
import { DebugSession } from './debug-session';
import { BreakpointManager } from './breakpoint/breakpoint-manager';
import { DebugSessionOptions } from './debug-session-options';
import { OutputChannelManager, OutputChannel } from '@theia/output/lib/common/output-channel';
import { DebugPreferences } from './debug-preferences';
import { DebugSessionConnection } from './debug-session-connection';
import { IWebSocket } from '@theia/core/shared/vscode-ws-jsonrpc';
import { DebugAdapterPath } from '../common/debug-service';
import { ContributionProvider } from '@theia/core/lib/common/contribution-provider';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { DebugContribution } from './debug-contribution';

/**
 * DebugSessionContribution symbol for DI.
 */
export const DebugSessionContribution = Symbol('DebugSessionContribution');
/**
 * The [debug session](#DebugSession) contribution.
 * Can be used to instantiate a specific debug sessions.
 */
export interface DebugSessionContribution {
    /**
     * The debug type.
     */
    debugType: string;

    /**
     * The [debug session](#DebugSession) factory.
     */
    debugSessionFactory(): DebugSessionFactory;
}
/**
 * DebugSessionContributionRegistry symbol for DI.
 */
export const DebugSessionContributionRegistry = Symbol('DebugSessionContributionRegistry');
/**
 * Debug session contribution registry.
 */
export interface DebugSessionContributionRegistry {
    get(debugType: string): DebugSessionContribution | undefined;
}

@injectable()
export class DebugSessionContributionRegistryImpl implements DebugSessionContributionRegistry {
    protected readonly contribs = new Map<string, DebugSessionContribution>();

    @inject(ContributionProvider) @named(DebugSessionContribution)
    protected readonly contributions: ContributionProvider<DebugSessionContribution>;

    @postConstruct()
    protected init(): void {
        for (const contrib of this.contributions.getContributions()) {
            this.contribs.set(contrib.debugType, contrib);
        }
    }

    get(debugType: string): DebugSessionContribution | undefined {
        return this.contribs.get(debugType);
    }
}

/**
 * DebugSessionFactory symbol for DI.
 */
export const DebugSessionFactory = Symbol('DebugSessionFactory');

/**
 * The [debug session](#DebugSession) factory.
 */
export interface DebugSessionFactory {
    get(sessionId: string, options: DebugSessionOptions, parentSession?: DebugSession): DebugSession;
}

@injectable()
export class DefaultDebugSessionFactory implements DebugSessionFactory {
    @inject(WebSocketConnectionProvider)
    protected readonly connectionProvider: WebSocketConnectionProvider;
    @inject(TerminalService)
    protected readonly terminalService: TerminalService;
    @inject(EditorManager)
    protected readonly editorManager: EditorManager;
    @inject(BreakpointManager)
    protected readonly breakpoints: BreakpointManager;
    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;
    @inject(MessageClient)
    protected readonly messages: MessageClient;
    @inject(OutputChannelManager)
    protected readonly outputChannelManager: OutputChannelManager;
    @inject(DebugPreferences)
    protected readonly debugPreferences: DebugPreferences;
    @inject(FileService)
    protected readonly fileService: FileService;
    @inject(ContributionProvider) @named(DebugContribution)
    protected readonly debugContributionProvider: ContributionProvider<DebugContribution>;

    get(sessionId: string, options: DebugSessionOptions, parentSession?: DebugSession): DebugSession {
        const connection = new DebugSessionConnection(
            sessionId,
            () => new Promise<IWebSocket>(resolve =>
                this.connectionProvider.openChannel(`${DebugAdapterPath}/${sessionId}`, channel => {
                    resolve(channel);
                }, { reconnecting: false })
            ),
            this.getTraceOutputChannel());
        return new DebugSession(
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
            this.debugContributionProvider);
    }

    protected getTraceOutputChannel(): OutputChannel | undefined {
        if (this.debugPreferences['debug.trace']) {
            return this.outputChannelManager.getChannel('Debug adapters');
        }
    }
}
