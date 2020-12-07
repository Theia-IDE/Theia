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

import { ContainerModule, interfaces } from 'inversify';

import { GitNative, GitNativePath } from '../common/git-native';
import { DugiteGitNative } from './dugite-git-native';
import { ConnectionContainerModule } from '@theia/core/lib/node/messaging/connection-container-module';
import { ILogger } from '@theia/core/lib/common';
import { GitLocator } from './git-locator/git-locator-protocol';
import { GitLocatorClient } from './git-locator/git-locator-client';
import { GitLocatorImpl } from './git-locator/git-locator-impl';

const SINGLE_THREADED = process.argv.indexOf('--no-cluster') !== -1;

export function bindGitLocator(bind: interfaces.Bind): void {
    if (SINGLE_THREADED) {
        bind(GitLocator).toDynamicValue(ctx => {
            const logger = ctx.container.get<ILogger>(ILogger);
            return new GitLocatorImpl({
                info: (message, ...args) => logger.info(message, ...args),
                error: (message, ...args) => logger.error(message, ...args)
            });
        });
    } else {
        bind(GitLocator).to(GitLocatorClient);
    }
}

export default new ContainerModule(bind => {
    bind(DugiteGitNative).toSelf().inSingletonScope();
    bind(GitNative).toService(DugiteGitNative);

    bind(ConnectionContainerModule).toConstantValue(gitConnectionModule);

    bindGitLocator(bind);
});

const gitConnectionModule = ConnectionContainerModule.create(({ bind, bindBackendService }) => {
    // DugiteGit is bound in singleton scope; each connection should use a proxy for that.
    const GitProxy = Symbol('GitProxy');
    bind(GitProxy).toDynamicValue(ctx => new Proxy(ctx.container.get(DugiteGitNative), {}));
    bindBackendService(GitNativePath, GitProxy);
});
