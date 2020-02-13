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
import { MessageService } from '@theia/core/lib/common/message-service';
import { MessageRegistryMain, MainMessageType, MainMessageOptions, PLUGIN_RPC_CONTEXT } from '../../common/plugin-api-rpc';
import { ModalNotification, MessageType } from './dialogs/modal-notification';
import { RPCProtocolServiceProvider } from './main-context';
import { ProxyIdentifier } from '../../common/rpc-protocol';

@injectable()
export class MessageRegistryMainImpl implements MessageRegistryMain, RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any> = PLUGIN_RPC_CONTEXT.MESSAGE_REGISTRY_MAIN;

    @inject(MessageService)
    private readonly messageService: MessageService;

    async $showMessage(type: MainMessageType, message: string, options: MainMessageOptions, actions: string[]): Promise<number | undefined> {
        const action = await this.doShowMessage(type, message, options, actions);
        const handle = action ? actions.indexOf(action) : undefined;
        return handle === undefined && options.modal ? options.onCloseActionHandle : handle;
    }

    protected async doShowMessage(type: MainMessageType, message: string, options: MainMessageOptions, actions: string[]): Promise<string | undefined> {
        if (options.modal) {
            const messageType = type === MainMessageType.Error ? MessageType.Error :
                type === MainMessageType.Warning ? MessageType.Warning :
                    MessageType.Info;
            const modalNotification = new ModalNotification();
            return modalNotification.showDialog(messageType, message, actions);
        }
        switch (type) {
            case MainMessageType.Info:
                return this.messageService.info(message, ...actions);
            case MainMessageType.Warning:
                return this.messageService.warn(message, ...actions);
            case MainMessageType.Error:
                return this.messageService.error(message, ...actions);
        }
        throw new Error(`Message type '${type}' is not supported yet!`);
    }

}
