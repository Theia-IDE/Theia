/********************************************************************************
 * Copyright (C) 2019 Red Hat, Inc. and others.
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

import { JsonRpcServer } from '@theia/core/lib/common/messaging/proxy-factory';
import { PluginMetadata } from '@theia/plugin-ext/lib/common/plugin-protocol';

export const pluginDevServicePath = '/services/plugin-dev';
export const PluginDevServer = Symbol('PluginDevServer');
export interface PluginDevServer extends JsonRpcServer<PluginDevClient> {
    getHostedPlugin(): Promise<PluginMetadata | undefined>;
    runHostedPluginInstance(uri: string): Promise<string>;
    runDebugHostedPluginInstance(uri: string, debugConfig: DebugConfiguration): Promise<string>;
    terminateHostedPluginInstance(): Promise<void>;
    isHostedPluginInstanceRunning(): Promise<boolean>;
    getHostedPluginInstanceURI(): Promise<string>;
    getHostedPluginURI(): Promise<string>;

    runWatchCompilation(uri: string): Promise<void>;
    stopWatchCompilation(uri: string): Promise<void>;
    isWatchCompilationRunning(uri: string): Promise<boolean>;

    isPluginValid(uri: string): Promise<boolean>;
}

export interface PluginDevClient {
}

export interface DebugConfiguration {
    port?: number;
    debugMode?: string;
}
