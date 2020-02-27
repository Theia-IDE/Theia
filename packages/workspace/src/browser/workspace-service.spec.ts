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

import { Container } from 'inversify';
import { WorkspaceService, WorkspaceFolder, UriWorkspaceFolderData } from './workspace-service';
import { FileSystem, FileStat } from '@theia/filesystem/lib/common';
import { FrontendApplicationConfigProvider } from '@theia/core/lib/browser/frontend-application-config-provider';
import { FileSystemNode } from '@theia/filesystem/lib/node/node-filesystem';
import { FileSystemWatcher, FileChangeEvent, FileChangeType } from '@theia/filesystem/lib/browser/filesystem-watcher';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { DefaultWindowService } from '@theia/core/lib/browser/window/default-window-service';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { MockEnvVariablesServerImpl } from '@theia/core/lib/browser/test/mock-env-variables-server';
import { WorkspaceServer } from '../common';
import { DefaultWorkspaceServer } from '../node/default-workspace-server';
import { Emitter, Disposable, DisposableCollection, ILogger, Logger } from '@theia/core';
import { PreferenceServiceImpl, PreferenceSchemaProvider } from '@theia/core/lib/browser';
import { WorkspacePreferences } from './workspace-preferences';
import { createMockPreferenceProxy } from '@theia/core/lib/browser/preferences/test';
import * as jsoncparser from 'jsonc-parser';
import * as sinon from 'sinon';
import * as chai from 'chai';
import * as assert from 'assert';
import * as temp from 'temp';
import { FileUri } from '@theia/core/lib/node';
import URI from '@theia/core/lib/common/uri';
const expect = chai.expect;

disableJSDOM();
const track = temp.track();

