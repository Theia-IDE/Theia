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

import { injectable, inject, postConstruct } from 'inversify';
import { Git, Repository, WorkingDirectoryStatus } from '@theia/git/lib/common';
import { Event, Emitter, Disposable, DisposableCollection, CancellationToken, CancellationTokenSource } from '@theia/core';
import { GitRepositoryProvider } from './git-repository-provider';
import { GitWatcher, GitStatusChangeEvent } from '@theia/git/lib/common/git-watcher';
import URI from '@theia/core/lib/common/uri';

import debounce = require('lodash.debounce');

/**
 * The repository tracker watches the selected repository for status changes. It provides a convenient way to listen on status updates.
 */
@injectable()
export class GitRepositoryTracker {

    protected toDispose = new DisposableCollection();
    protected workingDirectoryStatus: WorkingDirectoryStatus | undefined;
    protected readonly onGitEventEmitter = new Emitter<GitStatusChangeEvent | undefined>();

    constructor(
        @inject(Git) protected readonly git: Git,
        @inject(GitRepositoryProvider) protected readonly repositoryProvider: GitRepositoryProvider,
        @inject(GitWatcher) protected readonly gitWatcher: GitWatcher,
    ) { }

    @postConstruct()
    protected async init(): Promise<void> {
        this.updateStatus();
        this.repositoryProvider.onDidChangeRepository(() => this.updateStatus());
    }

    protected updateStatus = debounce(async (): Promise<void> => {
        this.toDispose.dispose();
        const tokenSource = new CancellationTokenSource();
        this.toDispose.push(Disposable.create(() => tokenSource.cancel()));
        const token = tokenSource.token;
        const source = this.selectedRepository;
        if (source) {
            const status = await this.git.status(source);
            this.setStatus({ source, status }, token);
            this.toDispose.push(this.gitWatcher.onGitEvent(event => {
                if (event.source.localUri === source.localUri) {
                    this.setStatus(event, token);
                }
            }));
            this.toDispose.push(await this.gitWatcher.watchGitChanges(source));
        } else {
            this.setStatus(undefined, token);
        }
    }, 50);

    protected setStatus(event: GitStatusChangeEvent | undefined, token: CancellationToken): void {
        const status = event && event.status;
        const scmProvider = this.repositoryProvider.selectedScmProvider;
        if (scmProvider) {
            scmProvider.setStatus(status);
        }
        this.workingDirectoryStatus = status;
        this.onGitEventEmitter.fire(event);
    }

    /**
     * Returns the selected repository, or `undefined` if no repositories are available.
     */
    get selectedRepository(): Repository | undefined {
        return this.repositoryProvider.selectedRepository;
    }

    /**
     * Returns all known repositories.
     */
    get allRepositories(): Repository[] {
        return this.repositoryProvider.allRepositories;
    }

    /**
     * Returns the last known status of the selected repository, or `undefined` if no repositories are available.
     */
    get selectedRepositoryStatus(): WorkingDirectoryStatus | undefined {
        return this.workingDirectoryStatus;
    }

    /**
     * Emits when the selected repository has changed.
     */
    get onDidChangeRepository(): Event<Repository | undefined> {
        return this.repositoryProvider.onDidChangeRepository;
    }

    /**
     * Emits when status has changed in the selected repository.
     */
    get onGitEvent(): Event<GitStatusChangeEvent | undefined> {
        return this.onGitEventEmitter.event;
    }

    getPath(uri: URI): string | undefined {
        const { repositoryUri } = this;
        const relativePath = repositoryUri && Repository.relativePath(repositoryUri, uri);
        return relativePath && relativePath.toString();
    }

    getUri(path: string): URI | undefined {
        const { repositoryUri } = this;
        return repositoryUri && repositoryUri.resolve(path);
    }

    get repositoryUri(): URI | undefined {
        const repository = this.selectedRepository;
        return repository && new URI(repository.localUri);
    }

}
