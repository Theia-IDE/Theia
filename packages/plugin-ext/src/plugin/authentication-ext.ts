/********************************************************************************
 * Copyright (C) 2020 Red Hat, Inc. and others.
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// code copied and modified from https://github.com/microsoft/vscode/blob/1.47.3/src/vs/workbench/api/common/extHostAuthentication.ts

import { Disposable } from './types-impl';
import {
    AuthenticationExt,
    AuthenticationMain, Plugin as InternalPlugin,
    PLUGIN_RPC_CONTEXT
} from '../common/plugin-api-rpc';
import { RPCProtocol } from '../common/rpc-protocol';
import { Emitter, Event } from '@theia/core/lib/common/event';
import * as theia from '@theia/plugin';
import { AuthenticationSession } from '../common/plugin-api-rpc-model';

export class AuthenticationExtImpl implements AuthenticationExt {
    private proxy: AuthenticationMain;
    private authenticationProviders: Map<string, theia.AuthenticationProvider> = new Map<string, theia.AuthenticationProvider>();

    private _providerIds: string[] = [];

    private _providers: theia.AuthenticationProviderInformation[] = [];

    private onDidChangeAuthenticationProvidersEmitter = new Emitter<theia.AuthenticationProvidersChangeEvent>();
    readonly onDidChangeAuthenticationProviders: Event<theia.AuthenticationProvidersChangeEvent> = this.onDidChangeAuthenticationProvidersEmitter.event;

    private onDidChangeSessionsEmitter = new Emitter<theia.AuthenticationSessionsChangeEvent>();
    readonly onDidChangeSessions: Event<theia.AuthenticationSessionsChangeEvent> = this.onDidChangeSessionsEmitter.event;

    constructor(rpc: RPCProtocol) {
        this.proxy = rpc.getProxy(PLUGIN_RPC_CONTEXT.AUTHENTICATION_MAIN);
    }

    getProviderIds(): Promise<ReadonlyArray<string>> {
        return this.proxy.$getProviderIds();
    }

    get providerIds(): string[] {
        return this._providerIds;
    }

    get providers(): ReadonlyArray<theia.AuthenticationProviderInformation> {
        return Object.freeze(this._providers.slice());
    }

    async getSession(requestingExtension: InternalPlugin, providerId: string, scopes: string[],
                     options: theia.AuthenticationGetSessionOptions & { createIfNone: true }): Promise<theia.AuthenticationSession>;
    async getSession(requestingExtension: InternalPlugin, providerId: string, scopes: string[],
                     options: theia.AuthenticationGetSessionOptions = {}): Promise<theia.AuthenticationSession | undefined> {
        const extensionName = requestingExtension.model.displayName || requestingExtension.model.name;
        const extensionId = requestingExtension.model.id.toLowerCase();

        return this.proxy.$getSession(providerId, scopes, extensionId, extensionName, options);
    }

    async logout(providerId: string, sessionId: string): Promise<void> {
        return this.proxy.$logout(providerId, sessionId);
    }

    registerAuthenticationProvider(id: string, label: string, provider: theia.AuthenticationProvider, options?: theia.AuthenticationProviderOptions): theia.Disposable {
        if (this.authenticationProviders.get(id)) {
            throw new Error(`An authentication provider with id '${id}' is already registered.`);
        }

        this.authenticationProviders.set(id, provider);
        if (this._providerIds.indexOf(id) === -1) {
            this._providerIds.push(id);
        }

        if (!this._providers.find(p => p.id === id)) {
            this._providers.push({
                id,
                label
            });
        }

        const listener = provider.onDidChangeSessions(e => {
            this.proxy.$updateSessions(id, e);
        });

        this.proxy.$registerAuthenticationProvider(id, label, options?.supportsMultipleAccounts ?? false);

        return new Disposable(() => {
            listener.dispose();
            this.authenticationProviders.delete(id);
            const index = this._providerIds.findIndex(pid => id === pid);
            if (index > -1) {
                this._providerIds.splice(index);
            }

            const i = this._providers.findIndex(p => p.id === id);
            if (i > -1) {
                this._providers.splice(i);
            }

            this.proxy.$unregisterAuthenticationProvider(id);
        });
    }

    $login(providerId: string, scopes: string[]): Promise<AuthenticationSession> {
        const authProvider = this.authenticationProviders.get(providerId);
        if (authProvider) {
            return Promise.resolve(authProvider.createSession(scopes));
        }

        throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
    }

    $logout(providerId: string, sessionId: string): Promise<void> {
        const authProvider = this.authenticationProviders.get(providerId);
        if (authProvider) {
            return Promise.resolve(authProvider.removeSession(sessionId));
        }

        throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
    }

    async $getSessions(providerId: string): Promise<ReadonlyArray<AuthenticationSession>> {
        const authProvider = this.authenticationProviders.get(providerId);
        if (authProvider) {
            const sessions = await authProvider.getSessions();

            /* Wrap the session object received from the plugin to prevent serialization mismatches
            e.g. if the plugin object is constructed with the help of getters they won't be serialized:
            class SessionImpl implements AuthenticationSession {
                private _id;
                get id() {
                    return _id;
                }
            ...
            } will translate to JSON as { _id: '<sessionid>' } not { id: '<sessionid>' } */
            return sessions.map(session => ({
                id: session.id,
                accessToken: session.accessToken,
                account: { id: session.account.id, label: session.account.label },
                scopes: session.scopes
            }));
        }

        throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
    }

    $onDidChangeAuthenticationSessions(id: string, label: string, event: theia.AuthenticationProviderAuthenticationSessionsChangeEvent): Promise<void> {
        this.onDidChangeSessionsEmitter.fire({ provider: { id, label }, ...event });
        return Promise.resolve();
    }

   async $onDidChangeAuthenticationProviders(added: theia.AuthenticationProviderInformation[], removed: theia.AuthenticationProviderInformation[]): Promise<void> {
        added.forEach(id => {
            if (this._providers.indexOf(id) === -1) {
                this._providers.push(id);
            }
        });

        removed.forEach(p => {
            const index = this._providers.findIndex(provider => provider.id === p.id);
            if (index > -1) {
                this._providers.splice(index);
            }
        });

        this.onDidChangeAuthenticationProvidersEmitter.fire({ added, removed });
    }
}
