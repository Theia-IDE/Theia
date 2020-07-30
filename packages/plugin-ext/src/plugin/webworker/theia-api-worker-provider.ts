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
import { Plugin, emptyPlugin, PluginManager } from '../../common/plugin-api-rpc';
import { ExtPluginApiFrontendInitializationFn } from '../../common/plugin-ext-api-contribution';
import { RPCProtocol } from '../../common/rpc-protocol';
import * as theia from '@theia/plugin';
import { createAPIFactory } from '../plugin-context';
import { KeyValueStorageProxy } from '../plugin-storage';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = self as any;
const pluginsApiImpl = new Map<string, typeof theia>();
let defaultApi: typeof theia;

export const initializeApi: ExtPluginApiFrontendInitializationFn = (rpc: RPCProtocol, pluginManager: PluginManager,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storageProxy: KeyValueStorageProxy, plugins: Map<string, Plugin>, initParams?: any) => {
    const theiaApiFactory = createAPIFactory(pluginManager, rpc, storageProxy, initParams);
    const handler = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get: (target: any, name: string) => {
            const plugin = plugins.get(name);
            if (plugin) {
                let apiImpl = pluginsApiImpl.get(plugin.model.id);
                if (!apiImpl) {
                    apiImpl = theiaApiFactory(plugin);
                    pluginsApiImpl.set(plugin.model.id, apiImpl);
                }
                return apiImpl;
            }

            if (!defaultApi) {
                defaultApi = theiaApiFactory(emptyPlugin);
            }

            return defaultApi;
        }
    };

    // eslint-disable-next-line no-null/no-null
    ctx['theia'] = new Proxy(Object.create(null), handler);
};
