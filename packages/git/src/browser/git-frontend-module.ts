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

import '../../src/browser/style/index.css';

import { ContainerModule } from 'inversify';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser';
import { Git, GitPath, GitWatcher, GitWatcherPath, GitWatcherServer, GitWatcherServerProxy, ReconnectingGitWatcherServer } from '../common';
import { bindGitHistoryModule } from './history/git-history-frontend-module';
import { bindGitDiffModule } from './diff/git-diff-frontend-module';
import { GitAmendContribution } from './git-amend-support';
import { GitHistoryContribution } from './history/git-history-support';
import { ScmExtraSupportContribution } from '@theia/scm/lib/browser/scm-service';
import { GitQuickOpenService } from './git-quick-open-service';
import { GitErrorHandler } from './git-error-handler';

export default new ContainerModule(bind => {
    bindGitDiffModule(bind);
    bindGitHistoryModule(bind);
    bind(GitWatcherServerProxy).toDynamicValue(context => WebSocketConnectionProvider.createProxy(context.container, GitWatcherPath)).inSingletonScope();
    bind(GitWatcherServer).to(ReconnectingGitWatcherServer).inSingletonScope();
    bind(GitWatcher).toSelf().inSingletonScope();
    bind(Git).toDynamicValue(context => WebSocketConnectionProvider.createProxy(context.container, GitPath)).inSingletonScope();
    bind(GitQuickOpenService).toSelf().inSingletonScope();
    bind(GitErrorHandler).toSelf().inSingletonScope();

    bind(ScmExtraSupportContribution).to(GitAmendContribution).inSingletonScope();
    bind(ScmExtraSupportContribution).to(GitHistoryContribution).inSingletonScope();
});
