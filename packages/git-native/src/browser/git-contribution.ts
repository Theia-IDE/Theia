/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
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
import URI from '@theia/core/lib/common/uri';
import { Command, CommandContribution, CommandRegistry, DisposableCollection, MenuContribution, MenuModelRegistry, Mutable, MenuAction } from '@theia/core';
import { DiffUris, Widget } from '@theia/core/lib/browser';
import { TabBarToolbarContribution, TabBarToolbarRegistry, TabBarToolbarItem } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { EditorContextMenu, EditorManager, EditorOpenerOptions, EditorWidget } from '@theia/editor/lib/browser';
import { Git, GitFileChange, GitFileStatus } from '@theia/git/lib/common';
import { GitRepositoryTracker } from './git-repository-tracker';
import { GitAction, GitQuickOpenService } from '@theia/git/lib/browser/git-quick-open-service';
import { GitSyncService } from './git-sync-service';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { GitRepositoryProvider } from './git-repository-provider';
import { GitErrorHandler } from '@theia/git/lib/browser/git-error-handler';
import { ScmWidget } from '@theia/scm/lib/browser/scm-widget';
import { ScmTreeWidget } from '@theia/scm/lib/browser/scm-tree-widget';
import { ScmResource, ScmCommand } from '@theia/scm/lib/browser/scm-provider';
import { ProgressService } from '@theia/core/lib/common/progress-service';
import { GitPreferences } from './git-preferences';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';
import { ColorRegistry } from '@theia/core/lib/browser/color-registry';

export namespace GIT_COMMANDS {
    export const CLONE = {
        id: 'git.clone',
        label: 'Git: Clone...'
    };
    export const FETCH = {
        id: 'git.fetch',
        label: 'Git: Fetch...'
    };
    export const PULL_DEFAULT = {
        id: 'git.pull.default',
        label: 'Git: Pull'
    };
    export const PULL = {
        id: 'git.pull',
        label: 'Git: Pull from...'
    };
    export const PUSH_DEFAULT = {
        id: 'git.push.default',
        label: 'Git: Push'
    };
    export const PUSH = {
        id: 'git.push',
        label: 'Git: Push to...'
    };
    export const MERGE = {
        id: 'git.merge',
        label: 'Git: Merge...'
    };
    export const CHECKOUT = {
        id: 'git.checkout',
        label: 'Git: Checkout'
    };
    export const COMMIT = {
        id: 'git.commit.all',
        tooltip: 'Commit all the staged changes',
        iconClass: 'fa fa-check',
        label: 'Commit',
    };
    export const COMMIT_ADD_SIGN_OFF = {
        id: 'git-commit-add-sign-off',
        label: 'Add Signed-off-by',
        iconClass: 'fa fa-pencil-square-o',
        category: 'Git'
    };
    export const COMMIT_AMEND = {
        id: 'git.commit.amend'
    };
    export const COMMIT_SIGN_OFF = {
        id: 'git.commit.signOff'
    };
    export const OPEN_FILE: Command = {
        id: 'git.open.file',
        category: 'Git',
        label: 'Open File',
        iconClass: 'theia-open-file-icon'
    };
    export const OPEN_CHANGED_FILE: Command = {
        id: 'git.open.changed.file',
        category: 'Git',
        label: 'Open File',
        iconClass: 'open-file'
    };
    export const OPEN_CHANGES: Command = {
        id: 'git.open.changes',
        category: 'Git',
        label: 'Open Changes',
        iconClass: 'theia-open-change-icon'
    };
    export const SYNC = {
        id: 'git.sync',
        label: 'Git: Sync'
    };
    export const PUBLISH = {
        id: 'git.publish',
        label: 'Git: Publish Branch'
    };
    export const STAGE = {
        id: 'git.stage',
        category: 'Git',
        label: 'Stage Changes',
        iconClass: 'fa fa-plus'
    };
    export const STAGE_ALL = {
        id: 'git.stage.all',
        category: 'Git',
        label: 'Stage All Changes',
        iconClass: 'fa fa-plus',
    };
    export const UNSTAGE = {
        id: 'git.unstage',
        iconClass: 'fa fa-minus',
        category: 'Git',
        label: 'Unstage Changes'
    };
    export const UNSTAGE_ALL = {
        id: 'git.unstage.all',
        iconClass: 'fa fa-minus',
        category: 'Git',
        label: 'Unstage All',
    };
    export const DISCARD = {
        id: 'git.discard',
        iconClass: 'fa fa-undo',
        category: 'Git',
        label: 'Discard Changes'
    };
    export const DISCARD_ALL = {
        id: 'git.discard.all',
        iconClass: 'fa fa-undo',
        category: 'Git',
        label: 'Discard All Changes',
    };
    export const STASH = {
        id: 'git.stash',
        category: 'Git',
        label: 'Stash...'
    };
    export const APPLY_STASH = {
        id: 'git.stash.apply',
        category: 'Git',
        label: 'Apply Stash...'
    };
    export const APPLY_LATEST_STASH = {
        id: 'git.stash.apply.latest',
        category: 'Git',
        label: 'Apply Latest Stash'
    };
    export const POP_STASH = {
        id: 'git.stash.pop',
        category: 'Git',
        label: 'Pop Stash...'
    };
    export const POP_LATEST_STASH = {
        id: 'git.stash.pop.latest',
        category: 'Git',
        label: 'Pop Latest Stash'
    };
    export const DROP_STASH = {
        id: 'git.stash.drop',
        category: 'Git',
        label: 'Drop Stash...'
    };
    export const REFRESH = {
        id: 'git-refresh',
        label: 'Refresh',
        iconClass: 'fa fa-refresh',
        category: 'Git'
    };
    export const INIT_REPOSITORY = {
        id: 'git-init',
        label: 'Initialize Repository',
        iconClass: 'fa fa-plus',
        category: 'Git'
    };
}

