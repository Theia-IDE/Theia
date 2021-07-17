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

import {
    PLUGIN_RPC_CONTEXT,
    TasksExt,
    TasksMain,
    TaskDto,
    TaskExecutionDto
} from '../../common/plugin-api-rpc';
import * as theia from '@theia/plugin';
import * as converter from '../type-converters';
import { CustomExecution, Disposable } from '../types-impl';
import { RPCProtocol, ConnectionClosedError } from '../../common/rpc-protocol';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { TerminalServiceExtImpl } from '../terminal-ext';
import { UUID } from '@theia/core/shared/@phosphor/coreutils';
export class TasksExtImpl implements TasksExt {
    private proxy: TasksMain;

    private callId = 0;
    private providersByHandle = new Map<number, theia.TaskProvider>();
    private executions = new Map<number, theia.TaskExecution>();
    protected callbackIdBase: string = UUID.uuid4();
    protected callbackId: number = 0;
    protected providedCustomExecutions: Map<string, theia.CustomExecution> = new Map();
    protected oneOffCustomExecutions: Map<string, theia.CustomExecution> = new Map();
    protected lastStartedTask: number | undefined;

    private readonly onDidExecuteTask: Emitter<theia.TaskStartEvent> = new Emitter<theia.TaskStartEvent>();
    private readonly onDidTerminateTask: Emitter<theia.TaskEndEvent> = new Emitter<theia.TaskEndEvent>();
    private readonly onDidExecuteTaskProcess: Emitter<theia.TaskProcessStartEvent> = new Emitter<theia.TaskProcessStartEvent>();
    private readonly onDidTerminateTaskProcess: Emitter<theia.TaskProcessEndEvent> = new Emitter<theia.TaskProcessEndEvent>();

    private disposed = false;

    constructor(rpc: RPCProtocol, readonly terminalExt: TerminalServiceExtImpl) {
        this.proxy = rpc.getProxy(PLUGIN_RPC_CONTEXT.TASKS_MAIN);
        this.fetchTaskExecutions();
    }

    dispose(): void {
        this.disposed = true;
    }

    get taskExecutions(): ReadonlyArray<theia.TaskExecution> {
        return [...this.executions.values()];
    }

    get onDidStartTask(): Event<theia.TaskStartEvent> {
        return this.onDidExecuteTask.event;
    }

    async $onDidStartUserInteraction(): Promise<void> {
        console.info(`$onDidStartUserInteraction: clearing ${this.providedCustomExecutions.size} custom executions`);
        this.providedCustomExecutions.clear();
        return Promise.resolve();
    }

    private getCustomExecution(id: string | undefined): theia.CustomExecution | undefined {
        if (!id) {
            return undefined;
        }
        return this.providedCustomExecutions.get(id) ?? this.oneOffCustomExecutions.get(id);
    }

    private addProvidedCustomExecution(execution: theia.CustomExecution): string {
        const id = this.nextCallbackId();
        this.providedCustomExecutions.set(id, execution);
        return id;
    }

    private addOneOffCustomExecution(execution: theia.CustomExecution): string {
        const id = this.nextCallbackId();
        this.oneOffCustomExecutions.set(id, execution);
        return id;
    }

    async $onDidStartTask(execution: TaskExecutionDto, terminalId: number): Promise<void> {
        const customExecution = this.getCustomExecution(execution.task.executionId);
        if (customExecution) {
            console.info(`running custom execution with id ${execution.task.executionId}`);
            const taskDefinition = converter.toTask(execution.task).definition;
            const pty = await customExecution.callback(taskDefinition);
            this.terminalExt.attachPtyToTerminal(terminalId, pty);
            if (pty.onDidClose) {
                const disposable = pty.onDidClose((e: number | void = undefined) => {
                    disposable.dispose();
                    // eslint-disable-next-line no-void
                    this.proxy.$customExecutionComplete(execution.id, e === void 0 ? undefined : e);
                });
            }
        }
        this.lastStartedTask = execution.id;

        this.onDidExecuteTask.fire({
            execution: this.getTaskExecution(execution)
        });
    }

    get onDidEndTask(): Event<theia.TaskEndEvent> {
        return this.onDidTerminateTask.event;
    }

    $onDidEndTask(executionDto: TaskExecutionDto): void {
        const taskExecution = this.executions.get(executionDto.id);
        if (!taskExecution) {
            throw new Error(`Task execution with id ${executionDto.id} is not found`);
        }

        if (executionDto.task.executionId) {
            if (this.oneOffCustomExecutions.delete(executionDto.task.executionId)) {
                console.info(`removed one-off custom execution with id ${executionDto.task.executionId}`);
            }
        }

        this.executions.delete(executionDto.id);

        this.onDidTerminateTask.fire({
            execution: taskExecution
        });
    }

    get onDidStartTaskProcess(): Event<theia.TaskProcessStartEvent> {
        return this.onDidExecuteTaskProcess.event;
    }

    $onDidStartTaskProcess(processId: number, executionDto: TaskExecutionDto): void {
        this.onDidExecuteTaskProcess.fire({
            processId,
            execution: this.getTaskExecution(executionDto)
        });
    }

