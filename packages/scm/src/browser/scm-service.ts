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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { DisposableCollection, Emitter, ContributionProvider } from '@theia/core/lib/common';
import { injectable, inject, named } from 'inversify';
import { ScmContextKeyService } from './scm-context-key-service';
import { ScmRepository, ScmProviderOptions } from './scm-repository';
import { ScmCommand, ScmProvider } from './scm-provider';
import URI from '@theia/core/lib/common/uri';

export const ScmExtraSupportContribution = Symbol('ScmExtraSupportContribution');

export interface ScmExtraSupportContribution {

    /**
     * The provider id, which ideally would be the same for different provider implementations
     * of the same repository (eg 'git' for both vs-code builtin and Theia native implementation).
     */
    readonly id: string;

    /**
     * Create the implementation given the repository.
     */
    readonly addExtraSupport: (provider: ScmProvider) => void;
}

@injectable()
export class ScmService {

    @inject(ScmContextKeyService)
    protected readonly contextKeys: ScmContextKeyService;

    @inject(ContributionProvider) @named(ScmExtraSupportContribution)
    protected readonly extraSupportProviders: ContributionProvider<ScmExtraSupportContribution>;

    protected readonly _repositories = new Map<string, ScmRepository>();
    protected _selectedRepository: ScmRepository | undefined;

    protected readonly onDidChangeSelectedRepositoryEmitter = new Emitter<ScmRepository | undefined>();
    readonly onDidChangeSelectedRepository = this.onDidChangeSelectedRepositoryEmitter.event;

    protected readonly onDidAddRepositoryEmitter = new Emitter<ScmRepository>();
    readonly onDidAddRepository = this.onDidAddRepositoryEmitter.event;

    protected readonly onDidRemoveRepositoryEmitter = new Emitter<ScmRepository>();
    readonly onDidRemoveRepository = this.onDidAddRepositoryEmitter.event;

    protected readonly onDidChangeStatusBarCommandsEmitter = new Emitter<ScmCommand[]>();
    readonly onDidChangeStatusBarCommands = this.onDidChangeStatusBarCommandsEmitter.event;
    protected fireDidChangeStatusBarCommands(): void {
        this.onDidChangeStatusBarCommandsEmitter.fire(this.statusBarCommands);
    }
    get statusBarCommands(): ScmCommand[] {
        const repository = this.selectedRepository;
        return repository && repository.provider.statusBarCommands || [];
    }

    get repositories(): ScmRepository[] {
        return [...this._repositories.values()];
    }

    get selectedRepository(): ScmRepository | undefined {
        return this._selectedRepository;
    }

    protected readonly toDisposeOnSelected = new DisposableCollection();
    set selectedRepository(repository: ScmRepository | undefined) {
        if (this._selectedRepository === repository) {
            return;
        }
        this.toDisposeOnSelected.dispose();
        this._selectedRepository = repository;
        if (this._selectedRepository) {
            if (this._selectedRepository.provider.onDidChangeStatusBarCommands) {
                this.toDisposeOnSelected.push(this._selectedRepository.provider.onDidChangeStatusBarCommands(() => this.fireDidChangeStatusBarCommands()));
            }
        }
        this.onDidChangeSelectedRepositoryEmitter.fire(this._selectedRepository);
        this.fireDidChangeStatusBarCommands();
    }

    findRepository(uri: URI): ScmRepository | undefined {
        const reposSorted = this.repositories.sort(
            (ra: ScmRepository, rb: ScmRepository) => rb.provider.rootUri.length - ra.provider.rootUri.length
        );
        return reposSorted.find(repo => new URI(repo.provider.rootUri).isEqualOrParent(uri));
    }

    registerScmProvider(provider: ScmProvider, options: ScmProviderOptions = {}): ScmRepository {
        const contributions = this.extraSupportProviders.getContributions().filter(c =>  c.id === provider.id);
        for (const contribution of contributions) {
            contribution.addExtraSupport(provider);
        }

        const key = provider.id + ':' + provider.rootUri;
        if (this._repositories.has(key)) {
            throw new Error(`${provider.label} provider for '${provider.rootUri}' already exists.`);
        }
        const repository = new ScmRepository(provider, options);
        const dispose = repository.dispose;
        repository.dispose = () => {
            this._repositories.delete(key);
            dispose.bind(repository)();
            this.onDidRemoveRepositoryEmitter.fire(repository);
            if (this._selectedRepository === repository) {
                this.selectedRepository = this._repositories.values().next().value;
            }
        };
        this._repositories.set(key, repository);
        this.onDidAddRepositoryEmitter.fire(repository);
        if (this._repositories.size === 1) {
            this.selectedRepository = repository;
        }
        return repository;
    }

}
