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

import { injectable, inject } from 'inversify';
import {
    LanguagesContributionMain, MAIN_RPC_CONTEXT, PLUGIN_RPC_CONTEXT
} from '../../common/plugin-api-rpc';
import { RPCProtocol, ProxyIdentifier } from '../../common/rpc-protocol';
import * as theia from '@theia/plugin';
import { Workspace, Languages, MessageReader, MessageWriter } from '@theia/languages/lib/browser/language-client-services';
import { LanguageClientFactory, BaseLanguageClientContribution } from '@theia/languages/lib/browser';
import { MessageService, CommandRegistry } from '@theia/core';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser';
import { createMessageConnection, MessageConnection } from 'vscode-jsonrpc';
import { ConnectionMainImpl } from './connection-main';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { LanguageClientContributionProvider } from './language-provider/language-client-contribution-provider';
import { RPCProtocolServiceProvider } from './main-context';

/**
 * Implementation of languages contribution system of the plugin API.
 * Uses for registering new language server which was described in the plug-in.
 */
@injectable()
export class LanguagesContributionMainImpl implements LanguagesContributionMain, Disposable, RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any> = PLUGIN_RPC_CONTEXT.LANGUAGES_CONTRIBUTION_MAIN;

    @inject(LanguageClientContributionProvider)
    private readonly languageClientContributionProvider: LanguageClientContributionProvider;

    @inject(ConnectionMainImpl)
    private readonly connectionMain: ConnectionMainImpl;

    @inject(Workspace)
    private readonly workspace: Workspace;

    @inject(Languages)
    private readonly languages: Languages;

    @inject(LanguageClientFactory)
    private readonly languageClientFactory: LanguageClientFactory;

    @inject(MessageService)
    private readonly messageService: MessageService;

    @inject(CommandRegistry)
    private readonly commandRegistry: CommandRegistry;

    @inject(WorkspaceService)
    private readonly workspaceService: WorkspaceService;

    @inject(WebSocketConnectionProvider)
    private readonly webSocketConnectionProvider: WebSocketConnectionProvider;

    @inject(RPCProtocol)
    private readonly rpc: RPCProtocol;

    private readonly toDispose = new DisposableCollection();

    dispose(): void {
        this.toDispose.dispose();
    }

    /**
     * Creates new client contribution for the language server and register it.
     *
     * @param languageServerInfo an information about the registered language server
     */
    $registerLanguageServerProvider(languageServerInfo: theia.LanguageServerInfo): void {
        const newLanguageContribution = new PluginLanguageClientContribution(this.workspace,
            this.languages,
            this.languageClientFactory,
            this.connectionMain,
            languageServerInfo,
            this.rpc);

        newLanguageContribution.messageService = this.messageService;
        newLanguageContribution.registry = this.commandRegistry;
        newLanguageContribution.workspaceService = this.workspaceService;
        newLanguageContribution.connectionProvider = this.webSocketConnectionProvider;

        newLanguageContribution.id = languageServerInfo.id;
        newLanguageContribution.name = languageServerInfo.name;
        newLanguageContribution.contains = languageServerInfo.workspaceContains;
        newLanguageContribution.patterns = languageServerInfo.globPatterns;

        this.languageClientContributionProvider.registerLanguageClientContribution(newLanguageContribution);
        this.toDispose.push(Disposable.create(() => this.$stop(languageServerInfo.id)));
    }

    /**
     * Removes language client contribution from the registry and clear related connections.
     *
     * @param id language server's id
     */
    $stop(id: string): void {
        this.languageClientContributionProvider.unregisterLanguageClientContribution(id);
        this.connectionMain.ensureConnection(id).then(connection => {
            connection.dispose();
        });
    }

}

/**
 * The language client contribution for the language server which was described in the plug-in.
 */
class PluginLanguageClientContribution extends BaseLanguageClientContribution {
    id: string;
    name: string;
    patterns: string[] | undefined;
    contains: string[] | undefined;

    messageService: MessageService;
    registry: CommandRegistry;
    workspaceService: WorkspaceService;
    connectionProvider: WebSocketConnectionProvider;

    constructor(protected readonly workspace: Workspace,
        protected readonly languages: Languages,
        protected readonly languageClientFactory: LanguageClientFactory,
        protected readonly connectionMain: ConnectionMainImpl,
        protected readonly languageContribution: theia.LanguageServerInfo,
        protected readonly rpc: RPCProtocol
    ) {
        super(workspace, languages, languageClientFactory);
    }

    protected get globPatterns(): string[] {
        return this.patterns ? this.patterns : [];
    }

    protected get workspaceContains(): string[] {
        return this.contains ? this.contains : [];
    }

    protected async doActivate(toDeactivate: DisposableCollection): Promise<void> {
        // Until the client will be activated, the connection between the plugin and client contribution should be set.
        const connection = await this.connectionMain.ensureConnection(this.id);
        const messageConnection = createMessageConnection(connection.reader as MessageReader, connection.writer as MessageWriter);
        this.deferredConnection.resolve(messageConnection);
        messageConnection.onDispose(() => this.deferredConnection = new Deferred<MessageConnection>());
        if (toDeactivate.disposed) {
            messageConnection.dispose();
            return;
        }
        const proxy = this.rpc.getProxy(MAIN_RPC_CONTEXT.LANGUAGES_CONTRIBUTION_EXT);
        // Asks the plugin to start the process of language server.
        proxy.$start(this.languageContribution);

        toDeactivate.push(Disposable.create(() => this.stop = (async () => {
            try {
                // avoid calling stop if start failed
                await this._languageClient!.onReady();
                // remove all listerens
                await this._languageClient!.stop();
            } catch {
                // if start or stop failed make sure the the connection is closed
                messageConnection.dispose();
                connection.dispose();
            }
        })()));

        toDeactivate.push(messageConnection.onClose(() => this.restart()));
        this.onWillStart(this._languageClient!);
        this._languageClient!.start();
    }

}
