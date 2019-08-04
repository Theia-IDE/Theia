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

import { inject, injectable, named, postConstruct } from 'inversify';
import { EditorManager } from '@theia/editor/lib/browser';
import { ILogger } from '@theia/core/lib/common';
import { ApplicationShell, FrontendApplication, WidgetManager } from '@theia/core/lib/browser';
import { TaskResolverRegistry, TaskProviderRegistry } from './task-contribution';
import { TERMINAL_WIDGET_FACTORY_ID, TerminalWidgetFactoryOptions } from '@theia/terminal/lib/browser/terminal-widget-impl';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { TerminalWidget } from '@theia/terminal/lib/browser/base/terminal-widget';
import { MessageService } from '@theia/core/lib/common/message-service';
import { ProblemManager } from '@theia/markers/lib/browser/problem/problem-manager';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { VariableResolverService } from '@theia/variable-resolver/lib/browser';
import {
    ContributedTaskConfiguration,
    ProblemMatcher,
    ProblemMatchData,
    TaskCustomization,
    TaskServer,
    TaskExitedEvent,
    TaskInfo,
    TaskConfiguration,
    TaskOutputProcessedEvent,
    RunTaskOption
} from '../common';
import { TaskWatcher } from '../common/task-watcher';
import { TaskConfigurationClient, TaskConfigurations } from './task-configurations';
import { ProvidedTaskConfigurations } from './provided-task-configurations';
import { TaskDefinitionRegistry } from './task-definition-registry';
import { ProblemMatcherRegistry } from './task-problem-matcher-registry';
import { Range } from 'vscode-languageserver-types';
import { IProcessExitEvent } from '@theia/process/lib/node/process';
import URI from '@theia/core/lib/common/uri';

import { WebSocketConnectionProvider } from '@theia/core/lib/browser';
import { MessageConnection } from 'vscode-jsonrpc';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { tasksPath } from '../common/task-protocol';
import { DisposableCollection } from '@theia/core';

@injectable()
export class TaskService implements TaskConfigurationClient {
    /**
     * Reflects whether a valid task configuration file was found
     * in the current workspace, and is being watched for changes.
     */
    protected configurationFileFound: boolean = false;

    /**
     * The last executed task.
     */
    protected lastTask: { source: string, taskLabel: string } | undefined = undefined;
    protected cachedRecentTasks: TaskConfiguration[] = [];

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

    /**
     * @deprecated To be removed in 0.5.0
     */
    @inject(TaskProviderRegistry)
    protected readonly taskProviderRegistry: TaskProviderRegistry;

    @inject(WebSocketConnectionProvider)
    protected readonly webSocketConnectionProvider: WebSocketConnectionProvider;

    protected readonly toDispose = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        this.workspaceService.onWorkspaceChanged(async roots => {
            this.configurationFileFound = (await Promise.all(roots.map(r => this.taskConfigurations.watchConfigurationFile(r.uri)))).some(result => !!result);
            const rootUris = roots.map(r => new URI(r.uri));
            const taskConfigFileUris = this.taskConfigurations.configFileUris.map(strUri => new URI(strUri));
            for (const taskConfigUri of taskConfigFileUris) {
                if (!rootUris.some(rootUri => !!rootUri.relative(taskConfigUri))) {
                    this.taskConfigurations.unwatchConfigurationFile(taskConfigUri.toString());
                    this.taskConfigurations.removeTasks(taskConfigUri.toString());
                }
            }
        });

        // notify user that task has started
        this.taskWatcher.onTaskCreated((event: TaskInfo) => {
            if (this.isEventForThisClient(event.ctx)) {
                const task = event.config;

                if (this.isCustomFeedbackProvided(task)) {
                    return;
                }

                let taskIdentifier = event.taskId.toString();
                if (task) {
                    taskIdentifier = !!this.taskDefinitionRegistry.getDefinition(task) ? `${task._source}: ${task.label}` : `${task.type}: ${task.label}`;
                }
                this.messageService.info(`Task ${taskIdentifier} has been started`);
            }
        });