@injectable()
export class GitContribution implements CommandContribution, MenuContribution, TabBarToolbarContribution, ColorContribution {

    static GIT_CHECKOUT = 'git.checkout';
    static GIT_SYNC_STATUS = 'git-sync-status';

    protected toDispose = new DisposableCollection();

    @inject(EditorManager) protected readonly editorManager: EditorManager;
    @inject(GitQuickOpenService) protected readonly quickOpenService: GitQuickOpenService;
    @inject(GitRepositoryTracker) protected readonly repositoryTracker: GitRepositoryTracker;
    @inject(GitSyncService) protected readonly syncService: GitSyncService;
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(GitRepositoryProvider) protected readonly repositoryProvider: GitRepositoryProvider;
    @inject(Git) protected readonly git: Git;
    @inject(GitErrorHandler) protected readonly gitErrorHandler: GitErrorHandler;
    @inject(CommandRegistry) protected readonly commands: CommandRegistry;
    @inject(ProgressService) protected readonly progressService: ProgressService;
    @inject(GitPreferences) protected readonly gitPreferences: GitPreferences;

    onStart(): void {
        this.updateStatusBar();
        this.repositoryTracker.onGitEvent(() => this.updateStatusBar());
        this.syncService.onDidChange(() => this.updateStatusBar());
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(EditorContextMenu.NAVIGATION, {
            commandId: GIT_COMMANDS.OPEN_FILE.id
        });
        menus.registerMenuAction(EditorContextMenu.NAVIGATION, {
            commandId: GIT_COMMANDS.OPEN_CHANGES.id
        });

        const registerResourceAction = (group: string, action: MenuAction) => {
            menus.registerMenuAction(ScmTreeWidget.RESOURCE_INLINE_MENU, action);
            menus.registerMenuAction([...ScmTreeWidget.RESOURCE_CONTEXT_MENU, group], action);
        };

        registerResourceAction('navigation', {
            commandId: GIT_COMMANDS.OPEN_CHANGED_FILE.id,
            when: 'scmProvider == git && scmResourceGroup == workingTree'
        });
        registerResourceAction('1_modification', {
            commandId: GIT_COMMANDS.DISCARD.id,
            when: 'scmProvider == git && scmResourceGroup == workingTree'
        });
        registerResourceAction('1_modification', {
            commandId: GIT_COMMANDS.STAGE.id,
            when: 'scmProvider == git && scmResourceGroup == workingTree'
        });

        registerResourceAction('navigation', {
            commandId: GIT_COMMANDS.OPEN_CHANGED_FILE.id,
            when: 'scmProvider == git && scmResourceGroup == index'
        });
        registerResourceAction('1_modification', {
            commandId: GIT_COMMANDS.UNSTAGE.id,
            when: 'scmProvider == git && scmResourceGroup == index'
        });

        registerResourceAction('navigation', {
            commandId: GIT_COMMANDS.OPEN_CHANGED_FILE.id,
            when: 'scmProvider == git && scmResourceGroup == merge'
        });
        registerResourceAction('1_modification', {
            commandId: GIT_COMMANDS.DISCARD.id,
            when: 'scmProvider == git && scmResourceGroup == merge'
        });
        registerResourceAction('1_modification', {
            commandId: GIT_COMMANDS.STAGE.id,
            when: 'scmProvider == git && scmResourceGroup == merge'
        });

        const registerResourceFolderAction = (group: string, action: MenuAction) => {
            menus.registerMenuAction(ScmTreeWidget.RESOURCE_FOLDER_INLINE_MENU, action);
            menus.registerMenuAction([...ScmTreeWidget.RESOURCE_FOLDER_CONTEXT_MENU, group], action);
        };

        registerResourceFolderAction('1_modification', {
            commandId: GIT_COMMANDS.DISCARD.id,
            when: 'scmProvider == git && scmResourceGroup == workingTree'
        });
        registerResourceFolderAction('1_modification', {
            commandId: GIT_COMMANDS.STAGE.id,
            when: 'scmProvider == git && scmResourceGroup == workingTree'
        });

        registerResourceFolderAction('1_modification', {
            commandId: GIT_COMMANDS.UNSTAGE.id,
            when: 'scmProvider == git && scmResourceGroup == index'
        });

        registerResourceFolderAction('1_modification', {
            commandId: GIT_COMMANDS.DISCARD.id,
            when: 'scmProvider == git && scmResourceGroup == merge'
        });
        registerResourceFolderAction('1_modification', {
            commandId: GIT_COMMANDS.STAGE.id,
            when: 'scmProvider == git && scmResourceGroup == merge'
        });

        const registerResourceGroupAction = (group: string, action: MenuAction) => {
            menus.registerMenuAction(ScmTreeWidget.RESOURCE_GROUP_INLINE_MENU, action);
            menus.registerMenuAction([...ScmTreeWidget.RESOURCE_GROUP_CONTEXT_MENU, group], action);
        };

        registerResourceGroupAction('1_modification', {
            commandId: GIT_COMMANDS.STAGE_ALL.id,
            when: 'scmProvider == git && scmResourceGroup == merge',
        });
        registerResourceGroupAction('1_modification', {
            commandId: GIT_COMMANDS.UNSTAGE_ALL.id,
            when: 'scmProvider == git && scmResourceGroup == index',
        });
        registerResourceGroupAction('1_modification', {
            commandId: GIT_COMMANDS.STAGE_ALL.id,
            when: 'scmProvider == git && scmResourceGroup == workingTree',
        });
        registerResourceGroupAction('1_modification', {
            commandId: GIT_COMMANDS.DISCARD_ALL.id,
            when: 'scmProvider == git && scmResourceGroup == workingTree',
        });
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(GIT_COMMANDS.FETCH, {
            execute: () => this.withProgress(() => this.quickOpenService.fetch()),
            isEnabled: () => !!this.repositoryTracker.selectedRepository
        });
        registry.registerCommand(GIT_COMMANDS.PULL_DEFAULT, {
            execute: () => this.withProgress(() => this.quickOpenService.performDefaultGitAction(GitAction.PULL)),
            isEnabled: () => !!this.repositoryTracker.selectedRepository
        });
        registry.registerCommand(GIT_COMMANDS.PULL, {
            execute: () => this.withProgress(() => this.quickOpenService.pull()),
            isEnabled: () => !!this.repositoryTracker.selectedRepository
        });
        registry.registerCommand(GIT_COMMANDS.PUSH_DEFAULT, {
            execute: () => this.withProgress(() => this.quickOpenService.performDefaultGitAction(GitAction.PUSH)),
            isEnabled: () => !!this.repositoryTracker.selectedRepository
        });
        registry.registerCommand(GIT_COMMANDS.PUSH, {
            execute: () => this.withProgress(() => this.quickOpenService.push()),
            isEnabled: () => !!this.repositoryTracker.selectedRepository
        });
        registry.registerCommand(GIT_COMMANDS.MERGE, {
            execute: () => this.withProgress(() => this.quickOpenService.merge()),
            isEnabled: () => !!this.repositoryTracker.selectedRepository
        });
        registry.registerCommand(GIT_COMMANDS.CHECKOUT, {
            execute: () => this.withProgress(() => this.quickOpenService.checkout()),
            isEnabled: () => !!this.repositoryTracker.selectedRepository
        });
        registry.registerCommand(GIT_COMMANDS.COMMIT_SIGN_OFF, {
            execute: () => this.withProgress(() => this.commit({ signOff: true })),
            isEnabled: () => !!this.repositoryTracker.selectedRepository
        });
        registry.registerCommand(GIT_COMMANDS.COMMIT_AMEND, {
            execute: () => this.withProgress(async () => this.amend()),
            isEnabled: () => !!this.repositoryTracker.selectedRepository
        });
        registry.registerCommand(GIT_COMMANDS.STAGE_ALL, {
            execute: () => {
                const provider = this.repositoryProvider.selectedScmProvider;
                return provider && this.withProgress(() => provider.stageAll());
            },
            isEnabled: () => !!this.repositoryProvider.selectedScmProvider
        });
        registry.registerCommand(GIT_COMMANDS.UNSTAGE_ALL, {
            execute: () => {
                const provider = this.repositoryProvider.selectedScmProvider;
                return provider && this.withProgress(() => provider.unstageAll());
            },
            isEnabled: () => !!this.repositoryProvider.selectedScmProvider
        });
        registry.registerCommand(GIT_COMMANDS.DISCARD_ALL, {
            execute: () => {
                const provider = this.repositoryProvider.selectedScmProvider;
                return provider && this.withProgress(() => provider.discardAll());
            },
            isEnabled: () => !!this.repositoryProvider.selectedScmProvider
        });
        registry.registerCommand(GIT_COMMANDS.OPEN_FILE, {
            execute: widget => this.openFile(widget),
            isEnabled: widget => !!this.getOpenFileOptions(widget),
            isVisible: widget => !!this.getOpenFileOptions(widget)
        });
        registry.registerCommand(GIT_COMMANDS.OPEN_CHANGES, {
            execute: widget => this.openChanges(widget),
            isEnabled: widget => !!this.getOpenChangesOptions(widget),
            isVisible: widget => !!this.getOpenChangesOptions(widget)
        });
        registry.registerCommand(GIT_COMMANDS.SYNC, {
            execute: () => this.withProgress(() => this.syncService.sync()),
            isEnabled: () => this.syncService.canSync(),
            isVisible: () => this.syncService.canSync()
        });
        registry.registerCommand(GIT_COMMANDS.PUBLISH, {
            execute: () => this.withProgress(() => this.syncService.publish()),
            isEnabled: () => this.syncService.canPublish(),
            isVisible: () => this.syncService.canPublish()
        });
        registry.registerCommand(GIT_COMMANDS.CLONE, {
            isEnabled: () => this.workspaceService.opened,
            execute: (url?: string, folder?: string, branch?: string) =>
                this.quickOpenService.clone(url, folder, branch)
        });
        registry.registerCommand(GIT_COMMANDS.COMMIT, {
            execute: () => this.withProgress(() => this.commit()),
            isEnabled: () => !!this.repositoryTracker.selectedRepository
        });
        registry.registerCommand(GIT_COMMANDS.REFRESH, {
            execute: () => this.withProgress(() => this.repositoryProvider.refresh())
        });
        registry.registerCommand(GIT_COMMANDS.COMMIT_ADD_SIGN_OFF, {
            execute: async () => this.withProgress(() => this.addSignOff()),
            isEnabled: () => !!this.repositoryTracker.selectedRepository
        });
        registry.registerCommand(GIT_COMMANDS.UNSTAGE, {
            execute: (...arg: ScmResource[]) => {
                const resources = arg.filter(r => r.sourceUri).map(r => r.sourceUri.toString());
                const provider = this.repositoryProvider.selectedScmProvider;
                return provider && this.withProgress(() => provider.unstage(resources));
            },
            isEnabled: (...arg: ScmResource[]) => !!this.repositoryProvider.selectedScmProvider
                && arg.some(r => r.sourceUri)
        });
        registry.registerCommand(GIT_COMMANDS.STAGE, {
            execute: (...arg: ScmResource[]) => {
                const resources = arg.filter(r => r.sourceUri).map(r => r.sourceUri.toString());
                const provider = this.repositoryProvider.selectedScmProvider;
                return provider && this.withProgress(() => provider.stage(resources));
            },
            isEnabled: (...arg: ScmResource[]) => !!this.repositoryProvider.selectedScmProvider
                && arg.some(r => r.sourceUri)
        });
        registry.registerCommand(GIT_COMMANDS.DISCARD, {
            execute: (...arg: ScmResource[]) => {
                const resources = arg.filter(r => r.sourceUri).map(r => r.sourceUri.toString());
                const provider = this.repositoryProvider.selectedScmProvider;
                return provider && this.withProgress(() => provider.discard(resources));
            },
            isEnabled: (...arg: ScmResource[]) => !!this.repositoryProvider.selectedScmProvider
                && arg.some(r => r.sourceUri)
        });
        registry.registerCommand(GIT_COMMANDS.OPEN_CHANGED_FILE, {
            execute: (...arg: ScmResource[]) => {
                for (const resource of arg) {
                    this.editorManager.open(resource.sourceUri, { mode: 'reveal' });
                }
            }
        });
        registry.registerCommand(GIT_COMMANDS.STASH, {
            execute: () => this.quickOpenService.stash(),
            isEnabled: () => !!this.repositoryTracker.selectedRepository &&
                !!this.repositoryTracker.selectedRepositoryStatus &&
                this.repositoryTracker.selectedRepositoryStatus.changes.length > 0
        });
        registry.registerCommand(GIT_COMMANDS.APPLY_STASH, {
            execute: () => this.quickOpenService.applyStash(),
            isEnabled: () => !!this.repositoryTracker.selectedRepository
        });
        registry.registerCommand(GIT_COMMANDS.APPLY_LATEST_STASH, {
            execute: () => this.quickOpenService.applyLatestStash(),
            isEnabled: () => !!this.repositoryTracker.selectedRepository
        });
        registry.registerCommand(GIT_COMMANDS.POP_STASH, {
            execute: () => this.quickOpenService.popStash(),
            isEnabled: () => !!this.repositoryTracker.selectedRepository
        });
        registry.registerCommand(GIT_COMMANDS.POP_LATEST_STASH, {
            execute: () => this.quickOpenService.popLatestStash(),
            isEnabled: () => !!this.repositoryTracker.selectedRepository
        });
        registry.registerCommand(GIT_COMMANDS.DROP_STASH, {
            execute: () => this.quickOpenService.dropStash(),
            isEnabled: () => !!this.repositoryTracker.selectedRepository
        });
        registry.registerCommand(GIT_COMMANDS.INIT_REPOSITORY, {
            execute: () => this.quickOpenService.initRepository(),
            isEnabled: widget => this.workspaceService.opened && (!widget || widget instanceof ScmWidget) && !this.repositoryProvider.selectedRepository,
            isVisible: widget => this.workspaceService.opened && (!widget || widget instanceof ScmWidget) && !this.repositoryProvider.selectedRepository
        });
    }
    async amend(): Promise<void> {
        {
            const scmRepository = this.repositoryProvider.selectedScmRepository;
            if (!scmRepository) {
                return;
            }

            try {
                const repository = { localUri: scmRepository.provider.rootUri };
                const commits = await this.git.log(repository, { maxCount: 1 });
                if (commits.length === 0) {
                    scmRepository.input.issue = {
                        type: 'error',
                        message: 'No previous commit to amend'
                    };
                    scmRepository.input.focus();
                    return;
                }
                const message = await this.quickOpenService.commitMessageForAmend();
                await this.commit({ message, amend: true });
            } catch (e) {
                if (!(e instanceof Error) || e.message !== 'User abort.') {
                    throw e;
                }
            }
        }
    }

