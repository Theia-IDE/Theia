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

import { inject, injectable, optional } from '@theia/core/shared/inversify';
import { TaskService } from './task-service';
import { TaskInfo, TaskConfiguration, TaskCustomization, TaskScope, TaskConfigurationScope } from '../common/task-protocol';
import { TaskDefinitionRegistry } from './task-definition-registry';
import URI from '@theia/core/lib/common/uri';
import { LabelProvider, QuickAccessProvider, QuickAccessRegistry, QuickInputService } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { PreferenceService } from '@theia/core/lib/browser';
import { TaskNameResolver } from './task-name-resolver';
import { TaskSourceResolver } from './task-source-resolver';
import { TaskConfigurationManager } from './task-configuration-manager';
import { filterItems, QuickInputButton, QuickPickItem, QuickPicks } from '@theia/core/lib/browser/quick-input/quick-input-service';
import { CancellationToken } from '@theia/core/lib/common';

export namespace ConfigureTaskAction {
    export const ID = 'workbench.action.tasks.configureTaskRunner';
    export const TEXT = 'Configure Task';
}

@injectable()
export class QuickOpenTask implements QuickAccessProvider {
    static readonly PREFIX = 'task ';
    readonly description: string = 'Run Task';
    protected items: Array<QuickPickItem> = [];

    @inject(TaskService)
    protected readonly taskService: TaskService;

    @inject(QuickInputService) @optional()
    protected readonly quickInputService: QuickInputService;

    @inject(QuickAccessRegistry)
    protected readonly quickAccessRegistry: QuickAccessRegistry;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(TaskDefinitionRegistry)
    protected readonly taskDefinitionRegistry: TaskDefinitionRegistry;

    @inject(TaskNameResolver)
    protected readonly taskNameResolver: TaskNameResolver;

    @inject(TaskSourceResolver)
    protected readonly taskSourceResolver: TaskSourceResolver;

    @inject(TaskConfigurationManager)
    protected readonly taskConfigurationManager: TaskConfigurationManager;

    @inject(PreferenceService)
    protected readonly preferences: PreferenceService;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    init(): Promise<void> {
        return this.doInit(this.taskService.startUserAction());
    }

    protected async doInit(token: number): Promise<void> {
        const recentTasks = this.taskService.recentTasks;
        const configuredTasks = await this.taskService.getConfiguredTasks(token);
        const providedTasks = await this.taskService.getProvidedTasks(token);

        const { filteredRecentTasks, filteredConfiguredTasks, filteredProvidedTasks } = this.getFilteredTasks(recentTasks, configuredTasks, providedTasks);
        const isMulti: boolean = this.workspaceService.isMultiRootWorkspaceOpened;
        this.items = [];

        const filteredRecentTasksItems = this.getItems(filteredRecentTasks, 'recently used tasks', token, isMulti);
        const filteredConfiguredTasksItems = this.getItems(filteredConfiguredTasks, 'configured tasks', token, isMulti);
        const filteredProvidedTasksItems = this.getItems(filteredProvidedTasks, 'detected tasks', token, isMulti);

        this.items.push(
            ...filteredRecentTasksItems,
            ...filteredConfiguredTasksItems,
            ...filteredProvidedTasksItems
        );
    }

    protected onDidTriggerGearIcon(item: QuickPickItem): void {
        if (item instanceof TaskRunQuickOpenItem) {
            this.taskService.configure(item.token, item.task);
            this.quickInputService.hide();
        }
    }

    async open(): Promise<void> {
        await this.init();
        if (!this.items.length) {
            this.items.push(({
                label: 'No task to run found. Configure Tasks...',
                execute: () => this.configure()
            }));
        }
        this.quickInputService?.showQuickPick(this.items, {
            placeholder: 'Select the task to run',
            onDidTriggerItemButton: ({ item }) => this.onDidTriggerGearIcon(item)
        });
    }

