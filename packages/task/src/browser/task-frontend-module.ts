/********************************************************************************
 * Copyright (C) 2017 Ericsson and others.
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

import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution, KeybindingContribution } from '@theia/core/lib/browser';
import { CommandContribution, MenuContribution, bindContributionProvider } from '@theia/core/lib/common';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser/messaging';
import { QuickOpenTask, TaskTerminateQuickOpen, TaskRestartRunningQuickOpen, TaskRunningQuickOpen } from './quick-open-task';
import { TaskContribution, TaskProviderRegistry, TaskResolverRegistry } from './task-contribution';
import { TaskService } from './task-service';
import { TaskConfigurations } from './task-configurations';
import { ProvidedTaskConfigurations } from './provided-task-configurations';
import { TaskFrontendContribution } from './task-frontend-contribution';
import { createCommonBindings } from '../common/task-common-module';
import { TaskServer, taskPath } from '../common/task-protocol';
import { TaskWatcher } from '../common/task-watcher';
import { bindProcessTaskModule } from './process/process-task-frontend-module';
import { TaskSchemaUpdater } from './task-schema-updater';
import { TaskDefinitionRegistry } from './task-definition-registry';
import { ProblemMatcherRegistry } from './task-problem-matcher-registry';
import { ProblemPatternRegistry } from './task-problem-pattern-registry';
import { TaskConfigurationManager } from './task-configuration-manager';
import { bindTaskPreferences } from './task-preferences';
import '../../src/browser/style/index.css';
import './tasks-monaco-contribution';
import { TaskNameResolver } from './task-name-resolver';
import { TaskSourceResolver } from './task-source-resolver';
import { TaskTemplateSelector } from './task-templates';
import { TaskTerminalWidgetManager } from './task-terminal-widget-manager';
import { JsonSchemaContribution } from '@theia/core/lib/browser/json-schema-store';
import { QuickAccessContribution } from '@theia/core/lib/browser/quick-input/quick-access';

export default new ContainerModule(bind => {
    bind(TaskFrontendContribution).toSelf().inSingletonScope();
    bind(TaskService).toSelf().inSingletonScope();

    for (const identifier of [FrontendApplicationContribution, CommandContribution, KeybindingContribution, MenuContribution, QuickAccessContribution]) {
        bind(identifier).toService(TaskFrontendContribution);
    }

    bind(QuickOpenTask).toSelf().inSingletonScope();
    bind(TaskRunningQuickOpen).toSelf().inSingletonScope();
    bind(TaskTerminateQuickOpen).toSelf().inSingletonScope();
    bind(TaskRestartRunningQuickOpen).toSelf().inSingletonScope();
    bind(TaskConfigurations).toSelf().inSingletonScope();
    bind(ProvidedTaskConfigurations).toSelf().inSingletonScope();
    bind(TaskConfigurationManager).toSelf().inSingletonScope();

    bind(TaskServer).toDynamicValue(ctx => {
        const connection = ctx.container.get(WebSocketConnectionProvider);
        const taskWatcher = ctx.container.get(TaskWatcher);
        return connection.createProxy<TaskServer>(taskPath, taskWatcher.getTaskClient());
    }).inSingletonScope();

    bind(TaskDefinitionRegistry).toSelf().inSingletonScope();
    bind(ProblemMatcherRegistry).toSelf().inSingletonScope();
    bind(ProblemPatternRegistry).toSelf().inSingletonScope();

    createCommonBindings(bind);

    bind(TaskProviderRegistry).toSelf().inSingletonScope();
    bind(TaskResolverRegistry).toSelf().inSingletonScope();
    bindContributionProvider(bind, TaskContribution);
    bind(TaskSchemaUpdater).toSelf().inSingletonScope();
    bind(JsonSchemaContribution).toService(TaskSchemaUpdater);
    bind(TaskNameResolver).toSelf().inSingletonScope();
    bind(TaskSourceResolver).toSelf().inSingletonScope();
    bind(TaskTemplateSelector).toSelf().inSingletonScope();
    bind(TaskTerminalWidgetManager).toSelf().inSingletonScope();

    bindProcessTaskModule(bind);
    bindTaskPreferences(bind);
});
