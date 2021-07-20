/********************************************************************************
 * Copyright (C) 2021 EclipseSource and others.
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

import URI from '@theia/core/lib/common/uri';
import { expect } from 'chai';
import { Container } from '@theia/core/shared/inversify';
import { Diagnostic, Range, DiagnosticSeverity } from '@theia/core/shared/vscode-languageserver-types';
import { Event } from '@theia/core/lib/common/event';
import { MarkerManager } from '../marker-manager';
import { MarkerInfoNode, MarkerNode, MarkerOptions, MarkerRootNode } from '../marker-tree';
import { PROBLEM_OPTIONS } from './problem-container';
import { ProblemManager } from './problem-manager';
import { ProblemTree } from './problem-tree-model';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { ProblemCompositeTreeNode } from './problem-composite-tree-node';
import { Marker } from '../../common/marker';

disableJSDOM();

let rootNode: MarkerRootNode = {
    visible: false,
    id: 'theia-problem-marker-widget',
    name: 'MarkerTree',
    kind: 'problem',
    children: [],
    parent: undefined
};

before(() => {
    disableJSDOM = enableJSDOM();
    const testContainer = new Container();

    testContainer.bind(MarkerManager).toSelf().inSingletonScope();
    testContainer.bind(ProblemManager).toSelf();
    testContainer.bind(MarkerOptions).toConstantValue(PROBLEM_OPTIONS);
    testContainer.bind(FileService).toConstantValue(<FileService>{
        onDidFilesChange: Event.None
    });

    testContainer.bind(ProblemTree).toSelf().inSingletonScope();
});

beforeEach(() => {
    rootNode = {
        visible: false,
        id: 'theia-problem-marker-widget',
        name: 'MarkerTree',
        kind: 'problem',
        children: [],
        parent: undefined
    };
});

after(() => {
    disableJSDOM();
});

describe('problem-composite-tree-node', () => {

    describe('#sortMarkersInfo', () => {

        describe('should sort markersInfo based on the highest severity', () => {

            it('should sort error higher than warnings', () => {
                const markerA = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Error);
                const markerB = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Warning);
                const nodeA = createMockMarkerNode(markerA);
                const nodeB = createMockMarkerNode(markerB);
                const markerInfoNodeA = createMarkerInfo('1', new URI('a'), [nodeA]);
                const markerInfoNodeB = createMarkerInfo('2', new URI('b'), [nodeB]);
                ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeA, [markerA]);
                ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeB, [markerB]);

                expect(rootNode.children.length).to.equal(2);
                expect(rootNode.children[0]).to.equal(markerInfoNodeA);
                expect(markerInfoNodeA.nextSibling).to.equal(markerInfoNodeB);
                expect(rootNode.children[1]).to.equal(markerInfoNodeB);
                expect(markerInfoNodeB.previousSibling).to.equal(markerInfoNodeA);
            });

            it('should sort errors higher than infos', () => {
                const markerA = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Information);
                const markerB = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Error);
                const nodeA = createMockMarkerNode(markerA);
                const nodeB = createMockMarkerNode(markerB);
                const markerInfoNodeA = createMarkerInfo('1', new URI('a'), [nodeA]);
                const markerInfoNodeB = createMarkerInfo('2', new URI('b'), [nodeB]);
                ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeA, [markerA]);
                ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeB, [markerB]);

                expect(rootNode.children.length).to.equal(2);
                expect(rootNode.children[0]).to.equal(markerInfoNodeB);
                expect(markerInfoNodeB.nextSibling).to.equal(markerInfoNodeA);
                expect(rootNode.children[1]).to.equal(markerInfoNodeA);
                expect(markerInfoNodeA.previousSibling).to.equal(markerInfoNodeB);
            });

            it('should sort errors higher than hints', () => {
                const markerA = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Error);
                const markerB = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Hint);
                const nodeA = createMockMarkerNode(markerA);
                const nodeB = createMockMarkerNode(markerB);
                const markerInfoNodeA = createMarkerInfo('1', new URI('a'), [nodeA]);
                const markerInfoNodeB = createMarkerInfo('2', new URI('b'), [nodeB]);
                ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeA, [markerA]);
                ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeB, [markerB]);

                expect(rootNode.children.length).to.equal(2);
                expect(rootNode.children[0]).to.equal(markerInfoNodeA);
                expect(markerInfoNodeA.nextSibling).to.equal(markerInfoNodeB);
                expect(rootNode.children[1]).to.equal(markerInfoNodeB);
                expect(markerInfoNodeB.previousSibling).to.equal(markerInfoNodeA);
            });

            it('should sort warnings higher than infos', () => {
                const markerA = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Warning);
                const markerB = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Hint);
                const nodeA = createMockMarkerNode(markerA);
                const nodeB = createMockMarkerNode(markerB);
                const markerInfoNodeA = createMarkerInfo('1', new URI('c'), [nodeA]);
                const markerInfoNodeB = createMarkerInfo('2', new URI('a'), [nodeB]);
                ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeA, [markerA]);
                ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeB, [markerB]);

                expect(rootNode.children.length).to.equal(2);
                expect(rootNode.children[0]).to.equal(markerInfoNodeA);
                expect(markerInfoNodeA.nextSibling).to.equal(markerInfoNodeB);
                expect(rootNode.children[1]).to.equal(markerInfoNodeB);
                expect(markerInfoNodeB.previousSibling).to.equal(markerInfoNodeA);
            });

            it('should sort warnings higher than hints', () => {
                const markerA = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Warning);
                const markerB = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Hint);
                const nodeA = createMockMarkerNode(markerA);
                const nodeB = createMockMarkerNode(markerB);
                const markerInfoNodeA = createMarkerInfo('1', new URI('a'), [nodeA]);
                const markerInfoNodeB = createMarkerInfo('2', new URI('b'), [nodeB]);
                ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeA, [markerA]);
                ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeB, [markerB]);

                expect(rootNode.children.length).to.equal(2);
                expect(rootNode.children[0]).to.equal(markerInfoNodeA);
                expect(markerInfoNodeA.nextSibling).to.equal(markerInfoNodeB);
                expect(rootNode.children[1]).to.equal(markerInfoNodeB);
                expect(markerInfoNodeB.previousSibling).to.equal(markerInfoNodeA);
            });

            it('should sort infos higher than hints', () => {
                const markerA = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Information);
                const markerB = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Hint);
                const nodeA = createMockMarkerNode(markerA);
                const nodeB = createMockMarkerNode(markerB);
                const markerInfoNodeA = createMarkerInfo('1', new URI('a'), [nodeA]);
                const markerInfoNodeB = createMarkerInfo('2', new URI('b'), [nodeB]);
                ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeA, [markerA]);
                ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeB, [markerB]);

                expect(rootNode.children.length).to.equal(2);
                expect(rootNode.children[0]).to.equal(markerInfoNodeA);
                expect(markerInfoNodeA.nextSibling).to.equal(markerInfoNodeB);
                expect(rootNode.children[1]).to.equal(markerInfoNodeB);
                expect(markerInfoNodeB.previousSibling).to.equal(markerInfoNodeA);
            });
        });

        it('should sort markersInfo based on URI if severities are equal', () => {
            const markerA = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Error);
            const markerB = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Error);
            const nodeA = createMockMarkerNode(markerA);
            const nodeB = createMockMarkerNode(markerB);
            const markerInfoNodeA = createMarkerInfo('1', new URI('a'), [nodeA]);
            const markerInfoNodeB = createMarkerInfo('2', new URI('b'), [nodeB]);
            ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeA, [markerA]);
            ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeB, [markerB]);

            expect(rootNode.children.length).to.equal(2);
            expect(rootNode.children[0]).to.equal(markerInfoNodeA);
            expect(markerInfoNodeA.nextSibling).to.equal(markerInfoNodeB);
            expect(rootNode.children[1]).to.equal(markerInfoNodeB);
            expect(markerInfoNodeB.previousSibling).to.equal(markerInfoNodeA);
        });

        it('change marker content', () => {
            const markerA = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Error);
            const nodeA = createMockMarkerNode(markerA);
            const markerInfoNodeA = createMarkerInfo('1', new URI('a'), [nodeA]);
            ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeA, [markerA]);

            markerA.data.severity = DiagnosticSeverity.Hint;
            ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeA, [markerA]);
            ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeA, [markerA]);
            ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeA, [markerA]);

            expect(rootNode.children.length).to.equal(1);
            expect(rootNode.children[0]).to.equal(markerInfoNodeA);
        });

        it('change marker content leading to lower rank', () => {
            const markerA = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Error);
            const nodeA = createMockMarkerNode(markerA);
            const markerInfoNodeA = createMarkerInfo('1', new URI('a'), [nodeA]);
            ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeA, [markerA]);

            const markerB = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Error);
            const nodeB = createMockMarkerNode(markerB);
            const markerInfoNodeB = createMarkerInfo('2', new URI('b'), [nodeB]);
            ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeB, [markerB]);

            markerA.data.severity = DiagnosticSeverity.Hint;
            ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeA, [markerA]);

            expect(rootNode.children.length).to.equal(2);
            expect(rootNode.children[0]).to.equal(markerInfoNodeB);
            expect(markerInfoNodeB.nextSibling).to.equal(markerInfoNodeA);
            expect(rootNode.children[1]).to.equal(markerInfoNodeA);
            expect(markerInfoNodeA.previousSibling).to.equal(markerInfoNodeB);
        });

        it('change marker content leading to higher rank', () => {
            const markerA = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Hint);
            const nodeA = createMockMarkerNode(markerA);
            const markerInfoNodeA = createMarkerInfo('1', new URI('a'), [nodeA]);
            ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeA, [markerA]);

            const markerB = createMockMarker({ start: { line: 0, character: 10 }, end: { line: 0, character: 10 } }, DiagnosticSeverity.Error);
            const nodeB = createMockMarkerNode(markerB);
            const markerInfoNodeB = createMarkerInfo('2', new URI('b'), [nodeB]);
            ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeB, [markerB]);

            markerA.data.severity = DiagnosticSeverity.Error;
            ProblemCompositeTreeNode.addChild(rootNode, markerInfoNodeA, [markerA]);

            expect(rootNode.children.length).to.equal(2);
            expect(rootNode.children[0]).to.equal(markerInfoNodeA);
            expect(markerInfoNodeA.nextSibling).to.equal(markerInfoNodeB);
            expect(rootNode.children[1]).to.equal(markerInfoNodeB);
            expect(markerInfoNodeB.previousSibling).to.equal(markerInfoNodeA);
        });
    });
});

function createMarkerInfo(id: string, uri: URI, marker: MarkerNode[]): MarkerInfoNode {
    return {
        children: marker ? marker : [],
        expanded: true,
        uri,
        id,
        parent: rootNode,
        selected: false,
        numberOfMarkers: marker ? marker.length : 0
    };
}

/**
 * Create a mock marker node with the given diagnostic marker.
 * @param marker the diagnostic marker.
 *
 * @returns a mock marker node.
 */
function createMockMarkerNode(marker: Marker<Diagnostic>): MarkerNode {
    return {
        id: 'id',
        name: 'marker',
        parent: undefined,
        selected: false,
        uri: new URI(''),
        marker
    };
}

/**
 * Create a mock diagnostic marker.
 * @param range the diagnostic range.
 * @param severity the diagnostic severity.
 * @param owner the optional owner of the diagnostic
 *
 * @returns a mock diagnostic marker.
 */
function createMockMarker(range: Range, severity: DiagnosticSeverity, owner?: string): Readonly<Marker<Diagnostic>> {
    const data: Diagnostic = {
        range: range,
        severity: severity,
        message: 'message'
    };
    return Object.freeze({
        uri: 'uri',
        kind: 'marker',
        owner: owner ?? 'owner',
        data
    });
}
