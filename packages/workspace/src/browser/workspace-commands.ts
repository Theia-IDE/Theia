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

import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { SelectionService } from '@theia/core/lib/common/selection-service';
import { ApplicationServer } from '@theia/core/lib/common/application-protocol';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common/menu';
import { CommonMenus } from '@theia/core/lib/browser/common-frontend-contribution';
import { FileDialogService } from '@theia/filesystem/lib/browser';
import { SingleTextInputDialog, ConfirmDialog } from '@theia/core/lib/browser/dialogs';
import { OpenerService, OpenHandler, open, FrontendApplication, LabelProvider } from '@theia/core/lib/browser';
import { UriCommandHandler, UriAwareCommandHandler } from '@theia/core/lib/common/uri-command-handler';
import { WorkspaceService } from './workspace-service';
import { MessageService } from '@theia/core/lib/common/message-service';
import { WorkspacePreferences } from './workspace-preferences';
import { WorkspaceDeleteHandler } from './workspace-delete-handler';
import { WorkspaceDuplicateHandler } from './workspace-duplicate-handler';
import { FileSystemUtils } from '@theia/filesystem/lib/common';
import { WorkspaceCompareHandler } from './workspace-compare-handler';
import { FileDownloadCommands } from '@theia/filesystem/lib/browser/download/file-download-command-contribution';
import { FileSystemCommands } from '@theia/filesystem/lib/browser/filesystem-frontend-contribution';
import { WorkspaceInputDialog } from './workspace-input-dialog';
import { Emitter, Event, OS } from '@theia/core/lib/common';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileStat } from '@theia/filesystem/lib/common/files';

const validFilename: (arg: string) => boolean = require('valid-filename');

export namespace WorkspaceCommands {

    const WORKSPACE_CATEGORY = 'Workspace';
    const FILE_CATEGORY = 'File';

    // On Linux and Windows, both files and folders cannot be opened at the same time in electron.
    // `OPEN_FILE` and `OPEN_FOLDER` must be available only on Linux and Windows in electron.
    // `OPEN` must *not* be available on Windows and Linux in electron.
    // VS Code does the same. See: https://github.com/eclipse-theia/theia/pull/3202#issuecomment-430585357
    export const OPEN: Command & { dialogLabel: string } = {
        id: 'workspace:open',
        category: FILE_CATEGORY,
        label: 'Open...',
        dialogLabel: 'Open'
    };
    // No `label`. Otherwise, it shows up in the `Command Palette`.
    export const OPEN_FILE: Command & { dialogLabel: string } = {
        id: 'workspace:openFile',
        category: FILE_CATEGORY,
        dialogLabel: 'Open File'
    };
    export const OPEN_FOLDER: Command & { dialogLabel: string } = {
        id: 'workspace:openFolder',
        dialogLabel: 'Open Folder' // No `label`. Otherwise, it shows up in the `Command Palette`.
    };
    export const OPEN_WORKSPACE: Command & { dialogLabel: string } = {
        id: 'workspace:openWorkspace',
        category: FILE_CATEGORY,
        label: 'Open Workspace...',
        dialogLabel: 'Open Workspace'
    };
    export const OPEN_RECENT_WORKSPACE: Command = {
        id: 'workspace:openRecent',
        category: FILE_CATEGORY,
        label: 'Open Recent Workspace...'
    };
    export const CLOSE: Command = {
        id: 'workspace:close',
        category: WORKSPACE_CATEGORY,
        label: 'Close Workspace'
    };
    export const NEW_FILE: Command = {
        id: 'file.newFile',
        category: FILE_CATEGORY,
        label: 'New File'
    };
    export const NEW_FOLDER: Command = {
        id: 'file.newFolder',
        category: FILE_CATEGORY,
        label: 'New Folder'
    };
    export const FILE_OPEN_WITH = (opener: OpenHandler): Command => ({
        id: `file.openWith.${opener.id}`
    });
    export const FILE_RENAME: Command = {
        id: 'file.rename',
        category: FILE_CATEGORY,
        label: 'Rename'
    };
    export const FILE_DELETE: Command = {
        id: 'file.delete',
        category: FILE_CATEGORY,
        label: 'Delete'
    };
    export const FILE_DUPLICATE: Command = {
        id: 'file.duplicate',
        category: FILE_CATEGORY,
        label: 'Duplicate'
    };
    export const FILE_COMPARE: Command = {
        id: 'file.compare',
        category: FILE_CATEGORY,
        label: 'Compare with Each Other'
    };
    export const ADD_FOLDER: Command = {
        id: 'workspace:addFolder',
        category: WORKSPACE_CATEGORY,
        label: 'Add Folder to Workspace...'
    };
    export const REMOVE_FOLDER: Command = {
        id: 'workspace:removeFolder',
        category: WORKSPACE_CATEGORY,
        label: 'Remove Folder from Workspace'
    };
    export const SAVE_WORKSPACE_AS: Command = {
        id: 'workspace:saveAs',
        category: WORKSPACE_CATEGORY,
        label: 'Save Workspace As...'
    };
    export const OPEN_WORKSPACE_FILE: Command = {
        id: 'workspace:openConfigFile',
        category: WORKSPACE_CATEGORY,
        label: 'Open Workspace Configuration File'
    };
    export const SAVE_AS: Command = {
        id: 'file.saveAs',
        category: 'File',
        label: 'Save As...',
    };
}

