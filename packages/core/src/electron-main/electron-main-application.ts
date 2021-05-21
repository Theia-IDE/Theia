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

import { inject, injectable, named } from 'inversify';
import { screen, globalShortcut, app, BrowserWindow, BrowserWindowConstructorOptions, Event as ElectronEvent } from '../../shared/electron';
import * as path from 'path';
import { Argv } from 'yargs';
import { AddressInfo } from 'net';
import { promises as fs } from 'fs';
import { fork, ForkOptions } from 'child_process';
import { FrontendApplicationConfig } from '@theia/application-package/lib/application-props';
import URI from '../common/uri';
import { FileUri } from '../node/file-uri';
import { Deferred } from '../common/promise-util';
import { MaybePromise } from '../common/types';
import { ContributionProvider } from '../common/contribution-provider';
import { ElectronSecurityTokenService } from './electron-security-token-service';
import { ElectronSecurityToken } from '../electron-common/electron-token';
import Storage = require('electron-store');
import { DEFAULT_WINDOW_HASH } from '../browser/window/window-service';
const createYargs: (argv?: string[], cwd?: string) => Argv = require('yargs/yargs');

/**
 * Theia tracks the maximized state of Electron Browser Windows.
 */
export interface TheiaBrowserWindowOptions extends BrowserWindowConstructorOptions {
    isMaximized?: boolean;
}

/**
 * Options passed to the main/default command handler.
 */
export interface ElectronMainCommandOptions {

    /**
     * By default, the first positional argument. Should be either a relative or absolute file-system path pointing to a file or a folder.
     */
    readonly file?: string;

}

/**
 * Fields related to a launch event.
 *
 * This kind of event is triggered in two different contexts:
 *  1. The app is launched for the first time, `secondInstance` is false.
 *  2. The app is already running but user relaunches it, `secondInstance` is true.
 */
export interface ElectronMainExecutionParams {
    readonly secondInstance: boolean;
    readonly argv: string[];
    readonly cwd: string;
}

export const ElectronMainApplicationGlobals = Symbol('ElectronMainApplicationGlobals');
export interface ElectronMainApplicationGlobals {
    readonly THEIA_APP_PROJECT_PATH: string
    readonly THEIA_BACKEND_MAIN_PATH: string
    readonly THEIA_FRONTEND_HTML_PATH: string
}

/**
 * The default entrypoint will handle a very rudimentary CLI to open workspaces by doing `app path/to/workspace`. To override this behavior, you can extend and rebind the
 * `ElectronMainApplication` class and overriding the `launch` method.
 * A JSON-RPC communication between the Electron Main Process and the Renderer Processes is available: You can bind services using the `ElectronConnectionHandler` and
 * `ElectronIpcConnectionProvider` APIs, example:
 *
 * From an `electron-main` module:
 *
 *     bind(ElectronConnectionHandler).toDynamicValue(context =>
 *          new JsonRpcConnectionHandler(electronMainWindowServicePath,
 *          () => context.container.get(ElectronMainWindowService))
 *     ).inSingletonScope();
 *
 * And from the `electron-browser` module:
 *
 *     bind(ElectronMainWindowService).toDynamicValue(context =>
 *          ElectronIpcConnectionProvider.createProxy(context.container, electronMainWindowServicePath)
 *     ).inSingletonScope();
 */
export const ElectronMainApplicationContribution = Symbol('ElectronMainApplicationContribution');
export interface ElectronMainApplicationContribution {
    /**
     * The application is ready and is starting. This is the time to initialize
     * services global to this process.
     *
     * Invoked when the electron-main process starts for the first time.
     */
    onStart?(application: ElectronMainApplication): MaybePromise<void>;
    /**
     * The application is stopping. Contributions must perform only synchronous operations.
     */
    onStop?(application: ElectronMainApplication): void;
}

// Extracted and modified the functionality from `yargs@15.4.0-beta.0`.
// Based on https://github.com/yargs/yargs/blob/522b019c9a50924605986a1e6e0cb716d47bcbca/lib/process-argv.ts
@injectable()
export class ElectronMainProcessArgv {

    protected get processArgvBinIndex(): number {
        // The binary name is the first command line argument for:
        // - bundled Electron apps: bin argv1 argv2 ... argvn
        if (this.isBundledElectronApp) {
            return 0;
        }
        // or the second one (default) for:
        // - standard node apps: node bin.js argv1 argv2 ... argvn
        // - unbundled Electron apps: electron bin.js argv1 arg2 ... argvn
        return 1;
    }

