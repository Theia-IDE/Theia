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

import { ApplicationShell, FrontendApplication, QuickPickItem, QuickPickValue, WidgetManager, WidgetOpenMode } from '@theia/core/lib/browser';
import { open, OpenerService } from '@theia/core/lib/browser/opener-service';
import { CommandService, ILogger } from '@theia/core/lib/common';
import { MessageService } from '@theia/core/lib/common/message-service';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { QuickPickService } from '@theia/core/lib/common/quick-pick-service';
import { LabelProvider } from '@theia/core/lib/browser/label-provider';
import URI from '@theia/core/lib/common/uri';
import { EditorManager } from '@theia/editor/lib/browser';
import { ProblemManager } from '@theia/markers/lib/browser/problem/problem-manager';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { TerminalWidget } from '@theia/terminal/lib/browser/base/terminal-widget';
import { TerminalWidgetFactoryOptions } from '@theia/terminal/lib/browser/terminal-widget-impl';
import { VariableResolverService } from '@theia/variable-resolver/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { inject, injectable, named, postConstruct } from '@theia/core/shared/inversify';
import { DiagnosticSeverity, Range } from '@theia/core/shared/vscode-languageserver-types';
import {
    ApplyToKind,
    BackgroundTaskEndedEvent,
    DependsOrder,
    NamedProblemMatcher,
    ProblemMatchData,
    ProblemMatcher,
    RevealKind,
    RunTaskOption,
    TaskConfiguration,
    TaskConfigurationScope,
    TaskCustomization,
    TaskExitedEvent,
    TaskIdentifier,
    TaskInfo,
    TaskOutputPresentation,
    TaskOutputProcessedEvent,
    TaskServer
} from '../common';
import { TaskWatcher } from '../common/task-watcher';
import { ProvidedTaskConfigurations } from './provided-task-configurations';
import { TaskConfigurationClient, TaskConfigurations } from './task-configurations';
import { TaskResolverRegistry } from './task-contribution';
import { TaskDefinitionRegistry } from './task-definition-registry';
import { TaskNameResolver } from './task-name-resolver';
import { TaskSourceResolver } from './task-source-resolver';
import { ProblemMatcherRegistry } from './task-problem-matcher-registry';
import { TaskSchemaUpdater } from './task-schema-updater';
import { TaskConfigurationManager } from './task-configuration-manager';
import { PROBLEMS_WIDGET_ID, ProblemWidget } from '@theia/markers/lib/browser/problem/problem-widget';
import { TaskNode } from './task-node';
import { MonacoWorkspace } from '@theia/monaco/lib/browser/monaco-workspace';
import { TaskTerminalWidgetManager } from './task-terminal-widget-manager';
import { ShellTerminalServerProxy } from '@theia/terminal/lib/common/shell-terminal-protocol';

export interface QuickPickProblemMatcherItem {
    problemMatchers: NamedProblemMatcher[] | undefined;
    learnMore?: boolean;
}

interface TaskGraphNode {
    taskConfiguration: TaskConfiguration;
    node: TaskNode;
}

export enum TaskEndedTypes {
    TaskExited,
    BackgroundTaskEnded
}

export interface TaskEndedInfo {
    taskEndedType: TaskEndedTypes,
    value: number | boolean | undefined
}

@injectable()
export class TaskService implements TaskConfigurationClient {

    /**
     * The last executed task.
     */
    protected lastTask: { source: string, taskLabel: string, scope: TaskConfigurationScope } | undefined = undefined;
    protected cachedRecentTasks: TaskConfiguration[] = [];
    protected runningTasks = new Map<number, {
        exitCode: Deferred<number | undefined>,
        terminateSignal: Deferred<string | undefined>,
        isBackgroundTaskEnded: Deferred<boolean | undefined>
    }>();

    @inject(FrontendApplication)
    protected readonly app: FrontendApplication;

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(TaskServer)
    protected readonly taskServer: TaskServer;

    @inject(ILogger) @named('task')
    protected readonly logger: ILogger;

    @inject(WidgetManager)
    protected readonly widgetManager: WidgetManager;

    @inject(TaskWatcher)
    protected readonly taskWatcher: TaskWatcher;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(TaskConfigurations)
    protected readonly taskConfigurations: TaskConfigurations;

    @inject(ProvidedTaskConfigurations)
    protected readonly providedTaskConfigurations: ProvidedTaskConfigurations;

    @inject(VariableResolverService)
    protected readonly variableResolverService: VariableResolverService;

    @inject(TaskResolverRegistry)
    protected readonly taskResolverRegistry: TaskResolverRegistry;

    @inject(TerminalService)
    protected readonly terminalService: TerminalService;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(ProblemManager)
    protected readonly problemManager: ProblemManager;

    @inject(TaskDefinitionRegistry)
    protected readonly taskDefinitionRegistry: TaskDefinitionRegistry;

    @inject(ProblemMatcherRegistry)
    protected readonly problemMatcherRegistry: ProblemMatcherRegistry;

    @inject(QuickPickService)
    protected readonly quickPickService: QuickPickService;

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

    @inject(ShellTerminalServerProxy)
    protected readonly shellTerminalServer: ShellTerminalServerProxy;

    @inject(TaskNameResolver)
    protected readonly taskNameResolver: TaskNameResolver;

    @inject(TaskSourceResolver)
    protected readonly taskSourceResolver: TaskSourceResolver;

    @inject(TaskSchemaUpdater)
    protected readonly taskSchemaUpdater: TaskSchemaUpdater;

    @inject(TaskConfigurationManager)
    protected readonly taskConfigurationManager: TaskConfigurationManager;

    @inject(CommandService)
    protected readonly commands: CommandService;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(MonacoWorkspace)
    protected monacoWorkspace: MonacoWorkspace;

    @inject(TaskTerminalWidgetManager)
    protected readonly taskTerminalWidgetManager: TaskTerminalWidgetManager;

