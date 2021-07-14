/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
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

import cp = require('child_process');
import fs = require('fs-extra');
import path = require('path');

export type RebuildTarget = 'electron' | 'browser';

export const DEFAULT_MODULES = [
    '@theia/node-pty',
    'nsfw',
    'native-keymap',
    'find-git-repositories',
    'drivelist',
];

export interface RebuildOptions {
    /**
     * What modules to rebuild.
     */
    modules?: string[]
    /**
     * Folder where the module cache will be created/read from.
     */
    cacheRoot?: string
}

/**
 * @param target What to rebuild for.
 * @param options
 */
export function rebuild(target: RebuildTarget, options: RebuildOptions = {}): void {
    const {
        modules = DEFAULT_MODULES,
        cacheRoot = process.cwd(),
    } = options;
    const cache = path.resolve(cacheRoot, '.browser_modules');
    const cacheExists = folderExists(cache);
    if (target === 'electron' && !cacheExists) {
        rebuildElectronModules(cache, modules);
    } else if (target === 'browser' && cacheExists) {
        revertBrowserModules(cache, modules);
    } else {
        console.log(`native node modules are already rebuilt for ${target}`);
    }
}

function folderExists(folder: string): boolean {
    if (fs.existsSync(folder)) {
        if (fs.statSync(folder).isDirectory()) {
            return true;
        } else {
            throw new Error(`"${folder}" exists but it is not a directory`);
        }
    }
    return false;
}

/**
 * Schema for `<browserModuleCache>/modules.json`
 */
interface ModulesJson {
    [moduleName: string]: ModuleBackup
}
interface ModuleBackup {
    originalLocation: string
}

async function rebuildElectronModules(browserModuleCache: string, modules: string[]): Promise<void> {
    const modulesJsonPath = path.join(browserModuleCache, 'modules.json');
    const modulesJson: ModulesJson = await fs.access(modulesJsonPath).then(
        exists => fs.readJSON(modulesJsonPath),
        missing => ({})
    );
    let success = true;
    // backup already-built browser modules
    await Promise.all(modules.map(async module => {
        const src = path.dirname(require.resolve(`${module}/package.json`, {
            paths: [process.cwd()],
        }));
        const dest = path.join(browserModuleCache, module);
        try {
            await fs.remove(dest);
            await fs.copy(src, dest);
            modulesJson[module] = {
                originalLocation: src,
            };
            console.debug(`Processed "${module}"`);
        } catch (error) {
            console.error(`Error while doing a backup for "${module}": ${error}`);
            success = false;
        }
    }));
    // update manifest tracking the backups original locations
    await fs.writeJSON(modulesJsonPath, modulesJson, { spaces: 2 });
    // if we failed to process a module then exit now
    if (!success) {
        process.exit(1);
    }
    // rebuild for electron
    await new Promise<void>((resolve, reject) => {
        const electronRebuild = cp.spawn(`npx --no-install electron-rebuild --only="${modules.join(',')}"`, {
            stdio: 'inherit',
            shell: true,
        });
        electronRebuild.on('error', reject);
        electronRebuild.on('close', (code, signal) => {
            if (code || signal) {
                reject(`electron-rebuild exited with "${code || signal}"`);
            } else {
                resolve();
            }
        });
    });
}

async function revertBrowserModules(browserModuleCache: string, modules: string[]): Promise<void> {
    const modulesJsonPath = path.join(browserModuleCache, 'modules.json');
    const modulesJson: ModulesJson = await fs.readJSON(modulesJsonPath);
    await Promise.all(Object.entries(modulesJson).map(async ([moduleName, entry]) => {
        if (!modules.includes(moduleName)) {
            return; // skip modules that weren't requested
        }
        const src = path.join(browserModuleCache, moduleName);
        const dest = entry.originalLocation;
        try {
            await fs.remove(dest);
            await fs.copy(src, dest);
            await fs.remove(src);
            delete modulesJson[moduleName];
            console.debug(`Reverted "${moduleName}"`);
        } catch (error) {
            console.error(`Error while reverting "${moduleName}": ${error}`);
            process.exitCode = 1;
        }
    }));
    if (Object.keys(modulesJson).length === 0) {
        // we restored everything so we can delete the cache
        await fs.remove(browserModuleCache);
    } else {
        // some things were not restored so we update the manifest
        await fs.writeJSON(modulesJsonPath, modulesJson, { spaces: 2 });
    }
}
