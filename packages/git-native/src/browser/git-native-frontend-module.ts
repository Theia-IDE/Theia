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

import { ContainerModule, interfaces } from 'inversify';
import { CommandContribution, MenuContribution, ResourceResolver } from '@theia/core/lib/common';
import {
    WebSocketConnectionProvider,
    LabelProviderContribution,
    FrontendApplicationContribution,
} from '@theia/core/lib/browser';
import { TabBarToolbarContribution } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { NavigatorTreeDecorator } from '@theia/navigator/lib/browser';
import { GitNative, GitNativePath } from '../common/git-native';
import { GitContribution } from './git-contribution';
import { GitResourceResolver } from './git-resource-resolver';
import { GitRepositoryProvider } from './git-repository-provider';
import { GitUriLabelProviderContribution } from './git-uri-label-contribution';
import { GitDecorator } from './git-decorator';
import { bindGitPreferences } from './git-preferences';
import { bindDirtyDiff } from './dirty-diff/dirty-diff-module';
import { bindBlame } from './blame/blame-module';
import { GitRepositoryTracker } from './git-repository-tracker';
import { GitCommitMessageValidator } from './git-commit-message-validator';
import { GitSyncService } from './git-sync-service';
import { GitScmProvider, GitScmProviderOptions } from './git-scm-provider';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';

export default new ContainerModule(bind => {
    bindGitPreferences(bind);
    bindDirtyDiff(bind);
    bindBlame(bind);
    bind(GitRepositoryTracker).toSelf().inSingletonScope();
    bind(GitNative).toDynamicValue(context => WebSocketConnectionProvider.createProxy(context.container, GitNativePath)).inSingletonScope();

    bind(GitContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(GitContribution);
    bind(MenuContribution).toService(GitContribution);
    bind(FrontendApplicationContribution).toService(GitContribution);
    bind(TabBarToolbarContribution).toService(GitContribution);
    bind(ColorContribution).toService(GitContribution);

    bind(GitResourceResolver).toSelf().inSingletonScope();
    bind(ResourceResolver).toService(GitResourceResolver);

    bind(GitScmProvider.Factory).toFactory(createGitScmProviderFactory);
    bind(GitRepositoryProvider).toSelf().inSingletonScope();

    bind(LabelProviderContribution).to(GitUriLabelProviderContribution).inSingletonScope();
    bind(NavigatorTreeDecorator).to(GitDecorator).inSingletonScope();

    bind(GitCommitMessageValidator).toSelf().inSingletonScope();

    bind(GitSyncService).toSelf().inSingletonScope();
});

export function createGitScmProviderFactory(ctx: interfaces.Context): GitScmProvider.Factory {
    return (options: GitScmProviderOptions) => {
        const container = ctx.container.createChild();
        container.bind(GitScmProviderOptions).toConstantValue(options);
        container.bind(GitScmProvider).toSelf().inSingletonScope();
        const provider = container.get(GitScmProvider);
        return provider;
    };
}
