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
// code copied and modified from https://github.com/microsoft/vscode/blob/1.47.3/src/vs/workbench/services/authentication/browser/authenticationService.ts

import { injectable, inject, postConstruct } from 'inversify';
import { Emitter, Event } from '../common/event';
import { StorageService } from '../browser/storage-service';
import { Disposable } from '../common/disposable';
import { ACCOUNTS_MENU, ACCOUNTS_SUBMENU, MenuModelRegistry } from '../common/menu';
import { Command, CommandRegistry } from '../common/command';
import { DisposableCollection } from '../common/disposable';

export interface AuthenticationSessionsChangeEvent {
    added: ReadonlyArray<string>;
    removed: ReadonlyArray<string>;
    changed: ReadonlyArray<string>;
}

export interface AuthenticationSession {
    id: string;
    accessToken: string;
    account: {
        label: string;
        id: string;
    }
    scopes: ReadonlyArray<string>;
}

export interface AuthenticationProviderInformation {
    id: string;
    label: string;
}

export interface SessionRequest {
    disposables: Disposable[];
    requestingExtensionIds: string[];
}

export interface SessionRequestInfo {
    [scopes: string]: SessionRequest;
}

export interface AuthenticationProvider {
    id: string;

    supportsMultipleAccounts: boolean;

    label: string;

    hasSessions(): boolean;

    signOut(accountName: string): Promise<void>;

    getSessions(): Promise<ReadonlyArray<AuthenticationSession>>;

    updateSessionItems(event: AuthenticationSessionsChangeEvent): Promise<void>;

    login(scopes: string[]): Promise<AuthenticationSession>;

    logout(sessionId: string): Promise<void>;
}
export const AuthenticationService = Symbol('AuthenticationService');

export interface AuthenticationService {
    isAuthenticationProviderRegistered(id: string): boolean;
    getProviderIds(): string[];
    registerAuthenticationProvider(id: string, provider: AuthenticationProvider): void;
    unregisterAuthenticationProvider(id: string): void;
    requestNewSession(id: string, scopes: string[], extensionId: string, extensionName: string): void;
    updateSessions(providerId: string, event: AuthenticationSessionsChangeEvent): void;

    readonly onDidRegisterAuthenticationProvider: Event<AuthenticationProviderInformation>;
    readonly onDidUnregisterAuthenticationProvider: Event<AuthenticationProviderInformation>;

    readonly onDidChangeSessions: Event<{ providerId: string, label: string, event: AuthenticationSessionsChangeEvent }>;
    getSessions(providerId: string): Promise<ReadonlyArray<AuthenticationSession>>;
    getLabel(providerId: string): string;
    supportsMultipleAccounts(providerId: string): boolean;
    login(providerId: string, scopes: string[]): Promise<AuthenticationSession>;
    logout(providerId: string, sessionId: string): Promise<void>;

    signOutOfAccount(providerId: string, accountName: string): Promise<void>;
}

@injectable()
export class AuthenticationServiceImpl implements AuthenticationService {
    private noAccountsMenuItem: Disposable | undefined;
    private noAccountsCommand: Command = { id: 'noAccounts' };
    private signInRequestItems = new Map<string, SessionRequestInfo>();

    private authenticationProviders: Map<string, AuthenticationProvider> = new Map<string, AuthenticationProvider>();

    private onDidRegisterAuthenticationProviderEmitter: Emitter<AuthenticationProviderInformation> = new Emitter<AuthenticationProviderInformation>();
    readonly onDidRegisterAuthenticationProvider: Event<AuthenticationProviderInformation> = this.onDidRegisterAuthenticationProviderEmitter.event;

    private onDidUnregisterAuthenticationProviderEmitter: Emitter<AuthenticationProviderInformation> = new Emitter<AuthenticationProviderInformation>();
    readonly onDidUnregisterAuthenticationProvider: Event<AuthenticationProviderInformation> = this.onDidUnregisterAuthenticationProviderEmitter.event;

    private onDidChangeSessionsEmitter: Emitter<{ providerId: string, label: string, event: AuthenticationSessionsChangeEvent }> =
        new Emitter<{ providerId: string, label: string, event: AuthenticationSessionsChangeEvent }>();
    readonly onDidChangeSessions: Event<{ providerId: string, label: string, event: AuthenticationSessionsChangeEvent }> = this.onDidChangeSessionsEmitter.event;

    @inject(MenuModelRegistry) protected readonly menus: MenuModelRegistry;
    @inject(CommandRegistry) protected readonly commands: CommandRegistry;
    @inject(StorageService) protected readonly storageService: StorageService;

