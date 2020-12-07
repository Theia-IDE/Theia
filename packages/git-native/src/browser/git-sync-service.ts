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

import { injectable, inject } from 'inversify';
import { MessageService, Emitter, Event } from '@theia/core';
import { QuickPickService, ConfirmDialog } from '@theia/core/lib/browser';
import { GitRepositoryTracker } from './git-repository-tracker';
import { Git, Repository, WorkingDirectoryStatus } from '@theia/git/lib/common';
import { GitErrorHandler } from '@theia/git/lib/browser/git-error-handler';

@injectable()
export class GitSyncService {

    @inject(Git)
    protected readonly git: Git;

    @inject(GitRepositoryTracker)
    protected readonly repositoryTracker: GitRepositoryTracker;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(GitErrorHandler)
    protected readonly gitErrorHandler: GitErrorHandler;

    @inject(QuickPickService)
    protected readonly quickPickService: QuickPickService;

    protected readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;

    protected fireDidChange(): void {
        this.onDidChangeEmitter.fire(undefined);
    }

    protected syncing = false;
    isSyncing(): boolean {
        return this.syncing;
    }
    setSyncing(syncing: boolean): void {
        this.syncing = syncing;
        this.fireDidChange();
    }

    canSync(): boolean {
        if (this.isSyncing()) {
            return false;
        }
        const status = this.repositoryTracker.selectedRepositoryStatus;
        return !!status && !!status.branch && !!status.upstreamBranch;
    }
    async sync(): Promise<void> {
        const repository = this.repositoryTracker.selectedRepository;
        if (!this.canSync() || !repository) {
            return;
        }
        this.setSyncing(true);
        try {
            await this.git.fetch(repository);
            let status = await this.git.status(repository);
            this.setSyncing(false);

            const method = await this.getSyncMethod(status);
            if (method === undefined) {
                return;
            }
            this.setSyncing(true);
            if (method === 'pull-push' || method === 'rebase-push') {
                await this.git.pull(repository, {
                    rebase: method === 'rebase-push'
                });
                status = await this.git.status(repository);
            }
            if (this.shouldPush(status)) {
                await this.git.push(repository, {
                    force: method === 'force-push'
                });
            }
        } catch (error) {
            this.gitErrorHandler.handleError(error);
        } finally {
            this.setSyncing(false);
        }
    }
    protected async getSyncMethod(status: WorkingDirectoryStatus): Promise<GitSyncService.SyncMethod | undefined> {
        if (!status.upstreamBranch || !status.branch) {
            return undefined;
        }
        const { branch, upstreamBranch } = status;
        if (!this.shouldPull(status) && !this.shouldPush(status)) {
            this.messageService.info(`${branch} is already in sync with ${upstreamBranch}`);
            return undefined;
        }
        const methods: {
            label: string
            warning: string
            value: GitSyncService.SyncMethod
        }[] = [{
            label: `Pull and push commits from and to '${upstreamBranch}'`,
            warning: `This action will pull and push commits from and to '${upstreamBranch}'.`,
            value: 'pull-push'
        }, {
            label: `Fetch, rebase and push commits from and to '${upstreamBranch}'`,
            warning: `This action will fetch, rebase and push commits from and to '${upstreamBranch}'.`,
            value: 'rebase-push'
        }, {
            label: `Force push commits to '${upstreamBranch}'`,
            warning: `This action will override commits in '${upstreamBranch}'.`,
            value: 'force-push'
        }];
        const method = await this.quickPickService.show(methods, {
            placeholder: 'Pick how changes should be synchronized:'
        });
        if (method && await this.confirm('Synchronize Changes', methods.find(({ value }) => value === method)!.warning)) {
            return method;
        }
        return undefined;
    }

    canPublish(): boolean {
        if (this.isSyncing()) {
            return false;
        }
        const status = this.repositoryTracker.selectedRepositoryStatus;
        return !!status && !!status.branch && !status.upstreamBranch;
    }
    async publish(): Promise<void> {
        const repository = this.repositoryTracker.selectedRepository;
        const status = this.repositoryTracker.selectedRepositoryStatus;
        const localBranch = status && status.branch;
        if (!this.canPublish() || !repository || !localBranch) {
            return;
        }
        const remote = await this.getRemote(repository, localBranch);
        if (remote &&
            await this.confirm('Publish changes', `This action will push commits to '${remote}/${localBranch}' and track it as an upstream branch.`)
        ) {
            try {
                await this.git.push(repository, {
                    remote, localBranch, setUpstream: true
                });
            } catch (error) {
                this.gitErrorHandler.handleError(error);
            }
        }
    }
    protected async getRemote(repository: Repository, branch: string): Promise<string | undefined> {
        const remotes = await this.git.remote(repository);
        if (remotes.length === 0) {
            this.messageService.warn('Your repository has no remotes configured to publish to.');
        }
        return this.quickPickService.show(remotes, {
            placeholder: `Pick a remote to publish the branch ${branch} to:`
        });
    }

    protected shouldPush(status: WorkingDirectoryStatus): boolean {
        return status.aheadBehind ? status.aheadBehind.ahead > 0 : true;
    }
    protected shouldPull(status: WorkingDirectoryStatus): boolean {
        return status.aheadBehind ? status.aheadBehind.behind > 0 : true;
    }

    protected async confirm(title: string, msg: string): Promise<boolean> {
        return !!await new ConfirmDialog({ title, msg, }).open();
    }

}

export namespace GitSyncService {
    export type SyncMethod = 'pull-push' | 'rebase-push' | 'force-push';
}
