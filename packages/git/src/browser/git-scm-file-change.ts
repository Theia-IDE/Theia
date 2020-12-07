/********************************************************************************
 * Copyright (C) 2019 TypeFox and others.
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

import URI from '@theia/core/lib/common/uri';
import { DiffUris } from '@theia/core/lib/browser/diff-uris';
import { Git, GitFileChange, GitFileStatus } from '../common';
import { GIT_RESOURCE_SCHEME } from './git-resource';
import { ScmHistoryCommit, ScmFileChange } from '@theia/scm-extra/lib/browser/scm-file-change-node';
import { LabelProvider } from '@theia/core/lib/browser';
import { CommitWithChanges } from '../common';
import { ScmCommit } from '@theia/scm/lib/browser/scm-provider';

export interface GitScmCommit extends ScmHistoryCommit {
    gitFileChanges: GitScmFileChange[];
}

export interface GitScmFileChangeContext {
    readonly rootUri: string,
    readonly labelProvider: LabelProvider,
}

export class GitScmFileChange implements ScmFileChange {

    constructor(
        protected readonly fileChange: GitFileChange,
        protected readonly context: GitScmFileChangeContext,
        protected readonly range?: Git.Options.Range
    ) { }

    get gitFileChange(): GitFileChange {
        return this.fileChange;
    }

    get uri(): string {
        return this.fileChange.uri;
    }

    protected relativePath(uri: string): string {
        const parsedUri = new URI(uri);
        const repositoryUri = new URI(this.context.rootUri);
        const relativePath = repositoryUri.relative(parsedUri);
        if (relativePath) {
            return relativePath.toString();
        }
        return this.context.labelProvider.getLongName(parsedUri);
    }

    getCaption(): string {
        let result = `${this.relativePath(this.fileChange.uri)} - ${GitFileStatus.toString(this.fileChange.status, true)}`;
        if (this.fileChange.oldUri) {
            result = `${this.relativePath(this.fileChange.oldUri)} -> ${result}`;
        }
        return result;
    }

    getStatusCaption(): string {
        return GitFileStatus.toString(this.fileChange.status, true);
    }

    getStatusAbbreviation(): string {
        return GitFileStatus.toAbbreviation(this.fileChange.status, this.fileChange.staged);
    }

    getClassNameForStatus(): string {
        return 'git-status staged ' + GitFileStatus[this.fileChange.status].toLowerCase();
    }

    getUriToOpen(): URI {
        const uri: URI = new URI(this.fileChange.uri);
        const fromFileURI = this.fileChange.oldUri ? new URI(this.fileChange.oldUri) : uri; // set oldUri on renamed and copied
        if (!this.range) {
            return uri;
        }
        const fromRevision = this.range.fromRevision || 'HEAD';
        const toRevision = this.range.toRevision || 'HEAD';
        const fromURI = fromFileURI.withScheme(GIT_RESOURCE_SCHEME).withQuery(fromRevision.toString());
        const toURI = uri.withScheme(GIT_RESOURCE_SCHEME).withQuery(toRevision.toString());
        let uriToOpen = uri;
        if (this.fileChange.status === GitFileStatus.Deleted) {
            uriToOpen = fromURI;
        } else if (this.fileChange.status === GitFileStatus.New) {
            uriToOpen = toURI;
        } else {
            uriToOpen = DiffUris.encode(fromURI, toURI);
        }
        return uriToOpen;
    }
}

export namespace GitScmCommit {
    export function createScmCommit(gitCommit: CommitWithChanges): ScmCommit {
        const scmCommit: ScmCommit = {
            id: gitCommit.sha,
            summary: gitCommit.summary,
            authorName: gitCommit.author.name,
            authorEmail: gitCommit.author.email,
            authorDateRelative: gitCommit.authorDateRelative,
        };
        return scmCommit;
    }

}
