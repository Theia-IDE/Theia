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

import { inject, injectable } from 'inversify';
import { TaskService } from './task-service';
import { TaskInfo, TaskConfiguration, TaskCustomization, TaskScope, TaskConfigurationScope } from '../common/task-protocol';
import { TaskDefinitionRegistry } from './task-definition-registry';
import URI from '@theia/core/lib/common/uri';
import { QuickOpenHandler, QuickOpenService, QuickOpenOptions, QuickOpenBaseAction, LabelProvider } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { FileSystem } from '@theia/filesystem/lib/common';
import {
    QuickOpenModel, QuickOpenItem, QuickOpenActionProvider, QuickOpenMode, QuickOpenGroupItem, QuickOpenGroupItemOptions, QuickOpenAction
} from '@theia/core/lib/common/quick-open-model';
import { PreferenceService } from '@theia/core/lib/browser';
import { TaskNameResolver } from './task-name-resolver';
import { TaskSourceResolver } from './task-source-resolver';
import { TaskConfigurationManager } from './task-configuration-manager';

@injectable()
export class ConfigureTaskAction extends QuickOpenBaseAction {

    @inject(TaskService)
    protected readonly taskService: TaskService;

    constructor() {
        super({ id: 'configure:task', label: 'Configure Task' });
        this.updateClass();
    }

    async run(item?: QuickOpenItem): Promise<void> {
        if (item instanceof TaskRunQuickOpenItem) {
            this.taskService.configure(item.getTask());
        }
    }

    protected updateClass(): void {
        this.class = 'codicon-gear quick-open-task-configure';
    }
}

@injectable()
export class TaskActionProvider implements QuickOpenActionProvider {

    @inject(ConfigureTaskAction)
    protected configureTaskAction: ConfigureTaskAction;

    hasActions(): boolean {
        return true;
    }

    getActions(): ReadonlyArray<QuickOpenAction> {
        return [this.configureTaskAction];
    }
}

@injectable()
export class QuickOpenTask implements QuickOpenModel, QuickOpenHandler {

    protected items: QuickOpenItem[];
    protected actionProvider: QuickOpenActionProvider | undefined;

    readonly prefix: string = 'task ';

    readonly description: string = 'Run Task';

    @inject(TaskService)
    protected readonly taskService: TaskService;

    @inject(QuickOpenService)
    protected readonly quickOpenService: QuickOpenService;

    @inject(TaskActionProvider)
    protected readonly taskActionProvider: TaskActionProvider;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(TaskDefinitionRegistry)
    protected readonly taskDefinitionRegistry: TaskDefinitionRegistry;

    @inject(TaskNameResolver)
    protected readonly taskNameResolver: TaskNameResolver;

    @inject(TaskSourceResolver)
    protected readonly taskSourceResolver: TaskSourceResolver;

    @inject(FileSystem)
    protected readonly fileSystem: FileSystem;

    @inject(TaskConfigurationManager)
    protected readonly taskConfigurationManager: TaskConfigurationManager;

    @inject(PreferenceService)
    protected readonly preferences: PreferenceService;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    /** Initialize this quick open model with the tasks. */
    async init(): Promise<void> {
        const recentTasks = this.taskService.recentTasks;
        const configuredTasks = await this.taskService.getConfiguredTasks();
        const providedTasks = await this.taskService.getProvidedTasks();

        const { filteredRecentTasks, filteredConfiguredTasks, filteredProvidedTasks } = this.getFilteredTasks(recentTasks, configuredTasks, providedTasks);
        const isMulti: boolean = this.workspaceService.isMultiRootWorkspaceOpened;
        this.items = [];
        this.items.push(
            ...filteredRecentTasks.map((task, index) => {
                const item = new TaskRunQuickOpenItem(task, this.taskService, isMulti, {
                    groupLabel: index === 0 ? 'recently used tasks' : undefined,
                    showBorder: false
                }, this.taskDefinitionRegistry, this.taskNameResolver, this.taskSourceResolver);
                return item;
            }),
            ...filteredConfiguredTasks.map((task, index) => {
                const item = new TaskRunQuickOpenItem(task, this.taskService, isMulti, {
                    groupLabel: index === 0 ? 'configured tasks' : undefined,
                    showBorder: (
                        filteredRecentTasks.length <= 0
                            ? false
                            : index === 0 ? true : false
                    )
                }, this.taskDefinitionRegistry, this.taskNameResolver, this.taskSourceResolver);
                return item;
            }),
            ...filteredProvidedTasks.map((task, index) => {
                const item = new TaskRunQuickOpenItem(task, this.taskService, isMulti, {
                    groupLabel: index === 0 ? 'detected tasks' : undefined,
                    showBorder: (
                        filteredRecentTasks.length <= 0 && filteredConfiguredTasks.length <= 0
                            ? false
                            : index === 0 ? true : false
                    )
                }, this.taskDefinitionRegistry, this.taskNameResolver, this.taskSourceResolver);
                return item;
            })
        );

        this.actionProvider = this.items.length ? this.taskActionProvider : undefined;
    }

