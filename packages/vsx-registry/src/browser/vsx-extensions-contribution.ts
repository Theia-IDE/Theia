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

import { injectable, inject } from '@theia/core/shared/inversify';
import { Command, CommandRegistry } from '@theia/core/lib/common/command';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { VSXExtensionsViewContainer } from './vsx-extensions-view-container';
import { Widget } from '@theia/core/lib/browser/widgets/widget';
import { VSXExtensionsModel } from './vsx-extensions-model';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';
import { ColorRegistry, Color } from '@theia/core/lib/browser/color-registry';
import { TabBarToolbarContribution, TabBarToolbarItem, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser/frontend-application';
import { MessageService, Mutable } from '@theia/core/lib/common';
import { FileDialogService, OpenFileDialogProps } from '@theia/filesystem/lib/browser';
import { LabelProvider } from '@theia/core/lib/browser';
import { VscodeCommands } from '@theia/plugin-ext-vscode/lib/browser/plugin-vscode-commands-contribution';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common/menu';
import { VSXExtension, VSXExtensionsContextMenu } from './vsx-extension';
import { QuickPickItem, QuickPickService } from '@theia/core/lib/common/quick-pick-service';
import { VSXRegistryAPI } from '../common/vsx-registry-api';
// eslint-disable-next-line import/no-extraneous-dependencies
import * as moment from 'moment';
import { PluginServer } from '@theia/plugin-ext/lib/common';
import { ClipboardService } from '@theia/core/lib/browser/clipboard-service';
import { VSXExtensionRaw } from '../common/vsx-registry-types';

interface QuickPickVersionItem {
    version: string;
}

export namespace VSXExtensionsCommands {

    const EXTENSIONS_CATEGORY = 'Extensions';

    export const CLEAR_ALL: Command = {
        id: 'vsxExtensions.clearAll',
        category: EXTENSIONS_CATEGORY,
        label: 'Clear Search Results',
        iconClass: 'clear-all'
    };
    export const INSTALL_FROM_VSIX: Command & { dialogLabel: string } = {
        id: 'vsxExtensions.installFromVSIX',
        category: EXTENSIONS_CATEGORY,
        label: 'Install from VSIX...',
        dialogLabel: 'Install from VSIX'
    };
    export const INSTALL_ANOTHER_VERSION: Command = {
        id: 'vsxExtensions.installAnotherVersion'
    };
    export const COPY: Command = {
        id: 'vsxExtensions.copy'
    };
    export const COPY_EXTENSION_ID: Command = {
        id: 'vsxExtensions.copyExtensionId'
    };
}

@injectable()
export class VSXExtensionsContribution extends AbstractViewContribution<VSXExtensionsViewContainer>
    implements ColorContribution, FrontendApplicationContribution, TabBarToolbarContribution, MenuContribution {

    @inject(VSXExtensionsModel) protected readonly model: VSXExtensionsModel;
    @inject(CommandRegistry) protected readonly commandRegistry: CommandRegistry;
    @inject(TabBarToolbarRegistry) protected readonly tabbarToolbarRegistry: TabBarToolbarRegistry;
    @inject(FileDialogService) protected readonly fileDialogService: FileDialogService;
    @inject(MessageService) protected readonly messageService: MessageService;
    @inject(LabelProvider) protected readonly labelProvider: LabelProvider;
    @inject(QuickPickService) protected readonly quickPickService: QuickPickService;
    @inject(VSXRegistryAPI) protected readonly vsxRegistryAPI: VSXRegistryAPI;
    @inject(PluginServer) protected readonly pluginServer: PluginServer;
    @inject(ClipboardService) protected readonly clipboardService: ClipboardService;

    constructor() {
        super({
            widgetId: VSXExtensionsViewContainer.ID,
            widgetName: VSXExtensionsViewContainer.LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 500
            },
            toggleCommandId: 'vsxExtensions.toggle',
            toggleKeybinding: 'ctrlcmd+shift+x'
        });
    }

    async initializeLayout(app: FrontendApplication): Promise<void> {
        await this.openView({ activate: false });
    }

    registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        commands.registerCommand(VSXExtensionsCommands.CLEAR_ALL, {
            execute: w => this.withWidget(w, () => this.model.search.query = ''),
            isEnabled: w => this.withWidget(w, () => !!this.model.search.query),
            isVisible: w => this.withWidget(w, () => true)
        });

        commands.registerCommand(VSXExtensionsCommands.INSTALL_FROM_VSIX, {
            execute: () => this.installFromVSIX()
        });

        commands.registerCommand({ id: VSXExtensionsCommands.INSTALL_ANOTHER_VERSION.id }, {
            execute: async (extension: VSXExtension) => this.installAnotherVersion(extension),
            isEnabled: (extension: VSXExtension) => !extension.builtin && !!extension.downloadUrl
        });

        commands.registerCommand(VSXExtensionsCommands.COPY, {
            execute: (extension: VSXExtension) => this.copy(extension)
        });

        commands.registerCommand(VSXExtensionsCommands.COPY_EXTENSION_ID, {
            execute: (extension: VSXExtension) => this.copyExtensionId(extension)
        });
    }

    registerToolbarItems(registry: TabBarToolbarRegistry): void {
        registry.registerItem({
            id: VSXExtensionsCommands.CLEAR_ALL.id,
            command: VSXExtensionsCommands.CLEAR_ALL.id,
            tooltip: VSXExtensionsCommands.CLEAR_ALL.label,
            priority: 1,
            onDidChange: this.model.onDidChange
        });

        this.registerMoreToolbarItem({
            id: VSXExtensionsCommands.INSTALL_FROM_VSIX.id,
            command: VSXExtensionsCommands.INSTALL_FROM_VSIX.id,
            tooltip: VSXExtensionsCommands.INSTALL_FROM_VSIX.label,
            group: 'other_1'
        });
    }

    /**
     * Register commands to the `More Actions...` extensions toolbar item.
     */
    registerMoreToolbarItem = (item: Mutable<TabBarToolbarItem>) => {
        const commandId = item.command;
        const id = 'vsxExtensions.tabbar.toolbar.' + commandId;
        const command = this.commandRegistry.getCommand(commandId);
        this.commandRegistry.registerCommand({ id, iconClass: command && command.iconClass }, {
            execute: (w, ...args) => w instanceof VSXExtensionsViewContainer
                && this.commandRegistry.executeCommand(commandId, ...args),
            isEnabled: (w, ...args) => w instanceof VSXExtensionsViewContainer
                && this.commandRegistry.isEnabled(commandId, ...args),
            isVisible: (w, ...args) => w instanceof VSXExtensionsViewContainer
                && this.commandRegistry.isVisible(commandId, ...args),
            isToggled: (w, ...args) => w instanceof VSXExtensionsViewContainer
                && this.commandRegistry.isToggled(commandId, ...args),
        });
        item.command = id;
        this.tabbarToolbarRegistry.registerItem(item);
    };

    registerMenus(menus: MenuModelRegistry): void {
        super.registerMenus(menus);
        menus.registerMenuAction(VSXExtensionsContextMenu.INSTALL, {
            commandId: VSXExtensionsCommands.INSTALL_ANOTHER_VERSION.id,
            label: 'Install Another Version...'
        });

        menus.registerMenuAction(VSXExtensionsContextMenu.COPY, {
            commandId: VSXExtensionsCommands.COPY.id,
            label: 'Copy',
            order: '0'
        });
        menus.registerMenuAction(VSXExtensionsContextMenu.COPY, {
            commandId: VSXExtensionsCommands.COPY_EXTENSION_ID.id,
            label: 'Copy Extension Id',
            order: '1'
        });
    }

    registerColors(colors: ColorRegistry): void {
        // VS Code colors should be aligned with https://code.visualstudio.com/api/references/theme-color#extensions
        colors.register(
            {
                id: 'extensionButton.prominentBackground', defaults: {
                    dark: '#327e36',
                    light: '#327e36'
                }, description: 'Button background color for actions extension that stand out (e.g. install button).'
            },
            {
                id: 'extensionButton.prominentForeground', defaults: {
                    dark: Color.white,
                    light: Color.white
                }, description: 'Button foreground color for actions extension that stand out (e.g. install button).'
            },
            {
                id: 'extensionButton.prominentHoverBackground', defaults: {
                    dark: '#28632b',
                    light: '#28632b'
                }, description: 'Button background hover color for actions extension that stand out (e.g. install button).'
            }
        );
    }

    protected withWidget<T>(widget: Widget | undefined = this.tryGetWidget(), fn: (widget: VSXExtensionsViewContainer) => T): T | false {
        if (widget instanceof VSXExtensionsViewContainer && widget.id === VSXExtensionsViewContainer.ID) {
            return fn(widget);
        }
        return false;
    }

    /**
     * Installs a local .vsix file after prompting the `Open File` dialog.
     */
    protected async installFromVSIX(): Promise<void> {
        const props: OpenFileDialogProps = {
            title: VSXExtensionsCommands.INSTALL_FROM_VSIX.dialogLabel,
            openLabel: 'Install',
            filters: { 'VSIX Extensions (*.vsix)': ['vsix'] },
            canSelectMany: false
        };
        const extensionUri = await this.fileDialogService.showOpenDialog(props);
        if (extensionUri) {
            if (extensionUri.path.ext === '.vsix') {
                const extensionName = this.labelProvider.getName(extensionUri);
                try {
                    await this.commandRegistry.executeCommand(VscodeCommands.INSTALL_FROM_VSIX.id, extensionUri);
                    this.messageService.info(`Completed installing ${extensionName} from VSIX.`);
                } catch (e) {
                    this.messageService.error(`Failed to install ${extensionName} from VSIX.`);
                    console.warn(e);
                }
            } else {
                this.messageService.error('The selected file is not a valid "*.vsix" plugin.');
            }
        }
    }

    /**
     * Given an extension, displays a quick pick of other compatible versions and installs the selected version.
     *
     * @param extension a VSX extension.
     */
    protected async installAnotherVersion(extension: VSXExtension): Promise<void> {
        const extensionId = extension.id;
        const currentVersion = extension.version;
        const extensions = await this.vsxRegistryAPI.getAllVersions(extensionId);
        const latestCompatible = await this.vsxRegistryAPI.getLatestCompatibleExtensionVersion(extensionId);
        let compatibleExtensions: VSXExtensionRaw[] = [];
        if (latestCompatible) {
            compatibleExtensions = extensions.slice(extensions.findIndex(ext => ext.version === latestCompatible.version));
        }
        const items: QuickPickItem<QuickPickVersionItem>[] = [];
        compatibleExtensions.forEach(ext => {
            let publishedDate = moment(ext.timestamp).fromNow();
            if (currentVersion === ext.version) {
                publishedDate += ' (Current)';
            }
            items.push({
                label: ext.version,
                value: { version: ext.version },
                description: publishedDate
            });
        });
        const selectedItem = await this.quickPickService.show(items, { placeholder: 'Select Version to Install', runIfSingle: false });
        if (selectedItem && currentVersion && selectedItem.version !== currentVersion) {
            const selectedExtension = this.model.getExtension(extensionId);
            if (selectedExtension) {
                await this.updateVersion(selectedExtension, selectedItem.version, currentVersion);
            }
        }
    }

    protected async copy(extension: VSXExtension): Promise<void> {
        this.clipboardService.writeText(await extension.serialize());
    }

    protected copyExtensionId(extension: VSXExtension): void {
        this.clipboardService.writeText(extension.id);
    }

    /**
     * Updates an extension to a specific version.
     *
     * @param extension the extension to update.
     * @param updateToVersion the version to update to.
     * @param revertToVersion the version to revert to (in case of failure).
     */
    private async updateVersion(extension: VSXExtension, updateToVersion: string, revertToVersion: string): Promise<void> {
        try {
            await extension.uninstall();
        } catch {
            return;
        }
        try {
            await extension.install({ version: updateToVersion });
        } catch {
            await extension.install({ version: revertToVersion });
        }
    }
}
