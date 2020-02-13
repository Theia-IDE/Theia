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
import {
    DecorationData,
    DecorationProvider,
    DecorationsExt,
    DecorationsMain,
    MAIN_RPC_CONTEXT,
    PLUGIN_RPC_CONTEXT
} from '../../../common/plugin-api-rpc';

import { injectable, inject, postConstruct } from 'inversify';
import { Emitter } from '@theia/core/lib/common/event';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { Tree, TreeDecoration } from '@theia/core/lib/browser';
import { RPCProtocol, ProxyIdentifier } from '../../../common/rpc-protocol';
import { ScmDecorationsService } from '@theia/scm/lib/browser/decorations/scm-decorations-service';
import { RPCProtocolServiceProvider } from '../main-context';

@injectable()
export class DecorationsMainImpl implements DecorationsMain, Disposable, RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any> = PLUGIN_RPC_CONTEXT.DECORATIONS_MAIN;

    private proxy: DecorationsExt;
    // TODO: why it is SCM specific? VS Code apis about any decorations for the explorer
    @inject(ScmDecorationsService)
    private readonly scmDecorationsService: ScmDecorationsService;

    protected readonly emitter = new Emitter<(tree: Tree) => Map<string, TreeDecoration.Data>>();

    protected readonly toDispose = new DisposableCollection();

    @inject(RPCProtocol)
    private readonly rpc: RPCProtocol;

    @postConstruct()
    protected init(): void {
        this.proxy = this.rpc.getProxy(MAIN_RPC_CONTEXT.DECORATIONS_EXT);
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    // TODO: why it is never used?
    protected readonly providers = new Map<number, DecorationProvider>();

    async $dispose(id: number): Promise<void> {
        // TODO: What about removing decorations when a provider is gone?
        this.providers.delete(id);
    }

    async $registerDecorationProvider(id: number, provider: DecorationProvider): Promise<number> {
        this.providers.set(id, provider);
        this.toDispose.push(Disposable.create(() => this.$dispose(id)));
        return id;
    }

    async $fireDidChangeDecorations(id: number, arg: string | string[] | undefined): Promise<void> {
        if (Array.isArray(arg)) {
            const result: Map<string, DecorationData> = new Map();
            for (const uri of arg) {
                const data = await this.proxy.$provideDecoration(id, uri);
                if (data) {
                    result.set(uri, data);
                }
            }
            this.scmDecorationsService.fireNavigatorDecorationsChanged(result);
        } else if (arg) {
            // TODO: why to make a remote call instead of sending decoration to `$fireDidChangeDecorations` in first place?
            this.proxy.$provideDecoration(id, arg);
        }
    }
}
