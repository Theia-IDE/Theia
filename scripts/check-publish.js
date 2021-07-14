/********************************************************************************
 * Copyright (c) 2019 TypeFox and others
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
// @ts-check

const path = require('path');
const chalk = require('chalk').default;
const cp = require('child_process');
const fs = require('fs');

checkPublish().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

async function checkPublish() {
    const workspaces = JSON.parse(cp.execSync('yarn --silent workspaces info').toString());
    await Promise.all(Object.values(workspaces).map(async workspace => {
        const packagePath = path.resolve(workspace.location, 'package.json');
        const pck = JSON.parse(await fs.promises.readFile(packagePath, 'utf8'));
        if (!pck.private) {
            const pckName = `${pck.name}@${pck.version}`;
            const npmViewOutput = await new Promise(
                resolve => cp.exec(`npm view ${pckName} version --json`,
                    (error, stdout, stderr) => {
                        if (error) {
                            console.error(error);
                            resolve('');
                        } else {
                            resolve(stdout.trim());
                        }
                    }
                )
            );
            if (npmViewOutput) {
                console.info(`${pckName}: published`);
            } else {
                console.error(`(${chalk.red('ERR')}) ${pckName}: ${chalk.red('NOT')} published`);
                process.exitCode = 1;
            }
        }
    }));
}
