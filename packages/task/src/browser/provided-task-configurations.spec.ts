/********************************************************************************
 * Copyright (C) 2019 Red Hat, Inc. and others.
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

import { assert } from 'chai';
import { Container } from 'inversify';
import { ProvidedTaskConfigurations } from './provided-task-configurations';
import { TaskDefinitionRegistry } from './task-definition-registry';
import { TaskProviderRegistry } from './task-contribution';
import { TaskConfiguration } from '../common';

describe('provided-task-configurations', () => {
    let container: Container;
    beforeEach(() => {
        container = new Container();
        container.bind(ProvidedTaskConfigurations).toSelf().inSingletonScope();
        container.bind(TaskProviderRegistry).toSelf().inSingletonScope();
        container.bind(TaskDefinitionRegistry).toSelf().inSingletonScope();
    });

    it('provided-task-search', async () => {
        const providerRegistry = container.get(TaskProviderRegistry);
        providerRegistry.register('test', {
            provideTasks(): Promise<TaskConfiguration[]> {
                return Promise.resolve([{
                    id: { _key: 'id', type: 'test' }, type: 'test', label: 'task from test', _source: 'test', _scope: 'test'
                } as TaskConfiguration]);
            }
        });

        const task = await container.get(ProvidedTaskConfigurations).getTask('test', 'task from test', 'test');
        assert.isOk(task);
        assert.equal(task!.type, 'test');
        assert.equal(task!.label, 'task from test');
    });
});
