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

import { OpenDialogOptionsMain, SaveDialogOptionsMain, DialogsMain, UploadDialogOptionsMain, PLUGIN_RPC_CONTEXT } from '../../common/plugin-api-rpc';
import { injectable, inject } from 'inversify';
import { DirNode, OpenFileDialogProps, SaveFileDialogProps, OpenFileDialogFactory, SaveFileDialogFactory } from '@theia/filesystem/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { FileSystem, FileStat } from '@theia/filesystem/lib/common';
import { UriSelection } from '@theia/core/lib/common/selection';
import { RPCProtocolServiceProvider } from './main-context';
import { ProxyIdentifier } from '../../common/rpc-protocol';
import { FileUploadService } from '@theia/filesystem/lib/browser/file-upload-service';

@injectable()
export class DialogsMainImpl implements DialogsMain, RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any> = PLUGIN_RPC_CONTEXT.DIALOGS_MAIN;

    @inject(WorkspaceService)
    private workspaceService: WorkspaceService;

    @inject(FileSystem)
    private fileSystem: FileSystem;

    @inject(OpenFileDialogFactory)
    private openFileDialogFactory: OpenFileDialogFactory;

    @inject(SaveFileDialogFactory)
    private saveFileDialogFactory: SaveFileDialogFactory;

    @inject(FileUploadService)
    private uploadService: FileUploadService;

    protected async getRootUri(defaultUri: string | undefined): Promise<FileStat | undefined> {
        let rootStat;

        // Try to use default URI as root
        if (defaultUri) {
            rootStat = await this.fileSystem.getFileStat(defaultUri);
        }

        // Try to use workspace service root if there is no preconfigured URI
        if (!rootStat) {
            rootStat = (await this.workspaceService.roots)[0];
        }

        // Try to use current user home if root folder is still not taken
        if (!rootStat) {
            rootStat = await this.fileSystem.getCurrentUserHome();
        }

        return rootStat;
    }

    async $showOpenDialog(options: OpenDialogOptionsMain): Promise<string[] | undefined> {
        const rootStat = await this.getRootUri(options.defaultUri ? options.defaultUri : undefined);

        // Fail if root not fount
        if (!rootStat) {
            throw new Error('Unable to find the rootStat');
        }

        // Take the info for root node
        const rootNode = DirNode.createRoot(rootStat);

        try {
            // Determine proper title for the dialog
            const canSelectFiles = typeof options.canSelectFiles === 'boolean' ? options.canSelectFiles : true;
            const canSelectFolders = typeof options.canSelectFolders === 'boolean' ? options.canSelectFolders : true;

            let title;
            if (canSelectFiles && canSelectFolders) {
                title = 'Open';
            } else {
                if (canSelectFiles) {
                    title = 'Open File';
                } else {
                    title = 'Open Folder';
                }

                if (options.canSelectMany) {
                    title += '(s)';
                }
            }

            // Create open file dialog props
            const dialogProps = {
                title: title,
                openLabel: options.openLabel,
                canSelectFiles: options.canSelectFiles,
                canSelectFolders: options.canSelectFolders,
                canSelectMany: options.canSelectMany,
                filters: options.filters
            } as OpenFileDialogProps;

            // Show open file dialog
            const dialog = this.openFileDialogFactory(dialogProps);
            dialog.model.navigateTo(rootNode);
            const result = await dialog.open();

            // Return the result
            return UriSelection.getUris(result).map(uri => uri.path.toString());
        } catch (error) {
            console.error(error);
        }

        return undefined;
    }

    async $showSaveDialog(options: SaveDialogOptionsMain): Promise<string | undefined> {
        const rootStat = await this.getRootUri(options.defaultUri ? options.defaultUri : undefined);

        // Fail if root not fount
        if (!rootStat) {
            throw new Error('Unable to find the rootStat');
        }

        // Take the info for root node
        const rootNode = DirNode.createRoot(rootStat);

        try {
            // Create save file dialog props
            const dialogProps = {
                title: 'Save',
                saveLabel: options.saveLabel,
                filters: options.filters
            } as SaveFileDialogProps;

            // Show save file dialog
            const dialog = this.saveFileDialogFactory(dialogProps);
            dialog.model.navigateTo(rootNode);
            const result = await dialog.open();

            // Return the result
            if (result) {
                return result.path.toString();
            }

            return undefined;
        } catch (error) {
            console.error(error);
        }

        return undefined;
    }

    async $showUploadDialog(options: UploadDialogOptionsMain): Promise<string[] | undefined> {
        const rootStat = await this.getRootUri(options.defaultUri);

        // Fail if root not fount
        if (!rootStat) {
            throw new Error('Failed to resolve base directory where files should be uploaded');
        }

        const uploadResult = await this.uploadService.upload(rootStat.uri);

        if (uploadResult) {
            return uploadResult.uploaded;
        }

        return undefined;
    }

}