@injectable()
export class FileMenuContribution implements MenuContribution {

    registerMenus(registry: MenuModelRegistry): void {
        registry.registerMenuAction(CommonMenus.FILE_NEW, {
            commandId: WorkspaceCommands.NEW_FILE.id
        });
        registry.registerMenuAction(CommonMenus.FILE_NEW, {
            commandId: WorkspaceCommands.NEW_FOLDER.id
        });
        const downloadUploadMenu = [...CommonMenus.FILE, '4_downloadupload'];
        registry.registerMenuAction(downloadUploadMenu, {
            commandId: FileSystemCommands.UPLOAD.id,
            order: 'a'
        });
        registry.registerMenuAction(downloadUploadMenu, {
            commandId: FileDownloadCommands.DOWNLOAD.id,
            order: 'b'
        });
    }

}

@injectable()
export class EditMenuContribution implements MenuContribution {

    registerMenus(registry: MenuModelRegistry): void {
        registry.registerMenuAction(CommonMenus.EDIT_CLIPBOARD, {
            commandId: FileDownloadCommands.COPY_DOWNLOAD_LINK.id,
            order: '9999'
        });
    }

}

export interface DidCreateNewResourceEvent {
    uri: URI
    parent: URI
}

@injectable()
export class WorkspaceCommandContribution implements CommandContribution {

    @inject(LabelProvider) protected readonly labelProvider: LabelProvider;
    @inject(FileService) protected readonly fileService: FileService;
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(SelectionService) protected readonly selectionService: SelectionService;
    @inject(OpenerService) protected readonly openerService: OpenerService;
    @inject(FrontendApplication) protected readonly app: FrontendApplication;
    @inject(MessageService) protected readonly messageService: MessageService;
    @inject(WorkspacePreferences) protected readonly preferences: WorkspacePreferences;
    @inject(FileDialogService) protected readonly fileDialogService: FileDialogService;
    @inject(WorkspaceDeleteHandler) protected readonly deleteHandler: WorkspaceDeleteHandler;
    @inject(WorkspaceDuplicateHandler) protected readonly duplicateHandler: WorkspaceDuplicateHandler;
    @inject(WorkspaceCompareHandler) protected readonly compareHandler: WorkspaceCompareHandler;
    @inject(ApplicationServer) protected readonly applicationServer: ApplicationServer;

    private readonly onDidCreateNewFileEmitter = new Emitter<DidCreateNewResourceEvent>();
    private readonly onDidCreateNewFolderEmitter = new Emitter<DidCreateNewResourceEvent>();

    protected backendOS: Promise<OS.Type>;

    @postConstruct()
    async init(): Promise<void> {
        this.backendOS = this.applicationServer.getBackendOS();
    };

    get onDidCreateNewFile(): Event<DidCreateNewResourceEvent> {
        return this.onDidCreateNewFileEmitter.event;
    }

    get onDidCreateNewFolder(): Event<DidCreateNewResourceEvent> {
        return this.onDidCreateNewFolderEmitter.event;
    }

    protected fireCreateNewFile(uri: DidCreateNewResourceEvent): void {
        this.onDidCreateNewFileEmitter.fire(uri);
    }

    protected fireCreateNewFolder(uri: DidCreateNewResourceEvent): void {
        this.onDidCreateNewFolderEmitter.fire(uri);
    }