    protected get isBundledElectronApp(): boolean {
        // process.defaultApp is either set by electron in an electron unbundled app, or undefined
        // see https://github.com/electron/electron/blob/master/docs/api/process.md#processdefaultapp-readonly
        return this.isElectronApp && !(process as ElectronMainProcessArgv.ElectronMainProcess).defaultApp;
    }

    protected get isElectronApp(): boolean {
        // process.versions.electron is either set by electron, or undefined
        // see https://github.com/electron/electron/blob/master/docs/api/process.md#processversionselectron-readonly
        return !!(process as ElectronMainProcessArgv.ElectronMainProcess).versions.electron;
    }

    getProcessArgvWithoutBin(argv = process.argv): Array<string> {
        return argv.slice(this.processArgvBinIndex + 1);
    }

    getProcessArgvBin(argv = process.argv): string {
        return argv[this.processArgvBinIndex];
    }

}

export namespace ElectronMainProcessArgv {
    export interface ElectronMainProcess extends NodeJS.Process {
        readonly defaultApp: boolean;
        readonly versions: NodeJS.ProcessVersions & {
            readonly electron: string;
        };
    }
}

@injectable()
export class ElectronMainApplication {

    @inject(ContributionProvider)
    @named(ElectronMainApplicationContribution)
    protected readonly contributions: ContributionProvider<ElectronMainApplicationContribution>;

    @inject(ElectronMainApplicationGlobals)
    protected readonly globals: ElectronMainApplicationGlobals;

    @inject(ElectronMainProcessArgv)
    protected processArgv: ElectronMainProcessArgv;

    @inject(ElectronSecurityTokenService)
    protected electronSecurityTokenService: ElectronSecurityTokenService;

    @inject(ElectronSecurityToken)
    protected readonly electronSecurityToken: ElectronSecurityToken;

    protected readonly electronStore = new Storage();

    protected readonly _backendPort = new Deferred<number>();
    readonly backendPort = this._backendPort.promise;

    protected _config: FrontendApplicationConfig | undefined;
    get config(): FrontendApplicationConfig {
        if (!this._config) {
            throw new Error('You have to start the application first.');
        }
        return this._config;
    }

    async start(config: FrontendApplicationConfig): Promise<void> {
        this._config = config;
        this.hookApplicationEvents();
        const port = await this.startBackend();
        this._backendPort.resolve(port);
        await app.whenReady();
        await this.attachElectronSecurityToken(port);
        await this.startContributions();
        await this.launch({
            secondInstance: false,
            argv: this.processArgv.getProcessArgvWithoutBin(process.argv),
            cwd: process.cwd()
        });
    }

    protected async launch(params: ElectronMainExecutionParams): Promise<void> {
        createYargs(params.argv, params.cwd)
            .command('$0 [file]', false,
                cmd => cmd
                    .positional('file', { type: 'string' }),
                args => this.handleMainCommand(params, { file: args.file }),
            ).parse();
    }

    /**
     * Use this rather than creating `BrowserWindow` instances from scratch, since some security parameters need to be set, this method will do it.
     *
     * @param options
     */
    async createWindow(asyncOptions: MaybePromise<TheiaBrowserWindowOptions> = this.getDefaultBrowserWindowOptions()): Promise<BrowserWindow> {
        const options = await asyncOptions;
        const electronWindow = new BrowserWindow(options);
        this.attachReadyToShow(electronWindow);
        this.attachSaveWindowState(electronWindow);
        this.attachGlobalShortcuts(electronWindow);
        this.restoreMaximizedState(electronWindow, options);
        return electronWindow;
    }

    protected async getDefaultBrowserWindowOptions(): Promise<TheiaBrowserWindowOptions> {
        const windowOptionsFromConfig = this.config.electron?.windowOptions || {};
        let windowState: TheiaBrowserWindowOptions | undefined = this.electronStore.get('windowstate', undefined);
        if (!windowState) {
            windowState = this.getDefaultWindowState();
        }
        return {
            ...windowState,
            show: false,
            title: this.config.applicationName,
            minWidth: 200,
            minHeight: 120,
            webPreferences: {
                // https://github.com/eclipse-theia/theia/issues/2018
                nodeIntegration: true,
                // Setting the following option to `true` causes some features to break, somehow.
                // Issue: https://github.com/eclipse-theia/theia/issues/8577
                nodeIntegrationInWorker: false,
            },
            ...windowOptionsFromConfig,
        };
    }

