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

import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { Diagnostic, DiagnosticSeverity } from '@theia/core/shared/vscode-languageserver-types';
import URI from '@theia/core/lib/common/uri';
import { notEmpty } from '@theia/core/lib/common/objects';
import { Event, Emitter } from '@theia/core/lib/common/event';
import { Tree } from '@theia/core/lib/browser/tree/tree';
import { DepthFirstTreeIterator } from '@theia/core/lib/browser/tree/tree-iterator';
import { TreeDecorator, TreeDecoration } from '@theia/core/lib/browser/tree/tree-decorator';
import { FileStatNode } from '@theia/filesystem/lib/browser';
import { Marker } from '../../common/marker';
import { ProblemManager } from './problem-manager';
import { ProblemPreferences } from './problem-preferences';
import { ProblemUtils } from './problem-utils';
import { OpenEditorNode } from '@theia/navigator/lib/browser/open-editors-widget/navigator-open-editors-tree-model';
import { LabelProvider } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { WidgetDecoration } from '@theia/core/lib/browser/widget-decoration';

@injectable()
export class ProblemDecorator implements TreeDecorator {

    @inject(ProblemPreferences)
    protected problemPreferences: ProblemPreferences;
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(LabelProvider) protected readonly labelProvider: LabelProvider;

    readonly id = 'theia-problem-decorator';

    protected readonly emitter: Emitter<(tree: Tree) => Map<string, TreeDecoration.Data>>;

    constructor(@inject(ProblemManager) protected readonly problemManager: ProblemManager) {
        this.emitter = new Emitter();
        this.problemManager.onDidChangeMarkers(() => this.fireDidChangeDecorations((tree: Tree) => this.collectDecorators(tree)));
    }

    @postConstruct()
    protected init(): void {
        this.problemPreferences.onPreferenceChanged(event => {
            if (event.preferenceName === 'problems.decorations.enabled') {
                this.fireDidChangeDecorations(tree => this.collectDecorators(tree));
            }
        });
        this.workspaceService.onWorkspaceChanged(() => {
            this.fireDidChangeDecorations((tree: Tree) => this.collectDecorators(tree));
        });
        this.workspaceService.onWorkspaceLocationChanged(() => {
            this.fireDidChangeDecorations((tree: Tree) => this.collectDecorators(tree));
        });
    }

    async decorations(tree: Tree): Promise<Map<string, TreeDecoration.Data>> {
        return this.collectDecorators(tree);
    }

    get onDidChangeDecorations(): Event<(tree: Tree) => Map<string, TreeDecoration.Data>> {
        return this.emitter.event;
    }

    protected fireDidChangeDecorations(event: (tree: Tree) => Map<string, TreeDecoration.Data>): void {
        this.emitter.fire(event);
    }

    protected collectDecorators(tree: Tree): Map<string, TreeDecoration.Data> {
        const decorations = new Map<string, TreeDecoration.Data>();
        // If the tree root is undefined or the preference for the decorations is disabled, return an empty result map.
        if (tree.root === undefined || !this.problemPreferences['problems.decorations.enabled']) {
            return decorations;
        }
        const markers = this.appendContainerMarkers(tree, this.collectMarkers(tree));
        for (const node of new DepthFirstTreeIterator(tree.root)) {
            const nodeUri = FileStatNode.getUri(node);
            if (nodeUri) {
                const marker = markers.get(nodeUri);
                let decorator: TreeDecoration.Data | undefined;
                if (marker) {
                    decorator = this.toDecorator(marker);
                }
                if (OpenEditorNode.is(node)) {
                    decorator = this.appendSuffixDecoration(node.uri, decorator);
                }
                if (decorator) {
                    decorations.set(node.id, decorator);
                }
            }
        }
        return decorations;
    }

    protected appendSuffixDecoration(nodeURI: URI, existingDecorations?: TreeDecoration.Data): TreeDecoration.Data {
        const workspaceAndPath = this.generateCaptionSuffix(nodeURI);
        const color = existingDecorations?.fontData?.color;
        const captionSuffix: WidgetDecoration.CaptionAffix = { data: workspaceAndPath };
        if (color) {
            Object.assign(captionSuffix, { fontData: { color } });
        }
        const suffixDecorations: TreeDecoration.Data = {
            captionSuffixes: [captionSuffix]
        };
        const decorator = existingDecorations ?? {};
        return Object.assign(decorator, suffixDecorations);
    }