    async open(): Promise<void> {
        await this.init();
        if (!this.items.length) {
            this.items.push(new QuickOpenItem({
                label: 'No task to run found. Configure Tasks...',
                run: (mode: QuickOpenMode): boolean => {
                    if (mode !== QuickOpenMode.OPEN) {
                        return false;
                    }
                    this.configure();
                    return true;
                }
            }));
        }
        this.quickOpenService.open(this, {
            placeholder: 'Select the task to run',
            fuzzyMatchLabel: true,
            fuzzySort: false
        });
    }

    getModel(): QuickOpenModel {
        return this;
    }

    getOptions(): QuickOpenOptions {
        return {
            fuzzyMatchLabel: true,
            fuzzySort: false
        };
    }

    attach(): void {
        this.items = [];
        this.actionProvider = undefined;
        const isMulti: boolean = this.workspaceService.isMultiRootWorkspaceOpened;
        this.taskService.getRunningTasks().then(tasks => {
            if (!tasks.length) {
                this.items.push(new QuickOpenItem({
                    label: 'No tasks found',
                    run: (_mode: QuickOpenMode): boolean => false
                }));
            } else {
                tasks.forEach((task: TaskInfo) => {
                    // can only attach to terminal processes, so only list those
                    if (task.terminalId) {
                        this.items.push(new RunningTaskQuickOpenItem(
                            task,
                            this.taskService,
                            this.taskNameResolver,
                            this.taskSourceResolver,
                            this.taskDefinitionRegistry,
                            this.labelProvider,
                            isMulti,
                            {
                                run: (mode: QuickOpenMode): boolean => {
                                    if (mode !== QuickOpenMode.OPEN) {
                                        return false;
                                    }
                                    this.taskService.attach(task.terminalId!, task.taskId);
                                    return true;
                                }
                            },
                        ));
                    }
                });
            }
            this.quickOpenService.open(this, {
                placeholder: 'Choose task to open',
                fuzzyMatchLabel: true,
                fuzzySort: true
            });
        });
    }

    async configure(): Promise<void> {
        this.items = [];
        this.actionProvider = undefined;
        const isMulti: boolean = this.workspaceService.isMultiRootWorkspaceOpened;

        const configuredTasks = await this.taskService.getConfiguredTasks();
        const providedTasks = await this.taskService.getProvidedTasks();

        // check if tasks.json exists. If not, display "Create tasks.json file from template"
        // If tasks.json exists and empty, display 'Open tasks.json file'
        let isFirstGroup = true;
        const { filteredConfiguredTasks, filteredProvidedTasks } = this.getFilteredTasks([], configuredTasks, providedTasks);
        const groupedTasks = this.getGroupedTasksByWorkspaceFolder([...filteredConfiguredTasks, ...filteredProvidedTasks]);
        if (groupedTasks.has(TaskScope.Global.toString())) {
            const configs = groupedTasks.get(TaskScope.Global.toString())!;
            this.items.push(
                ...configs.map(taskConfig => {
                    const item = new TaskConfigureQuickOpenItem(
                        taskConfig,
                        this.taskService,
                        this.taskNameResolver,
                        this.workspaceService,
                        isMulti,
                        { showBorder: false }
                    );
                    item['taskDefinitionRegistry'] = this.taskDefinitionRegistry;
                    return item;
                })
            );
            isFirstGroup = false;
        }

        const rootUris = (await this.workspaceService.roots).map(rootStat => rootStat.uri);
        for (const rootFolder of rootUris) {
            const folderName = new URI(rootFolder).displayName;
            if (groupedTasks.has(rootFolder)) {
                const configs = groupedTasks.get(rootFolder.toString())!;
                this.items.push(
                    ...configs.map((taskConfig, index) => {
                        const item = new TaskConfigureQuickOpenItem(
                            taskConfig,
                            this.taskService,
                            this.taskNameResolver,
                            this.workspaceService,
                            isMulti,
                            {
                                groupLabel: index === 0 && isMulti ? folderName : '',
                                showBorder: !isFirstGroup && index === 0
                            }
                        );
                        item['taskDefinitionRegistry'] = this.taskDefinitionRegistry;
                        return item;
                    })
                );
            } else {
                const { configUri } = this.preferences.resolve('tasks', [], rootFolder);
                const existTaskConfigFile = !!configUri;
                this.items.push(new QuickOpenGroupItem({
                    label: existTaskConfigFile ? 'Open tasks.json file' : 'Create tasks.json file from template',
                    run: (mode: QuickOpenMode): boolean => {
                        if (mode !== QuickOpenMode.OPEN) {
                            return false;
                        }
                        setTimeout(() => this.taskConfigurationManager.openConfiguration(rootFolder));
                        return true;
                    },
                    showBorder: !isFirstGroup,
                    groupLabel: isMulti ? folderName : ''
                }));
            }
            isFirstGroup = false;
        }

        if (this.items.length === 0) {
            this.items.push(new QuickOpenItem({
                label: 'No tasks found',
                run: (_mode: QuickOpenMode): boolean => false
            }));
        }

        this.quickOpenService.open(this, {
            placeholder: 'Select a task to configure',
            fuzzyMatchLabel: true,
            fuzzySort: false
        });
    }

