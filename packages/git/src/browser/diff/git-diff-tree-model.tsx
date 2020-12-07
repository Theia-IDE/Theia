/********************************************************************************
 * Copyright (C) 2020 Arm and others.
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
import { DisposableCollection } from '@theia/core/lib/common';
import URI from '@theia/core/lib/common/uri';
import { ScmTreeModel } from '@theia/scm/lib/browser/scm-tree-model';
import { Git, GitFileStatus } from '../../common';
import { ScmService } from '@theia/scm/lib/browser/scm-service';
import { GitScmFileChange } from '../git-scm-file-change';
import { LabelProvider } from '@theia/core/lib/browser';
import { ScmResourceGroup, ScmResource } from '@theia/scm/lib/browser/scm-provider';
import { ScmFileChange } from '@theia/scm-extra/lib/browser/scm-file-change-node';
import { GitResourceOpener } from './git-resource-opener';
import { ScmRepository } from '@theia/scm/lib/browser/scm-repository';

@injectable()
export class GitDiffTreeModel extends ScmTreeModel {

    @inject(Git) protected readonly git: Git;
    @inject(LabelProvider) protected readonly labelProvider: LabelProvider;
    @inject(ScmService) protected readonly scmService: ScmService;
    @inject(GitResourceOpener) protected readonly resourceOpener: GitResourceOpener;

    protected diffOptions: Git.Options.Diff;

    protected _groups: ScmResourceGroup[] = [];

    protected readonly toDisposeOnContentChange = new DisposableCollection();

    constructor() {
        super();
        this.toDispose.push(this.toDisposeOnContentChange);
    }

    async setContent(options: GitDiffTreeModel.Options): Promise<void> {
        const { rootUri, diffOptions } = options;
        this.toDisposeOnContentChange.dispose();
        const scmRepository = this.scmService.findRepository(new URI(rootUri));
        if (scmRepository && scmRepository.provider.id === 'git') {
            this.provider = scmRepository.provider;
            this.diffOptions = diffOptions;

            this.refreshRepository(scmRepository);
            this.toDisposeOnContentChange.push(scmRepository.provider.onDidChange(() => {
                this.refreshRepository(scmRepository);
            }));

        }
    }

    protected async refreshRepository(scmRepository: ScmRepository): Promise<void> {
        const provider = scmRepository.provider;
        const repository = { localUri: scmRepository.provider.rootUri };

        const gitFileChanges = await this.git.diff(repository, this.diffOptions);

        const context = {
            rootUri: scmRepository.provider.rootUri,
            labelProvider: this.labelProvider,
        };

        const group: ScmResourceGroup = { id: 'changes', label: 'Files Changed', resources: [], provider, dispose: () => { } };
        const resources: ScmResource[] = gitFileChanges
            .map(change => new GitScmFileChange(change, context, this.diffOptions.range))
            .map(change => ({
                sourceUri: new URI(change.uri),
                decorations: {
                    letter: GitFileStatus.toAbbreviation(change.gitFileChange.status, true),
                    color: GitFileStatus.getColor(change.gitFileChange.status, true),
                    tooltip: GitFileStatus.toString(change.gitFileChange.status, true)
                },
                open: async () => this.open(change),
                group,
            }));
        const changesGroup = { ...group, resources };
        this._groups = [changesGroup];

        this.root = this.createTree();
    }

    get rootUri(): string | undefined {
        if (this.provider) {
            return this.provider.rootUri;
        }
    };

    canTabToWidget(): boolean {
        return true;
    }

    get groups(): ScmResourceGroup[] {
        return this._groups;
    };

    async open(change: ScmFileChange): Promise<void> {
        const uriToOpen = change.getUriToOpen();
        await this.resourceOpener.open(uriToOpen);
    }

    storeState(): GitDiffTreeModel.Options {
        if (this.provider) {
            return {
                ...super.storeState(),
                rootUri: this.provider.rootUri,
                diffOptions: this.diffOptions,
            };
        } else {
            return super.storeState();
        }
    }

    restoreState(oldState: GitDiffTreeModel.Options): void {
        super.restoreState(oldState);
        if (oldState.rootUri && oldState.diffOptions) {
            this.setContent(oldState);
        }
    }
}

export namespace GitDiffTreeModel {
    export interface Options {
        rootUri: string,
        diffOptions: Git.Options.Diff,
    };
}
