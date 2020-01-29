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

import { inject, injectable, postConstruct } from 'inversify';
import { Message } from '@theia/core/lib/browser';
import { OutputChannel } from '../common/output-channel';
import { OutputChannelReaders } from './output-channel-readers';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import * as React from 'react';

import '../../src/browser/style/output.css';

export const OUTPUT_WIDGET_KIND = 'outputView';

@injectable()
export class OutputWidget extends ReactWidget {

    @inject(OutputChannelReaders)
    protected readonly outputChannelManager: OutputChannelReaders;

    constructor() {
        super();
        this.id = OUTPUT_WIDGET_KIND;
        this.title.label = 'Output';
        this.title.caption = 'Output';
        this.title.iconClass = 'fa output-tab-icon';
        this.title.closable = true;
        this.addClass('theia-output');
        this.node.tabIndex = 0;
    }

    @postConstruct()
    protected init(): void {
        const channels = this.outputChannelManager.getChannels();
        channels.forEach(this.registerNameAndGroup.bind(this));
        this.toDispose.push(this.outputChannelManager.onDidAddChannel(channel => {
            this.registerListener(channel);
            this.update();
        }));
        this.toDispose.push(this.outputChannelManager.onDidChangeSelection(event => {
            this.update();
        }));
        this.update();
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        const channelSelector = document.getElementById(OutputWidget.IDs.CHANNEL_LIST);
        if (channelSelector) {
            channelSelector.focus();
        } else {
            this.node.focus();
        }
    }

    protected registerNameAndGroup(channelInfo: { name: string, group: string }): void {
        const channel: OutputChannel = this.outputChannelManager.getChannel(channelInfo.name);
        this.registerListener(channel);
    }

    protected registerListener(outputChannel: OutputChannel): void {
        this.toDispose.push(outputChannel.onContentChange(c => {
            if (outputChannel === this.outputChannelManager.selectedChannel) {
                this.update();
            }
        }));
    }

    protected render(): React.ReactNode {
        return <React.Fragment>
            {this.renderChannelContents()}
        </React.Fragment>;
    }

    clear(): void {
        if (this.outputChannelManager.selectedChannel) {
            this.outputChannelManager.selectedChannel.clear();
        }
    }

    protected renderChannelContents(): React.ReactNode {
        return <div id={OutputWidget.IDs.CONTENTS}>{this.renderLines()}</div>;
    }

    protected renderLines(): React.ReactNode[] {
        let id = 0;
        const result = [];

        const style: React.CSSProperties = {
            whiteSpace: 'pre',
            fontFamily: 'monospace',
        };

        if (this.outputChannelManager.selectedChannel) {
            for (const text of this.outputChannelManager.selectedChannel.getLines()) {
                const lines = text.split(/[\n\r]+/);
                for (const line of lines) {
                    result.push(<div style={style} key={id++}>{line}</div>);
                }
            }
        }
        if (result.length === 0) {
            result.push(<div style={style} key={id++}>{'<no output yet>'}</div>);
        }
        return result;
    }

    protected onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        setTimeout(() => {
            const div = document.getElementById(OutputWidget.IDs.CONTENTS) as HTMLDivElement;
            if (div && div.children.length > 0) {
                div.children[div.children.length - 1].scrollIntoView(false);
            }
        });
    }
}

export namespace OutputWidget {
    export namespace IDs {
        export const CONTENTS = 'outputContents';
        export const CHANNEL_LIST = 'outputChannelList';
    }
}
