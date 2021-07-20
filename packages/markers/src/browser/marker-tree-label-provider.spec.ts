/********************************************************************************
 * Copyright (C) 2020 Ericsson and others.
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

import URI from '@theia/core/lib/common/uri';
import { expect } from 'chai';
import { Container } from '@theia/core/shared/inversify';
import { ContributionProvider, Event } from '@theia/core/lib/common';
import { LabelProvider, LabelProviderContribution, DefaultUriLabelProviderContribution, ApplicationShell, WidgetManager } from '@theia/core/lib/browser';
import { MarkerInfoNode } from './marker-tree';
import { MarkerTreeLabelProvider } from './marker-tree-label-provider';
import { Signal } from '@theia/core/shared/@phosphor/signaling';
import { TreeLabelProvider } from '@theia/core/lib/browser/tree/tree-label-provider';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { WorkspaceUriLabelProviderContribution } from '@theia/workspace/lib/browser/workspace-uri-contribution';
import { WorkspaceVariableContribution } from '@theia/workspace/lib/browser/workspace-variable-contribution';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileStat } from '@theia/filesystem/lib/common/files';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { MockEnvVariablesServerImpl } from '@theia/core/lib/browser/test/mock-env-variables-server';
import { FileUri } from '@theia/core/lib/node';
import * as temp from 'temp';

disableJSDOM();

let markerTreeLabelProvider: MarkerTreeLabelProvider;
let workspaceService: WorkspaceService;

before(() => {
    disableJSDOM = enableJSDOM();
    const testContainer = new Container();

    workspaceService = new WorkspaceService();
    testContainer.bind(WorkspaceService).toConstantValue(workspaceService);
    testContainer.bind(WorkspaceVariableContribution).toSelf().inSingletonScope();
    testContainer.bind(ApplicationShell).toConstantValue({
        currentChanged: new Signal({}),
        widgets: []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    testContainer.bind(WidgetManager).toConstantValue({
        onDidCreateWidget: Event.None
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    testContainer.bind(FileService).toConstantValue(<FileService>{});

    testContainer.bind(DefaultUriLabelProviderContribution).toSelf().inSingletonScope();
    testContainer.bind(WorkspaceUriLabelProviderContribution).toSelf().inSingletonScope();
    testContainer.bind(LabelProvider).toSelf().inSingletonScope();
    testContainer.bind(MarkerTreeLabelProvider).toSelf().inSingletonScope();
    testContainer.bind(TreeLabelProvider).toSelf().inSingletonScope();
    testContainer.bind(EnvVariablesServer).toConstantValue(new MockEnvVariablesServerImpl(FileUri.create(temp.track().mkdirSync())));

    testContainer.bind<ContributionProvider<LabelProviderContribution>>(ContributionProvider).toDynamicValue(ctx => ({
        getContributions(): LabelProviderContribution[] {
            return [
                ctx.container.get<MarkerTreeLabelProvider>(MarkerTreeLabelProvider),
                ctx.container.get<TreeLabelProvider>(TreeLabelProvider),
                ctx.container.get<WorkspaceUriLabelProviderContribution>(WorkspaceUriLabelProviderContribution),
                ctx.container.get<DefaultUriLabelProviderContribution>(DefaultUriLabelProviderContribution)
            ];
        }
    })).inSingletonScope();

    markerTreeLabelProvider = testContainer.get<MarkerTreeLabelProvider>(MarkerTreeLabelProvider);
    workspaceService = testContainer.get<WorkspaceService>(WorkspaceService);
});

after(() => {
    disableJSDOM();
});

describe('Marker Tree Label Provider', () => {

    describe('#getName', () => {
        it('should return the correct filename and extension', () => {
            const label = markerTreeLabelProvider.getName(
                createMarkerInfoNode('a/b/c/foo.ts')
            );
            expect(label).equals('foo.ts');
        });
    });

    describe('getLongName', () => {
        describe('single-root workspace', () => {
            beforeEach(() => {
                const root = FileStat.dir('file:///home/a');
                workspaceService['_workspace'] = root;
                workspaceService['_roots'] = [root];
            });
            it('should return the proper label for a directory', () => {
                const label = markerTreeLabelProvider.getLongName(
                    createMarkerInfoNode('file:///home/a/b/c/foo.ts')
                );
                expect(label).equals('b/c');
            });
            it('should return the proper label for a directory starting with \'.\'', () => {
                const label = markerTreeLabelProvider.getLongName(
                    createMarkerInfoNode('file:///home/a/b/.c/foo.ts')
                );
                expect(label).equals('b/.c');
            });
            it('should return the proper label when the resource is located at the workspace root', () => {
                const label = markerTreeLabelProvider.getLongName(
                    createMarkerInfoNode('file:///home/a/foo.ts')
                );
                expect(label).equals('');
            });
            it('should return the full path when the resource does not exist in the workspace root', () => {
                const label = markerTreeLabelProvider.getLongName(
                    createMarkerInfoNode('file:///home/b/foo.ts')
                );
                expect(label).equals('/home/b');
            });
        });
        describe('multi-root workspace', () => {
            beforeEach(() => {
                const uri: string = 'file:///file';
                const file = FileStat.file(uri);
                const root1 = FileStat.dir('file:///root1');
                const root2 = FileStat.dir('file:///root2');
                workspaceService['_workspace'] = file;
                workspaceService['_roots'] = [root1, root2];
            });
            it('should return the proper root \'root1\' and directory', () => {
                const label = markerTreeLabelProvider.getLongName(
                    createMarkerInfoNode('file:///root1/foo/foo.ts')
                );
                expect(label).equals('root1 ● foo');
            });
            it('should return the proper root \'root2\' and directory', () => {
                const label = markerTreeLabelProvider.getLongName(
                    createMarkerInfoNode('file:///root2/foo/foo.ts')
                );
                expect(label).equals('root2 ● foo');
            });
            it('should only return the root when the resource is located at the workspace root', () => {
                const label = markerTreeLabelProvider.getLongName(
                    createMarkerInfoNode('file:///root1/foo.ts')
                );
                expect(label).equals('root1');
            });
            it('should return the full path when the resource does not exist in any workspace root', () => {
                const label = markerTreeLabelProvider.getLongName(
                    createMarkerInfoNode('file:///home/a/b/foo.ts')
                );
                expect(label).equals('/home/a/b');
            });
        });
    });

    describe('#getIcon', () => {
        it('should return a typescript icon for a typescript file', () => {
            const icon = markerTreeLabelProvider.getIcon(
                createMarkerInfoNode('a/b/c/foo.ts')
            );
            expect(icon).contain('ts-icon');
        });
        it('should return a json icon for a json file', () => {
            const icon = markerTreeLabelProvider.getIcon(
                createMarkerInfoNode('a/b/c/foo.json')
            );
            expect(icon).contain('database-icon');
        });
        it('should return a generic icon for a file with no extension', () => {
            const icon = markerTreeLabelProvider.getIcon(
                createMarkerInfoNode('a/b/c/foo.md')
            );
            expect(icon).contain('markdown-icon');
        });
    });

    describe('#getDescription', () => {
        beforeEach(() => {
            const root = FileStat.dir('file:///home/a');
            workspaceService['_workspace'] = root;
            workspaceService['_roots'] = [root];
        });
        it('should return the parent\' long name', () => {
            const label = markerTreeLabelProvider.getDescription(
                createMarkerInfoNode('file:///home/a/b/c/foo.ts')
            );
            expect(label).equals('b/c');
        });
    });

    describe('#canHandle', () => {
        it('should successfully handle \'MarkerInfoNodes\'', () => {
            const node = createMarkerInfoNode('a/b/c/foo.ts');
            expect(markerTreeLabelProvider.canHandle(node)).greaterThan(0);
        });
    });

});

/**
 * Create a marker info node for test purposes.
 * @param uri the marker uri.
 *
 * @returns a mock marker info node.
 */
function createMarkerInfoNode(uri: string): MarkerInfoNode {
    return {
        id: 'id',
        parent: {
            id: 'parent-id',
            kind: '',
            parent: undefined,
            children: []
        },
        numberOfMarkers: 1,
        children: [],
        expanded: true,
        selected: true,
        uri: new URI(uri)
    };
}
