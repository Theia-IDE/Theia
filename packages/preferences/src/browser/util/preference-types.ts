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

import { PreferenceDataProperty, PreferenceItem, Title, PreferenceScope, TreeNode } from '@theia/core/lib/browser';
import { Command, MenuPath } from '@theia/core';

export namespace Preference {

    export interface ValueInSingleScope { value?: PreferenceItem, data: PreferenceDataProperty; }
    export interface NodeWithValueInSingleScope extends TreeNode {
        preference: ValueInSingleScope;
    }

    export interface ValuesInAllScopes {
        preferenceName: string;
        defaultValue: PreferenceItem | undefined;
        globalValue: PreferenceItem | undefined;
        workspaceValue: PreferenceItem | undefined;
        workspaceFolderValue: PreferenceItem | undefined;
    }

    export interface PreferenceWithValueInAllScopes {
        values?: ValuesInAllScopes;
        data: PreferenceDataProperty;
    }

    export interface EditorCommandArgs {
        id: string;
        value: string | undefined;
    }

    export namespace EditorCommandArgs {
        export function is(prefObject: EditorCommandArgs): prefObject is EditorCommandArgs {
            return !!prefObject && 'id' in prefObject && 'value' in prefObject;
        }
    }

    export interface NodeWithValueInAllScopes extends TreeNode {
        preference: PreferenceWithValueInAllScopes;
    }

    export const getValueInScope = (preferenceInfo: ValuesInAllScopes | undefined, scope: number): PreferenceItem | undefined => {
        if (!preferenceInfo) {
            return undefined;
        }
        switch (scope) {
            case PreferenceScope.User:
                return preferenceInfo.globalValue;
            case PreferenceScope.Workspace:
                return preferenceInfo.workspaceValue;
            case PreferenceScope.Folder:
                return preferenceInfo.workspaceFolderValue;
            default:
                return undefined;
        }
    };

    export interface SelectedScopeDetails extends Title.Dataset {
        scope: string;
        uri: string;
        activeScopeIsFolder: string;
    };

    export const DEFAULT_SCOPE: SelectedScopeDetails = {
        scope: PreferenceScope.User.toString(),
        uri: '',
        activeScopeIsFolder: 'false'
    };

    export interface ContextMenuCallbacks {
        resetCallback(): void;
        copyIDCallback(): void;
        copyJSONCallback(): void;
    }
}

export namespace PreferencesCommands {
    export const OPEN_PREFERENCES_JSON_TOOLBAR: Command = {
        id: 'preferences:openJson.toolbar',
        iconClass: 'codicon codicon-json'
    };
    export const COPY_JSON_NAME: Command = {
        id: 'preferences:copyJson.name',
        label: 'Copy Setting ID'
    };
    export const RESET_PREFERENCE: Command = {
        id: 'preferences:reset',
        label: 'Reset Setting'
    };

    export const COPY_JSON_VALUE: Command = {
        id: 'preferences:copyJson.value',
        label: 'Copy Setting as JSON',
    };

    export const OPEN_USER_PREFERENCES: Command = {
        id: 'workbench.action.openGlobalSettings',
        category: 'Preferences',
        label: 'Open User Preferences',
    };

    export const OPEN_WORKSPACE_PREFERENCES: Command = {
        id: 'workbench.action.openWorkspaceSettings',
        category: 'Preferences',
        label: 'Open Workspace Preferences',
    };
}

export namespace PreferenceMenus {
    export const PREFERENCE_EDITOR_CONTEXT_MENU: MenuPath = ['preferences:editor.contextMenu'];
    export const PREFERENCE_EDITOR_COPY_ACTIONS: MenuPath = [...PREFERENCE_EDITOR_CONTEXT_MENU, 'preferences:editor.contextMenu.copy'];
}
