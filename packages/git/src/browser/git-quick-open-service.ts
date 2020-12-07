/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
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
import { QuickOpenItem, QuickOpenMode, QuickOpenModel } from '@theia/core/lib/common/quick-open-model';
import { QuickOpenService, QuickOpenOptions } from '@theia/core/lib/browser/quick-open/quick-open-service';
import { Git, Repository, Branch, BranchType, Tag, Remote, StashEntry } from '../common';
import { ScmService } from '@theia/scm/lib/browser/scm-service';
import { MessageService } from '@theia/core/lib/common/message-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { GitErrorHandler } from './git-error-handler';
import { ProgressService } from '@theia/core/lib/common/progress-service';
import URI from '@theia/core/lib/common/uri';
import { LabelProvider } from '@theia/core/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileStat } from '@theia/filesystem/lib/common/files';

export enum GitAction {
    PULL,
    PUSH
}

/**
 * Service delegating into the `Quick Open Service`, so that the Git commands can be further refined.
 * For instance, the `remote` can be specified for `pull`, `push`, and `fetch`. And the branch can be
 * specified for `git merge`.
 */
@injectable()
export class GitQuickOpenService {

    @inject(GitErrorHandler) protected readonly gitErrorHandler: GitErrorHandler;
    @inject(ProgressService) protected readonly progressService: ProgressService;
    @inject(LabelProvider) protected readonly labelProvider: LabelProvider;

    @inject(Git) protected readonly git: Git;
    @inject(ScmService) protected readonly scmService: ScmService;
    @inject(QuickOpenService) protected readonly quickOpenService: QuickOpenService;
    @inject(MessageService) protected readonly messageService: MessageService;
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(FileService) protected readonly fileService: FileService;

