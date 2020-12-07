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

import * as paths from 'path';
import { inject, injectable } from 'inversify';
import { JsonRpcProxyFactory, DisposableCollection } from '@theia/core';
import { IPCConnectionProvider } from '@theia/core/lib/node';
import { GitLocator, GitLocateOptions } from './git-locator-protocol';

@injectable()
export class GitLocatorClient implements GitLocator {

    protected readonly toDispose = new DisposableCollection();

    @inject(IPCConnectionProvider)
    protected readonly ipcConnectionProvider: IPCConnectionProvider;

    dispose(): void {
        this.toDispose.dispose();
    }

    locate(path: string, options: GitLocateOptions): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const toStop = this.ipcConnectionProvider.listen({
                serverName: 'git-locator',
                entryPoint: paths.resolve(__dirname, 'git-locator-host')
            }, async connection => {
                const proxyFactory = new JsonRpcProxyFactory<GitLocator>();
                const remote = proxyFactory.createProxy();
                proxyFactory.listen(connection);
                try {
                    resolve(await remote.locate(path, options));
                } catch (e) {
                    reject(e);
                } finally {
                    toStop.dispose();
                }
            });
            this.toDispose.push(toStop);
        });
    }

}