    registerCommands(registry: CommandRegistry): void {
        this.registerOpenWith(registry);
        registry.registerCommand(WorkspaceCommands.NEW_FILE, this.newWorkspaceRootUriAwareCommandHandler({
            execute: uri => this.getDirectory(uri).then(parent => {
                if (parent) {
                    const parentUri = parent.resource;
                    const { fileName, fileExtension } = this.getDefaultFileConfig();
                    const vacantChildUri = FileSystemUtils.generateUniqueResourceURI(parentUri, parent, fileName, fileExtension);

                    const dialog = new WorkspaceInputDialog({
                        title: 'New File',
                        parentUri: parentUri,
                        initialValue: vacantChildUri.path.base,
                        validate: name => this.validateFileName(name, parent, true)
                    }, this.labelProvider);

                    dialog.open().then(async name => {
                        if (name) {
                            const fileUri = parentUri.resolve(name);
                            await this.fileService.create(fileUri);
                            this.fireCreateNewFile({ parent: parentUri, uri: fileUri });
                            open(this.openerService, fileUri);
                        }
                    });
                }
            })
        }));
        registry.registerCommand(WorkspaceCommands.NEW_FOLDER, this.newWorkspaceRootUriAwareCommandHandler({
            execute: uri => this.getDirectory(uri).then(parent => {
                if (parent) {
                    const parentUri = parent.resource;
                    const vacantChildUri = FileSystemUtils.generateUniqueResourceURI(parentUri, parent, 'Untitled');
                    const dialog = new WorkspaceInputDialog({
                        title: 'New Folder',
                        parentUri: parentUri,
                        initialValue: vacantChildUri.path.base,
                        validate: name => this.validateFileName(name, parent, true)
                    }, this.labelProvider);
                    dialog.open().then(async name => {
                        if (name) {
                            const folderUri = parentUri.resolve(name);
                            await this.fileService.createFolder(folderUri);
                            this.fireCreateNewFile({ parent: parentUri, uri: folderUri });
                        }
                    });
                }
            })
        }));
        registry.registerCommand(WorkspaceCommands.FILE_RENAME, this.newMultiUriAwareCommandHandler({
            isEnabled: uris => uris.some(uri => !this.isWorkspaceRoot(uri)) && uris.length === 1,
            isVisible: uris => uris.some(uri => !this.isWorkspaceRoot(uri)) && uris.length === 1,
            execute: (uris): void => {
                uris.forEach(async uri => {
                    const parent = await this.getParent(uri);
                    if (parent) {
                        const initialValue = uri.path.base;
                        const stat = await this.fileService.resolve(uri);
                        const fileType = stat.isDirectory ? 'Directory' : 'File';
                        const titleStr = `Rename ${fileType}`;
                        const dialog = new SingleTextInputDialog({
                            title: titleStr,
                            initialValue,
                            initialSelectionRange: {
                                start: 0,
                                end: uri.path.name.length
                            },
                            validate: async (name, mode) => {
                                if (initialValue === name && mode === 'preview') {
                                    return false;
                                }
                                const allowOverwrite = await this.backendOS === OS.Type.Windows
                                    && parent.resource.resolve(name).isEqual(parent.resource.resolve(initialValue), false);

                                return this.validateFileRename(name, parent, initialValue, allowOverwrite);
                            }
                        });
                        const fileName = await dialog.open();
                        if (fileName) {
                            const oldUri = uri;
                            const newUri = uri.parent.resolve(fileName);
                            this.fileService.move(oldUri, newUri);
                        }
                    }
                });
            }
        }));
        registry.registerCommand(WorkspaceCommands.FILE_DUPLICATE, this.newMultiUriAwareCommandHandler(this.duplicateHandler));
        registry.registerCommand(WorkspaceCommands.FILE_DELETE, this.newMultiUriAwareCommandHandler(this.deleteHandler));
        registry.registerCommand(WorkspaceCommands.FILE_COMPARE, this.newMultiUriAwareCommandHandler(this.compareHandler));
        this.preferences.ready.then(() => {
            registry.registerCommand(WorkspaceCommands.ADD_FOLDER, {
                isEnabled: () => this.workspaceService.isMultiRootWorkspaceEnabled,
                isVisible: () => this.workspaceService.isMultiRootWorkspaceEnabled,
                execute: async () => {
                    const selection = await this.fileDialogService.showOpenDialog({
                        title: WorkspaceCommands.ADD_FOLDER.label!,
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: true,
                    });
                    if (!selection) {
                        return;
                    }
                    const uris = Array.isArray(selection) ? selection : [selection];
                    const workspaceSavedBeforeAdding = this.workspaceService.saved;
                    await this.addFolderToWorkspace(...uris);
                    if (!workspaceSavedBeforeAdding) {
                        const saveCommand = registry.getCommand(WorkspaceCommands.SAVE_WORKSPACE_AS.id);
                        if (saveCommand && await new ConfirmDialog({
                            title: 'Folder added to Workspace',
                            msg: 'A workspace with multiple roots was created. Do you want to save your workspace configuration as a file?',
                            ok: 'Yes',
                            cancel: 'No'
                        }).open()) {
                            registry.executeCommand(saveCommand.id);
                        }
                    }
                }
            });
            registry.registerCommand(WorkspaceCommands.REMOVE_FOLDER, this.newMultiUriAwareCommandHandler({
                execute: uris => this.removeFolderFromWorkspace(uris),
                isEnabled: () => this.workspaceService.isMultiRootWorkspaceEnabled,
                isVisible: uris => this.areWorkspaceRoots(uris) && this.workspaceService.saved
            }));
        });
    }

