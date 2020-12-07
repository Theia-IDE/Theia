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

import { injectable } from 'inversify';
import { WidgetOpenHandler, WidgetOpenerOptions } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { GitCommitDetailWidgetOptions } from './git-commit-detail-widget-options';
import { GitCommitDetailWidget } from './git-commit-detail-widget';

export namespace GitCommitDetailUri {
    export const GIT_COMMIT_DETAIL = 'git-commit-detail-widget';
    export const scheme = GIT_COMMIT_DETAIL;
    export function toCommitSha(uri: URI): string {
        if (uri.scheme === scheme) {
            return uri.fragment;
        }
        throw new Error('The given uri is not an commit detail URI, uri: ' + uri);
    }
}

export type GitCommitDetailOpenerOptions = WidgetOpenerOptions & GitCommitDetailWidgetOptions;

@injectable()
export class GitCommitDetailOpenHandler extends WidgetOpenHandler<GitCommitDetailWidget> {
    readonly id = GitCommitDetailUri.GIT_COMMIT_DETAIL;

    canHandle(uri: URI): number {
        try {
            GitCommitDetailUri.toCommitSha(uri);
            return 200;
        } catch {
            return 0;
        }
    }

    protected async doOpen(widget: GitCommitDetailWidget, options: GitCommitDetailOpenerOptions): Promise<void> {
        await super.doOpen(widget, options);
    }

    protected createWidgetOptions(uri: URI, commit: GitCommitDetailOpenerOptions): GitCommitDetailWidgetOptions {
        return commit;
    }

}
