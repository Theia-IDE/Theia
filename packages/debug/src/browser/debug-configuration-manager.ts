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

/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import debounce = require('p-debounce');
import { visit } from 'jsonc-parser';
import { inject, injectable, postConstruct } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { Emitter, Event, WaitUntilEvent } from '@theia/core/lib/common/event';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { PreferenceService, StorageService, LabelProvider } from '@theia/core/lib/browser';
import { QuickPickService } from '@theia/core/lib/common/quick-pick-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { DebugConfigurationModel } from './debug-configuration-model';
import { DebugSessionOptions } from './debug-session-options';
import { DebugService } from '../common/debug-service';
import { ContextKey, ContextKeyService } from '@theia/core/lib/browser/context-key-service';
import { DebugConfiguration } from '../common/debug-common';
import { WorkspaceVariableContribution } from '@theia/workspace/lib/browser/workspace-variable-contribution';
import { FileSystem, FileSystemError } from '@theia/filesystem/lib/common';
import { PreferenceConfigurations } from '@theia/core/lib/browser/preferences/preference-configurations';
import { PreferenceScope } from '@theia/core/lib/browser/preferences/preference-service';

export interface WillProvideDebugConfiguration extends WaitUntilEvent {
}

@injectable()
export class DebugConfigurationManager {

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;
    @inject(EditorManager)
    protected readonly editorManager: EditorManager;
    @inject(DebugService)
    protected readonly debug: DebugService;
    @inject(QuickPickService)
    protected readonly quickPick: QuickPickService;

    @inject(ContextKeyService)
    protected readonly contextKeyService: ContextKeyService;

    @inject(FileSystem)
    protected readonly filesystem: FileSystem;

    @inject(PreferenceService)
    protected readonly preferences: PreferenceService;

    @inject(PreferenceConfigurations)
    protected readonly preferenceConfigurations: PreferenceConfigurations;

    @inject(WorkspaceVariableContribution)
    protected readonly workspaceVariables: WorkspaceVariableContribution;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    protected readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;

    protected readonly onWillProvideDebugConfigurationEmitter = new Emitter<WillProvideDebugConfiguration>();
    readonly onWillProvideDebugConfiguration: Event<WillProvideDebugConfiguration> = this.onWillProvideDebugConfigurationEmitter.event;

    protected debugConfigurationTypeKey: ContextKey<string>;

    protected initialized: Promise<void>;
    @postConstruct()
    protected async init(): Promise<void> {
        this.debugConfigurationTypeKey = this.contextKeyService.createKey<string>('debugConfigurationType', undefined);
        this.initialized = this.updateModels();
        this.preferences.onPreferenceChanged(e => {
            if (e.preferenceName === 'launch') {
                this.updateModels();
            }
        });
    }

    protected readonly models = new Map<string, DebugConfigurationModel>();
    protected updateModels = debounce(async () => {
        const roots = await this.workspaceService.roots;
        const toDelete = new Set(this.models.keys());
        for (const rootStat of roots) {
            const key = rootStat.uri;
            toDelete.delete(key);
            if (!this.models.has(key)) {
                const model = new DebugConfigurationModel(key, this.preferences);
                model.onDidChange(() => this.updateCurrent());
                model.onDispose(() => this.models.delete(key));
                this.models.set(key, model);
            }
        }
        for (const uri of toDelete) {
            const model = this.models.get(uri);
            if (model) {
                model.dispose();
            }
        }
        this.updateCurrent();
    }, 500);

    get all(): IterableIterator<DebugSessionOptions> {
        return this.getAll();
    }
    protected *getAll(): IterableIterator<DebugSessionOptions> {
        for (const model of this.models.values()) {
            for (const configuration of model.configurations) {
                yield {
                    configuration,
                    workspaceFolderUri: model.workspaceFolderUri
                };
            }
        }
    }

    get supported(): Promise<IterableIterator<DebugSessionOptions>> {
        return this.getSupported();
    }
    protected async getSupported(): Promise<IterableIterator<DebugSessionOptions>> {
        await this.initialized;
        const debugTypes = await this.debug.debugTypes();
        return this.doGetSupported(new Set(debugTypes));
    }
    protected *doGetSupported(debugTypes: Set<string>): IterableIterator<DebugSessionOptions> {
        for (const options of this.getAll()) {
            if (debugTypes.has(options.configuration.type)) {
                yield options;
            }
        }
    }

