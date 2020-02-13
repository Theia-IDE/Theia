/********************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
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
import { inject, named, injectable } from 'inversify';
import { RPCProtocol, ProxyIdentifier } from '../../common/rpc-protocol';
import { ContributionProvider } from '@theia/core/lib/common/contribution-provider';
import { EditorsAndDocumentsMain } from './editors-and-documents-main';

export const RPCProtocolPluginAPIFactory = Symbol('RPCProtocolPluginAPIFactory');
export interface RPCProtocolPluginAPIFactory {
    (proxy: RPCProtocol): RPCProtocolPluginAPI;
}

export interface RPCProtocolPluginAPI {
    initialize(): void;
}

export const RPCProtocolServiceProvider = Symbol('RPCProtocolServiceProvider');
export interface RPCProtocolServiceProvider {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any>;
}

@injectable()
export class RPCProtocolPluginAPIImpl implements RPCProtocolPluginAPI {

    @inject(ContributionProvider)
    @named(RPCProtocolServiceProvider)
    protected readonly serviceContribution: ContributionProvider<RPCProtocolServiceProvider>;

    @inject(RPCProtocol)
    protected readonly rpc: RPCProtocol;

    @inject(EditorsAndDocumentsMain)
    protected readonly editorsAndDocuments: EditorsAndDocumentsMain;

    initialize(): void {
        const contributions = this.serviceContribution.getContributions();
        for (const contr of contributions) {
            this.rpc.set(contr.identifier, contr);
        }
        // start listening only after all clients are subscribed to events
        this.editorsAndDocuments.listen();
    }

}
