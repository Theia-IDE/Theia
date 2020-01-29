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

import { Emitter } from '@theia/core';
import { injectable, inject } from 'inversify';
import { OutputPreferences } from '../common/output-preferences';
import { OutputChannel, OutputChannelManager, OutputOptions } from '../common/output-channel';

@injectable()
export class OutputChannelManagerClient implements OutputChannelManager {
    protected readonly channels = new Map<string, OutputChannel>();

    protected readonly channelDeleteEmitter = new Emitter<{ channelName: string }>();
    protected readonly channelAddedEmitter = new Emitter<OutputChannel>();
    readonly onDidDeleteChannel = this.channelDeleteEmitter.event;
    readonly onDidAddChannel = this.channelAddedEmitter.event;

    constructor(
        @inject(OutputPreferences) protected preferences: OutputPreferences) {
    }

    getChannel(name: string, options: OutputOptions = { group: 'default' }): OutputChannel {
        const existing = this.channels.get(name);
        if (existing) {
            return existing;
        }
        const channel = new OutputChannel(name, this.preferences, options);
        this.channels.set(name, channel);
        this.channelAddedEmitter.fire(channel);
        return channel;
    }

    deleteChannel(name: string): void {
        this.channels.delete(name);
        this.channelDeleteEmitter.fire({ channelName: name });
    }

    getChannels(): OutputChannel[] {
        return Array.from(this.channels.values());
    }
}
