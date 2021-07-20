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

import { interfaces } from '@theia/core/shared/inversify';
import { RPCProtocol } from '../../../common/rpc-protocol';
import {
    DebugMain,
    DebugExt,
    MAIN_RPC_CONTEXT
} from '../../../common/plugin-api-rpc';
import { DebugSessionManager } from '@theia/debug/lib/browser/debug-session-manager';
import { Breakpoint, WorkspaceFolder } from '../../../common/plugin-api-rpc-model';
import { LabelProvider } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser';
import { BreakpointManager, BreakpointsChangeEvent } from '@theia/debug/lib/browser/breakpoint/breakpoint-manager';
import { DebugSourceBreakpoint } from '@theia/debug/lib/browser/model/debug-source-breakpoint';
import { URI as Uri } from '@theia/core/shared/vscode-uri';
import { SourceBreakpoint, FunctionBreakpoint } from '@theia/debug/lib/browser/breakpoint/breakpoint-marker';
import { DebugConfiguration, DebugSessionOptions } from '@theia/debug/lib/common/debug-configuration';
import { ConnectionMainImpl } from '../connection-main';
import { DebuggerDescription } from '@theia/debug/lib/common/debug-service';
import { DebugProtocol } from 'vscode-debugprotocol';
import { DebugConfigurationManager } from '@theia/debug/lib/browser/debug-configuration-manager';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { MessageClient } from '@theia/core/lib/common/message-service-protocol';
import { OutputChannelManager } from '@theia/output/lib/common/output-channel';
import { DebugPreferences } from '@theia/debug/lib/browser/debug-preferences';
import { PluginDebugAdapterContribution } from './plugin-debug-adapter-contribution';
import { PluginDebugSessionContributionRegistrator, PluginDebugSessionContributionRegistry } from './plugin-debug-session-contribution-registry';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { PluginDebugSessionFactory } from './plugin-debug-session-factory';
import { PluginWebSocketChannel } from '../../../common/connection';
import { PluginDebugAdapterContributionRegistrator, PluginDebugService } from './plugin-debug-service';
import { HostedPluginSupport } from '../../../hosted/browser/hosted-plugin';
import { DebugFunctionBreakpoint } from '@theia/debug/lib/browser/model/debug-function-breakpoint';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { ConsoleSessionManager } from '@theia/console/lib/browser/console-session-manager';
import { DebugConsoleSession } from '@theia/debug/lib/browser/console/debug-console-session';
import { ContributionProvider } from '@theia/core/lib/common';
import { DebugContribution } from '@theia/debug/lib/browser/debug-contribution';

export class DebugMainImpl implements DebugMain, Disposable {
    private readonly debugExt: DebugExt;

    private readonly sessionManager: DebugSessionManager;
    private readonly labelProvider: LabelProvider;
    private readonly editorManager: EditorManager;
    private readonly breakpointsManager: BreakpointManager;
    private readonly consoleSessionManager: ConsoleSessionManager;
    private readonly configurationManager: DebugConfigurationManager;
    private readonly terminalService: TerminalService;
    private readonly messages: MessageClient;
    private readonly outputChannelManager: OutputChannelManager;
    private readonly debugPreferences: DebugPreferences;
    private readonly sessionContributionRegistrator: PluginDebugSessionContributionRegistrator;
    private readonly adapterContributionRegistrator: PluginDebugAdapterContributionRegistrator;
    private readonly fileService: FileService;
    private readonly pluginService: HostedPluginSupport;
    private readonly debugContributionProvider: ContributionProvider<DebugContribution>;

    private readonly debuggerContributions = new Map<string, DisposableCollection>();
    private readonly toDispose = new DisposableCollection();

