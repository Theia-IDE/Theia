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

import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { Disposable, Event, Emitter, ILogger } from '@theia/core';
import { Git, Repository, WorkingDirectoryStatus, GitUtils } from '../common';
import { GitStatusChangeEvent } from '../common/git-watcher';
import { Deferred } from '@theia/core/lib/common/promise-util';

export const GitRepositoryWatcherFactory = Symbol('GitRepositoryWatcherFactory');
export type GitRepositoryWatcherFactory = (options: GitRepositoryWatcherOptions) => GitRepositoryWatcher;

@injectable()
export class GitRepositoryWatcherOptions {
    readonly repository: Repository;
}

@injectable()
export class GitRepositoryWatcher implements Disposable {

    protected readonly onGitStatusChangedEmitter = new Emitter<GitStatusChangeEvent>();
    readonly onGitStatusChanged: Event<GitStatusChangeEvent> = this.onGitStatusChangedEmitter.event;

    @inject(Git)
    protected readonly git: Git;

    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(GitRepositoryWatcherOptions)
    protected readonly options: GitRepositoryWatcherOptions;

    @postConstruct()
    protected init(): void {
        this.spinTheLoop();
    }

    watch(): void {
        if (this.watching) {
            console.debug('Repository watcher is already active.');
            return;
        }
        this.watching = true;
        this.sync();
    }

    protected syncWorkPromises: Deferred<void>[] = [];
    sync(): Promise<void> {
        if (this.idle) {
            if (this.interruptIdle) {
                this.interruptIdle();
            }
        } else {
            this.skipNextIdle = true;
        }
        const result = new Deferred<void>();
        this.syncWorkPromises.push(result);
        return result.promise;
    }

    protected disposed = false;
    dispose(): void {
        if (!this.disposed) {
            this.disposed = true;
            if (this.idle) {
                if (this.interruptIdle) {
                    this.interruptIdle();
                }
            }
        }
    }

    protected watching = false;
    protected idle = true;
    protected interruptIdle: (() => void) | undefined;
    protected skipNextIdle = false;
    protected async spinTheLoop(): Promise<void> {
        while (!this.disposed) {

            // idle
            if (this.skipNextIdle) {
                this.skipNextIdle = false;
            } else {
                const idleTimeout = this.watching ? 5000 : /* super long */ 1000 * 60 * 60 * 24;
                await new Promise<void>(resolve => {
                    const id = setTimeout(resolve, idleTimeout);
                    this.interruptIdle = () => { clearTimeout(id); resolve(); };
                }).then(() => {
                    this.interruptIdle = undefined;
                });
            }

            // work
            await this.syncStatus();
            this.syncWorkPromises.splice(0, this.syncWorkPromises.length).forEach(d => d.resolve());
        }
    }

    protected status: WorkingDirectoryStatus | undefined;
    protected async syncStatus(): Promise<void> {
        try {
            const source = this.options.repository;
            const oldStatus = this.status;
            const newStatus = await this.git.status(source);
            if (!WorkingDirectoryStatus.equals(newStatus, oldStatus)) {
                this.status = newStatus;
                this.onGitStatusChangedEmitter.fire({ source, status: newStatus, oldStatus });
            }
        } catch (error) {
            if (!GitUtils.isRepositoryDoesNotExistError(error)) {
                const { localUri } = this.options.repository;
                this.logger.error('Error occurred while synchronizing the status of the repository.', localUri, error);
            }
        }
    }

}
