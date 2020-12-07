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

import { interfaces } from 'inversify';
import * as path from 'path';
import * as temp from 'temp';
import * as fs from 'fs-extra';
import { expect } from 'chai';
import { FileUri } from '@theia/core/lib/node/file-uri';
import { initRepository } from 'dugite-extra/lib/command/test-helper';
import { initializeBindings } from '@theia/git/lib/node/test/binding-helper';
import { isWindows } from '@theia/core/lib/common/os';
import { GitNative } from '../common/git-native';
import { DugiteGit } from '@theia/git/lib/node/dugite-git';
import { DugiteGitNative } from './dugite-git-native';
import { bindGit, GitBindingOptions } from '@theia/git/lib/node/git-backend-module';
import { bindGitLocator } from './git-native-backend-module';
import { NoSyncRepositoryManager } from '@theia/git/lib/node/test/no-sync-repository-manager';
import { LogLevel } from '@theia/core/lib/common';
import { ILogger } from '@theia/core/lib/common/logger';

/* eslint-disable max-len, no-unused-expressions */

const track = temp.track();

export async function createGitNative(bindingOqqptions: GitBindingOptions = GitBindingOptions.Default): Promise<GitNative> {
    const { container, bind } = initializeBindings();
    bindGit(bind, {
        bindManager(binding: interfaces.BindingToSyntax<{}>): interfaces.BindingWhenOnSyntax<{}> {
            return binding.to(NoSyncRepositoryManager).inSingletonScope();
        }
    });
    bindGitLocator(bind);

    (container.get(ILogger) as ILogger).setLogLevel(LogLevel.ERROR);
    const git = container.get(DugiteGit);
    await git.exec({ localUri: '' }, ['--version']); // Enforces eager Git initialization by setting the `LOCAL_GIT_DIRECTORY` and `GIT_EXEC_PATH` env variables.

    bind(DugiteGitNative).toSelf().inSingletonScope();
    bind(GitNative).toService(DugiteGitNative);

    const gitNative = container.get(DugiteGitNative);
    return gitNative;
}

describe('git', async function (): Promise<void> {

    this.timeout(10000);

    after(async () => {
        track.cleanupSync();
    });

    describe('repositories', async () => {

        it('should discover only first repository', async () => {

            const root = track.mkdirSync('discovery-test-1');
            fs.mkdirSync(path.join(root, 'A'));
            fs.mkdirSync(path.join(root, 'B'));
            fs.mkdirSync(path.join(root, 'C'));
            const git = await createGitNative();
            await initRepository(path.join(root, 'A'));
            await initRepository(path.join(root, 'B'));
            await initRepository(path.join(root, 'C'));
            const workspaceRootUri = FileUri.create(root).toString();
            const repositories = await git.repositories(workspaceRootUri, { maxCount: 1 });
            expect(repositories.length).to.deep.equal(1);

        });

        it('should discover all nested repositories', async () => {

            const root = track.mkdirSync('discovery-test-2');
            fs.mkdirSync(path.join(root, 'A'));
            fs.mkdirSync(path.join(root, 'B'));
            fs.mkdirSync(path.join(root, 'C'));
            const git = await createGitNative();
            await initRepository(path.join(root, 'A'));
            await initRepository(path.join(root, 'B'));
            await initRepository(path.join(root, 'C'));
            const workspaceRootUri = FileUri.create(root).toString();
            const repositories = await git.repositories(workspaceRootUri, {});
            expect(repositories.map(r => path.basename(FileUri.fsPath(r.localUri))).sort()).to.deep.equal(['A', 'B', 'C']);

        });

        it('should discover all nested repositories and the root repository which is at the workspace root', async function (): Promise<void> {
            if (isWindows) {
                // https://github.com/eclipse-theia/theia/issues/933
                this.skip();
                return;
            }

            const root = track.mkdirSync('discovery-test-3');
            fs.mkdirSync(path.join(root, 'BASE'));
            fs.mkdirSync(path.join(root, 'BASE', 'A'));
            fs.mkdirSync(path.join(root, 'BASE', 'B'));
            fs.mkdirSync(path.join(root, 'BASE', 'C'));
            const git = await createGitNative();
            await initRepository(path.join(root, 'BASE'));
            await initRepository(path.join(root, 'BASE', 'A'));
            await initRepository(path.join(root, 'BASE', 'B'));
            await initRepository(path.join(root, 'BASE', 'C'));
            const workspaceRootUri = FileUri.create(path.join(root, 'BASE')).toString();
            const repositories = await git.repositories(workspaceRootUri, {});
            expect(repositories.map(r => path.basename(FileUri.fsPath(r.localUri))).sort()).to.deep.equal(['A', 'B', 'BASE', 'C']);

        });

        it('should discover all nested repositories and the container repository', async () => {

            const root = track.mkdirSync('discovery-test-4');
            fs.mkdirSync(path.join(root, 'BASE'));
            fs.mkdirSync(path.join(root, 'BASE', 'WS_ROOT'));
            fs.mkdirSync(path.join(root, 'BASE', 'WS_ROOT', 'A'));
            fs.mkdirSync(path.join(root, 'BASE', 'WS_ROOT', 'B'));
            fs.mkdirSync(path.join(root, 'BASE', 'WS_ROOT', 'C'));
            const git = await createGitNative();
            await initRepository(path.join(root, 'BASE'));
            await initRepository(path.join(root, 'BASE', 'WS_ROOT', 'A'));
            await initRepository(path.join(root, 'BASE', 'WS_ROOT', 'B'));
            await initRepository(path.join(root, 'BASE', 'WS_ROOT', 'C'));
            const workspaceRootUri = FileUri.create(path.join(root, 'BASE', 'WS_ROOT')).toString();
            const repositories = await git.repositories(workspaceRootUri, {});
            const repositoryNames = repositories.map(r => path.basename(FileUri.fsPath(r.localUri)));
            expect(repositoryNames.shift()).to.equal('BASE'); // The first must be the container repository.
            expect(repositoryNames.sort()).to.deep.equal(['A', 'B', 'C']);

        });

    });
});
