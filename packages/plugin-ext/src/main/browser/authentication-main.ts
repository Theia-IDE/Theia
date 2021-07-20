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
// code copied and modified from https://github.com/microsoft/vscode/blob/1.47.3/src/vs/workbench/api/browser/mainThreadAuthentication.ts

import { interfaces } from '@theia/core/shared/inversify';
import {AuthenticationExt, AuthenticationMain, PluginManagerExt, MAIN_RPC_CONTEXT} from '../../common/plugin-api-rpc';
import { RPCProtocol } from '../../common/rpc-protocol';
import { MessageService } from '@theia/core/lib/common/message-service';
import { StorageService } from '@theia/core/lib/browser';
import {
    AuthenticationProvider,
    AuthenticationService,
    readAllowedExtensions
} from '@theia/core/lib/browser/authentication-service';
import { QuickPickService } from '@theia/core/lib/common/quick-pick-service';
import {
    AuthenticationSession
} from '../../common/plugin-api-rpc-model';
import {AuthenticationProviderAuthenticationSessionsChangeEvent, Event} from '@theia/plugin';
import { QuickPickValue } from '@theia/core/lib/browser/quick-input/quick-input-service';

export function getAuthenticationProviderActivationEvent(id: string): string { return `onAuthenticationRequest:${id}`; }

export class AuthenticationMainImpl implements AuthenticationMain {
    private readonly proxy: AuthenticationExt;
    private readonly messageService: MessageService;
    private readonly storageService: StorageService;
    private readonly authenticationService: AuthenticationService;
    private readonly quickPickService: QuickPickService;
    private readonly extensionService: PluginManagerExt;
    constructor(rpc: RPCProtocol, container: interfaces.Container) {
        this.proxy = rpc.getProxy(MAIN_RPC_CONTEXT.AUTHENTICATION_EXT);
        this.messageService = container.get(MessageService);
        this.storageService = container.get(StorageService);
        this.authenticationService = container.get(AuthenticationService);
        this.quickPickService = container.get(QuickPickService);
        this.extensionService = rpc.getProxy(MAIN_RPC_CONTEXT.HOSTED_PLUGIN_MANAGER_EXT);

        this.authenticationService.onDidChangeSessions(e => {
            this.proxy.$onDidChangeAuthenticationSessions(e.providerId, e.label);
        });
        this.authenticationService.onDidRegisterAuthenticationProvider(info => {
            this.proxy.$onDidChangeAuthenticationProviders([info], []);
        });
        this.authenticationService.onDidUnregisterAuthenticationProvider(providerId => {
            this.proxy.$onDidChangeAuthenticationProviders([], [providerId]);
        });
    }
    $getProviderIds(): Promise<string[]> {
        return Promise.resolve(this.authenticationService.getProviderIds());
    }

    async $registerAuthenticationProvider(id: string, label: string, supportsMultipleAccounts: boolean): Promise<void> {
        const provider = new AuthenticationProviderImpl(this.proxy, id, label, supportsMultipleAccounts, this.storageService, this.messageService);
        this.authenticationService.registerAuthenticationProvider(id, provider);
    }

    async $unregisterAuthenticationProvider(id: string): Promise<void> {
        this.authenticationService.unregisterAuthenticationProvider(id);
    }

    async $updateSessions(id: string, event: AuthenticationProviderAuthenticationSessionsChangeEvent): Promise<void> {
        this.authenticationService.updateSessions(id, event);
    }

    $logout(providerId: string, sessionId: string): Promise<void> {
        return this.authenticationService.logout(providerId, sessionId);
    }

    protected async requestNewSession(providerId: string, scopes: string[], extensionId: string, extensionName: string): Promise<void> {
        return this.authenticationService.requestNewSession(providerId, scopes, extensionId, extensionName);
    }

    async $getSession(providerId: string, scopes: string[], extensionId: string, extensionName: string,
        options: { createIfNone: boolean, clearSessionPreference: boolean }): Promise<AuthenticationSession | undefined> {
        const orderedScopes = scopes.sort().join(' ');
        const sessions = (await this.authenticationService.getSessions(providerId)).filter(session => session.scopes.slice().sort().join(' ') === orderedScopes);
        const label = this.authenticationService.getLabel(providerId);

        if (sessions.length) {
            if (!this.authenticationService.supportsMultipleAccounts(providerId)) {
                const session = sessions[0];
                const allowed = await this.getSessionsPrompt(providerId, session.account.label, label, extensionId, extensionName);
                if (allowed) {
                    return session;
                } else {
                    throw new Error('User did not consent to login.');
                }
            }

            // On renderer side, confirm consent, ask user to choose between accounts if multiple sessions are valid
            const selected = await this.selectSession(providerId, label, extensionId, extensionName, sessions, scopes, !!options.clearSessionPreference);
            return sessions.find(session => session.id === selected.id);
        } else {
            if (options.createIfNone) {
                const isAllowed = await this.loginPrompt(label, extensionName);
                if (!isAllowed) {
                    throw new Error('User did not consent to login.');
                }

                const session = await this.authenticationService.login(providerId, scopes);
                await this.setTrustedExtensionAndAccountPreference(providerId, session.account.label, extensionId, extensionName, session.id);
                return session;
            } else {
                await this.requestNewSession(providerId, scopes, extensionId, extensionName);
                return undefined;
            }
        }
    }