    constructor(rpc: RPCProtocol, readonly connectionMain: ConnectionMainImpl, container: interfaces.Container) {
        this.debugExt = rpc.getProxy(MAIN_RPC_CONTEXT.DEBUG_EXT);
        this.sessionManager = container.get(DebugSessionManager);
        this.labelProvider = container.get(LabelProvider);
        this.editorManager = container.get(EditorManager);
        this.breakpointsManager = container.get(BreakpointManager);
        this.consoleSessionManager = container.get(ConsoleSessionManager);
        this.configurationManager = container.get(DebugConfigurationManager);
        this.terminalService = container.get(TerminalService);
        this.messages = container.get(MessageClient);
        this.outputChannelManager = container.get(OutputChannelManager);
        this.debugPreferences = container.get(DebugPreferences);
        this.adapterContributionRegistrator = container.get(PluginDebugService);
        this.sessionContributionRegistrator = container.get(PluginDebugSessionContributionRegistry);
        this.debugContributionProvider = container.getNamed(ContributionProvider, DebugContribution);
        this.fileService = container.get(FileService);
        this.pluginService = container.get(HostedPluginSupport);

        const fireDidChangeBreakpoints = ({ added, removed, changed }: BreakpointsChangeEvent<SourceBreakpoint | FunctionBreakpoint>) => {
            this.debugExt.$breakpointsDidChange(
                this.toTheiaPluginApiBreakpoints(added),
                removed.map(b => b.id),
                this.toTheiaPluginApiBreakpoints(changed)
            );
        };
        this.debugExt.$breakpointsDidChange(this.toTheiaPluginApiBreakpoints(this.breakpointsManager.getBreakpoints()), [], []);
        this.debugExt.$breakpointsDidChange(this.toTheiaPluginApiBreakpoints(this.breakpointsManager.getFunctionBreakpoints()), [], []);

        this.toDispose.pushAll([
            this.breakpointsManager.onDidChangeBreakpoints(fireDidChangeBreakpoints),
            this.breakpointsManager.onDidChangeFunctionBreakpoints(fireDidChangeBreakpoints),
            this.sessionManager.onDidCreateDebugSession(debugSession => this.debugExt.$sessionDidCreate(debugSession.id)),
            this.sessionManager.onDidDestroyDebugSession(debugSession => this.debugExt.$sessionDidDestroy(debugSession.id)),
            this.sessionManager.onDidChangeActiveDebugSession(event => this.debugExt.$sessionDidChange(event.current && event.current.id)),
            this.sessionManager.onDidReceiveDebugSessionCustomEvent(event => this.debugExt.$onSessionCustomEvent(event.session.id, event.event, event.body))
        ]);
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    async $appendToDebugConsole(value: string): Promise<void> {
        const session = this.consoleSessionManager.selectedSession;
        if (session instanceof DebugConsoleSession) {
            session.append(value);
        }
    }

    async $appendLineToDebugConsole(value: string): Promise<void> {
        const session = this.consoleSessionManager.selectedSession;
        if (session instanceof DebugConsoleSession) {
            session.appendLine(value);
        }
    }

    async $registerDebuggerContribution(description: DebuggerDescription): Promise<void> {
        const debugType = description.type;
        const terminalOptionsExt = await this.debugExt.$getTerminalCreationOptions(debugType);
        if (this.toDispose.disposed) {
            return;
        }

        const debugSessionFactory = new PluginDebugSessionFactory(
            this.terminalService,
            this.editorManager,
            this.breakpointsManager,
            this.labelProvider,
            this.messages,
            this.outputChannelManager,
            this.debugPreferences,
            async (sessionId: string) => {
                const connection = await this.connectionMain.ensureConnection(sessionId);
                return new PluginWebSocketChannel(connection);
            },
            this.fileService,
            terminalOptionsExt,
            this.debugContributionProvider
        );

        const toDispose = new DisposableCollection(
            Disposable.create(() => this.debuggerContributions.delete(debugType))
        );
        this.debuggerContributions.set(debugType, toDispose);
        toDispose.pushAll([
            this.adapterContributionRegistrator.registerDebugAdapterContribution(
                new PluginDebugAdapterContribution(description, this.debugExt, this.pluginService)
            ),
            this.sessionContributionRegistrator.registerDebugSessionContribution({
                debugType: description.type,
                debugSessionFactory: () => debugSessionFactory
            })
        ]);
        this.toDispose.push(Disposable.create(() => this.$unregisterDebuggerConfiguration(debugType)));
    }

    async $unregisterDebuggerConfiguration(debugType: string): Promise<void> {
        const disposable = this.debuggerContributions.get(debugType);
        if (disposable) {
            disposable.dispose();
        }
    }

    async $addBreakpoints(breakpoints: Breakpoint[]): Promise<void> {
        const newBreakpoints = new Map<string, Breakpoint>();
        breakpoints.forEach(b => newBreakpoints.set(b.id, b));
        this.breakpointsManager.findMarkers({
            dataFilter: data => {
                // install only new breakpoints
                if (newBreakpoints.has(data.id)) {
                    newBreakpoints.delete(data.id);
                }
                return false;
            }
        });
        let addedFunctionBreakpoints = false;
        const functionBreakpoints = this.breakpointsManager.getFunctionBreakpoints();
        for (const breakpoint of functionBreakpoints) {
            // install only new breakpoints
            if (newBreakpoints.has(breakpoint.id)) {
                newBreakpoints.delete(breakpoint.id);
            }
        }
        for (const breakpoint of newBreakpoints.values()) {
            if (breakpoint.location) {
                const location = breakpoint.location;
                const column = breakpoint.location.range.startColumn;
                this.breakpointsManager.addBreakpoint({
                    id: breakpoint.id,
                    uri: Uri.revive(location.uri).toString(),
                    enabled: breakpoint.enabled,
                    raw: {
                        line: breakpoint.location.range.startLineNumber + 1,
                        column: column > 0 ? column + 1 : undefined,
                        condition: breakpoint.condition,
                        hitCondition: breakpoint.hitCondition,
                        logMessage: breakpoint.logMessage
                    }
                });
            } else if (breakpoint.functionName) {
                addedFunctionBreakpoints = true;
                functionBreakpoints.push({
                    id: breakpoint.id,
                    enabled: breakpoint.enabled,
                    raw: {
                        name: breakpoint.functionName
                    }
                });
            }
        }
        if (addedFunctionBreakpoints) {
            this.breakpointsManager.setFunctionBreakpoints(functionBreakpoints);
        }
    }

    async $removeBreakpoints(breakpoints: string[]): Promise<void> {
        const { labelProvider, breakpointsManager, editorManager } = this;
        const session = this.sessionManager.currentSession;

        const ids = new Set<string>(breakpoints);
        for (const origin of this.breakpointsManager.findMarkers({ dataFilter: data => ids.has(data.id) })) {
            const breakpoint = new DebugSourceBreakpoint(origin.data, { labelProvider, breakpoints: breakpointsManager, editorManager, session });
            breakpoint.remove();
        }
        for (const origin of this.breakpointsManager.getFunctionBreakpoints()) {
            if (ids.has(origin.id)) {
                const breakpoint = new DebugFunctionBreakpoint(origin, { labelProvider, breakpoints: breakpointsManager, editorManager, session });
                breakpoint.remove();
            }
        }
    }

    async $customRequest(sessionId: string, command: string, args?: any): Promise<DebugProtocol.Response> {
        const session = this.sessionManager.getSession(sessionId);
        if (session) {
            return session.sendCustomRequest(command, args);
        }

        throw new Error(`Debug session '${sessionId}' not found`);
    }

    async $startDebugging(folder: WorkspaceFolder | undefined, nameOrConfiguration: string | DebugConfiguration, options: DebugSessionOptions): Promise<boolean> {
        let configuration: DebugConfiguration | undefined;

        if (typeof nameOrConfiguration === 'string') {
            for (const configOptions of this.configurationManager.all) {
                if (configOptions.configuration.name === nameOrConfiguration) {
                    configuration = configOptions.configuration;
                }
            }
        } else {
            configuration = nameOrConfiguration;
        }

        if (!configuration) {
            console.error(`There is no debug configuration for ${nameOrConfiguration}`);
            return false;
        }

        Object.assign(configuration, options);

        const session = await this.sessionManager.start({
            configuration,
            workspaceFolderUri: folder && Uri.revive(folder.uri).toString()
        });

        return !!session;
    }

    private toTheiaPluginApiBreakpoints(breakpoints: (SourceBreakpoint | FunctionBreakpoint)[]): Breakpoint[] {
        return breakpoints.map(b => this.toTheiaPluginApiBreakpoint(b));
    }

    private toTheiaPluginApiBreakpoint(breakpoint: SourceBreakpoint | FunctionBreakpoint): Breakpoint {
        if ('uri' in breakpoint) {
            const raw = breakpoint.raw;
            return {
                id: breakpoint.id,
                enabled: breakpoint.enabled,
                condition: breakpoint.raw.condition,
                hitCondition: breakpoint.raw.hitCondition,
                logMessage: raw.logMessage,
                location: {
                    uri: Uri.parse(breakpoint.uri),
                    range: {
                        startLineNumber: raw.line - 1,
                        startColumn: (raw.column || 1) - 1,
                        endLineNumber: raw.line - 1,
                        endColumn: (raw.column || 1) - 1
                    }
                }
            };
        }
        return {
            id: breakpoint.id,
            enabled: breakpoint.enabled,
            functionName: breakpoint.raw.name
        };
    }
}
