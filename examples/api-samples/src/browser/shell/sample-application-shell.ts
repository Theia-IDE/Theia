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
import { inject, injectable, interfaces } from 'inversify';
import { SaveOptions } from '@theia/core/lib/browser/saveable';
import { MessageService } from '@theia/core/lib/common/message-service';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { ConnectionStatus, FrontendConnectionStatusService } from '@theia/core/lib/browser/connection-status-service';

@injectable()
export class SampleApplicationShell extends ApplicationShell {

    @inject(MessageService)
    protected messageService: MessageService;

    @inject(FrontendConnectionStatusService)
    protected connectionStatusService: FrontendConnectionStatusService;

    async saveAll(options?: SaveOptions): Promise<void> {
        try {
            await super.saveAll(options);
        } catch (error) {
            this.handleError(error);
        }
    }

    async save(options?: SaveOptions): Promise<void> {
        try {
            await super.save(options);
        } catch (error) {
            this.handleError(error);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private handleError(error: any): void {
        const message = this.connectionStatusService.currentStatus === ConnectionStatus.OFFLINE
            ? 'The backend process is not running. Please copy your unsaved work into your favorite text editor, and restart the IDE.'
            : error instanceof Error ? error.message : String(error);
        this.messageService.error(`Could not save the changes. ${message}`);
    }

}

export const bindSampleShell = (bind: interfaces.Bind, unbind: interfaces.Unbind, isBound: interfaces.IsBound, rebind: interfaces.Rebind) => {
    bind(SampleApplicationShell).toSelf().inSingletonScope();
    rebind(ApplicationShell).toService(SampleApplicationShell);
};