    @postConstruct()
    init(): void {
        const disposableMap = new Map<string, DisposableCollection>();
        this.onDidChangeSessions(async e => {
            if (e.event.added.length > 0) {
                const sessions = await this.getSessions(e.providerId);
                sessions.forEach(session => {
                    if (sessions.find(s => disposableMap.get(s.id))) {
                        return;
                    }
                    const disposables = new DisposableCollection();
                    const commandId = `account-sign-out-${e.providerId}-${session.id}`;
                    const command = this.commands.registerCommand({ id: commandId }, {
                        execute: async () => {
                            this.signOutOfAccount(e.providerId, session.account.label);
                        }
                    });
                    const subSubMenuPath = [...ACCOUNTS_SUBMENU, 'account-sub-menu'];
                    this.menus.registerSubmenu(subSubMenuPath, `${session.account.label} (${e.label})`);
                    const menuAction = this.menus.registerMenuAction(subSubMenuPath, {
                        label: 'Sign Out',
                        commandId
                    });
                    disposables.push(menuAction);
                    disposables.push(command);
                    disposableMap.set(session.id, disposables);
                });
            }
            if (e.event.removed.length > 0) {
                e.event.removed.forEach(removed => {
                    const toDispose = disposableMap.get(removed);
                    if (toDispose) {
                        toDispose.dispose();
                        disposableMap.delete(removed);
                    }
                });
            }
        });
        this.commands.registerCommand(this.noAccountsCommand, {
            execute: () => { },
            isEnabled: () => false
        });
    }

    getProviderIds(): string[] {
        const providerIds: string[] = [];
        this.authenticationProviders.forEach(provider => {
            providerIds.push(provider.id);
        });
        return providerIds;
    }

    isAuthenticationProviderRegistered(id: string): boolean {
        return this.authenticationProviders.has(id);
    }

    private updateAccountsMenuItem(): void {
        let hasSession = false;
        this.authenticationProviders.forEach(async provider => {
            hasSession = hasSession || provider.hasSessions();
        });

        if (hasSession && this.noAccountsMenuItem) {
            this.noAccountsMenuItem.dispose();
            this.noAccountsMenuItem = undefined;
        }

        if (!hasSession && !this.noAccountsMenuItem) {
            this.noAccountsMenuItem = this.menus.registerMenuAction(ACCOUNTS_MENU, {
                label: 'You are not signed in to any accounts',
                order: '0',
                commandId: this.noAccountsCommand.id
            });
        }
    }

    registerAuthenticationProvider(id: string, authenticationProvider: AuthenticationProvider): void {
        if (this.authenticationProviders.get(id)) {
            throw new Error(`An authentication provider with id '${id}' is already registered.`);
        }
        this.authenticationProviders.set(id, authenticationProvider);
        this.onDidRegisterAuthenticationProviderEmitter.fire({ id, label: authenticationProvider.label });

        this.updateAccountsMenuItem();
        console.log(`An authentication provider with id '${id}' was registered.`);
    }

    unregisterAuthenticationProvider(id: string): void {
        const provider = this.authenticationProviders.get(id);
        if (provider) {
            this.authenticationProviders.delete(id);
            this.onDidUnregisterAuthenticationProviderEmitter.fire({ id, label: provider.label });
            this.updateAccountsMenuItem();
        } else {
            console.error(`Failed to unregister an authentication provider. A provider with id '${id}' was not found.`);
        }
    }

    async updateSessions(id: string, event: AuthenticationSessionsChangeEvent): Promise<void> {
        const provider = this.authenticationProviders.get(id);
        if (provider) {
            await provider.updateSessionItems(event);
            this.onDidChangeSessionsEmitter.fire({ providerId: id, label: provider.label, event: event });
            this.updateAccountsMenuItem();

            if (event.added) {
                await this.updateNewSessionRequests(provider);
            }
        } else {
            console.error(`Failed to update an authentication session. An authentication provider with id '${id}' was not found.`);
        }
    }

    private async updateNewSessionRequests(provider: AuthenticationProvider): Promise<void> {
        const existingRequestsForProvider = this.signInRequestItems.get(provider.id);
        if (!existingRequestsForProvider) {
            return;
        }

        const sessions = await provider.getSessions();
        Object.keys(existingRequestsForProvider).forEach(requestedScopes => {
            if (sessions.some(session => session.scopes.slice().sort().join('') === requestedScopes)) {
                const sessionRequest = existingRequestsForProvider[requestedScopes];
                if (sessionRequest) {
                    sessionRequest.disposables.forEach(item => item.dispose());
                }

                delete existingRequestsForProvider[requestedScopes];
                if (Object.keys(existingRequestsForProvider).length === 0) {
                    this.signInRequestItems.delete(provider.id);
                } else {
                    this.signInRequestItems.set(provider.id, existingRequestsForProvider);
                }
            }
        });
    }