    async openDefaultWindow(): Promise<BrowserWindow> {
        const [uri, electronWindow] = await Promise.all([this.createWindowUri(), this.createWindow()]);
        electronWindow.loadURL(uri.withFragment(DEFAULT_WINDOW_HASH).toString(true));
        return electronWindow;
    }

    protected async openWindowWithWorkspace(workspacePath: string): Promise<BrowserWindow> {
        const [uri, electronWindow] = await Promise.all([this.createWindowUri(), this.createWindow()]);
        electronWindow.loadURL(uri.withFragment(workspacePath).toString(true));
        return electronWindow;
    }

    /**
     * "Gently" close all windows, application will not stop if a `beforeunload` handler returns `false`.
     */
    requestStop(): void {
        app.quit();
    }

    protected async handleMainCommand(params: ElectronMainExecutionParams, options: ElectronMainCommandOptions): Promise<void> {
        if (options.file === undefined) {
            await this.openDefaultWindow();
        } else {
            let workspacePath: string | undefined;
            try {
                workspacePath = await fs.realpath(path.resolve(params.cwd, options.file));
            } catch {
                console.error(`Could not resolve the workspace path. "${options.file}" is not a valid 'file' option. Falling back to the default workspace location.`);
            }
            if (workspacePath === undefined) {
                await this.openDefaultWindow();
            } else {
                await this.openWindowWithWorkspace(workspacePath);
            }
        }
    }

    protected async createWindowUri(): Promise<URI> {
        return FileUri.create(this.globals.THEIA_FRONTEND_HTML_PATH)
            .withQuery(`port=${await this.backendPort}`);
    }

    protected getDefaultWindowState(): BrowserWindowConstructorOptions {
        // The `screen` API must be required when the application is ready.
        // See: https://electronjs.org/docs/api/screen#screen
        // We must center by hand because `browserWindow.center()` fails on multi-screen setups
        // See: https://github.com/electron/electron/issues/3490
        const { bounds } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
        const height = Math.floor(bounds.height * (2 / 3));
        const width = Math.floor(bounds.width * (2 / 3));
        const y = Math.floor(bounds.y + (bounds.height - height) / 2);
        const x = Math.floor(bounds.x + (bounds.width - width) / 2);
        return { width, height, x, y };
    }

    /**
     * Only show the window when the content is ready.
     */
    protected attachReadyToShow(electronWindow: BrowserWindow): void {
        electronWindow.on('ready-to-show', () => electronWindow.show());
    }

    /**
     * Save the window geometry state on every change.
     */
    protected attachSaveWindowState(electronWindow: BrowserWindow): void {
        const saveWindowState = () => {
            try {
                let bounds;
                if (electronWindow.isMaximized()) {
                    bounds = this.electronStore.get('windowstate', {});
                } else {
                    bounds = electronWindow.getBounds();
                }
                this.electronStore.set('windowstate', {
                    isMaximized: electronWindow.isMaximized(),
                    width: bounds.width,
                    height: bounds.height,
                    x: bounds.x,
                    y: bounds.y
                });
            } catch (e) {
                console.error('Error while saving window state:', e);
            }
        };
        let delayedSaveTimeout: NodeJS.Timer | undefined;
        const saveWindowStateDelayed = () => {
            if (delayedSaveTimeout) {
                clearTimeout(delayedSaveTimeout);
            }
            delayedSaveTimeout = setTimeout(saveWindowState, 1000);
        };
        electronWindow.on('close', saveWindowState);
        electronWindow.on('resize', saveWindowStateDelayed);
        electronWindow.on('move', saveWindowStateDelayed);
    }

    /**
     * Catch certain keybindings to prevent reloading the window using keyboard shortcuts.
     */
    protected attachGlobalShortcuts(electronWindow: BrowserWindow): void {
        if (this.config.electron?.disallowReloadKeybinding) {
            const accelerators = ['CmdOrCtrl+R', 'F5'];
            electronWindow.on('focus', () => {
                for (const accelerator of accelerators) {
                    globalShortcut.register(accelerator, () => { });
                }
            });
            electronWindow.on('blur', () => {
                for (const accelerator of accelerators) {
                    globalShortcut.unregister(accelerator);
                }
            });
        }
    }