    protected generateCaptionSuffix(nodeURI: URI): string {
        const workspaceRoots = this.workspaceService.tryGetRoots();
        const parentWorkspace = this.workspaceService.getWorkspaceRootUri(nodeURI);
        let workspacePrefixString = '';
        let separator = '';
        let filePathString = '';
        const nodeURIDir = nodeURI.parent;
        if (parentWorkspace) {
            const relativeDirFromWorkspace = parentWorkspace.relative(nodeURIDir);
            workspacePrefixString = workspaceRoots.length > 1 ? this.labelProvider.getName(parentWorkspace) : '';
            filePathString = relativeDirFromWorkspace?.toString() ?? '';
            separator = filePathString && workspacePrefixString ? ' \u2022 ' : ''; // add a bullet point between workspace and path
        } else {
            workspacePrefixString = nodeURIDir.path.toString();
        }
        return `${workspacePrefixString}${separator}${filePathString}`;
    }

    protected appendContainerMarkers(tree: Tree, markers: Marker<Diagnostic>[]): Map<string, Marker<Diagnostic>> {
        const result: Map<string, Marker<Diagnostic>> = new Map();
        // We traverse up and assign the diagnostic to the container directory.
        // Note, instead of stopping at the WS root, we traverse up the driver root.
        // We will filter them later based on the expansion state of the tree.
        for (const [uri, marker] of new Map(markers.map(m => [new URI(m.uri), m] as [URI, Marker<Diagnostic>])).entries()) {
            const uriString = uri.toString();
            result.set(uriString, marker);
            let parentUri: URI | undefined = uri.parent;
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
        return result;
    }

    protected collectMarkers(tree: Tree): Marker<Diagnostic>[] {
        return Array.from(this.problemManager.getUris())
            .map(uri => new URI(uri))
            .map(uri => this.problemManager.findMarkers({ uri }))
            .map(markers => markers.sort(this.compare.bind(this)))
            .map(markers => markers.shift())
            .filter(notEmpty)
            .filter(this.filterMarker.bind(this));
    }

    protected toDecorator(marker: Marker<Diagnostic>): TreeDecoration.Data {
        const position = TreeDecoration.IconOverlayPosition.BOTTOM_RIGHT;
        const icon = this.getOverlayIcon(marker);
        const color = this.getOverlayIconColor(marker);
        const priority = this.getPriority(marker);
        return {
            priority,
            fontData: {
                color,
            },
            iconOverlay: {
                position,
                icon,
                color,
                background: {
                    shape: 'circle',
                    color: 'transparent'
                }
            },
        };
    }

    protected getOverlayIcon(marker: Marker<Diagnostic>): string {
        const { severity } = marker.data;
        switch (severity) {
            case 1: return 'times-circle';
            case 2: return 'exclamation-circle';
            case 3: return 'info-circle';
            default: return 'hand-o-up';
        }
    }

    protected getOverlayIconColor(marker: Marker<Diagnostic>): TreeDecoration.Color {
        const { severity } = marker.data;
        switch (severity) {
            case 1: return 'var(--theia-editorError-foreground)';
            case 2: return 'var(--theia-editorWarning-foreground)';
            case 3: return 'var(--theia-editorInfo-foreground)';
            default: return 'var(--theia-successBackground)';
        }
    }

    /**
     * Get the decoration for a given marker diagnostic.
     * Markers with higher severity have a higher priority and should be displayed.
     * @param marker the diagnostic marker.
     */
    protected getPriority(marker: Marker<Diagnostic>): number {
        const { severity } = marker.data;
        switch (severity) {
            case 1: return 30; // Errors.
            case 2: return 20; // Warnings.
            case 3: return 10; // Infos.
            default: return 0;
        }
    }

    /**
     * Returns `true` if the diagnostic (`data`) of the marker argument has `Error`, `Warning`, or `Information` severity.
     * Otherwise, returns `false`.
     */
    protected filterMarker(marker: Marker<Diagnostic>): boolean {
        const { severity } = marker.data;
        return severity === DiagnosticSeverity.Error
            || severity === DiagnosticSeverity.Warning
            || severity === DiagnosticSeverity.Information;
    }

    protected compare(left: Marker<Diagnostic>, right: Marker<Diagnostic>): number {
        return ProblemDecorator.severityCompare(left, right);
    }

}

export namespace ProblemDecorator {

    // Highest severities (errors) come first, then the others. Undefined severities treated as the last ones.
    export const severityCompare = ProblemUtils.severityCompare;

}
