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

import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry, SelectionService, MessageService } from '@theia/core/lib/common';
import { isOSX, environment, OS } from '@theia/core';
import {
    open, OpenerService, CommonMenus, StorageService, LabelProvider,
    ConfirmDialog, KeybindingRegistry, KeybindingContribution, CommonCommands, FrontendApplicationContribution, ApplicationShell, Saveable, SaveableSource, Widget, Navigatable
} from '@theia/core/lib/browser';
import { FileDialogService, OpenFileDialogProps, FileDialogTreeFilters } from '@theia/filesystem/lib/browser';
import { ContextKeyService } from '@theia/core/lib/browser/context-key-service';
import { WorkspaceService } from './workspace-service';
import { THEIA_EXT, VSCODE_EXT } from '../common';
import { WorkspaceCommands } from './workspace-commands';
import { QuickOpenWorkspace } from './quick-open-workspace';
import { WorkspacePreferences } from './workspace-preferences';
import URI from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { EncodingRegistry } from '@theia/core/lib/browser/encoding-registry';
import { UTF8 } from '@theia/core/lib/common/encodings';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { PreferenceConfigurations } from '@theia/core/lib/browser/preferences/preference-configurations';

export enum WorkspaceStates {
    /**
     * The state is `empty` when no workspace is opened.
     */
    empty = 'empty',
    /**
     * The state is `workspace` when a workspace is opened.
     */
    workspace = 'workspace',
    /**
     * The state is `folder` when a folder is opened. (1 folder)
     */
    folder = 'folder',
};
export type WorkspaceState = keyof typeof WorkspaceStates;

@injectable()
export class WorkspaceFrontendContribution implements CommandContribution, KeybindingContribution, MenuContribution, FrontendApplicationContribution {

    @inject(ApplicationShell) protected readonly applicationShell: ApplicationShell;
    @inject(MessageService) protected readonly messageService: MessageService;
    @inject(FileService) protected readonly fileService: FileService;
    @inject(OpenerService) protected readonly openerService: OpenerService;
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(StorageService) protected readonly workspaceStorage: StorageService;
    @inject(LabelProvider) protected readonly labelProvider: LabelProvider;
    @inject(QuickOpenWorkspace) protected readonly quickOpenWorkspace: QuickOpenWorkspace;
    @inject(FileDialogService) protected readonly fileDialogService: FileDialogService;
    @inject(WorkspacePreferences) protected preferences: WorkspacePreferences;
    @inject(SelectionService) protected readonly selectionService: SelectionService;
    @inject(CommandRegistry) protected readonly commandRegistry: CommandRegistry;

    @inject(ContextKeyService)
    protected readonly contextKeyService: ContextKeyService;

    @inject(EncodingRegistry)
    protected readonly encodingRegistry: EncodingRegistry;

    @inject(PreferenceConfigurations)
    protected readonly preferenceConfigurations: PreferenceConfigurations;

    configure(): void {
        this.encodingRegistry.registerOverride({ encoding: UTF8, extension: THEIA_EXT });
        this.encodingRegistry.registerOverride({ encoding: UTF8, extension: VSCODE_EXT });
        this.updateEncodingOverrides();

        const workspaceFolderCountKey = this.contextKeyService.createKey<number>('workspaceFolderCount', 0);
        const updateWorkspaceFolderCountKey = () => workspaceFolderCountKey.set(this.workspaceService.tryGetRoots().length);
        updateWorkspaceFolderCountKey();

        const workspaceStateKey = this.contextKeyService.createKey<WorkspaceState>('workspaceState', 'empty');
        const updateWorkspaceStateKey = () => workspaceStateKey.set(this.updateWorkspaceStateKey());
        updateWorkspaceStateKey();

        this.updateStyles();
        this.workspaceService.onWorkspaceChanged(() => {
            this.updateEncodingOverrides();
            updateWorkspaceFolderCountKey();
            updateWorkspaceStateKey();
            this.updateStyles();
        });
    }

    protected readonly toDisposeOnUpdateEncodingOverrides = new DisposableCollection();
    protected updateEncodingOverrides(): void {
        this.toDisposeOnUpdateEncodingOverrides.dispose();
        for (const root of this.workspaceService.tryGetRoots()) {
            for (const configPath of this.preferenceConfigurations.getPaths()) {
                const parent = root.resource.resolve(configPath);
                this.toDisposeOnUpdateEncodingOverrides.push(this.encodingRegistry.registerOverride({ encoding: UTF8, parent }));
            }
        }
    }

