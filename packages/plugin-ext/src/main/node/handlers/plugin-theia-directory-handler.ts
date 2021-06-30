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

import {
    PluginDeployerDirectoryHandler,
    PluginDeployerEntry, PluginPackage, PluginDeployerDirectoryHandlerContext,
    PluginDeployerEntryType
} from '../../../common/plugin-protocol';
import { injectable } from '@theia/core/shared/inversify';
import * as fs from '@theia/core/shared/fs-extra';
import * as path from 'path';

@injectable()
export class PluginTheiaDirectoryHandler implements PluginDeployerDirectoryHandler {

    accept(resolvedPlugin: PluginDeployerEntry): boolean {

        console.log('PluginTheiaDirectoryHandler: accepting plugin with path', resolvedPlugin.path());

        // handle only directories
        if (resolvedPlugin.isFile()) {
            return false;
        }

        // is there a package.json ?
        const packageJsonPath = path.resolve(resolvedPlugin.path(), 'package.json');
        const existsPackageJson: boolean = fs.existsSync(packageJsonPath);
        if (!existsPackageJson) {
            return false;
        }

        let packageJson: PluginPackage = resolvedPlugin.getValue('package.json');
        if (!packageJson) {
            packageJson = fs.readJSONSync(packageJsonPath);
            resolvedPlugin.storeValue('package.json', packageJson);
        }

        if (!packageJson.engines) {
            return false;
        }

        if (packageJson.engines && packageJson.engines.theiaPlugin) {
            return true;
        }

        return false;

    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handle(context: PluginDeployerDirectoryHandlerContext): Promise<any> {
        const types: PluginDeployerEntryType[] = [];
        const packageJson: PluginPackage = context.pluginEntry().getValue('package.json');
        if (packageJson.theiaPlugin && packageJson.theiaPlugin.backend) {
            types.push(PluginDeployerEntryType.BACKEND);
        }
        if (packageJson.theiaPlugin && packageJson.theiaPlugin.frontend) {
            types.push(PluginDeployerEntryType.FRONTEND);
        }

        context.pluginEntry().accept(...types);
        return Promise.resolve(true);
    }
}