    @postConstruct()
    protected init(): void {
        this.getRunningTasks().then(tasks =>
            tasks.forEach(task => {
                if (!this.runningTasks.has(task.taskId)) {
                    this.runningTasks.set(task.taskId, {
                        exitCode: new Deferred<number | undefined>(), terminateSignal: new Deferred<string | undefined>(),
                        isBackgroundTaskEnded: new Deferred<boolean | undefined>()
                    });
                }
            }));

        // notify user that task has started
        this.taskWatcher.onTaskCreated((event: TaskInfo) => {
            if (!this.isEventForThisClient(event.ctx)) {
                return;
            }
            this.runningTasks.set(event.taskId, {
                exitCode: new Deferred<number | undefined>(),
                terminateSignal: new Deferred<string | undefined>(),
                isBackgroundTaskEnded: new Deferred<boolean | undefined>()
            });
        });

        this.taskWatcher.onOutputProcessed(async (event: TaskOutputProcessedEvent) => {
            if (!this.isEventForThisClient(event.ctx)) {
                return;
            }
            if (event.problems) {
                const runningTasksInfo: TaskInfo[] = await this.getRunningTasks();
                // check if the task is active
                const matchedRunningTaskInfo = runningTasksInfo.find(taskInfo => {
                    const taskConfig = taskInfo.config;
                    return this.taskDefinitionRegistry.compareTasks(taskConfig, event.config);
                });
                const isTaskActiveAndOutputSilent = matchedRunningTaskInfo &&
                    matchedRunningTaskInfo.config.presentation && matchedRunningTaskInfo.config.presentation.reveal === RevealKind.Silent;
                event.problems.forEach(problem => {
                    const existingMarkers = this.problemManager.findMarkers({ owner: problem.description.owner });
                    const uris = new Set<string>();
                    existingMarkers.forEach(marker => uris.add(marker.uri));
                    if (ProblemMatchData.is(problem) && problem.resource) {
                        // When task.presentation.reveal === RevealKind.Silent, put focus on the terminal only if it is an error
                        if (isTaskActiveAndOutputSilent && problem.marker.severity === DiagnosticSeverity.Error) {
                            const terminalId = matchedRunningTaskInfo!.terminalId;
                            if (terminalId) {
                                const terminal = this.terminalService.getByTerminalId(terminalId);
                                if (terminal) {
                                    const focus = !!matchedRunningTaskInfo!.config.presentation!.focus;
                                    if (focus) { // assign focus to the terminal if presentation.focus is true
                                        this.terminalService.open(terminal, { mode: 'activate' });
                                    } else { // show the terminal but not assign focus
                                        this.terminalService.open(terminal, { mode: 'reveal' });
                                    }
                                }
                            }
                        }
                        const uri = new URI(problem.resource.path).withScheme(problem.resource.scheme);
                        const document = this.monacoWorkspace.getTextDocument(uri.toString());
                        if (problem.description.applyTo === ApplyToKind.openDocuments && !!document ||
                            problem.description.applyTo === ApplyToKind.closedDocuments && !document ||
                            problem.description.applyTo === ApplyToKind.allDocuments
                        ) {
                            if (uris.has(uri.toString())) {
                                const newData = [
                                    ...existingMarkers
                                        .filter(marker => marker.uri === uri.toString())
                                        .map(markerData => markerData.data),
                                    problem.marker
                                ];
                                this.problemManager.setMarkers(uri, problem.description.owner, newData);
                            } else {
                                this.problemManager.setMarkers(uri, problem.description.owner, [problem.marker]);
                            }
                        }
                    } else { // should have received an event for finding the "background task begins" pattern
                        uris.forEach(uriString => this.problemManager.setMarkers(new URI(uriString), problem.description.owner, []));
                    }
                });
            }
        });

        this.taskWatcher.onBackgroundTaskEnded((event: BackgroundTaskEndedEvent) => {
            if (!this.isEventForThisClient(event.ctx)) {
                return;
            }

            if (!this.runningTasks.has(event.taskId)) {
                this.runningTasks.set(event.taskId, {
                    exitCode: new Deferred<number | undefined>(),
                    terminateSignal: new Deferred<string | undefined>(),
                    isBackgroundTaskEnded: new Deferred<boolean | undefined>()
                });
            }
            this.runningTasks.get(event.taskId)!.isBackgroundTaskEnded.resolve(true);
        });

        // notify user that task has finished
        this.taskWatcher.onTaskExit((event: TaskExitedEvent) => {
            if (!this.isEventForThisClient(event.ctx)) {
                return;
            }
            if (!this.runningTasks.has(event.taskId)) {
                this.runningTasks.set(event.taskId, {
                    exitCode: new Deferred<number | undefined>(),
                    terminateSignal: new Deferred<string | undefined>(),
                    isBackgroundTaskEnded: new Deferred<boolean | undefined>()
                });
            }
            this.runningTasks.get(event.taskId)!.exitCode.resolve(event.code);
            this.runningTasks.get(event.taskId)!.terminateSignal.resolve(event.signal);
            setTimeout(() => this.runningTasks.delete(event.taskId), 60 * 1000);

            const taskConfig = event.config;
            const taskIdentifier = taskConfig ? this.getTaskIdentifier(taskConfig) : event.taskId.toString();
            if (event.code !== undefined) {
                if (event.code !== 0) {
                    const eventTaskConfig = event.config;
                    if (eventTaskConfig && eventTaskConfig.presentation && eventTaskConfig.presentation.reveal === RevealKind.Silent && event.terminalId) {
                        const terminal = this.terminalService.getByTerminalId(event.terminalId);
                        const focus = !!eventTaskConfig.presentation.focus;
                        if (terminal) {
                            if (focus) { // assign focus to the terminal if presentation.focus is true
                                this.terminalService.open(terminal, { mode: 'activate' });
                            } else { // show the terminal but not assign focus
                                this.terminalService.open(terminal, { mode: 'reveal' });
                            }
                        }
                    }
                    this.messageService.error(`Task '${taskIdentifier}' has exited with code ${event.code}.`);
                }
            } else if (event.signal !== undefined) {
                this.messageService.info(`Task '${taskIdentifier}' was terminated by signal ${event.signal}.`);
            } else {
                console.error('Invalid TaskExitedEvent received, neither code nor signal is set.');
            }
        });
    }

