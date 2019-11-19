/********************************************************************************
 * Copyright (C) 2018 Google and others.
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

import { interfaces } from 'inversify';
import { createPreferenceProxy, PreferenceProxy, PreferenceService, PreferenceContribution, PreferenceSchema } from './preferences';

export const corePreferenceSchema: PreferenceSchema = {
    'type': 'object',
    properties: {
        'workbench.list.openMode': {
            type: 'string',
            enum: [
                'singleClick',
                'doubleClick'
            ],
            default: 'singleClick',
            description: 'Controls how to open items in trees using the mouse.'
        },
        'application.confirmExit': {
            type: 'string',
            enum: [
                'never',
                'ifRequired',
                'always',
            ],
            default: 'ifRequired',
            description: 'When to confirm before closing the application window.',
        },
        'workbench.commandPalette.history': {
            type: 'number',
            default: 50,
            minimum: 0,
            description: 'Controls the number of recently used commands to keep in history for the command palette. Set to 0 to disable command history.'
        },
        'breadcrumbs.enabled': {
            'type': 'boolean',
            'default': true,
            'description': 'Enable/disable navigation breadcrumbs.'
        }
    }
};

export interface CoreConfiguration {
    'application.confirmExit': 'never' | 'ifRequired' | 'always';
    'workbench.list.openMode': 'singleClick' | 'doubleClick';
    'workbench.commandPalette.history': number;
    'breadcrumbs.enabled': boolean;
}

export const CorePreferences = Symbol('CorePreferences');
export type CorePreferences = PreferenceProxy<CoreConfiguration>;

export function createCorePreferences(preferences: PreferenceService): CorePreferences {
    return createPreferenceProxy(preferences, corePreferenceSchema);
}

export function bindCorePreferences(bind: interfaces.Bind): void {
    bind(CorePreferences).toDynamicValue(ctx => {
        const preferences = ctx.container.get<PreferenceService>(PreferenceService);
        return createCorePreferences(preferences);
    }).inSingletonScope();
    bind(PreferenceContribution).toConstantValue({ schema: corePreferenceSchema });
}
