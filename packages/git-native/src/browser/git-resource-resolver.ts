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
import { Git, Repository } from '@theia/git/lib/common';
import { Resource, ResourceResolver } from '@theia/core';
import URI from '@theia/core/lib/common/uri';
import { GitRepositoryProvider } from './git-repository-provider';
import { GIT_RESOURCE_SCHEME, GitResource } from '@theia/git/lib/browser/git-resource';

@injectable()
export class GitResourceResolver implements ResourceResolver {

    constructor(
        @inject(Git) protected readonly git: Git,
        @inject(GitRepositoryProvider) protected readonly repositoryProvider: GitRepositoryProvider
    ) { }

    resolve(uri: URI): Resource | Promise<Resource> {
        if (uri.scheme !== GIT_RESOURCE_SCHEME) {
            throw new Error(`Expected a URI with ${GIT_RESOURCE_SCHEME} scheme. Was: ${uri}.`);
        }
        return this.getResource(uri);
    }

    async getResource(uri: URI): Promise<GitResource> {
        const repository = await this.getRepository(uri);
        return new GitResource(uri, repository, this.git);
    }

    async getRepository(uri: URI): Promise<Repository | undefined> {
        const fileUri = uri.withScheme('file');
        const repositories = this.repositoryProvider.allRepositories;
        // The layout restorer might ask for the known repositories this point.
        if (repositories.length === 0) {
            // So let's make sure, the repository provider state is in sync with the backend.
            await this.repositoryProvider.refresh();
            repositories.push(...this.repositoryProvider.allRepositories);
        }
        // We sort by length so that we visit the nested repositories first.
        // We do not want to get the repository A instead of B if we have:
        // repository A, another repository B inside A and a resource A/B/C.ext.
        const sortedRepositories = repositories.sort((a, b) => b.localUri.length - a.localUri.length);
        for (const repository of sortedRepositories) {
            const localUri = new URI(repository.localUri);
            // make sure that localUri of repository has file scheme.
            const localUriStr = localUri.withScheme('file').toString();
            if (fileUri.toString().startsWith(localUriStr)) {
                return { localUri: localUriStr };
            }
        }
        return undefined;
    }
}