    protected getTaskIdentifier(taskConfig: TaskConfiguration): string {
        const taskName = this.taskNameResolver.resolve(taskConfig);
        const sourceStrUri = this.taskSourceResolver.resolve(taskConfig);
        return `${taskName} (${this.labelProvider.getName(new URI(sourceStrUri))})`;
    }

    /**
     * Client should call this method to indicate that a new user-level action related to tasks has been started,
     * like invoking "Run Task..."
     * This method returns a token that can be used with various methods in this service.
     * As long as a client uses the same token, task providers will only asked once to contribute
     * tasks and the set of tasks will be cached. Each time the a new token is used, the cache of
     * contributed tasks is cleared.
     * @returns a token to be used for task-related actions
     */
    startUserAction(): number {
        return this.providedTaskConfigurations.startUserAction();
    }

    /**
     * Returns an array of the task configurations configured in tasks.json and provided by the extensions.
     * @param token  The cache token for the user interaction in progress
     */
    async getTasks(token: number): Promise<TaskConfiguration[]> {
        const configuredTasks = await this.getConfiguredTasks(token);
        const providedTasks = await this.getProvidedTasks(token);
        const notCustomizedProvidedTasks = providedTasks.filter(provided =>
            !configuredTasks.some(configured => this.taskDefinitionRegistry.compareTasks(configured, provided))
        );
        return [...configuredTasks, ...notCustomizedProvidedTasks];
    }

    /**
     * Returns an array of the valid task configurations which are configured in tasks.json files
     * @param token  The cache token for the user interaction in progress
     *
     */
    async getConfiguredTasks(token: number): Promise<TaskConfiguration[]> {
        const invalidTaskConfig = this.taskConfigurations.getInvalidTaskConfigurations()[0];
        if (invalidTaskConfig) {
            const widget = <ProblemWidget>await this.widgetManager.getOrCreateWidget(PROBLEMS_WIDGET_ID);
            const isProblemsWidgetVisible = widget && widget.isVisible;
            const currentEditorUri = this.editorManager.currentEditor && this.editorManager.currentEditor.editor.getResourceUri();
            let isInvalidTaskConfigFileOpen = false;
            if (currentEditorUri) {
                const folderUri = this.workspaceService.getWorkspaceRootUri(currentEditorUri);
                if (folderUri && folderUri.toString() === invalidTaskConfig._scope) {
                    isInvalidTaskConfigFileOpen = true;
                }
            }
            const warningMessage = 'Invalid task configurations are found. Open tasks.json and find details in the Problems view.';
            if (!isProblemsWidgetVisible || !isInvalidTaskConfigFileOpen) {
                this.messageService.warn(warningMessage, 'Open').then(actionOpen => {
                    if (actionOpen) {
                        if (invalidTaskConfig && invalidTaskConfig._scope) {
                            this.taskConfigurationManager.openConfiguration(invalidTaskConfig._scope);
                        }
                        if (!isProblemsWidgetVisible) {
                            this.commands.executeCommand('problemsView:toggle');
                        }
                    }
                });
            } else {
                this.messageService.warn(warningMessage);
            }
        }

        const validTaskConfigs = await this.taskConfigurations.getTasks(token);
        return validTaskConfigs;
    }

    /**
     * Returns an array of the task configurations which are provided by the extensions.
     * @param token  The cache token for the user interaction in progress
     */
    getProvidedTasks(token: number): Promise<TaskConfiguration[]> {
        return this.providedTaskConfigurations.getTasks(token);
    }

    addRecentTasks(tasks: TaskConfiguration | TaskConfiguration[]): void {
        if (Array.isArray(tasks)) {
            tasks.forEach(task => this.addRecentTasks(task));
        } else {
            const ind = this.cachedRecentTasks.findIndex(recent => this.taskDefinitionRegistry.compareTasks(recent, tasks));
            if (ind >= 0) {
                this.cachedRecentTasks.splice(ind, 1);
            }
            this.cachedRecentTasks.unshift(tasks);
        }
    }

    get recentTasks(): TaskConfiguration[] {
        return this.cachedRecentTasks;
    }

    set recentTasks(recent: TaskConfiguration[]) {
        this.cachedRecentTasks = recent;
    }

    /**
     * Clears the list of recently used tasks.
     */
    clearRecentTasks(): void {
        this.cachedRecentTasks = [];
    }

    /**
     * Open user ser
     */
    openUserTasks(): Promise<void> {
        return this.taskConfigurations.openUserTasks();
    }

    /**
     * Returns a task configuration provided by an extension by task source, scope and label.
     * If there are no task configuration, returns undefined.
     * @param token  The cache token for the user interaction in progress
     * @param source The source for configured tasks
     * @param label  The label of the task to find
     * @param scope  The task scope to look in
     */
    async getProvidedTask(token: number, source: string, label: string, scope: TaskConfigurationScope): Promise<TaskConfiguration | undefined> {
        return this.providedTaskConfigurations.getTask(token, source, label, scope);
    }

    /** Returns an array of running tasks 'TaskInfo' objects */
    getRunningTasks(): Promise<TaskInfo[]> {
        return this.taskServer.getTasks(this.getContext());
    }

    async customExecutionComplete(id: number, exitCode: number | undefined): Promise<void> {
        return this.taskServer.customExecutionComplete(id, exitCode);
    }

    /** Returns an array of task types that are registered, including the default types */
    getRegisteredTaskTypes(): Promise<string[]> {
        return this.taskSchemaUpdater.getRegisteredTaskTypes();
    }

    /**
     * Get the last executed task.
     *
     * @returns the last executed task or `undefined`.
     */
    getLastTask(): { source: string, taskLabel: string, scope: TaskConfigurationScope } | undefined {
        return this.lastTask;
    }

