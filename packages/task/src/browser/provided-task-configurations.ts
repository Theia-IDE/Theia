/********************************************************************************
 * Copyright (C) 2019 Ericsson and others.
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
import { TaskProviderRegistry } from './task-contribution';
import { TaskDefinitionRegistry } from './task-definition-registry';
import { TaskConfiguration, TaskCustomization, TaskOutputPresentation, TaskConfigurationScope, KeyedTaskIdentifier } from '../common';

@injectable()
export class ProvidedTaskConfigurations {

    /**
     * Map of source (name of extension, or path of root folder that the task config comes from) and `task config map`.
     * For the second level of inner map, the key is task label.
     * For the third level of inner map, the key is the task scope and value TaskConfiguration.
     */
    protected tasksMap = new Map<string, Map<string, Map<string | undefined, TaskConfiguration>>>();

    @inject(TaskProviderRegistry)
    protected readonly taskProviderRegistry: TaskProviderRegistry;

    @inject(TaskDefinitionRegistry)
    protected readonly taskDefinitionRegistry: TaskDefinitionRegistry;

    /** returns a list of provided tasks */
    async getTasks(): Promise<TaskConfiguration[]> {
        const providers = await this.taskProviderRegistry.getProviders();
        const providedTasks: TaskConfiguration[] = (await Promise.all(providers.map(p => p.provideTasks())))
            .reduce((acc, taskArray) => acc.concat(taskArray), [])
            .map(providedTask => {
                const originalPresentation = providedTask.presentation || {};
                return {
                    ...providedTask,
                    presentation: {
                        ...TaskOutputPresentation.getDefault(),
                        ...originalPresentation
                    }
                };
            });
        this.cacheTasks(providedTasks);
        return providedTasks;
    }

    /** returns the task configuration for a given source and label or undefined if none */
    async getTask(source: string, taskLabel: string, scope: TaskConfigurationScope): Promise<TaskConfiguration | undefined> {
        const task = this.getCachedTask(source, taskLabel, scope);
        if (task) {
            return task;
        } else {
            await this.getTasks();
            return this.getCachedTask(source, taskLabel, scope);
        }
    }

    /** returns the task configuration for a given id or undefined if none */
    async getTaskById(id: KeyedTaskIdentifier): Promise<TaskConfiguration | undefined> {
        const task = this.getCachedTaskById(id);
        if (task) {
            return task;
        } else {
            await this.getTasks();
            return this.getCachedTaskById(id);
        }
    }

    /**
     * Finds the detected task for the given task customization.
     * The detected task is considered as a "match" to the task customization if it has all the `required` properties.
     * In case that more than one customization is found, return the one that has the biggest number of matched properties.
     *
     * @param customization the task customization
     * @return the detected task for the given task customization. If the task customization is not found, `undefined` is returned.
     */
    async getTaskToCustomize(customization: TaskCustomization, scope: TaskConfigurationScope): Promise<TaskConfiguration | undefined> {
        const definition = this.taskDefinitionRegistry.getDefinition(customization);
        if (!definition) {
            return undefined;
        }

        const matchedTasks: TaskConfiguration[] = [];
        let highest = -1;
        const tasks = await this.getTasks();
        for (const task of tasks) { // find detected tasks that match the `definition`
            let score = 0;
            if (!definition.properties.required.every(requiredProp => customization[requiredProp] !== undefined)) {
                continue;
            }
            score += definition.properties.required.length; // number of required properties
            const requiredProps = new Set(definition.properties.required);
            // number of optional properties
            score += definition.properties.all.filter(p => !requiredProps.has(p) && customization[p] !== undefined).length;
            if (score >= highest) {
                if (score > highest) {
                    highest = score;
                    matchedTasks.length = 0;
                }
                matchedTasks.push(task);
            }
        }

        // find the task that matches the `customization`.
        // The scenario where more than one match is found should not happen unless users manually enter multiple customizations for one type of task
        // If this does happen, return the first match
        const matchedTask = matchedTasks.filter(t =>
            scope === t._scope && definition.properties.all.every(p => t[p] === customization[p])
        )[0];
        return matchedTask;
    }

    protected getCachedTask(source: string, taskLabel: string, scope?: TaskConfigurationScope): TaskConfiguration | undefined {
        const labelConfigMap = this.tasksMap.get(source);
        if (labelConfigMap) {
            const scopeConfigMap = labelConfigMap.get(taskLabel);
            if (scopeConfigMap) {
                if (scope) {
                    return scopeConfigMap.get(scope.toString());
                }
                return Array.from(scopeConfigMap.values())[0];
            }
        }
    }

    protected getCachedTaskById(id: KeyedTaskIdentifier): TaskConfiguration | undefined {
        for (const labelConfigMap of this.tasksMap.values()) {
            for (const scopeConfigMap of labelConfigMap.values()) {
                for (const taskConfig of scopeConfigMap.values()) {
                    if (taskConfig.id._key === id._key) {
                        return taskConfig;
                    }
                }
            }
        }
    }

    protected cacheTasks(tasks: TaskConfiguration[]): void {
        for (const task of tasks) {
            const label = task.label;
            const source = task._source;
            const scope = task._scope;
            if (this.tasksMap.has(source)) {
                const labelConfigMap = this.tasksMap.get(source)!;
                if (labelConfigMap.has(label)) {
                    labelConfigMap.get(label)!.set(scope.toString(), task);
                } else {
                    const newScopeConfigMap = new Map<undefined | string, TaskConfiguration>();
                    newScopeConfigMap.set(scope.toString(), task);
                    labelConfigMap.set(label, newScopeConfigMap);
                }
            } else {
                const newLabelConfigMap = new Map<string, Map<undefined | string, TaskConfiguration>>();
                const newScopeConfigMap = new Map<undefined | string, TaskConfiguration>();
                newScopeConfigMap.set(scope.toString(), task);
                newLabelConfigMap.set(label, newScopeConfigMap);
                this.tasksMap.set(source, newLabelConfigMap);
            }
        }
    }
}
