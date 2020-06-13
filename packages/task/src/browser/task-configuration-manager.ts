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

import debounce = require('p-debounce');
import { inject, injectable, postConstruct, named } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { PreferenceScope, PreferenceProvider } from '@theia/core/lib/browser';
import { QuickPickService } from '@theia/core/lib/common/quick-pick-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { TaskConfigurationModel } from './task-configuration-model';
import { TaskTemplateSelector } from './task-templates';
import { TaskCustomization, TaskConfiguration, TaskConfigurationScope, TaskScope, CustomizedTaskTemplate } from '../common/task-protocol';
import { WorkspaceVariableContribution } from '@theia/workspace/lib/browser/workspace-variable-contribution';
import { FileSystem, FileSystemError } from '@theia/filesystem/lib/common';
import { FileChangeType } from '@theia/filesystem/lib/common/filesystem-watcher-protocol';
import { PreferenceConfigurations } from '@theia/core/lib/browser/preferences/preference-configurations';

export interface TasksChange {
    scope: TaskConfigurationScope;
    type: FileChangeType;
}
/**
 * This class connnects the the "tasks" preferences sections to task system: it collects tasks preference values and
 * provides them to the task system as raw, parsed JSON.
 */
@injectable()
export class TaskConfigurationManager {

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(QuickPickService)
    protected readonly quickPick: QuickPickService;

    @inject(FileSystem)
    protected readonly filesystem: FileSystem;

    @inject(PreferenceProvider) @named(PreferenceScope.Folder)
    protected readonly folderPreferences: PreferenceProvider;

    @inject(PreferenceProvider) @named(PreferenceScope.User)
    protected readonly userPreferences: PreferenceProvider;

    @inject(PreferenceConfigurations)
    protected readonly preferenceConfigurations: PreferenceConfigurations;

    @inject(WorkspaceVariableContribution)
    protected readonly workspaceVariables: WorkspaceVariableContribution;

    @inject(TaskTemplateSelector)
    protected readonly taskTemplateSelector: TaskTemplateSelector;

    protected readonly onDidChangeTaskConfigEmitter = new Emitter<TasksChange>();
    readonly onDidChangeTaskConfig: Event<TasksChange> = this.onDidChangeTaskConfigEmitter.event;

    protected readonly models = new Map<string, TaskConfigurationModel>();
    protected userModel: TaskConfigurationModel;

    @postConstruct()
    protected async init(): Promise<void> {
        this.userModel = new TaskConfigurationModel(TaskScope.Global, this.userPreferences);
        this.userModel.onDidChange(() => this.onDidChangeTaskConfigEmitter.fire({ scope: TaskScope.Global, type: FileChangeType.UPDATED }));
        this.updateModels();
        this.folderPreferences.onDidPreferencesChanged(e => {
            if (e['tasks']) {
                this.updateModels();
            }
        });
        this.workspaceService.onWorkspaceChanged(() => {
            this.updateModels();
        });
    }

    protected updateModels = debounce(async () => {
        const roots = await this.workspaceService.roots;
        const toDelete = new Set(this.models.keys());
        for (const rootStat of roots) {
            const key = rootStat.uri;
            toDelete.delete(key);
            if (!this.models.has(key)) {
                const model = new TaskConfigurationModel(key, this.folderPreferences);
                model.onDidChange(() => this.onDidChangeTaskConfigEmitter.fire({ scope: key, type: FileChangeType.UPDATED }));
                model.onDispose(() => this.models.delete(key));
                this.models.set(key, model);
                this.onDidChangeTaskConfigEmitter.fire({ scope: key, type: FileChangeType.UPDATED });
            }
        }
        for (const uri of toDelete) {
            const model = this.models.get(uri);
            if (model) {
                model.dispose();
            }
            this.onDidChangeTaskConfigEmitter.fire({ scope: uri, type: FileChangeType.DELETED });
        }
    }, 500);

    getTasks(scope: TaskConfigurationScope): (TaskCustomization | TaskConfiguration)[] {
        if (typeof scope === 'string' && this.models.has(scope)) {
            const taskPrefModel = this.models.get(scope)!;
            return taskPrefModel.configurations;
        }
        return this.userModel.configurations;
    }

    getTask(name: string, scope: TaskConfigurationScope): TaskCustomization | TaskConfiguration | undefined {
        const taskPrefModel = this.getModel(scope);
        if (taskPrefModel) {
            for (const configuration of taskPrefModel.configurations) {
                if (configuration.name === name) {
                    return configuration;
                }
            }
        }
        return this.userModel.configurations.find(configuration => configuration.name === 'name');
    }

    async openConfiguration(scope: TaskConfigurationScope): Promise<void> {
        const taskPrefModel = this.getModel(scope);
        if (taskPrefModel) {
            await this.doOpen(taskPrefModel);
        }
    }

    async addTaskConfiguration(scope: TaskConfigurationScope, taskConfig: CustomizedTaskTemplate): Promise<boolean> {
        const taskPrefModel = this.getModel(scope);
        if (taskPrefModel) {
            const configurations = taskPrefModel.configurations;
            return this.setTaskConfigurations(scope, [...configurations, taskConfig]);
        }
        return false;
    }

    async setTaskConfigurations(scope: TaskConfigurationScope, taskConfigs: CustomizedTaskTemplate[]): Promise<boolean> {
        const taskPrefModel = this.getModel(scope);
        if (taskPrefModel) {
            return taskPrefModel.setConfigurations(taskConfigs);
        }
        return false;
    }

    private getModel(scope: TaskConfigurationScope): TaskConfigurationModel | undefined {
        if (!scope) {
            return undefined;
        }
        for (const model of this.models.values()) {
            if (model.scope === scope) {
                return model;
            }
        }
        if (scope === TaskScope.Global) {
            return this.userModel;
        }
    }

    protected async doOpen(model: TaskConfigurationModel): Promise<EditorWidget | undefined> {
        let uri = model.uri;
        if (!uri) {
            uri = await this.doCreate(model);
        }
        if (uri) {
            return this.editorManager.open(uri, {
                mode: 'activate'
            });
        }
    }

    protected async doCreate(model: TaskConfigurationModel): Promise<URI | undefined> {
        const content = await this.getInitialConfigurationContent();
        if (content) {
            await this.folderPreferences.setPreference('tasks', {}, model.getWorkspaceFolder()); // create dummy tasks.json in the correct place
            const { configUri } = this.folderPreferences.resolve('tasks', model.getWorkspaceFolder()); // get uri to write content to it

            let uri: URI;
            if (configUri && configUri.path.base === 'tasks.json') {
                uri = configUri;
            } else { // fallback
                uri = new URI(model.getWorkspaceFolder()).resolve(`${this.preferenceConfigurations.getPaths()[0]}/tasks.json`);
            }

            const fileStat = await this.filesystem.getFileStat(uri.toString());
            if (!fileStat) {
                throw new Error(`file not found: ${uri.toString()}`);
            }
            try {
                this.filesystem.setContent(fileStat, content);
            } catch (e) {
                if (!FileSystemError.FileExists.is(e)) {
                    throw e;
                }
            }
            return uri;
        }
    }

    protected async getInitialConfigurationContent(): Promise<string | undefined> {
        const selected = await this.quickPick.show(this.taskTemplateSelector.selectTemplates(), {
            placeholder: 'Select a Task Template'
        });
        if (selected) {
            return selected.content;
        }
    }
}

export namespace TaskConfigurationManager {
    export interface Data {
        current?: {
            name: string
            workspaceFolderUri?: string
        }
    }
}