    /**
     * Runs a task, by task configuration label.
     * Note, it looks for a task configured in tasks.json only.
     * @param token  The cache token for the user interaction in progress
     * @param scope The scope where to look for tasks
     * @param taskLabel the label to look for
     */
    async runConfiguredTask(token: number, scope: TaskConfigurationScope, taskLabel: string): Promise<void> {
        const task = this.taskConfigurations.getTask(scope, taskLabel);
        if (!task) {
            this.logger.error(`Can't get task launch configuration for label: ${taskLabel}`);
            return;
        }

        this.run(token, task._source, taskLabel, scope);
    }

    /**
     * Run the last executed task.
     * @param token  The cache token for the user interaction in progress
     */
    async runLastTask(token: number): Promise<TaskInfo | undefined> {
        if (!this.lastTask) {
            return;
        }
        const { source, taskLabel, scope } = this.lastTask;
        return this.run(token, source, taskLabel, scope);
    }

    /**
     * Runs a task, by the source and label of the task configuration.
     * It looks for configured and detected tasks.
     * @param token  The cache token for the user interaction in progress
     * @param source The source for configured tasks
     * @param taskLabel The label to look for
     * @param scope  The scope where to look for tasks
     */
    async run(token: number, source: string, taskLabel: string, scope: TaskConfigurationScope): Promise<TaskInfo | undefined> {
        let task: TaskConfiguration | undefined;
        task = this.taskConfigurations.getTask(scope, taskLabel);
        if (!task) { // if a configured task cannot be found, search from detected tasks
            task = await this.getProvidedTask(token, source, taskLabel, scope);
            if (!task) { // find from the customized detected tasks
                task = await this.taskConfigurations.getCustomizedTask(token, scope, taskLabel);
            }
            if (!task) {
                this.logger.error(`Can't get task launch configuration for label: ${taskLabel}`);
                return;
            }
        }
        const customizationObject = await this.getTaskCustomization(task);

        if (!customizationObject.problemMatcher) {
            // ask the user what s/he wants to use to parse the task output
            const items = this.getCustomizeProblemMatcherItems();
            const selected = await this.quickPickService.show(items, {
                placeholder: 'Select for which kind of errors and warnings to scan the task output'
            });
            if (selected && ('value' in selected)) {
                if (selected.value?.problemMatchers) {
                    let matcherNames: string[] = [];
                    if (selected.value.problemMatchers && selected.value.problemMatchers.length === 0) { // never parse output for this task
                        matcherNames = [];
                    } else if (selected.value.problemMatchers && selected.value.problemMatchers.length > 0) { // continue with user-selected parser
                        matcherNames = selected.value.problemMatchers.map(matcher => matcher.name);
                    }
                    customizationObject.problemMatcher = matcherNames;

                    // write the selected matcher (or the decision of "never parse") into the `tasks.json`
                    this.updateTaskConfiguration(token, task, { problemMatcher: matcherNames });
                } else if (selected.value?.learnMore) { // user wants to learn more about parsing task output
                    open(this.openerService, new URI('https://code.visualstudio.com/docs/editor/tasks#_processing-task-output-with-problem-matchers'));
                }
                // else, continue the task with no parser
            } else { // do not start the task in case that the user did not select any item from the list
                return;
            }
        }

        const resolvedMatchers = await this.resolveProblemMatchers(task, customizationObject);
        const runTaskOption: RunTaskOption = {
            customization: { ...customizationObject, ...{ problemMatcher: resolvedMatchers } }
        };

        if (task.dependsOn) {
            return this.runCompoundTask(token, task, runTaskOption);
        } else {
            return this.runTask(task, runTaskOption).catch(error => {
                console.error('Error at launching task', error);
                return undefined;
            });
        }
    }

    /**
     * Runs a compound task
     * @param token  The cache token for the user interaction in progress
     * @param task The task to be executed
     * @param option options for executing the task
     */
    async runCompoundTask(token: number, task: TaskConfiguration, option?: RunTaskOption): Promise<TaskInfo | undefined> {
        const tasks = await this.getWorkspaceTasks(token, task._scope);
        try {
            const rootNode = new TaskNode(task, [], []);
            this.detectDirectedAcyclicGraph(task, rootNode, tasks);
        } catch (error) {
            console.error(`Error at launching task '${task.label}'`, error);
            this.messageService.error(error.message);
            return undefined;
        }
        return this.runTasksGraph(task, tasks, option).catch(error => {
            console.error(`Error at launching task '${task.label}'`, error);
            return undefined;
        });
    }