    get onDidEndTaskProcess(): Event<theia.TaskProcessEndEvent> {
        return this.onDidTerminateTaskProcess.event;
    }

    $onDidEndTaskProcess(exitCode: number, taskId: number): void {
        const taskExecution = this.executions.get(taskId);
        if (!taskExecution) {
            throw new Error(`Task execution with id ${taskId} is not found`);
        }

        this.onDidTerminateTaskProcess.fire({
            execution: taskExecution,
            exitCode
        });
    }

    registerTaskProvider(type: string, provider: theia.TaskProvider): theia.Disposable {
        const callId = this.addProvider(provider);
        this.proxy.$registerTaskProvider(callId, type);
        return this.createDisposable(callId);
    }

    async fetchTasks(filter?: theia.TaskFilter): Promise<theia.Task[]> {
        const taskVersion = filter ? filter.version : undefined;
        const taskType = filter ? filter.type : undefined;
        const taskDtos = await this.proxy.$fetchTasks(taskVersion, taskType);
        return taskDtos.map(dto => converter.toTask(dto));
    }

    async executeTask(task: theia.Task): Promise<theia.TaskExecution> {
        const taskDto = converter.fromTask(task);
        if (taskDto) {
            // If this task is a custom execution, then we need to save it away
            // in the provided custom execution map that is cleaned up after the
            // task is executed.
            if (CustomExecution.is(task.execution!)) {
                taskDto.executionId = this.addOneOffCustomExecution(task.execution);
            }
            const executionDto = await this.proxy.$executeTask(taskDto);
            if (executionDto) {
                const taskExecution = this.getTaskExecution(executionDto);
                return taskExecution;
            }
            throw new Error('Run task config does not return after being started');
        }
        throw new Error('Task was not successfully transformed into a task config');
    }

    $provideTasks(handle: number, token: theia.CancellationToken): Promise<TaskDto[] | undefined> {
        const provider = this.providersByHandle.get(handle);
        let addedExecutions = 0;
        if (provider) {
            return Promise.resolve(provider.provideTasks(token)).then(tasks => {
                if (tasks) {
                    return tasks.map(task => {
                        const dto = converter.fromTask(task);
                        if (dto && CustomExecution.is(task.execution!)) {
                            dto.executionId = this.addProvidedCustomExecution(task.execution);
                            addedExecutions++;
                        }
                        return dto;
                    }).filter((task): task is TaskDto => !!task);
                } else {
                    return undefined;
                }
            }).then(tasks => {
                console.info(`provideTasks: added ${addedExecutions} executions for provider ${handle}`);
                return tasks;
            });
        } else {
            return Promise.reject(new Error(`No task provider found for handle ${handle} `));
        }
    }

    $resolveTask(handle: number, dto: TaskDto, token: theia.CancellationToken): Promise<TaskDto | undefined> {
        const provider = this.providersByHandle.get(handle);
        if (provider) {
            const task = converter.toTask(dto);
            if (task) {
                const resolvedTask = provider.resolveTask(task, token);
                if (resolvedTask) {
                    return Promise.resolve(resolvedTask).then(maybeResolvedTask => {
                        if (maybeResolvedTask) {
                            const resolvedDto = converter.fromTask(maybeResolvedTask);
                            if (resolvedDto && CustomExecution.is(maybeResolvedTask.execution)) {
                                resolvedDto.executionId = this.addProvidedCustomExecution(maybeResolvedTask.execution);
                                console.info('resolveTask: added custom execution');
                            }
                            return resolvedDto;
                        }
                        return undefined;
                    });
                }
            }
            return Promise.resolve(undefined);

        } else {
            return Promise.reject(new Error('No provider found to resolve task'));
        }
    }

    private addProvider(provider: theia.TaskProvider): number {
        const callId = this.callId++;
        this.providersByHandle.set(callId, provider);
        return callId;
    }

    private createDisposable(callId: number): theia.Disposable {
        return new Disposable(() => {
            this.providersByHandle.delete(callId);
            this.proxy.$unregister(callId);
        });
    }

    private async fetchTaskExecutions(): Promise<void> {
        try {
            const taskExecutions = await this.proxy.$taskExecutions();
            taskExecutions.forEach(execution => this.getTaskExecution(execution));
        } catch (error) {
            if (this.disposed && ConnectionClosedError.is(error)) {
                return;
            }
            console.error(`Can not fetch running tasks: ${error}`);
        }
    }

    private toTaskExecution(execution: TaskExecutionDto): theia.TaskExecution {
        const result = {
            task: converter.toTask(execution.task),
            terminate: () => {
                this.proxy.$terminateTask(execution.id);
            }
        };
        if (execution.task.executionId) {
            result.task.execution = this.getCustomExecution(execution.task.executionId);
        }
        return result;
    }

    private getTaskExecution(execution: TaskExecutionDto): theia.TaskExecution {
        const executionId = execution.id;
        let result: theia.TaskExecution | undefined = this.executions.get(executionId);
        if (result) {
            return result;
        }

        result = this.toTaskExecution(execution);
        this.executions.set(executionId, result);
        return result;
    }

    private nextCallbackId(): string {
        return this.callbackIdBase + this.callbackId++;
    }
}
