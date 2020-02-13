/********************************************************************************
 * Copyright (C) 2019 Red Hat, Inc. and others.
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
    MAIN_RPC_CONTEXT,
    ScmExt,
    SourceControlGroupFeatures,
    ScmMain,
    SourceControlProviderFeatures,
    SourceControlResourceState,
    PLUGIN_RPC_CONTEXT
} from '../../common/plugin-api-rpc';
import { ScmProvider, ScmResource, ScmResourceDecorations, ScmResourceGroup, ScmCommand } from '@theia/scm/lib/browser/scm-provider';
import { ScmRepository } from '@theia/scm/lib/browser/scm-repository';
import { ScmService } from '@theia/scm/lib/browser/scm-service';
import { RPCProtocol, ProxyIdentifier } from '../../common/rpc-protocol';
import { injectable, inject, postConstruct } from 'inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { CancellationToken } from '@theia/core/lib/common/cancellation';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import URI from '@theia/core/lib/common/uri';
import { ColorRegistry } from '@theia/core/lib/browser/color-registry';
import { RPCProtocolServiceProvider } from './main-context';

@injectable()
export class ScmMainImpl implements ScmMain, Disposable, RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any> = PLUGIN_RPC_CONTEXT.SCM_MAIN;

    private proxy: ScmExt;

    @inject(ScmService)
    private readonly scmService: ScmService;
    private readonly scmRepositoryMap = new Map<number, ScmRepository>();

    @inject(ColorRegistry)
    private readonly colors: ColorRegistry;

    private lastSelectedSourceControlHandle: number | undefined;

    private readonly toDispose = new DisposableCollection();

    @inject(RPCProtocol)
    private readonly rpc: RPCProtocol;

    @postConstruct()
    protected init(): void {
        this.proxy = this.rpc.getProxy(MAIN_RPC_CONTEXT.SCM_EXT);
        this.toDispose.push(this.scmService.onDidChangeSelectedRepository(repository => this.updateSelectedRepository(repository)));
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    protected updateSelectedRepository(repository: ScmRepository | undefined): void {
        const sourceControlHandle = repository ? this.getSourceControlHandle(repository) : undefined;
        if (sourceControlHandle !== undefined) {
            this.proxy.$setSourceControlSelection(sourceControlHandle, true);
        }
        if (this.lastSelectedSourceControlHandle !== undefined && this.lastSelectedSourceControlHandle !== sourceControlHandle) {
            this.proxy.$setSourceControlSelection(this.lastSelectedSourceControlHandle, false);
        }
        this.lastSelectedSourceControlHandle = sourceControlHandle;
    }

    protected getSourceControlHandle(repository: ScmRepository): number | undefined {
        return Array.from(this.scmRepositoryMap.keys()).find(key => {
            const scmRepository = this.scmRepositoryMap.get(key);
            return scmRepository !== undefined && scmRepository.provider.rootUri === repository.provider.rootUri;
        });
    }

    async $registerSourceControl(sourceControlHandle: number, id: string, label: string, rootUri: string): Promise<void> {
        const provider = new PluginScmProvider(this.proxy, sourceControlHandle, id, label, rootUri, this.colors);
        const repository = this.scmService.registerScmProvider(provider);
        repository.input.onDidChange(() =>
            this.proxy.$updateInputBox(sourceControlHandle, repository.input.value)
        );
        this.scmRepositoryMap.set(sourceControlHandle, repository);
        if (this.scmService.repositories.length === 1) {
            this.updateSelectedRepository(repository);
        }
        this.toDispose.push(Disposable.create(() => this.$unregisterSourceControl(sourceControlHandle)));
    }

    async $updateSourceControl(sourceControlHandle: number, features: SourceControlProviderFeatures): Promise<void> {
        const repository = this.scmRepositoryMap.get(sourceControlHandle);
        if (repository) {
            const provider = repository.provider as PluginScmProvider;
            provider.updateSourceControl(features);
        }
    }

    async $unregisterSourceControl(sourceControlHandle: number): Promise<void> {
        const repository = this.scmRepositoryMap.get(sourceControlHandle);
        if (repository) {
            repository.dispose();
            this.scmRepositoryMap.delete(sourceControlHandle);
        }
    }

    async $setInputBoxPlaceholder(sourceControlHandle: number, placeholder: string): Promise<void> {
        const repository = this.scmRepositoryMap.get(sourceControlHandle);
        if (repository) {
            repository.input.placeholder = placeholder;
        }
    }

    async $setInputBoxValue(sourceControlHandle: number, value: string): Promise<void> {
        const repository = this.scmRepositoryMap.get(sourceControlHandle);
        if (repository) {
            repository.input.value = value;
        }
    }

    async $registerGroup(sourceControlHandle: number, groupHandle: number, id: string, label: string): Promise<void> {
        const repository = this.scmRepositoryMap.get(sourceControlHandle);
        if (repository) {
            const provider = repository.provider as PluginScmProvider;
            provider.registerGroup(groupHandle, id, label);
        }
    }

    async $unregisterGroup(sourceControlHandle: number, groupHandle: number): Promise<void> {
        const repository = this.scmRepositoryMap.get(sourceControlHandle);
        if (repository) {
            const provider = repository.provider as PluginScmProvider;
            provider.unregisterGroup(groupHandle);
        }
    }

    async $updateGroup(sourceControlHandle: number, groupHandle: number, features: SourceControlGroupFeatures): Promise<void> {
        const repository = this.scmRepositoryMap.get(sourceControlHandle);
        if (repository) {
            const provider = repository.provider as PluginScmProvider;
            provider.updateGroup(groupHandle, features);
        }
    }

    async $updateGroupLabel(sourceControlHandle: number, groupHandle: number, label: string): Promise<void> {
        const repository = this.scmRepositoryMap.get(sourceControlHandle);
        if (repository) {
            const provider = repository.provider as PluginScmProvider;
            provider.updateGroupLabel(groupHandle, label);
        }
    }

    async $updateResourceState(sourceControlHandle: number, groupHandle: number, resources: SourceControlResourceState[]): Promise<void> {
        const repository = this.scmRepositoryMap.get(sourceControlHandle);
        if (repository) {
            const provider = repository.provider as PluginScmProvider;
            provider.updateGroupResourceStates(sourceControlHandle, groupHandle, resources);
        }
    }
}
export class PluginScmProvider implements ScmProvider {
    private onDidChangeEmitter = new Emitter<void>();
    private onDidChangeCommitTemplateEmitter = new Emitter<string>();
    private onDidChangeStatusBarCommandsEmitter = new Emitter<ScmCommand[] | undefined>();
    private features: SourceControlProviderFeatures = {};
    private groupsMap: Map<number, PluginScmResourceGroup> = new Map();
    private disposableCollection: DisposableCollection = new DisposableCollection();

    constructor(
        private readonly proxy: ScmExt,
        readonly handle: number,
        readonly id: string,
        readonly label: string,
        readonly rootUri: string,
        protected readonly colors: ColorRegistry
    ) {
        this.disposableCollection.push(this.onDidChangeEmitter);
        this.disposableCollection.push(this.onDidChangeCommitTemplateEmitter);
        this.disposableCollection.push(this.onDidChangeStatusBarCommandsEmitter);
    }

    protected fireDidChange(): void {
        this.onDidChangeEmitter.fire(undefined);
    }

    get groups(): ScmResourceGroup[] {
        return Array.from(this.groupsMap.values());
    }

    get commitTemplate(): string | undefined {
        return this.features.commitTemplate;
    }

    get acceptInputCommand(): ScmCommand | undefined {
        const command = this.features.acceptInputCommand;
        if (command) {
            const scmCommand: ScmCommand = command;
            scmCommand.command = command.id;
            return command;
        }
    }

    get statusBarCommands(): ScmCommand[] | undefined {
        const commands = this.features.statusBarCommands;
        if (commands) {
            return commands.map(command => {
                const scmCommand: ScmCommand = command;
                scmCommand.command = command.id;
                return scmCommand;
            });
        }
    }

    get count(): number | undefined {
        return this.features.count;
    }

    get onDidChangeCommitTemplate(): Event<string> {
        return this.onDidChangeCommitTemplateEmitter.event;
    }

    get onDidChangeStatusBarCommands(): Event<ScmCommand[] | undefined> {
        return this.onDidChangeStatusBarCommandsEmitter.event;
    }

    get onDidChange(): Event<void> {
        return this.onDidChangeEmitter.event;
    }

    dispose(): void {
        this.disposableCollection.dispose();
    }

    updateSourceControl(features: SourceControlProviderFeatures): void {
        if (features.acceptInputCommand) {
            this.features.acceptInputCommand = features.acceptInputCommand;
        }
        if (features.commitTemplate) {
            this.features.commitTemplate = features.commitTemplate;
        }
        if (features.count) {
            this.features.count = features.count;
        }
        if (features.hasQuickDiffProvider !== undefined) {
            this.features.hasQuickDiffProvider = features.hasQuickDiffProvider;
        }
        if (features.statusBarCommands) {
            this.features.statusBarCommands = features.statusBarCommands;
        }
        this.fireDidChange();

        if (features.commitTemplate) {
            this.onDidChangeCommitTemplateEmitter.fire(features.commitTemplate);
        }
        if (features.statusBarCommands) {
            this.onDidChangeStatusBarCommandsEmitter.fire(features.statusBarCommands);
        }
    }

    async getOriginalResource(uri: URI): Promise<URI | undefined> {
        if (this.features.hasQuickDiffProvider) {
            const result = await this.proxy.$provideOriginalResource(this.handle, uri.toString(), CancellationToken.None);
            if (result) {
                return new URI(result.path);
            }
        }
    }

    registerGroup(groupHandle: number, id: string, label: string): void {
        const group = new PluginScmResourceGroup(
            groupHandle,
            this,
            { hideWhenEmpty: undefined },
            label,
            id
        );
        this.groupsMap.set(groupHandle, group);
        this.fireDidChange();
    }

    unregisterGroup(groupHandle: number): void {
        const group = this.groupsMap.get(groupHandle);
        if (group) {
            group.dispose();
            this.groupsMap.delete(groupHandle);
            this.fireDidChange();
        }
    }

    updateGroup(groupHandle: number, features: SourceControlGroupFeatures): void {
        const group = this.groupsMap.get(groupHandle);
        if (group) {
            group.updateGroup(features);
            this.fireDidChange();
        }
    }

    updateGroupLabel(groupHandle: number, label: string): void {
        const group = this.groupsMap.get(groupHandle);
        if (group) {
            group.updateGroupLabel(label);
            this.fireDidChange();
        }
    }

    async updateGroupResourceStates(sourceControlHandle: number, groupHandle: number, resources: SourceControlResourceState[]): Promise<void> {
        const group = this.groupsMap.get(groupHandle);
        if (group) {
            group.updateResources(await Promise.all(resources.map(async resource => {
                const resourceUri = new URI(resource.resourceUri);
                let scmDecorations;
                const decorations = resource.decorations;
                if (decorations) {
                    const colorVariable = resource.colorId && this.colors.toCssVariableName(resource.colorId);
                    scmDecorations = {
                        tooltip: decorations.tooltip,
                        letter: resource.letter,
                        color: colorVariable && `var(${colorVariable})`
                    };
                }
                return new PluginScmResource(
                    this.proxy,
                    resource.handle,
                    group,
                    resourceUri,
                    group,
                    scmDecorations);
            })));
            this.fireDidChange();
        }
    }

}

export class PluginScmResourceGroup implements ScmResourceGroup {

    private _resources: PluginScmResource[] = [];

    constructor(
        readonly handle: number,
        public provider: PluginScmProvider,
        public features: SourceControlGroupFeatures,
        public label: string,
        readonly id: string
    ) {
    }

    get resources(): PluginScmResource[] {
        return this._resources;
    }

    get hideWhenEmpty(): boolean | undefined {
        return this.features.hideWhenEmpty;
    }

    updateGroup(features: SourceControlGroupFeatures): void {
        this.features = features;
    }

    updateGroupLabel(label: string): void {
        this.label = label;
    }

    updateResources(resources: PluginScmResource[]): void {
        this._resources = resources;
    }

    dispose(): void { }

}

export class PluginScmResource implements ScmResource {
    constructor(
        private proxy: ScmExt,
        readonly handle: number,
        readonly group: PluginScmResourceGroup,
        public sourceUri: URI,
        public resourceGroup: ScmResourceGroup,
        public decorations?: ScmResourceDecorations
    ) { }

    open(): Promise<void> {
        return this.proxy.$executeResourceCommand(this.group.provider.handle, this.group.handle, this.handle);
    }
}
