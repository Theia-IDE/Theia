/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * @jest-environment @theia/core/src/browser/test/jsdom-environment
 */

import 'reflect-metadata';

import { Container, ContainerModule } from 'inversify';
import { QuickOpenService } from '@theia/core/lib/browser';
import { ILogger, bindContributionProvider } from '@theia/core/lib/common';
import { MockLogger } from '@theia/core/lib/common/test/mock-logger';
import { VariableContribution, VariableRegistry } from './variable';
import { VariableQuickOpenService } from './variable-quick-open-service';
import { VariableResolverFrontendContribution } from './variable-resolver-frontend-contribution';

describe('variable-resolver-frontend-contribution', () => {

    let testContainer: Container;
    let variableRegistry: VariableRegistry;

    beforeAll(() => {
        testContainer = new Container();
        const module = new ContainerModule((bind, unbind, isBound, rebind) => {
            bindContributionProvider(bind, VariableContribution);
            bind(VariableContribution).toConstantValue(new TestVariableContribution());

            bind(ILogger).to(MockLogger);
            bind(VariableRegistry).toSelf().inSingletonScope();

            bind(QuickOpenService).toSelf();
            bind(VariableQuickOpenService).toSelf();

            bind(VariableResolverFrontendContribution).toSelf();
        });
        testContainer.load(module);
    });

    beforeEach(() => {
        variableRegistry = testContainer.get<VariableRegistry>(VariableRegistry);

        const variableRegistrar = testContainer.get(VariableResolverFrontendContribution);
        variableRegistrar.onStart();
    });

    it('should register all variables from the contribution points', () => {
        const variables = variableRegistry.getVariables();
        expect(variables.length).toEqual(2);
        expect(variables[0].name).toEqual('file');
        expect(variables[1].name).toEqual('lineNumber');
    });
});

export class TestVariableContribution implements VariableContribution {

    registerVariables(variables: VariableRegistry): void {
        variables.registerVariable({
            name: 'file',
            description: 'Resolves to file name opened in the current editor',
            resolve: () => Promise.resolve('package.json')
        });
        variables.registerVariable({
            name: 'lineNumber',
            description: 'Resolves to current line number',
            resolve: () => Promise.resolve('5')
        });
    }
}
