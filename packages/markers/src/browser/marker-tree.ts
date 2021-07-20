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

import { injectable } from '@theia/core/shared/inversify';
import { TreeImpl, CompositeTreeNode, TreeNode, SelectableTreeNode, ExpandableTreeNode } from '@theia/core/lib/browser';
import { MarkerManager } from './marker-manager';
import { Marker } from '../common/marker';
import { UriSelection } from '@theia/core/lib/common/selection';
import URI from '@theia/core/lib/common/uri';
import { ProblemSelection } from './problem/problem-selection';
import { DiagnosticSeverity } from '@theia/core/shared/vscode-languageserver-types';

export const MarkerOptions = Symbol('MarkerOptions');
export interface MarkerOptions {
    readonly kind: string;
}

@injectable()
export abstract class MarkerTree<T extends object> extends TreeImpl {

    constructor(
        protected readonly markerManager: MarkerManager<T>,
        protected readonly markerOptions: MarkerOptions
    ) {
        super();

        this.toDispose.push(markerManager.onDidChangeMarkers(uri => this.refreshMarkerInfo(uri)));

        this.root = <MarkerRootNode>{
            visible: false,
            id: 'theia-' + markerOptions.kind + '-marker-widget',
            name: 'MarkerTree',
            kind: markerOptions.kind,
            children: [],
            parent: undefined
        };
    }

    protected async refreshMarkerInfo(uri: URI): Promise<void> {
        const id = uri.toString();
        const existing = this.getNode(id);
        const markers = this.markerManager.findMarkers({ uri });
        if (markers.length <= 0) {
            if (MarkerInfoNode.is(existing)) {
                CompositeTreeNode.removeChild(existing.parent, existing);
                this.removeNode(existing);
                this.fireChanged();
            }
            return;
        }
        const node = MarkerInfoNode.is(existing) ? existing : this.createMarkerInfo(id, uri);
        CompositeTreeNode.addChild(node.parent, node);
        const children = this.getMarkerNodes(node, markers);
        node.numberOfMarkers = markers.length;
        this.setChildren(node, children);
    }

    protected async resolveChildren(parent: CompositeTreeNode): Promise<TreeNode[]> {
        if (MarkerRootNode.is(parent)) {
            const nodes: MarkerInfoNode[] = [];
            for (const id of this.markerManager.getUris()) {
                const uri = new URI(id);
                const existing = this.getNode(id);
                const markers = this.markerManager.findMarkers({ uri });
                const node = MarkerInfoNode.is(existing) ? existing : this.createMarkerInfo(id, uri);
                node.children = this.getMarkerNodes(node, markers);
                node.numberOfMarkers = node.children.length;
                nodes.push(node);
            }
            return nodes;
        }
        return super.resolveChildren(parent);
    }

    protected createMarkerInfo(id: string, uri: URI): MarkerInfoNode {
        return {
            children: [],
            expanded: true,
            uri,
            id,
            parent: this.root as MarkerRootNode,
            selected: false,
            numberOfMarkers: 0
        };
    }

    protected getMarkerNodes(parent: MarkerInfoNode, markers: Marker<T>[]): MarkerNode[] {
        return markers.map((marker, index) =>
            this.createMarkerNode(marker, index, parent)
        );
    }
    protected createMarkerNode(marker: Marker<T>, index: number, parent: MarkerInfoNode): MarkerNode {
        const id = parent.id + '_' + index;
        const existing = this.getNode(id);
        if (MarkerNode.is(existing)) {
            existing.marker = marker;
            return existing;
        }
        return {
            id,
            name: 'marker',
            parent,
            selected: false,
            uri: parent.uri,
            marker
        };
    }
}

export interface MarkerNode extends UriSelection, SelectableTreeNode, ProblemSelection {
    marker: Marker<object>;
}
export namespace MarkerNode {
    export function is(node: TreeNode | undefined): node is MarkerNode {
        return UriSelection.is(node) && SelectableTreeNode.is(node) && ProblemSelection.is(node);
    }
}

export interface MarkerInfoNode extends UriSelection, SelectableTreeNode, ExpandableTreeNode {
    parent: MarkerRootNode;
    numberOfMarkers: number;
    severity?: DiagnosticSeverity;
}
export namespace MarkerInfoNode {
    export function is(node: Object | undefined): node is MarkerInfoNode {
        return ExpandableTreeNode.is(node) && UriSelection.is(node) && 'numberOfMarkers' in node;
    }
}

export interface MarkerRootNode extends CompositeTreeNode {
    kind: string;
}
export namespace MarkerRootNode {
    export function is(node: TreeNode | undefined): node is MarkerRootNode {
        return CompositeTreeNode.is(node) && 'kind' in node;
    }
}
