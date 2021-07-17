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

import { JsonRpcServer } from '@theia/core/lib/common/messaging/proxy-factory';
import { IJSONSchema } from '@theia/core/lib/common/json-schema';
import { ProblemMatcher, ProblemMatch, WatchingPattern } from './problem-matcher-protocol';

export const taskPath = '/services/task';

export const TaskServer = Symbol('TaskServer');
export const TaskClient = Symbol('TaskClient');
export enum DependsOrder {
    Sequence = 'sequence',
    Parallel = 'parallel',
}

export enum RevealKind {
    Always = 'always',
    Silent = 'silent',
    Never = 'never'
}

export enum PanelKind {
    Shared = 'shared',
    Dedicated = 'dedicated',
    New = 'new'
}

export interface TaskOutputPresentation {
    echo?: boolean;
    focus?: boolean;
    reveal?: RevealKind;
    panel?: PanelKind;
    showReuseMessage?: boolean;
    clear?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [name: string]: any;
}
export namespace TaskOutputPresentation {
    export function getDefault(): TaskOutputPresentation {
        return {
            echo: true,
            reveal: RevealKind.Always,
            focus: false,
            panel: PanelKind.Shared,
            showReuseMessage: true,
            clear: false
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function fromJson(task: any): TaskOutputPresentation {
        let outputPresentation = getDefault();
        if (task && task.presentation) {
            if (task.presentation.reveal) {
                let reveal = RevealKind.Always;
                if (task.presentation.reveal === 'silent') {
                    reveal = RevealKind.Silent;
                } else if (task.presentation.reveal === 'never') {
                    reveal = RevealKind.Never;
                }
                outputPresentation = { ...outputPresentation, reveal };
            }
            if (task.presentation.panel) {
                let panel = PanelKind.Shared;
                if (task.presentation.panel === 'dedicated') {
                    panel = PanelKind.Dedicated;
                } else if (task.presentation.panel === 'new') {
                    panel = PanelKind.New;
                }
                outputPresentation = { ...outputPresentation, panel };
            }
            outputPresentation = {
                ...outputPresentation,
                echo: task.presentation.echo === undefined || task.presentation.echo,
                focus: shouldSetFocusToTerminal(task),
                showReuseMessage: shouldShowReuseMessage(task),
                clear: shouldClearTerminalBeforeRun(task)
            };
        }
        return outputPresentation;
    }

    export function shouldAlwaysRevealTerminal(task: TaskCustomization): boolean {
        return !task.presentation || task.presentation.reveal === undefined || task.presentation.reveal === RevealKind.Always;
    }

    export function shouldSetFocusToTerminal(task: TaskCustomization): boolean {
        return !!task.presentation && !!task.presentation.focus;
    }

    export function shouldClearTerminalBeforeRun(task: TaskCustomization): boolean {
        return !!task.presentation && !!task.presentation.clear;
    }

    export function shouldShowReuseMessage(task: TaskCustomization): boolean {
        return !task.presentation || task.presentation.showReuseMessage === undefined || !!task.presentation.showReuseMessage;
    }
}

export interface TaskCustomization {
    type: string;
    group?: 'build' | 'test' | 'none' | { kind: 'build' | 'test', isDefault: true };
    problemMatcher?: string | ProblemMatcherContribution | (string | ProblemMatcherContribution)[];
    presentation?: TaskOutputPresentation;
    detail?: string;

    /** Whether the task is a background task or not. */
    isBackground?: boolean;

    /** The other tasks the task depend on. */
    dependsOn?: string | TaskIdentifier | Array<string | TaskIdentifier>;

    /** The order the dependsOn tasks should be executed in. */
    dependsOrder?: DependsOrder;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [name: string]: any;
}
export namespace TaskCustomization {
    export function isBuildTask(task: TaskCustomization): boolean {
        return task.group === 'build' || !!task.group && typeof task.group === 'object' && task.group.kind === 'build';
    }

    export function isDefaultBuildTask(task: TaskCustomization): boolean {
        return !!task.group && typeof task.group === 'object' && task.group.kind === 'build' && task.group.isDefault;
    }

    export function isTestTask(task: TaskCustomization): boolean {
        return task.group === 'test' || !!task.group && typeof task.group === 'object' && task.group.kind === 'test';
    }

    export function isDefaultTestTask(task: TaskCustomization): boolean {
        return !!task.group && typeof task.group === 'object' && task.group.kind === 'test' && task.group.isDefault;
    }
}

export enum TaskScope {
    Global = 1,
    Workspace = 2
}

/**
 * The task configuration scopes.
 * - `string` represents the associated workspace folder uri.
 */
export type TaskConfigurationScope = string | TaskScope.Workspace | TaskScope.Global;

export interface TaskConfiguration extends TaskCustomization {
    /** A label that uniquely identifies a task configuration per source */
    readonly label: string;
    readonly _scope: TaskConfigurationScope;
}

export interface ContributedTaskConfiguration extends TaskConfiguration {
    /**
     * Source of the task configuration.
     * For a configured task, it is the name of the root folder, while for a provided task, it is the name of the provider.
     * This field is not supposed to be used in `tasks.json`
     */
    readonly _source: string;
}

/** A task identifier */
export interface TaskIdentifier {
    type: string;
    [name: string]: string;
}

/** Runtime information about Task. */
export interface TaskInfo {
    /** internal unique task id */
    readonly taskId: number,
    /** terminal id. Defined if task is run as a terminal process */
    readonly terminalId?: number,
    /** context that was passed as part of task creation, if any */
    readonly ctx?: string,
    /** task config used for launching a task */
    readonly config: TaskConfiguration,
    /** Additional properties specific for a particular Task Runner. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly [key: string]: any;
}

export interface TaskServer extends JsonRpcServer<TaskClient> {
    /** Run a task. Optionally pass a context.  */
    run(task: TaskConfiguration, ctx?: string, option?: RunTaskOption): Promise<TaskInfo>;
    /** Kill a task, by id. */
    kill(taskId: number): Promise<void>;
    /**
     * Returns a list of currently running tasks. If a context is provided,
     * only the tasks started in that context will be provided. Using an
     * undefined context matches all tasks, no matter the creation context.
     */
    getTasks(ctx?: string): Promise<TaskInfo[]>

    /** removes the client that has disconnected */
    disconnectClient(client: TaskClient): void;

    /** Returns the list of default and registered task runners */
    getRegisteredTaskTypes(): Promise<string[]>

    /** plugin callback task complete */
    customExecutionComplete(id: number, exitCode: number | undefined): Promise<void>
}

export interface TaskCustomizationData {
    type: string;
    problemMatcher?: ProblemMatcher[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [name: string]: any;
}

export interface RunTaskOption {
    customization?: TaskCustomizationData;
}

/** Event sent when a task has concluded its execution */
export interface TaskExitedEvent {
    readonly taskId: number;
    readonly ctx?: string;

    // Exactly one of code and signal will be set.
    readonly code?: number;
    readonly signal?: string;

    readonly config: TaskConfiguration;

    readonly terminalId?: number;
    readonly processId?: number;
}

export interface TaskOutputEvent {
    readonly taskId: number;
    readonly ctx?: string;
    readonly line: string;
}

export interface TaskOutputProcessedEvent {
    readonly taskId: number;
    readonly config: TaskConfiguration;
    readonly ctx?: string;
    readonly problems?: ProblemMatch[];
}

export interface BackgroundTaskEndedEvent {
    readonly taskId: number;
    readonly ctx?: string;
}

export interface TaskClient {
    onTaskExit(event: TaskExitedEvent): void;
    onTaskCreated(event: TaskInfo): void;
    onDidStartTaskProcess(event: TaskInfo): void;
    onDidEndTaskProcess(event: TaskExitedEvent): void;
    onDidProcessTaskOutput(event: TaskOutputProcessedEvent): void;
    onBackgroundTaskEnded(event: BackgroundTaskEndedEvent): void;
}

export interface TaskDefinition {
    taskType: string;
    source: string;
    properties: {
        required: string[];
        all: string[];
        schema: IJSONSchema;
    }
}

export interface WatchingMatcherContribution {
    // If set to true the background monitor is in active mode when the task starts.
    // This is equals of issuing a line that matches the beginPattern
    activeOnStart?: boolean;
    beginsPattern: string | WatchingPattern;
    endsPattern: string | WatchingPattern;
}

export interface ProblemMatcherContribution {
    base?: string;
    name?: string;
    label: string;
    deprecated?: boolean;

    owner: string;
    source?: string;
    applyTo?: string;
    fileLocation?: 'absolute' | 'relative' | string[];
    pattern: string | ProblemPatternContribution | ProblemPatternContribution[];
    severity?: string;
    watching?: WatchingMatcherContribution; // deprecated. Use `background`.
    background?: WatchingMatcherContribution;
}

export interface ProblemPatternContribution {
    name?: string;
    regexp: string;

    kind?: string;
    file?: number;
    message?: number;
    location?: number;
    line?: number;
    character?: number;
    column?: number;
    endLine?: number;
    endCharacter?: number;
    endColumn?: number;
    code?: number;
    severity?: number;
    loop?: boolean;
}