    protected restoreMaximizedState(electronWindow: BrowserWindow, options: TheiaBrowserWindowOptions): void {
        if (options.isMaximized) {
            electronWindow.maximize();
        } else {
            electronWindow.unmaximize();
        }
    }

    /**
     * Start the NodeJS backend server.
     *
     * @return Running server's port promise.
     */
    protected async startBackend(): Promise<number> {
        // Check if we should run everything as one process.
        const noBackendFork = process.argv.indexOf('--no-cluster') !== -1;
        // We cannot use the `process.cwd()` as the application project path (the location of the `package.json` in other words)
        // in a bundled electron application because it depends on the way we start it. For instance, on OS X, these are a differences:
        // https://github.com/eclipse-theia/theia/issues/3297#issuecomment-439172274
        process.env.THEIA_APP_PROJECT_PATH = this.globals.THEIA_APP_PROJECT_PATH;
        // Set the electron version for both the dev and the production mode. (https://github.com/eclipse-theia/theia/issues/3254)
        // Otherwise, the forked backend processes will not know that they're serving the electron frontend.
        process.env.THEIA_ELECTRON_VERSION = process.versions.electron;
        if (noBackendFork) {
            process.env[ElectronSecurityToken] = JSON.stringify(this.electronSecurityToken);
            // The backend server main file is supposed to export a promise resolving with the port used by the http(s) server.
            const address: AddressInfo = await require(this.globals.THEIA_BACKEND_MAIN_PATH);
            return address.port;
        } else {
            const backendProcess = fork(
                this.globals.THEIA_BACKEND_MAIN_PATH,
                this.processArgv.getProcessArgvWithoutBin(),
                await this.getForkOptions(),
            );
            return new Promise((resolve, reject) => {
                // The backend server main file is also supposed to send the resolved http(s) server port via IPC.
                backendProcess.on('message', (address: AddressInfo) => {
                    resolve(address.port);
                });
                backendProcess.on('error', error => {
                    reject(error);
                });
                app.on('quit', () => {
                    // Only issue a kill signal if the backend process is running.
                    // eslint-disable-next-line no-null/no-null
                    if (backendProcess.exitCode === null && backendProcess.signalCode === null) {
                        try {
                            // If we forked the process for the clusters, we need to manually terminate it.
                            // See: https://github.com/eclipse-theia/theia/issues/835
                            process.kill(backendProcess.pid);
                        } catch (error) {
                            // See https://man7.org/linux/man-pages/man2/kill.2.html#ERRORS
                            if (error.code === 'ESRCH') {
                                return;
                            }
                            throw error;
                        }
                    }
                });
            });
        }
    }

    protected async getForkOptions(): Promise<ForkOptions> {
        return {
            env: {
                ...process.env,
                [ElectronSecurityToken]: JSON.stringify(this.electronSecurityToken),
            },
        };
    }

    protected async attachElectronSecurityToken(port: number): Promise<void> {
        await this.electronSecurityTokenService.setElectronSecurityTokenCookie(`http://localhost:${port}`);
    }

    protected hookApplicationEvents(): void {
        app.on('will-quit', this.onWillQuit.bind(this));
        app.on('second-instance', this.onSecondInstance.bind(this));
        app.on('window-all-closed', this.onWindowAllClosed.bind(this));
    }

    protected onWillQuit(event: ElectronEvent): void {
        this.stopContributions();
    }

    protected async onSecondInstance(event: ElectronEvent, argv: string[], cwd: string): Promise<void> {
        const electronWindows = BrowserWindow.getAllWindows();
        if (electronWindows.length > 0) {
            const electronWindow = electronWindows[0];
            if (electronWindow.isMinimized()) {
                electronWindow.restore();
            }
            electronWindow.focus();
        }
    }

    protected onWindowAllClosed(event: ElectronEvent): void {
        this.requestStop();
    }

    protected async startContributions(): Promise<void> {
        const promises = [];
        for (const contribution of this.contributions.getContributions()) {
            if (contribution.onStart) {
                promises.push(contribution.onStart(this));
            }
        }
        await Promise.all(promises);
    }

    protected stopContributions(): void {
        for (const contribution of this.contributions.getContributions()) {
            if (contribution.onStop) {
                contribution.onStop(this);
            }
        }
    }

}