    protected _currentOptions: DebugSessionOptions | undefined;
    get current(): DebugSessionOptions | undefined {
        return this._currentOptions;
    }
    set current(option: DebugSessionOptions | undefined) {
        this.updateCurrent(option);
    }
    protected updateCurrent(options: DebugSessionOptions | undefined = this._currentOptions): void {
        this._currentOptions = options
            && this.find(options.configuration.name, options.workspaceFolderUri);
        if (!this._currentOptions) {
            const { model } = this;
            if (model) {
                const configuration = model.configurations[0];
                if (configuration) {
                    this._currentOptions = {
                        configuration,
                        workspaceFolderUri: model.workspaceFolderUri
                    };
                }
            }
        }
        this.debugConfigurationTypeKey.set(this.current && this.current.configuration.type);
        this.onDidChangeEmitter.fire(undefined);
    }
    find(name: string, workspaceFolderUri: string | undefined): DebugSessionOptions | undefined {
        for (const model of this.models.values()) {
            if (model.workspaceFolderUri === workspaceFolderUri) {
                for (const configuration of model.configurations) {
                    if (configuration.name === name) {
                        return {
                            configuration,
                            workspaceFolderUri
                        };
                    }
                }
            }
        }
        return undefined;
    }

    async openConfiguration(): Promise<void> {
        const { model } = this;
        if (model) {
            await this.doOpen(model);
        }
    }
    async addConfiguration(): Promise<void> {
        const thismodel = this.model;
        if (thismodel) {
            console.log(thismodel);
        }
        let model: DebugConfigurationModel | undefined;
        if (this.models.size > 1) {
            model = await this.quickPick.show((await this.workspaceService.roots).map(rootFileStat => {
                const modelValue = this.models.get(rootFileStat.uri);
                const rootUri = new URI(rootFileStat.uri);
                return {
                    label: this.labelProvider.getName(rootUri),
                    description: this.labelProvider.getLongName(rootUri),
                    value: modelValue
                };
            }), {
                placeholder: 'Select the workspace folder to add the configuration to'
            });
        } else {
            model = this.model;
        }
        if (!model) {
            return;
        }
        const widget = await this.doOpen(model);
        if (!(widget.editor instanceof MonacoEditor)) {
            return;
        }
        const editor = widget.editor.getControl();
        const { commandService } = widget.editor;
        let position: monaco.Position | undefined;
        let depthInArray = 0;
        let lastProperty = '';
        visit(editor.getValue(), {
            onObjectProperty: property => {
                lastProperty = property;
            },
            onArrayBegin: offset => {
                if (lastProperty === 'configurations' && depthInArray === 0) {
                    position = editor.getModel()!.getPositionAt(offset + 1);
                }
                depthInArray++;
            },
            onArrayEnd: () => {
                depthInArray--;
            }
        });
        if (!position) {
            return;
        }
        // Check if there are more characters on a line after a "configurations": [, if yes enter a newline
        if (editor.getModel()!.getLineLastNonWhitespaceColumn(position.lineNumber) > position.column) {
            editor.setPosition(position);
            editor.trigger('debug', 'lineBreakInsert', undefined);
        }
        // Check if there is already an empty line to insert suggest, if yes just place the cursor
        if (editor.getModel()!.getLineLastNonWhitespaceColumn(position.lineNumber + 1) === 0) {
            editor.setPosition({ lineNumber: position.lineNumber + 1, column: 1 << 30 });
            await commandService.executeCommand('editor.action.deleteLines');
        }
        editor.setPosition(position);
        await commandService.executeCommand('editor.action.insertLineAfter');
        await commandService.executeCommand('editor.action.triggerSuggest');
    }

    protected get model(): DebugConfigurationModel | undefined {
        const workspaceFolderUri = this.workspaceVariables.getWorkspaceRootUri();
        if (workspaceFolderUri) {
            const key = workspaceFolderUri.toString();
            for (const model of this.models.values()) {
                if (model.workspaceFolderUri === key) {
                    return model;
                }
            }
        }
        for (const model of this.models.values()) {
            if (model.uri) {
                return model;
            }
        }
        return this.models.values().next().value;
    }

