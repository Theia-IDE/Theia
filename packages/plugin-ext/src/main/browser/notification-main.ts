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

import { NotificationMain, PLUGIN_RPC_CONTEXT } from '../../common/plugin-api-rpc';
import { ProgressService, Progress, ProgressMessage } from '@theia/core/lib/common';
import { inject, injectable } from 'inversify';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { RPCProtocolServiceProvider } from './main-context';
import { ProxyIdentifier } from '../../common/rpc-protocol';

@injectable()
export class NotificationMainImpl implements NotificationMain, Disposable, RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any> = PLUGIN_RPC_CONTEXT.NOTIFICATION_MAIN;

    @inject(ProgressService)
    private readonly progressService: ProgressService;

    private readonly progressMap = new Map<string, Progress>();
    private readonly progress2Work = new Map<string, number>();

    protected readonly toDispose = new DisposableCollection(
        Disposable.create(() => { /* mark as not disposed */ })
    );

    dispose(): void {
        this.toDispose.dispose();
    }

    async $startProgress(options: NotificationMain.StartProgressOptions): Promise<string> {
        const progressMessage = this.mapOptions(options);
        const progress = await this.progressService.showProgress(progressMessage);
        const id = progress.id;
        this.progressMap.set(id, progress);
        this.progress2Work.set(id, 0);
        if (this.toDispose.disposed) {
            this.$stopProgress(id);
        } else {
            this.toDispose.push(Disposable.create(() => this.$stopProgress(id)));
        }
        return id;
    }
    protected mapOptions(options: NotificationMain.StartProgressOptions): ProgressMessage {
        const { title, location, cancellable } = options;
        return { text: title, options: { location, cancelable: cancellable } };
    }

    $stopProgress(id: string): void {
        const progress = this.progressMap.get(id);
        if (progress) {
            progress.cancel();
            this.progressMap.delete(id);
            this.progress2Work.delete(id);
        }
    }

    $updateProgress(id: string, item: NotificationMain.ProgressReport): void {
        const progress = this.progressMap.get(id);
        if (!progress) {
            return;
        }
        const done = Math.min((this.progress2Work.get(id) || 0) + (item.increment || 0), 100);
        this.progress2Work.set(id, done);
        progress.report({ message: item.message, work: done ? { done, total: 100 } : undefined });
    }
}