    attach(): void {
        this.items = [];
        const isMulti: boolean = this.workspaceService.isMultiRootWorkspaceOpened;
        this.taskService.getRunningTasks().then(tasks => {
            if (!tasks.length) {
                this.items.push({
                    label: 'No tasks found',
                });
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
                            () => this.taskService.attach(task.terminalId!, task)
                        ));
                    }
                });
            }
            if (this.items.length === 0) {
                this.items.push(({
                    label: 'No tasks found'
                }));
            }
            this.quickInputService?.showQuickPick(this.items, { placeholder: 'Choose task to open' });
        });
    }

    async configure(): Promise<void> {
        this.items = [];
        const isMulti: boolean = this.workspaceService.isMultiRootWorkspaceOpened;
        const token: number = this.taskService.startUserAction();

        const configuredTasks = await this.taskService.getConfiguredTasks(token);
        const providedTasks = await this.taskService.getProvidedTasks(token);

        // check if tasks.json exists. If not, display "Create tasks.json file from template"
        // If tasks.json exists and empty, display 'Open tasks.json file'
        const { filteredConfiguredTasks, filteredProvidedTasks } = this.getFilteredTasks([], configuredTasks, providedTasks);
        const groupedTasks = this.getGroupedTasksByWorkspaceFolder([...filteredConfiguredTasks, ...filteredProvidedTasks]);
        if (groupedTasks.has(TaskScope.Global.toString())) {
            const configs = groupedTasks.get(TaskScope.Global.toString())!;
            this.items.push(
                ...configs.map(taskConfig => {
                    const item = new TaskConfigureQuickOpenItem(
                        token,
                        taskConfig,
                        this.taskService,
                        this.taskNameResolver,
                        this.workspaceService,
                        isMulti
                    );
                    item['taskDefinitionRegistry'] = this.taskDefinitionRegistry;
                    return item;
                })
            );
        }

        const rootUris = (await this.workspaceService.roots).map(rootStat => rootStat.resource.toString());
        for (const rootFolder of rootUris) {
            const folderName = new URI(rootFolder).displayName;
            if (groupedTasks.has(rootFolder)) {
                const configs = groupedTasks.get(rootFolder.toString())!;
                this.items.push(
                    ...configs.map((taskConfig, index) => {
                        const item = new TaskConfigureQuickOpenItem(
                            token,
                            taskConfig,
                            this.taskService,
                            this.taskNameResolver,
                            this.workspaceService,
                            isMulti,

                        );
                        item['taskDefinitionRegistry'] = this.taskDefinitionRegistry;
                        return item;
                    })
                );
            } else {
                const { configUri } = this.preferences.resolve('tasks', [], rootFolder);
                const existTaskConfigFile = !!configUri;
                this.items.push(({
                    label: existTaskConfigFile ? 'Open tasks.json file' : 'Create tasks.json file from template',
                    execute: () => {
                        setTimeout(() => this.taskConfigurationManager.openConfiguration(rootFolder));
                    }
                }));
            }
            if (this.items.length > 0) {
                this.items.unshift({
                    type: 'separator',
                    label: isMulti ? folderName : ''
                });
            }
        }

        if (this.items.length === 0) {
            this.items.push(({
                label: 'No tasks found'
            }));
        }

        this.quickInputService?.showQuickPick(this.items, { placeholder: 'Select a task to configure' });
    }

    protected getTaskItems(): QuickPickItem[] {
        return this.items.filter(item => item.type !== 'separator' && (item as TaskRunQuickOpenItem).task !== undefined);
    }

    async runBuildOrTestTask(buildOrTestType: 'build' | 'test'): Promise<void> {
        const shouldRunBuildTask = buildOrTestType === 'build';
        const token: number = this.taskService.startUserAction();

        await this.doInit(token);

        const taskItems = this.getTaskItems();

        if (taskItems.length > 0) { // the item in `this.items` is not 'No tasks found'
            const buildOrTestTasks = taskItems.filter((t: TaskRunQuickOpenItem) =>
                shouldRunBuildTask ? TaskCustomization.isBuildTask(t.task) : TaskCustomization.isTestTask(t.task)
            );
            if (buildOrTestTasks.length > 0) { // build / test tasks are defined in the workspace
                const defaultBuildOrTestTasks = buildOrTestTasks.filter((t: TaskRunQuickOpenItem) =>
                    shouldRunBuildTask ? TaskCustomization.isDefaultBuildTask(t.task) : TaskCustomization.isDefaultTestTask(t.task)
                );
                if (defaultBuildOrTestTasks.length === 1) { // run the default build / test task
                    const defaultBuildOrTestTask = defaultBuildOrTestTasks[0];
                    const taskToRun = (defaultBuildOrTestTask as TaskRunQuickOpenItem).task;
                    const scope = taskToRun._scope;

                    if (this.taskDefinitionRegistry && !!this.taskDefinitionRegistry.getDefinition(taskToRun)) {
                        this.taskService.run(token, taskToRun.source, taskToRun.label, scope);
                    } else {
                        this.taskService.run(token, taskToRun._source, taskToRun.label, scope);
                    }
                    return;
                }
                // if default build / test task is not found, or there are more than one default,
                // display the list of build /test tasks to let the user decide which to run
                this.items = buildOrTestTasks;
            } else { // no build / test tasks, display an action item to configure the build / test task
                this.items = [({
                    label: `No ${buildOrTestType} task to run found. Configure ${buildOrTestType.charAt(0).toUpperCase() + buildOrTestType.slice(1)} Task...`,
                    execute: () => {
                        this.doInit(token).then(() => {
                            // update the `tasks.json` file, instead of running the task itself
                            this.items = this.getTaskItems().map((item: TaskRunQuickOpenItem) => new ConfigureBuildOrTestTaskQuickOpenItem(
                                token,
                                item.task,
                                this.taskService,
                                this.workspaceService.isMultiRootWorkspaceOpened,
                                this.taskNameResolver,
                                shouldRunBuildTask,
                                this.taskConfigurationManager,
                                this.taskDefinitionRegistry,
                                this.taskSourceResolver
                            ));
                            this.quickInputService?.showQuickPick(this.items, { placeholder: `Select the task to be used as the default ${buildOrTestType} task` });
                        });
                    }
                })];
            }
        } else { // no tasks are currently present, prompt users if they'd like to configure a task.
            this.items = [{
                label: `No ${buildOrTestType} task to run found. Configure ${buildOrTestType.charAt(0).toUpperCase() + buildOrTestType.slice(1)} Task...`,
                execute: () => this.configure()
            }];
        }

        this.quickInputService?.showQuickPick(this.items, {
            placeholder: `Select the ${buildOrTestType} task to run`,
            onDidTriggerItemButton: ({ item }) => this.onDidTriggerGearIcon(item)
        });
    }

    async getPicks(filter: string, token: CancellationToken): Promise<QuickPicks> {
        if (this.items.length === 0) {
            await this.init();
        }
        return filterItems(this.items, filter);
    }

    registerQuickAccessProvider(): void {
        this.quickAccessRegistry.registerQuickAccessProvider({
            getInstance: () => this,
            prefix: QuickOpenTask.PREFIX,
            placeholder: 'Select the task to run',
            helpEntries: [{ description: 'Run Task', needsEditor: false }]
        });
    }

    protected getRunningTaskLabel(task: TaskInfo): string {
        return `Task id: ${task.taskId}, label: ${task.config.label}`;
    }

    private getItems(tasks: TaskConfiguration[], groupLabel: string, token: number, isMulti: boolean):
        QuickPickItem[] {
        const items: QuickPickItem[] = tasks.map(task =>
            new TaskRunQuickOpenItem(token, task, this.taskService, isMulti, this.taskDefinitionRegistry, this.taskNameResolver,
                this.taskSourceResolver, this.taskConfigurationManager, [{
                    iconClass: 'codicon-gear',
                    tooltip: 'Configure Task',
                }])
        );

        if (items.length > 0) {
            items.unshift({ type: 'separator', label: groupLabel });
        }
        return items;
    }

    private getFilteredTasks(recentTasks: TaskConfiguration[], configuredTasks: TaskConfiguration[], providedTasks: TaskConfiguration[]): {
        filteredRecentTasks: TaskConfiguration[], filteredConfiguredTasks: TaskConfiguration[], filteredProvidedTasks: TaskConfiguration[]
    } {

        const filteredRecentTasks: TaskConfiguration[] = [];
        recentTasks.forEach(recent => {
            const originalTaskConfig = [...configuredTasks, ...providedTasks].find(t => this.taskDefinitionRegistry.compareTasks(recent, t));
            if (originalTaskConfig) {
                filteredRecentTasks.push(originalTaskConfig);
            }
        });

        const filteredProvidedTasks: TaskConfiguration[] = [];
        providedTasks.forEach(provided => {
            const exist = [...filteredRecentTasks, ...configuredTasks].some(t => this.taskDefinitionRegistry.compareTasks(provided, t));
            if (!exist) {
                filteredProvidedTasks.push(provided);
            }
        });

        const filteredConfiguredTasks: TaskConfiguration[] = [];
        configuredTasks.forEach(configured => {
            const exist = filteredRecentTasks.some(t => this.taskDefinitionRegistry.compareTasks(configured, t));
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

export class TaskRunQuickOpenItem implements QuickPickItem {
    constructor(
        public readonly token: number,
        public readonly task: TaskConfiguration,
        protected taskService: TaskService,
        protected isMulti: boolean,
        protected readonly taskDefinitionRegistry: TaskDefinitionRegistry,
        protected readonly taskNameResolver: TaskNameResolver,
        protected readonly taskSourceResolver: TaskSourceResolver,
        protected taskConfigurationManager: TaskConfigurationManager,
        public readonly buttons?: Array<QuickInputButton>
    ) { }

    get label(): string {
        return this.taskNameResolver.resolve(this.task);
    }

    get description(): string {
        return renderScope(this.task._scope, this.isMulti);
    }

    get detail(): string | undefined {
        return this.task.detail;
    }

    execute(): void {
        const scope = this.task._scope;
        if (this.taskDefinitionRegistry && !!this.taskDefinitionRegistry.getDefinition(this.task)) {
            this.taskService.run(this.token, this.task.source || this.task._source, this.task.label, scope);
        } else {
            this.taskService.run(this.token, this.task._source, this.task.label, scope);
        }
    }

    trigger(): monaco.quickInput.TriggerAction {
        this.taskService.configure(this.token, this.task);
        return monaco.quickInput.TriggerAction.CLOSE_PICKER;
    }
}

export class ConfigureBuildOrTestTaskQuickOpenItem extends TaskRunQuickOpenItem {
    constructor(
        public readonly token: number,
        public readonly task: TaskConfiguration,
        protected taskService: TaskService,
        protected isMulti: boolean,
        protected readonly taskNameResolver: TaskNameResolver,
        protected readonly isBuildTask: boolean,
        protected taskConfigurationManager: TaskConfigurationManager,
        protected readonly taskDefinitionRegistry: TaskDefinitionRegistry,
        protected readonly taskSourceResolver: TaskSourceResolver
    ) {
        super(token, task, taskService, isMulti, taskDefinitionRegistry, taskNameResolver, taskSourceResolver, taskConfigurationManager);
    }

    execute(): void {
        this.taskService.updateTaskConfiguration(this.token, this.task, { group: { kind: this.isBuildTask ? 'build' : 'test', isDefault: true } })
            .then(() => {
                if (this.task._scope) {
                    this.taskConfigurationManager.openConfiguration(this.task._scope);
                }
            });
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

export class TaskConfigureQuickOpenItem implements QuickPickItem {

    protected taskDefinitionRegistry: TaskDefinitionRegistry;

    constructor(
        protected readonly token: number,
        protected readonly task: TaskConfiguration,
        protected readonly taskService: TaskService,
        protected readonly taskNameResolver: TaskNameResolver,
        protected readonly workspaceService: WorkspaceService,
        protected readonly isMulti: boolean
    ) {
        const stat = this.workspaceService.workspace;
        this.isMulti = stat ? !stat.isDirectory : false;
    }

    get label(): string {
        return this.taskNameResolver.resolve(this.task);
    }

    get description(): string {
        return renderScope(this.task._scope, this.isMulti);
    }

    accept(): void {
        this.execute();
    }

    execute(): void {
        this.taskService.configure(this.token, this.task);
    }
}

@injectable()
export class TaskTerminateQuickOpen {

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(QuickInputService) @optional()
    protected readonly quickInputService: QuickInputService;

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

    async getItems(): Promise<Array<QuickPickItem>> {
        const items: Array<QuickPickItem> = [];
        const runningTasks: TaskInfo[] = await this.taskService.getRunningTasks();
        const isMulti: boolean = this.workspaceService.isMultiRootWorkspaceOpened;
        if (runningTasks.length <= 0) {
            items.push(({
                label: 'No task is currently running',
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
                    () => this.taskService.kill(task.taskId)
                ));
            });
            if (runningTasks.length > 1) {
                items.push(({
                    label: 'All running tasks',
                    execute: () => {
                        runningTasks.forEach((t: TaskInfo) => {
                            this.taskService.kill(t.taskId);
                        });
                    }
                }));
            }
        }
        return items;
    }

    async open(): Promise<void> {
        const items = await this.getItems();
        this.quickInputService?.showQuickPick(items, { placeholder: 'Select task to terminate' });
    }
}

@injectable()
export class TaskRunningQuickOpen {
    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(QuickInputService) @optional()
    protected readonly quickInputService: QuickInputService;

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

    async getItems(): Promise<Array<QuickPickItem>> {
        const items: Array<QuickPickItem> = [];
        const runningTasks: TaskInfo[] = await this.taskService.getRunningTasks();
        const isMulti: boolean = this.workspaceService.isMultiRootWorkspaceOpened;
        if (runningTasks.length <= 0) {
            items.push(({
                label: 'No task is currently running',
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
                    () => {
                        if (task.terminalId) {
                            const terminal = this.terminalService.getByTerminalId(task.terminalId);
                            if (terminal) {
                                this.terminalService.open(terminal);
                            }
                        }
                    }
                ));
            });
        }
        return items;
    }

    async open(): Promise<void> {
        const items = await this.getItems();
        this.quickInputService?.showQuickPick(items, { placeholder: 'Select the task to show its output' });
    }
}

export class RunningTaskQuickOpenItem implements QuickPickItem {
    constructor(
        protected readonly taskInfo: TaskInfo,
        protected readonly taskService: TaskService,
        protected readonly taskNameResolver: TaskNameResolver,
        protected readonly taskSourceResolver: TaskSourceResolver,
        protected readonly taskDefinitionRegistry: TaskDefinitionRegistry,
        protected readonly labelProvider: LabelProvider,
        protected readonly isMulti: boolean,
        public readonly execute: () => void,
    ) { }

    get label(): string {
        return this.taskNameResolver.resolve(this.taskInfo.config);
    }

    get description(): string {
        return renderScope(this.taskInfo.config._scope, this.isMulti);
    }

    get detail(): string | undefined {
        return this.taskInfo.config.detail;
    }
}

@injectable()
export class TaskRestartRunningQuickOpen {
    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(QuickInputService) @optional()
    protected readonly quickInputService: QuickInputService;

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

    async getItems(): Promise<Array<QuickPickItem>> {
        const items: Array<QuickPickItem> = [];
        const runningTasks: TaskInfo[] = await this.taskService.getRunningTasks();
        const isMulti: boolean = this.workspaceService.isMultiRootWorkspaceOpened;
        if (runningTasks.length <= 0) {
            items.push({
                label: 'No task to restart'
            });
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
                    () => this.taskService.restartTask(task)
                ));
            });
        }
        return items;
    }

    async open(): Promise<void> {
        const items = await this.getItems();
        this.quickInputService?.showQuickPick(items, { placeholder: 'Select task to restart' });
    }
}