    /**
     * A recursive function that runs a task and all its sub tasks that it depends on.
     * A task can be executed only when all of its dependencies have been executed, or when it doesn’t have any dependencies at all.
     */
    async runTasksGraph(task: TaskConfiguration, tasks: TaskConfiguration[], option?: RunTaskOption): Promise<TaskInfo | undefined> {
        if (task && task.dependsOn) {
            // In case it is an array of task dependencies
            if (Array.isArray(task.dependsOn) && task.dependsOn.length > 0) {
                const dependentTasks: { 'task': TaskConfiguration; 'taskCustomization': TaskCustomization; 'resolvedMatchers': ProblemMatcher[] | undefined }[] = [];
                for (let i = 0; i < task.dependsOn.length; i++) {
                    // It may be a string (a task label) or a JSON object which represents a TaskIdentifier (e.g. {"type":"npm", "script":"script1"})
                    const taskIdentifier = task.dependsOn[i];
                    const dependentTask = this.getDependentTask(taskIdentifier, tasks);
                    const taskCustomization = await this.getTaskCustomization(dependentTask);
                    const resolvedMatchers = await this.resolveProblemMatchers(dependentTask, taskCustomization);
                    dependentTasks.push({ 'task': dependentTask, 'taskCustomization': taskCustomization, 'resolvedMatchers': resolvedMatchers });
                    // In case the 'dependsOrder' is 'sequence'
                    if (task.dependsOrder && task.dependsOrder === DependsOrder.Sequence) {
                        await this.runTasksGraph(dependentTask, tasks, {
                            customization: { ...taskCustomization, ...{ problemMatcher: resolvedMatchers } }
                        });
                    }
                }
                // In case the 'dependsOrder' is 'parallel'
                if (((!task.dependsOrder) || (task.dependsOrder && task.dependsOrder === DependsOrder.Parallel))) {
                    const promises = dependentTasks.map(item =>
                        this.runTasksGraph(item.task, tasks, {
                            customization: { ...item.taskCustomization, ...{ problemMatcher: item.resolvedMatchers } }
                        })
                    );
                    await Promise.all(promises);
                }
            } else if (!Array.isArray(task.dependsOn)) {
                // In case it is a string (a task label) or a JSON object which represents a TaskIdentifier (e.g. {"type":"npm", "script":"script1"})
                const taskIdentifier = task.dependsOn;
                const dependentTask = this.getDependentTask(taskIdentifier, tasks);
                const taskCustomization = await this.getTaskCustomization(dependentTask);
                const resolvedMatchers = await this.resolveProblemMatchers(dependentTask, taskCustomization);
                await this.runTasksGraph(dependentTask, tasks, {
                    customization: { ...taskCustomization, ...{ problemMatcher: resolvedMatchers } }
                });
            }
        }

        const taskInfo = await this.runTask(task, option);
        if (taskInfo) {
            const getExitCodePromise: Promise<TaskEndedInfo> = this.getExitCode(taskInfo.taskId).then(result => ({ taskEndedType: TaskEndedTypes.TaskExited, value: result }));
            const isBackgroundTaskEndedPromise: Promise<TaskEndedInfo> = this.isBackgroundTaskEnded(taskInfo.taskId).then(result =>
                ({ taskEndedType: TaskEndedTypes.BackgroundTaskEnded, value: result }));

            // After start running the task, we wait for the task process to exit and if it is a background task, we also wait for a feedback
            // that a background task is active, as soon as one of the promises fulfills, we can continue and analyze the results.
            const taskEndedInfo: TaskEndedInfo = await Promise.race([getExitCodePromise, isBackgroundTaskEndedPromise]);

            if ((taskEndedInfo.taskEndedType === TaskEndedTypes.TaskExited && taskEndedInfo.value !== 0) ||
                (taskEndedInfo.taskEndedType === TaskEndedTypes.BackgroundTaskEnded && !taskEndedInfo.value)) {
                throw new Error('The task: ' + task.label + ' terminated with exit code ' + taskEndedInfo.value + '.');
            }
        }
        return taskInfo;
    }

    /**
     * Creates a graph of dependencies tasks from the root task and verify there is no DAG (Directed Acyclic Graph).
     * In case of detection of a circular dependency, an error is thrown with a message which describes the detected circular reference.
     */
    detectDirectedAcyclicGraph(task: TaskConfiguration, taskNode: TaskNode, tasks: TaskConfiguration[]): void {
        if (task && task.dependsOn) {
            // In case the 'dependsOn' is an array
            if (Array.isArray(task.dependsOn) && task.dependsOn.length > 0) {
                for (let i = 0; i < task.dependsOn.length; i++) {
                    const childNode = this.createChildTaskNode(task, taskNode, task.dependsOn[i], tasks);
                    this.detectDirectedAcyclicGraph(childNode.taskConfiguration, childNode.node, tasks);
                }
            } else if (!Array.isArray(task.dependsOn)) {
                const childNode = this.createChildTaskNode(task, taskNode, task.dependsOn, tasks);
                this.detectDirectedAcyclicGraph(childNode.taskConfiguration, childNode.node, tasks);
            }
        }
    }

    // 'childTaskIdentifier' may be a string (a task label) or a JSON object which represents a TaskIdentifier (e.g. {"type":"npm", "script":"script1"})
    createChildTaskNode(task: TaskConfiguration, taskNode: TaskNode, childTaskIdentifier: string | TaskIdentifier, tasks: TaskConfiguration[]): TaskGraphNode {
        const childTaskConfiguration = this.getDependentTask(childTaskIdentifier, tasks);

        // If current task and child task are identical or if
        // one of the child tasks is identical to one of the current task ancestors, then raise an error
        if (this.taskDefinitionRegistry.compareTasks(task, childTaskConfiguration) ||
            taskNode.parentsID.filter(t => this.taskDefinitionRegistry.compareTasks(childTaskConfiguration, t)).length > 0) {
            const fromNode = task.label;
            const toNode = childTaskConfiguration.label;
            throw new Error('Circular reference detected: ' + fromNode + ' -->  ' + toNode);
        }
        const childNode = new TaskNode(childTaskConfiguration, [], Object.assign([], taskNode.parentsID));
        childNode.addParentDependency(taskNode.taskId);
        taskNode.addChildDependency(childNode);
        return { 'taskConfiguration': childTaskConfiguration, 'node': childNode };
    }

    /**
     * Gets task configuration by task label or by a JSON object which represents a task identifier
     *
     * @param taskIdentifier The task label (string) or a JSON object which represents a TaskIdentifier (e.g. {"type":"npm", "script":"script1"})
     * @param tasks an array of the task configurations
     * @returns the correct TaskConfiguration object which matches the taskIdentifier
     */
    getDependentTask(taskIdentifier: string | TaskIdentifier, tasks: TaskConfiguration[]): TaskConfiguration {
        const notEnoughDataError = 'The information provided in the "dependsOn" is not enough for matching the correct task !';
        let currentTaskChildConfiguration: TaskConfiguration;
        if (typeof (taskIdentifier) !== 'string') {
            // TaskIdentifier object does not support tasks of type 'shell' (The same behavior as in VS Code).
            // So if we want the 'dependsOn' property to include tasks of type 'shell',
            // then we must mention their labels (in the 'dependsOn' property) and not to create a task identifier object for them.
            currentTaskChildConfiguration = this.getTaskByTaskIdentifier(taskIdentifier, tasks);
            if (!currentTaskChildConfiguration.type) {
                this.messageService.error(notEnoughDataError);
                throw new Error(notEnoughDataError);
            }
            return currentTaskChildConfiguration;
        } else {
            currentTaskChildConfiguration = tasks.filter(t => taskIdentifier === this.taskNameResolver.resolve(t))[0];
            return currentTaskChildConfiguration;
        }
    }