        this.taskWatcher.onOutputProcessed((event: TaskOutputProcessedEvent) => {
            if (!this.isEventForThisClient(event.ctx)) {
                return;
            }
            if (event.problems) {
                event.problems.forEach(problem => {
                    const existingMarkers = this.problemManager.findMarkers({ owner: problem.description.owner });
                    const uris = new Set<string>();
                    existingMarkers.forEach(marker => uris.add(marker.uri));
                    if (ProblemMatchData.is(problem) && problem.resource) {
                        const uri = new URI(problem.resource.path).withScheme(problem.resource.scheme);
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
                    } else { // should have received an event for finding the "background task begins" pattern
                        uris.forEach(uriString => this.problemManager.setMarkers(new URI(uriString), problem.description.owner, []));
                    }
                });
            }
        });

        // notify user that task has finished
        this.taskWatcher.onTaskExit((event: TaskExitedEvent) => {
            if (!this.isEventForThisClient(event.ctx)) {
                return;
            }

            const taskConfiguration = event.config;
            if (this.isCustomFeedbackProvided(taskConfiguration)) {
                return;
            }

            let taskIdentifier = event.taskId.toString();
            if (taskConfiguration) {
                taskIdentifier = !!this.taskDefinitionRegistry.getDefinition(taskConfiguration)
                    ? `${taskConfiguration._source}: ${taskConfiguration.label}`
                    : `${taskConfiguration.type}: ${taskConfiguration.label}`;
            }

            if (event.code !== undefined) {
                const message = `Task ${taskIdentifier} has exited with code ${event.code}.`;
                if (event.code === 0) {
                    this.messageService.info(message);
                } else {
                    console.error('Invalid TaskExitedEvent received, neither code nor signal is set.');
                }
            }
        });
    }

    protected isCustomFeedbackProvided(taskConfiguration: TaskConfiguration | undefined): boolean {
        if (taskConfiguration) {
            const provider = this.taskProviderRegistry.getProvider(taskConfiguration.source);
            return provider !== undefined && provider.attach !== undefined;
        }
        return false;
    }

    /** Returns an array of the task configurations configured in tasks.json and provided by the extensions. */
    async getTasks(): Promise<TaskConfiguration[]> {
        const configuredTasks = await this.getConfiguredTasks();
        const providedTasks = await this.getProvidedTasks();
        const notCustomizedProvidedTasks = providedTasks.filter(provided =>
            !configuredTasks.some(configured => ContributedTaskConfiguration.equals(configured, provided))
        );
        return [...configuredTasks, ...notCustomizedProvidedTasks];
    }

    /** Returns an array of the task configurations which are configured in tasks.json files */
    getConfiguredTasks(): Promise<TaskConfiguration[]> {
        return this.taskConfigurations.getTasks();
    }

    /** Returns an array of the task configurations which are provided by the extensions. */
    getProvidedTasks(): Promise<TaskConfiguration[]> {
        return this.providedTaskConfigurations.getTasks();
    }

    addRecentTasks(tasks: TaskConfiguration | TaskConfiguration[]): void {
        if (Array.isArray(tasks)) {
            tasks.forEach(task => this.addRecentTasks(task));
        } else {
            const ind = this.cachedRecentTasks.findIndex(recent => TaskConfiguration.equals(recent, tasks));
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
     * Returns a task configuration provided by an extension by task source and label.
     * If there are no task configuration, returns undefined.
     */
    async getProvidedTask(source: string, label: string): Promise<TaskConfiguration | undefined> {
        return this.providedTaskConfigurations.getTask(source, label);
    }

    /** Returns an array of running tasks 'TaskInfo' objects */
    getRunningTasks(): Promise<TaskInfo[]> {
        return this.taskServer.getTasks(this.getContext());
    }

    /** Returns an array of task types that are registered, including the default types */
    getRegisteredTaskTypes(): Promise<string[]> {
        return this.taskServer.getRegisteredTaskTypes();
    }

    /**
     * Get the last executed task.
     *
     * @returns the last executed task or `undefined`.
     */
    getLastTask(): { source: string, taskLabel: string } | undefined {
        return this.lastTask;
    }

    /**
     * Runs a task, by task configuration label.
     * Note, it looks for a task configured in tasks.json only.
     */
    async runConfiguredTask(source: string, taskLabel: string): Promise<void> {
        const task = this.taskConfigurations.getTask(source, taskLabel);
        if (!task) {
            this.logger.error(`Can't get task launch configuration for label: ${taskLabel}`);
            return;
        }

        this.run(source, taskLabel);
    }

    /**
     * Run the last executed task.
     */
    async runLastTask(): Promise<void> {
        if (!this.lastTask) {
            return;
        }
        const { source, taskLabel } = this.lastTask;
        return this.run(source, taskLabel);
    }

    /**
     * Runs a task, by the source and label of the task configuration.
     * It looks for configured and detected tasks.
     */
    async run(source: string, taskLabel: string): Promise<void> {
        let task = await this.getProvidedTask(source, taskLabel);
        const customizationObject: TaskCustomization = { type: '' };
        if (!task) { // if a detected task cannot be found, search from tasks.json
            task = this.taskConfigurations.getTask(source, taskLabel);
            if (!task) {
                this.logger.error(`Can't get task launch configuration for label: ${taskLabel}`);
                return;
            } else if (task.problemMatcher) {
                Object.assign(customizationObject, {
                    type: task.type,
                    problemMatcher: task.problemMatcher
                });
            }
        } else { // if a detected task is found, check if it is customized in tasks.json
            const customizationFound = this.taskConfigurations.getCustomizationForTask(task);
            if (customizationFound) {
                Object.assign(customizationObject, customizationFound);
            }
        }
        await this.problemMatcherRegistry.onReady();
        const notResolvedMatchers = customizationObject.problemMatcher ?
            (Array.isArray(customizationObject.problemMatcher) ? customizationObject.problemMatcher : [customizationObject.problemMatcher]) : [];
        const resolvedMatchers: ProblemMatcher[] = [];
        // resolve matchers before passing them to the server
        for (const matcher of notResolvedMatchers) {
            let resolvedMatcher: ProblemMatcher | undefined;
            if (typeof matcher === 'string') {
                resolvedMatcher = this.problemMatcherRegistry.get(matcher);
            } else {
                resolvedMatcher = await this.problemMatcherRegistry.getProblemMatcherFromContribution(matcher);
            }
            if (resolvedMatcher) {
                const scope = task._scope || task._source;
                if (resolvedMatcher.filePrefix && scope) {
                    const options = { context: new URI(scope).withScheme('file') };
                    const resolvedPrefix = await this.variableResolverService.resolve(resolvedMatcher.filePrefix, options);
                    Object.assign(resolvedMatcher, { filePrefix: resolvedPrefix });
                }
                resolvedMatchers.push(resolvedMatcher);
            }
        }
        this.runTask(task, {
            customization: { ...customizationObject, ...{ problemMatcher: resolvedMatchers } }
        });
    }

    async runTask(task: TaskConfiguration, option?: RunTaskOption): Promise<void> {
        const source = task._source;
        const taskLabel = task.label;
        if (option && option.customization) {
            const taskDefinition = this.taskDefinitionRegistry.getDefinition(task);
            if (taskDefinition) { // use the customization object to override the task config
                Object.keys(option.customization).forEach(customizedProperty => {
                    // properties used to define the task cannot be customized
                    if (customizedProperty !== 'type' && !taskDefinition.properties.all.some(pDefinition => pDefinition === customizedProperty)) {
                        task[customizedProperty] = option.customization![customizedProperty];
                    }
                });
            }
        }

        const resolver = this.taskResolverRegistry.getResolver(task.type);
        let resolvedTask: TaskConfiguration;
        try {
            resolvedTask = resolver ? await resolver.resolveTask(task) : task;
            this.addRecentTasks(task);
        } catch (error) {
            this.logger.error(`Error resolving task '${taskLabel}': ${error}`);
            this.messageService.error(`Error resolving task '${taskLabel}': ${error}`);
            return;
        }

        await this.removeProblemMarks(option);

        let taskInfo: TaskInfo;
        try {
            taskInfo = await this.taskServer.run(resolvedTask, this.getContext(), option);
            this.lastTask = { source, taskLabel };
        } catch (error) {
            const errorStr = `Error launching task '${taskLabel}': ${error.message}`;
            this.logger.error(errorStr);
            this.messageService.error(errorStr);
            return;
        }

        this.logger.debug(`Task created. Task id: ${taskInfo.taskId}`);

        // open terminal widget if the task is based on a terminal process (type: shell)
        // or attach to process output processor if a raw process (type: process)
        if (taskInfo.terminalId !== undefined) {
            if (taskInfo.config.type === 'shell') {
                this.attach(taskInfo.terminalId, taskInfo.taskId);
            } else {
                this.attachProcess(taskInfo);
            }
        }
    }

    protected waitForConnection: Deferred<MessageConnection> | undefined;

    protected async attachProcess(taskInfo: TaskInfo): Promise<void> {
        const { processId, config } = taskInfo;
        const { source } = config;

        const provider = this.taskProviderRegistry.getProvider(source);
        if (provider && provider.attach) {
            const waitForConnection = this.waitForConnection = new Deferred<MessageConnection>();

            const doKill = async () => {
                const connection = await waitForConnection.promise;
                connection.sendRequest('kill');
            };

            const lineProcessor = await provider.attach(taskInfo, doKill);

            this.webSocketConnectionProvider.listen({
                path: `${tasksPath}/${processId}`,
                onConnection: connection => {
                    connection.onNotification('onLine', (data: string) => lineProcessor.processLine(data));
                    connection.onNotification('onStart', () => lineProcessor.notifyStart(taskInfo.taskId, taskInfo.config));
                    connection.onNotification('onExit', (event: IProcessExitEvent) => lineProcessor.notifyExit(
                        {
                            taskId: taskInfo.taskId,
                            config: taskInfo.config,
                            ctx: taskInfo.ctx,
                            ...event
                        }
                    ));
                    connection.onDispose(() => lineProcessor.close());

                    this.toDispose.push(connection);
                    connection.listen();
                    if (waitForConnection) {
                        waitForConnection.resolve(connection);
                    }
                }
            }, { reconnecting: false });
        } else {
            this.logger.error(`TaskProvider implementation missing for ${source}.`);
        }
    }

    private async removeProblemMarks(option?: RunTaskOption): Promise<void> {
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
        let terminal = this.terminalService.currentTerminal;
        if (!terminal) {
            terminal = <TerminalWidget>await this.terminalService.newTerminal(<TerminalWidgetFactoryOptions>{ created: new Date().toString() });
            await terminal.start();
            this.terminalService.activateTerminal(terminal);
        }
        terminal.sendText(selectedText);
    }

    async attach(terminalId: number, taskId: number): Promise<void> {
        // Get the list of all available running tasks.
        const runningTasks: TaskInfo[] = await this.getRunningTasks();
        // Get the corresponding task information based on task id if available.
        const taskInfo: TaskInfo | undefined = runningTasks.find((t: TaskInfo) => t.taskId === taskId);
        // Create terminal widget to display an execution output of a task that was launched as a command inside a shell.
        const widget = <TerminalWidget>await this.widgetManager.getOrCreateWidget(
            TERMINAL_WIDGET_FACTORY_ID,
            <TerminalWidgetFactoryOptions>{
                created: new Date().toString(),
                id: 'terminal-' + terminalId,
                title: taskInfo
                    ? `Task: ${taskInfo.config.label}`
                    : `Task: #${taskId}`,
                destroyTermOnClose: true
            }
        );
        this.shell.addWidget(widget, { area: 'bottom' });
        this.shell.activateWidget(widget.id);
        widget.start(terminalId);
    }

    async configure(task: TaskConfiguration): Promise<void> {
        await this.taskConfigurations.configure(task);
    }

    protected isEventForThisClient(context: string | undefined): boolean {
        if (context === this.getContext()) {
            return true;
        }
        return false;
    }

    taskConfigurationChanged(event: string[]) {
        // do nothing for now
    }

    protected getContext(): string | undefined {
        return this.workspaceService.workspace && this.workspaceService.workspace.uri;
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
}
