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

import * as React from '@theia/core/shared/react';
import { LabelProvider } from '@theia/core/lib/browser';
import { DebugProtocol } from 'vscode-debugprotocol';
import { Emitter, Event, DisposableCollection, Disposable, MessageClient, MessageType, Mutable, ContributionProvider } from '@theia/core/lib/common';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { EditorManager } from '@theia/editor/lib/browser';
import { CompositeTreeElement } from '@theia/core/lib/browser/source-tree';
import { DebugSessionConnection, DebugRequestTypes, DebugEventTypes } from './debug-session-connection';
import { DebugThread, StoppedDetails, DebugThreadData } from './model/debug-thread';
import { DebugScope } from './console/debug-console-items';
import { DebugStackFrame } from './model/debug-stack-frame';
import { DebugSource } from './model/debug-source';
import { DebugBreakpoint, DebugBreakpointOptions } from './model/debug-breakpoint';
import { DebugSourceBreakpoint } from './model/debug-source-breakpoint';
import debounce = require('p-debounce');
import URI from '@theia/core/lib/common/uri';
import { BreakpointManager } from './breakpoint/breakpoint-manager';
import { DebugSessionOptions, InternalDebugSessionOptions } from './debug-session-options';
import { DebugConfiguration } from '../common/debug-common';
import { SourceBreakpoint, ExceptionBreakpoint } from './breakpoint/breakpoint-marker';
import { TerminalWidgetOptions, TerminalWidget } from '@theia/terminal/lib/browser/base/terminal-widget';
import { DebugFunctionBreakpoint } from './model/debug-function-breakpoint';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { DebugContribution } from './debug-contribution';

export enum DebugState {
    Inactive,
    Initializing,
    Running,
    Stopped
}

// FIXME: make injectable to allow easily inject services
export class DebugSession implements CompositeTreeElement {
    protected readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;
    protected fireDidChange(): void {
        this.onDidChangeEmitter.fire(undefined);
    }

    protected readonly onDidChangeBreakpointsEmitter = new Emitter<URI>();
    readonly onDidChangeBreakpoints: Event<URI> = this.onDidChangeBreakpointsEmitter.event;
    protected fireDidChangeBreakpoints(uri: URI): void {
        this.onDidChangeBreakpointsEmitter.fire(uri);
    }

    protected readonly childSessions = new Map<string, DebugSession>();

