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
import { SUPPORTED_ENCODINGS } from './supported-encodings';
import { FrontendApplicationConfigProvider } from './frontend-application-config-provider';

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
        'workbench.editor.highlightModifiedTabs': {
            'type': 'boolean',
            'description': 'Controls whether a top border is drawn on modified (dirty) editor tabs or not.',
            'default': false
        },
        'workbench.editor.closeOnFileDelete': {
            'type': 'boolean',
            // eslint-disable-next-line max-len
            'description': 'Controls whether editors showing a file that was opened during the session should close automatically when getting deleted or renamed by some other process. Disabling this will keep the editor open  on such an event. Note that deleting from within the application will always close the editor and that dirty files will never close to preserve your data.',
            'default': true
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
        'workbench.colorTheme': {
            type: 'string',
            default: FrontendApplicationConfigProvider.get().defaultTheme,
            description: 'Specifies the color theme used in the workbench.'
        },
        'workbench.iconTheme': {
            type: ['string', 'null'],
            default: FrontendApplicationConfigProvider.get().defaultIconTheme,
            description: "Specifies the icon theme used in the workbench or 'null' to not show any file icons."
        },
        'workbench.productIconTheme': {
            type: 'string',
            default: FrontendApplicationConfigProvider.get().defaultProductIconTheme,
            description: 'Specifies the product icon theme used in the workbench'
        },
        'workbench.silentNotifications': {
            type: 'boolean',
            default: false,
            description: 'Controls whether to suppress notification popups.'
        },
        'files.encoding': {
            'type': 'string',
            'enum': Object.keys(SUPPORTED_ENCODINGS),
            'default': 'utf8',
            'description': 'The default character set encoding to use when reading and writing files. This setting can also be configured per language.',
            'scope': 'language-overridable',
            'enumDescriptions': Object.keys(SUPPORTED_ENCODINGS).map(key => SUPPORTED_ENCODINGS[key].labelLong),
            'included': Object.keys(SUPPORTED_ENCODINGS).length > 1
        },
        'workbench.tree.renderIndentGuides': {
            type: 'string',
            enum: ['onHover', 'none', 'always'],
            default: 'onHover',
            description: 'Controls whether the tree should render indent guides.'
        },
        'keyboard.dispatch': {
            type: 'string',
            enum: [
                'code',
                'keyCode',
            ],
            default: 'code',
            description: 'Whether to interpret keypresses by the `code` of the physical key, or by the `keyCode` provided by the OS.'
        },
    }
};

export interface CoreConfiguration {
    'application.confirmExit': 'never' | 'ifRequired' | 'always';
    'keyboard.dispatch': 'code' | 'keyCode';
    'workbench.list.openMode': 'singleClick' | 'doubleClick';
    'workbench.commandPalette.history': number;
    'workbench.editor.highlightModifiedTabs': boolean;
    'workbench.editor.closeOnFileDelete': boolean;
    'workbench.colorTheme': string;
    'workbench.iconTheme': string | null;
    'workbench.silentNotifications': boolean;
    'files.encoding': string
    'workbench.tree.renderIndentGuides': 'onHover' | 'none' | 'always';
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