    /**
     * Gets the matched task from an array of task configurations by TaskIdentifier.
     * In case that more than one task configuration matches, we returns the first one.
     *
     * @param taskIdentifier The task label (string) or a JSON object which represents a TaskIdentifier (e.g. {"type":"npm", "script":"script1"})
     * @param tasks An array of task configurations.
     * @returns The correct TaskConfiguration object which matches the taskIdentifier.
     */
    getTaskByTaskIdentifier(taskIdentifier: TaskIdentifier, tasks: TaskConfiguration[]): TaskConfiguration {
        const requiredProperties = Object.keys(taskIdentifier);
        const taskWithAllProperties = tasks.find(task => requiredProperties.every(property => task.hasOwnProperty(property) && task[property] === taskIdentifier[property]));
        return taskWithAllProperties ?? { label: '', _scope: '', type: '' }; // Fall back to empty TaskConfiguration
    }

    async runTask(task: TaskConfiguration, option?: RunTaskOption): Promise<TaskInfo | undefined> {
        // resolve problemMatchers
        if (!option && task.problemMatcher) {
            const customizationObject: TaskCustomization = { type: task.taskType, problemMatcher: task.problemMatcher };
            const resolvedMatchers = await this.resolveProblemMatchers(task, customizationObject);
            option = {
                customization: { ...customizationObject, ...{ problemMatcher: resolvedMatchers } }
            };
        }

        const runningTasksInfo: TaskInfo[] = await this.getRunningTasks();

        // check if the task is active
        const matchedRunningTaskInfo = runningTasksInfo.find(taskInfo => {
            const taskConfig = taskInfo.config;
            return this.taskDefinitionRegistry.compareTasks(taskConfig, task);
        });
        if (matchedRunningTaskInfo) { // the task is active
            const taskName = this.taskNameResolver.resolve(task);
            const terminalId = matchedRunningTaskInfo.terminalId;
            if (terminalId) {
                const terminal = this.terminalService.getByTerminalId(terminalId);
                if (terminal) {
                    if (TaskOutputPresentation.shouldSetFocusToTerminal(task)) { // assign focus to the terminal if presentation.focus is true
                        this.terminalService.open(terminal, { mode: 'activate' });
                    } else if (TaskOutputPresentation.shouldAlwaysRevealTerminal(task)) { // show the terminal but not assign focus
                        this.terminalService.open(terminal, { mode: 'reveal' });
                    }
                }
            }
            const selectedAction = await this.messageService.info(`The task '${taskName}' is already active`, 'Terminate Task', 'Restart Task');
            if (selectedAction === 'Terminate Task') {
                await this.terminateTask(matchedRunningTaskInfo);
            } else if (selectedAction === 'Restart Task') {
                return this.restartTask(matchedRunningTaskInfo, option);
            }
        } else { // run task as the task is not active
            return this.doRunTask(task, option);
        }
    }

    /**
     * Terminates a task that is actively running.
     * @param activeTaskInfo the TaskInfo of the task that is actively running
     */
    async terminateTask(activeTaskInfo: TaskInfo): Promise<void> {
        const taskId = activeTaskInfo.taskId;
        return this.kill(taskId);
    }

    /**
     * Terminates a task that is actively running, and restarts it.
     * @param activeTaskInfo the TaskInfo of the task that is actively running
     */
    async restartTask(activeTaskInfo: TaskInfo, option?: RunTaskOption): Promise<TaskInfo | undefined> {
        await this.terminateTask(activeTaskInfo);
        return this.doRunTask(activeTaskInfo.config, option);
    }

    protected async doRunTask(task: TaskConfiguration, option?: RunTaskOption): Promise<TaskInfo | undefined> {
        let overridePropertiesFunction: (task: TaskConfiguration) => void = () => { };
        if (option && option.customization) {
            const taskDefinition = this.taskDefinitionRegistry.getDefinition(task);
            if (taskDefinition) { // use the customization object to override the task config
                overridePropertiesFunction = tsk => {
                    Object.keys(option.customization!).forEach(customizedProperty => {
                        // properties used to define the task cannot be customized
                        if (customizedProperty !== 'type' && !taskDefinition.properties.all.some(pDefinition => pDefinition === customizedProperty)) {
                            tsk[customizedProperty] = option.customization![customizedProperty];
                        }
                    });
                };
            }
        }
        overridePropertiesFunction(task);
        this.addRecentTasks(task);
        try {
            const resolver = await this.taskResolverRegistry.getTaskResolver(task.type);
            const resolvedTask = resolver ? await resolver.resolveTask(task) : task;
            const executionResolver = this.taskResolverRegistry.getExecutionResolver(resolvedTask.taskType || resolvedTask.type);
            overridePropertiesFunction(resolvedTask);
            const taskToRun = executionResolver ? await executionResolver.resolveTask(resolvedTask) : resolvedTask;

            await this.removeProblemMarkers(option);
            return this.runResolvedTask(taskToRun, option);
        } catch (error) {
            const errMessage = `Error resolving task '${task.label}': ${error}`;
            this.logger.error(errMessage);
        }
        return undefined;
    }

    /**
     * Runs the first task with the given label.
     *
     * @param token  The cache token for the user interaction in progress
     * @param taskLabel The label of the task to be executed
     */
    async runTaskByLabel(token: number, taskLabel: string): Promise<TaskInfo | undefined> {
        const tasks: TaskConfiguration[] = await this.getTasks(token);
        for (const task of tasks) {
            if (task.label === taskLabel) {
                return this.runTask(task);
            }
        }
        return;
    }