    protected async selectSession(providerId: string, providerName: string, extensionId: string, extensionName: string,
        potentialSessions: AuthenticationSession[], scopes: string[], clearSessionPreference: boolean): Promise<AuthenticationSession> {
        if (!potentialSessions.length) {
            throw new Error('No potential sessions found');
        }

        if (clearSessionPreference) {
            await this.storageService.setData(`authentication-session-${extensionName}-${providerId}`, undefined);
        } else {
            const existingSessionPreference = await this.storageService.getData(`authentication-session-${extensionName}-${providerId}`);
            if (existingSessionPreference) {
                const matchingSession = potentialSessions.find(session => session.id === existingSessionPreference);
                if (matchingSession) {
                    const allowed = await this.getSessionsPrompt(providerId, matchingSession.account.label, providerName, extensionId, extensionName);
                    if (allowed) {
                        return matchingSession;
                    }
                }
            }
        }

        return new Promise(async (resolve, reject) => {
            const items: QuickPickValue<{ session?: AuthenticationSession }>[] = potentialSessions.map(session => ({
                label: session.account.label,
                value: { session }
            }));
            items.push({
                label: 'Sign in to another account',
                value: { session: undefined }
            });
            const selected = await this.quickPickService.show(items,
                {
                    title: `The extension '${extensionName}' wants to access a ${providerName} account`,
                    ignoreFocusOut: true
                });
            if (selected) {
                const session = selected.value?.session ?? await this.authenticationService.login(providerId, scopes);
                const accountName = session.account.label;

                const allowList = await readAllowedExtensions(this.storageService, providerId, accountName);
                if (!allowList.find(allowed => allowed.id === extensionId)) {
                    allowList.push({ id: extensionId, name: extensionName });
                    this.storageService.setData(`authentication-trusted-extensions-${providerId}-${accountName}`, JSON.stringify(allowList));
                }

                this.storageService.setData(`authentication-session-${extensionName}-${providerId}`, session.id);

                resolve(session);

            } else {
                reject('User did not consent to account access');
            }
        });
    }

    protected async getSessionsPrompt(providerId: string, accountName: string, providerName: string, extensionId: string, extensionName: string): Promise<boolean> {
        const allowList = await readAllowedExtensions(this.storageService, providerId, accountName);
        const extensionData = allowList.find(extension => extension.id === extensionId);
        if (extensionData) {
            addAccountUsage(this.storageService, providerId, accountName, extensionId, extensionName);
            return true;
        }
        const choice = await this.messageService.info(`The extension '${extensionName}' wants to access the ${providerName} account '${accountName}'.`, 'Allow', 'Cancel');

        const allow = choice === 'Allow';
        if (allow) {
            await addAccountUsage(this.storageService, providerId, accountName, extensionId, extensionName);
            allowList.push({ id: extensionId, name: extensionName });
            this.storageService.setData(`authentication-trusted-extensions-${providerId}-${accountName}`, JSON.stringify(allowList));
        }

        return allow;
    }

    protected async loginPrompt(providerName: string, extensionName: string): Promise<boolean> {
        const choice = await this.messageService.info(`The extension '${extensionName}' wants to sign in using ${providerName}.`, 'Allow', 'Cancel');
        return choice === 'Allow';
    }

    protected async setTrustedExtensionAndAccountPreference(providerId: string, accountName: string, extensionId: string, extensionName: string, sessionId: string): Promise<void> {
        const allowList = await readAllowedExtensions(this.storageService, providerId, accountName);
        if (!allowList.find(allowed => allowed.id === extensionId)) {
            allowList.push({ id: extensionId, name: extensionName });
            this.storageService.setData(`authentication-trusted-extensions-${providerId}-${accountName}`, JSON.stringify(allowList));
        }

        this.storageService.setData(`authentication-session-${extensionName}-${providerId}`, sessionId);
    }

    $ensureProvider(id: string): Promise<void> {
        return this.extensionService.$activateByEvent(getAuthenticationProviderActivationEvent(id));
    }

    $removeSession(providerId: string, sessionId: string): Promise<void> {
        return this.authenticationService.logout(providerId, sessionId);
    }

