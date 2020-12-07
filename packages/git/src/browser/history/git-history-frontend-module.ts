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

import { interfaces, Container } from 'inversify';
import { WidgetFactory, OpenHandler, TreeModel } from '@theia/core/lib/browser';
import { GitCommitDetailWidgetOptions } from './git-commit-detail-widget-options';
import { GitCommitDetailWidget } from './git-commit-detail-widget';
import { GitCommitDetailHeaderWidget } from './git-commit-detail-header-widget';
import { GitDiffTreeModel } from '../diff/git-diff-tree-model';
import { GitCommitDetailOpenHandler } from './git-commit-detail-open-handler';
import { GitCommitDetailUri } from './git-commit-detail-open-handler';
import { createScmTreeContainer } from '@theia/scm/lib/browser/scm-frontend-module';
import { GitResourceOpener } from '../diff/git-resource-opener';
import { GitOpenerInSecondaryArea } from './git-opener-in-secondary-area';
import '../../../src/browser/style/git-icons.css';

export function bindGitHistoryModule(bind: interfaces.Bind): void {

    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: GitCommitDetailUri.GIT_COMMIT_DETAIL,
        createWidget: (options: GitCommitDetailWidgetOptions) => {
            const child = createGitCommitDetailWidgetContainer(ctx.container, options);
            return child.get(GitCommitDetailWidget);
        }
    }));

    bind(GitCommitDetailOpenHandler).toSelf();
    bind(OpenHandler).toService(GitCommitDetailOpenHandler);

}

export function createGitCommitDetailWidgetContainer(parent: interfaces.Container, options: GitCommitDetailWidgetOptions): Container {
    const child = createScmTreeContainer(parent);
    child.bind(GitCommitDetailWidget).toSelf();
    child.bind(GitCommitDetailHeaderWidget).toSelf();
    child.bind(GitDiffTreeModel).toSelf();
    child.bind(TreeModel).toService(GitDiffTreeModel);
    child.bind(GitOpenerInSecondaryArea).toSelf();
    child.bind(GitResourceOpener).toService(GitOpenerInSecondaryArea);
    child.bind(GitCommitDetailWidgetOptions).toConstantValue(options);

    const opener = child.get(GitOpenerInSecondaryArea);
    const widget = child.get(GitCommitDetailWidget);
    opener.setRefWidget(widget);

    return child;
}
