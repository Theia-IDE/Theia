/********************************************************************************
 * Copyright (C) 2021 1C-Soft LLC and others.
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

import { DepthFirstTreeIterator, Tree, TreeDecoration } from '@theia/core/lib/browser';
import { ProblemDecorator } from '@theia/markers/lib/browser/problem/problem-decorator';
import { Marker } from '@theia/markers/lib/common/marker';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Diagnostic } from '@theia/core/shared/vscode-languageserver-protocol';
import URI from '@theia/core/lib/common/uri';
import { TreeItem } from '../../../plugin/types-impl';
import { ProblemManager } from '@theia/markers/lib/browser';

@injectable()
export class TreeViewProblemDecorator extends ProblemDecorator {

    constructor(@inject(ProblemManager) protected readonly problemManager: ProblemManager) {
        super(problemManager);
    }

    protected collectDecorators(tree: Tree): Map<string, TreeDecoration.Data> {
        const result = new Map<string, Marker<Diagnostic>>();

        // If the tree root is undefined or the preference for the decorations is disabled, return an empty result map.
        if (tree.root === undefined || !this.problemPreferences['problems.decorations.enabled']) {
            return new Map<string, TreeDecoration.Data>();
        }

        const pathToIdMap = new Map<string, string>();

        for (const node of new DepthFirstTreeIterator(tree.root)) {
            if (this.isTreeItem(node) && node.resourceUri) {
                pathToIdMap.set(node.resourceUri.toString(), node.id);
            }
        }

        const markers = this.appendContainerItemMarkers(tree, this.collectMarkers(tree), pathToIdMap);

        markers.forEach((marker: Marker<Diagnostic>, uri: string) => {
            const nodeId = pathToIdMap.get(uri);
            if (nodeId) {
                result.set(nodeId, marker);
            }
        });

        return new Map(Array.from(result.entries()).map(m => [m[0], this.toDecorator(m[1])]));
    }

    protected appendContainerItemMarkers(tree: Tree, markers: Marker<Diagnostic>[], pathToIdMap: Map<string, string>): Map<string, Marker<Diagnostic>> {
        const result: Map<string, Marker<Diagnostic>> = new Map();
        // We traverse up and assign the diagnostic to the container element.
        // Just like file based traverse, but use element parent instead.
        for (const [uri, marker] of new Map<URI, Marker<Diagnostic>>(markers.map(m => [new URI(m.uri), m])).entries()) {
            const uriString = uri.toString();
            result.set(uriString, marker);
            const parentNode = tree.getNode(pathToIdMap.get(uriString))?.parent;
            if (this.isTreeItem(parentNode) && parentNode.resourceUri) {
                let parentUri: URI | undefined = new URI(parentNode.resourceUri);
                while (parentUri && !parentUri.path.isRoot) {
                    const parentUriString = parentUri.toString();
                    const existing = result.get(parentUriString);
                    // Make sure the highest diagnostic severity (smaller number) will be propagated to the container directory.
                    if (existing === undefined || this.compare(marker, existing) < 0) {
                        result.set(parentUriString, {
                            data: marker.data,
                            uri: parentUriString,
                            owner: marker.owner,
                            kind: marker.kind
                        });
                        parentUri = parentUri.parent;
                    } else {
                        parentUri = undefined;
                    }
                }
            }
        }

        return result;
    }

    private isTreeItem(node: object | undefined): node is TreeItem {
        return !!node && 'resourceUri' in node;
    }
}