    async requestNewSession(providerId: string, scopes: string[], extensionId: string, extensionName: string): Promise<void> {
        let provider = this.authenticationProviders.get(providerId);
        if (!provider) {
            // Activate has already been called for the authentication provider, but it cannot block on registering itself
            // since this is sync and returns a disposable. So, wait for registration event to fire that indicates the
            // provider is now in the map.
            provider = await new Promise(resolve => {
                this.onDidRegisterAuthenticationProvider(e => {
                    if (e.id === providerId) {
                        resolve(this.authenticationProviders.get(providerId));
                    }
                });
            });
        }

        if (provider) {
            const providerRequests = this.signInRequestItems.get(providerId);
            const scopesList = scopes.sort().join('');
            const extensionHasExistingRequest = providerRequests
                && providerRequests[scopesList]
                && providerRequests[scopesList].requestingExtensionIds.indexOf(extensionId) > -1;

            if (extensionHasExistingRequest) {
                return;
            }

            const menuItem = this.menus.registerMenuAction(ACCOUNTS_SUBMENU, {
                label: `Sign in to use ${extensionName} (1)`,
                order: '1',
                commandId: `${extensionId}signIn`,
            });

            const signInCommand = this.commands.registerCommand({ id: `${extensionId}signIn` }, {
                execute: async () => {
                    const session = await this.login(providerId, scopes);

                    // Add extension to allow list since user explicitly signed in on behalf of it
                    const allowList = await readAllowedExtensions(this.storageService, providerId, session.account.label);
                    if (!allowList.find(allowed => allowed.id === extensionId)) {
                        allowList.push({ id: extensionId, name: extensionName });
                        this.storageService.setData(`authentication-trusted-extensions-${providerId}-${session.account.label}`, JSON.stringify(allowList));
                    }

                    // And also set it as the preferred account for the extension
                    this.storageService.setData(`authentication-session-${extensionName}-${providerId}`, session.id);
                }
            });

            if (providerRequests) {
                const existingRequest = providerRequests[scopesList] || { disposables: [], requestingExtensionIds: [] };

                providerRequests[scopesList] = {
                    disposables: [...existingRequest.disposables, menuItem, signInCommand],
                    requestingExtensionIds: [...existingRequest.requestingExtensionIds, extensionId]
                };
                this.signInRequestItems.set(providerId, providerRequests);
            } else {
                this.signInRequestItems.set(providerId, {
                    [scopesList]: {
                        disposables: [menuItem, signInCommand],
                        requestingExtensionIds: [extensionId]
                    }
                });
            }
        }
    }

    getLabel(id: string): string {
        const authProvider = this.authenticationProviders.get(id);
        if (authProvider) {
            return authProvider.label;
        } else {
            throw new Error(`No authentication provider '${id}' is currently registered.`);
        }
    }

    supportsMultipleAccounts(id: string): boolean {
        const authProvider = this.authenticationProviders.get(id);
        if (authProvider) {
            return authProvider.supportsMultipleAccounts;
        } else {
            throw new Error(`No authentication provider '${id}' is currently registered.`);
        }
    }

    async getSessions(id: string): Promise<ReadonlyArray<AuthenticationSession>> {
        const authProvider = this.authenticationProviders.get(id);
        if (authProvider) {
            return authProvider.getSessions();
        } else {
            throw new Error(`No authentication provider '${id}' is currently registered.`);
        }
    }

    async login(id: string, scopes: string[]): Promise<AuthenticationSession> {
        const authProvider = this.authenticationProviders.get(id);
        if (authProvider) {
            return authProvider.login(scopes);
        } else {
            throw new Error(`No authentication provider '${id}' is currently registered.`);
        }
    }

    async logout(id: string, sessionId: string): Promise<void> {
        const authProvider = this.authenticationProviders.get(id);
        if (authProvider) {
            return authProvider.logout(sessionId);
        } else {
            throw new Error(`No authentication provider '${id}' is currently registered.`);
        }
    }

    async signOutOfAccount(id: string, accountName: string): Promise<void> {
        const authProvider = this.authenticationProviders.get(id);
        if (authProvider) {
            return authProvider.signOut(accountName);
        } else {
            throw new Error(`No authentication provider '${id}' is currently registered.`);
        }
    }
}

export interface AllowedExtension {
    id: string;
    name: string;
}

export async function readAllowedExtensions(storageService: StorageService, providerId: string, accountName: string): Promise<AllowedExtension[]> {
    let trustedExtensions: AllowedExtension[] = [];
    try {
        const trustedExtensionSrc: string | undefined = await storageService.getData(`authentication-trusted-extensions-${providerId}-${accountName}`);
        if (trustedExtensionSrc) {
            trustedExtensions = JSON.parse(trustedExtensionSrc);
        }
    } catch (err) {
        console.error(err);
    }

    return trustedExtensions;
}