    /**
     * Runs a task identified by the given identifier, but only if found in the given workspace folder
     *
     * @param token  The cache token for the user interaction in progress
     * @param workspaceFolderUri  The folder to restrict the search to
     * @param taskIdentifier The identifier to look for
     */
    async runWorkspaceTask(token: number, workspaceFolderUri: string | undefined, taskIdentifier: string | TaskIdentifier): Promise<TaskInfo | undefined> {
        const tasks = await this.getWorkspaceTasks(token, workspaceFolderUri);
        const task = this.getDependentTask(taskIdentifier, tasks);
        if (!task) {
            return undefined;
        }

        const taskCustomization = await this.getTaskCustomization(task);
        const resolvedMatchers = await this.resolveProblemMatchers(task, taskCustomization);
        try {
            const rootNode = new TaskNode(task, [], []);
            this.detectDirectedAcyclicGraph(task, rootNode, tasks);
        } catch (error) {
            this.logger.error(error.message);
            this.messageService.error(error.message);
            return undefined;
        }
        return this.runTasksGraph(task, tasks, {
            customization: { ...taskCustomization, ...{ problemMatcher: resolvedMatchers } }
        }).catch(error => {
            console.log(error.message);
            return undefined;
        });
    }

    /**
     * Updates the task configuration in the `tasks.json`.
     * The task config, together with updates, will be written into the `tasks.json` if it is not found in the file.
     *
     * @param token  The cache token for the user interaction in progress
     * @param task task that the updates will be applied to
     * @param update the updates to be applied
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async updateTaskConfiguration(token: number, task: TaskConfiguration, update: { [name: string]: any }): Promise<void> {
        if (update.problemMatcher) {
            if (Array.isArray(update.problemMatcher)) {
                update.problemMatcher.forEach((name, index) => {
                    if (!name.startsWith('$')) {
                        update.problemMatcher[index] = `$${update.problemMatcher[index]}`;
                    }
                });
            } else if (!update.problemMatcher.startsWith('$')) {
                update.problemMatcher = `$${update.problemMatcher}`;
            }
        }
        this.taskConfigurations.updateTaskConfig(token, task, update);
    }

    protected async getWorkspaceTasks(token: number, restrictToFolder: TaskConfigurationScope | undefined): Promise<TaskConfiguration[]> {
        const tasks = await this.getTasks(token);
        // if we pass undefined, return everything, otherwise only tasks with the same uri or workspace/global scope tasks
        return tasks.filter(t => typeof t._scope !== 'string' || t._scope === restrictToFolder);
    }

    protected async resolveProblemMatchers(task: TaskConfiguration, customizationObject: TaskCustomization): Promise<ProblemMatcher[] | undefined> {
        const notResolvedMatchers = customizationObject.problemMatcher ?
            (Array.isArray(customizationObject.problemMatcher) ? customizationObject.problemMatcher : [customizationObject.problemMatcher]) : undefined;
        let resolvedMatchers: ProblemMatcher[] | undefined = [];
        if (notResolvedMatchers) {
            // resolve matchers before passing them to the server
            for (const matcher of notResolvedMatchers) {
                let resolvedMatcher: ProblemMatcher | undefined;
                await this.problemMatcherRegistry.onReady();
                if (typeof matcher === 'string') {
                    resolvedMatcher = this.problemMatcherRegistry.get(matcher);
                } else {
                    resolvedMatcher = await this.problemMatcherRegistry.getProblemMatcherFromContribution(matcher);
                }
                if (resolvedMatcher) {
                    const scope = task._scope || task._source;
                    if (resolvedMatcher.filePrefix && scope) {
                        const options = {
                            context: new URI(scope).withScheme('file'),
                            configurationSection: 'tasks'
                        };
                        const resolvedPrefix = await this.variableResolverService.resolve(resolvedMatcher.filePrefix, options);
                        Object.assign(resolvedMatcher, { filePrefix: resolvedPrefix });
                    }
                    resolvedMatchers.push(resolvedMatcher);
                }
            }
        } else {
            resolvedMatchers = undefined;
        }
        return resolvedMatchers;
    }

    protected async getTaskCustomization(task: TaskConfiguration): Promise<TaskCustomization> {
        const customizationObject: TaskCustomization = { type: '', _scope: task._scope };
        const customizationFound = this.taskConfigurations.getCustomizationForTask(task);
        if (customizationFound) {
            Object.assign(customizationObject, customizationFound);
        } else {
            Object.assign(customizationObject, {
                type: task.type,
                problemMatcher: task.problemMatcher
            });
        }
        return customizationObject;
    }

    protected async removeProblemMarkers(option?: RunTaskOption): Promise<void> {
        if (option && option.customization) {
            const matchersFromOption = option.customization.problemMatcher || [];
            for (const matcher of matchersFromOption) {
                if (matcher && matcher.owner) {
                    const existingMarkers = this.problemManager.findMarkers({ owner: matcher.owner });
                    const uris = new Set<string>();
                    existingMarkers.forEach(marker => uris.add(marker.uri));
                    uris.forEach(uriString => this.problemManager.setMarkers(new URI(uriString), matcher.owner, []));
                }
            }
        }
    }

    /**
     * Runs the resolved task and opens terminal widget if the task is based on a terminal process
     * @param resolvedTask the resolved task
     * @param option options to run the resolved task
     */
    protected async runResolvedTask(resolvedTask: TaskConfiguration, option?: RunTaskOption): Promise<TaskInfo | undefined> {
        const source = resolvedTask._source;
        const taskLabel = resolvedTask.label;
        let taskInfo: TaskInfo | undefined;
        try {
            taskInfo = await this.taskServer.run(resolvedTask, this.getContext(), option);
            this.lastTask = { source, taskLabel, scope: resolvedTask._scope };
            this.logger.debug(`Task created. Task id: ${taskInfo.taskId}`);

            /**
             * open terminal widget if the task is based on a terminal process (type: 'shell' or 'process')
             *
             * @todo Use a different mechanism to determine if the task should be attached?
             *       Reason: Maybe a new task type wants to also be displayed in a terminal.
             */
            if (typeof taskInfo.terminalId === 'number') {
                await this.attach(taskInfo.terminalId, taskInfo);
            }
            return taskInfo;
        } catch (error) {
            const errorStr = `Error launching task '${taskLabel}': ${error.message}`;
            this.logger.error(errorStr);
            this.messageService.error(errorStr);
            if (taskInfo && typeof taskInfo.terminalId === 'number') {
                this.shellTerminalServer.onAttachAttempted(taskInfo.terminalId);
            }
        }
    }

