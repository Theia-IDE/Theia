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

import { interfaces, Container } from 'inversify';
import { ProcessTask, TaskFactory, TaskProcessOptions } from './process-task';
import { ProcessTaskRunner } from './process-task-runner';
import { ProcessTaskRunnerContribution } from './process-task-runner-contribution';
import { TaskRunnerContribution } from '../task-runner';
import { TaskBackendMessagingContribution } from './task-backend-messaging-contribution';
import { MessagingService } from '@theia/core/lib/node/messaging/messaging-service';

export function bindProcessTaskRunnerModule(bind: interfaces.Bind) {

    bind(ProcessTask).toSelf().inTransientScope();
    bind(TaskFactory).toFactory(ctx =>
        (options: TaskProcessOptions) => {
            const child = new Container({ defaultScope: 'Singleton' });
            child.parent = ctx.container;
            child.bind(TaskProcessOptions).toConstantValue(options);
            return child.get(ProcessTask);
        }
    );
    bind(ProcessTaskRunner).toSelf().inSingletonScope();
    bind(ProcessTaskRunnerContribution).toSelf().inSingletonScope();
    bind(TaskRunnerContribution).toService(ProcessTaskRunnerContribution);

    bind(MessagingService.Contribution).to(TaskBackendMessagingContribution).inSingletonScope();
}
