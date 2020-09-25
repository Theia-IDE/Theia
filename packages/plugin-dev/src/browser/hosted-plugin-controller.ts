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

import { injectable, inject } from 'inversify';
import { setTimeout } from 'timers';
import { StatusBar } from '@theia/core/lib/browser/status-bar/status-bar';
import { StatusBarAlignment, StatusBarEntry, FrontendApplicationContribution, PreferenceServiceImpl, PreferenceChange } from '@theia/core/lib/browser';
import { MessageService } from '@theia/core/lib/common';
import { CommandRegistry } from '@phosphor/commands';
import { Menu } from '@phosphor/widgets';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import { ConnectionStatusService, ConnectionStatus } from '@theia/core/lib/browser/connection-status-service';
import { PluginDevServer } from '../common/plugin-dev-protocol';
import { HostedPluginManagerClient, HostedInstanceState, HostedPluginCommands, HostedInstanceData } from './hosted-plugin-manager-client';
import { HostedPluginLogViewer } from './hosted-plugin-log-viewer';
import { HostedPluginPreferences } from './hosted-plugin-preferences';

/**
 * Adds a status bar element displaying the state of secondary Theia instance with hosted plugin and
 * allows controlling the instance by simple clicking on the status bar element.
 */
@injectable()
export class HostedPluginController implements FrontendApplicationContribution {

    public static readonly HOSTED_PLUGIN = 'hosted-plugin';
    public static readonly HOSTED_PLUGIN_OFFLINE = 'hosted-plugin-offline';
    public static readonly HOSTED_PLUGIN_FAILED = 'hosted-plugin-failed';

    @inject(StatusBar)
    protected readonly statusBar: StatusBar;

    @inject(FrontendApplicationStateService)
    protected readonly frontendApplicationStateService: FrontendApplicationStateService;

    @inject(PluginDevServer)
    protected readonly pluginDevServer: PluginDevServer;

    @inject(HostedPluginManagerClient)
    protected readonly hostedPluginManagerClient: HostedPluginManagerClient;

    @inject(ConnectionStatusService)
    protected readonly connectionStatusService: ConnectionStatusService;

    @inject(HostedPluginLogViewer)
    protected readonly hostedPluginLogViewer: HostedPluginLogViewer;

    @inject(HostedPluginPreferences)
    protected readonly hostedPluginPreferences: HostedPluginPreferences;

    @inject(PreferenceServiceImpl)
    protected readonly preferenceService: PreferenceServiceImpl;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    private pluginState: HostedInstanceState = HostedInstanceState.STOPPED;
    // used only for displaying Running instead of Watching in status bar if run of watcher fails
    private watcherSuccess: boolean;
    private entry: StatusBarEntry | undefined;

    public initialize(): void {
        this.pluginDevServer.getHostedPlugin().then(pluginMetadata => {
            if (!pluginMetadata) {
                this.frontendApplicationStateService.reachedState('ready').then(() => {
                    // handles status bar item
                    this.hostedPluginManagerClient.onStateChanged(e => {
                        if (e.state === HostedInstanceState.STARTING) {
                            this.onHostedPluginStarting();
                        } else if (e.state === HostedInstanceState.RUNNING) {
                            this.onHostedPluginRunning();
                        } else if (e.state === HostedInstanceState.STOPPED) {
                            this.onHostedPluginStopped();
                        } else if (e.state === HostedInstanceState.FAILED) {
                            this.onHostedPluginFailed();
                        }
                    });

                    // handles watch compilation
                    this.hostedPluginManagerClient.onStateChanged(e => this.handleWatchers(e));

                    // updates status bar if page is loading when hosted instance is already running
                    this.pluginDevServer.isHostedPluginInstanceRunning().then(running => {
                        if (running) {
                            this.onHostedPluginRunning();
                        }
                    });
                });

                this.connectionStatusService.onStatusChange(() => this.onConnectionStatusChanged());

                this.preferenceService.onPreferenceChanged(preference => this.onPreferencesChanged(preference));
            } else {
                console.error(`Need to load plugin ${pluginMetadata.model.id}`);
            }
        });
    }

