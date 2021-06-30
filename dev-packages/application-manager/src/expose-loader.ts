/********************************************************************************
 * Copyright (C) 2020 TypeFox and others.
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

import * as fs from 'fs-extra';
import * as path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import type { RawSourceMap } from 'source-map';
import { ApplicationPackage } from '@theia/application-package/lib/application-package';

const modulePackages: { dir: string, name?: string }[] = [];
for (const extensionPackage of new ApplicationPackage({ projectPath: process.cwd() }).extensionPackages) {
    modulePackages.push({
        name: extensionPackage.name,
        dir: path.dirname(extensionPackage.raw.installed!.packagePath)
    });
}

function exposeModule(modulePackage: { dir: string, name?: string }, resourcePath: string, source: string): string {
    if (!modulePackage.name) {
        return source;
    }
    const { dir, name } = path.parse(resourcePath);
    let moduleName = path.join(modulePackage.name, dir.substring(modulePackage.dir.length));
    if (name !== 'index') {
        moduleName = path.join(moduleName, name);
    }
    if (path.sep !== '/') {
        moduleName = moduleName.split(path.sep).join('/');
    }
    return source + `\nif (!global) global = {};\n(global['theia'] = global['theia'] || {})['${moduleName}'] = this;\n`;
}

/**
 * Expose bundled modules on window.theia.moduleName namespace, e.g.
 * window['theia']['@theia/core/lib/common/uri'].
 * Such syntax can be used by external code, for instance, for testing.
 */
// TODO: webpack@5.36.2 is missing a `LoaderContext` interface so we'll use any in the meantime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export = function (this: any, source: string, sourceMap?: RawSourceMap): string | undefined {
    if (this.cacheable) {
        this.cacheable();
    }
    let modulePackage = modulePackages.find(({ dir }) => this.resourcePath.startsWith(dir + path.sep));
    if (modulePackage) {
        this.callback(undefined, exposeModule(modulePackage, this.resourcePath, source), sourceMap);
        return;
    }
    const searchString = path.sep + 'node_modules';
    const index = this.resourcePath.lastIndexOf(searchString);
    if (index !== -1) {
        const nodeModulesPath = this.resourcePath.substring(0, index + searchString.length);
        let dir = this.resourcePath;
        while ((dir = path.dirname(dir)) !== nodeModulesPath) {
            try {
                const { name } = fs.readJSONSync(path.join(dir, 'package.json'));
                modulePackage = { name, dir };
                modulePackages.push(modulePackage);
                this.callback(undefined, exposeModule(modulePackage, this.resourcePath, source), sourceMap);
                return;
            } catch {
                /** no-op */
            }
        }
    }
    this.callback(undefined, source, sourceMap);
};
