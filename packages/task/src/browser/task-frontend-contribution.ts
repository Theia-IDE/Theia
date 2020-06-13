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
import { ILogger, ContributionProvider } from '@theia/core/lib/common';
import { QuickOpenTask, TaskTerminateQuickOpen, TaskRunningQuickOpen, TaskRestartRunningQuickOpen } from './quick-open-task';
import { CommandContribution, Command, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import {
    FrontendApplication, FrontendApplicationContribution, QuickOpenContribution,
    QuickOpenHandlerRegistry, KeybindingRegistry, KeybindingContribution, StorageService, StatusBar, StatusBarAlignment
} from '@theia/core/lib/browser';
import { WidgetManager } from '@theia/core/lib/browser/widget-manager';
import { TaskContribution, TaskResolverRegistry, TaskProviderRegistry } from './task-contribution';
import { TaskService } from './task-service';
import { TerminalMenus } from '@theia/terminal/lib/browser/terminal-frontend-contribution';
import { TaskSchemaUpdater } from './task-schema-updater';
import { TaskConfiguration, TaskWatcher } from '../common';
import { EditorManager } from '@theia/editor/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';

export namespace TaskCommands {
    const TASK_CATEGORY = 'Task';
    export const TASK_RUN: Command = {
        id: 'task:run',
        category: TASK_CATEGORY,
        label: 'Run Task...'
    };

    export const TASK_RUN_BUILD: Command = {
        id: 'task:run:build',
        category: TASK_CATEGORY,
        label: 'Run Build Task...'
    };

    export const TASK_RUN_TEST: Command = {
        id: 'task:run:test',
        category: TASK_CATEGORY,
        label: 'Run Test Task...'
    };

    export const WORKBENCH_RUN_TASK: Command = {
        id: 'workbench.action.tasks.runTask',
        category: TASK_CATEGORY
    };

    export const TASK_RUN_LAST: Command = {
        id: 'task:run:last',
        category: TASK_CATEGORY,
        label: 'Run Last Task'
    };

    export const TASK_ATTACH: Command = {
        id: 'task:attach',
        category: TASK_CATEGORY,
        label: 'Attach Task...'
    };

    export const TASK_RUN_TEXT: Command = {
        id: 'task:run:text',
        category: TASK_CATEGORY,
        label: 'Run Selected Text'
    };

    export const TASK_CONFIGURE: Command = {
        id: 'task:configure',
        category: TASK_CATEGORY,
        label: 'Configure Tasks...'
    };

    export const TASK_OPEN_USER: Command = {
        id: 'task:open_user',
        category: TASK_CATEGORY,
        label: 'Open User Tasks'
    };

    export const TASK_CLEAR_HISTORY: Command = {
        id: 'task:clear-history',
        category: TASK_CATEGORY,
        label: 'Clear History'
    };

    export const TASK_SHOW_RUNNING: Command = {
        id: 'task:show-running',
        category: TASK_CATEGORY,
        label: 'Show Running Tasks'
    };

    export const TASK_TERMINATE: Command = {
        id: 'task:terminate',
        category: TASK_CATEGORY,
        label: 'Terminate Task'
    };

    export const TASK_RESTART_RUNNING: Command = {
        id: 'task:restart-running',
        category: TASK_CATEGORY,
        label: 'Restart Running Task...'
    };
}

const TASKS_STORAGE_KEY = 'tasks';

@injectable()
export class TaskFrontendContribution implements CommandContribution, MenuContribution, KeybindingContribution, FrontendApplicationContribution, QuickOpenContribution {
    @inject(QuickOpenTask)
    protected readonly quickOpenTask: QuickOpenTask;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(FrontendApplication)
    protected readonly app: FrontendApplication;

    @inject(ILogger) @named('task')
    protected readonly logger: ILogger;

    @inject(WidgetManager)
    protected readonly widgetManager: WidgetManager;

    @inject(ContributionProvider) @named(TaskContribution)
    protected readonly contributionProvider: ContributionProvider<TaskContribution>;

    @inject(TaskProviderRegistry)
    protected readonly taskProviderRegistry: TaskProviderRegistry;

    @inject(TaskResolverRegistry)
    protected readonly taskResolverRegistry: TaskResolverRegistry;

    @inject(TaskService)
    protected readonly taskService: TaskService;

    @inject(TaskSchemaUpdater)
    protected readonly schemaUpdater: TaskSchemaUpdater;

    @inject(StorageService)
    protected readonly storageService: StorageService;

    @inject(TaskRunningQuickOpen)
    protected readonly taskRunningQuickOpen: TaskRunningQuickOpen;

    @inject(TaskTerminateQuickOpen)
    protected readonly taskTerminateQuickOpen: TaskTerminateQuickOpen;

    @inject(TaskRestartRunningQuickOpen)
    protected readonly taskRestartRunningQuickOpen: TaskRestartRunningQuickOpen;

    @inject(TaskWatcher)
    protected readonly taskWatcher: TaskWatcher;

    @inject(StatusBar)
    protected readonly statusBar: StatusBar;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @postConstruct()
    protected async init(): Promise<void> {
        this.taskWatcher.onTaskCreated(() => this.updateRunningTasksItem());
        this.taskWatcher.onTaskExit(() => this.updateRunningTasksItem());
    }

    onStart(): void {
        this.contributionProvider.getContributions().forEach(contrib => {
            if (contrib.registerResolvers) {
                contrib.registerResolvers(this.taskResolverRegistry);
            }
            if (contrib.registerProviders) {
                contrib.registerProviders(this.taskProviderRegistry);
            }
        });
        this.schemaUpdater.update();

        this.storageService.getData<{ recent: TaskConfiguration[] }>(TASKS_STORAGE_KEY, { recent: [] })
            .then(tasks => this.taskService.recentTasks = tasks.recent);
    }

    onStop(): void {
        const recent = this.taskService.recentTasks;
        this.storageService.setData<{ recent: TaskConfiguration[] }>(TASKS_STORAGE_KEY, { recent });
    }

    /**
     * Contribute a status-bar item to trigger
     * the `Show Running Tasks` command.
     */
    protected async updateRunningTasksItem(): Promise<void> {
        const id = 'show-running-tasks';
        const items = await this.taskService.getRunningTasks();
        if (!!items.length) {
            this.statusBar.setElement(id, {
                text: `$(tools) ${items.length}`,
                tooltip: 'Show Running Tasks',
                alignment: StatusBarAlignment.LEFT,
                priority: 2,
                command: TaskCommands.TASK_SHOW_RUNNING.id,
            });
        } else {
            this.statusBar.removeElement(id);
        }
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(
            TaskCommands.WORKBENCH_RUN_TASK,
            {
                isEnabled: () => true,
                execute: async (label: string) => {
                    const didExecute = await this.taskService.runTaskByLabel(label);
                    if (!didExecute) {
                        this.quickOpenTask.open();
                    }
                }
            }
        );

        registry.registerCommand(
            TaskCommands.TASK_RUN,
            {
                isEnabled: () => true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                execute: (...args: any[]) => {
                    const [source, label, scope] = args;
                    if (source && label) {
                        return this.taskService.run(source, label, scope);
                    }
                    return this.quickOpenTask.open();
                }
            }
        );
        registry.registerCommand(
            TaskCommands.TASK_RUN_BUILD,
            {
                isEnabled: () => this.workspaceService.opened,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                execute: (...args: any[]) =>
                    this.quickOpenTask.runBuildOrTestTask('build')
            }
        );
        registry.registerCommand(
            TaskCommands.TASK_RUN_TEST,
            {
                isEnabled: () => this.workspaceService.opened,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                execute: (...args: any[]) =>
                    this.quickOpenTask.runBuildOrTestTask('test')
            }
        );
        registry.registerCommand(
            TaskCommands.TASK_ATTACH,
            {
                isEnabled: () => true,
                execute: () => this.quickOpenTask.attach()
            }
        );
        registry.registerCommand(
            TaskCommands.TASK_RUN_LAST,
            {
                execute: async () => {
                    if (!await this.taskService.runLastTask()) {
                        await this.quickOpenTask.open();
                    }
                }
            }
        );
        registry.registerCommand(
            TaskCommands.TASK_RUN_TEXT,
            {
                isVisible: () => !!this.editorManager.currentEditor,
                isEnabled: () => !!this.editorManager.currentEditor,
                execute: () => this.taskService.runSelectedText()
            }
        );

        registry.registerCommand(
            TaskCommands.TASK_CONFIGURE,
            {
                execute: () => this.quickOpenTask.configure()
            }
        );

        registry.registerCommand(
            TaskCommands.TASK_OPEN_USER,
            {
                execute: () => {
                    this.taskService.openUserTasks();
                }
            }
        );

        registry.registerCommand(
            TaskCommands.TASK_CLEAR_HISTORY,
            {
                execute: () => {
                    this.taskService.clearRecentTasks();
                    this.taskService.clearLastTask();
                }
            }
        );

        registry.registerCommand(
            TaskCommands.TASK_SHOW_RUNNING,
            {
                execute: () => this.taskRunningQuickOpen.open()
            }
        );

        registry.registerCommand(
            TaskCommands.TASK_TERMINATE,
            {
                execute: () => this.taskTerminateQuickOpen.open()
            }
        );

        registry.registerCommand(
            TaskCommands.TASK_RESTART_RUNNING,
            {
                execute: () => this.taskRestartRunningQuickOpen.open()
            }
        );
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(TerminalMenus.TERMINAL_TASKS, {
            commandId: TaskCommands.TASK_RUN.id,
            order: '0'
        });

        menus.registerMenuAction(TerminalMenus.TERMINAL_TASKS, {
            commandId: TaskCommands.TASK_RUN_BUILD.id,
            order: '1'
        });

        menus.registerMenuAction(TerminalMenus.TERMINAL_TASKS, {
            commandId: TaskCommands.TASK_RUN_TEST.id,
            order: '2'
        });

        menus.registerMenuAction(TerminalMenus.TERMINAL_TASKS, {
            commandId: TaskCommands.TASK_RUN_LAST.id,
            order: '3'
        });

        menus.registerMenuAction(TerminalMenus.TERMINAL_TASKS, {
            commandId: TaskCommands.TASK_ATTACH.id,
            order: '4'
        });

        menus.registerMenuAction(TerminalMenus.TERMINAL_TASKS, {
            commandId: TaskCommands.TASK_RUN_TEXT.id,
            order: '5'
        });

        menus.registerMenuAction(TerminalMenus.TERMINAL_TASKS_INFO, {
            commandId: TaskCommands.TASK_SHOW_RUNNING.id,
            label: 'Show Running Tasks...',
            order: '0'
        });

        menus.registerMenuAction(TerminalMenus.TERMINAL_TASKS_INFO, {
            commandId: TaskCommands.TASK_RESTART_RUNNING.id,
            label: TaskCommands.TASK_RESTART_RUNNING.label,
            order: '1'
        });

        menus.registerMenuAction(TerminalMenus.TERMINAL_TASKS_INFO, {
            commandId: TaskCommands.TASK_TERMINATE.id,
            label: 'Terminate Task...',
            order: '2'
        });

        menus.registerMenuAction(TerminalMenus.TERMINAL_TASKS_CONFIG, {
            commandId: TaskCommands.TASK_CONFIGURE.id,
            order: '0'
        });
    }

    registerQuickOpenHandlers(handlers: QuickOpenHandlerRegistry): void {
        handlers.registerHandler(this.quickOpenTask);
    }

    registerKeybindings(keybindings: KeybindingRegistry): void {
        keybindings.registerKeybinding({
            command: TaskCommands.TASK_RUN_LAST.id,
            keybinding: 'ctrlcmd+shift+k',
            when: '!textInputFocus || editorReadonly'
        });
    }

}