    /**
     * Display status bar element for stopped plugin.
     */
    protected async onHostedPluginStopped(): Promise<void> {
        this.pluginState = HostedInstanceState.STOPPED;

        this.entry = {
            text: 'Hosted Plugin: Stopped $(angle-up)',
            alignment: StatusBarAlignment.LEFT,
            priority: 100,
            onclick: e => {
                this.showMenu(e.clientX, e.clientY);
            }
        };

        this.entry.className = HostedPluginController.HOSTED_PLUGIN;
        await this.statusBar.setElement(HostedPluginController.HOSTED_PLUGIN, this.entry);
    }

    /**
     * Display status bar element for starting plugin.
     */
    protected async onHostedPluginStarting(): Promise<void> {
        this.pluginState = HostedInstanceState.STARTING;

        this.hostedPluginLogViewer.showLogConsole();

        this.entry = {
            text: '$(cog~spin) Hosted Plugin: Starting',
            alignment: StatusBarAlignment.LEFT,
            priority: 100
        };

        this.entry.className = HostedPluginController.HOSTED_PLUGIN;
        await this.statusBar.setElement(HostedPluginController.HOSTED_PLUGIN, this.entry);
    }

    /**
     * Display status bar element for running plugin.
     */
    protected async onHostedPluginRunning(): Promise<void> {
        this.pluginState = HostedInstanceState.RUNNING;

        let entryText: string;
        if (this.hostedPluginPreferences['hosted-plugin.watchMode'] && this.watcherSuccess) {
            entryText = '$(cog~spin) Hosted Plugin: Watching $(angle-up)';
        } else {
            entryText = '$(cog~spin) Hosted Plugin: Running $(angle-up)';
        }

        this.entry = {
            text: entryText,
            alignment: StatusBarAlignment.LEFT,
            priority: 100,
            onclick: e => {
                this.showMenu(e.clientX, e.clientY);
            }
        };

        this.entry.className = HostedPluginController.HOSTED_PLUGIN;
        await this.statusBar.setElement(HostedPluginController.HOSTED_PLUGIN, this.entry);
    }

    /**
     * Display status bar element for failed plugin.
     */
    protected async onHostedPluginFailed(): Promise<void> {
        this.pluginState = HostedInstanceState.FAILED;

        this.entry = {
            text: 'Hosted Plugin: Stopped $(angle-up)',
            alignment: StatusBarAlignment.LEFT,
            priority: 100,
            onclick: e => {
                this.showMenu(e.clientX, e.clientY);
            }
        };

        this.entry.className = HostedPluginController.HOSTED_PLUGIN_FAILED;
        await this.statusBar.setElement(HostedPluginController.HOSTED_PLUGIN, this.entry);
    }

    protected async onPreferencesChanged(preference: PreferenceChange): Promise<void> {
        if (preference.preferenceName === 'hosted-plugin.watchMode') {
            if (await this.pluginDevServer.isHostedPluginInstanceRunning()) {
                const pluginLocation = await this.pluginDevServer.getHostedPluginURI();
                const isWatchCompilationRunning = await this.pluginDevServer.isWatchCompilationRunning(pluginLocation);
                if (preference.newValue === true) {
                    if (!isWatchCompilationRunning) {
                        await this.runWatchCompilation(pluginLocation.toString());
                    }
                } else {
                    if (isWatchCompilationRunning) {
                        await this.pluginDevServer.stopWatchCompilation(pluginLocation.toString());
                    }
                }
                // update status bar
                this.onHostedPluginRunning();
            }
        }
    }

    /**
     * Starts / stops watchers on hosted instance state change.
     *
     * @param event hosted instance state change event
     */
    protected async handleWatchers(event: HostedInstanceData): Promise<void> {
        if (event.state === HostedInstanceState.RUNNING) {
            if (this.hostedPluginPreferences['hosted-plugin.watchMode']) {
                await this.runWatchCompilation(event.pluginLocation.toString());
                // update status bar
                this.onHostedPluginRunning();
            }
        } else if (event.state === HostedInstanceState.STOPPING) {
            if (this.hostedPluginPreferences['hosted-plugin.watchMode']) {
                const isRunning = await this.pluginDevServer.isWatchCompilationRunning(event.pluginLocation.toString());
                if (isRunning) {
                    try {
                        await this.pluginDevServer.stopWatchCompilation(event.pluginLocation.toString());
                    } catch (error) {
                        this.messageService.error(this.getErrorMessage(error.message));
                    }
                }
            }
        }
    }

