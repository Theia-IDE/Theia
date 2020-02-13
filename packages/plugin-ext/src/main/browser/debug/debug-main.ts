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

import { injectable, inject, postConstruct } from 'inversify';
import { RPCProtocol, ProxyIdentifier } from '../../../common/rpc-protocol';
import {
    DebugMain,
    DebugExt,
    MAIN_RPC_CONTEXT,
    PLUGIN_RPC_CONTEXT
} from '../../../common/plugin-api-rpc';
import { DebugSessionManager } from '@theia/debug/lib/browser/debug-session-manager';
import { Breakpoint, WorkspaceFolder } from '../../../common/plugin-api-rpc-model';
import { LabelProvider } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser';
import { BreakpointManager, BreakpointsChangeEvent } from '@theia/debug/lib/browser/breakpoint/breakpoint-manager';
import { DebugSourceBreakpoint } from '@theia/debug/lib/browser/model/debug-source-breakpoint';
import Uri from 'vscode-uri';
import { DebugConsoleSession } from '@theia/debug/lib/browser/console/debug-console-session';
import { SourceBreakpoint, FunctionBreakpoint } from '@theia/debug/lib/browser/breakpoint/breakpoint-marker';
import { DebugConfiguration } from '@theia/debug/lib/common/debug-configuration';
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
import { PluginDebugService } from './plugin-debug-service';
import { FileSystem } from '@theia/filesystem/lib/common';
import { HostedPluginSupport } from '../../../hosted/browser/hosted-plugin';
import { DebugFunctionBreakpoint } from '@theia/debug/lib/browser/model/debug-function-breakpoint';
import { RPCProtocolServiceProvider } from '../main-context';

@injectable()
export class DebugMainImpl implements DebugMain, Disposable, RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any> = PLUGIN_RPC_CONTEXT.DEBUG_MAIN;

    private debugExt: DebugExt;

    @inject(DebugSessionManager)
    private readonly sessionManager: DebugSessionManager;

    @inject(LabelProvider)
    private readonly labelProvider: LabelProvider;

    @inject(EditorManager)
    private readonly editorManager: EditorManager;

    @inject(BreakpointManager)
    private readonly breakpointsManager: BreakpointManager;

    @inject(DebugConsoleSession)
    private readonly debugConsoleSession: DebugConsoleSession;

    @inject(DebugConfigurationManager)
    private readonly configurationManager: DebugConfigurationManager;

    @inject(TerminalService)
    private readonly terminalService: TerminalService;

    @inject(MessageClient)
    private readonly messages: MessageClient;

    @inject(OutputChannelManager)
    private readonly outputChannelManager: OutputChannelManager;

    @inject(DebugPreferences)
    private readonly debugPreferences: DebugPreferences;

    @inject(PluginDebugSessionContributionRegistry)
    private readonly sessionContributionRegistrator: PluginDebugSessionContributionRegistrator;

    @inject(PluginDebugService)
    private readonly adapterContributionRegistrator: PluginDebugService;

    @inject(FileSystem)
    private readonly fileSystem: FileSystem;

    @inject(HostedPluginSupport)
    private readonly pluginService: HostedPluginSupport;

    @inject(ConnectionMainImpl)
    private readonly connectionMain: ConnectionMainImpl;

    @inject(RPCProtocol)
    private readonly rpc: RPCProtocol;

    private readonly debuggerContributions = new Map<string, DisposableCollection>();
    private readonly toDispose = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        this.debugExt = this.rpc.getProxy(MAIN_RPC_CONTEXT.DEBUG_EXT);
        const fireDidChangeBreakpoints = ({ added, removed, changed }: BreakpointsChangeEvent<SourceBreakpoint | FunctionBreakpoint>) => {
            this.debugExt.$breakpointsDidChange(
                this.toTheiaPluginApiBreakpoints(added),
                removed.map(b => b.id),
                this.toTheiaPluginApiBreakpoints(changed)
            );
        };
        this.debugExt.$breakpointsDidChange(this.toTheiaPluginApiBreakpoints(this.breakpointsManager.getBreakpoints()), [], []);
        this.breakpointsManager.onDidChangeBreakpoints(fireDidChangeBreakpoints);
        this.debugExt.$breakpointsDidChange(this.toTheiaPluginApiBreakpoints(this.breakpointsManager.getFunctionBreakpoints()), [], []);
        this.breakpointsManager.onDidChangeFunctionBreakpoints(fireDidChangeBreakpoints);

        this.toDispose.pushAll([
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
        this.debugConsoleSession.append(value);
    }

    async $appendLineToDebugConsole(value: string): Promise<void> {
        this.debugConsoleSession.appendLine(value);
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
            this.fileSystem,
            terminalOptionsExt
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

    async $startDebugging(folder: WorkspaceFolder | undefined, nameOrConfiguration: string | DebugConfiguration): Promise<boolean> {
        let configuration: DebugConfiguration | undefined;

        if (typeof nameOrConfiguration === 'string') {
            for (const options of this.configurationManager.all) {
                if (options.configuration.name === nameOrConfiguration) {
                    configuration = options.configuration;
                }
            }
        } else {
            configuration = nameOrConfiguration;
        }

        if (!configuration) {
            console.error(`There is no debug configuration for ${nameOrConfiguration}`);
            return false;
        }

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