    protected withProgress<T>(task: () => Promise<T>): Promise<T> {
        return this.progressService.withProgress('', 'scm', task);
    }

    registerToolbarItems(registry: TabBarToolbarRegistry): void {
        registry.registerItem({
            id: GIT_COMMANDS.OPEN_FILE.id,
            command: GIT_COMMANDS.OPEN_FILE.id,
            tooltip: GIT_COMMANDS.OPEN_FILE.label
        });
        registry.registerItem({
            id: GIT_COMMANDS.OPEN_CHANGES.id,
            command: GIT_COMMANDS.OPEN_CHANGES.id,
            tooltip: GIT_COMMANDS.OPEN_CHANGES.label
        });
        registry.registerItem({
            id: GIT_COMMANDS.INIT_REPOSITORY.id,
            command: GIT_COMMANDS.INIT_REPOSITORY.id,
            tooltip: GIT_COMMANDS.INIT_REPOSITORY.label
        });

        const registerItem = (item: Mutable<TabBarToolbarItem>) => {
            const commandId = item.command;
            const id = '__git.tabbar.toolbar.' + commandId;
            const command = this.commands.getCommand(commandId);
            this.commands.registerCommand({ id, iconClass: command && command.iconClass }, {
                execute: (widget, ...args) => widget instanceof ScmWidget && this.commands.executeCommand(commandId, ...args),
                isEnabled: (widget, ...args) => widget instanceof ScmWidget && this.commands.isEnabled(commandId, ...args),
                isVisible: (widget, ...args) =>
                    widget instanceof ScmWidget &&
                    this.commands.isVisible(commandId, ...args) &&
                    !!this.repositoryProvider.selectedRepository
            });
            item.command = id;
            registry.registerItem(item);
        };
        registerItem({
            id: GIT_COMMANDS.COMMIT.id,
            command: GIT_COMMANDS.COMMIT.id,
            tooltip: GIT_COMMANDS.COMMIT.label
        });
        registerItem({
            id: GIT_COMMANDS.REFRESH.id,
            command: GIT_COMMANDS.REFRESH.id,
            tooltip: GIT_COMMANDS.REFRESH.label
        });
        registerItem({
            id: GIT_COMMANDS.COMMIT_ADD_SIGN_OFF.id,
            command: GIT_COMMANDS.COMMIT_ADD_SIGN_OFF.id,
            tooltip: GIT_COMMANDS.COMMIT_ADD_SIGN_OFF.label
        });
        registerItem({
            id: GIT_COMMANDS.COMMIT_AMEND.id,
            command: GIT_COMMANDS.COMMIT_AMEND.id,
            tooltip: 'Commit (Amend)',
            group: '1_input'
        });
        registerItem({
            id: GIT_COMMANDS.COMMIT_SIGN_OFF.id,
            command: GIT_COMMANDS.COMMIT_SIGN_OFF.id,
            tooltip: 'Commit (Signed Off)',
            group: '1_input'
        });
        [GIT_COMMANDS.FETCH, GIT_COMMANDS.PULL_DEFAULT, GIT_COMMANDS.PULL, GIT_COMMANDS.PUSH_DEFAULT, GIT_COMMANDS.PUSH, GIT_COMMANDS.MERGE].forEach(command =>
            registerItem({
                id: command.id,
                command: command.id,
                tooltip: command.label.slice('Git: '.length),
                group: '2_other'
            })
        );
        [
            GIT_COMMANDS.STASH, GIT_COMMANDS.APPLY_STASH,
            GIT_COMMANDS.APPLY_LATEST_STASH, GIT_COMMANDS.POP_STASH,
            GIT_COMMANDS.POP_LATEST_STASH, GIT_COMMANDS.DROP_STASH
        ].forEach(command =>
            registerItem({
                id: command.id,
                command: command.id,
                tooltip: command.label,
                group: '3_other'
            })
        );
        registerItem({
            id: GIT_COMMANDS.STAGE_ALL.id,
            command: GIT_COMMANDS.STAGE_ALL.id,
            tooltip: 'Stage All Changes',
            group: '3_batch'
        });
        registerItem({
            id: GIT_COMMANDS.UNSTAGE_ALL.id,
            command: GIT_COMMANDS.UNSTAGE_ALL.id,
            tooltip: 'Unstage All Changes',
            group: '3_batch'
        });
        registerItem({
            id: GIT_COMMANDS.DISCARD_ALL.id,
            command: GIT_COMMANDS.DISCARD_ALL.id,
            tooltip: 'Discard All Changes',
            group: '3_batch'
        });
    }

