/********************************************************************************
 * Copyright (C) 2015-2018 Red Hat, Inc.
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

import * as theia from '@theia/plugin';
import * as path from 'path';
import { BackendInitializationFn } from '../../../common/plugin-protocol';
import { PluginAPIFactory, Plugin, emptyPlugin } from '../../../common/plugin-api-rpc';

const pluginsApiImpl = new Map<string, typeof theia>();
const plugins = new Array<Plugin>();
let defaultApi: typeof theia;
let isLoadOverride = false;
let pluginApiFactory: PluginAPIFactory;

export const doInitialization: BackendInitializationFn = (apiFactory: PluginAPIFactory, plugin: Plugin) => {

    const apiImpl = apiFactory(plugin);
    pluginsApiImpl.set(plugin.model.id, apiImpl);

    plugins.push(plugin);
    pluginApiFactory = apiFactory;

    if (!isLoadOverride) {
        overrideInternalLoad();
        isLoadOverride = true;
    }

};

function overrideInternalLoad(): void {
    const module = require('module');
    // save original load method
    const internalLoad = module._load;

    // if we try to resolve theia module, return the filename entry to use cache.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    module._load = function (request: string, parent: any, isMain: {}): any {
        if (request !== '@theia/plugin') {
            return internalLoad.apply(this, arguments);
        }

        const plugin = findPlugin(parent.filename);
        if (plugin) {
            const apiImpl = pluginsApiImpl.get(plugin.model.id);
            return apiImpl;
        }

        if (!defaultApi) {
            console.warn(`Could not identify plugin for 'Theia' require call from ${parent.filename}`);
            defaultApi = pluginApiFactory(emptyPlugin);
        }

        return defaultApi;
    };
}

function findPlugin(filePath: string): Plugin | undefined {
    return plugins.find(plugin => filePath.startsWith(plugin.pluginFolder.endsWith(path.sep) ? plugin.pluginFolder : plugin.pluginFolder + path.sep));
}