    private async runWatchCompilation(pluginLocation: string): Promise<void> {
        try {
            await this.pluginDevServer.runWatchCompilation(pluginLocation);
            this.watcherSuccess = true;
        } catch (error) {
            this.messageService.error(this.getErrorMessage(error));
            this.watcherSuccess = false;
        }
    }

    private getErrorMessage(error: Error): string {
        return error.message.substring(error.message.indexOf(':') + 1);
    }

    /**
     * Updating status bar element when changing connection status.
     */
    private onConnectionStatusChanged(): void {
        if (this.connectionStatusService.currentStatus === ConnectionStatus.OFFLINE) {
            // Re-set the element only if it's visible on status bar
            if (this.entry) {
                const offlineElement = {
                    text: 'Hosted Plugin: Stopped',
                    alignment: StatusBarAlignment.LEFT,
                    priority: 100
                };

                this.entry.className = HostedPluginController.HOSTED_PLUGIN_OFFLINE;
                this.statusBar.setElement(HostedPluginController.HOSTED_PLUGIN, offlineElement);
            }
        } else {
            // ask state of hosted plugin when switching to Online
            if (this.entry) {
                this.pluginDevServer.isHostedPluginInstanceRunning().then(running => {
                    if (running) {
                        this.onHostedPluginRunning();
                    } else {
                        this.onHostedPluginStopped();
                    }
                });
            }
        }
    }

    /**
     * Show menu containing actions to start/stop/restart hosted plugin.
     */
    protected showMenu(x: number, y: number): void {
        const commands = new CommandRegistry();
        const menu = new Menu({
            commands
        });

        if (this.pluginState === HostedInstanceState.RUNNING) {
            this.addCommandsForRunningPlugin(commands, menu);
        } else if (this.pluginState === HostedInstanceState.STOPPED || this.pluginState === HostedInstanceState.FAILED) {
            this.addCommandsForStoppedPlugin(commands, menu);
        }

        menu.open(x, y);
    }

    /**
     * Adds commands to the menu for running plugin.
     */
    protected addCommandsForRunningPlugin(commands: CommandRegistry, menu: Menu): void {
        commands.addCommand(HostedPluginCommands.STOP.id, {
            label: 'Stop Instance',
            icon: 'fa fa-stop',
            execute: () => setTimeout(() => this.hostedPluginManagerClient.stop(), 100)
        });

        menu.addItem({
            type: 'command',
            command: HostedPluginCommands.STOP.id
        });

        commands.addCommand(HostedPluginCommands.RESTART.id, {
            label: 'Restart Instance',
            icon: 'fa fa-repeat',
            execute: () => setTimeout(() => this.hostedPluginManagerClient.restart(), 100)
        });

        menu.addItem({
            type: 'command',
            command: HostedPluginCommands.RESTART.id
        });
    }

    /**
     * Adds command to the menu for stopped plugin.
     */
    protected addCommandsForStoppedPlugin(commands: CommandRegistry, menu: Menu): void {
        commands.addCommand(HostedPluginCommands.START.id, {
            label: 'Start Instance',
            icon: 'fa fa-play',
            execute: () => setTimeout(() => this.hostedPluginManagerClient.start(), 100)
        });

        menu.addItem({
            type: 'command',
            command: HostedPluginCommands.START.id
        });

        commands.addCommand(HostedPluginCommands.DEBUG.id, {
            label: 'Debug Instance',
            icon: 'fa fa-bug',
            execute: () => setTimeout(() => this.hostedPluginManagerClient.debug(), 100)
        });

        menu.addItem({
            type: 'command',
            command: HostedPluginCommands.DEBUG.id
        });
    }

}