    protected hasConflicts(changes: GitFileChange[]): boolean {
        return changes.some(c => c.status === GitFileStatus.Conflicted);
    }

    protected allStaged(changes: GitFileChange[]): boolean {
        return !changes.some(c => !c.staged);
    }

    protected async openFile(widget?: Widget): Promise<EditorWidget | undefined> {
        const options = this.getOpenFileOptions(widget);
        return options && this.editorManager.open(options.uri, options.options);
    }

    protected getOpenFileOptions(widget?: Widget): GitOpenFileOptions | undefined {
        const ref = widget ? widget : this.editorManager.currentEditor;
        if (ref instanceof EditorWidget && DiffUris.isDiffUri(ref.editor.uri)) {
            const [, right] = DiffUris.decode(ref.editor.uri);
            const uri = right.withScheme('file');
            const selection = ref.editor.selection;
            return { uri, options: { selection, widgetOptions: { ref } } };
        }
        return undefined;
    }

    async openChanges(widget?: Widget): Promise<EditorWidget | undefined> {
        const options = this.getOpenChangesOptions(widget);
        if (options) {
            const provider = this.repositoryProvider.selectedScmProvider;
            return provider && provider.openChange(options.change, options.options);
        }
        return undefined;
    }

    protected getOpenChangesOptions(widget?: Widget): GitOpenChangesOptions | undefined {
        const provider = this.repositoryProvider.selectedScmProvider;
        if (!provider) {
            return undefined;
        }
        const ref = widget ? widget : this.editorManager.currentEditor;
        if (ref instanceof EditorWidget && !DiffUris.isDiffUri(ref.editor.uri)) {
            const uri = ref.editor.uri;
            const change = provider.findChange(uri);
            if (change && provider.getUriToOpen(change).toString() !== uri.toString()) {
                const selection = ref.editor.selection;
                return { change, options: { selection, widgetOptions: { ref } } };
            }
        }
        return undefined;
    }

