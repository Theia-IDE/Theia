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

import { injectable, inject } from 'inversify';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { FileSystem } from '@theia/filesystem/lib/common';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import URI from '@theia/core/lib/common/uri';
import { FileSystemWatcher } from '@theia/filesystem/lib/browser/filesystem-watcher';
import { Hg, Repository } from '../common';
import { HgCommitMessageValidator } from './hg-commit-message-validator';
import { HgScmProvider } from './hg-scm-provider';
import { ScmService } from '@theia/scm/lib/browser/scm-service';
import { ScmRepository } from '@theia/scm/lib/browser/scm-repository';

export interface HgRefreshOptions {
    readonly maxCount: number
}

@injectable()
export class HgRepositoryProvider {

    protected readonly onDidChangeRepositoryEmitter = new Emitter<Repository | undefined>();
    protected readonly selectedRepoStorageKey = 'theia-hg-selected-repository';
    protected readonly allRepoStorageKey = 'theia-hg-all-repositories';

    @inject(HgScmProvider.ContainerFactory)
    protected readonly scmProviderFactory: HgScmProvider.ContainerFactory;

    @inject(HgCommitMessageValidator)
    protected readonly commitMessageValidator: HgCommitMessageValidator;

    constructor(
        @inject(Hg) protected readonly hg: Hg,
        @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService,
        @inject(FileSystemWatcher) protected readonly watcher: FileSystemWatcher,
        @inject(FileSystem) protected readonly fileSystem: FileSystem,
        @inject(ScmService) protected readonly scmService: ScmService,
        @inject(StorageService) protected readonly storageService: StorageService
    ) {
        this.initialize();
    }

    protected async initialize(): Promise<void> {
        const [selectedRepository, allRepositories] = await Promise.all([
            this.storageService.getData<Repository | undefined>(this.selectedRepoStorageKey),
            this.storageService.getData<Repository[]>(this.allRepoStorageKey)
        ]);

        this.scmService.onDidChangeSelectedRepository(scmRepository => this.fireDidChangeRepository(this.toHgRepository(scmRepository)));
        if (allRepositories) {
            this.updateRepositories(allRepositories);
        } else {
            await this.refresh({ maxCount: 1 });
        }
        this.selectedRepository = selectedRepository;

        await this.refresh();
        this.watcher.onFilesChanged(_changedFiles => this.lazyRefresh());
    }

    protected lazyRefresh: () => Promise<void> = debounce(() => this.refresh(), 1000);

    /**
     * Returns with the previously selected repository, or if no repository has been selected yet,
     * it picks the first available repository from the backend and sets it as the selected one and returns with that.
     * If no repositories are available, returns `undefined`.
     */
    get selectedRepository(): Repository | undefined {
        return this.toHgRepository(this.scmService.selectedRepository);
    }

    /**
     * Sets the selected repository, but do nothing if the given repository is not a Mercurial repository
     * registered with the SCM service.  We must be sure not to clear the selection if the selected
     * repository is managed by an SCM other than Mercurial.
     */
    set selectedRepository(repository: Repository | undefined) {
        const scmRepository = this.toScmRepository(repository);
        if (scmRepository) {
            this.scmService.selectedRepository = scmRepository;
        }
    }

    get selectedScmRepository(): HgScmRepository | undefined {
        return this.toHgScmRepository(this.scmService.selectedRepository);
    }

    get selectedScmProvider(): HgScmProvider | undefined {
        return this.toHgScmProvider(this.scmService.selectedRepository);
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
            const repository = this.toHgRepository(scmRepository);
            if (repository) {
                repositories.push(repository);
            }
        }
        return repositories;
    }

    findRepository(uri: URI): Repository | undefined {
        const reposSorted = this.allRepositories.sort(Repository.sortComparator);
        return reposSorted.find(repo => new URI(repo.localUri).isEqualOrParent(uri));
    }

    async refresh(options?: HgRefreshOptions): Promise<void> {
        const repositories: Repository[] = [];
        const refreshing: Promise<void>[] = [];
        for (const root of await this.workspaceService.roots) {
            refreshing.push(this.hg.repositories(root.uri, { ...options }).then(
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
            const repository = this.toHgRepository(scmRepository);
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
        const providerContainer = this.scmProviderFactory({ repository });
        const provider = providerContainer.get(HgScmProvider);
        this.scmService.registerScmProvider(provider, {
            input: {
                placeholder: 'Message (press {0} to commit)',
                validator: async value => {
                    const issue = await this.commitMessageValidator.validate(value);
                    return issue && {
                        message: issue.message,
                        type: issue.status
                    };
                },
                providerContainer
            }
        });
    }

    protected toScmRepository(repository: Repository | undefined): ScmRepository | undefined {
        return repository && this.scmService.repositories.find(scmRepository => Repository.equal(this.toHgRepository(scmRepository), repository));
    }

    protected toHgRepository(scmRepository: ScmRepository | undefined): Repository | undefined {
        const provider = this.toHgScmProvider(scmRepository);
        return provider && provider.repository;
    }

    protected toHgScmProvider(scmRepository: ScmRepository | undefined): HgScmProvider | undefined {
        const hgScmRepository = this.toHgScmRepository(scmRepository);
        return hgScmRepository && hgScmRepository.provider;
    }

    protected toHgScmRepository(scmRepository: ScmRepository | undefined): HgScmRepository | undefined {
        return HgScmRepository.is(scmRepository) ? scmRepository : undefined;
    }

}

export interface HgScmRepository extends ScmRepository {
    readonly provider: HgScmProvider;
}
export namespace HgScmRepository {
    export function is(scmRepository: ScmRepository | undefined): scmRepository is HgScmRepository {
        return !!scmRepository && scmRepository.provider instanceof HgScmProvider;
    }
}
