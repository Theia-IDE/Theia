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

import { injectable, inject, postConstruct } from 'inversify';
import { Disposable, DisposableCollection } from '@theia/core';
import { OutputChannelBackendService, OutputChannelFrontendService } from '../common/output-protocol';
import { OutputChannelBackendManager } from './output-channel-backend-manager';

@injectable()
export class OutputChannelBackendServiceImpl implements OutputChannelBackendService, Disposable {
    @inject(OutputChannelFrontendService) protected readonly frontendService: OutputChannelFrontendService;
    @inject(OutputChannelBackendManager) protected readonly underlyingServiceImpl: OutputChannelBackendManager;

    protected toDispose = new DisposableCollection();

    protected visibleChannels = new Set<string>();

    @postConstruct()
    init(): void {
        this.toDispose.push(this.underlyingServiceImpl.onChannelAdded(event => {
            this.frontendService.onChannelAdded(event.channelName, event.group);
        }));
        this.toDispose.push(this.underlyingServiceImpl.onLineAdded(event => {
            if (this.visibleChannels.has(event.channelName)) {
                this.frontendService.onProcessOutput(event.line, event.channelName);
            }
        }));
    }

    async getChannels(): Promise<{ name: string, group: string }[]> {
        return this.underlyingServiceImpl.getChannels();
    }

    async requestToSendContent(channelName: string): Promise<void> {
        const data = this.underlyingServiceImpl.getChannelData(channelName);
        if (data) {
            const linesToReturn = data.lines;
            data.lines = [];
            linesToReturn.forEach(line => {
                this.frontendService.onProcessOutput(line, channelName);
            });
            this.visibleChannels.add(channelName);
        }
    }

    dispose(): void {
        this.toDispose.dispose();
    }

}
