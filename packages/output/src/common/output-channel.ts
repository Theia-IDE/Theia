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

import { Emitter, Event } from '@theia/core';
import { OutputPreferences } from './output-preferences';

export const OutputChannelManager = Symbol('OutputChannelManager');

export interface OutputChannelManager {
    getChannel(name: string, options?: { group: string }): OutputChannel;
    deleteChannel(name: string): void;
    getChannels(): OutputChannel[];
}

export interface OutputOptions {
    group: string
}

export class OutputChannel {

    private readonly visibilityChangeEmitter = new Emitter<{ visible: boolean }>();
    private readonly contentChangeEmitter = new Emitter<OutputChannel>();
    private lines: string[] = [];
    private currentLine: string | undefined;
    private visible: boolean = true;

    readonly onVisibilityChange: Event<{ visible: boolean }> = this.visibilityChangeEmitter.event;
    readonly onContentChange: Event<OutputChannel> = this.contentChangeEmitter.event;

    constructor(readonly name: string, readonly preferences: OutputPreferences, readonly options: OutputOptions = { group: 'default' }) { }

    append(value: string): void {
        if (this.currentLine === undefined) {
            this.currentLine = value;
        } else {
            this.currentLine += value;
        }
        this.contentChangeEmitter.fire(this);
    }

    appendLine(line: string): void {
        if (this.currentLine !== undefined) {
            this.lines.push(this.currentLine + line);
            this.currentLine = undefined;
        } else {
            this.lines.push(line);
        }
        const maxChannelHistory = this.preferences['output.maxChannelHistory'];
        if (this.lines.length > maxChannelHistory) {
            this.lines.splice(0, this.lines.length - maxChannelHistory);
        }
        this.contentChangeEmitter.fire(this);
    }

    clear(): void {
        this.lines.length = 0;
        this.currentLine = undefined;
        this.contentChangeEmitter.fire(this);
    }

    setVisibility(visible: boolean): void {
        this.visible = visible;
        this.visibilityChangeEmitter.fire({ visible });
    }

    getLines(): string[] {
        if (this.currentLine !== undefined) {
            return [...this.lines, this.currentLine];
        } else {
            return this.lines;
        }
    }

    get isVisible(): boolean {
        return this.visible;
    }

    get group(): string {
        return this.options.group;
    }
}
