/********************************************************************************
 * Copyright (C) 2017 Ericsson and others.
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

import { injectable } from 'inversify';
import { ILogger, Disposable, DisposableCollection, Emitter, Event, MaybePromise } from '@theia/core/lib/common/';
import { TaskManager } from './task-manager';
import { TaskInfo, TaskExitedEvent, TaskConfiguration, TaskOutputEvent } from '../common/task-protocol';
import { MessageConnection } from 'vscode-jsonrpc';

export interface TaskOptions {
    label: string;
    config: TaskConfiguration;
    context?: string;
}

@injectable()
export abstract class Task implements Disposable {

    protected taskId: number;
    protected readonly toDispose: DisposableCollection = new DisposableCollection();
    readonly exitEmitter: Emitter<TaskExitedEvent>;
    readonly outputEmitter: Emitter<TaskOutputEvent>;

    constructor(
        protected readonly taskManager: TaskManager,
        protected readonly logger: ILogger,
        protected readonly options: TaskOptions
    ) {
        this.taskId = this.taskManager.register(this, this.options.context);
        this.exitEmitter = new Emitter<TaskExitedEvent>();
        this.outputEmitter = new Emitter<TaskOutputEvent>();
        this.toDispose.push(this.exitEmitter);
        this.toDispose.push(this.outputEmitter);
    }

    /** Terminates the task. */
    abstract kill(): Promise<void>;

    /**
     * Initializes a connection between this task and the client.
     *
     * The connection may be used to provide feedback and progress monitoring
     * to the client.  It can also be used to send  data from the client to the executing
     * task.  Tasks do not need to create a connection with the client.
     */
    initClientConnection(connection: MessageConnection): void {
        // By default, no feedback through a client connection is provided.
        // For an example implementation of this function, see ProcessTask which
        // connects a task based on a Process to the client.
    }

    get onExit(): Event<TaskExitedEvent> {
        return this.exitEmitter.event;
    }

    get onOutput(): Event<TaskOutputEvent> {
        return this.outputEmitter.event;
    }

    /** Has to be called when a task has concluded its execution. */
    protected fireTaskExited(event: TaskExitedEvent): void {
        this.exitEmitter.fire(event);
    }

    protected fireOutputLine(event: TaskOutputEvent): void {
        this.outputEmitter.fire(event);
    }

    /** Returns runtime information about task. */
    abstract getRuntimeInfo(): MaybePromise<TaskInfo>;

    get id() {
        return this.taskId;
    }

    get context() {
        return this.options.context;
    }

    get label() {
        return this.options.label;
    }

    dispose() {
        this.toDispose.dispose();
    }
}
