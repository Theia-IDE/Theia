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

import debounce = require('lodash.debounce');

import { injectable, inject, postConstruct } from 'inversify';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import { Git, Repository } from '@theia/git/lib/common';
import { GitNative } from '../common/git-native';
import { GitCommitMessageValidator } from './git-commit-message-validator';
import { GitScmProvider } from './git-scm-provider';
import { ScmService } from '@theia/scm/lib/browser/scm-service';
import { ScmRepository } from '@theia/scm/lib/browser/scm-repository';
import { FileService } from '@theia/filesystem/lib/browser/file-service';

export interface GitRefreshOptions {
    readonly maxCount: number
}

@injectable()
export class GitRepositoryProvider {

    protected readonly onDidChangeRepositoryEmitter = new Emitter<Repository | undefined>();
    protected readonly selectedRepoStorageKey = 'theia-git-selected-repository';
    protected readonly allRepoStorageKey = 'theia-git-all-repositories';

    @inject(GitScmProvider.Factory)
    protected readonly scmProviderFactory: GitScmProvider.Factory;

    @inject(GitCommitMessageValidator)
    protected readonly commitMessageValidator: GitCommitMessageValidator;

    @inject(Git) protected readonly git: Git;
    @inject(GitNative) protected readonly gitNative: GitNative;
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(ScmService) protected readonly scmService: ScmService;
    @inject(StorageService) protected readonly storageService: StorageService;

    @inject(FileService)
    protected readonly fileService: FileService;

    @postConstruct()
    protected async initialize(): Promise<void> {
        const [selectedRepository, allRepositories] = await Promise.all([
            this.storageService.getData<Repository | undefined>(this.selectedRepoStorageKey),
            this.storageService.getData<Repository[]>(this.allRepoStorageKey)
        ]);

        this.scmService.onDidChangeSelectedRepository(scmRepository => this.fireDidChangeRepository(this.toGitRepository(scmRepository)));
        if (allRepositories) {
            this.updateRepositories(allRepositories);
        } else {
            await this.refresh({ maxCount: 1 });
        }
        this.selectedRepository = selectedRepository;

        await this.refresh();
        this.fileService.onDidFilesChange(_ => this.lazyRefresh());
    }

    protected lazyRefresh: () => Promise<void> | undefined = debounce(() => this.refresh(), 1000);

    /**
     * Returns with the previously selected repository, or if no repository has been selected yet,
     * it picks the first available repository from the backend and sets it as the selected one and returns with that.
     * If no repositories are available, returns `undefined`.
     */
    get selectedRepository(): Repository | undefined {
        return this.toGitRepository(this.scmService.selectedRepository);
    }

    /**
     * Sets the selected repository, but do nothing if the given repository is not a Git repository
     * registered with the SCM service.  We must be sure not to clear the selection if the selected
     * repository is managed by an SCM other than Git.
     */
    set selectedRepository(repository: Repository | undefined) {
        const scmRepository = this.toScmRepository(repository);
        if (scmRepository) {
            this.scmService.selectedRepository = scmRepository;
        }
    }

    get selectedScmRepository(): GitScmRepository | undefined {
        return this.toGitScmRepository(this.scmService.selectedRepository);
    }

    get selectedScmProvider(): GitScmProvider | undefined {
        return this.toGitScmProvider(this.scmService.selectedRepository);
    }

    get onDidChangeRepository(): Event<Repository | undefined> {
        return this.onDidChangeRepositoryEmitter.event;
    }
    protected fireDidChangeRepository(repository: Repository | undefined): void {
        this.storageService.setData<Repository | undefined>(this.selectedRepoStorageKey, repository);
        this.onDidChangeRepositoryEmitter.fire(repository);
    }

    /**
     * Returns with all know repositories.
     */
    get allRepositories(): Repository[] {
        const repositories = [];
        for (const scmRepository of this.scmService.repositories) {
            const repository = this.toGitRepository(scmRepository);
            if (repository) {
                repositories.push(repository);
            }
        }
        return repositories;
    }

    async refresh(options?: GitRefreshOptions): Promise<void> {
        const repositories: Repository[] = [];
        const refreshing: Promise<void>[] = [];
        for (const root of await this.workspaceService.roots) {
            refreshing.push(this.gitNative.repositories(root.resource.toString(), { ...options }).then(
                result => { repositories.push(...result); },
                () => { /* no-op*/ }
            ));
        }
        await Promise.all(refreshing);
        this.updateRepositories(repositories);
    }

    protected updateRepositories(repositories: Repository[]): void {
        this.storageService.setData<Repository[]>(this.allRepoStorageKey, repositories);

        const registered = new Set<string>();
        const toUnregister = new Map<string, ScmRepository>();
        for (const scmRepository of this.scmService.repositories) {
            const repository = this.toGitRepository(scmRepository);
            if (repository) {
                registered.add(repository.localUri);
                toUnregister.set(repository.localUri, scmRepository);
            }
        }

        for (const repository of repositories) {
            toUnregister.delete(repository.localUri);
            if (!registered.has(repository.localUri)) {
                registered.add(repository.localUri);
                this.registerScmProvider(repository);
            }
        }

        for (const [, scmRepository] of toUnregister) {
            scmRepository.dispose();
        }
    }

    protected registerScmProvider(repository: Repository): void {
        const provider = this.scmProviderFactory({ repository });
        const scmRepository = this.scmService.registerScmProvider(provider, {
            input: {
                placeholder: 'Message (press {0} to commit)',
                validator: async value => {
                    const issue = await this.commitMessageValidator.validate(value);
                    return issue && {
                        message: issue.message,
                        type: issue.status
                    };
                }
            }
        });
        provider.input = scmRepository.input;
    }

    protected toScmRepository(repository: Repository | undefined): ScmRepository | undefined {
        return repository && this.scmService.repositories.find(scmRepository => Repository.equal(this.toGitRepository(scmRepository), repository));
    }

    protected toGitRepository(scmRepository: ScmRepository | undefined): Repository | undefined {
        const provider = this.toGitScmProvider(scmRepository);
        return provider && provider.repository;
    }

    protected toGitScmProvider(scmRepository: ScmRepository | undefined): GitScmProvider | undefined {
        const gitScmRepository = this.toGitScmRepository(scmRepository);
        return gitScmRepository && gitScmRepository.provider;
    }

    protected toGitScmRepository(scmRepository: ScmRepository | undefined): GitScmRepository | undefined {
        return GitScmRepository.is(scmRepository) ? scmRepository : undefined;
    }

}

export interface GitScmRepository extends ScmRepository {
    readonly provider: GitScmProvider;
}
export namespace GitScmRepository {
    export function is(scmRepository: ScmRepository | undefined): scmRepository is GitScmRepository {
        return !!scmRepository && scmRepository.provider instanceof GitScmProvider;
    }
}
