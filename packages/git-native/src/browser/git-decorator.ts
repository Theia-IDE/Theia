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

import { inject, injectable, postConstruct } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { ILogger } from '@theia/core/lib/common/logger';
import { Event, Emitter } from '@theia/core/lib/common/event';
import { Tree } from '@theia/core/lib/browser/tree/tree';
import { DepthFirstTreeIterator } from '@theia/core/lib/browser/tree/tree-iterator';
import { PreferenceChangeEvent } from '@theia/core/lib/browser/preferences/preference-proxy';
import { TreeDecorator, TreeDecoration } from '@theia/core/lib/browser/tree/tree-decorator';
import { Git } from '@theia/git/lib/common/git';
import { WorkingDirectoryStatus, GitFileChange, GitFileStatus } from '@theia/git/lib/common/git-model';
import { GitPreferences, GitConfiguration } from './git-preferences';
import { GitRepositoryTracker } from './git-repository-tracker';
import { FileStatNode } from '@theia/filesystem/lib/browser';

@injectable()
export class GitDecorator implements TreeDecorator {

    readonly id = 'theia-git-decorator';

    @inject(Git) protected readonly git: Git;
    @inject(GitRepositoryTracker) protected readonly repositories: GitRepositoryTracker;
    @inject(GitPreferences) protected readonly preferences: GitPreferences;
    @inject(ILogger) protected readonly logger: ILogger;

    protected readonly emitter = new Emitter<(tree: Tree) => Map<string, TreeDecoration.Data>>();

    protected enabled: boolean;
    protected showColors: boolean;

    @postConstruct()
    protected init(): void {
        this.repositories.onGitEvent(event => this.fireDidChangeDecorations((tree: Tree) => this.collectDecorators(tree, event && event.status)));
        this.preferences.onPreferenceChanged(event => this.handlePreferenceChange(event));
        this.enabled = this.preferences['git.decorations.enabled'];
        this.showColors = this.preferences['git.decorations.colors'];
    }

    async decorations(tree: Tree): Promise<Map<string, TreeDecoration.Data>> {
        const status = this.repositories.selectedRepositoryStatus;
        if (status) {
            return this.collectDecorators(tree, status);
        }
        return new Map();
    }

    get onDidChangeDecorations(): Event<(tree: Tree) => Map<string, TreeDecoration.Data>> {
        return this.emitter.event;
    }

    protected fireDidChangeDecorations(event: (tree: Tree) => Map<string, TreeDecoration.Data>): void {
        this.emitter.fire(event);
    }

    protected collectDecorators(tree: Tree, status: WorkingDirectoryStatus | undefined): Map<string, TreeDecoration.Data> {
        const result = new Map();
        if (tree.root === undefined || !this.enabled) {
            return result;
        }
        const markers = this.appendContainerChanges(tree, status ? status.changes : []);
        for (const treeNode of new DepthFirstTreeIterator(tree.root)) {
            const uri = FileStatNode.getUri(treeNode);
            if (uri) {
                const marker = markers.get(uri);
                if (marker) {
                    result.set(treeNode.id, marker);
                }
            }
        }
        return new Map(Array.from(result.entries()).map(m => [m[0], this.toDecorator(m[1])] as [string, TreeDecoration.Data]));
    }

    protected appendContainerChanges(tree: Tree, changes: GitFileChange[]): Map<string, GitFileChange> {
        const result: Map<string, GitFileChange> = new Map();
        // We traverse up and assign the highest Git file change status the container directory.
        // Note, instead of stopping at the WS root, we traverse up the driver root.
        // We will filter them later based on the expansion state of the tree.
        for (const [uri, change] of new Map(changes.map(m => [new URI(m.uri), m] as [URI, GitFileChange])).entries()) {
            const uriString = uri.toString();
            result.set(uriString, change);
            let parentUri: URI | undefined = uri.parent;
            while (parentUri && !parentUri.path.isRoot) {
                const parentUriString = parentUri.toString();
                const existing = result.get(parentUriString);
                if (existing === undefined || this.compare(existing, change) < 0) {
                    result.set(parentUriString, {
                        uri: parentUriString,
                        status: change.status,
                        staged: !!change.staged
                    });
                    parentUri = parentUri.parent;
                } else {
                    parentUri = undefined;
                }
            }
        }
        return result;
    }

    protected toDecorator(change: GitFileChange): TreeDecoration.Data {
        const data = GitFileStatus.toAbbreviation(change.status, change.staged);
        const color = GitFileStatus.getColor(change.status, change.staged);
        const tooltip = GitFileStatus.toString(change.status, change.staged);
        let decorationData: TreeDecoration.Data = {
            tailDecorations: [
                {
                    data,
                    fontData: {
                        color
                    },
                    tooltip
                }
            ]
        };
        if (this.showColors) {
            decorationData = {
                ...decorationData,
                fontData: {
                    color
                }
            };
        }
        return decorationData;
    }

    protected compare(left: GitFileChange, right: GitFileChange): number {
        return GitFileStatus.statusCompare(left.status, right.status);
    }

    protected async handlePreferenceChange(event: PreferenceChangeEvent<GitConfiguration>): Promise<void> {
        let refresh = false;
        const { preferenceName, newValue } = event;
        if (preferenceName === 'git.decorations.enabled') {
            const enabled = !!newValue;
            if (this.enabled !== enabled) {
                this.enabled = enabled;
                refresh = true;
            }
        }
        if (preferenceName === 'git.decorations.colors') {
            const showColors = !!newValue;
            if (this.showColors !== showColors) {
                this.showColors = showColors;
                refresh = true;
            }
        }
        const status = this.repositories.selectedRepositoryStatus;
        if (refresh && status) {
            this.fireDidChangeDecorations((tree: Tree) => this.collectDecorators(tree, status));
        }
    }

}