const folderA = Object.freeze(<WorkspaceFolder>{
    name: 'folderA',
    uri: 'file:///home/folderA',
    lastModification: 0,
    isDirectory: true
});
const folderB = Object.freeze(<WorkspaceFolder>{
    name: 'folderB',
    uri: 'file:///home/folderB',
    lastModification: 0,
    isDirectory: true
});
const getFormattedJson = (data: string): string => {
    const edits = jsoncparser.format(data, undefined, { tabSize: 3, insertSpaces: true, eol: '' });
    return jsoncparser.applyEdits(data, edits);
};

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-unused-expressions */
describe('WorkspaceService', () => {
    const toRestore: Array<sinon.SinonStub | sinon.SinonSpy | sinon.SinonMock> = [];
    const toDispose: Disposable[] = [];
    let wsService: WorkspaceService;
    let updateTitleStub: sinon.SinonStub;
    // stub of window.location.reload
    let windowLocationReloadStub: sinon.SinonStub;
    let onFilesChangedStub: sinon.SinonStub;

    let mockFileChangeEmitter: Emitter<FileChangeEvent>;
    let mockPreferenceValues: { [p: string]: any };
    let mockFilesystem: FileSystem;
    let mockFileSystemWatcher: FileSystemWatcher;
    let mockWorkspaceServer: WorkspaceServer;
    let mockWindowService: WindowService;
    let mockILogger: ILogger;
    let mockPref: WorkspacePreferences;
    let mockPreferenceServiceImpl: PreferenceServiceImpl;
    let mockPreferenceSchemaProvider: PreferenceSchemaProvider;

    before(() => {
        disableJSDOM = enableJSDOM();
        FrontendApplicationConfigProvider.set({
            'applicationName': 'test',
        });
    });

    after(() => {
        disableJSDOM();
        track.cleanupSync();
    });

    beforeEach(() => {
        mockPreferenceValues = {};
        mockFilesystem = sinon.createStubInstance(FileSystemNode);
        mockFileSystemWatcher = sinon.createStubInstance(FileSystemWatcher);
        mockWorkspaceServer = sinon.createStubInstance(DefaultWorkspaceServer);
        mockWindowService = sinon.createStubInstance(DefaultWindowService);
        mockILogger = sinon.createStubInstance(Logger);
        mockPref = createMockPreferenceProxy(mockPreferenceValues);
        mockPreferenceServiceImpl = sinon.createStubInstance(PreferenceServiceImpl);
        mockPreferenceSchemaProvider = sinon.createStubInstance(PreferenceSchemaProvider);

        const testContainer = new Container();
        testContainer.bind(WorkspaceService).toSelf().inSingletonScope();
        testContainer.bind(FileSystem).toConstantValue(mockFilesystem);
        testContainer.bind(FileSystemWatcher).toConstantValue(mockFileSystemWatcher);
        testContainer.bind(WorkspaceServer).toConstantValue(mockWorkspaceServer);
        testContainer.bind(WindowService).toConstantValue(mockWindowService);
        testContainer.bind(ILogger).toConstantValue(mockILogger);
        testContainer.bind(WorkspacePreferences).toConstantValue(mockPref);
        testContainer.bind(EnvVariablesServer).toConstantValue(new MockEnvVariablesServerImpl(FileUri.create(track.mkdirSync())));
        testContainer.bind(PreferenceServiceImpl).toConstantValue(mockPreferenceServiceImpl);
        testContainer.bind(PreferenceSchemaProvider).toConstantValue(mockPreferenceSchemaProvider);

        // stub the updateTitle() & reloadWindow() function because `document` and `window` are unavailable
        updateTitleStub = sinon.stub(WorkspaceService.prototype, <any>'updateTitle').callsFake(() => { });
        windowLocationReloadStub = sinon.stub(window.location, 'reload');
        mockFileChangeEmitter = new Emitter();
        onFilesChangedStub = sinon.stub(mockFileSystemWatcher, 'onFilesChanged').value(mockFileChangeEmitter.event);
        toDispose.push(mockFileChangeEmitter);
        toRestore.push(...[updateTitleStub, windowLocationReloadStub, onFilesChangedStub]);

        wsService = testContainer.get<WorkspaceService>(WorkspaceService);
    });

    afterEach(() => {
        wsService['toDisposeOnWorkspace'].dispose();
        toRestore.forEach(res => {
            res.restore();
        });
        toRestore.length = 0;
        toDispose.forEach(dis => dis.dispose());
        toDispose.length = 0;
    });

    describe('constructor and init', () => {
        it('should reset the exposed roots and title if the most recently used workspace is unavailable', async () => {
            (<sinon.SinonStub>mockWorkspaceServer.getMostRecentlyUsedWorkspace).resolves(undefined);

            await wsService['init']();
            expect(wsService.workspace).to.to.be.undefined;
            expect((await wsService.roots).length).to.eq(0);
            expect(wsService.tryGetRoots().length).to.eq(0);
            expect(updateTitleStub.called).to.be.true;
            expect(window.location.hash).to.be.empty;
        });

        it('should reset the exposed roots and title if server returns an invalid or nonexistent file / folder', async () => {
            const invalidStat = <FileStat>{
                uri: 'file:///home/invalid',
                lastModification: 0,
                isDirectory: true
            };
            (<sinon.SinonStub>mockWorkspaceServer.getMostRecentlyUsedWorkspace).resolves(invalidStat.uri);
            (<sinon.SinonStub>mockFilesystem.getFileStat).resolves(undefined);
            (<sinon.SinonStub>mockFileSystemWatcher.watchFileChanges).resolves(new DisposableCollection());

            await wsService['init']();
            expect(wsService.workspace).to.to.be.undefined;
            expect((await wsService.roots).length).to.eq(0);
            expect(wsService.tryGetRoots().length).to.eq(0);
            expect(updateTitleStub.called).to.be.true;
            expect(window.location.hash).to.be.empty;
        });

        ['/home/oneFolder', '/home/oneFolder/'].forEach(uriStr => {
            it('should set the exposed roots and workspace to the folder returned by server as the most recently used workspace, and start watching that folder', async () => {
                const stat = <FileStat>{
                    uri: 'file://' + uriStr,
                    lastModification: 0,
                    isDirectory: true
                };
                (<sinon.SinonStub>mockWorkspaceServer.getMostRecentlyUsedWorkspace).resolves(stat.uri);
                (<sinon.SinonStub>mockFilesystem.getFileStat).resolves(stat);
                (<sinon.SinonStub>mockFileSystemWatcher.watchFileChanges).resolves(new DisposableCollection());

                await wsService['init']();
                expect(wsService.workspace).to.eq(stat);
                expect((await wsService.roots).length).to.eq(1);
                expect(wsService.tryGetRoots().length).to.eq(1);
                expect(wsService.tryGetRoots()[0]).to.eq(stat);
                expect((<sinon.SinonStub>mockFileSystemWatcher.watchFileChanges).calledWith(new URI(stat.uri))).to.be.true;
                expect(window.location.hash).eq('#' + uriStr);
            });
        });

        it(
            'should set the exposed roots and workspace to the folders listed in the workspace file returned by the server, ' +
            'and start watching the workspace file and all the folders',
            async () => {
                const workspaceFilePath = '/home/workspaceFile';
                const workspaceFileUri = 'file://' + workspaceFilePath;
                const workspaceFileStat = <FileStat>{
                    uri: workspaceFileUri,
                    lastModification: 0,
                    isDirectory: false
                };
                const rootA = 'file:///folderA';
                const rootB = 'file:///folderB';
                (<sinon.SinonStub>mockWorkspaceServer.getMostRecentlyUsedWorkspace).resolves(workspaceFileStat.uri);
                const stubGetFileStat = (<sinon.SinonStub>mockFilesystem.getFileStat);
                stubGetFileStat.withArgs(workspaceFileUri).resolves(workspaceFileStat);
                (<sinon.SinonStub>mockFilesystem.exists).resolves(true);
                (<sinon.SinonStub>mockFilesystem.resolveContent).resolves({
                    stat: workspaceFileStat,
                    content: `{"folders":[{"path":"${rootA}"},{"path":"${rootB}"}],"settings":{}}`
                });
                stubGetFileStat.withArgs(rootA).resolves(<FileStat>{
                    uri: rootA, lastModification: 0, isDirectory: true
                }); // rootA exists
                stubGetFileStat.withArgs(rootB).throws(new Error()); // no access to rootB
                (<sinon.SinonStub>mockFileSystemWatcher.watchFileChanges).resolves(new DisposableCollection());

                await wsService['init']();
                expect(wsService.workspace).to.eq(workspaceFileStat);
                expect((await wsService.roots).length).to.eq(2);
                expect(wsService.tryGetRoots().length).to.eq(2);
                expect(wsService.tryGetRoots()[0].uri).to.eq(rootA);
                expect(wsService.tryGetRoots()[1].uri).to.eq(rootB);
                expect(window.location.hash).to.eq('#' + workspaceFilePath);

                expect((<Map<string, Disposable>>wsService['rootWatchers']).size).to.eq(2);
                expect((<Map<string, Disposable>>wsService['rootWatchers']).has(rootA)).to.be.true;
                expect((<Map<string, Disposable>>wsService['rootWatchers']).has(rootB)).to.be.true;
            });

        it('should set the exposed roots an empty array if the workspace file stores invalid workspace data', async () => {
            const workspaceFileUri = 'file:///home/workspaceFile';
            const workspaceFileStat = <FileStat>{
                uri: workspaceFileUri,
                lastModification: 0,
                isDirectory: false
            };
            (<sinon.SinonStub>mockWorkspaceServer.getMostRecentlyUsedWorkspace).resolves(workspaceFileStat.uri);
            (<sinon.SinonStub>mockFilesystem.getFileStat).withArgs(workspaceFileUri).resolves(workspaceFileStat);
            (<sinon.SinonStub>mockFilesystem.exists).resolves(true);
            (<sinon.SinonStub>mockFilesystem.resolveContent).resolves({
                stat: workspaceFileStat,
                content: 'invalid workspace data'
            });
            (<sinon.SinonStub>mockFileSystemWatcher.watchFileChanges).resolves(new DisposableCollection());

            await wsService['init']();
            expect(wsService.workspace && wsService.workspace.uri).to.eq(workspaceFileStat.uri);
            expect((await wsService.roots).length).to.eq(0);
            expect(wsService.tryGetRoots().length).to.eq(0);
            expect((<sinon.SinonStub>mockILogger.error).called).to.be.true;
        });

        it('should use the workspace path in the URL fragment, if available', async function (): Promise<void> {
            const workspacePath = '/home/somewhere';
            window.location.hash = '#' + workspacePath;
            const stat = <FileStat>{
                uri: 'file://' + workspacePath,
                lastModification: 0,
                isDirectory: true
            };
            (<sinon.SinonStub>mockFilesystem.getFileStat).resolves(stat);
            (<sinon.SinonStub>mockFileSystemWatcher.watchFileChanges).resolves(new DisposableCollection());

            await wsService['init']();
            expect(wsService.workspace).to.eq(stat);
            expect((await wsService.roots).length).to.eq(1);
            expect(wsService.tryGetRoots().length).to.eq(1);
            expect(wsService.tryGetRoots()[0]).to.eq(stat);
            expect((<sinon.SinonStub>mockFileSystemWatcher.watchFileChanges).calledWith(new URI(stat.uri))).to.be.true;
            expect(window.location.hash).to.eq('#' + workspacePath);
        });
    });

    describe('onStop() function', () => {
        it('should send server an empty string if there is no workspace', () => {
            wsService['_workspace'] = undefined;
            wsService.onStop();
            expect((<sinon.SinonStub>mockWorkspaceServer.setMostRecentlyUsedWorkspace).calledWith('')).to.be.true;
        });

        it('should send server the uri of current workspace if there is workspace opened', () => {
            const uri = 'file:///home/testUri';
            wsService['_workspace'] = <FileStat>{
                uri,
                lastModification: 0,
                isDirectory: false
            };
            wsService.onStop();
            expect((<sinon.SinonStub>mockWorkspaceServer.setMostRecentlyUsedWorkspace).calledWith(uri)).to.be.true;
        });
    });

    describe('recentWorkspaces() function', () => {
        it('should get the recent workspaces from the server', () => {
            wsService.recentWorkspaces();
            expect((<sinon.SinonStub>mockWorkspaceServer.getRecentWorkspaces).called).to.be.true;
        });
    });

    describe('open() function', () => {
        it('should call doOpen() with exactly the same arguments', () => {
            const uri = new URI('file:///home/testUri');
            toRestore.push(sinon.stub(WorkspaceService.prototype, <any>'doOpen').callsFake(() => { }));
            wsService.open(uri, {});
            expect((<sinon.SinonStub>wsService['doOpen']).calledWith(uri, {})).to.be.true;
        });

        it('should throw an error if the uri passed in is invalid or nonexistent', done => {
            (<sinon.SinonStub>mockFilesystem.getFileStat).resolves(undefined);
            wsService['doOpen'](new URI('file:///home/testUri'))
                .then(() => {
                    done(new Error('WorkspaceService.doOpen() should throw an error but did not'));
                }).catch(e => {
                    expect(window.location.hash).to.be.empty;
                    done();
                });
        });

        it('should reload the current window with new uri if preferences["workspace.preserveWindow"] = true and there is an opened current workspace', async () => {
            mockPreferenceValues['workspace.preserveWindow'] = true;
            const newPath = '/home/newWorkspaceUri';
            const newUriStr = 'file://' + newPath;
            const newUri = new URI(newUriStr);
            const stat = <FileStat>{
                uri: newUriStr,
                lastModification: 0,
                isDirectory: true
            };
            (<sinon.SinonStub>mockFilesystem.getFileStat).resolves(stat);
            toRestore.push(sinon.stub(wsService, 'roots').resolves([stat]));
            (wsService['_workspace'] as any) = stat;

            await wsService['doOpen'](newUri, {});
            expect(windowLocationReloadStub.called).to.be.true;
            expect((<sinon.SinonStub>mockWorkspaceServer.setMostRecentlyUsedWorkspace).calledWith(newUriStr)).to.be.true;
            expect(wsService.workspace).to.eq(stat);
            expect(window.location.hash).to.eq('#' + newPath);
        });

        it('should keep the old Theia window & open a new window if preferences["workspace.preserveWindow"] = false and there is an opened current workspace', async () => {
            mockPreferenceValues['workspace.preserveWindow'] = false;
            const oldWorkspacePath = '/home/oldWorkspaceUri';
            const oldWorkspaceUriStr = 'file:///home/oldWorkspaceUri';
            const oldStat = <FileStat>{
                uri: oldWorkspaceUriStr,
                lastModification: 0,
                isDirectory: true
            };
            toRestore.push(sinon.stub(wsService, 'roots').resolves([oldStat]));
            (wsService['_workspace'] as any) = oldStat;
            window.location.hash = '#' + oldWorkspacePath;
            const newWorkspaceUriStr = 'file:///home/newWorkspaceUri';
            const uri = new URI(newWorkspaceUriStr);
            const newStat = <FileStat>{
                uri: newWorkspaceUriStr,
                lastModification: 0,
                isDirectory: true
            };
            (<sinon.SinonStub>mockFilesystem.getFileStat).resolves(newStat);
            const stubOpenNewWindow = sinon.stub(wsService, <any>'openNewWindow').callsFake(() => { });
            toRestore.push(stubOpenNewWindow);

            await wsService['doOpen'](uri, {});
            expect(windowLocationReloadStub.called).to.be.false;
            expect((<sinon.SinonStub>mockWorkspaceServer.setMostRecentlyUsedWorkspace).calledWith(newWorkspaceUriStr)).to.be.true;
            expect(stubOpenNewWindow.called).to.be.true;
            expect(wsService.workspace).to.eq(oldStat);
            expect(window.location.hash).to.eq('#' + oldWorkspacePath);
        });

        it('should reload the current window with new uri if preferences["workspace.preserveWindow"] = false and browser blocks the new window being opened', async () => {
            mockPreferenceValues['workspace.preserveWindow'] = false;
            const oldWorkspacePath = '/home/oldWorkspaceUri';
            const oldWorkspaceUriStr = 'file://' + oldWorkspacePath;
            const oldStat = <FileStat>{
                uri: oldWorkspaceUriStr,
                lastModification: 0,
                isDirectory: true
            };
            toRestore.push(sinon.stub(wsService, 'roots').resolves([oldStat]));
            (wsService['_workspace'] as any) = oldStat;
            window.location.hash = '#' + oldWorkspacePath;
            const newWorkspacePath = '/home/newWorkspaceUri';
            const newWorkspaceUriStr = 'file://' + newWorkspacePath;
            const uri = new URI(newWorkspaceUriStr);
            const newStat = <FileStat>{
                uri: newWorkspaceUriStr,
                lastModification: 0,
                isDirectory: true
            };
            (<sinon.SinonStub>mockFilesystem.getFileStat).resolves(newStat);
            (<sinon.SinonStub>mockILogger.error).resolves(undefined);
            const stubOpenNewWindow = sinon.stub(wsService, <any>'openNewWindow').throws();
            toRestore.push(stubOpenNewWindow);

            await wsService['doOpen'](uri, {});
            expect(windowLocationReloadStub.called).to.be.true;
            expect((<sinon.SinonStub>mockWorkspaceServer.setMostRecentlyUsedWorkspace).calledWith(newWorkspaceUriStr)).to.be.true;
            expect(stubOpenNewWindow.called).to.be.true;
            expect(wsService.workspace).to.eq(newStat);
            expect(window.location.hash).to.eq('#' + newWorkspacePath);
        });
    });

    describe('close() function', () => {
        it('should reset the exposed roots and workspace, and set the most recently used workspace empty through the server', async () => {
            const stat = <WorkspaceFolder>{
                name: 'folder',
                uri: 'file:///home/folder',
                lastModification: 0,
                isDirectory: true
            };
            wsService['_workspace'] = stat;
            wsService['_roots'] = [stat];
            window.location.hash = '#something';

            await wsService.close();
            expect(wsService.workspace).to.be.undefined;
            expect((await wsService.roots).length).to.eq(0);
            expect((<sinon.SinonStub>mockWorkspaceServer.setMostRecentlyUsedWorkspace).calledWith('')).to.be.true;
            expect(window.location.hash).to.be.empty;
        });
    });

    describe('addRoot() function', () => {
        it('should throw an error if there is no opened workspace', done => {
            wsService['_workspace'] = undefined;

            wsService.addRoot(new URI())
                .then(() => {
                    done(new Error('WorkspaceService.addRoot() should throw an error but did not.'));
                }).catch(e => {
                    done();
                });
        });

        it('should throw an error if the added uri is invalid or nonexistent', done => {
            (<sinon.SinonStub>mockFilesystem.getFileStat).resolves(undefined);
            toRestore.push(sinon.stub(wsService, 'opened').value(true));
            wsService.addRoot(new URI())
                .then(() => {
                    done(new Error('WorkspaceService.addRoot() should throw an error but did not.'));
                }).catch(e => {
                    done();
                });
        });

        it('should throw an error if the added uri points to a file instead of a folder', done => {
            (<sinon.SinonStub>mockFilesystem.getFileStat).resolves(<FileStat>{
                uri: 'file:///home/file',
                lastModification: 0,
                isDirectory: false
            });
            toRestore.push(sinon.stub(wsService, 'opened').value(true));
            wsService.addRoot(new URI())
                .then(() => {
                    done(new Error('WorkspaceService.addRoot() should throw an error but did not.'));
                }).catch(e => {
                    done();
                });
        });

        it('should do nothing if the added uri is already part of the current workspace', async () => {
            const stat = <WorkspaceFolder>{
                name: 'folder',
                uri: 'file:///home/folder',
                lastModification: 0,
                isDirectory: true
            };
            wsService['_workspace'] = stat;
            wsService['_roots'] = [stat];
            (<sinon.SinonStub>mockFilesystem.getFileStat).resolves(stat);

            await wsService.addRoot(new URI(stat.uri));
            expect(wsService.workspace && wsService.workspace.uri).to.eq(stat.uri);
            expect(wsService.tryGetRoots().length).to.eq(1);
        });

        it('should write new data into the workspace file when the workspace data is stored in a file', async () => {
            const workspaceFileStat = <FileStat>{
                uri: 'file:///home/file',
                lastModification: 0,
                isDirectory: false
            };
            wsService['_workspace'] = workspaceFileStat;
            wsService['_roots'] = [folderA];
            (<sinon.SinonStub>mockFilesystem.getFileStat).resolves(folderB);
            (<sinon.SinonStub>mockFilesystem.resolveContent).resolves({
                stat: workspaceFileStat, content: JSON.stringify({ folders: [{ path: 'folderA' }] })
            });
            (<sinon.SinonStub>mockFilesystem.exists).resolves(true);
            const spyWriteFile = sinon.spy(wsService, <any>'writeWorkspaceFile');

            await wsService.addRoot(new URI(folderB.uri));
            expect(spyWriteFile.calledWith(workspaceFileStat, { folders: [{ path: folderA.uri }, { path: folderB.uri }] })).to.be.true;
        });
    });

    describe('save() function', () => {
        it('should leave the current workspace unchanged if the passed in uri points to the current workspace', async () => {
            const file = <FileStat>{
                uri: 'file:///home/file',
                lastModification: 0,
                isDirectory: false
            };
            const oldWorkspaceData = { folders: [{ path: 'folderA' }, { path: 'folderB' }], settings: {} };
            (<sinon.SinonStub>mockFilesystem.exists).resolves(true);
            (<sinon.SinonStub>mockFilesystem.getFileStat).resolves(file);
            wsService['_workspace'] = file;
            wsService['_roots'] = [folderA, folderB];
            const stubSetContent = (<sinon.SinonStub>mockFilesystem.setContent).resolves(file);
            (<sinon.SinonStub>mockFilesystem.resolveContent).resolves({ stat: file, content: JSON.stringify(oldWorkspaceData) });

            expect(wsService.workspace && wsService.workspace.uri).to.eq(file.uri);
            await wsService.save(new URI(file.uri));
            expect((<sinon.SinonStub>mockWorkspaceServer.setMostRecentlyUsedWorkspace).calledWith(file.uri)).to.be.true;
            expect(stubSetContent.calledWith(file, getFormattedJson(JSON.stringify(oldWorkspaceData)))).to.be.true;
            expect(wsService.workspace && wsService.workspace.uri).to.eq(file.uri);
        });

        it('should create a new workspace file, save the workspace data into that new file, and update the title of theia', async () => {
            const oldFile = <FileStat>{
                uri: 'file:///home/oldfile',
                lastModification: 0,
                isDirectory: false
            };
            const newFile = <FileStat>{
                uri: 'file:///home/newfile',
                lastModification: 0,
                isDirectory: false
            };
            const oldWorkspaceData = { folders: [{ path: 'folderA' }, { path: 'folderB' }], settings: {} };
            wsService['_roots'] = [folderA, folderB];
            const stubExist = <sinon.SinonStub>mockFilesystem.exists;
            stubExist.withArgs(oldFile.uri).resolves(true);
            stubExist.withArgs(newFile.uri).resolves(false);
            (<sinon.SinonStub>mockFilesystem.getFileStat).resolves(newFile);
            (<sinon.SinonStub>mockFileSystemWatcher.watchFileChanges).resolves(new DisposableCollection());
            wsService['_workspace'] = oldFile;
            const stubSetContent = (<sinon.SinonStub>mockFilesystem.setContent).resolves(newFile);
            (<sinon.SinonStub>mockFilesystem.resolveContent).resolves({ stat: oldFile, content: JSON.stringify(oldWorkspaceData) });

            expect(wsService.workspace && wsService.workspace.uri).to.eq(oldFile.uri);
            await wsService.save(new URI(newFile.uri));
            expect((<sinon.SinonStub>mockWorkspaceServer.setMostRecentlyUsedWorkspace).calledWith(newFile.uri)).to.be.true;
            expect(stubSetContent.calledWith(newFile, getFormattedJson(JSON.stringify(oldWorkspaceData)))).to.be.true;
            expect(wsService.workspace && wsService.workspace.uri).to.eq(newFile.uri);
            expect(updateTitleStub.called).to.be.true;
        });

        it('should use relative paths or translate relative paths to absolute path when necessary before saving, and emit "savedLocationChanged" event', done => {
            const oldFile = <FileStat>{
                uri: 'file:///home/oldFolder/oldFile',
                lastModification: 0,
                isDirectory: false
            };
            const newFile = <FileStat>{
                uri: 'file:///home/newFolder/newFile',
                lastModification: 0,
                isDirectory: false
            };
            const folder1 = <WorkspaceFolder>{
                name: 'folder1',
                uri: 'file:///home/thirdFolder/folder1',
                lastModification: 0,
                isDirectory: true
            };
            const folder2 = <WorkspaceFolder>{
                name: 'folder2',
                uri: 'file:///home/newFolder/folder2',
                lastModification: 0,
                isDirectory: true
            };
            const oldWorkspaceData = { folders: [{ path: folder1.uri }, { path: folder2.uri }], settings: {} };
            (<sinon.SinonStub>mockFilesystem.resolveContent).resolves({ stat: oldFile, content: JSON.stringify(oldWorkspaceData) });
            const stubExist = <sinon.SinonStub>mockFilesystem.exists;
            stubExist.withArgs(oldFile.uri).resolves(true);
            stubExist.withArgs(newFile.uri).resolves(false);
            (<sinon.SinonStub>mockFilesystem.getFileStat).resolves(newFile);
            wsService['_workspace'] = oldFile;
            wsService['_roots'] = [folder1, folder2];
            const stubSetContent = (<sinon.SinonStub>mockFilesystem.setContent).resolves(newFile);
            (<sinon.SinonStub>mockFileSystemWatcher.watchFileChanges).resolves(new DisposableCollection());

            expect(wsService.workspace && wsService.workspace.uri).to.eq(oldFile.uri);
            wsService.onWorkspaceLocationChanged(() => {
                done();
            });
            wsService.save(new URI(newFile.uri)).then(() => {
                expect((<sinon.SinonStub>mockWorkspaceServer.setMostRecentlyUsedWorkspace).calledWith(newFile.uri)).to.be.true;
                expect(stubSetContent.calledWith(newFile, getFormattedJson(JSON.stringify({ folders: [{ path: folder1.uri }, { path: 'folder2' }], settings: {} })))).to.be.true;
                expect(wsService.workspace && wsService.workspace.uri).to.eq(newFile.uri);
                expect(updateTitleStub.called).to.be.true;
            });
        }).timeout(2000);
    });

    describe('saved status', () => {
        it('should be true if there is an opened workspace, and the opened workspace is not a folder, othewise false', () => {
            const file = <FileStat>{
                uri: 'file:///home/file',
                lastModification: 0,
                isDirectory: false
            };

            expect(wsService.saved).to.be.false;
            wsService['_workspace'] = file;
            expect(wsService.saved).to.be.true;
            wsService['_workspace'] = folderA;
            expect(wsService.saved).to.be.false;
        });
    });

    describe('isMultiRootWorkspaceEnabled status', () => {
        it('should be true if there is an opened workspace and preference["workspace.supportMultiRootWorkspace"] = true, otherwise false', () => {
            mockPreferenceValues['workspace.supportMultiRootWorkspace'] = true;
            expect(wsService.isMultiRootWorkspaceEnabled).to.be.false;

            const file = <FileStat>{
                uri: 'file:///home/file',
                lastModification: 0,
                isDirectory: false
            };
            wsService['_workspace'] = file;
            mockPreferenceValues['workspace.supportMultiRootWorkspace'] = true;
            expect(wsService.isMultiRootWorkspaceEnabled).to.be.true;

            mockPreferenceValues['workspace.supportMultiRootWorkspace'] = false;
            expect(wsService.isMultiRootWorkspaceEnabled).to.be.false;
        });
    });

    describe('isMultiRootWorkspaceOpened status', () => {
        it('should be true if there is an opened workspace and the workspace is not a directory, otherwise false', () => {
            expect(wsService.isMultiRootWorkspaceOpened).to.be.false;

            const file = <FileStat>{
                uri: 'file:///home/file',
                lastModification: 0,
                isDirectory: false
            };
            wsService['_workspace'] = file;
            expect(wsService.isMultiRootWorkspaceOpened).to.be.true;

            const dir = <FileStat>{
                uri: 'file:///home/dir',
                lastModification: 0,
                isDirectory: true
            };
            wsService['_workspace'] = dir;
            expect(wsService.isMultiRootWorkspaceOpened).to.be.false;
        });
    });

    describe('containsSome() function', () => {
        it('should resolve false if the current workspace is not open', async () => {
            sinon.stub(wsService, 'roots').resolves([]);
            sinon.stub(wsService, 'opened').value(false);
            wsService['_roots'] = [];

            expect(await wsService.containsSome([])).to.be.false;
        });

        it('should resolve false if the passed in paths is an empty array', async () => {
            sinon.stub(wsService, 'roots').resolves([]);
            sinon.stub(wsService, 'opened').value(true);
            wsService['_roots'] = [folderA, folderB];

            expect(await wsService.containsSome([])).to.be.false;
        });

        it('should resolve false if on or more passed in paths are found in the workspace, otherwise false', async () => {
            sinon.stub(wsService, 'roots').value([folderA, folderB]);
            sinon.stub(wsService, 'opened').value(true);
            wsService['_roots'] = [folderA, folderB];

            (<sinon.SinonStub>mockFilesystem.exists).withArgs('file:///home/folderB/subfolder').resolves(true);
            const val = await wsService.containsSome(['A', 'subfolder', 'C']);
            expect(val).to.be.true;
            expect(await wsService.containsSome(['C', 'A', 'B'])).to.be.false;
        });
    });

    describe('removeRoots() function', () => {
        it('should throw an error if the current workspace is not open', done => {
            sinon.stub(wsService, 'opened').value(false);

            wsService.removeRoots([]).then(() => {
                done(new Error('WorkspaceService.removeRoots() should throw an error while did not.'));
            }).catch(e => {
                done();
            });
        });

        it('should not update the workspace file if the workspace is undefined', async () => {
            wsService['_workspace'] = undefined;
            sinon.stub(wsService, 'opened').value(true);
            const stubWriteWorkspaceFile = sinon.stub(wsService, <any>'writeWorkspaceFile');

            await wsService.removeRoots([]);
            expect(stubWriteWorkspaceFile.called).to.be.false;
        });

        it('should update the working space file with remaining folders', async () => {
            const file = <FileStat>{
                uri: 'file:///home/oneFile',
                lastModification: 0,
                isDirectory: false
            };
            wsService['_workspace'] = file;
            sinon.stub(wsService, 'opened').value(true);
            wsService['_roots'] = [folderA, folderB];
            const stubSetContent = <sinon.SinonStub>mockFilesystem.setContent;
            stubSetContent.resolves(file);
            (<sinon.SinonStub>mockFilesystem.resolveContent).resolves({ stat: file, content: JSON.stringify({ folders: [{ path: 'folderA' }, { path: 'folderB' }] }) });
            (<sinon.SinonStub>mockFilesystem.exists).resolves(true);

            await wsService.removeRoots([new URI()]);
            expect(stubSetContent.calledWith(file, getFormattedJson(JSON.stringify({ folders: [{ path: 'folderA' }, { path: 'folderB' }] })))).to.be.true;

            await wsService.removeRoots([new URI(folderB.uri)]);
            expect(stubSetContent.calledWith(file, getFormattedJson(JSON.stringify({ folders: [{ path: 'folderA' }] })))).to.be.true;
        });
    });

    describe('spliceRoots', () => {
        const workspace = <FileStat>{ uri: 'file:///workspace.theia-workspace', isDirectory: false };
        const fooDir = <WorkspaceFolder>{ name: 'foo', uri: 'file:///foo', isDirectory: true };
        const workspaceService: WorkspaceService = new WorkspaceService();
        workspaceService['getUntitledWorkspace'] = async () => new URI('file:///untitled.theia-workspace');
        workspaceService['save'] = async () => { };
        workspaceService['readWorkspaceData'] = async () => ({ folders: [] });
        workspaceService['writeWorkspaceFile'] = async (_, data) => {
            workspaceService['_roots'] = (data.folders as UriWorkspaceFolderData[]).map(({ uri, name }) => <WorkspaceFolder>{ uri, name });
            return undefined;
        };
        const assertRemoved = (removed: URI[], ...roots: string[]) =>
            assert.deepEqual(removed.map(uri => uri.toString()), roots);
        const assertRoots = (...roots: string[]) =>
            assert.deepEqual(workspaceService['_roots'].map(root => root.uri), roots);

        beforeEach(() => {
            workspaceService['_workspace'] = workspace;
            workspaceService['_roots'] = [fooDir];
        });

        it('skip', async () => {
            assertRemoved(await workspaceService.spliceRoots(0, 0));
            assertRoots('file:///foo');
        });

        it('add', async () => {
            assertRemoved(await workspaceService.spliceRoots(1, 0, new URI('file:///bar')));
            assertRoots('file:///foo', 'file:///bar');
        });

        it('add dups', async () => {
            assertRemoved(await workspaceService.spliceRoots(1, 0, new URI('file:///bar'), new URI('file:///baz'), new URI('file:///bar')));
            assertRoots('file:///foo', 'file:///bar', 'file:///baz');
        });

        it('remove', async () => {
            assertRemoved(await workspaceService.spliceRoots(0, 1), 'file:///foo');
            assertRoots();
        });

        it('update', async () => {
            assertRemoved(await workspaceService.spliceRoots(0, 1, new URI('file:///bar')), 'file:///foo');
            assertRoots('file:///bar');
        });

        it('add untitled', async () => {
            workspaceService['_workspace'] = fooDir;
            assertRemoved(await workspaceService.spliceRoots(1, 0, new URI('file:///bar')));
            assertRoots('file:///foo', 'file:///bar');
        });
    });

    describe('getWorkspaceRootUri() function', () => {
        it('should return undefined if no uri is passed into the function', () => {
            expect(wsService.getWorkspaceRootUri(undefined)).to.be.undefined;
        });

        it('should return the root folder uri that the file belongs to', () => {
            wsService['_roots'] = [folderA, folderB];
            const root = wsService.getWorkspaceRootUri(new URI(folderB.uri + '/testfile'));
            expect(root!.toString()).to.equal(folderB.uri);
        });

        it('should return the closest root folder uri that the file belongs to', () => {
            const home = Object.freeze(<WorkspaceFolder>{
                name: 'home',
                uri: 'file:///home',
                lastModification: 0,
                isDirectory: true
            });
            wsService['_roots'] = [folderA, folderB, home];
            const root = wsService.getWorkspaceRootUri(new URI(folderB.uri + '/testfile'));
            expect(root!.toString()).to.equal(folderB.uri);
        });
    });

    it('should emit roots in the current workspace when initialized', done => {
        const rootA = 'file:///folderA';
        const rootB = 'file:///folderB';
        const statA = <WorkspaceFolder>{
            name: 'folderA',
            uri: rootA,
            lastModification: 0,
            isDirectory: true
        };
        const statB = <WorkspaceFolder>{
            name: 'folderB',
            uri: rootB,
            lastModification: 0,
            isDirectory: true
        };
        const dis = wsService.onWorkspaceChanged(roots => {
            expect(roots.length).to.eq(2);
            expect(roots[0].uri).to.eq(rootA);
            expect(roots[1].uri).to.eq(rootB);
            dis.dispose();
            done();
        });
        toDispose.push(dis);
        wsService['onWorkspaceChangeEmitter'].fire([statA, statB]);
    }).timeout(2000);

    it('should emit updated roots when workspace file is changed', done => {
        const workspaceFileUri = 'file:///home/workspaceFile';
        const workspaceFileStat = <FileStat>{
            uri: workspaceFileUri,
            lastModification: 0,
            isDirectory: false
        };
        wsService['_workspace'] = workspaceFileStat;
        const folderC = <FileStat>{
            uri: 'file:///home/folderC',
            lastModification: 0,
            isDirectory: true
        };

        (<sinon.SinonStub>mockWorkspaceServer.getMostRecentlyUsedWorkspace).resolves(workspaceFileUri);
        const stubGetFileStat = (<sinon.SinonStub>mockFilesystem.getFileStat);
        stubGetFileStat.withArgs(workspaceFileUri).resolves(workspaceFileStat);
        (<sinon.SinonStub>mockFilesystem.exists).resolves(true);
        const oldWorkspaceFileContent = {
            stat: workspaceFileStat,
            content: '{"folders":[{"path":"folderA"},{"path":"folderB"}],"settings":{}}'
        };
        const newWorkspaceFileContent = {
            stat: workspaceFileStat,
            content: '{"folders":[{"path":"folderB"},{"path":"folderC"}],"settings":{}}'
        };
        (<sinon.SinonStub>mockFilesystem.resolveContent).onCall(0).resolves(oldWorkspaceFileContent);
        (<sinon.SinonStub>mockFilesystem.resolveContent).onCall(1).resolves(newWorkspaceFileContent);
        (<sinon.SinonStub>mockFilesystem.resolveContent).onCall(2).resolves(newWorkspaceFileContent);
        stubGetFileStat.withArgs(folderA.uri).resolves(folderA);
        stubGetFileStat.withArgs(folderB.uri).resolves(folderB);
        stubGetFileStat.withArgs(folderC.uri).resolves(folderC);
        (<sinon.SinonStub>mockFileSystemWatcher.watchFileChanges).resolves(new DisposableCollection());

        wsService['init']().then(() => {
            const dis = wsService.onWorkspaceChanged(roots => {
                expect(roots.length).to.eq(2);
                expect(roots[0].uri).to.eq(folderB.uri);
                expect(roots[1].uri).to.eq(folderC.uri);
                dis.dispose();
                done();
            });
            toDispose.push(dis);
            mockFileChangeEmitter.fire([{ uri: new URI(workspaceFileUri), type: FileChangeType.UPDATED }]);
        });
    }).timeout(2000);
});