    protected updateStatusBar(): void {
        const scmProvider = this.repositoryProvider.selectedScmProvider;
        if (!scmProvider) {
            return;
        }
        const statusBarCommands: ScmCommand[] = [];

        const checkoutCommand = this.getCheckoutStatusBarCommand();
        if (checkoutCommand) {
            statusBarCommands.push(checkoutCommand);
        }

        const syncCommand = this.getSyncStatusBarCommand();
        if (syncCommand) {
            statusBarCommands.push(syncCommand);
        }
        scmProvider.statusBarCommands = statusBarCommands;
    }
    protected getCheckoutStatusBarCommand(): ScmCommand | undefined {
        const scmProvider = this.repositoryProvider.selectedScmProvider;
        if (!scmProvider) {
            return undefined;
        }
        const status = scmProvider.getStatus();
        if (!status) {
            return undefined;
        }
        const branch = status.branch ? status.branch : status.currentHead ? status.currentHead.substring(0, 8) : 'NO-HEAD';
        const changes = (scmProvider.unstagedChanges.length > 0 ? '*' : '')
            + (scmProvider.stagedChanges.length > 0 ? '+' : '')
            + (scmProvider.mergeChanges.length > 0 ? '!' : '');
        return {
            command: GIT_COMMANDS.CHECKOUT.id,
            title: `$(code-fork) ${branch}${changes}`,
            tooltip: `${branch}${changes}`
        };
    }
    protected getSyncStatusBarCommand(): ScmCommand | undefined {
        const status = this.repositoryTracker.selectedRepositoryStatus;
        if (!status || !status.branch) {
            return undefined;
        }
        if (this.syncService.isSyncing()) {
            return {
                title: '$(refresh~spin)',
                tooltip: 'Synchronizing Changes...'
            };
        }
        const { upstreamBranch, aheadBehind } = status;
        if (upstreamBranch) {
            return {
                title: '$(refresh)' + (aheadBehind && (aheadBehind.ahead + aheadBehind.behind) > 0 ? ` ${aheadBehind.behind}↓ ${aheadBehind.ahead}↑` : ''),
                command: GIT_COMMANDS.SYNC.id,
                tooltip: 'Synchronize Changes'
            };
        }
        return {
            title: '$(cloud-upload)',
            command: GIT_COMMANDS.PUBLISH.id,
            tooltip: 'Publish Changes'
        };
    }

