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
const disableJSDOM = enableJSDOM();

import { expect } from 'chai';
import * as sinon from 'sinon';
import { Container } from '@theia/core/shared/inversify';
import { Signal } from '@theia/core/shared/@phosphor/signaling';
import { Event } from '@theia/core/lib/common/event';
import { ApplicationShell, WidgetManager } from '@theia/core/lib/browser';
import { DefaultUriLabelProviderContribution } from '@theia/core/lib/browser/label-provider';
import { WorkspaceUriLabelProviderContribution } from './workspace-uri-contribution';
import URI from '@theia/core/lib/common/uri';
import { WorkspaceVariableContribution } from './workspace-variable-contribution';
import { WorkspaceService } from './workspace-service';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileStat } from '@theia/filesystem/lib/common/files';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { MockEnvVariablesServerImpl } from '@theia/core/lib/browser/test/mock-env-variables-server';
import { FileUri } from '@theia/core/lib/node';
import * as temp from 'temp';

after(() => disableJSDOM());

let container: Container;
let labelProvider: WorkspaceUriLabelProviderContribution;
let roots: FileStat[];
beforeEach(() => {
    roots = [FileStat.dir('file:///workspace')];

    container = new Container();
    container.bind(ApplicationShell).toConstantValue({
        currentChanged: new Signal({}),
        widgets: []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    container.bind(WidgetManager).toConstantValue({
        onDidCreateWidget: Event.None
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const workspaceService = new WorkspaceService();
    workspaceService.tryGetRoots = () => roots;
    container.bind(WorkspaceService).toConstantValue(workspaceService);
    container.bind(WorkspaceVariableContribution).toSelf().inSingletonScope();
    container.bind(WorkspaceUriLabelProviderContribution).toSelf().inSingletonScope();
    container.bind(FileService).toConstantValue({} as FileService);
    container.bind(EnvVariablesServer).toConstantValue(new MockEnvVariablesServerImpl(FileUri.create(temp.track().mkdirSync())));
    labelProvider = container.get(WorkspaceUriLabelProviderContribution);
});

afterEach(() => {
    roots = undefined!;
    labelProvider = undefined!;
    container = undefined!;
});

describe('WorkspaceUriLabelProviderContribution class', () => {
    const stubs: sinon.SinonStub[] = [];

    afterEach(() => {
        stubs.forEach(s => s.restore());
        stubs.length = 0;
    });

    describe('canHandle()', () => {
        it('should return 0 if the passed in argument is not a FileStat or URI with the "file" scheme', () => {
            expect(labelProvider.canHandle(new URI('user-storage:settings.json'))).eq(0);
            expect(labelProvider.canHandle({ uri: 'file:///home/settings.json' })).eq(0);
        });

        it('should return 10 if the passed in argument is a FileStat or URI with the "file" scheme', () => {
            expect(labelProvider.canHandle(new URI('file:///home/settings.json'))).eq(10);
            expect(labelProvider.canHandle(FileStat.file('file:///home/settings.json'))).eq(10);
        });
    });

    describe('getIcon()', () => {
        it('should return folder icon from the FileStat of a folder', async () => {
            expect(labelProvider.getIcon(FileStat.dir('file:///home/'))).eq(labelProvider.defaultFolderIcon);
        });

        it('should return file icon from a non-folder FileStat', async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stubs.push(sinon.stub(DefaultUriLabelProviderContribution.prototype, <any>'getFileIcon').returns(undefined));
            expect(labelProvider.getIcon(FileStat.file('file:///home/test'))).eq(labelProvider.defaultFileIcon);
        });

        it('should return folder icon from a folder URI', async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stubs.push(sinon.stub(DefaultUriLabelProviderContribution.prototype, <any>'getFileIcon').returns(undefined));
            expect(labelProvider.getIcon(FileStat.dir('file:///home/test'))).eq(labelProvider.defaultFolderIcon);
        });

        it('should return file icon from a file URI', async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stubs.push(sinon.stub(DefaultUriLabelProviderContribution.prototype, <any>'getFileIcon').returns(undefined));
            expect(labelProvider.getIcon(FileStat.file('file:///home/test'))).eq(labelProvider.defaultFileIcon);
        });

        it('should return what getFileIcon() returns from a URI or non-folder FileStat, if getFileIcon() does not return null or undefined', async () => {
            const ret = 'TestString';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stubs.push(sinon.stub(DefaultUriLabelProviderContribution.prototype, <any>'getFileIcon').returns(ret));
            expect(labelProvider.getIcon(new URI('file:///home/test'))).eq(ret);
            expect(labelProvider.getIcon(FileStat.file('file:///home/test'))).eq(ret);
        });
    });

    describe('getName()', () => {
        it('should return the display name of a file from its URI', () => {
            const file = new URI('file:///workspace-2/jacques.doc');
            const name = labelProvider.getName(file);
            expect(name).eq('jacques.doc');
        });

        it('should return the display name of a file from its FileStat', () => {
            const file: FileStat = FileStat.file('file:///workspace-2/jacques.doc');
            const name = labelProvider.getName(file);
            expect(name).eq('jacques.doc');
        });
    });

    describe('getLongName()', () => {
        it('should return the path of a file relative to the workspace from the file\'s URI if the file is in the workspace', () => {
            const file = new URI('file:///workspace/some/very-long/path.js');
            const longName = labelProvider.getLongName(file);
            expect(longName).eq('some/very-long/path.js');
        });

        it('should return the path of a file relative to the workspace from the file\'s FileStat if the file is in the workspace', () => {
            const file: FileStat = FileStat.file('file:///workspace/some/very-long/path.js');
            const longName = labelProvider.getLongName(file);
            expect(longName).eq('some/very-long/path.js');
        });

        it('should return the absolute path of a file from the file\'s URI if the file is not in the workspace', () => {
            const file = new URI('file:///tmp/prout.txt');
            const longName = labelProvider.getLongName(file);
            expect(longName).eq('/tmp/prout.txt');
        });

        it('should return the absolute path of a file from the file\'s FileStat if the file is not in the workspace', () => {
            const file: FileStat = FileStat.file('file:///tmp/prout.txt');
            const longName = labelProvider.getLongName(file);
            expect(longName).eq('/tmp/prout.txt');
        });

        it('should return the path of a file if WorkspaceService returns no roots', () => {
            roots = [];
            const file = new URI('file:///tmp/prout.txt');
            const longName = labelProvider.getLongName(file);
            expect(longName).eq('/tmp/prout.txt');
        });
    });

});
