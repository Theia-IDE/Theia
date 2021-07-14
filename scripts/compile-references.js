// @ts-check
'use-strict';

/********************************************************************************
 * Copyright (C) 2020 Ericsson and others.
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

/**
 * This script generates tsconfig references between our workspaces.
 *
 * `tsc` build mode relies on these references to build out of date dependencies
 * only when required, but it cannot infer workspaces by itself, it has to be
 * explicitly defined [1].
 *
 * [1]: https://www.typescriptlang.org/docs/handbook/project-references.html
 */


const cp = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

const FORCE_REWRITE = process.argv.includes('--force-rewrite');

/** @type {{ [packageName: string]: YarnWorkspace }} */
const YARN_WORKSPACES = JSON.parse(cp.execSync('yarn --silent workspaces info', { cwd: ROOT }).toString());

// Add the package name inside each package object.
for (const [packageName, yarnWorkspace] of Object.entries(YARN_WORKSPACES)) {
    yarnWorkspace.name = packageName;
}

/** @type {YarnWorkspace} */
const THEIA_MONOREPO = {
    name: '@theia/monorepo',
    workspaceDependencies: Object.keys(YARN_WORKSPACES),
    location: '.',
};

compileTypeScriptReferences().catch(error => {
    console.error(error);
    process.exitCode = 1;
})

/**
 * This script main entry point.
 */
async function compileTypeScriptReferences() {
    await Promise.all([THEIA_MONOREPO, ...Object.values(YARN_WORKSPACES)].map(async package => {
        const references = await getTypescriptReferences(package);
        await configureTypeScriptReferences(package, references);
    }))
}

/**
 * @param {YarnWorkspace} requestedPackage
 * @returns {Promise<string[]>} TypeScript relative project references for `requestedPackage`.
 */
async function getTypescriptReferences(requestedPackage) {
    const references = await Promise.all((requestedPackage.workspaceDependencies || []).map(async dependency => {
        const depWorkspace = YARN_WORKSPACES[dependency];
        const depConfig = path.join(ROOT, depWorkspace.location, 'tsconfig.json');
        if (!await fileExists(depConfig)) {
            return undefined; // ignore because dep has no tsconfig
        }
        return path.posix.relative(requestedPackage.location, depWorkspace.location);
    }));
    return references.filter(reference => reference !== undefined);
}

/**
 * Wires a given compilation tsconfig file according to the provided references.
 * This allows TypeScript to operate in build mode.
 *
 * @param {YarnWorkspace} targetPackage for debug purpose.
 * @param {string[]} expectedReferences list of paths to the related project roots.
 * @returns {Promise<boolean>} rewrite was needed.
 */
async function configureTypeScriptReferences(targetPackage, expectedReferences) {
    expectedReferences = [...expectedReferences].sort();
    let needRewrite = FORCE_REWRITE;
    const tsconfigPath = path.resolve(ROOT, targetPackage.location, 'tsconfig.json');
    if (!await fileExists(tsconfigPath)) {
        return false;
    }
    const tsconfigJson = await readJsonFile(tsconfigPath);
    if (!tsconfigJson.compilerOptions) {
        // Somehow no `compilerOptions` literal is defined.
        tsconfigJson.compilerOptions = {
            composite: true,
            rootDir: 'src',
            outDir: 'lib',
        };
        needRewrite = true;
    } else if (!tsconfigJson.compilerOptions.composite) {
        // `compilerOptions` is missing the `composite` literal.
        tsconfigJson.compilerOptions = {
            composite: true,
            ...tsconfigJson.compilerOptions,
        };
        needRewrite = true;
    }
    /** @type {string[]} */
    const currentReferences = (tsconfigJson['references'] || []).map(reference => reference.path);
    // Compare both arrays: if an element is not the same we need to rewrite.
    needRewrite = needRewrite || currentReferences.some((reference, index) => expectedReferences[index] !== reference);
    if (needRewrite) {
        tsconfigJson.references = expectedReferences.map(path => ({ path }));
        const content = JSON.stringify(tsconfigJson, undefined, 2);
        await fs.promises.writeFile(tsconfigPath, content + '\n');
        console.warn(`info: ${tsconfigPath} updated.`);
    }
    return needRewrite;
}

/**
 * @param {string} filePath
 * @returns {Promise<any>}
 */
async function readJsonFile(filePath) {
    try {
        return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
    } catch (error) {
        console.error('ParseError in file:', filePath);
        throw error;
    }
}

/**
 * @param {string} file
 * @returns {Promise<boolean>}
 */
function fileExists(file) {
    return fs.promises.access(file, fs.constants.R_OK | fs.constants.W_OK)
        .then(ok => true, error => false)
}

/**
 * @typedef YarnWorkspace
 * @property {string} name
 * @property {string} location
 * @property {string[]} [workspaceDependencies]
 */
