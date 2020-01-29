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

export const OutputChannelBackendService = Symbol('OutputChannelBackendService');
export const outputChannelBackendServicePath = '/services/outputChannelBackendService';

export interface OutputChannelBackendService {
    getChannels(): Promise<{ name: string, group: string }[]>;
    requestToSendContent(channelName: string): Promise<void>;
}

export const OutputChannelFrontendService = Symbol('OutputChannelFrontendService');
export const outputChannelFrontendServicePath = '/services/outputChannelFrontendService';

export interface OutputChannelFrontendService {
    onChannelAdded(channelName: string, group: string): void;
    onChannelDeleted(channelName: string): void;
    onProcessOutput(line: string, channelName: string): void;
}
