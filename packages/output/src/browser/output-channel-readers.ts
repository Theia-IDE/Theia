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

import { Disposable, DisposableCollection, Emitter } from '@theia/core';
import { injectable, inject, postConstruct } from 'inversify';
import { OutputChannelBackendService, OutputChannelFrontendService } from '../common/output-protocol';
import { OutputPreferences } from '../common/output-preferences';
import { OutputChannel } from '../common/output-channel';
import { OutputChannelManagerClient } from './output-channel-manager-client';

export interface OutputChannelMetadata {
    name: string,
    group: string
}

/**
 * Class that will receive output data from the server.  This is separate
 * from the OutputChannelReaders class only to avoid a cycle in the
 * dependency injection.
 */

@injectable()
export class OutputChannelReadersClient implements OutputChannelFrontendService {
    private service: OutputChannelFrontendService;

    onChannelAdded(channelName: string, group: string): void {
        this.service.onChannelAdded(channelName, group);
    }
    onChannelDeleted(channelName: string): void {
        this.service.onChannelDeleted(channelName);
    }

    onProcessOutput(line: string, channelName: string): void {
        this.service.onProcessOutput(line, channelName);
    }

    setService(service: OutputChannelFrontendService): void {
        this.service = service;
    }
}

@injectable()
export class OutputChannelReaders implements OutputChannelFrontendService, Disposable {
    protected readonly backendChannels = new Map<string, OutputChannel>();
    protected selectedChannelValue: OutputChannel | undefined;

    protected readonly channelDeleteEmitter = new Emitter<{ channelName: string }>();
    protected readonly channelAddedEmitter = new Emitter<OutputChannel>();
    protected readonly selectedChannelEmitter: Emitter<void> = new Emitter<void>();
    protected readonly listOrSelectionEmitter: Emitter<void> = new Emitter<void>();
    readonly onDidDeleteChannel = this.channelDeleteEmitter.event;
    readonly onDidAddChannel = this.channelAddedEmitter.event;
    readonly onDidChangeSelection = this.selectedChannelEmitter.event;
    readonly onDidChangeListOrSelection = this.listOrSelectionEmitter.event;

    protected toDispose: DisposableCollection = new DisposableCollection();

    @inject(OutputChannelReadersClient) protected readonly client: OutputChannelReadersClient;
    @inject(OutputChannelManagerClient) protected frontendChannels: OutputChannelManagerClient;
    @inject(OutputChannelBackendService) protected remoteChannelService: OutputChannelBackendService;
    @inject(OutputPreferences) protected preferences: OutputPreferences;

    @postConstruct()
    async init(): Promise<void> {
        this.client.setService(this);

        this.toDispose.push(this.frontendChannels.onDidAddChannel(channel => {
            this.channelAddedEmitter.fire(channel);
        }));
        this.toDispose.push(this.frontendChannels.onDidDeleteChannel(channel => {
            this.channelDeleteEmitter.fire(channel);
        }));

        const backendChannels = await this.remoteChannelService.getChannels();
        backendChannels.forEach(channelInfo => {
            const backendChannel = new OutputChannel(channelInfo.name, this.preferences, { group: channelInfo.group });
            this.backendChannels.set(channelInfo.name, backendChannel);
            this.remoteChannelService.requestToSendContent(channelInfo.name);
        });
    }

    getChannel(name: string): OutputChannel {
        const backendChannel = this.backendChannels.get(name);
        if (backendChannel) {
            return backendChannel;
        }
        return this.frontendChannels.getChannel(name);
    }

    getChannels(): OutputChannel[] {
        return [
            ...this.frontendChannels.getChannels(),
            ...this.backendChannels.values()
        ];
    }

    getVisibleChannels(): OutputChannel[] {
        return this.getChannels()
            .filter(channel => channel.isVisible);
    }

    onChannelAdded(channelName: string, group: string): void {
        const channel = new OutputChannel(channelName, this.preferences, { group });
        this.backendChannels.set(channelName, channel);
        this.channelAddedEmitter.fire(channel);
    }

    onChannelDeleted(channelName: string): void {
        this.backendChannels.delete(channelName);
        this.channelDeleteEmitter.fire({ channelName });
    }

    onProcessOutput(line: string, channelName: string): void {
        const channel = this.backendChannels.get(channelName);
        if (channel) {
            channel.appendLine(line);
        }
    }

    get selectedChannel(): OutputChannel | undefined {
        return this.selectedChannelValue;
    }

    set selectedChannel(channel: OutputChannel | undefined) {
        this.selectedChannelValue = channel;
        this.selectedChannelEmitter.fire(undefined);
        this.listOrSelectionEmitter.fire(undefined);
    }

    dispose(): void {
        this.toDispose.dispose();
    }
}
