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

import { injectable } from 'inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { HostedPluginClient } from '../../common/plugin-protocol';
import { LogPart } from '../../common/types';

@injectable()
export class HostedPluginClientImpl implements HostedPluginClient {
    private readonly onPostMessage = new Emitter<[string, string]>();
    private readonly onLogMessage = new Emitter<LogPart>();
    private readonly onDidDeployEmitter = new Emitter<string>();
    private readonly onDidStartPluginHostEmitter = new Emitter<string>();
    private readonly onWillStartPluginHostEmitter = new Emitter<string>();

    postMessage(pluginHostId: string, message: string): Promise<void> {

        // todo: fire to the appropriate rpc proto
        this.onPostMessage.fire([pluginHostId, message]);
        return Promise.resolve();
    }

    log(logPart: LogPart): Promise<void> {
        this.onLogMessage.fire(logPart);
        return Promise.resolve();
    }

    onDidDeploy(pluginHostId: string): void {
        this.onDidDeployEmitter.fire(pluginHostId);
    }

    onWillStartPluginHost(routingInfo: string): void {
        return this.onWillStartPluginHostEmitter.fire(routingInfo);
    }

    onDidStartPluginHost(routingInfo: string): void {
        return this.onDidStartPluginHostEmitter.fire(routingInfo);
    }

    get onDidDeployEvent(): Event<string> {
        return this.onDidDeployEmitter.event;
    }

    get onPostMessageEvent(): Event<[string, string]> {
        return this.onPostMessage.event;
    }

    get onLogMessageEvent(): Event<LogPart> {
        return this.onLogMessage.event;
    }

    get onDidStartPluginHostEvent(): Event<string> {
        return this.onDidStartPluginHostEmitter.event;
    }

    get onWillStartPluginHostEvent(): Event<string> {
        return this.onWillStartPluginHostEmitter.event;
    }

}
