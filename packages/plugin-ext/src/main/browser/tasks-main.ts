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
    TasksMain,
    MAIN_RPC_CONTEXT,
    TaskExecutionDto,
    TasksExt,
    TaskDto,
    TaskDefinitionDto
} from '../../common/plugin-api-rpc';
import { RPCProtocol } from '../../common/rpc-protocol';
import { Disposable, DisposableCollection } from '@theia/core/lib/common';
import { TaskProviderRegistry, TaskResolverRegistry, TaskProvider, TaskResolver } from '@theia/task/lib/browser/task-contribution';
import { interfaces } from 'inversify';
import { TaskInfo, TaskExitedEvent, TaskConfiguration } from '@theia/task/lib/common/task-protocol';
import { TaskWatcher } from '@theia/task/lib/common/task-watcher';
import { TaskService } from '@theia/task/lib/browser/task-service';
import { TaskDefinitionRegistry, TaskIdentifierResolver } from '@theia/task/lib/browser';

export class TasksMainImpl implements TasksMain, Disposable {
    private readonly proxy: TasksExt;
    private readonly taskProviderRegistry: TaskProviderRegistry;
    private readonly taskResolverRegistry: TaskResolverRegistry;
    private readonly taskWatcher: TaskWatcher;
    private readonly taskService: TaskService;
    private readonly taskDefinitionRegistry: TaskDefinitionRegistry;
    private readonly taskIdentifierResolver: TaskIdentifierResolver;

    private readonly taskProviders = new Map<number, Disposable>();
    private readonly toDispose = new DisposableCollection();

