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

import { injectable, inject, postConstruct } from 'inversify';
import { CommandRegistry } from '@theia/core/lib/common/command';
import * as theia from '@theia/plugin';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { CommandRegistryMain, CommandRegistryExt, MAIN_RPC_CONTEXT } from '../../common/plugin-api-rpc';
import { RPCProtocol, ProxyIdentifier } from '../../common/rpc-protocol';
import { KeybindingRegistry } from '@theia/core/lib/browser';
import { PluginContributionHandler } from './plugin-contribution-handler';
import { RPCProtocolServiceProvider } from './main-context';
import {
    PLUGIN_RPC_CONTEXT
} from '../../common/plugin-api-rpc';

@injectable()
export class CommandRegistryMainImpl implements CommandRegistryMain, Disposable, RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any> = PLUGIN_RPC_CONTEXT.COMMAND_REGISTRY_MAIN;

    private proxy: CommandRegistryExt;
    private readonly commands = new Map<string, Disposable>();
    private readonly handlers = new Map<string, Disposable>();

    @inject(CommandRegistry)
    private readonly delegate: CommandRegistry;

    @inject(KeybindingRegistry)
    private readonly keyBinding: KeybindingRegistry;

    @inject(PluginContributionHandler)
    private readonly contributions: PluginContributionHandler;

    @inject(RPCProtocol)
    private readonly rpc: RPCProtocol;

    protected readonly toDispose = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        this.proxy = this.rpc.getProxy(MAIN_RPC_CONTEXT.COMMAND_REGISTRY_EXT);
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    $registerCommand(command: theia.CommandDescription): void {
        const id = command.id;
        this.commands.set(id, this.contributions.registerCommand(command));
        this.toDispose.push(Disposable.create(() => this.$unregisterCommand(id)));
    }
    $unregisterCommand(id: string): void {
        const command = this.commands.get(id);
        if (command) {
            command.dispose();
            this.commands.delete(id);
        }
    }

    $registerHandler(id: string): void {
        this.handlers.set(id, this.contributions.registerCommandHandler(id, (...args) =>
            this.proxy.$executeCommand(id, ...args)
        ));
        this.toDispose.push(Disposable.create(() => this.$unregisterHandler(id)));
    }
    $unregisterHandler(id: string): void {
        const handler = this.handlers.get(id);
        if (handler) {
            handler.dispose();
            this.handlers.delete(id);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async $executeCommand<T>(id: string, ...args: any[]): Promise<T | undefined> {
        if (!this.delegate.getCommand(id)) {
            throw new Error(`Command with id '${id}' is not registered.`);
        }
        try {
            return await this.delegate.executeCommand(id, ...args);
        } catch (e) {
            // Command handler may be not active at the moment so the error must be caught. See https://github.com/eclipse-theia/theia/pull/6687#discussion_r354810079
            if ('code' in e && e['code'] === 'NO_ACTIVE_HANDLER') {
                return;
            } else {
                throw e;
            }
        }
    }

    $getKeyBinding(commandId: string): PromiseLike<theia.CommandKeyBinding[] | undefined> {
        try {
            const keyBindings = this.keyBinding.getKeybindingsForCommand(commandId);
            if (keyBindings) {
                // transform inner type to CommandKeyBinding
                return Promise.resolve(keyBindings.map(keyBinding => ({ id: commandId, value: keyBinding.keybinding })));
            } else {
                return Promise.resolve(undefined);
            }

        } catch (e) {
            return Promise.reject(e);
        }
    }

    $getCommands(): PromiseLike<string[]> {
        return Promise.resolve(this.delegate.commandIds);
    }

}

// @injectable()
// export class CommandRegistryMainServiceProvider implements RPCProtocolServiceProvider {

//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     identifier: ProxyIdentifier<any>;
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     class: any;

//     @inject(CommandRegistryMainImpl)
//     private readonly commandRegistryMain: CommandRegistryMain;

//     @postConstruct()
//     protected init(): void {
//         this.identifier = PLUGIN_RPC_CONTEXT.COMMAND_REGISTRY_MAIN;
//         this.class = this.commandRegistryMain;
//     }
// }
