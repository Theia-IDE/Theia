/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
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

import { expect } from 'chai';
import URI from '@theia/core/lib/common/uri';
import { Container } from '@theia/core/shared/inversify';
import { FileDialogService } from '@theia/filesystem/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileStat } from '@theia/filesystem/lib/common/files';
import { LabelProvider, OpenerService, FrontendApplication } from '@theia/core/lib/browser';
import { MessageService, OS } from '@theia/core/lib/common';
import { SelectionService } from '@theia/core/lib/common/selection-service';
import { WorkspaceCommandContribution } from './workspace-commands';
import { WorkspaceCompareHandler } from './workspace-compare-handler';
import { WorkspaceDeleteHandler } from './workspace-delete-handler';
import { WorkspaceDuplicateHandler } from './workspace-duplicate-handler';
import { WorkspacePreferences } from './workspace-preferences';
import { WorkspaceService } from './workspace-service';
import { ApplicationServer } from '@theia/core/lib/common/application-protocol';

disableJSDOM();

describe('workspace-commands', () => {

    let commands: WorkspaceCommandContribution;

    const childStat: FileStat = {
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
        resource: new URI('foo/bar'),
        name: 'bar',
    };

    const parent: FileStat = {
        isFile: false,
        isDirectory: true,
        isSymbolicLink: false,
        resource: new URI('foo'),
        name: 'foo',
        children: [
            childStat
        ]
    };

    before(() => disableJSDOM = enableJSDOM());
    after(() => disableJSDOM());

    beforeEach(() => {
        const container = new Container();

        container.bind(FileDialogService).toConstantValue(<FileDialogService>{});
        container.bind(FileService).toConstantValue(<FileService>{
            async exists(resource: URI): Promise<boolean> {
                return resource.path.base.includes('bar'); // 'bar' exists for test purposes.
            }
        });
        container.bind(FrontendApplication).toConstantValue(<FrontendApplication>{});
        container.bind(LabelProvider).toConstantValue(<LabelProvider>{});
        container.bind(MessageService).toConstantValue(<MessageService>{});
        container.bind(OpenerService).toConstantValue(<OpenerService>{});
        container.bind(SelectionService).toConstantValue(<SelectionService>{});
        container.bind(WorkspaceCommandContribution).toSelf().inSingletonScope();
        container.bind(WorkspaceCompareHandler).toConstantValue(<WorkspaceCompareHandler>{});
        container.bind(WorkspaceDeleteHandler).toConstantValue(<WorkspaceDeleteHandler>{});
        container.bind(WorkspaceDuplicateHandler).toConstantValue(<WorkspaceDuplicateHandler>{});
        container.bind(WorkspacePreferences).toConstantValue(<WorkspacePreferences>{});
        container.bind(WorkspaceService).toConstantValue(<WorkspaceService>{});
        container.bind(ApplicationServer).toConstantValue(<ApplicationServer>{
            getBackendOS(): Promise<OS.Type> {
                return Promise.resolve(OS.type());
            }
        });

        commands = container.get(WorkspaceCommandContribution);
    });

    describe('#validateFileName', () => {

        it('should not validate an empty file name', async () => {
            const message = await commands['validateFileName']('', parent);
            expect(message).to.equal('');
        });

        it('should accept the resource does not exist', async () => {
            const message = await commands['validateFileName']('a.ts', parent);
            expect(message).to.equal('');
        });

        it('should not accept if the resource exists', async () => {
            const message = await commands['validateFileName']('bar', parent);
            expect(message).to.not.equal(''); // a non empty message indicates an error.
        });

        it('should not accept invalid filenames', async () => {
            let message = await commands['validateFileName']('.', parent, true); // invalid filename.
            expect(message).to.not.equal('');

            message = await commands['validateFileName']('/a', parent, true); // invalid starts-with `\`.
            expect(message).to.not.equal('');

            message = await commands['validateFileName'](' a', parent, true); // invalid leading whitespace.
            expect(message).to.not.equal('');

            message = await commands['validateFileName']('a ', parent, true); // invalid trailing whitespace.
            expect(message).to.not.equal('');

        });

    });

    describe('#validateFileRename', () => {

        it('should accept if the resource exists case-insensitively', async () => {
            const initialValue: string = 'bar';
            const newValue = 'Bar';
            const overwrite = parent.resource.resolve(newValue).isEqual(parent.resource.resolve(initialValue), false);
            const message = await commands['validateFileRename'](newValue, parent, initialValue, overwrite);
            expect(message).to.equal('');
        });

        it('should accept if the resource does not exist case-insensitively', async () => {
            const initialValue: string = 'bar';
            const newValue = 'foo';
            const overwrite = parent.resource.resolve(newValue).isEqual(parent.resource.resolve(initialValue), false);
            const message = await commands['validateFileRename'](newValue, parent, initialValue, overwrite);
            expect(message).to.equal('');
        });

    });

});
