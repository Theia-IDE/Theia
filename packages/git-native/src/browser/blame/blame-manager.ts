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
import { Git, GitFileBlame } from '@theia/git/lib/common';
import { GitRepositoryTracker } from '../git-repository-tracker';
import URI from '@theia/core/lib/common/uri';

@injectable()
export class BlameManager {

    @inject(Git)
    protected readonly git: Git;

    @inject(GitRepositoryTracker)
    protected readonly repositoryTracker: GitRepositoryTracker;

    isBlameable(uri: string): boolean {
        return !!this.repositoryTracker.getPath(new URI(uri));
    }

    async getBlame(uri: string, content?: string): Promise<GitFileBlame | undefined> {
        const repository = this.repositoryTracker.selectedRepository;
        if (!repository) {
            return undefined;
        }
        return this.git.blame(repository, uri, { content });
    }

}