    async clone(url?: string, folder?: string, branch?: string): Promise<string | undefined> {
        return this.withProgress(async () => {
            if (!folder) {
                const roots = await this.workspaceService.roots;
                folder = roots[0].resource.toString();
            }

            if (url) {
                const repo = await this.git.clone(
                    url,
                    {
                        localUri: await this.buildDefaultProjectPath(folder, url),
                        branch: branch
                    });
                return repo.localUri;
            }

            const gitCloneLocalTargetFolder = folder;
            const { git, buildDefaultProjectPath, gitErrorHandler, wrapWithProgress } = this;
            const cloneRepoModel: QuickOpenModel = {
                onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): void {
                    const dynamicItems: QuickOpenItem[] = [];
                    const suffix = "Press 'Enter' to confirm or 'Escape' to cancel.";
                    if (lookFor === undefined || lookFor.length === 0) {
                        dynamicItems.push(new SingleStringInputOpenItem(`Please provide a Git repository location. ${suffix}`, () => { }, () => false));
                    } else {
                        dynamicItems.push(new SingleStringInputOpenItem(
                            `Clone the Git repository: ${lookFor}. ${suffix}`,
                            wrapWithProgress(async () => {
                                try {
                                    await git.clone(lookFor, { localUri: await buildDefaultProjectPath(gitCloneLocalTargetFolder, lookFor) });
                                } catch (error) {
                                    gitErrorHandler.handleError(error);
                                }
                            })
                        ));
                    }
                    acceptor(dynamicItems);
                }
            };
            this.quickOpenService.open(cloneRepoModel, this.getOptions('Git repository location:', false));
        });
    }

    private buildDefaultProjectPath = this.doBuildDefaultProjectPath.bind(this);
    private async doBuildDefaultProjectPath(folderPath: string, gitURI: string): Promise<string> {
        if (!(await this.fileService.exists(new URI(folderPath)))) {
            // user specifies its own project path, doesn't want us to guess it
            return folderPath;
        }
        const uriSplitted = gitURI.split('/');
        let projectPath = folderPath + '/' + (uriSplitted.pop() || uriSplitted.pop());
        if (projectPath.endsWith('.git')) {
            projectPath = projectPath.substring(0, projectPath.length - '.git'.length);
        }
        return projectPath;
    }

    async fetch(): Promise<void> {
        const repository = this.getRepository();
        if (!repository) {
            return;
        }
        return this.withProgress(async () => {
            const remotes = await this.getRemotes();
            const execute = async (item: QuickOpenItem) => {
                try {
                    await this.git.fetch(repository, { remote: item.getLabel() });
                } catch (error) {
                    this.gitErrorHandler.handleError(error);
                }
            };
            const items = remotes.map(remote => {
                const toLabel = () => remote.name;
                const toDescription = () => remote.fetch;
                return new GitQuickOpenItem(remote.name, this.wrapWithProgress(execute), toLabel, toDescription);
            });
            this.open(items, 'Pick a remote to fetch from:');
        });
    }

    async performDefaultGitAction(action: GitAction): Promise<void> {
        const remote = await this.getRemotes();
        const defaultRemote = remote[0].name;
        const repository = this.getRepository();
        if (!repository) {
            return;
        }
        return this.withProgress(async () => {
            try {
                if (action === GitAction.PULL) {
                    await this.git.pull(repository, { remote: defaultRemote });
                    console.log(`Git Pull: successfully completed from ${defaultRemote}.`);
                } else if (action === GitAction.PUSH) {
                    await this.git.push(repository, { remote: defaultRemote, setUpstream: true });
                    console.log(`Git Push: successfully completed to ${defaultRemote}.`);
                }
            } catch (error) {
                this.gitErrorHandler.handleError(error);
            }
        });
    }

    async push(): Promise<void> {
        const repository = this.getRepository();
        if (!repository) {
            return;
        }
        return this.withProgress(async () => {
            const [remotes, currentBranch] = await Promise.all([this.getRemotes(), this.getCurrentBranch()]);
            const execute = async (item: QuickOpenItem) => {
                try {
                    await this.git.push(repository, { remote: item.getLabel(), setUpstream: true });
                } catch (error) {
                    this.gitErrorHandler.handleError(error);
                }
            };
            const items = remotes.map(remote => {
                const toLabel = () => remote.name;
                const toDescription = () => remote.push;
                return new GitQuickOpenItem(remote.name, this.wrapWithProgress(execute), toLabel, toDescription);
            });
            const branchName = currentBranch ? `'${currentBranch.name}' ` : '';
            this.open(items, `Pick a remote to push the currently active branch ${branchName}to:`);
        });
    }

    async pull(): Promise<void> {
        const repository = this.getRepository();
        if (!repository) {
            return;
        }
        return this.withProgress(async () => {
            const remotes = await this.getRemotes();
            const defaultRemote = remotes[0].name; // I wish I could use assignment destructuring here. (GH-413)
            const executeRemote = async (remoteItem: GitQuickOpenItem<Remote>) => {
                // The first remote is the default.
                if (remoteItem.ref.name === defaultRemote) {
                    try {
                        await this.git.pull(repository, { remote: remoteItem.getLabel() });
                    } catch (error) {
                        this.gitErrorHandler.handleError(error);
                    }
                } else {
                    // Otherwise we need to propose the branches from
                    const branches = await this.getBranches();
                    const executeBranch = async (branchItem: GitQuickOpenItem<Branch>) => {
                        try {
                            await this.git.pull(repository, { remote: remoteItem.ref.name, branch: branchItem.ref.nameWithoutRemote });
                        } catch (error) {
                            this.gitErrorHandler.handleError(error);
                        }
                    };
                    const toLabel = (branchItem: GitQuickOpenItem<Branch>) => branchItem.ref.name;
                    const branchItems = branches
                        .filter(branch => branch.type === BranchType.Remote)
                        .filter(branch => (branch.name || '').startsWith(`${remoteItem.ref}/`))
                        .map(branch => new GitQuickOpenItem(branch, this.wrapWithProgress(executeBranch), toLabel));
                    this.open(branchItems, 'Select the branch to pull the changes from:');
                }
            };
            const remoteItems = remotes.map(remote => {
                const toLabel = () => remote.name;
                const toDescription = () => remote.fetch;
                return new GitQuickOpenItem(remote, this.wrapWithProgress(executeRemote), toLabel, toDescription);
            });
            this.open(remoteItems, 'Pick a remote to pull the branch from:');
        });
    }

    async merge(): Promise<void> {
        const repository = this.getRepository();
        if (!repository) {
            return;
        }
        return this.withProgress(async () => {
            const [branches, currentBranch] = await Promise.all([this.getBranches(), this.getCurrentBranch()]);
            const execute = async (item: GitQuickOpenItem<Branch>) => {
                try {
                    await this.git.merge(repository, { branch: item.getLabel()! });
                } catch (error) {
                    this.gitErrorHandler.handleError(error);
                }
            };
            const toLabel = (item: GitQuickOpenItem<Branch>) => item.ref.name;
            const items = branches.map(branch => new GitQuickOpenItem(branch, this.wrapWithProgress(execute), toLabel));
            const branchName = currentBranch ? `'${currentBranch.name}' ` : '';
            this.open(items, `Pick a branch to merge into the currently active ${branchName}branch:`);
        });
    }

    async checkout(): Promise<void> {
        const repository = this.getRepository();
        if (!repository) {
            return;
        }
        return this.withProgress(async () => {
            const [branches, currentBranch] = await Promise.all([this.getBranches(), this.getCurrentBranch()]);
            if (currentBranch) {
                // We do not show the current branch.
                const index = branches.findIndex(branch => branch && branch.name === currentBranch.name);
                branches.splice(index, 1);
            }
            const switchBranch = async (item: GitQuickOpenItem<Branch>) => {
                try {
                    await this.git.checkout(repository, { branch: item.ref.nameWithoutRemote });
                } catch (error) {
                    this.gitErrorHandler.handleError(error);
                }
            };
            const toLabel = (item: GitQuickOpenItem<Branch>) => {
                const branch = item.ref;
                return branch.type === BranchType.Remote ? branch.name : branch.nameWithoutRemote;
            };
            const toDescription = (item: GitQuickOpenItem<Branch>) => {
                const branch = item.ref;
                // We have only the long SHA1, but getting the first seven characters is the same.
                const tip = branch.tip.sha.length > 8 ? ` ${branch.tip.sha.slice(0, 7)}` : '';
                return branch.type === BranchType.Remote ? `Remote branch at${tip}` : `${tip}`;
            };
            const items: QuickOpenItem[] = branches.map(branch => new GitQuickOpenItem(branch, this.wrapWithProgress(switchBranch), toLabel, toDescription));
            const createBranchItem = async (item: QuickOpenItem) => {
                const { git, gitErrorHandler, wrapWithProgress } = this;
                const createBranchModel: QuickOpenModel = {
                    onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): void {
                        const dynamicItems: QuickOpenItem[] = [];
                        const suffix = "Press 'Enter' to confirm or 'Escape' to cancel.";
                        if (lookFor === undefined || lookFor.length === 0) {
                            dynamicItems.push(new SingleStringInputOpenItem(`Please provide a branch name. ${suffix}`, () => { }, () => false));
                        } else {
                            dynamicItems.push(new SingleStringInputOpenItem(
                                `Create a new local branch with name: ${lookFor}. ${suffix}`,
                                wrapWithProgress(async () => {
                                    try {
                                        await git.branch(repository, { toCreate: lookFor });
                                        await git.checkout(repository, { branch: lookFor });
                                    } catch (error) {
                                        gitErrorHandler.handleError(error);
                                    }
                                })
                            ));
                        }
                        acceptor(dynamicItems);
                    }
                };
                this.quickOpenService.open(createBranchModel, this.getOptions('The name of the branch:', false));
            };

            items.unshift(new SingleStringInputOpenItem(
                'Create new branch...',
                this.wrapWithProgress(createBranchItem),
                (mode: QuickOpenMode) => mode === QuickOpenMode.OPEN, () => false));
            this.open(items, 'Select a ref to checkout or create a new local branch:');
        });
    }

    async chooseTagsAndBranches(execFunc: (branchName: string, currentBranchName: string) => void, repository: Repository | undefined = this.getRepository()): Promise<void> {
        if (!repository) {
            return;
        }
        return this.withProgress(async () => {
            const [branches, tags, currentBranch] = await Promise.all([this.getBranches(repository), this.getTags(repository), this.getCurrentBranch(repository)]);
            const execute = async (item: GitQuickOpenItem<Branch | Tag>) => {
                execFunc(item.ref.name, currentBranch ? currentBranch.name : '');
            };
            const toLabel = (item: GitQuickOpenItem<Branch | Tag>) => item.ref.name;
            const branchItems = branches.map(branch => new GitQuickOpenItem(branch, this.wrapWithProgress(execute), toLabel));
            const branchName = currentBranch ? `'${currentBranch.name}' ` : '';
            const tagItems = tags.map(tag => new GitQuickOpenItem(tag, execute, toLabel));

            this.open([...branchItems, ...tagItems], `Pick a branch or tag to compare with the currently active ${branchName} branch:`);
        });
    }

    async commitMessageForAmend(): Promise<string> {
        const repository = this.getRepository();
        if (!repository) {
            throw new Error('No repositories were selected.');
        }
        return this.withProgress(async () => {
            const lastMessage = (await this.git.exec(repository, ['log', '--format=%B', '-n', '1'])).stdout.trim();
            if (lastMessage.length === 0) {
                throw new Error(`Repository ${repository.localUri} is not yet initialized.`);
            }
            const message = lastMessage.replace(/[\r\n]+/g, ' ');
            const result = await new Promise<string>((resolve, reject) => {
                const createEditCommitMessageModel: QuickOpenModel = {
                    onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): void {
                        const dynamicItems: QuickOpenItem[] = [];
                        if (!lookFor) {
                            const description = "To reuse the last commit message, press 'Enter' or 'Escape' to cancel.";
                            dynamicItems.push(new GitQuickOpenItem(description, () => resolve(lastMessage), () => description));
                        } else {
                            dynamicItems.push(new GitQuickOpenItem("Rewrite previous commit message. Press 'Enter' to confirm or 'Escape' to cancel.", item => resolve(lookFor)));
                        }
                        acceptor(dynamicItems);
                    },
                };
                const onClose = (canceled: boolean): void => {
                    if (canceled) {
                        reject(new Error('User abort.'));
                    }
                };
                this.quickOpenService.open(createEditCommitMessageModel, this.getOptions(message, false, onClose));
            });
            return result;
        });
    }

    async stash(): Promise<void> {
        const repository = this.getRepository();
        if (!repository) {
            return;
        }
        return this.withProgress(async () => {
            const doStash = this.wrapWithProgress(async (message: string) => {
                this.git.stash(repository, { message });
            });
            const quickOpenModel: QuickOpenModel = {
                onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): void {
                    const dynamicItems: QuickOpenItem[] = [];
                    const suffix = "Press 'Enter' to confirm or 'Escape' to cancel.";

                    if (lookFor === undefined || lookFor.length === 0) {
                        dynamicItems.push(new SingleStringInputOpenItem(
                            `Stash changes. ${suffix}`,
                            () => doStash(lookFor)
                        ));
                    } else {
                        dynamicItems.push(new SingleStringInputOpenItem(
                            `Stash changes with message: ${lookFor}. ${suffix}`,
                            () => doStash(lookFor)
                        ));
                    }
                    acceptor(dynamicItems);
                }
            };
            this.quickOpenService.open(quickOpenModel, this.getOptions('Stash message', false));
        });
    }

    protected async doStashAction(action: 'pop' | 'apply' | 'drop', text: string, getMessage?: () => Promise<string>): Promise<void> {
        const repository = this.getRepository();
        if (!repository) {
            return;
        }
        return this.withProgress(async () => {
            const list = await this.git.stash(repository, { action: 'list' });
            if (list) {
                const quickOpenItems = list.map(stash => new GitQuickOpenItem<StashEntry>(stash, this.wrapWithProgress(async () => {
                    try {
                        await this.git.stash(repository, {
                            action,
                            id: stash.id
                        });
                        if (getMessage) {
                            this.messageService.info(await getMessage());
                        }
                    } catch (error) {
                        this.gitErrorHandler.handleError(error);
                    }
                }), () => stash.message));
                this.open(quickOpenItems, text);
            }
        });
    }

    async applyStash(): Promise<void> {
        this.doStashAction('apply', 'Select a stash to \'apply\'.');
    }

    async popStash(): Promise<void> {
        this.doStashAction('pop', 'Select a stash to \'pop\'.');
    }

    async dropStash(): Promise<void> {
        const repository = this.getRepository();
        if (!repository) {
            return;
        }
        this.doStashAction('drop', 'Select a stash entry to remove it from the list of stash entries.',
            async () => {
                const list = await this.git.stash(repository, { action: 'list' });
                let listString = '';
                list.forEach(stashEntry => {
                    listString += stashEntry.message + '\n';
                });
                return `Stash successfully removed.
                There ${list.length === 1 ? 'is' : 'are'} ${list.length || 'no'} more entry in stash list.
                \n${listString}`;
            });
    }

    async applyLatestStash(): Promise<void> {
        const repository = this.getRepository();
        if (!repository) {
            return;
        }
        return this.withProgress(async () => {
            try {
                await this.git.stash(repository, {
                    action: 'apply'
                });
            } catch (error) {
                this.gitErrorHandler.handleError(error);
            }
        });
    }

    async popLatestStash(): Promise<void> {
        const repository = this.getRepository();
        if (!repository) {
            return;
        }
        return this.withProgress(async () => {
            try {
                await this.git.stash(repository, {
                    action: 'pop'
                });
            } catch (error) {
                this.gitErrorHandler.handleError(error);
            }
        });
    }

    async initRepository(): Promise<void> {
        const wsRoots = await this.workspaceService.roots;
        if (wsRoots && wsRoots.length > 1) {
            const placeholder = 'Choose workspace root to initialize git repo in';
            const items = wsRoots.map<GitQuickOpenItem<URI>>(root => this.toRepositoryPathQuickOpenItem(root));
            this.open(items, placeholder);
        } else {
            const rootUri = wsRoots[0].resource;
            this.doInitRepository(rootUri.toString());
        }
    }

    private async doInitRepository(uri: string): Promise<void> {
        this.withProgress(async () => this.git.exec({ localUri: uri }, ['init']));
    }

    private toRepositoryPathQuickOpenItem(root: FileStat): GitQuickOpenItem<URI> {
        const rootUri = root.resource;
        const toLabel = (item: GitQuickOpenItem<URI>) => this.labelProvider.getName(item.ref);
        const toDescription = (item: GitQuickOpenItem<URI>) => this.labelProvider.getLongName(item.ref.parent);
        const execute = async (item: GitQuickOpenItem<URI>) => {
            const wsRoot = item.ref.toString();
            this.doInitRepository(wsRoot);
        };
        return new GitQuickOpenItem<URI>(rootUri, execute, toLabel, toDescription);
    }

    private open(items: QuickOpenItem | QuickOpenItem[], placeholder: string): void {
        this.quickOpenService.open(this.getModel(Array.isArray(items) ? items : [items]), this.getOptions(placeholder));
    }

    private getOptions(placeholder: string, fuzzyMatchLabel: boolean = true, onClose: (canceled: boolean) => void = () => { }): QuickOpenOptions {
        return QuickOpenOptions.resolve({
            placeholder,
            fuzzyMatchLabel,
            fuzzySort: false,
            onClose
        });
    }

    private getModel(items: QuickOpenItem | QuickOpenItem[]): QuickOpenModel {
        return {
            onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): void {
                acceptor(Array.isArray(items) ? items : [items]);
            }
        };
    }

    private getRepository(): Repository | undefined {
        return this.scmService.selectedRepository
            ? { localUri: this.scmService.selectedRepository.provider.rootUri }
            : undefined;
    }

    private async getRemotes(): Promise<Remote[]> {
        const repository = this.getRepository();
        if (!repository) {
            return [];
        }
        return this.withProgress(async () => {
            try {
                return await this.git.remote(repository, { verbose: true });
            } catch (error) {
                this.gitErrorHandler.handleError(error);
                return [];
            }
        });
    }

    private async getTags(repository: Repository | undefined = this.getRepository()): Promise<Tag[]> {
        if (!repository) {
            return [];
        }
        return this.withProgress(async () => {
            const result = await this.git.exec(repository, ['tag', '--sort=-creatordate']);
            return result.stdout !== '' ? result.stdout.trim().split('\n').map(tag => ({ name: tag })) : [];
        });
    }

    private async getBranches(repository: Repository | undefined = this.getRepository()): Promise<Branch[]> {
        if (!repository) {
            return [];
        }
        return this.withProgress(async () => {
            try {
                const [local, remote] = await Promise.all([
                    this.git.branch(repository, { type: 'local' }),
                    this.git.branch(repository, { type: 'remote' })
                ]);
                return [...local, ...remote];
            } catch (error) {
                this.gitErrorHandler.handleError(error);
                return [];
            }
        });
    }

    private async getCurrentBranch(repository: Repository | undefined = this.getRepository()): Promise<Branch | undefined> {
        if (!repository) {
            return undefined;
        }
        return this.withProgress(async () => {
            try {
                return await this.git.branch(repository, { type: 'current' });
            } catch (error) {
                this.gitErrorHandler.handleError(error);
                return undefined;
            }
        });
    }

    protected withProgress<In, Out>(fn: (...arg: In[]) => Promise<Out>): Promise<Out> {
        return this.progressService.withProgress('', 'scm', fn);
    }

    protected readonly wrapWithProgress = <In, Out>(fn: (...args: In[]) => Promise<Out>) => this.doWrapWithProgress(fn);
    protected doWrapWithProgress<In, Out>(fn: (...args: In[]) => Promise<Out>): (...args: In[]) => Promise<Out> {
        return (...args: In[]) => this.withProgress(() => fn(...args));
    }

}