    async runBuildOrTestTask(buildOrTestType: 'build' | 'test'): Promise<void> {
        const shouldRunBuildTask = buildOrTestType === 'build';
        await this.init();
        if (this.items.length > 1 ||
            this.items.length === 1 && (this.items[0] as TaskRunQuickOpenItem).getTask !== undefined) { // the item in `this.items` is not 'No tasks found'

            const buildOrTestTasks = this.items.filter((t: TaskRunQuickOpenItem) =>
                shouldRunBuildTask ? TaskCustomization.isBuildTask(t.getTask()) : TaskCustomization.isTestTask(t.getTask())
            );
            this.actionProvider = undefined;
            if (buildOrTestTasks.length > 0) { // build / test tasks are defined in the workspace
                const defaultBuildOrTestTasks = buildOrTestTasks.filter((t: TaskRunQuickOpenItem) =>
                    shouldRunBuildTask ? TaskCustomization.isDefaultBuildTask(t.getTask()) : TaskCustomization.isDefaultTestTask(t.getTask())
                );
                if (defaultBuildOrTestTasks.length === 1) { // run the default build / test task
                    const defaultBuildOrTestTask = defaultBuildOrTestTasks[0];
                    const taskToRun = (defaultBuildOrTestTask as TaskRunQuickOpenItem).getTask();
                    this.taskService.run(taskToRun.id);
                    return;
                }

                // if default build / test task is not found, or there are more than one default,
                // display the list of build /test tasks to let the user decide which to run
                this.items = buildOrTestTasks;

            } else { // no build / test tasks, display an action item to configure the build / test task
                this.items = [new QuickOpenItem({
                    label: `No ${buildOrTestType} task to run found. Configure ${buildOrTestType.charAt(0).toUpperCase() + buildOrTestType.slice(1)} Task...`,
                    run: (mode: QuickOpenMode): boolean => {
                        if (mode !== QuickOpenMode.OPEN) {
                            return false;
                        }

                        this.init().then(() => {
                            // update the `tasks.json` file, instead of running the task itself
                            this.items = this.items.map((item: TaskRunQuickOpenItem) => {
                                const newItem = new ConfigureBuildOrTestTaskQuickOpenItem(
                                    item.getTask(),
                                    this.taskService,
                                    this.workspaceService.isMultiRootWorkspaceOpened,
                                    item.options,
                                    this.taskNameResolver,
                                    shouldRunBuildTask,
                                    this.taskConfigurationManager,
                                    this.taskDefinitionRegistry,
                                    this.taskSourceResolver
                                );
                                return newItem;
                            });
                            this.quickOpenService.open(this, {
                                placeholder: `Select the task to be used as the default ${buildOrTestType} task`,
                                fuzzyMatchLabel: true,
                                fuzzySort: false
                            });
                        });

                        return true;
                    }
                })];
            }
        } else { // no tasks are currently present, prompt users if they'd like to configure a task.
            this.items = [
                new QuickOpenItem({
                    label: `No ${buildOrTestType} task to run found. Configure ${buildOrTestType.charAt(0).toUpperCase() + buildOrTestType.slice(1)} Task...`,
                    run: (mode: QuickOpenMode): boolean => {
                        if (mode !== QuickOpenMode.OPEN) {
                            return false;
                        }
                        this.configure();
                        return true;
                    }
                })
            ];
        }

        this.quickOpenService.open(this, {
            placeholder: `Select the ${buildOrTestType} task to run`,
            fuzzyMatchLabel: true,
            fuzzySort: false
        });
    }

