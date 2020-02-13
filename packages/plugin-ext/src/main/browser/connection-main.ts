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

import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { MAIN_RPC_CONTEXT, ConnectionMain, ConnectionExt, PLUGIN_RPC_CONTEXT } from '../../common/plugin-api-rpc';
import { RPCProtocol, ProxyIdentifier } from '../../common/rpc-protocol';
import { PluginConnection } from '../../common/connection';
import { PluginMessageReader } from '../../common/plugin-message-reader';
import { PluginMessageWriter } from '../../common/plugin-message-writer';
import { injectable, inject, postConstruct } from 'inversify';
import { RPCProtocolServiceProvider } from './main-context';

/**
 * Implementation of connection system of the plugin API.
 * Creates holds the connections to the plugins. Allows to send a message to the plugin by getting already created connection via id.
 */
@injectable()
export class ConnectionMainImpl implements ConnectionMain, Disposable, RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any> = PLUGIN_RPC_CONTEXT.CONNECTION_MAIN;

    private proxy: ConnectionExt;
    private readonly connections = new Map<string, PluginConnection>();
    private readonly toDispose = new DisposableCollection();

    @inject(RPCProtocol)
    private readonly rpc: RPCProtocol;

    @postConstruct()
    protected init(): void {
        this.proxy = this.rpc.getProxy(MAIN_RPC_CONTEXT.CONNECTION_EXT);
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    /**
     * Gets the connection between plugin by id and sends string message to it.
     *
     * @param id connection's id
     * @param message incoming message
     */
    async $sendMessage(id: string, message: string): Promise<void> {
        if (this.connections.has(id)) {
            this.connections.get(id)!.reader.readMessage(message);
        } else {
            console.warn('It is not possible to read message. Connection missed.');
        }
    }

    /**
     * Instantiates a new connection by the given id.
     * @param id the connection id
     */
    async $createConnection(id: string): Promise<void> {
        await this.doEnsureConnection(id);
    }

    /**
     * Deletes a connection.
     * @param id the connection id
     */
    async $deleteConnection(id: string): Promise<void> {
        this.connections.delete(id);
    }

    /**
     * Returns existed connection or creates a new one.
     * @param id the connection id
     */
    async ensureConnection(id: string): Promise<PluginConnection> {
        const connection = await this.doEnsureConnection(id);
        await this.proxy.$createConnection(id);
        return connection;
    }

    /**
     * Returns existed connection or creates a new one.
     * @param id the connection id
     */
    async doEnsureConnection(id: string): Promise<PluginConnection> {
        const connection = this.connections.get(id) || await this.doCreateConnection(id);
        this.connections.set(id, connection);
        return connection;
    }

    protected async doCreateConnection(id: string): Promise<PluginConnection> {
        const reader = new PluginMessageReader();
        const writer = new PluginMessageWriter(id, this.proxy);
        const connection = new PluginConnection(
            reader,
            writer,
            () => {
                this.connections.delete(id);
                if (!toClose.disposed) {
                    this.proxy.$deleteConnection(id);
                }
            });
        const toClose = new DisposableCollection(Disposable.create(() => reader.fireClose()));
        this.toDispose.push(toClose);
        return connection;
    }
}