    $sendDidChangeSessions(providerId: string, event: AuthenticationProviderAuthenticationSessionsChangeEvent): void {
        this.authenticationService.updateSessions(providerId, event);
    }
}

async function addAccountUsage(storageService: StorageService, providerId: string, accountName: string, extensionId: string, extensionName: string): Promise<void> {
    const accountKey = `authentication-${providerId}-${accountName}-usages`;
    const usages = await readAccountUsages(storageService, providerId, accountName);

    const existingUsageIndex = usages.findIndex(usage => usage.extensionId === extensionId);
    if (existingUsageIndex > -1) {
        usages.splice(existingUsageIndex, 1, {
            extensionId,
            extensionName,
            lastUsed: Date.now()
        });
    } else {
        usages.push({
            extensionId,
            extensionName,
            lastUsed: Date.now()
        });
    }

    await storageService.setData(accountKey, JSON.stringify(usages));
}

interface AccountUsage {
    extensionId: string;
    extensionName: string;
    lastUsed: number;
}

export class AuthenticationProviderImpl implements AuthenticationProvider {
    private accounts = new Map<string, string[]>(); // Map account name to session ids
    private sessions = new Map<string, string>(); // Map account id to name

    constructor(
        private readonly proxy: AuthenticationExt,
        public readonly id: string,
        public readonly label: string,
        public readonly supportsMultipleAccounts: boolean,
        private readonly storageService: StorageService,
        private readonly messageService: MessageService
    ) { }

    public hasSessions(): boolean {
        return !!this.sessions.size;
    }

    private registerSession(session: AuthenticationSession): void {
        this.sessions.set(session.id, session.account.label);

        const existingSessionsForAccount = this.accounts.get(session.account.label);
        if (existingSessionsForAccount) {
            this.accounts.set(session.account.label, existingSessionsForAccount.concat(session.id));
            return;
        } else {
            this.accounts.set(session.account.label, [session.id]);
        }
    }

    async signOut(accountName: string): Promise<void> {
        const accountUsages = await readAccountUsages(this.storageService, this.id, accountName);
        const sessionsForAccount = this.accounts.get(accountName);
        const result = await this.messageService.info(accountUsages.length ? `The account ${accountName} has been used by:
        ${accountUsages.map(usage => usage.extensionName).join(', ')}. Sign out of these features?` : `Sign out of ${accountName}?`, 'Yes');

        if (result && result === 'Yes' && sessionsForAccount) {
            sessionsForAccount.forEach(sessionId => this.logout(sessionId));
            removeAccountUsage(this.storageService, this.id, accountName);
        }
    }

    async getSessions(): Promise<ReadonlyArray<AuthenticationSession>> {
        return this.proxy.$getSessions(this.id);
    }

    async updateSessionItems(event: AuthenticationProviderAuthenticationSessionsChangeEvent): Promise<void> {
        const { added, removed } = event;
        const session = await this.proxy.$getSessions(this.id);
        const addedSessions = session.filter(s => added.some(addedSession => addedSession.id === s.id));

        removed.forEach(removedSession => {
            const sessionId = removedSession.id;
            const accountName = this.sessions.get(sessionId);
            if (accountName) {
                this.sessions.delete(sessionId);
                const sessionsForAccount = this.accounts.get(accountName) || [];
                const sessionIndex = sessionsForAccount.indexOf(sessionId);
                sessionsForAccount.splice(sessionIndex);

                if (!sessionsForAccount.length) {
                    this.accounts.delete(accountName);
                }
            }
        });

        addedSessions.forEach(s => this.registerSession(s));
    }

    login(scopes: string[]): Promise<AuthenticationSession> {
        return this.proxy.$createSession(this.id, scopes);
    }

    async logout(sessionId: string): Promise<void> {
        await this.proxy.$removeSession(this.id, sessionId);
        this.messageService.info('Successfully signed out.');
    }

    readonly onDidChangeSessions:  Event<AuthenticationProviderAuthenticationSessionsChangeEvent>;

    createSession(scopes: string[]): Thenable<AuthenticationSession> {
        return this.login(scopes);
    }

    removeSession(sessionId: string): Thenable<void> {
        return this.logout(sessionId);
    }
}

async function readAccountUsages(storageService: StorageService, providerId: string, accountName: string): Promise<AccountUsage[]> {
    const accountKey = `authentication-${providerId}-${accountName}-usages`;
    const storedUsages: string | undefined = await storageService.getData(accountKey);
    let usages: AccountUsage[] = [];
    if (storedUsages) {
        try {
            usages = JSON.parse(storedUsages);
        } catch (e) {
            console.log(e);
        }
    }

    return usages;
}

function removeAccountUsage(storageService: StorageService, providerId: string, accountName: string): void {
    const accountKey = `authentication-${providerId}-${accountName}-usages`;
    storageService.setData(accountKey, undefined);
}
