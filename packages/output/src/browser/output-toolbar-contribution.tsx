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

import { inject, injectable } from 'inversify';
import { OutputWidget } from './output-widget';
import { OutputChannelReaders } from './output-channel-readers';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { OutputCommands } from './output-contribution';
import * as React from 'react';

@injectable()
export class OutputToolbarContribution implements TabBarToolbarContribution {

    @inject(OutputChannelReaders)
    protected readonly outputChannelManager: OutputChannelReaders;

    async registerToolbarItems(toolbarRegistry: TabBarToolbarRegistry): Promise<void> {
        toolbarRegistry.registerItem({
            id: 'channels',
            render: () => this.renderChannelSelector(),
            isVisible: widget => (widget instanceof OutputWidget),
            onDidChange: this.outputChannelManager.onDidChangeListOrSelection
        });

        toolbarRegistry.registerItem({
            id: OutputCommands.CLEAR_OUTPUT_TOOLBAR.id,
            command: OutputCommands.CLEAR_OUTPUT_TOOLBAR.id,
            tooltip: 'Clear Output',
            priority: 1,
        });
    }

    protected readonly NONE = '<no channels>';

    protected renderChannelSelector(): React.ReactNode {
        const channelOptionElements: React.ReactNode[] = [];
        const channels = this.outputChannelManager.getVisibleChannels();
        channels.sort((channel1, channel2) =>
            channel1.group.localeCompare(channel2.group)
        );
        let groupOfPreviousChannel: string | undefined = undefined;
        channels.forEach(channel => {
            if (groupOfPreviousChannel && groupOfPreviousChannel !== channel.group) {
                channelOptionElements.push(<option value='SEPARATOR' disabled={true} key={`group:${channel.name}`}>─────────</option>);
            }
            channelOptionElements.push(<option value={channel.name} key={channel.name}>{channel.name}</option>);
            groupOfPreviousChannel = channel.group;
        });
        if (channelOptionElements.length === 0) {
            channelOptionElements.push(<option key={this.NONE} value={this.NONE}>{this.NONE}</option>);
        }
        return <select
            className='theia-select'
            id={OutputWidget.IDs.CHANNEL_LIST}
            key={OutputWidget.IDs.CHANNEL_LIST}
            value={this.outputChannelManager.selectedChannel ? this.outputChannelManager.selectedChannel.name : this.NONE}
            onChange={
                async event => {
                    const channelName = (event.target as HTMLSelectElement).value;
                    if (channelName !== this.NONE) {
                        this.outputChannelManager.selectedChannel = this.outputChannelManager.getChannel(channelName);
                    }
                }
            }>
            {channelOptionElements}
        </select>;
    }

    protected changeChannel = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const channelName = event.target.value;
        if (channelName !== this.NONE) {
            this.outputChannelManager.selectedChannel = this.outputChannelManager.getChannel(channelName);
        }
    };
}