    onType(lookFor: string, acceptor: (items: QuickOpenItem[], actionProvider?: QuickOpenActionProvider) => void): void {
        acceptor(this.items, this.actionProvider);
    }

    protected getRunningTaskLabel(task: TaskInfo): string {
        return `Task id: ${task.taskId}, label: ${task.config.label}`;
    }

    private getFilteredTasks(recentTasks: TaskConfiguration[], configuredTasks: TaskConfiguration[], providedTasks: TaskConfiguration[]): {
        filteredRecentTasks: TaskConfiguration[], filteredConfiguredTasks: TaskConfiguration[], filteredProvidedTasks: TaskConfiguration[]
    } {

        const filteredRecentTasks: TaskConfiguration[] = [];
        recentTasks.forEach(recent => {
            let originalTaskConfig = [...configuredTasks, ...providedTasks].find(t => t.id._key === recent.id._key);
            if (!originalTaskConfig) {
                originalTaskConfig = [...configuredTasks, ...providedTasks].find(t => this.taskDefinitionRegistry.compareTasks(recent, t));
            }
            if (originalTaskConfig) {
                filteredRecentTasks.push(originalTaskConfig);
            }
        });

        const filteredProvidedTasks: TaskConfiguration[] = [];
        providedTasks.forEach(provided => {
            const exist = [...filteredRecentTasks, ...configuredTasks].some(t => t.id._key === provided.id._key);
            if (!exist) {
                filteredProvidedTasks.push(provided);
            }
        });

        const filteredConfiguredTasks: TaskConfiguration[] = [];
        configuredTasks.forEach(configured => {
            const exist = filteredRecentTasks.some(t => t.id._key === configured.id._key);
            if (!exist) {
                filteredConfiguredTasks.push(configured);
            }
        });

        return {
            filteredRecentTasks, filteredConfiguredTasks, filteredProvidedTasks
        };
    }

    private getGroupedTasksByWorkspaceFolder(tasks: TaskConfiguration[]): Map<string, TaskConfiguration[]> {
        const grouped = new Map<string, TaskConfiguration[]>();
        for (const task of tasks) {
            const scope = task._scope;
            if (grouped.has(scope.toString())) {
                grouped.get(scope.toString())!.push(task);
            } else {
                grouped.set(scope.toString(), [task]);
            }
        }
        for (const taskConfigs of grouped.values()) {
            taskConfigs.sort((t1, t2) => t1.label.localeCompare(t2.label));
        }
        return grouped;
    }
}

export class TaskRunQuickOpenItem extends QuickOpenGroupItem {

    constructor(
        protected readonly task: TaskConfiguration,
        protected taskService: TaskService,
        protected isMulti: boolean,
        public readonly options: QuickOpenGroupItemOptions,
        protected readonly taskDefinitionRegistry: TaskDefinitionRegistry,
        protected readonly taskNameResolver: TaskNameResolver,
        protected readonly taskSourceResolver: TaskSourceResolver
    ) {
        super(options);
    }

    getTask(): TaskConfiguration {
        return this.task;
    }

    getLabel(): string {
        return this.taskNameResolver.resolve(this.task);
    }

    getGroupLabel(): string {
        return this.options.groupLabel || '';
    }

    getDescription(): string {
        return renderScope(this.task._scope, this.isMulti);
    }

    run(mode: QuickOpenMode): boolean {
        if (mode !== QuickOpenMode.OPEN) {
            return false;
        }
        this.taskService.run(this.task.id);
        return true;
    }
}

export class ConfigureBuildOrTestTaskQuickOpenItem extends TaskRunQuickOpenItem {
    constructor(
        protected readonly task: TaskConfiguration,
        protected taskService: TaskService,
        protected isMulti: boolean,
        public readonly options: QuickOpenGroupItemOptions,
        protected readonly taskNameResolver: TaskNameResolver,
        protected readonly isBuildTask: boolean,
        protected taskConfigurationManager: TaskConfigurationManager,
        protected readonly taskDefinitionRegistry: TaskDefinitionRegistry,
        protected readonly taskSourceResolver: TaskSourceResolver
    ) {
        super(task, taskService, isMulti, options, taskDefinitionRegistry, taskNameResolver, taskSourceResolver);
    }