    protected updateStyles(): void {
        document.body.classList.remove('theia-no-open-workspace');
        // Display the 'no workspace opened' theme color when no folders are opened (single-root).
        if (!this.workspaceService.isMultiRootWorkspaceOpened &&
            !this.workspaceService.tryGetRoots().length) {
            document.body.classList.add('theia-no-open-workspace');
        }
    }

    registerCommands(commands: CommandRegistry): void {
        // Not visible/enabled on Windows/Linux in electron.
        commands.registerCommand(WorkspaceCommands.OPEN, {
            isEnabled: () => isOSX || !this.isElectron(),
            isVisible: () => isOSX || !this.isElectron(),
            execute: () => this.doOpen()
        });
        // Visible/enabled only on Windows/Linux in electron.
        commands.registerCommand(WorkspaceCommands.OPEN_FILE, {
            isEnabled: () => true,
            execute: () => this.doOpenFile()
        });
        // Visible/enabled only on Windows/Linux in electron.
        commands.registerCommand(WorkspaceCommands.OPEN_FOLDER, {
            isEnabled: () => true,
            execute: () => this.doOpenFolder()
        });
        commands.registerCommand(WorkspaceCommands.OPEN_WORKSPACE, {
            isEnabled: () => true,
            execute: () => this.doOpenWorkspace()
        });
        commands.registerCommand(WorkspaceCommands.CLOSE, {
            isEnabled: () => this.workspaceService.opened,
            execute: () => this.closeWorkspace()
        });
        commands.registerCommand(WorkspaceCommands.OPEN_RECENT_WORKSPACE, {
            execute: () => this.quickOpenWorkspace.select()
        });
        commands.registerCommand(WorkspaceCommands.SAVE_WORKSPACE_AS, {
            isEnabled: () => this.workspaceService.isMultiRootWorkspaceEnabled,
            execute: () => this.saveWorkspaceAs()
        });
        commands.registerCommand(WorkspaceCommands.SAVE_AS, {
            isEnabled: () => this.canBeSavedAs(this.applicationShell.currentWidget),
            execute: () => {
                const { currentWidget } = this.applicationShell;
                // No clue what could have happened between `isEnabled` and `execute`
                // when fetching currentWidget, so better to double-check:
                if (this.canBeSavedAs(currentWidget)) {
                    this.saveAs(currentWidget);
                } else {
                    this.messageService.error(`Cannot run "${WorkspaceCommands.SAVE_AS.label}" for the current widget.`);
                }
            },
        });
        commands.registerCommand(WorkspaceCommands.OPEN_WORKSPACE_FILE, {
            isEnabled: () => this.workspaceService.saved,
            execute: () => {
                if (this.workspaceService.saved && this.workspaceService.workspace) {
                    open(this.openerService, this.workspaceService.workspace.resource);
                }
            }

        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        if (isOSX || !this.isElectron()) {
            menus.registerMenuAction(CommonMenus.FILE_OPEN, {
                commandId: WorkspaceCommands.OPEN.id,
                order: 'a00'
            });
        }
        if (!isOSX && this.isElectron()) {
            menus.registerMenuAction(CommonMenus.FILE_OPEN, {
                commandId: WorkspaceCommands.OPEN_FILE.id,
                label: `${WorkspaceCommands.OPEN_FILE.dialogLabel}...`,
                order: 'a01'
            });
            menus.registerMenuAction(CommonMenus.FILE_OPEN, {
                commandId: WorkspaceCommands.OPEN_FOLDER.id,
                label: `${WorkspaceCommands.OPEN_FOLDER.dialogLabel}...`,
                order: 'a02'
            });
        }
        menus.registerMenuAction(CommonMenus.FILE_OPEN, {
            commandId: WorkspaceCommands.OPEN_WORKSPACE.id,
            order: 'a10'
        });
        menus.registerMenuAction(CommonMenus.FILE_OPEN, {
            commandId: WorkspaceCommands.OPEN_RECENT_WORKSPACE.id,
            order: 'a20'
        });
        menus.registerMenuAction(CommonMenus.FILE_OPEN, {
            commandId: WorkspaceCommands.SAVE_WORKSPACE_AS.id,
            order: 'a30'
        });

        menus.registerMenuAction(CommonMenus.FILE_CLOSE, {
            commandId: WorkspaceCommands.CLOSE.id
        });

        menus.registerMenuAction(CommonMenus.FILE_SAVE, {
            commandId: WorkspaceCommands.SAVE_AS.id,
        });
    }

    registerKeybindings(keybindings: KeybindingRegistry): void {
        keybindings.registerKeybinding({
            command: WorkspaceCommands.NEW_FILE.id,
            keybinding: this.isElectron() ? 'ctrlcmd+n' : 'alt+n',
        });
        keybindings.registerKeybinding({
            command: isOSX || !this.isElectron() ? WorkspaceCommands.OPEN.id : WorkspaceCommands.OPEN_FILE.id,
            keybinding: this.isElectron() ? 'ctrlcmd+o' : 'ctrlcmd+alt+o',
        });
        if (!isOSX && this.isElectron()) {
            keybindings.registerKeybinding({
                command: WorkspaceCommands.OPEN_FOLDER.id,
                keybinding: 'ctrl+k ctrl+o',
            });
        }
        keybindings.registerKeybinding({
            command: WorkspaceCommands.OPEN_WORKSPACE.id,
            keybinding: 'ctrlcmd+alt+w',
        });
        keybindings.registerKeybinding({
            command: WorkspaceCommands.OPEN_RECENT_WORKSPACE.id,
            keybinding: 'ctrlcmd+alt+r',
        });
        keybindings.registerKeybinding({
            command: WorkspaceCommands.SAVE_AS.id,
            keybinding: 'ctrlcmd+shift+s',
        });
    }

    /**
     * This is the generic `Open` method. Opens files and directories too. Resolves to the opened URI.
     * Except when you are on either Windows or Linux `AND` running in electron. If so, it opens a file.
     */
    protected async doOpen(): Promise<URI | undefined> {
        if (!isOSX && this.isElectron()) {
            return this.doOpenFile();
        }
        const [rootStat] = await this.workspaceService.roots;
        const destinationUri = await this.fileDialogService.showOpenDialog({
            title: WorkspaceCommands.OPEN.dialogLabel,
            canSelectFolders: true,
            canSelectFiles: true
        }, rootStat);
        if (destinationUri && this.getCurrentWorkspaceUri()?.toString() !== destinationUri.toString()) {
            const destination = await this.fileService.resolve(destinationUri);
            if (destination.isDirectory) {
                this.workspaceService.open(destinationUri);
            } else {
                await open(this.openerService, destinationUri);
            }
            return destinationUri;
        }
        return undefined;
    }

    /**
     * Opens a file after prompting the `Open File` dialog. Resolves to `undefined`, if
     *  - the workspace root is not set,
     *  - the file to open does not exist, or
     *  - it was not a file, but a directory.
     *
     * Otherwise, resolves to the URI of the file.
     */
    protected async doOpenFile(): Promise<URI | undefined> {
        const props: OpenFileDialogProps = {
            title: WorkspaceCommands.OPEN_FILE.dialogLabel,
            canSelectFolders: false,
            canSelectFiles: true
        };
        const [rootStat] = await this.workspaceService.roots;
        const destinationFileUri = await this.fileDialogService.showOpenDialog(props, rootStat);
        if (destinationFileUri) {
            const destinationFile = await this.fileService.resolve(destinationFileUri);
            if (!destinationFile.isDirectory) {
                await open(this.openerService, destinationFileUri);
                return destinationFileUri;
            }
        }
        return undefined;
    }

    /**
     * Opens a folder after prompting the `Open Folder` dialog. Resolves to `undefined`, if
     *  - the workspace root is not set,
     *  - the folder to open does not exist, or
     *  - it was not a directory, but a file resource.
     *
     * Otherwise, resolves to the URI of the folder.
     */
    protected async doOpenFolder(): Promise<URI | undefined> {
        const props: OpenFileDialogProps = {
            title: WorkspaceCommands.OPEN_FOLDER.dialogLabel,
            canSelectFolders: true,
            canSelectFiles: false
        };
        const [rootStat] = await this.workspaceService.roots;
        const destinationFolderUri = await this.fileDialogService.showOpenDialog(props, rootStat);
        if (destinationFolderUri &&
            this.getCurrentWorkspaceUri()?.toString() !== destinationFolderUri.toString()) {
            const destinationFolder = await this.fileService.resolve(destinationFolderUri);
            if (destinationFolder.isDirectory) {
                this.workspaceService.open(destinationFolderUri);
                return destinationFolderUri;
            }
        }
        return undefined;
    }

    /**
     * Opens a workspace after raising the `Open Workspace` dialog. Resolves to the URI of the recently opened workspace,
     * if it was successful. Otherwise, resolves to `undefined`.
     *
     * **Caveat**: this behaves differently on different platforms, the `workspace.supportMultiRootWorkspace` preference value **does** matter,
     * and `electron`/`browser` version has impact too. See [here](https://github.com/eclipse-theia/theia/pull/3202#issuecomment-430884195) for more details.
     *
     * Legend:
     *  - `workspace.supportMultiRootWorkspace` is `false`: => `N`
     *  - `workspace.supportMultiRootWorkspace` is `true`: => `Y`
     *  - Folders only: => `F`
     *  - Workspace files only: => `W`
     *  - Folders and workspace files: => `FW`
     *
     * -----
     *
     * |---------|-----------|-----------|------------|------------|
     * |         | browser Y | browser N | electron Y | electron N |
     * |---------|-----------|-----------|------------|------------|
     * | Linux   |     FW    |     F     |     W      |     F      |
     * | Windows |     FW    |     F     |     W      |     F      |
     * | OS X    |     FW    |     F     |     FW     |     FW     |
     * |---------|-----------|-----------|------------|------------|
     *
     */
    protected async doOpenWorkspace(): Promise<URI | undefined> {
        const props = await this.openWorkspaceOpenFileDialogProps();
        const [rootStat] = await this.workspaceService.roots;
        const workspaceFolderOrWorkspaceFileUri = await this.fileDialogService.showOpenDialog(props, rootStat);
        if (workspaceFolderOrWorkspaceFileUri &&
            this.getCurrentWorkspaceUri()?.toString() !== workspaceFolderOrWorkspaceFileUri.toString()) {
            const destinationFolder = await this.fileService.exists(workspaceFolderOrWorkspaceFileUri);
            if (destinationFolder) {
                this.workspaceService.open(workspaceFolderOrWorkspaceFileUri);
                return workspaceFolderOrWorkspaceFileUri;
            }
        }
        return undefined;
    }

    protected async openWorkspaceOpenFileDialogProps(): Promise<OpenFileDialogProps> {
        await this.preferences.ready;
        const supportMultiRootWorkspace = this.preferences['workspace.supportMultiRootWorkspace'];
        const type = OS.type();
        const electron = this.isElectron();
        return WorkspaceFrontendContribution.createOpenWorkspaceOpenFileDialogProps({
            type,
            electron,
            supportMultiRootWorkspace
        });
    }

    protected async closeWorkspace(): Promise<void> {
        const dialog = new ConfirmDialog({
            title: WorkspaceCommands.CLOSE.label!,
            msg: 'Do you really want to close the workspace?'
        });
        if (await dialog.open()) {
            await this.workspaceService.close();
        }
    }

    protected async saveWorkspaceAs(): Promise<void> {
        let exist: boolean = false;
        let overwrite: boolean = false;
        let selected: URI | undefined;
        do {
            selected = await this.fileDialogService.showSaveDialog({
                title: WorkspaceCommands.SAVE_WORKSPACE_AS.label!,
                filters: WorkspaceFrontendContribution.DEFAULT_FILE_FILTER
            });
            if (selected) {
                const displayName = selected.displayName;
                if (!displayName.endsWith(`.${THEIA_EXT}`) && !displayName.endsWith(`.${VSCODE_EXT}`)) {
                    selected = selected.parent.resolve(`${displayName}.${THEIA_EXT}`);
                }
                exist = await this.fileService.exists(selected);
                if (exist) {
                    overwrite = await this.confirmOverwrite(selected);
                }
            }
        } while (selected && exist && !overwrite);

        if (selected) {
            this.workspaceService.save(selected);
        }
    }

    /**
     * This method ensures a few things about `widget`:
     * - `widget.getResourceUri()` actually returns a URI.
     * - `widget.saveable.createSnapshot` is defined.
     * - `widget.saveable.revert` is defined.
     */
    protected canBeSavedAs(widget: Widget | undefined): widget is Widget & SaveableSource & Navigatable {
        return widget !== undefined
            && Saveable.isSource(widget)
            && typeof widget.saveable.createSnapshot === 'function'
            && typeof widget.saveable.revert === 'function'
            && Navigatable.is(widget)
            && widget.getResourceUri() !== undefined;
    }

    /**
     * Save `sourceWidget` to a new file picked by the user.
     */
    protected async saveAs(sourceWidget: Widget & SaveableSource & Navigatable): Promise<void> {
        let exist: boolean = false;
        let overwrite: boolean = false;
        let selected: URI | undefined;
        const uri = sourceWidget.getResourceUri()!;
        const stat = await this.fileService.resolve(uri);
        do {
            selected = await this.fileDialogService.showSaveDialog(
                {
                    title: WorkspaceCommands.SAVE_AS.label!,
                    filters: {},
                    inputValue: uri.path.base
                }, stat);
            if (selected) {
                exist = await this.fileService.exists(selected);
                if (exist) {
                    overwrite = await this.confirmOverwrite(selected);
                }
            }
        } while (selected && exist && !overwrite);
        if (selected && selected.isEqual(uri)) {
            await this.commandRegistry.executeCommand(CommonCommands.SAVE.id);
        } else if (selected) {
            try {
                await this.copyAndSave(sourceWidget, selected, overwrite);
            } catch (e) {
                console.warn(e);
            }
        }
    }

    /**
     * @param sourceWidget widget to save as `target`.
     * @param target The new URI for the widget.
     * @param overwrite
     */
    private async copyAndSave(sourceWidget: Widget & SaveableSource & Navigatable, target: URI, overwrite: boolean): Promise<void> {
        const snapshot = sourceWidget.saveable.createSnapshot!();
        if (!await this.fileService.exists(target)) {
            await this.fileService.copy(sourceWidget.getResourceUri()!, target, { overwrite });
        }
        const targetWidget = await open(this.openerService, target);
        const targetSaveable = Saveable.get(targetWidget);
        if (targetWidget && targetSaveable && targetSaveable.applySnapshot) {
            targetSaveable.applySnapshot(snapshot);
            await sourceWidget.saveable.revert!();
            sourceWidget.close();
            // At this point `targetWidget` should be `applicationShell.currentWidget` for the save command to pick up:
            await this.commandRegistry.executeCommand(CommonCommands.SAVE.id);
        } else {
            this.messageService.error('Could not apply changes to new file');
        }
    }

    protected updateWorkspaceStateKey(): WorkspaceState {
        if (this.workspaceService.opened) {
            return this.workspaceService.isMultiRootWorkspaceOpened ? 'folder' : 'workspace';
        }
        return 'empty';
    }

    private async confirmOverwrite(uri: URI): Promise<boolean> {
        // Electron already handles the confirmation so do not prompt again.
        if (this.isElectron()) {
            return true;
        }
        // Prompt users for confirmation before overwriting.
        const confirmed = await new ConfirmDialog({
            title: 'Overwrite',
            msg: `Do you really want to overwrite "${uri.toString()}"?`
        }).open();
        return !!confirmed;
    }

    private isElectron(): boolean {
        return environment.electron.is();
    }

    /**
     * Get the current workspace URI.
     *
     * @returns the current workspace URI.
     */
    private getCurrentWorkspaceUri(): URI | undefined {
        return this.workspaceService.workspace?.resource;
    }

}

export namespace WorkspaceFrontendContribution {

    /**
     * File filter for all Theia and VS Code workspace file types.
     */
    export const DEFAULT_FILE_FILTER: FileDialogTreeFilters = {
        'Theia Workspace (*.theia-workspace)': [THEIA_EXT],
        'VS Code Workspace (*.code-workspace)': [VSCODE_EXT]
    };

    /**
     * Returns with an `OpenFileDialogProps` for opening the `Open Workspace` dialog.
     */
    export function createOpenWorkspaceOpenFileDialogProps(options: Readonly<{ type: OS.Type, electron: boolean, supportMultiRootWorkspace: boolean }>): OpenFileDialogProps {
        const { electron, type, supportMultiRootWorkspace } = options;
        const title = WorkspaceCommands.OPEN_WORKSPACE.dialogLabel;
        // If browser
        if (!electron) {
            // and multi-root workspace is supported, it is always folder + workspace files.
            if (supportMultiRootWorkspace) {
                return {
                    title,
                    canSelectFiles: true,
                    canSelectFolders: true,
                    filters: DEFAULT_FILE_FILTER,
                    disableAllFilesFilter: true
                };
            } else {
                // otherwise, it is always folders. No files at all.
                return {
                    title,
                    canSelectFiles: false,
                    canSelectFolders: true,
                    disableAllFilesFilter: true
                };
            }
        }

        // If electron
        if (OS.Type.OSX === type) {
            // `Finder` can select folders and files at the same time. We allow folders and workspace files.
            return {
                title,
                canSelectFiles: true,
                canSelectFolders: true,
                filters: DEFAULT_FILE_FILTER,
                disableAllFilesFilter: true
            };
        }

        // In electron, only workspace files can be selected when the multi-root workspace feature is enabled.
        if (supportMultiRootWorkspace) {
            return {
                title,
                canSelectFiles: true,
                canSelectFolders: false,
                filters: DEFAULT_FILE_FILTER,
                disableAllFilesFilter: true
            };
        }

        // Otherwise, it is always a folder.
        return {
            title,
            canSelectFiles: false,
            canSelectFolders: true,
            disableAllFilesFilter: true
        };
    }

}
