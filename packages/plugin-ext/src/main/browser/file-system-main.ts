/********************************************************************************
 * Copyright (C) 2019 Red Hat, Inc. and others.
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

import { injectable, inject, postConstruct } from 'inversify';

import { Disposable, DisposableCollection } from '@theia/core';

import { MAIN_RPC_CONTEXT, FileSystemMain, FileSystemExt, PLUGIN_RPC_CONTEXT } from '../../common/plugin-api-rpc';
import { RPCProtocol, ProxyIdentifier } from '../../common/rpc-protocol';
import { FSResourceResolver } from './fs-resource-resolver';
import { RPCProtocolServiceProvider } from './main-context';

@injectable()
export class FileSystemMainImpl implements FileSystemMain, Disposable {

    private proxy: FileSystemExt;

    @inject(FSResourceResolver)
    private readonly resourceResolver: FSResourceResolver;
    private readonly providers = new Map<number, Disposable>();
    private readonly toDispose = new DisposableCollection();

    @inject(RPCProtocol)
    private readonly rpc: RPCProtocol;

    @postConstruct()
    protected init(): void {
        this.proxy = this.rpc.getProxy(MAIN_RPC_CONTEXT.FILE_SYSTEM_EXT);
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    async $registerFileSystemProvider(handle: number, scheme: string): Promise<void> {
        const toDispose = new DisposableCollection(
            this.resourceResolver.registerResourceProvider(handle, scheme, this.proxy),
            Disposable.create(() => this.providers.delete(handle))
        );
        this.providers.set(handle, toDispose);
        this.toDispose.push(toDispose);
    }

    $unregisterProvider(handle: number): void {
        const disposable = this.providers.get(handle);
        if (disposable) {
            disposable.dispose();
        }
    }

}

@injectable()
export class FileSystemMainServiceProvider implements RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    class: any;

    @inject(FileSystemMainImpl)
    private readonly fileSystemMain: FileSystemMain;

    @postConstruct()
    protected init(): void {
        this.identifier = PLUGIN_RPC_CONTEXT.FILE_SYSTEM_MAIN;
        this.class = this.fileSystemMain;
    }
}
