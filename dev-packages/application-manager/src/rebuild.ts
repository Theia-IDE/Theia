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

import fs = require('fs-extra');
import path = require('path');

export function rebuild(target: 'electron' | 'browser', modules: string[] | undefined): void {
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    const browserModulesPath = path.join(process.cwd(), '.browser_modules');
    const modulesToProcess = modules || ['@theia/node-pty', 'nsfw', 'native-keymap', 'find-git-repositories', 'drivelist', 'keytar'];

    if (target === 'electron' && !fs.existsSync(browserModulesPath)) {
        const dependencies: {
            [dependency: string]: string
        } = {};
        for (const module of modulesToProcess) {
            console.log('Processing ' + module);
            const src = path.join(nodeModulesPath, module);
            if (fs.existsSync(src)) {
                const dest = path.join(browserModulesPath, module);
                const packJson = fs.readJsonSync(path.join(src, 'package.json'));
                dependencies[module] = packJson.version;
                fs.copySync(src, dest);
            }
        }
        const packFile = path.join(process.cwd(), 'package.json');
        const packageText = fs.readFileSync(packFile);
        const pack = fs.readJsonSync(packFile);
        try {
            pack.dependencies = Object.assign({}, pack.dependencies, dependencies);
            fs.writeFileSync(packFile, JSON.stringify(pack, undefined, '  '));
            const electronRebuildPackageJson = require('electron-rebuild/package.json');
            require(`electron-rebuild/${electronRebuildPackageJson['bin']['electron-rebuild']}`);
        } finally {
            setTimeout(() => {
                fs.writeFile(packFile, packageText);
            }, 100);
        }
    } else if (target === 'browser' && fs.existsSync(browserModulesPath)) {
        for (const moduleName of collectModulePaths(browserModulesPath)) {
            console.log('Reverting ' + moduleName);
            const src = path.join(browserModulesPath, moduleName);
            const dest = path.join(nodeModulesPath, moduleName);
            fs.removeSync(dest);
            fs.copySync(src, dest);
        }
        fs.removeSync(browserModulesPath);
    } else {
        console.log('native node modules are already rebuilt for ' + target);
    }
}

function collectModulePaths(root: string): string[] {
    const moduleRelativePaths: string[] = [];
    for (const dirName of fs.readdirSync(root)) {
        if (fs.existsSync(path.join(root, dirName, 'package.json'))) {
            moduleRelativePaths.push(dirName);
        } else if (fs.lstatSync(path.join(root, dirName)).isDirectory()) {
            moduleRelativePaths.push(...collectModulePaths(path.join(root, dirName)).map(p => path.join(dirName, p)));
        }
    }
    return moduleRelativePaths;
}