    protected async doOpen(model: DebugConfigurationModel): Promise<EditorWidget> {
        let uri = model.uri;
        const configFileUri = await this.getFolderConfigurationUri(model);
        if (!await this.filesystem.exists(configFileUri.toString())) {
            uri = await this.doCreate(model);
        }
        return this.editorManager.open(uri!, {
            mode: 'activate'
        });
    }
    protected async doCreate(model: DebugConfigurationModel): Promise<URI> {
        // create dummy launch.json in the correct place
        if (this.workspaceService.isMultiRootWorkspaceOpened) {
            await this.preferences.set('launch', {}, PreferenceScope.Folder, model.workspaceFolderUri.toString());
        } else {
            await this.preferences.set('launch', {});
        }
        const { configUri } = this.preferences.resolve('launch'); // get uri to write content to it
        let uri: URI;
        if (configUri && configUri.path.base === 'launch.json') {
            uri = configUri;
        } else { // fallback
            uri = await this.getFolderConfigurationUri(model);
        }
        const debugType = await this.selectDebugType();
        const configurations = debugType ? await this.provideDebugConfigurations(debugType, model.workspaceFolderUri) : [];
        const content = this.getInitialConfigurationContent(configurations);
        const fileStat = await this.filesystem.getFileStat(uri.toString());
        if (!fileStat) {
            throw new Error(`file not found: ${uri.toString()}`);
        }
        try {
            await this.filesystem.setContent(fileStat, content);
        } catch (e) {
            if (!FileSystemError.FileExists.is(e)) {
                throw e;
            }
        }
        return uri;
    }

    private async getFolderConfigurationUri(model: DebugConfigurationModel): Promise<URI> {
        const paths = this.preferenceConfigurations.getPaths();
        for (const configPath of paths) {
            const configUri = new URI(model.workspaceFolderUri).resolve(`${configPath}/launch.json`);
            if (await this.filesystem.exists(configUri.toString())) {
                return configUri;
            }
        }
        return new URI(model.workspaceFolderUri).resolve(`${paths[0]}/launch.json`);
    }

    protected async provideDebugConfigurations(debugType: string, workspaceFolderUri: string | undefined): Promise<DebugConfiguration[]> {
        await this.fireWillProvideDebugConfiguration();
        return this.debug.provideDebugConfigurations(debugType, workspaceFolderUri);
    }
    protected async fireWillProvideDebugConfiguration(): Promise<void> {
        await WaitUntilEvent.fire(this.onWillProvideDebugConfigurationEmitter, {});
    }

    protected getInitialConfigurationContent(initialConfigurations: DebugConfiguration[]): string {
        return `{
  // Use IntelliSense to learn about possible attributes.
  // Hover to view descriptions of existing attributes.
  "version": "0.2.0",
  "configurations": ${JSON.stringify(initialConfigurations, undefined, '  ').split('\n').map(line => '  ' + line).join('\n').trim()}
}
`;
    }

    protected async selectDebugType(): Promise<string | undefined> {
        const widget = this.editorManager.currentEditor;
        if (!widget) {
            return undefined;
        }
        const { languageId } = widget.editor.document;
        const debuggers = await this.debug.getDebuggersForLanguage(languageId);
        return this.quickPick.show(debuggers.map(
            ({ label, type }) => ({ label, value: type }),
            { placeholder: 'Select Environment' })
        );
    }

    @inject(StorageService)
    protected readonly storage: StorageService;

    async load(): Promise<void> {
        await this.initialized;
        const data = await this.storage.getData<DebugConfigurationManager.Data>('debug.configurations', {});
        if (data.current) {
            this.current = this.find(data.current.name, data.current.workspaceFolderUri);
        }
    }

    save(): void {
        const data: DebugConfigurationManager.Data = {};
        const { current } = this;
        if (current) {
            data.current = {
                name: current.configuration.name,
                workspaceFolderUri: current.workspaceFolderUri
            };
        }
        this.storage.setData('debug.configurations', data);
    }

}
export namespace DebugConfigurationManager {
    export interface Data {
        current?: {
            name: string
            workspaceFolderUri?: string
        }
    }
}