    constructor(rpc: RPCProtocol, container: interfaces.Container) {
        this.proxy = rpc.getProxy(MAIN_RPC_CONTEXT.TASKS_EXT);
        this.taskProviderRegistry = container.get(TaskProviderRegistry);
        this.taskResolverRegistry = container.get(TaskResolverRegistry);
        this.taskWatcher = container.get(TaskWatcher);
        this.taskService = container.get(TaskService);
        this.taskDefinitionRegistry = container.get(TaskDefinitionRegistry);
        this.taskIdentifierResolver = container.get(TaskIdentifierResolver);

        this.toDispose.push(this.taskWatcher.onTaskCreated((event: TaskInfo) => {
            this.proxy.$onDidStartTask({
                id: event.taskId,
                task: this.fromTaskConfiguration(event.config)
            });
        }));

        this.toDispose.push(this.taskWatcher.onTaskExit((event: TaskExitedEvent) => {
            this.proxy.$onDidEndTask(event.taskId);
        }));

        this.toDispose.push(this.taskWatcher.onDidStartTaskProcess((event: TaskInfo) => {
            if (event.processId !== undefined) {
                this.proxy.$onDidStartTaskProcess(event.processId, {
                    id: event.taskId,
                    task: this.fromTaskConfiguration(event.config)
                });
            }
        }));

        this.toDispose.push(this.taskWatcher.onDidEndTaskProcess((event: TaskExitedEvent) => {
            if (event.code !== undefined) {
                this.proxy.$onDidEndTaskProcess(event.code, event.taskId);
            }
        }));
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    $registerTaskProvider(handle: number, type: string): void {
        const taskProvider = this.createTaskProvider(handle);
        const taskResolver = this.createTaskResolver(handle);

        const toDispose = new DisposableCollection(
            this.taskProviderRegistry.register(type, taskProvider, handle),
            this.taskResolverRegistry.register(type, taskResolver),
            Disposable.create(() => this.taskProviders.delete(handle))
        );
        this.taskProviders.set(handle, toDispose);
        this.toDispose.push(toDispose);
    }

    $unregister(handle: number): void {
        const disposable = this.taskProviders.get(handle);
        if (disposable) {
            disposable.dispose();
        }
    }

    async $fetchTasks(taskVersion: string | undefined, taskType: string | undefined): Promise<TaskDto[]> {
        if (taskVersion && !taskVersion.startsWith('2.')) { // Theia does not support 1.x or earlier task versions
            return [];
        }

        const [configured, provided] = await Promise.all([
            this.taskService.getConfiguredTasks(),
            this.taskService.getProvidedTasks()
        ]);
        const result: TaskDto[] = [];
        const addTaskDto = (taskConfig: TaskConfiguration, isContributedTask: boolean) => {
            if (!taskType || (isContributedTask ? taskConfig._source === taskType : taskConfig.type === taskType)) {
                const { type, label, _scope, _source, ...properties } = taskConfig;
                const definitionDto: TaskDefinitionDto = taskConfig.id;
                if (isContributedTask) {
                    const definition = this.taskDefinitionRegistry.getDefinition(taskConfig);
                    if (definition) {
                        definition.properties.all.forEach((p: string) => {
                            definitionDto[p] = taskConfig[p];
                        });
                    }
                }
                const dto: TaskDto = {
                    id: taskConfig.id._key,
                    type,
                    label,
                    scope: _scope,
                    source: _source,
                    definition: definitionDto
                };
                for (const key in properties) {
                    if (properties.hasOwnProperty(key)) {
                        dto[key] = properties[key];
                    }
                }
                result.push(dto);
            }
        };
        for (const configuredTask of configured) {
            const index = provided.findIndex(p => p.id._key === configuredTask.id._key);
            if (index >= 0) {
                addTaskDto({
                    ...provided[index], ...configuredTask
                }, true);
                provided.slice(index, 1);
            } else {
                addTaskDto(configuredTask, false);
            }
        }
        for (const providedTask of provided) {
            addTaskDto(providedTask, true);
        }
        return result;
    }

    async $executeTask(taskDto: TaskDto): Promise<TaskExecutionDto | undefined> {
        const taskConfig = this.toTaskConfiguration(taskDto);
        if (taskConfig) {
            const taskInfo = await this.taskService.runTask(taskConfig);
            if (taskInfo) {
                return {
                    id: taskInfo.taskId,
                    task: this.fromTaskConfiguration(taskInfo.config)
                };
            }
        }
    }

    async $taskExecutions(): Promise<{
        id: number;
        task: TaskDto;
    }[]> {
        const runningTasks = await this.taskService.getRunningTasks();
        return runningTasks.map(taskInfo => ({
            id: taskInfo.taskId,
            task: this.fromTaskConfiguration(taskInfo.config)
        }));
    }

    $terminateTask(id: number): void {
        this.taskService.kill(id);
    }

    protected createTaskProvider(handle: number): TaskProvider {
        return {
            provideTasks: () =>
                this.proxy.$provideTasks(handle).then(v => {
                    const taskConfigs = v!.map(taskDto => this.toTaskConfiguration(taskDto));
                    const tasks: TaskConfiguration[] = [];
                    for (const t of taskConfigs) {
                        if (t) {
                            tasks.push(t);
                        }
                    }
                    return tasks;
                })
        };
    }

    protected createTaskResolver(handle: number): TaskResolver {
        return {
            resolveTask: taskConfig =>
                this.proxy.$resolveTask(handle, this.fromTaskConfiguration(taskConfig)).then(v =>
                    this.toTaskConfiguration(v!)!
                )
        };
    }

    protected toTaskConfiguration(taskDto: TaskDto): TaskConfiguration | undefined {
        const keyedIdentifier = this.taskIdentifierResolver.createKeyedIdentifier({
            ...taskDto.definition, type: taskDto.taskType
        });
        if (keyedIdentifier) {
            return {
                ...taskDto,
                id: keyedIdentifier,
                _source: taskDto.source,
                _scope: taskDto.scope
            };
        }
    }

    protected fromTaskConfiguration(task: TaskConfiguration): TaskDto {
        const definitionDto: TaskDefinitionDto = task.id;
        const definition = this.taskDefinitionRegistry.getDefinition(task);
        if (definition) {
            definition.properties.all.forEach((p: string) => {
                definitionDto[p] = task[p];
            });
        }
        return {
            ...task,
            id: task.id._key,
            source: task._source,
            scope: task._scope,
            definition: definitionDto
        };
    }

}
