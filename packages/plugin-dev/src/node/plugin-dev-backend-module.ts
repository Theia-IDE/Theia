/********************************************************************************
 * Copyright (C) 2019 Red Hat, Inc. and others.
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

import { HostedInstanceManager, NodeHostedPluginRunner } from './hosted-instance-manager';
import { HostedPluginUriPostProcessorSymbolName } from './hosted-plugin-uri-postprocessor';
import { HostedPluginsManager, HostedPluginsManagerImpl } from './hosted-plugins-manager';
import { ContainerModule, interfaces } from 'inversify';
import { ConnectionContainerModule } from '@theia/core/lib/node/messaging/connection-container-module';
import { bindContributionProvider } from '@theia/core/lib/common/contribution-provider';
import { PluginDevServerImpl } from './plugin-dev-server-impl';
import { PluginDevServer, PluginDevClient, pluginDevServicePath } from '../common/plugin-dev-protocol';
import { HostedPluginReader } from './hosted-plugin-reader';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';

const commonHostedConnectionModule = ConnectionContainerModule.create(({ bind, bindBackendService }) => {
    bind(HostedPluginsManagerImpl).toSelf().inSingletonScope();
    bind(HostedPluginsManager).toService(HostedPluginsManagerImpl);
    bind(PluginDevServerImpl).toSelf().inSingletonScope();
    bind(PluginDevServer).toService(PluginDevServerImpl);
    bindBackendService<PluginDevServer, PluginDevClient>(pluginDevServicePath, PluginDevServer, (server, client) => {
        server.setClient(client);
        client.onDidCloseConnection(() => server.dispose());
        return server;
    });
});

export function bindCommonHostedBackend(bind: interfaces.Bind): void {
    bind(HostedPluginReader).toSelf().inSingletonScope();
    bind(BackendApplicationContribution).toService(HostedPluginReader);
    bind(ConnectionContainerModule).toConstantValue(commonHostedConnectionModule);
}

const hostedBackendConnectionModule = ConnectionContainerModule.create(({ bind }) => {
    bindContributionProvider(bind, Symbol.for(HostedPluginUriPostProcessorSymbolName));
    bind(HostedInstanceManager).to(NodeHostedPluginRunner).inSingletonScope();
});

export default new ContainerModule(bind => {
    bindCommonHostedBackend(bind);
    bind(ConnectionContainerModule).toConstantValue(hostedBackendConnectionModule);
});
