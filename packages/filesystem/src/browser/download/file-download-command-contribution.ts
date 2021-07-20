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

import { inject, injectable } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { isChrome } from '@theia/core/lib/browser/browser';
import { environment } from '@theia/core/shared/@theia/application-package/lib/environment';
import { SelectionService } from '@theia/core/lib/common/selection-service';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { UriAwareCommandHandler } from '@theia/core/lib/common/uri-command-handler';
import { FileDownloadService } from './file-download-service';
import { nls } from '@theia/core/lib/browser/nls';

@injectable()
export class FileDownloadCommandContribution implements CommandContribution {

    @inject(FileDownloadService)
    protected readonly downloadService: FileDownloadService;

    @inject(SelectionService)
    protected readonly selectionService: SelectionService;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(
            FileDownloadCommands.DOWNLOAD,
            UriAwareCommandHandler.MultiSelect(this.selectionService, {
                execute: uris => this.executeDownload(uris),
                isEnabled: uris => this.isDownloadEnabled(uris),
                isVisible: uris => this.isDownloadVisible(uris),
            })
        );
        registry.registerCommand(
            FileDownloadCommands.COPY_DOWNLOAD_LINK,
            UriAwareCommandHandler.MultiSelect(this.selectionService, {
                execute: uris => this.executeDownload(uris, { copyLink: true }),
                isEnabled: uris => isChrome && this.isDownloadEnabled(uris),
                isVisible: uris => isChrome && this.isDownloadVisible(uris),
            })
        );
    }

    protected async executeDownload(uris: URI[], options?: { copyLink?: boolean }): Promise<void> {
        this.downloadService.download(uris, options);
    }

    protected isDownloadEnabled(uris: URI[]): boolean {
        return !environment.electron.is() && uris.length > 0 && uris.every(u => u.scheme === 'file');
    }

    protected isDownloadVisible(uris: URI[]): boolean {
        return this.isDownloadEnabled(uris);
    }

}

export namespace FileDownloadCommands {

    export const DOWNLOAD: Command = {
        id: 'file.download',
        category: 'File',
        label: nls.localize('file.download', 'Download')
    };

    export const COPY_DOWNLOAD_LINK: Command = {
        id: 'file.copyDownloadLink',
        category: 'File',
        label: nls.localize('file.copyDownloadLink', 'Copy Download Link')
    };

}