    run(mode: QuickOpenMode): boolean {
        if (mode !== QuickOpenMode.OPEN) {
            return false;
        }
        this.taskService.updateTaskConfiguration(this.task, { group: { kind: this.isBuildTask ? 'build' : 'test', isDefault: true } })
            .then(() => {
                if (this.task._scope) {
                    this.taskConfigurationManager.openConfiguration(this.task._scope);
                }
            });
        return true;
    }
}

function renderScope(scope: TaskConfigurationScope, isMulti: boolean): string {
    if (typeof scope === 'string') {
        if (isMulti) {
            return new URI(scope).displayName;
        } else {
            return '';
        }
    } else {
        return TaskScope[scope];
    }

}

export class TaskConfigureQuickOpenItem extends QuickOpenGroupItem {

    protected taskDefinitionRegistry: TaskDefinitionRegistry;

    constructor(
        protected readonly task: TaskConfiguration,
        protected readonly taskService: TaskService,
        protected readonly taskNameResolver: TaskNameResolver,
        protected readonly workspaceService: WorkspaceService,
        protected readonly isMulti: boolean,
        protected readonly options: QuickOpenGroupItemOptions
    ) {
        super(options);
        const stat = this.workspaceService.workspace;
        this.isMulti = stat ? !stat.isDirectory : false;
    }

    getLabel(): string {
        return this.taskNameResolver.resolve(this.task);
    }

    getGroupLabel(): string {
        return this.options.groupLabel || '';
    }

    getDescription(): string {
        return renderScope(this.task._scope, this.isMulti);
    }

    run(mode: QuickOpenMode): boolean {
        if (mode !== QuickOpenMode.OPEN) {
            return false;
        }
        this.taskService.configure(this.task);

        return true;
    }
}

@injectable()
export class TaskTerminateQuickOpen implements QuickOpenModel {

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(QuickOpenService)
    protected readonly quickOpenService: QuickOpenService;

    @inject(TaskDefinitionRegistry)
    protected readonly taskDefinitionRegistry: TaskDefinitionRegistry;

    @inject(TaskNameResolver)
    protected readonly taskNameResolver: TaskNameResolver;

    @inject(TaskSourceResolver)
    protected readonly taskSourceResolver: TaskSourceResolver;

    @inject(TaskService)
    protected readonly taskService: TaskService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    async onType(_lookFor: string, acceptor: (items: QuickOpenItem[]) => void): Promise<void> {
        const items: QuickOpenItem[] = [];
        const runningTasks: TaskInfo[] = await this.taskService.getRunningTasks();
        const isMulti: boolean = this.workspaceService.isMultiRootWorkspaceOpened;
        if (runningTasks.length <= 0) {
            items.push(new QuickOpenItem({
                label: 'No task is currently running',
                run: (): boolean => false,
            }));
        } else {
            runningTasks.forEach((task: TaskInfo) => {
                items.push(new RunningTaskQuickOpenItem(
                    task,
                    this.taskService,
                    this.taskNameResolver,
                    this.taskSourceResolver,
                    this.taskDefinitionRegistry,
                    this.labelProvider,
                    isMulti,
                    {
                        run: (mode: QuickOpenMode): boolean => {
                            if (mode !== QuickOpenMode.OPEN) {
                                return false;
                            }
                            this.taskService.kill(task.taskId);
                            return true;
                        }
                    },
                ));
            });
            if (runningTasks.length > 1) {
                items.push(new QuickOpenItem({
                    label: 'All running tasks',
                    run: (mode: QuickOpenMode): boolean => {
                        if (mode !== QuickOpenMode.OPEN) {
                            return false;
                        }
                        runningTasks.forEach((t: TaskInfo) => {
                            this.taskService.kill(t.taskId);
                        });
                        return true;
                    }
                }));
            }
        }
        acceptor(items);
    }

    async open(): Promise<void> {
        this.quickOpenService.open(this, {
            placeholder: 'Select task to terminate',
            fuzzyMatchLabel: true,
            fuzzyMatchDescription: true,
        });
    }

}

@injectable()
export class TaskRunningQuickOpen implements QuickOpenModel {

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(QuickOpenService)
    protected readonly quickOpenService: QuickOpenService;

    @inject(TaskDefinitionRegistry)
    protected readonly taskDefinitionRegistry: TaskDefinitionRegistry;

    @inject(TaskNameResolver)
    protected readonly taskNameResolver: TaskNameResolver;

