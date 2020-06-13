/********************************************************************************
 * Copyright (C) 2019 Ericsson and others.
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

import { expect } from 'chai';
import { TaskDefinitionRegistry } from './task-definition-registry';

/* eslint-disable no-unused-expressions */
describe('TaskDefinitionRegistry', () => {
    let registry: TaskDefinitionRegistry;
    const definitionContributionA = {
        taskType: 'extA',
        source: 'extA',
        required: ['extensionType'],
        properties: {
            required: ['extensionType'],
            all: ['extensionType', 'taskLabel'],
            schema: {
                type: 'extA',
                required: ['extensionType'],
                properties: {
                    extensionType: {},
                    taskLabel: {}
                }
            }
        }
    };
    const definitionContributionB = {
        taskType: 'extA',
        source: 'extA',
        properties: {
            required: ['extensionType', 'taskLabel', 'taskDetailedLabel'],
            all: ['extensionType', 'taskLabel', 'taskDetailedLabel'],
            schema: {
                type: 'extA',
                required: ['extensionType', 'taskLabel', 'taskDetailedLabel'],
                properties: {
                    extensionType: {},
                    taskLabel: {},
                    taskDetailedLabel: {}
                }
            }
        }
    };

    beforeEach(() => {
        registry = new TaskDefinitionRegistry();
    });

    describe('register function', () => {
        it('should transform the task definition contribution and store it in memory', () => {
            registry.register(definitionContributionA);
            expect(registry['definitions'].get(definitionContributionA.taskType)).to.be.ok;
            expect(registry['definitions'].get(definitionContributionA.taskType)![0]).to.deep.equal(definitionContributionA);
        });
    });

    describe('getDefinitions function', () => {
        it('should return all definitions associated with the given type', () => {
            registry.register(definitionContributionA);
            const defs1 = registry.getDefinitions(definitionContributionA.taskType);
            expect(defs1.length).to.eq(1);

            registry.register(definitionContributionB);
            const defs2 = registry.getDefinitions(definitionContributionA.taskType);
            expect(defs2.length).to.eq(2);
        });
    });

    describe('getDefinition function', () => {
        it('should return undefined if the given task configuration does not match any registered definitions', () => {
            registry.register(definitionContributionA);
            registry.register(definitionContributionB);
            const type = definitionContributionA.taskType;
            const defs = registry.getDefinition({
                type, label: 'grunt task', task: 'build', id: { type, _key: '' }
            });
            expect(defs).to.be.not.ok;
        });

        it('should return the best match if there is one or more registered definitions match the given task configuration', () => {
            registry.register(definitionContributionA);
            registry.register(definitionContributionB);
            const type = definitionContributionA.taskType;
            const defs = registry.getDefinition({
                type, label: 'extension task', extensionType: 'extensionType', taskLabel: 'taskLabel', id: { type, _key: '' }
            });
            expect(defs).to.be.ok;
            expect(defs!.taskType).to.be.eq(definitionContributionA.taskType);

            const defs2 = registry.getDefinition({
                type, label: 'extension task', extensionType: 'extensionType', taskLabel: 'taskLabel', taskDetailedLabel: 'taskDetailedLabel', id: { type, _key: '' }
            });
            expect(defs2).to.be.ok;
            expect(defs2!.taskType).to.be.eq(definitionContributionB.taskType);
        });
    });
});
