/********************************************************************************
 * Copyright (C) 2019 Arm and others.
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

import { interfaces, ContainerModule } from 'inversify';
import { OutputChannelBackendManager } from './output-channel-backend-manager';
import { OutputChannelBackendServiceImpl } from './output-channel-backend-service-impl';
import { OutputChannelBackendService, outputChannelBackendServicePath, outputChannelFrontendServicePath, OutputChannelFrontendService } from '../common/output-protocol';
import { ConnectionContainerModule } from '@theia/core/lib/node/messaging/connection-container-module';

export default new ContainerModule((bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind) => {
    bind(OutputChannelBackendManager).toSelf().inSingletonScope();
    bind(OutputChannelBackendService).toDynamicValue(ctx => {
        const server = ctx.container.get(OutputChannelBackendManager);
        return server;
    }).inSingletonScope();

    bind(ConnectionContainerModule).toConstantValue(outputChannelConnectionModule);
});

const outputChannelConnectionModule = ConnectionContainerModule.create(({ bind, bindFrontendService, bindBackendService }) => {
    bind(OutputChannelBackendServiceImpl).toSelf().inSingletonScope();
    bindBackendService(outputChannelBackendServicePath, OutputChannelBackendServiceImpl);

    bindFrontendService(outputChannelFrontendServicePath, OutputChannelFrontendService);
});