    protected readonly toDispose = new DisposableCollection();

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
        protected readonly debugContributionProvider: ContributionProvider<DebugContribution>
    ) {
        this.connection.onRequest('runInTerminal', (request: DebugProtocol.RunInTerminalRequest) => this.runInTerminal(request));
        this.registerDebugContributions(options.configuration.type, this.connection);

        if (parentSession) {
            parentSession.childSessions.set(id, this);
            this.toDispose.push(Disposable.create(() => {
                this.parentSession?.childSessions?.delete(id);
            }));
        }
        this.toDispose.pushAll([
            this.onDidChangeEmitter,
            this.onDidChangeBreakpointsEmitter,
            Disposable.create(() => {
                this.clearBreakpoints();
                this.doUpdateThreads([]);
            }),
            this.connection,
            this.on('initialized', () => this.configure()),
            this.on('breakpoint', ({ body }) => this.updateBreakpoint(body)),
            this.on('continued', e => this.handleContinued(e)),
            this.on('stopped', e => this.handleStopped(e)),
            this.on('thread', e => this.handleThread(e)),
            this.on('terminated', () => this.terminated = true),
            this.on('capabilities', event => this.updateCapabilities(event.body.capabilities)),
            this.breakpoints.onDidChangeMarkers(uri => this.updateBreakpoints({ uri, sourceModified: true }))
        ]);
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    get configuration(): DebugConfiguration {
        return this.options.configuration;
    }

    protected _capabilities: DebugProtocol.Capabilities = {};
    get capabilities(): DebugProtocol.Capabilities {
        return this._capabilities;
    }

    protected readonly sources = new Map<string, DebugSource>();
    getSource(raw: DebugProtocol.Source): DebugSource {
        const uri = DebugSource.toUri(raw).toString();
        const source = this.sources.get(uri) || new DebugSource(this, this.editorManager, this.labelProvider);
        source.update({ raw });
        this.sources.set(uri, source);
        return source;
    }

    getSourceForUri(uri: URI): DebugSource | undefined {
        return this.sources.get(uri.toString());
    }

    async toSource(uri: URI): Promise<DebugSource> {
        const source = this.getSourceForUri(uri);
        if (source) {
            return source;
        }

        return this.getSource(await this.toDebugSource(uri));
    }

    async toDebugSource(uri: URI): Promise<DebugProtocol.Source> {
        if (uri.scheme === DebugSource.SCHEME) {
            return {
                name: uri.path.toString(),
                sourceReference: Number(uri.query)
            };
        }
        const name = uri.displayName;
        let path;
        const underlying = await this.fileService.toUnderlyingResource(uri);
        if (underlying.scheme === 'file') {
            path = await this.fileService.fsPath(underlying);
        } else {
            path = uri.toString();
        }
        return { name, path };
    }

    protected _threads = new Map<number, DebugThread>();
    get threads(): IterableIterator<DebugThread> {
        return this._threads.values();
    }

    get threadCount(): number {
        return this._threads.size;
    }

    *getThreads(filter: (thread: DebugThread) => boolean): IterableIterator<DebugThread> {
        for (const thread of this.threads) {
            if (filter(thread)) {
                yield thread;
            }
        }
    }

    get runningThreads(): IterableIterator<DebugThread> {
        return this.getThreads(thread => !thread.stopped);
    }

    get stoppedThreads(): IterableIterator<DebugThread> {
        return this.getThreads(thread => thread.stopped);
    }

    async pauseAll(): Promise<void> {
        const promises: Promise<void>[] = [];
        for (const thread of this.runningThreads) {
            promises.push((async () => {
                try {
                    await thread.pause();
                } catch (e) {
                    console.error('pauseAll failed:', e);
                }
            })());
        }
        await Promise.all(promises);
    }

    async continueAll(): Promise<void> {
        const promises: Promise<void>[] = [];
        for (const thread of this.stoppedThreads) {
            promises.push((async () => {
                try {
                    await thread.continue();
                } catch (e) {
                    console.error('continueAll failed:', e);
                }
            })());
        }
        await Promise.all(promises);
    }

    get currentFrame(): DebugStackFrame | undefined {
        return this.currentThread && this.currentThread.currentFrame;
    }

    protected _currentThread: DebugThread | undefined;
    protected readonly toDisposeOnCurrentThread = new DisposableCollection();
    get currentThread(): DebugThread | undefined {
        return this._currentThread;
    }
    set currentThread(thread: DebugThread | undefined) {
        this.toDisposeOnCurrentThread.dispose();
        this._currentThread = thread;
        this.fireDidChange();
        if (thread) {
            this.toDisposeOnCurrentThread.push(thread.onDidChanged(() => this.fireDidChange()));

            // If this thread is missing stack frame information, then load that.
            this.updateFrames();
        }
    }

    get state(): DebugState {
        if (this.connection.disposed) {
            return DebugState.Inactive;
        }
        if (!this.initialized) {
            return DebugState.Initializing;
        }
        const thread = this.currentThread;
        if (thread) {
            return thread.stopped ? DebugState.Stopped : DebugState.Running;
        }
        return !!this.stoppedThreads.next().value ? DebugState.Stopped : DebugState.Running;
    }

    async getScopes(): Promise<DebugScope[]> {
        const { currentFrame } = this;
        return currentFrame ? currentFrame.getScopes() : [];
    }

    async start(): Promise<void> {
        await this.initialize();
        await this.launchOrAttach();
    }

    protected async initialize(): Promise<void> {
        const response = await this.connection.sendRequest('initialize', {
            clientID: 'Theia',
            clientName: 'Theia IDE',
            adapterID: this.configuration.type,
            locale: 'en-US',
            linesStartAt1: true,
            columnsStartAt1: true,
            pathFormat: 'path',
            supportsVariableType: false,
            supportsVariablePaging: false,
            supportsRunInTerminalRequest: true
        });
        this.updateCapabilities(response?.body || {});
    }

    protected async launchOrAttach(): Promise<void> {
        try {
            await this.sendRequest((this.configuration.request as keyof DebugRequestTypes), this.configuration);
        } catch (reason) {
            this.fireExited(reason);
            await this.messages.showMessage({
                type: MessageType.Error,
                text: reason.message || 'Debug session initialization failed. See console for details.',
                options: {
                    timeout: 10000
                }
            });
            throw reason;
        }
    }

    protected initialized = false;
    protected async configure(): Promise<void> {
        if (this.capabilities.exceptionBreakpointFilters) {
            const exceptionBreakpoints = [];
            for (const filter of this.capabilities.exceptionBreakpointFilters) {
                const origin = this.breakpoints.getExceptionBreakpoint(filter.filter);
                exceptionBreakpoints.push(ExceptionBreakpoint.create(filter, origin));
            }
            this.breakpoints.setExceptionBreakpoints(exceptionBreakpoints);
        }
        await this.updateBreakpoints({ sourceModified: false });
        if (this.capabilities.supportsConfigurationDoneRequest) {
            await this.sendRequest('configurationDone', {});
        }
        this.initialized = true;
        await this.updateThreads(undefined);
    }

    protected terminated = false;
    async terminate(restart?: boolean): Promise<void> {
        if (!this.terminated && this.capabilities.supportsTerminateRequest && this.configuration.request === 'launch') {
            this.terminated = true;
            await this.connection.sendRequest('terminate', { restart });
            if (!await this.exited(1000)) {
                await this.disconnect(restart);
            }
        } else {
            await this.disconnect(restart);
        }
    }

    protected async disconnect(restart?: boolean): Promise<void> {
        const TIMEOUT_MS = 1000;
        Promise.race([
            this.sendRequest('disconnect', { restart }),
            new Promise(reject => setTimeout(reject, TIMEOUT_MS, new Error('TIMEOUT_ERR')))
        ]).then(res => {
            if (res instanceof Error) {
                this.fireExited(res);
            }
        }).catch(() => this.fireExited());
    }

    protected fireExited(reason?: Error): void {
        try {
            this.connection['fire']('exited', { reason });
        } catch (e) {
            console.error(e);
        }
    }

    protected exited(timeout: number): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            const listener = this.on('exited', () => {
                listener.dispose();
                resolve(true);
            });
            setTimeout(() => {
                listener.dispose();
                resolve(false);
            }, timeout);
        });
    }

    async restart(): Promise<boolean> {
        if (this.capabilities.supportsRestartRequest) {
            this.terminated = false;
            await this.sendRequest('restart', {});
            return true;
        }
        return false;
    }

    async completions(text: string, column: number, line: number): Promise<DebugProtocol.CompletionItem[]> {
        const frameId = this.currentFrame && this.currentFrame.raw.id;
        const response = await this.sendRequest('completions', { frameId, text, column, line });
        return response.body.targets;
    }

    async evaluate(expression: string, context?: string): Promise<DebugProtocol.EvaluateResponse['body']> {
        const frameId = this.currentFrame && this.currentFrame.raw.id;
        const response = await this.sendRequest('evaluate', { expression, frameId, context });
        return response.body;
    }

    sendRequest<K extends keyof DebugRequestTypes>(command: K, args: DebugRequestTypes[K][0]): Promise<DebugRequestTypes[K][1]> {
        return this.connection.sendRequest(command, args);
    }

    sendCustomRequest<T extends DebugProtocol.Response>(command: string, args?: any): Promise<T> {
        return this.connection.sendCustomRequest(command, args);
    }

    on<K extends keyof DebugEventTypes>(kind: K, listener: (e: DebugEventTypes[K]) => any): Disposable {
        return this.connection.on(kind, listener);
    }

    get onDidCustomEvent(): Event<DebugProtocol.Event> {
        return this.connection.onDidCustomEvent;
    }

    protected async runInTerminal({ arguments: { title, cwd, args, env } }: DebugProtocol.RunInTerminalRequest): Promise<DebugProtocol.RunInTerminalResponse['body']> {
        const terminal = await this.doCreateTerminal({ title, cwd, env, useServerTitle: false });
        const { processId } = terminal;
        await terminal.executeCommand({ cwd, args, env });
        return { processId: await processId };
    }

    protected async doCreateTerminal(options: TerminalWidgetOptions): Promise<TerminalWidget> {
        let terminal = undefined;
        for (const t of this.terminalServer.all) {
            if ((t.title.label === options.title || t.title.caption === options.title) && (await t.hasChildProcesses()) === false) {
                terminal = t;
                break;
            }
        }

        if (!terminal) {
            terminal = await this.terminalServer.newTerminal(options);
            await terminal.start();
        }
        this.terminalServer.open(terminal);
        return terminal;
    }

    protected clearThreads(): void {
        for (const thread of this.threads) {
            thread.clear();
        }
        this.updateCurrentThread();
    }

    protected clearThread(threadId: number): void {
        const thread = this._threads.get(threadId);
        if (thread) {
            thread.clear();
        }
        this.updateCurrentThread();
    }

    protected readonly scheduleUpdateThreads = debounce(() => this.updateThreads(undefined), 100);
    protected pendingThreads = Promise.resolve();

    updateThreads(stoppedDetails: StoppedDetails | undefined): Promise<void> {
        return this.pendingThreads = this.pendingThreads.then(async () => {
            try {
                const response = await this.sendRequest('threads', {});
                // java debugger returns an empty body sometimes
                const threads = response && response.body && response.body.threads || [];
                this.doUpdateThreads(threads, stoppedDetails);
            } catch (e) {
                console.error('updateThreads failed:', e);
            }
        });
    }

    protected doUpdateThreads(threads: DebugProtocol.Thread[], stoppedDetails?: StoppedDetails): void {
        const existing = this._threads;
        this._threads = new Map();
        for (const raw of threads) {
            const id = raw.id;
            const thread = existing.get(id) || new DebugThread(this);
            this._threads.set(id, thread);
            const data: Partial<Mutable<DebugThreadData>> = { raw };
            if (stoppedDetails) {
                if (stoppedDetails.threadId === id) {
                    data.stoppedDetails = stoppedDetails;
                } else if (stoppedDetails.allThreadsStopped) {
                    data.stoppedDetails = {
                        // When a debug adapter notifies us that all threads are stopped,
                        // we do not know why the others are stopped, so we should default
                        // to something generic.
                        reason: '',
                    };
                }
            }
            thread.update(data);
        }
        this.updateCurrentThread(stoppedDetails);
    }

    protected updateCurrentThread(stoppedDetails?: StoppedDetails): void {
        const { currentThread } = this;
        let threadId = currentThread && currentThread.raw.id;
        if (stoppedDetails && !stoppedDetails.preserveFocusHint && !!stoppedDetails.threadId) {
            threadId = stoppedDetails.threadId;
        }
        this.currentThread = typeof threadId === 'number' && this._threads.get(threadId)
            || this._threads.values().next().value;
    }

    protected async updateFrames(): Promise<void> {
        const thread = this._currentThread;
        if (!thread || thread.pendingFrameCount || thread.frameCount) {
            return;
        }
        if (this.capabilities.supportsDelayedStackTraceLoading) {
            await thread.fetchFrames(1);
            await thread.fetchFrames(19);
        } else {
            await thread.fetchFrames();
        }
    }

    protected updateCapabilities(capabilities: DebugProtocol.Capabilities): void {
        Object.assign(this._capabilities, capabilities);
    }

    protected readonly _breakpoints = new Map<string, DebugBreakpoint[]>();
    get breakpointUris(): IterableIterator<string> {
        return this._breakpoints.keys();
    }

    getSourceBreakpoints(uri?: URI): DebugSourceBreakpoint[] {
        const breakpoints = [];
        for (const breakpoint of this.getBreakpoints(uri)) {
            if (breakpoint instanceof DebugSourceBreakpoint) {
                breakpoints.push(breakpoint);
            }
        }
        return breakpoints;
    }

    getFunctionBreakpoints(): DebugFunctionBreakpoint[] {
        const breakpoints = [];
        for (const breakpoint of this.getBreakpoints(BreakpointManager.FUNCTION_URI)) {
            if (breakpoint instanceof DebugFunctionBreakpoint) {
                breakpoints.push(breakpoint);
            }
        }
        return breakpoints;
    }

    getBreakpoints(uri?: URI): DebugBreakpoint[] {
        if (uri) {
            return this._breakpoints.get(uri.toString()) || [];
        }
        const result = [];
        for (const breakpoints of this._breakpoints.values()) {
            result.push(...breakpoints);
        }
        return result;
    }

    protected clearBreakpoints(): void {
        const uris = [...this._breakpoints.keys()];
        this._breakpoints.clear();
        for (const uri of uris) {
            this.fireDidChangeBreakpoints(new URI(uri));
        }
    }

    protected updatingBreakpoints = false;

    protected updateBreakpoint(body: DebugProtocol.BreakpointEvent['body']): void {
        this.updatingBreakpoints = true;
        try {
            const raw = body.breakpoint;
            if (body.reason === 'new') {
                if (raw.source && typeof raw.line === 'number') {
                    const uri = DebugSource.toUri(raw.source);
                    const origin = SourceBreakpoint.create(uri, { line: raw.line, column: raw.column });
                    if (this.breakpoints.addBreakpoint(origin)) {
                        const breakpoints = this.getSourceBreakpoints(uri);
                        const breakpoint = new DebugSourceBreakpoint(origin, this.asDebugBreakpointOptions());
                        breakpoint.update({ raw });
                        breakpoints.push(breakpoint);
                        this.setSourceBreakpoints(uri, breakpoints);
                    }
                }
            }
            if (body.reason === 'removed' && raw.id) {
                const toRemove = this.findBreakpoint(b => b.idFromAdapter === raw.id);
                if (toRemove) {
                    toRemove.remove();
                    const breakpoints = this.getBreakpoints(toRemove.uri);
                    const index = breakpoints.indexOf(toRemove);
                    if (index !== -1) {
                        breakpoints.splice(index, 1);
                        this.setBreakpoints(toRemove.uri, breakpoints);
                    }
                }
            }
            if (body.reason === 'changed' && raw.id) {
                const toUpdate = this.findBreakpoint(b => b.idFromAdapter === raw.id);
                if (toUpdate) {
                    toUpdate.update({ raw });
                    if (toUpdate instanceof DebugSourceBreakpoint) {
                        const sourceBreakpoints = this.getSourceBreakpoints(toUpdate.uri);
                        // in order to dedup again if a debugger converted line breakpoint to inline breakpoint
                        // i.e. assigned a column to a line breakpoint
                        this.setSourceBreakpoints(toUpdate.uri, sourceBreakpoints);
                    } else {
                        this.fireDidChangeBreakpoints(toUpdate.uri);
                    }
                }
            }
        } finally {
            this.updatingBreakpoints = false;
        }
    }
    protected findBreakpoint(match: (breakpoint: DebugBreakpoint) => boolean): DebugBreakpoint | undefined {
        for (const [, breakpoints] of this._breakpoints) {
            for (const breakpoint of breakpoints) {
                if (match(breakpoint)) {
                    return breakpoint;
                }
            }
        }
        return undefined;
    }

    protected async updateBreakpoints(options: {
        uri?: URI,
        sourceModified: boolean
    }): Promise<void> {
        if (this.updatingBreakpoints) {
            return;
        }
        const { uri, sourceModified } = options;
        for (const affectedUri of this.getAffectedUris(uri)) {
            if (affectedUri.toString() === BreakpointManager.EXCEPTION_URI.toString()) {
                await this.sendExceptionBreakpoints();
            } else if (affectedUri.toString() === BreakpointManager.FUNCTION_URI.toString()) {
                await this.sendFunctionBreakpoints(affectedUri);
            } else {
                await this.sendSourceBreakpoints(affectedUri, sourceModified);
            }
        }
    }

    protected async sendExceptionBreakpoints(): Promise<void> {
        const filters = [];
        for (const breakpoint of this.breakpoints.getExceptionBreakpoints()) {
            if (breakpoint.enabled) {
                filters.push(breakpoint.raw.filter);
            }
        }
        await this.sendRequest('setExceptionBreakpoints', { filters });
    }

    protected async sendFunctionBreakpoints(affectedUri: URI): Promise<void> {
        const all = this.breakpoints.getFunctionBreakpoints().map(origin =>
            new DebugFunctionBreakpoint(origin, this.asDebugBreakpointOptions())
        );
        const enabled = all.filter(b => b.enabled);
        if (this.capabilities.supportsFunctionBreakpoints) {
            try {
                const response = await this.sendRequest('setFunctionBreakpoints', {
                    breakpoints: enabled.map(b => b.origin.raw)
                });
                response.body.breakpoints.map((raw, index) => {
                    // node debug adapter returns more breakpoints sometimes
                    if (enabled[index]) {
                        enabled[index].update({ raw });
                    }
                });
            } catch (error) {
                // could be error or promise rejection of DebugProtocol.SetFunctionBreakpoints
                if (error instanceof Error) {
                    console.error(`Error setting breakpoints: ${error.message}`);
                } else {
                    // handle adapters that send failed DebugProtocol.SetFunctionBreakpoints for invalid breakpoints
                    const genericMessage: string = 'Function breakpoint not valid for current debug session';
                    const message: string = error.message ? `${error.message}` : genericMessage;
                    console.warn(`Could not handle function breakpoints: ${message}, disabling...`);
                    enabled.forEach(b => b.update({
                        raw: {
                            verified: false,
                            message
                        }
                    }));
                }
            }
        }
        this.setBreakpoints(affectedUri, all);
    }

    protected async sendSourceBreakpoints(affectedUri: URI, sourceModified?: boolean): Promise<void> {
        const source = await this.toSource(affectedUri);
        const all = this.breakpoints.findMarkers({ uri: affectedUri }).map(({ data }) =>
            new DebugSourceBreakpoint(data, this.asDebugBreakpointOptions())
        );
        const enabled = all.filter(b => b.enabled);
        try {
            const response = await this.sendRequest('setBreakpoints', {
                source: source.raw,
                sourceModified,
                breakpoints: enabled.map(({ origin }) => origin.raw)
            });
            response.body.breakpoints.map((raw, index) => {
                // node debug adapter returns more breakpoints sometimes
                if (enabled[index]) {
                    enabled[index].update({ raw });
                }
            });
        } catch (error) {
            // could be error or promise rejection of DebugProtocol.SetBreakpointsResponse
            if (error instanceof Error) {
                console.error(`Error setting breakpoints: ${error.message}`);
            } else {
                // handle adapters that send failed DebugProtocol.SetBreakpointsResponse for invalid breakpoints
                const genericMessage: string = 'Breakpoint not valid for current debug session';
                const message: string = error.message ? `${error.message}` : genericMessage;
                console.warn(`Could not handle breakpoints for ${affectedUri}: ${message}, disabling...`);
                enabled.forEach(b => b.update({
                    raw: {
                        verified: false,
                        message
                    }
                }));
            }
        }
        this.setSourceBreakpoints(affectedUri, all);
    }

    protected setBreakpoints(uri: URI, breakpoints: DebugBreakpoint[]): void {
        this._breakpoints.set(uri.toString(), breakpoints);
        this.fireDidChangeBreakpoints(uri);
    }

    protected setSourceBreakpoints(uri: URI, breakpoints: DebugSourceBreakpoint[]): void {
        const distinct = this.dedupSourceBreakpoints(breakpoints);
        this.setBreakpoints(uri, distinct);
    }

    protected dedupSourceBreakpoints(all: DebugSourceBreakpoint[]): DebugSourceBreakpoint[] {
        const positions = new Map<string, DebugSourceBreakpoint>();
        for (const breakpoint of all) {
            let primary = positions.get(breakpoint.renderPosition()) || breakpoint;
            if (primary !== breakpoint) {
                let secondary = breakpoint;
                if (secondary.raw && secondary.raw.line === secondary.origin.raw.line && secondary.raw.column === secondary.origin.raw.column) {
                    [primary, secondary] = [breakpoint, primary];
                }
                primary.origins.push(...secondary.origins);
            }
            positions.set(primary.renderPosition(), primary);
        }
        return [...positions.values()];
    }

    protected *getAffectedUris(uri?: URI): IterableIterator<URI> {
        if (uri) {
            yield uri;
        } else {
            for (const uriString of this.breakpoints.getUris()) {
                yield new URI(uriString);
            }
            yield BreakpointManager.FUNCTION_URI;
            yield BreakpointManager.EXCEPTION_URI;
        }
    }

    protected asDebugBreakpointOptions(): DebugBreakpointOptions {
        const { labelProvider, breakpoints, editorManager } = this;
        return { labelProvider, breakpoints, editorManager, session: this };
    }

    get label(): string {
        if (InternalDebugSessionOptions.is(this.options) && this.options.id) {
            return this.configuration.name + ' (' + (this.options.id + 1) + ')';
        }
        return this.configuration.name;
    }

    get visible(): boolean {
        return this.state > DebugState.Inactive;
    }

    render(): React.ReactNode {
        let label = '';
        const child = this.getSingleChildSession();
        if (child && child.configuration.compact) {
            // Inlines the name of the child debug session
            label = `: ${child.label}`;
        }
        return <div className='theia-debug-session' title='Session'>
            <span className='label'>{this.label + label}</span>
            <span className='status'>{this.state === DebugState.Stopped ? 'Paused' : 'Running'}</span>
        </div>;
    }

    *getElements(): IterableIterator<DebugThread | DebugSession> {
        const child = this.getSingleChildSession();
        if (child && child.configuration.compact) {
            // Inlines the elements of the child debug session
            return yield* child.getElements();
        }
        yield* this.threads;
        yield* this.childSessions.values();
    }

    protected getSingleChildSession(): DebugSession | undefined {
        if (this._threads.size === 0 && this.childSessions.size === 1) {
            const child = this.childSessions.values().next().value as DebugSession;
            return child;
        }
        return undefined;
    }

    protected async handleContinued({ body: { allThreadsContinued, threadId } }: DebugProtocol.ContinuedEvent): Promise<void> {
        if (allThreadsContinued !== false) {
            this.clearThreads();
        } else {
            this.clearThread(threadId);
        }
    };

    protected async handleStopped({ body }: DebugProtocol.StoppedEvent): Promise<void> {
        // Update thread list
        await this.updateThreads(body);

        // Update current thread's frames immediately
        await this.updateFrames();
    };

    protected async handleThread({ body: { reason, threadId } }: DebugProtocol.ThreadEvent): Promise<void> {
        if (reason === 'started') {
            this.scheduleUpdateThreads();
        } else if (reason === 'exited') {
            this.clearThread(threadId);
        }
    };

    protected registerDebugContributions(configType: string, connection: DebugSessionConnection): void {
        for (const contrib of this.debugContributionProvider.getContributions()) {
            contrib.register(configType, connection);
        }
    };
}