    openers: OpenHandler[];
    protected async registerOpenWith(registry: CommandRegistry): Promise<void> {
        if (this.openerService.onDidChangeOpeners) {
            this.openerService.onDidChangeOpeners(async e => {
                this.openers = await this.openerService.getOpeners();
            });
        }
        this.openers = await this.openerService.getOpeners();
        for (const opener of this.openers) {
            const openWithCommand = WorkspaceCommands.FILE_OPEN_WITH(opener);
            registry.registerCommand(openWithCommand, this.newUriAwareCommandHandler({
                execute: uri => opener.open(uri),
                isEnabled: uri => opener.canHandle(uri) > 0,
                isVisible: uri => opener.canHandle(uri) > 0 && this.areMultipleOpenHandlersPresent(this.openers, uri)
            }));
        }
    }

    protected newUriAwareCommandHandler(handler: UriCommandHandler<URI>): UriAwareCommandHandler<URI> {
        return UriAwareCommandHandler.MonoSelect(this.selectionService, handler);
    }

    protected newMultiUriAwareCommandHandler(handler: UriCommandHandler<URI[]>): UriAwareCommandHandler<URI[]> {
        return UriAwareCommandHandler.MultiSelect(this.selectionService, handler);
    }

    protected newWorkspaceRootUriAwareCommandHandler(handler: UriCommandHandler<URI>): WorkspaceRootUriAwareCommandHandler {
        return new WorkspaceRootUriAwareCommandHandler(this.workspaceService, this.selectionService, handler);
    }

    protected async validateFileRename(name: string, parent: FileStat, initialValue: string, allowOverwrite: boolean = false): Promise<string> {
        if (allowOverwrite) {
            return '';
        }
        return this.validateFileName(name, parent, false);
    }

    /**
     * Returns an error message if the file name is invalid. Otherwise, an empty string.
     *
     * @param name the simple file name of the file to validate.
     * @param parent the parent directory's file stat.
     * @param allowNested allow file or folder creation using recursive path
     */
    protected async validateFileName(name: string, parent: FileStat, allowNested: boolean = false): Promise<string> {
        if (!name) {
            return '';
        }
        // do not allow recursive rename
        if (!allowNested && !validFilename(name)) {
            return 'Invalid file or folder name';
        }
        if (name.startsWith('/')) {
            return 'Absolute paths or names that starts with / are not allowed';
        } else if (name.startsWith(' ') || name.endsWith(' ')) {
            return 'Names with leading or trailing whitespaces are not allowed';
        }
        // check and validate each sub-paths
        if (name.split(/[\\/]/).some(file => !file || !validFilename(file) || /^\s+$/.test(file))) {
            return `The name "${this.trimFileName(name)}" is not a valid file or folder name.`;
        }
        const childUri = parent.resource.resolve(name);
        const exists = await this.fileService.exists(childUri);
        if (exists) {
            return `A file or folder "${this.trimFileName(name)}" already exists at this location.`;
        }
        return '';
    }

    protected trimFileName(name: string): string {
        if (name && name.length > 30) {
            return `${name.substr(0, 30)}...`;
        }
        return name;
    }