/**
 * Git specific quick open item that wraps a branch a remote name or something else.
 */
class GitQuickOpenItem<T> extends QuickOpenItem {

    constructor(
        public readonly ref: T,
        protected readonly execute: (item: GitQuickOpenItem<T>) => void,
        private readonly toLabel: (item: GitQuickOpenItem<T>) => string = (item: QuickOpenItem) => `${ref}`,
        private readonly toDescription: (item: GitQuickOpenItem<T>) => string | undefined = (item: QuickOpenItem) => undefined) {

        super();
    }

    run(mode: QuickOpenMode): boolean {
        if (mode !== QuickOpenMode.OPEN) {
            return false;
        }
        this.execute(this);
        return true;
    }

    getLabel(): string {
        return this.toLabel(this);
    }

    getDescription(): string | undefined {
        return this.toDescription(this);
    }

}

class SingleStringInputOpenItem extends QuickOpenItem {

    constructor(
        private readonly label: string,
        private readonly execute: (item: QuickOpenItem) => void = () => { },
        private readonly canRun: (mode: QuickOpenMode) => boolean = mode => mode === QuickOpenMode.OPEN,
        private readonly canClose: (mode: QuickOpenMode) => boolean = mode => true) {

        super();
    }

    getLabel(): string {
        return this.label;
    }

    run(mode: QuickOpenMode): boolean {
        if (!this.canRun(mode)) {
            return false;
        }
        this.execute(this);
        return this.canClose(mode);
    }

}
