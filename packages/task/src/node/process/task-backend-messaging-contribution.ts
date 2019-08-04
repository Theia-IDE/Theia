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

import { injectable, inject, named } from 'inversify';
import { ILogger } from '@theia/core/lib/common';
import { TaskManager } from '..';
import { tasksPath } from '../../common/task-protocol';
import { MessagingService } from '@theia/core/lib/node/messaging/messaging-service';
import { TaskRunnerRegistry } from '../task-runner';

@injectable()
export class TaskBackendMessagingContribution implements MessagingService.Contribution {

    @inject(TaskManager)
    protected readonly taskManager: TaskManager;

    @inject(TaskRunnerRegistry)
    protected readonly taskRunnerRegistry: TaskRunnerRegistry;

    @inject(ILogger) @named('terminal')
    protected readonly logger: ILogger;

    configure(service: MessagingService): void {
        service.listen(`${tasksPath}/:id`, (params: MessagingService.PathParams, connection) => {
            const id = parseInt(params.id, 10);
            const task = this.taskManager.get(id);
            if (task) {
                task.initClientConnection(connection);
            } else {
                connection.dispose();
            }
        });
    }
}