    protected getCustomizeProblemMatcherItems(): Array<QuickPickValue<QuickPickProblemMatcherItem> | QuickPickItem> {
        const items: Array<QuickPickValue<QuickPickProblemMatcherItem> | QuickPickItem> = [];
        items.push({
            label: 'Continue without scanning the task output',
            value: { problemMatchers: undefined }
        });
        items.push({
            label: 'Never scan the task output',
            value: { problemMatchers: [] }
        });
        items.push({
            label: 'Learn more about scanning the task output',
            value: { problemMatchers: undefined, learnMore: true }
        });
        items.push({ type: 'separator', label: 'registered parsers' });

        const registeredProblemMatchers = this.problemMatcherRegistry.getAll();
        items.push(...registeredProblemMatchers.map(matcher =>
        ({
            label: matcher.label,
            value: { problemMatchers: [matcher] },
            description: matcher.name.startsWith('$') ? matcher.name : `$${matcher.name}`
        })
        ));
        return items;
    }

    /**
     * Run selected text in the last active terminal.
     */
    async runSelectedText(): Promise<void> {
        if (!this.editorManager.currentEditor) { return; }
        const startLine = this.editorManager.currentEditor.editor.selection.start.line;
        const startCharacter = this.editorManager.currentEditor.editor.selection.start.character;
        const endLine = this.editorManager.currentEditor.editor.selection.end.line;
        const endCharacter = this.editorManager.currentEditor.editor.selection.end.character;
        let selectedRange: Range = Range.create(startLine, startCharacter, endLine, endCharacter);
        // if no text is selected, default to selecting entire line
        if (startLine === endLine && startCharacter === endCharacter) {
            selectedRange = Range.create(startLine, 0, endLine + 1, 0);
        }
        const selectedText: string = this.editorManager.currentEditor.editor.document.getText(selectedRange).trimRight() + '\n';
        let terminal = this.terminalService.lastUsedTerminal;
        if (!terminal || terminal.kind !== 'user' || (await terminal.hasChildProcesses())) {
            terminal = <TerminalWidget>await this.terminalService.newTerminal(<TerminalWidgetFactoryOptions>{ created: new Date().toString() });
            await terminal.start();
            this.terminalService.activateTerminal(terminal);
        }
        terminal.sendText(selectedText);
    }

    async attach(terminalId: number, taskInfo: TaskInfo): Promise<number | void> {
        let widgetOpenMode: WidgetOpenMode = 'open';
        if (taskInfo) {
            const terminalWidget = this.terminalService.getByTerminalId(terminalId);
            if (terminalWidget) {
                this.messageService.error('Task is already running in terminal');
                return this.terminalService.open(terminalWidget, { mode: 'activate' });
            }
            if (TaskOutputPresentation.shouldAlwaysRevealTerminal(taskInfo.config)) {
                if (TaskOutputPresentation.shouldSetFocusToTerminal(taskInfo.config)) { // assign focus to the terminal if presentation.focus is true
                    widgetOpenMode = 'activate';
                } else { // show the terminal but not assign focus
                    widgetOpenMode = 'reveal';
                }
            }
        }
        const { taskId } = taskInfo;
        // Create / find a terminal widget to display an execution output of a task that was launched as a command inside a shell.
        const widget = await this.taskTerminalWidgetManager.open({
            created: new Date().toString(),
            id: this.getTerminalWidgetId(terminalId),
            title: taskInfo
                ? `Task: ${taskInfo.config.label}`
                : `Task: #${taskId}`,
            destroyTermOnClose: true
        }, {
            widgetOptions: { area: 'bottom' },
            mode: widgetOpenMode,
            taskInfo
        });
        return widget.start(terminalId);
    }

    protected getTerminalWidgetId(terminalId: number): string | undefined {
        const terminalWidget = this.terminalService.getByTerminalId(terminalId);
        if (terminalWidget) {
            return terminalWidget.id;
        }
    }

    /**
     * Opens an editor to configure the given task.
     *
     * @param token  The cache token for the user interaction in progress
     * @param task The task to configure
     */
    async configure(token: number, task: TaskConfiguration): Promise<void> {
        Object.assign(task, { label: this.taskNameResolver.resolve(task) });
        await this.taskConfigurations.configure(token, task);
    }

    protected isEventForThisClient(context: string | undefined): boolean {
        if (context === this.getContext()) {
            return true;
        }
        return false;
    }

    taskConfigurationChanged(event: string[]): void {
        // do nothing for now
    }

    protected getContext(): string | undefined {
        return this.workspaceService.workspace?.resource.toString();
    }

    /** Kill task for a given id if task is found */
    async kill(id: number): Promise<void> {
        try {
            await this.taskServer.kill(id);
        } catch (error) {
            this.logger.error(`Error killing task '${id}': ${error}`);
            this.messageService.error(`Error killing task '${id}': ${error}`);
            return;
        }
        this.logger.debug(`Task killed. Task id: ${id}`);
    }

    async isBackgroundTaskEnded(id: number): Promise<boolean | undefined> {
        const completedTask = this.runningTasks.get(id);
        return completedTask && completedTask.isBackgroundTaskEnded!.promise;
    }

    async getExitCode(id: number): Promise<number | undefined> {
        const completedTask = this.runningTasks.get(id);
        return completedTask && completedTask.exitCode.promise;
    }

    async getTerminateSignal(id: number): Promise<string | undefined> {
        const completedTask = this.runningTasks.get(id);
        return completedTask && completedTask.terminateSignal.promise;
    }
}
