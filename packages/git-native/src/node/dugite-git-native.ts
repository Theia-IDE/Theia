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

import * as fs from 'fs-extra';
import { injectable, inject } from 'inversify';
import { git } from 'dugite-extra/lib/core/git';
import { FileUri } from '@theia/core/lib/node/file-uri';
import { ILogger } from '@theia/core';
import { GitNative } from '../common/git-native';
import { Git, Repository } from '@theia/git/lib/common';
import { GitLocator } from './git-locator/git-locator-protocol';
import { GitExecProvider } from '@theia/git/lib/node/git-exec-provider';

/**
 * `dugite-extra` based Git implementation.
 */
@injectable()
export class DugiteGitNative implements GitNative {

    protected readonly limit = 1000;

    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(GitLocator)
    protected readonly locator: GitLocator;

    @inject(Git)
    protected readonly git: Git;

    @inject(GitExecProvider)
    protected readonly execProvider: GitExecProvider;

    dispose(): void {
        this.locator.dispose();
    }

    async repositories(workspaceRootUri: string, options: Git.Options.Repositories): Promise<Repository[]> {
        await this.git.gitIsReady();
        const workspaceRootPath = this.getFsPath(workspaceRootUri);
        const repositories: Repository[] = [];
        const containingPath = await this.resolveContainingPath(workspaceRootPath);
        if (containingPath) {
            repositories.push({
                localUri: this.getUri(containingPath)
            });
        }
        const maxCount = typeof options.maxCount === 'number' ? options.maxCount - repositories.length : undefined;
        if (typeof maxCount === 'number' && maxCount <= 0) {
            return repositories;
        }
        for (const repositoryPath of await this.locator.locate(workspaceRootPath, {
            maxCount
        })) {
            if (containingPath !== repositoryPath) {
                repositories.push({
                    localUri: this.getUri(repositoryPath)
                });
            }
        }
        return repositories;
    }

    // TODO: akitta what about symlinks? What if the workspace root is a symlink?
    // Maybe, we should use `--show-cdup` here instead of `--show-toplevel` because `show-toplevel` dereferences symlinks.
    private async resolveContainingPath(repositoryPath: string): Promise<string | undefined> {
        await this.git.gitIsReady();
        // Do not log an error if we are not contained in a Git repository. Treat exit code 128 as a success too.
        const [exec, env] = await Promise.all([this.execProvider.exec(), this.git.getGitEnv()]);
        const options = { successExitCodes: new Set([0, 128]), exec, env };
        const result = await git(['rev-parse', '--show-toplevel'], repositoryPath, 'rev-parse', options);
        const out = result.stdout;
        if (out && out.length !== 0) {
            try {
                return fs.realpathSync(out.trim());
            } catch (e) {
                this.logger.error(e);
                return undefined;
            }
        }
        return undefined;
    }

    private getFsPath(repository: Repository | string): string {
        const uri = typeof repository === 'string' ? repository : repository.localUri;
        return FileUri.fsPath(uri);
    }

    private getUri(path: string): string {
        return FileUri.create(path).toString();
    }

}