    async commit(options: Git.Options.Commit & { message?: string } = {}): Promise<void> {
        const scmRepository = this.repositoryProvider.selectedScmRepository;
        if (!scmRepository) {
            return;
        }
        const message = options.message || scmRepository.input.value;
        if (!message.trim()) {
            scmRepository.input.issue = {
                type: 'error',
                message: 'Please provide a commit message'
            };
            scmRepository.input.focus();
            return;
        }
        if (!scmRepository.provider.stagedChanges.length) {
            scmRepository.input.issue = {
                type: 'error',
                message: 'No changes added to commit'
            };
            scmRepository.input.focus();
            return;
        }
        scmRepository.input.issue = undefined;
        try {
            // We can make sure, repository exists, otherwise we would not have this button.
            const amend = options.amend;
            const signOff = options.signOff || this.gitPreferences['git.alwaysSignOff'];
            const repository = scmRepository.provider.repository;
            await this.git.commit(repository, message, { signOff, amend });
            scmRepository.input.value = '';
        } catch (error) {
            this.gitErrorHandler.handleError(error);
        }
    }

    async addSignOff(): Promise<void> {
        const scmRepository = this.repositoryProvider.selectedScmRepository;
        if (!scmRepository) {
            return;
        }
        try {
            const repository = scmRepository.provider.repository;
            const [username, email] = (await Promise.all([
                this.git.exec(repository, ['config', 'user.name']),
                this.git.exec(repository, ['config', 'user.email'])
            ])).map(result => result.stdout.trim());

            const signOff = `\n\nSigned-off-by: ${username} <${email}>`;
            const value = scmRepository.input.value;
            if (value.endsWith(signOff)) {
                scmRepository.input.value = value.substr(0, value.length - signOff.length);
            } else {
                scmRepository.input.value = `${value}${signOff}`;
            }
            scmRepository.input.focus();
        } catch (e) {
            scmRepository.input.issue = {
                type: 'warning',
                message: 'Make sure you configure your \'user.name\' and \'user.email\' in git.'
            };
        }

    }