    protected async getDirectory(candidate: URI): Promise<FileStat | undefined> {
        let stat: FileStat | undefined;
        try {
            stat = await this.fileService.resolve(candidate);
        } catch { }
        if (stat && stat.isDirectory) {
            return stat;
        }
        return this.getParent(candidate);
    }

    protected async getParent(candidate: URI): Promise<FileStat | undefined> {
        try {
            return await this.fileService.resolve(candidate.parent);
        } catch {
            return undefined;
        }
    }

    protected async addFolderToWorkspace(...uris: URI[]): Promise<void> {
        if (uris.length) {
            const foldersToAdd = [];
            try {
                for (const uri of uris) {
                    const stat = await this.fileService.resolve(uri);
                    if (stat.isDirectory) {
                        foldersToAdd.push(uri);
                    }
                }
                await this.workspaceService.addRoot(foldersToAdd);
            } catch { }
        }
    }

    protected areWorkspaceRoots(uris: URI[]): boolean {
        return this.workspaceService.areWorkspaceRoots(uris);
    }

    protected isWorkspaceRoot(uri: URI): boolean {
        const rootUris = new Set(this.workspaceService.tryGetRoots().map(root => root.resource.toString()));
        return rootUris.has(uri.toString());
    }

    protected getDefaultFileConfig(): { fileName: string, fileExtension: string } {
        return {
            fileName: 'Untitled',
            fileExtension: '.txt'
        };
    }

    /**
     * Removes the list of folders from the workspace upon confirmation from the user.
     * @param uris the list of folder uris to remove.
     */
    protected async removeFolderFromWorkspace(uris: URI[]): Promise<void> {
        const roots = new Set(this.workspaceService.tryGetRoots().map(root => root.resource.toString()));
        const toRemove = uris.filter(uri => roots.has(uri.toString()));
        if (toRemove.length > 0) {
            const messageContainer = document.createElement('div');
            messageContainer.textContent = `Are you sure you want to remove the following folder${toRemove.length > 1 ? 's' : ''} from the workspace?`;
            messageContainer.title = 'Note: Nothing will be erased from disk';
            const list = document.createElement('div');
            list.classList.add('theia-dialog-node');
            toRemove.forEach(uri => {
                const listItem = document.createElement('div');
                listItem.classList.add('theia-dialog-node-content');
                const folderIcon = document.createElement('span');
                folderIcon.classList.add('codicon', 'codicon-root-folder', 'theia-dialog-icon');
                listItem.appendChild(folderIcon);
                listItem.title = this.labelProvider.getLongName(uri);
                const listContent = document.createElement('span');
                listContent.classList.add('theia-dialog-node-segment');
                listContent.appendChild(document.createTextNode(this.labelProvider.getName(uri)));
                listItem.appendChild(listContent);
                list.appendChild(listItem);
            });
            messageContainer.appendChild(list);
            const dialog = new ConfirmDialog({
                title: 'Remove Folder from Workspace',
                msg: messageContainer
            });
            if (await dialog.open()) {
                await this.workspaceService.removeRoots(toRemove);
            }
        }
    }

    protected areMultipleOpenHandlersPresent(openers: OpenHandler[], uri: URI): boolean {
        let count = 0;
        for (const opener of openers) {
            if (opener.canHandle(uri) > 0) {
                count++;
            }
            if (count > 1) {
                return true;
            }
        }
        return false;
    }
}

export class WorkspaceRootUriAwareCommandHandler extends UriAwareCommandHandler<URI> {

    constructor(
        protected readonly workspaceService: WorkspaceService,
        protected readonly selectionService: SelectionService,
        protected readonly handler: UriCommandHandler<URI>
    ) {
        super(selectionService, handler);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public isEnabled(...args: any[]): boolean {
        return super.isEnabled(...args) && !!this.workspaceService.tryGetRoots().length;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public isVisible(...args: any[]): boolean {
        return super.isVisible(...args) && !!this.workspaceService.tryGetRoots().length;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected getUri(...args: any[]): URI | undefined {
        const uri = super.getUri(...args);
        // Return the `uri` immediately if the resource exists in any of the workspace roots and is of `file` scheme.
        if (uri && uri.scheme === 'file' && this.workspaceService.getWorkspaceRootUri(uri)) {
            return uri;
        }
        // Return the first root if available.
        if (!!this.workspaceService.tryGetRoots().length) {
            return this.workspaceService.tryGetRoots()[0].resource;
        }
    }

}