    @inject(TaskSourceResolver)
    protected readonly taskSourceResolver: TaskSourceResolver;

    @inject(TaskService)
    protected readonly taskService: TaskService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(TerminalService)
    protected readonly terminalService: TerminalService;

    async onType(_lookFor: string, acceptor: (items: QuickOpenItem[]) => void): Promise<void> {
        const items: QuickOpenItem[] = [];
        const runningTasks: TaskInfo[] = await this.taskService.getRunningTasks();
        const isMulti: boolean = this.workspaceService.isMultiRootWorkspaceOpened;
        if (runningTasks.length <= 0) {
            items.push(new QuickOpenItem({
                label: 'No task is currently running',
                run: (): boolean => false,
            }));
        } else {
            runningTasks.forEach((task: TaskInfo) => {
                items.push(new RunningTaskQuickOpenItem(
                    task,
                    this.taskService,
                    this.taskNameResolver,
                    this.taskSourceResolver,
                    this.taskDefinitionRegistry,
                    this.labelProvider,
                    isMulti,
                    {
                        run: (mode: QuickOpenMode): boolean => {
                            if (mode !== QuickOpenMode.OPEN) {
                                return false;
                            }
                            if (task.terminalId) {
                                const terminal = this.terminalService.getById('terminal-' + task.terminalId);
                                if (terminal) {
                                    this.terminalService.open(terminal);
                                }
                            }
                            return true;
                        }
                    },
                ));
            });
        }
        acceptor(items);
    }

    async open(): Promise<void> {
        this.quickOpenService.open(this, {
            placeholder: 'Select the task to show its output',
            fuzzyMatchLabel: true,
            fuzzyMatchDescription: true,
        });
    }
}

export class RunningTaskQuickOpenItem extends QuickOpenItem {

    constructor(
        protected readonly taskInfo: TaskInfo,
        protected readonly taskService: TaskService,
        protected readonly taskNameResolver: TaskNameResolver,
        protected readonly taskSourceResolver: TaskSourceResolver,
        protected readonly taskDefinitionRegistry: TaskDefinitionRegistry,
        protected readonly labelProvider: LabelProvider,
        protected readonly isMulti: boolean,
        public readonly options: QuickOpenGroupItemOptions,
    ) {
        super(options);
    }

    getLabel(): string {
        return this.taskNameResolver.resolve(this.taskInfo.config);
    }

    getDescription(): string {
        return renderScope(this.taskInfo.config._scope, this.isMulti);
    }

    run(mode: QuickOpenMode): boolean {
        if (mode !== QuickOpenMode.OPEN || !this.options.run) {
            return false;
        }
        return this.options.run(mode);
    }
}

@injectable()
export class TaskRestartRunningQuickOpen implements QuickOpenModel {

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(QuickOpenService)
    protected readonly quickOpenService: QuickOpenService;

    @inject(TaskDefinitionRegistry)
    protected readonly taskDefinitionRegistry: TaskDefinitionRegistry;

    @inject(TaskNameResolver)
    protected readonly taskNameResolver: TaskNameResolver;

    @inject(TaskSourceResolver)
    protected readonly taskSourceResolver: TaskSourceResolver;

    @inject(TaskService)
    protected readonly taskService: TaskService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    async onType(_lookFor: string, acceptor: (items: QuickOpenItem[]) => void): Promise<void> {
        const items = [];
        const runningTasks: TaskInfo[] = await this.taskService.getRunningTasks();
        const isMulti: boolean = this.workspaceService.isMultiRootWorkspaceOpened;
        if (runningTasks.length <= 0) {
            items.push(new QuickOpenItem({
                label: 'No task to restart',
                run: (): boolean => false,
            }));
        } else {
            runningTasks.forEach((task: TaskInfo) => {
                items.push(new RunningTaskQuickOpenItem(
                    task,
                    this.taskService,
                    this.taskNameResolver,
                    this.taskSourceResolver,
                    this.taskDefinitionRegistry,
                    this.labelProvider,
                    isMulti,
                    {
                        run: (mode: QuickOpenMode): boolean => {
                            if (mode !== QuickOpenMode.OPEN) {
                                return false;
                            }
                            this.taskService.restartTask(task);
                            return true;
                        }
                    },
                ));
            });
        }
        acceptor(items);
    }

    async open(): Promise<void> {
        this.quickOpenService.open(this, {
            placeholder: 'Select task to restart',
            fuzzyMatchLabel: true,
            fuzzyMatchDescription: true,
        });
    }
}
