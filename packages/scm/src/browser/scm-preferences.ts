/********************************************************************************
 * Copyright (C) 2020 Ericsson and others.
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

import { interfaces } from '@theia/core/shared/inversify';
import {
    createPreferenceProxy,
    PreferenceProxy,
    PreferenceService,
    PreferenceSchema,
    PreferenceContribution
} from '@theia/core/lib/browser/preferences';

export type ScmViewMode = 'tree' | 'list';

export const scmPreferenceSchema: PreferenceSchema = {
    type: 'object',
    properties: {
        'scm.defaultViewMode': {
            type: 'string',
            enum: ['tree', 'list'],
            enumDescriptions: [
                'Show the repository changes as a tree.',
                'Show the repository changes as a list.'
            ],
            description: 'Controls the default source control view mode.',
            default: 'list'
        },
        'scm.countBadge': {
            type: 'boolean',
            description: 'Controls whether badges are enabled for the Source Control Manager.',
            default: true
        }
    }
};

export interface ScmConfiguration {
    'scm.defaultViewMode': ScmViewMode;
    'scm.countBadge': boolean;
}

export const ScmPreferences = Symbol('ScmPreferences');
export type ScmPreferences = PreferenceProxy<ScmConfiguration>;

export function createScmPreferences(preferences: PreferenceService): ScmPreferences {
    return createPreferenceProxy(preferences, scmPreferenceSchema);
}

export function bindScmPreferences(bind: interfaces.Bind): void {
    bind(ScmPreferences).toDynamicValue((ctx: interfaces.Context) => {
        const preferences = ctx.container.get<PreferenceService>(PreferenceService);
        return createScmPreferences(preferences);
    }).inSingletonScope();

    bind(PreferenceContribution).toConstantValue({ schema: scmPreferenceSchema });
}
