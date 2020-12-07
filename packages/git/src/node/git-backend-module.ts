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

import { ContainerModule, Container, interfaces } from 'inversify';
import { OutputParser, NameStatusParser, CommitDetailsParser, GitBlameParser } from './dugite-git';
import { Git, GitPath } from '../common/git';
import { DugiteGitWatcherServer } from './dugite-git-watcher';
import { GitRepositoryManager } from './git-repository-manager';
import { GitRepositoryWatcherFactory, GitRepositoryWatcherOptions, GitRepositoryWatcher } from './git-repository-watcher';
import { GitWatcherPath, GitWatcherClient, GitWatcherServer } from '../common/git-watcher';
import { DugiteGit } from './dugite-git';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common';
import { GitExecProvider } from './git-exec-provider';
import { GitPromptServer, GitPromptClient, GitPrompt } from '../common/git-prompt';
import { DugiteGitPromptServer } from './dugite-git-prompt';
import { ConnectionContainerModule } from '@theia/core/lib/node/messaging/connection-container-module';
import { DefaultGitInit, GitInit } from './init/git-init';

export interface GitBindingOptions {
    readonly bindManager: (binding: interfaces.BindingToSyntax<{}>) => interfaces.BindingWhenOnSyntax<{}>;
}

export namespace GitBindingOptions {
    export const Default: GitBindingOptions = {
        bindManager(binding: interfaces.BindingToSyntax<{}>): interfaces.BindingWhenOnSyntax<{}> {
            return binding.to(GitRepositoryManager).inSingletonScope();
        }
    };
}

export function bindGit(bind: interfaces.Bind, bindingOptions: GitBindingOptions = GitBindingOptions.Default): void {
    bind(GitExecProvider).toSelf().inSingletonScope();
    bind(DugiteGit).toSelf().inSingletonScope();
    bind(Git).toService(DugiteGit);
    bind(DefaultGitInit).toSelf();
    bind(GitInit).toService(DefaultGitInit);
    bind(ConnectionContainerModule).toConstantValue(gitConnectionModule);
    bind(OutputParser).toSelf().inSingletonScope();
    bind(NameStatusParser).toSelf().inSingletonScope();
    bind(CommitDetailsParser).toSelf().inSingletonScope();
    bind(GitBlameParser).toSelf().inSingletonScope();

    bindingOptions.bindManager(bind(GitRepositoryManager));
    bind(GitRepositoryWatcherFactory).toFactory(ctx => (options: GitRepositoryWatcherOptions) => {
        // GitRepositoryWatcherFactory is injected into the singleton GitRepositoryManager only.
        // GitRepositoryWatcher instances created there should be able to access the (singleton) Git.
        const child = new Container({ defaultScope: 'Singleton' });
        child.parent = ctx.container;
        child.bind(GitRepositoryWatcher).toSelf();
        child.bind(GitRepositoryWatcherOptions).toConstantValue(options);
        return child.get(GitRepositoryWatcher);
    });

}

const gitConnectionModule = ConnectionContainerModule.create(({ bind, bindBackendService }) => {
    // DugiteGit is bound in singleton scope; each connection should use a proxy for that.
    const GitProxy = Symbol('GitProxy');
    bind(GitProxy).toDynamicValue(ctx => new Proxy(ctx.container.get(DugiteGit), {}));
    bindBackendService(GitPath, GitProxy);
});

export function bindPrompt(bind: interfaces.Bind): void {
    bind(DugiteGitPromptServer).toSelf().inSingletonScope();
    bind(GitPromptServer).toDynamicValue(context => context.container.get(DugiteGitPromptServer));
}

export function bindRepositoryWatcher(bind: interfaces.Bind): void {
    bind(DugiteGitWatcherServer).toSelf();
    bind(GitWatcherServer).toService(DugiteGitWatcherServer);
}

export default new ContainerModule(bind => {
    bindGit(bind);

    bind(ConnectionHandler).toDynamicValue(context =>
        new JsonRpcConnectionHandler<GitWatcherClient>(GitWatcherPath, client => {
            const server = context.container.get<GitWatcherServer>(GitWatcherServer);
            server.setClient(client);
            client.onDidCloseConnection(() => server.dispose());
            return server;
        })
    ).inSingletonScope();

    bindPrompt(bind);
    bind(ConnectionHandler).toDynamicValue(context =>
        new JsonRpcConnectionHandler<GitPromptClient>(GitPrompt.WS_PATH, client => {
            const server = context.container.get<GitPromptServer>(GitPromptServer);
            server.setClient(client);
            client.onDidCloseConnection(() => server.dispose());
            return server;
        })
    ).inSingletonScope();

    bindRepositoryWatcher(bind);
});
