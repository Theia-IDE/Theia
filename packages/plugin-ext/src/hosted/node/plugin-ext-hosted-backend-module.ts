/********************************************************************************
 * Copyright (C) 2018-2021 Red Hat, Inc. and others.
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

import * as path from 'path';
import { interfaces } from '@theia/core/shared/inversify';
import { bindContributionProvider } from '@theia/core/lib/common/contribution-provider';
import { CliContribution } from '@theia/core/lib/node/cli';
import { ConnectionContainerModule } from '@theia/core/lib/node/messaging/connection-container-module';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { MetadataScanner } from './metadata-scanner';
import { HostedPluginServerImpl } from './plugin-service';
import { HostedPluginReader } from './plugin-reader';
import { HostedPluginSupport } from './hosted-plugin';
import { TheiaPluginScanner } from './scanners/scanner-theia';
import { HostedPluginServer, PluginScanner, HostedPluginClient, hostedServicePath, PluginDeployerHandler, PluginHostEnvironmentVariable } from '../../common/plugin-protocol';
import { GrammarsReader } from './scanners/grammars-reader';
import { HostedPluginProcess, HostedPluginProcessConfiguration } from './hosted-plugin-process';
import { ExtPluginApiProvider } from '../../common/plugin-ext-api-contribution';
import { HostedPluginCliContribution } from './hosted-plugin-cli-contribution';
import { HostedPluginDeployerHandler } from './hosted-plugin-deployer-handler';
import { PluginUriFactory } from './scanners/plugin-uri-factory';
import { FilePluginUriFactory } from './scanners/file-plugin-uri-factory';

const commonHostedConnectionModule = ConnectionContainerModule.create(({ bind, bindBackendService }) => {
    bind(HostedPluginProcess).toSelf().inSingletonScope();
    bind(HostedPluginSupport).toSelf().inSingletonScope();

    bindContributionProvider(bind, Symbol.for(ExtPluginApiProvider));
    bindContributionProvider(bind, PluginHostEnvironmentVariable);

    bind(HostedPluginServerImpl).toSelf().inSingletonScope();
    bind(HostedPluginServer).toService(HostedPluginServerImpl);
    bindBackendService<HostedPluginServer, HostedPluginClient>(hostedServicePath, HostedPluginServer, (server, client) => {
        server.setClient(client);
        client.onDidCloseConnection(() => server.dispose());
        return server;
    });
});

export function bindCommonHostedBackend(bind: interfaces.Bind): void {
    bind(HostedPluginCliContribution).toSelf().inSingletonScope();
    bind(CliContribution).toService(HostedPluginCliContribution);

    bind(MetadataScanner).toSelf().inSingletonScope();
    bind(HostedPluginReader).toSelf().inSingletonScope();
    bind(BackendApplicationContribution).toService(HostedPluginReader);

    bind(HostedPluginDeployerHandler).toSelf().inSingletonScope();
    bind(PluginDeployerHandler).toService(HostedPluginDeployerHandler);

    bind(GrammarsReader).toSelf().inSingletonScope();
    bind(HostedPluginProcessConfiguration).toConstantValue({
        path: path.join(__dirname, 'plugin-host'),
    });

    bind(ConnectionContainerModule).toConstantValue(commonHostedConnectionModule);
    bind(PluginUriFactory).to(FilePluginUriFactory).inSingletonScope();
}

export function bindHostedBackend(bind: interfaces.Bind): void {
    bindCommonHostedBackend(bind);

    bind(PluginScanner).to(TheiaPluginScanner).inSingletonScope();
}
