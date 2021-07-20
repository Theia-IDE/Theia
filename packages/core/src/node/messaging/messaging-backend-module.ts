/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
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

import { ContainerModule } from 'inversify';
import { bindContributionProvider } from '../../common';
import { BackendApplicationContribution } from '../backend-application';
import { MessagingContribution, MessagingContainer } from './messaging-contribution';
import { ConnectionContainerModule } from './connection-container-module';
import { MessagingService } from './messaging-service';
import { MessagingListener, MessagingListenerContribution } from './messaging-listeners';
import { HttpWebsocketAdapter, HttpWebsocketAdapterFactory } from './http-websocket-adapter';

export const messagingBackendModule = new ContainerModule(bind => {
    bindContributionProvider(bind, ConnectionContainerModule);
    bindContributionProvider(bind, MessagingService.Contribution);
    bind(MessagingService.Identifier).to(MessagingContribution).inSingletonScope();
    bind(MessagingContribution).toDynamicValue(({ container }) => {
        const child = container.createChild();
        child.bind(MessagingContainer).toConstantValue(container);
        return child.get(MessagingService.Identifier);
    }).inSingletonScope();
    bind(BackendApplicationContribution).toService(MessagingContribution);
    bind(MessagingListener).toSelf().inSingletonScope();
    bindContributionProvider(bind, MessagingListenerContribution);
    bind(HttpWebsocketAdapter).toSelf().inRequestScope();
    bind(HttpWebsocketAdapterFactory).toFactory(({ container }) => () => container.get(HttpWebsocketAdapter));
});