    /**
     * It should be aligned with https://code.visualstudio.com/api/references/theme-color#git-colors
     */
    registerColors(colors: ColorRegistry): void {
        colors.register({
            'id': 'gitDecoration.addedResourceForeground',
            'description': 'Color for added resources.',
            'defaults': {
                'light': '#587c0c',
                'dark': '#81b88b',
                'hc': '#1b5225'
            }
        }, {
            'id': 'gitDecoration.modifiedResourceForeground',
            'description': 'Color for modified resources.',
            'defaults': {
                'light': '#895503',
                'dark': '#E2C08D',
                'hc': '#E2C08D'
            }
        }, {
            'id': 'gitDecoration.deletedResourceForeground',
            'description': 'Color for deleted resources.',
            'defaults': {
                'light': '#ad0707',
                'dark': '#c74e39',
                'hc': '#c74e39'
            }
        }, {
            'id': 'gitDecoration.untrackedResourceForeground',
            'description': 'Color for untracked resources.',
            'defaults': {
                'light': '#007100',
                'dark': '#73C991',
                'hc': '#73C991'
            }
        }, {
            'id': 'gitDecoration.conflictingResourceForeground',
            'description': 'Color for resources with conflicts.',
            'defaults': {
                'light': '#6c6cc4',
                'dark': '#6c6cc4',
                'hc': '#6c6cc4'
            }
        }, {
            'id': 'gitlens.gutterBackgroundColor',
            'description': 'Specifies the background color of the gutter blame annotations',
            'defaults': {
                'dark': '#FFFFFF13',
                'light': '#0000000C',
                'hc': '#FFFFFF13'
            }
        }, {
            'id': 'gitlens.gutterForegroundColor',
            'description': 'Specifies the foreground color of the gutter blame annotations',
            'defaults': {
                'dark': '#BEBEBE',
                'light': '#747474',
                'hc': '#BEBEBE'
            }
        }, {
            'id': 'gitlens.lineHighlightBackgroundColor',
            'description': 'Specifies the background color of the associated line highlights in blame annotations',
            'defaults': {
                'dark': '#00BCF233',
                'light': '#00BCF233',
                'hc': '#00BCF233'
            }
        });
    }

}
export interface GitOpenFileOptions {
    readonly uri: URI
    readonly options?: EditorOpenerOptions
}
export interface GitOpenChangesOptions {
    readonly change: GitFileChange
    readonly options?: EditorOpenerOptions
}
