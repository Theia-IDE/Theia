/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
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

import { inject, injectable } from 'inversify';
import { remote, FileFilter, OpenDialogOptions, SaveDialogOptions } from 'electron';
import URI from '@theia/core/lib/common/uri';
import { isOSX } from '@theia/core/lib/common/os';
import { MaybeArray } from '@theia/core/lib/common/types';
import { MessageService } from '@theia/core/lib/common/message-service';
import { FileStat } from '../../common';
import { FileAccess } from '../../common/filesystem';
import { DefaultFileDialogService, OpenFileDialogProps, SaveFileDialogProps, FileDialogTreeAllFilesPosition } from '../../browser/file-dialog';

// See https://github.com/electron/electron/blob/v4.2.12/docs/api/dialog.md
// These properties get extended with newer versions of Electron
type DialogProperties = 'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' |
    'createDirectory' | 'promptToCreate' | 'noResolveAliases' | 'treatPackageAsDirectory';

//
// We are OK to use this here because the electron backend and frontend are on the same host.
// If required, we can move this single service (and its module) to a dedicated Theia extension,
// and at packaging time, clients can decide whether they need the native or the browser-based
// solution.
//
import { FileUri } from '@theia/core/lib/node/file-uri';

@injectable()
export class ElectronFileDialogService extends DefaultFileDialogService {

    @inject(MessageService) protected readonly messageService: MessageService;

    async showOpenDialog(props: OpenFileDialogProps & { canSelectMany: true }, folder?: FileStat): Promise<MaybeArray<URI> | undefined>;
    async showOpenDialog(props: OpenFileDialogProps, folder?: FileStat): Promise<URI | undefined>;
    async showOpenDialog(props: OpenFileDialogProps, folder?: FileStat): Promise<MaybeArray<URI> | undefined> {
        const rootNode = await this.getRootNode(folder);
        if (rootNode) {
            return new Promise<MaybeArray<URI> | undefined>(resolve => {
                remote.dialog.showOpenDialog(this.toOpenDialogOptions(rootNode.uri, props), async (filePaths: string[] | undefined) => {
                    if (!filePaths || filePaths.length === 0) {
                        resolve(undefined);
                        return;
                    }

                    const uris = filePaths.map(path => FileUri.create(path));
                    const canAccess = await this.canReadWrite(uris);
                    const result = canAccess ? uris.length === 1 ? uris[0] : uris : undefined;
                    resolve(result);
                });
            });
        }
        return undefined;
    }

    async showSaveDialog(props: SaveFileDialogProps, folder?: FileStat): Promise<URI | undefined> {
        const rootNode = await this.getRootNode(folder);
        if (rootNode) {
            return new Promise<URI | undefined>(resolve => {
                remote.dialog.showSaveDialog(this.toSaveDialogOptions(rootNode.uri, props), async (filename: string | undefined) => {
                    if (!filename) {
                        resolve(undefined);
                        return;
                    }

                    const uri = FileUri.create(filename);
                    const exists = await this.fileSystem.exists(uri.toString());
                    if (!exists) {
                        resolve(uri);
                        return;
                    }

                    const canAccess = await this.canReadWrite(uri);
                    resolve(canAccess ? uri : undefined);
                });
            });
        }
        return undefined;
    }

    protected async canReadWrite(uris: MaybeArray<URI>): Promise<boolean> {
        for (const uri of Array.isArray(uris) ? uris : [uris]) {
            if (!(await this.fileSystem.access(uri.toString(), FileAccess.Constants.R_OK | FileAccess.Constants.W_OK))) {
                this.messageService.error(`Cannot access resource at ${uri.path}.`);
                return false;
            }
        }
        return true;
    }

    protected toDialogOptions(uri: URI, props: SaveFileDialogProps | OpenFileDialogProps, dialogTitle: string): electron.FileDialogProps {
        const title = props.title || dialogTitle;
        const defaultPath = FileUri.fsPath(uri);
        const allFilesFilter = { name: 'All Files', extensions: ['*'] };
        const filters: FileFilter[] = [];
        if (props.allFilesPosition === undefined || props.allFilesPosition === FileDialogTreeAllFilesPosition.FIRST) {
            filters.push(allFilesFilter);
        }
        if (props.filters) {
            filters.push(...Object.keys(props.filters).map(key => ({ name: key, extensions: props.filters![key] })));
        }
        if (props.allFilesPosition === FileDialogTreeAllFilesPosition.LAST) {
            filters.push(allFilesFilter);
        }
        return { title, defaultPath, filters };
    }

    protected toOpenDialogOptions(uri: URI, props: OpenFileDialogProps): OpenDialogOptions {
        const properties = electron.dialog.toDialogProperties(props);
        const buttonLabel = props.openLabel;
        return { ...this.toDialogOptions(uri, props, 'Open'), properties, buttonLabel };
    }

    protected toSaveDialogOptions(uri: URI, props: SaveFileDialogProps): SaveDialogOptions {
        const buttonLabel = props.saveLabel;
        const defaultPath = props.inputValue;
        return { ...this.toDialogOptions(uri, props, 'Save'), buttonLabel, defaultPath };
    }

}

export namespace electron {

    /**
     * Common "super" interface of the `electron.SaveDialogOptions` and `electron.OpenDialogOptions` types.
     */
    export interface FileDialogProps {

        /**
         * The dialog title.
         */
        readonly title?: string;

        /**
         * The default path, where the dialog opens. Requires an FS path.
         */
        readonly defaultPath?: string;

        /**
         * Resource filter.
         */
        readonly filters?: FileFilter[];

    }

    export namespace dialog {

        /**
         * Converts the Theia specific `OpenFileDialogProps` into an electron specific array.
         *
         * Note: On Windows and Linux an open dialog can not be both a file selector and a directory selector,
         * so if you set properties to ['openFile', 'openDirectory'] on these platforms, a directory selector will be shown.
         *
         * See: https://github.com/electron/electron/issues/10252#issuecomment-322012159
         */
        export function toDialogProperties(props: OpenFileDialogProps): Array<DialogProperties> {
            if (!isOSX && props.canSelectFiles !== false && props.canSelectFolders === true) {
                throw new Error(`Illegal props. Cannot have 'canSelectFiles' and 'canSelectFolders' at the same times. Props was: ${JSON.stringify(props)}.`);
            }
            const properties: Array<DialogProperties> = [];
            if (!isOSX) {
                if (props.canSelectFiles !== false && props.canSelectFolders !== true) {
                    properties.push('openFile');
                }
                if (props.canSelectFolders === true && props.canSelectFiles === false) {
                    properties.push('openDirectory');
                }
            } else {
                if (props.canSelectFiles !== false) {
                    properties.push('openFile');
                }
                if (props.canSelectFolders === true) {
                    properties.push('openDirectory');
                    properties.push('createDirectory');
                }
            }
            if (props.canSelectMany === true) {
                properties.push('multiSelections');
            }
            return properties;
        }
    }
}
