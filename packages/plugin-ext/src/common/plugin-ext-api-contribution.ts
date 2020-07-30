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
import { RPCProtocol } from './rpc-protocol';
import { PluginManager, Plugin } from './plugin-api-rpc';
import { interfaces } from 'inversify';
import { KeyValueStorageProxy } from '../plugin/plugin-storage';

export const ExtPluginApiProvider = 'extPluginApi';
/**
 * Provider for extension API description
 */
export interface ExtPluginApiProvider {
    /**
     * Provide API description
     */
    provideApi(): ExtPluginApi;
}

/**
 * Plugin API extension description.
 * This interface describes scripts for both plugin runtimes: frontend(WebWorker) and backend(NodeJs)
 */
export interface ExtPluginApi {
    readonly id: string;

    /**
     * Path to the script which should be loaded to provide api, module should export `provideApi` function with
     * [ExtPluginApiBackendInitializationFn](#ExtPluginApiBackendInitializationFn) signature
     */
    backendInitPath?: string;

    /**
     * Initialization information for frontend part of Plugin API
     */
    frontendExtApi?: FrontendExtPluginApi;
}

export interface ExtPluginApiFrontendInitializationFn {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rpc: RPCProtocol, pluginManager: PluginManager, storageProxy: KeyValueStorageProxy, plugins: Map<string, Plugin>, initParams?: any): void;
}

export interface ExtPluginApiBackendInitializationFn {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rpc: RPCProtocol, pluginManager: PluginManager, storageProxy: KeyValueStorageProxy, initParams?: any): void;
}

/**
 * Interface contains information for frontend(WebWorker) Plugin API extension initialization
 */
export interface FrontendExtPluginApi {
    /**
     * path to js file
     */
    initPath: string;
    /** global variable name */
    initVariable: string;
    /**
     * init function name,
     * function should have  [ExtPluginApiFrontendInitializationFn](#ExtPluginApiFrontendInitializationFn)
     */
    initFunction: string;
}

export const MainPluginApiProvider = Symbol('mainPluginApi');

/**
 * Implementation should contains main(Theia) part of new namespace in Plugin API.
 * [initialize](#initialize) will be called once per plugin runtime
 */
export interface MainPluginApiProvider {
    readonly id: string;
    initialize(rpc: RPCProtocol, container: interfaces.Container): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    computeInitParameters?(rpc: RPCProtocol, container: interfaces.Container): Promise<any>;
}
