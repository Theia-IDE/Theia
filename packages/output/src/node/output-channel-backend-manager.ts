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

import { injectable } from 'inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';

export interface LogOutputChannel {
    appendLine(line: string): void;
}

interface ChannelNameAndGroup {
    channelName: string;
    group: string;
}

interface ChannelNameAndLine {
    channelName: string;
    line: string;
}

interface ChannelData {
    group: string;
    lines: string[];
}

@injectable()
export class OutputChannelBackendManager {
    protected static LINES_TO_KEEP = 5000;
    protected static REMOVAL_SIZE = 100;

    protected readonly channelAdded = new Emitter<ChannelNameAndGroup>();
    get onChannelAdded(): Event<ChannelNameAndGroup> {
        return this.channelAdded.event;
    }

    protected readonly lineAdded = new Emitter<ChannelNameAndLine>();
    get onLineAdded(): Event<ChannelNameAndLine> {
        return this.lineAdded.event;
    }

    private channels: Map<string, ChannelData> = new Map();

    getChannelData(channelName: string): ChannelData | undefined {
        return this.channels.get(channelName);
    }

    async getChannels(): Promise<{ name: string, group: string }[]> {
        return Array.from(this.channels.entries()).map(([key, value]) =>
            ({ name: key, group: value.group })
        );
    }

    getChannel(channelName: string, group: string = 'default'): LogOutputChannel {
        const outer = this;
        return {
            appendLine(line: string): void {
                outer.appendLine(line, channelName, group);
            }
        };
    }

    protected appendLine(line: string, channelName: string, group: string): void {
        let data = this.channels.get(channelName);
        if (!data) {
            data = { group, lines: [] };
            this.channels.set(channelName, data);
            this.channelAdded.fire({ channelName, group });
        }

        this.lineAdded.fire({ channelName, line });

        // Store on the backend for future clients
        data.lines.push(line);
        if (data.lines.length > OutputChannelBackendManager.LINES_TO_KEEP + OutputChannelBackendManager.REMOVAL_SIZE) {
            data.lines = data.lines.slice(OutputChannelBackendManager.REMOVAL_SIZE);
        }
    }
}
