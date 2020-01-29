/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
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

import { ContainerModule, interfaces } from 'inversify';
import { OutputWidget, OUTPUT_WIDGET_KIND } from './output-widget';
import { WidgetFactory, bindViewContribution } from '@theia/core/lib/browser';
import { OutputContribution } from './output-contribution';
import { OutputToolbarContribution } from './output-toolbar-contribution';
import { OutputChannelManager } from '../common/output-channel';
import { OutputChannelManagerClient } from './output-channel-manager-client';
import { bindOutputPreferences } from '../common/output-preferences';
import { TabBarToolbarContribution } from '@theia/core/lib/browser/shell/tab-bar-toolbar';

import { WebSocketConnectionProvider } from '@theia/core/lib/browser';
import { OutputChannelBackendService, outputChannelBackendServicePath, outputChannelFrontendServicePath } from '../common/output-protocol';
import { OutputChannelReaders, OutputChannelReadersClient } from './output-channel-readers';

export default new ContainerModule((bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind) => {
    bindOutputPreferences(bind);
    bind(OutputWidget).toSelf();

    bind(OutputChannelManagerClient).toSelf().inSingletonScope();
    bind(OutputChannelManager).toDynamicValue(
        ctx => ctx.container.get(OutputChannelManagerClient)
    ).inSingletonScope();

    bind(WidgetFactory).toDynamicValue(context => ({
        id: OUTPUT_WIDGET_KIND,
        createWidget: () => context.container.get<OutputWidget>(OutputWidget)
    }));

    bindViewContribution(bind, OutputContribution);

    // Support for node-side channels
    bind(OutputChannelReaders).toSelf().inSingletonScope();
    bind(OutputChannelBackendService).toDynamicValue(ctx => {
        const client = ctx.container.get(OutputChannelReadersClient);
        return WebSocketConnectionProvider.createProxy<OutputChannelBackendService>(ctx.container, outputChannelBackendServicePath,
            client);
    }).inSingletonScope();

    bind(OutputToolbarContribution).toSelf().inSingletonScope();
    bind(TabBarToolbarContribution).toService(OutputToolbarContribution);

    bind(OutputChannelReadersClient).toSelf().inSingletonScope().onActivation(({ container }, channelReadersClient: OutputChannelReadersClient) => {
        WebSocketConnectionProvider.createProxy(container, outputChannelFrontendServicePath, channelReadersClient);
        return channelReadersClient;
    });

});
