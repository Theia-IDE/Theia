/********************************************************************************
 * Copyright (C) 2020 SAP SE or an SAP affiliate company and others.
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

import {assert} from 'chai';
import {Container, injectable} from 'inversify';
import {enableJSDOM} from '@theia/core/lib/browser/test/jsdom';

const disableJSDOM = enableJSDOM();
import {ApplicationProps} from '@theia/application-package/lib/application-props';
import {FrontendApplicationConfigProvider} from '@theia/core/lib/browser/frontend-application-config-provider';

FrontendApplicationConfigProvider.set({
    ...ApplicationProps.DEFAULT.frontend.config
});
import {TaskConfigurations} from './task-configurations';
import {TaskConfigurationManager} from './task-configuration-manager';
import {TaskDefinitionRegistry} from './task-definition-registry';
import {TaskProvider, TaskProviderRegistry} from './task-contribution';
import {TaskTemplateSelector} from './task-templates';
import {TaskSchemaUpdater} from './task-schema-updater';
import {TaskSourceResolver} from './task-source-resolver';
import {ProvidedTaskConfigurations} from './provided-task-configurations';
import {TaskConfiguration, TaskConfigurationScope, TaskCustomization, TaskScope} from '../common/task-protocol';
import {QuickPickService} from '@theia/core/lib/common/quick-pick-service';
import {ContributionProvider, Event, ILogger} from '@theia/core/lib/common';
import {
    ApplicationShell,
    LabelProviderContribution,
    PreferenceProvider,
    PreferenceScope,
    WidgetManager
} from '@theia/core/lib/browser';
import {FileService} from '@theia/filesystem/lib/browser/file-service';
import {WorkspaceService} from '@theia/workspace/lib/browser';
import {WorkspaceVariableContribution} from '@theia/workspace/lib/browser/workspace-variable-contribution';
import {Signal} from '@phosphor/signaling';
import {EditorManager} from '@theia/editor/lib/browser';
import {PreferenceConfigurations} from '@theia/core/lib/browser/preferences/preference-configurations';
import {FileChangeType} from '@theia/filesystem/lib/common/files';
import {IJSONSchema} from '@theia/core/lib/common/json-schema';
import {MockLogger} from '@theia/core/lib/common/test/mock-logger';
import {MockPreferenceProvider} from '@theia/core/lib/browser/preferences/test';

after(() => disableJSDOM());

@injectable()
class MockTaskConfigurationManager extends TaskConfigurationManager {

    changeTasksConfigFire(): void {
        this.onDidChangeTaskConfigEmitter.fire({scope: TaskScope.Global, type: FileChangeType.ADDED});
    }

    getTasks(scope: TaskConfigurationScope): (TaskCustomization | TaskConfiguration)[] {
        return [
            {
                'type': 'echo',
                'label': 'task c',
                'text': 'Configured task c'
            },
            {
                'type': 'echo',
                'label': 'task a',
                'text': 'Detected task a'
            }
        ];
    }
}

class MockTaskProvider implements TaskProvider {
    async provideTasks(): Promise<TaskConfiguration[]> {
        const taskA: TaskConfiguration = {
            type: 'echo',
            group: 'build',
            _scope: '1',
            label: 'task a',
            text: 'Detected task a'
        };
        const taskB: TaskConfiguration = {
            type: 'echo',
            group: 'build',
            _scope: '1',
            label: 'task b',
            text: 'Detected task b'
        };
        return [
            taskA, taskB
        ];
    }
}

describe('getTasks', () => {

    let testContainer: Container;
    const taskConfigurationManager = new MockTaskConfigurationManager();

    it('returns all configured tasks: customized and configured', done => {
        const taskConfiguration = testContainer.get<TaskConfigurations>(TaskConfigurations);
        taskConfigurationManager.changeTasksConfigFire();
        setTimeout(async () => {
            const res = await taskConfiguration.getTasks(1);
            assert.equal(res.length, 2);
            assert.equal(res[0].label, 'task c');
            assert.equal(res[1].label, 'task a');
            done();
        }, 50);
    });

    before(() => {
        testContainer = new Container();
        testContainer.bind(ILogger).toDynamicValue(ctx => new MockLogger());
        const workspaceService = new WorkspaceService();
        testContainer.bind(WorkspaceService).toConstantValue(workspaceService);
        testContainer.bind(WorkspaceVariableContribution).toSelf().inSingletonScope();
        testContainer.bind(ApplicationShell).toConstantValue({
            currentChanged: new Signal({}),
            widgets: () => []
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        testContainer.bind(EditorManager).toConstantValue(<EditorManager>{});
        testContainer.bind(QuickPickService).toConstantValue(<QuickPickService>{});
        const taskDefinitionRegistry = new TaskDefinitionRegistry();
        taskDefinitionRegistry.register({
            taskType: 'echo',
            source: 'echotaskprovider',
            properties: {
                required: ['label', 'text'],
                all: ['label', 'text'],
                schema: new class implements IJSONSchema {
                }
            }
        });
        testContainer.bind<TaskDefinitionRegistry>(TaskDefinitionRegistry).toConstantValue(taskDefinitionRegistry);
        testContainer.bind<TaskConfigurationManager>(TaskConfigurationManager).toConstantValue(taskConfigurationManager);

        testContainer.bind<ProvidedTaskConfigurations>(ProvidedTaskConfigurations).toSelf();
        testContainer.bind<TaskProviderRegistry>(TaskProviderRegistry).toSelf().inSingletonScope();

        const taskProviderRegistry = testContainer.get<TaskProviderRegistry>(TaskProviderRegistry);
        taskProviderRegistry.register('echo', new MockTaskProvider());

        testContainer.bind(TaskTemplateSelector).toSelf().inSingletonScope();
        testContainer.bind(TaskSchemaUpdater).toConstantValue(<TaskSchemaUpdater>{
            onDidChangeTaskSchema: Event.None,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            validate(data?: any): boolean {
                return true;
            }
        });
        testContainer.bind(TaskSourceResolver).toConstantValue(<TaskSourceResolver>{});
        testContainer.bind<TaskConfigurations>(TaskConfigurations).toSelf().inSingletonScope();
        testContainer.bind(FileService).toConstantValue(<FileService>{});
        testContainer.bind(PreferenceProvider).toDynamicValue(ctx => new MockPreferenceProvider(PreferenceScope.Workspace)).inSingletonScope();
        testContainer.bind(PreferenceConfigurations).toConstantValue(<PreferenceConfigurations>{});
        testContainer.bind(WidgetManager).toSelf().inSingletonScope();
        testContainer.bind<ContributionProvider<LabelProviderContribution>>(ContributionProvider).toDynamicValue(ctx => ({
            getContributions(): LabelProviderContribution[] {
                return [];
            }
        })).inSingletonScope();
    });
});
