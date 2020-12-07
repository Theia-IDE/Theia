/********************************************************************************
 * Copyright (C) 2018 Ericsson and others.
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

import { enableJSDOM } from '@theia/core/lib/browser/test/jsdom';
let disableJSDOM = enableJSDOM();

import { FrontendApplicationConfigProvider } from '@theia/core/lib/browser/frontend-application-config-provider';
import { ApplicationProps } from '@theia/application-package/lib/application-props';
FrontendApplicationConfigProvider.set({
    ...ApplicationProps.DEFAULT.frontend.config
});
import { bindContributionProvider } from '@theia/core/lib/common';

import { Container } from 'inversify';
import { Git, Repository } from '@theia/git/lib/common';
import { DugiteGit } from '@theia/git/lib/node/dugite-git';
import { GitNative } from '../common/git-native';
import { DugiteGitNative } from '../node/dugite-git-native';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { FileStat, FileChangesEvent } from '@theia/filesystem/lib/common/files';
import { Emitter, CommandService } from '@theia/core';
import { LocalStorageService, StorageService, LabelProvider } from '@theia/core/lib/browser';
import { GitRepositoryProvider } from './git-repository-provider';
import * as sinon from 'sinon';
import * as chai from 'chai';
import { GitCommitMessageValidator } from './git-commit-message-validator';
import { ScmService, ScmExtraSupportContribution } from '@theia/scm/lib/browser/scm-service';
import { ScmContextKeyService } from '@theia/scm/lib/browser/scm-context-key-service';
import { ContextKeyService } from '@theia/core/lib/browser/context-key-service';
import { GitScmProvider } from './git-scm-provider';
import { createGitScmProviderFactory } from './git-native-frontend-module';
import { EditorManager } from '@theia/editor/lib/browser';
import { GitErrorHandler } from '@theia/git/lib/browser/git-error-handler';
import { GitPreferences } from './git-preferences';
import { GitRepositoryTracker } from './git-repository-tracker';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
const expect = chai.expect;

disableJSDOM();

const folderA = FileStat.dir('file:///home/repoA');
const repoA1 = <Repository>{
    localUri: `${folderA.resource.toString()}/1`
};
const repoA2 = <Repository>{
    localUri: `${folderA.resource.toString()}/2`
};

const folderB = FileStat.dir('file:///home/repoB');
const repoB = <Repository>{
    localUri: folderB.resource.toString()
};

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('GitRepositoryProvider', () => {
    let testContainer: Container;

    let mockGit: DugiteGit;
    let mockGitNative: DugiteGitNative;
    let mockWorkspaceService: WorkspaceService;
    let mockFilesystem: FileService;
    let mockStorageService: StorageService;
    let mockGitRepositoryTracker: GitRepositoryTracker;

    let gitRepositoryProvider: GitRepositoryProvider;
    const mockRootChangeEmitter: Emitter<FileStat[]> = new Emitter();
    const mockFileChangeEmitter: Emitter<FileChangesEvent> = new Emitter();

    before(() => {
        disableJSDOM = enableJSDOM();

        mockGit = sinon.createStubInstance(DugiteGit);
        mockGitNative = sinon.createStubInstance(DugiteGitNative);
        mockWorkspaceService = sinon.createStubInstance(WorkspaceService);
        mockFilesystem = sinon.createStubInstance(FileService);
        mockStorageService = sinon.createStubInstance(LocalStorageService);
        mockGitRepositoryTracker = sinon.createStubInstance(GitRepositoryTracker);

        testContainer = new Container();
        testContainer.bind(GitRepositoryProvider).toSelf().inSingletonScope();
        testContainer.bind(Git).toConstantValue(mockGit);
        testContainer.bind(GitNative).toConstantValue(mockGitNative);
        testContainer.bind(WorkspaceService).toConstantValue(mockWorkspaceService);
        testContainer.bind(FileService).toConstantValue(mockFilesystem);
        testContainer.bind(StorageService).toConstantValue(mockStorageService);
        testContainer.bind(ScmService).toSelf().inSingletonScope();
        testContainer.bind(GitScmProvider.Factory).toFactory(createGitScmProviderFactory);
        testContainer.bind(ScmContextKeyService).toSelf().inSingletonScope();
        testContainer.bind(ContextKeyService).toSelf().inSingletonScope();
        testContainer.bind(GitCommitMessageValidator).toSelf().inSingletonScope();
        testContainer.bind(EditorManager).toConstantValue(<EditorManager>{});
        testContainer.bind(GitErrorHandler).toConstantValue(<GitErrorHandler>{});
        testContainer.bind(CommandService).toConstantValue(<CommandService>{});
        testContainer.bind(LabelProvider).toConstantValue(<LabelProvider>{});
        testContainer.bind(GitPreferences).toConstantValue(<GitPreferences>{});
        testContainer.bind(GitRepositoryTracker).toConstantValue(mockGitRepositoryTracker);
        bindContributionProvider(testContainer, ScmExtraSupportContribution);
    });

    after(() => {
        disableJSDOM();
    });

    beforeEach(() => {
        sinon.stub(mockWorkspaceService, 'onWorkspaceChanged').value(mockRootChangeEmitter.event);
        sinon.stub(mockFilesystem, 'onDidFilesChange').value(mockFileChangeEmitter.event);
    });

    it('should adds all existing git repo(s) on theia loads', async () => {
        const allRepos = [repoA1, repoA2];
        const roots = [folderA];
        (<sinon.SinonStub>mockStorageService.getData).withArgs('theia-git-selected-repository').resolves(allRepos[0]);
        (<sinon.SinonStub>mockStorageService.getData).withArgs('theia-git-all-repositories').resolves(allRepos);
        sinon.stub(mockWorkspaceService, 'roots').value(Promise.resolve(roots));
        (<sinon.SinonStub>mockWorkspaceService.tryGetRoots).returns(roots);
        gitRepositoryProvider = testContainer.get<GitRepositoryProvider>(GitRepositoryProvider);
        (<sinon.SinonStub>mockFilesystem.exists).resolves(true);
        (<sinon.SinonStub>mockGitNative.repositories).withArgs(folderA.resource.toString(), {}).resolves(allRepos);

        await gitRepositoryProvider['initialize']();
        expect(gitRepositoryProvider.allRepositories.length).to.eq(allRepos.length);
        expect(gitRepositoryProvider.allRepositories[0].localUri).to.eq(allRepos[0].localUri);
        expect(gitRepositoryProvider.allRepositories[1].localUri).to.eq(allRepos[1].localUri);
        expect(gitRepositoryProvider.selectedRepository && gitRepositoryProvider.selectedRepository.localUri).to.eq(allRepos[0].localUri);
    });

    // tslint:disable-next-line:no-void-expression
    it.skip('should refresh git repo(s) on receiving a root change event from WorkspaceService', done => {
        const allReposA = [repoA1, repoA2];
        const oldRoots = [folderA];
        const allReposB = [repoB];
        (<sinon.SinonStub>mockStorageService.getData).withArgs('theia-git-selected-repository').resolves(allReposA[0]);
        (<sinon.SinonStub>mockStorageService.getData).withArgs('theia-git-all-repositories').resolves(allReposA);
        sinon.stub(mockWorkspaceService, 'roots').resolves(oldRoots);
        const stubWsRoots = <sinon.SinonStub>mockWorkspaceService.tryGetRoots;
        stubWsRoots.returns(oldRoots);
        gitRepositoryProvider = testContainer.get<GitRepositoryProvider>(GitRepositoryProvider);
        (<sinon.SinonStub>mockFilesystem.exists).resolves(true);
        (<sinon.SinonStub>mockGitNative.repositories).withArgs(folderA.resource.toString(), {}).resolves(allReposA);
        (<sinon.SinonStub>mockGitNative.repositories).withArgs(folderB.resource.toString(), {}).resolves(allReposB);

        let counter = 0;
        gitRepositoryProvider.onDidChangeRepository(selected => {
            counter++;
            if (counter === 3) {
                expect(gitRepositoryProvider.allRepositories.length).to.eq(allReposA.concat(allReposB).length);
                expect(gitRepositoryProvider.allRepositories[0].localUri).to.eq(allReposA[0].localUri);
                expect(gitRepositoryProvider.allRepositories[1].localUri).to.eq(allReposA[1].localUri);
                expect(gitRepositoryProvider.allRepositories[2].localUri).to.eq(allReposB[0].localUri);
                expect(selected && selected.localUri).to.eq(allReposA[0].localUri);
                done();
            }
        });
        gitRepositoryProvider['initialize']().then(() => {
            const newRoots = [folderA, folderB];
            stubWsRoots.returns(newRoots);
            sinon.stub(mockWorkspaceService, 'roots').resolves(newRoots);
            mockRootChangeEmitter.fire(newRoots);
        }).catch(e =>
            done(new Error('gitRepositoryProvider.initialize() throws an error'))
        );
    });

    // tslint:disable-next-line:no-void-expression
    it.skip('should refresh git repo(s) on receiving a file system change event', done => {
        const allReposA = [repoA1, repoA2];
        const oldRoots = [folderA];
        const allReposB = [repoB];
        const newRoots = [folderA, folderB];
        (<sinon.SinonStub>mockStorageService.getData).withArgs('theia-git-selected-repository').resolves(allReposA[0]);
        (<sinon.SinonStub>mockStorageService.getData).withArgs('theia-git-all-repositories').resolves(allReposA);
        sinon.stub(mockWorkspaceService, 'roots').onCall(0).resolves(oldRoots);
        sinon.stub(mockWorkspaceService, 'roots').onCall(1).resolves(oldRoots);
        sinon.stub(mockWorkspaceService, 'roots').onCall(2).resolves(newRoots);
        const stubWsRoots = <sinon.SinonStub>mockWorkspaceService.tryGetRoots;
        stubWsRoots.onCall(0).returns(oldRoots);
        stubWsRoots.onCall(1).returns(oldRoots);
        stubWsRoots.onCall(2).returns(newRoots);
        gitRepositoryProvider = testContainer.get<GitRepositoryProvider>(GitRepositoryProvider);
        (<sinon.SinonStub>mockFilesystem.exists).resolves(true);
        (<sinon.SinonStub>mockGitNative.repositories).withArgs(folderA.resource.toString(), {}).resolves(allReposA);
        (<sinon.SinonStub>mockGitNative.repositories).withArgs(folderB.resource.toString(), {}).resolves(allReposB);

        let counter = 0;
        gitRepositoryProvider.onDidChangeRepository(selected => {
            counter++;
            if (counter === 3) {
                expect(gitRepositoryProvider.allRepositories.length).to.eq(allReposA.concat(allReposB).length);
                expect(gitRepositoryProvider.allRepositories[0].localUri).to.eq(allReposA[0].localUri);
                expect(gitRepositoryProvider.allRepositories[1].localUri).to.eq(allReposA[1].localUri);
                expect(gitRepositoryProvider.allRepositories[2].localUri).to.eq(allReposB[0].localUri);
                expect(selected && selected.localUri).to.eq(allReposA[0].localUri);
                done();
            }
        });
        gitRepositoryProvider['initialize']().then(() =>
            mockFileChangeEmitter.fire(new FileChangesEvent([]))
        ).catch(e =>
            done(new Error('gitRepositoryProvider.initialize() throws an error'))
        );
    });

    // tslint:disable-next-line:no-void-expression
    it.skip('should ignore the invalid or nonexistent root(s)', async () => {
        const allReposA = [repoA1, repoA2];
        const roots = [folderA, folderB];
        (<sinon.SinonStub>mockStorageService.getData).withArgs('theia-git-selected-repository').resolves(allReposA[0]);
        (<sinon.SinonStub>mockStorageService.getData).withArgs('theia-git-all-repositories').resolves(allReposA);
        sinon.stub(mockWorkspaceService, 'roots').value(Promise.resolve(roots));
        (<sinon.SinonStub>mockWorkspaceService.tryGetRoots).returns(roots);
        gitRepositoryProvider = testContainer.get<GitRepositoryProvider>(GitRepositoryProvider);
        (<sinon.SinonStub>mockFilesystem.exists).withArgs(folderA.resource.toString()).resolves(true); // folderA exists
        (<sinon.SinonStub>mockFilesystem.exists).withArgs(folderB.resource.toString()).resolves(false); // folderB does not exist
        (<sinon.SinonStub>mockGitNative.repositories).withArgs(folderA.resource.toString(), {}).resolves(allReposA);

        await gitRepositoryProvider['initialize']();
        expect(gitRepositoryProvider.allRepositories.length).to.eq(allReposA.length);
        expect(gitRepositoryProvider.allRepositories[0].localUri).to.eq(allReposA[0].localUri);
        expect(gitRepositoryProvider.allRepositories[1].localUri).to.eq(allReposA[1].localUri);
        expect(gitRepositoryProvider.selectedRepository && gitRepositoryProvider.selectedRepository.localUri).to.eq(allReposA[0].localUri);
    });

    it('should mark the first repo in the first root as "selectedRepository", if the "selectedRepository" is unavailable in the first place', async () => {
        const allReposA = [repoA1, repoA2];
        const roots = [folderA, folderB];
        const allReposB = [repoB];
        (<sinon.SinonStub>mockStorageService.getData).withArgs('theia-git-selected-repository').resolves(undefined);
        (<sinon.SinonStub>mockStorageService.getData).withArgs('theia-git-all-repositories').resolves(undefined);
        sinon.stub(mockWorkspaceService, 'roots').value(Promise.resolve(roots));
        (<sinon.SinonStub>mockWorkspaceService.tryGetRoots).returns(roots);
        gitRepositoryProvider = testContainer.get<GitRepositoryProvider>(GitRepositoryProvider);
        (<sinon.SinonStub>mockFilesystem.exists).resolves(true);
        (<sinon.SinonStub>mockGitNative.repositories).withArgs(folderA.resource.toString(), {}).resolves(allReposA);
        (<sinon.SinonStub>mockGitNative.repositories).withArgs(folderA.resource.toString(), { maxCount: 1 }).resolves([allReposA[0]]);
        (<sinon.SinonStub>mockGitNative.repositories).withArgs(folderB.resource.toString(), {}).resolves(allReposB);
        (<sinon.SinonStub>mockGitNative.repositories).withArgs(folderB.resource.toString(), { maxCount: 1 }).resolves([allReposB[0]]);

        await gitRepositoryProvider['initialize']();
        expect(gitRepositoryProvider.selectedRepository && gitRepositoryProvider.selectedRepository.localUri).to.eq(allReposA[0].localUri);
    });
});
