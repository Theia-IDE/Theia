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
import { injectable } from 'inversify';
import { Emitter } from '@theia/core/lib/common/event';
import { RPCProtocol, RPCProtocolImpl } from '../../common/rpc-protocol';

@injectable()
export class PluginWorker {

    static readonly PLUGIN_HOST_ID = 'frontend';

    private worker: Worker;
    public readonly rpc: RPCProtocol;
    constructor() {
        const emitter = new Emitter<string>();
        this.worker = new (require('../../hosted/browser/worker/worker-main'));
        this.worker.onmessage = message => {
            emitter.fire(message.data);
        };
        this.worker.onerror = e => console.error(e);

        this.rpc = new RPCProtocolImpl({
            onMessage: emitter.event,
            send: (m: string) => {
                this.worker.postMessage(m);
            }
        });

    }
}
