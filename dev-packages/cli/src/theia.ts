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

import * as temp from 'temp';
import * as yargs from 'yargs';
import { ApplicationPackageManager, rebuild } from '@theia/application-manager';
import { ApplicationProps } from '@theia/application-package';
import checkHoisted from './check-hoisting';
import downloadPlugins from './download-plugins';
import runTest from './run-test';

process.on('unhandledRejection', (reason, promise) => {
    throw reason;
});
process.on('uncaughtException', error => {
    if (error) {
        console.error('Uncaught Exception: ', error.toString());
        if (error.stack) {
            console.error(error.stack);
        }
    }
});

function commandArgs(arg: string): string[] {
    const restIndex = process.argv.indexOf(arg);
    return restIndex !== -1 ? process.argv.slice(restIndex + 1) : [];
}

function rebuildCommand(command: string, target: ApplicationProps.Target): yargs.CommandModule<unknown, { modules: string[], cacheRoot?: string }> {
    return {
        command,
        describe: `rebuild/revert native node modules for "${target}"`,
        builder: {
            'modules': {
                array: true,
                describe: 'list of modules to rebuild/revert'
            },
            'cacheRoot': {
                type: 'string',
                describe: 'root folder where to store the .browser_modules cache'
            }
        },
        handler: args => {
            try {
                rebuild(target, args);
            } catch (err) {
                console.error(err);
                process.exit(1);
            }
        }
    };
}

(function (): void {
    const projectPath = process.cwd();
    const appTarget = yargs.argv['app-target'] as ApplicationProps.Target;
    const manager = new ApplicationPackageManager({ projectPath, appTarget });
    const target = manager.pck.target;

    yargs
        .command({
            command: 'start',
            describe: 'start the ' + manager.pck.target + ' backend',
            handler: async () => {
                try {
                    manager.start(commandArgs('start'));
                } catch (err) {
                    console.error(err);
                    process.exit(1);
                }
            }
        })
        .command({
            command: 'clean',
            describe: 'clean for the ' + target + ' target',
            handler: () => {
                try {
                    manager.clean();
                } catch (err) {
                    console.error(err);
                    process.exit(1);
                }
            }
        })
        .command({
            command: 'copy',
            handler: () => {
                try {
                    manager.copy();
                } catch (err) {
                    console.error(err);
                    process.exit(1);
                }
            }
        })
        .command({
            command: 'generate',
            handler: () => {
                try {
                    manager.generate();
                } catch (err) {
                    console.error(err);
                    process.exit(1);
                }
            }
        })
        .command({
            command: 'build',
            describe: 'webpack the ' + target + ' frontend',
            handler: async () => {
                try {
                    await manager.build(commandArgs('build'));
                } catch (err) {
                    console.error(err);
                    process.exit(1);
                }
            }
        })
        .command(rebuildCommand('rebuild', target))
        .command(rebuildCommand('rebuild:browser', 'browser'))
        .command(rebuildCommand('rebuild:electron', 'electron'))
        .command<{ suppress: boolean }>({
            command: 'check:hoisted',
            describe: 'check that all dependencies are hoisted',
            builder: {
                'suppress': {
                    alias: 's',
                    describe: 'suppress exiting with failure code',
                    boolean: true,
                    default: false
                }
            },
            handler: args => {
                try {
                    checkHoisted(args);
                } catch (err) {
                    console.error(err);
                    process.exit(1);
                }
            }
        })
        .command<{ packed: boolean }>({
            command: 'download:plugins',
            describe: 'Download defined external plugins.',
            builder: {
                'packed': {
                    alias: 'p',
                    describe: 'Controls whether to pack or unpack plugins',
                    boolean: true,
                    default: false,
                },
                'ignore-errors': {
                    alias: 'i',
                    describe: 'Ignore errors while downloading plugins',
                    boolean: true,
                    default: false,
                },
                'api-version': {
                    alias: 'v',
                    describe: 'Supported API version for plugins',
                    default: '1.50.0'
                },
                'api-url': {
                    alias: 'u',
                    describe: 'Open-VSX Registry API URL',
                    default: 'https://open-vsx.org/api'
                }
            },
            handler: async args => {
                try {
                    await downloadPlugins(args);
                } catch (err) {
                    console.error(err);
                    process.exit(1);
                }
            },
        }).command<{
            testInspect: boolean,
            testExtension: string[],
            testFile: string[],
            testIgnore: string[],
            testRecursive: boolean,
            testSort: boolean,
            testSpec: string[],
            testCoverage: boolean
        }>({
            command: 'test',
            builder: {
                'test-inspect': {
                    describe: 'Whether to auto-open a DevTools panel for test page.',
                    boolean: true,
                    default: false
                },
                'test-extension': {
                    describe: 'Test file extension(s) to load',
                    array: true,
                    default: ['js']
                },
                'test-file': {
                    describe: 'Specify test file(s) to be loaded prior to root suite execution',
                    array: true,
                    default: []
                },
                'test-ignore': {
                    describe: 'Ignore test file(s) or glob pattern(s)',
                    array: true,
                    default: []
                },
                'test-recursive': {
                    describe: 'Look for tests in subdirectories',
                    boolean: true,
                    default: false
                },
                'test-sort': {
                    describe: 'Sort test files',
                    boolean: true,
                    default: false
                },
                'test-spec': {
                    describe: 'One or more test files, directories, or globs to test',
                    array: true,
                    default: ['test']
                },
                'test-coverage': {
                    describe: 'Report test coverage consumable by istanbul',
                    boolean: true,
                    default: false
                }
            },
            handler: async ({ testInspect, testExtension, testFile, testIgnore, testRecursive, testSort, testSpec, testCoverage }) => {
                try {
                    if (!process.env.THEIA_CONFIG_DIR) {
                        process.env.THEIA_CONFIG_DIR = temp.track().mkdirSync('theia-test-config-dir');
                    }
                    await runTest({
                        start: async () => new Promise((resolve, reject) => {
                            const serverArgs = commandArgs('test').filter(a => a.indexOf('--test-') !== 0);
                            const serverProcess = manager.start(serverArgs);
                            serverProcess.on('message', resolve);
                            serverProcess.on('error', reject);
                            serverProcess.on('close', code => reject(`Server process exited unexpectedly with ${code} code`));
                        }),
                        launch: {
                            args: ['--no-sandbox'],
                            devtools: testInspect
                        },
                        files: {
                            extension: testExtension,
                            file: testFile,
                            ignore: testIgnore,
                            recursive: testRecursive,
                            sort: testSort,
                            spec: testSpec
                        },
                        coverage: testCoverage
                    });
                } catch (e) {
                    console.error(e);
                    process.exit(1);
                }
            }
        });

    // see https://github.com/yargs/yargs/issues/287#issuecomment-314463783
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commands = (yargs as any).getCommandInstance().getCommands();
    const argv = yargs.demandCommand(1).argv;
    const command = argv._[0];
    if (!command || commands.indexOf(command) === -1) {
        console.log('non-existing or no command specified');
        yargs.showHelp();
        process.exit(1);
    } else {
        yargs.help(false);
    }
})();
