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
import { OutputWidget } from '@theia/output/lib/browser/output-widget';
import { OutputContribution } from '@theia/output/lib/browser/output-contribution';
import { OutputChannel, OutputChannelManager } from '@theia/output/lib/common/output-channel';
import { OutputChannelRegistryMain, PLUGIN_RPC_CONTEXT, PluginInfo } from '../../common/plugin-api-rpc';
import { RPCProtocolServiceProvider } from './main-context';
import { ProxyIdentifier } from '../../common/rpc-protocol';

@injectable()
export class OutputChannelRegistryMainImpl implements OutputChannelRegistryMain, RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any> = PLUGIN_RPC_CONTEXT.OUTPUT_CHANNEL_REGISTRY_MAIN;

    @inject(OutputChannelManager)
    private outputChannelManager: OutputChannelManager;

    @inject(OutputContribution)
    private outputContribution: OutputContribution;

    private commonOutputWidget: OutputWidget | undefined;

    private channels: Map<string, OutputChannel> = new Map();

    $append(channelName: string, value: string, pluginInfo: PluginInfo): PromiseLike<void> {
        const outputChannel = this.getChannel(channelName);
        if (outputChannel) {
            outputChannel.append(value);
        }

        return Promise.resolve();
    }

    $clear(channelName: string): PromiseLike<void> {
        const outputChannel = this.getChannel(channelName);
        if (outputChannel) {
            outputChannel.clear();
        }

        return Promise.resolve();
    }

    $dispose(channelName: string): PromiseLike<void> {
        this.outputChannelManager.deleteChannel(channelName);
        if (this.channels.has(channelName)) {
            this.channels.delete(channelName);
        }

        return Promise.resolve();
    }

    async $reveal(channelName: string, preserveFocus: boolean): Promise<void> {
        const outputChannel = this.getChannel(channelName);
        if (outputChannel) {
            const activate = !preserveFocus;
            const reveal = preserveFocus;
            this.commonOutputWidget = await this.outputContribution.openView({ activate, reveal });
            outputChannel.setVisibility(true);
        }
    }

    $close(channelName: string): PromiseLike<void> {
        const outputChannel = this.getChannel(channelName);
        if (outputChannel) {
            outputChannel.setVisibility(false);
        }
        const channels = this.outputChannelManager.getChannels();
        const isEmpty = channels.findIndex((channel: OutputChannel) => channel.isVisible) === -1;
        if (isEmpty && this.commonOutputWidget) {
            this.commonOutputWidget.close();
        }

        return Promise.resolve();
    }

    private getChannel(channelName: string): OutputChannel | undefined {
        let outputChannel: OutputChannel | undefined;
        if (this.channels.has(channelName)) {
            outputChannel = this.channels.get(channelName);
        } else {
            outputChannel = this.outputChannelManager.getChannel(channelName);
            this.channels.set(channelName, outputChannel);
        }

        return outputChannel;
    }
}
