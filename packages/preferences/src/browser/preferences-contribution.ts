/********************************************************************************
 * Copyright (C) 2018 Ericsson and others.
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

import { injectable, inject, named } from '@theia/core/shared/inversify';
import { MenuModelRegistry, CommandRegistry } from '@theia/core';
import {
    CommonMenus,
    AbstractViewContribution,
    CommonCommands,
    KeybindingRegistry,
    Widget,
    PreferenceScope,
    PreferenceProvider,
    PreferenceService,
} from '@theia/core/lib/browser';
import { isFirefox } from '@theia/core/lib/browser';
import { isOSX } from '@theia/core/lib/common/os';
import { TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { PreferencesWidget } from './views/preference-widget';
import { WorkspacePreferenceProvider } from './workspace-preference-provider';
import { Preference, PreferencesCommands, PreferenceMenus } from './util/preference-types';
import { ClipboardService } from '@theia/core/lib/browser/clipboard-service';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser';

@injectable()
export class PreferencesContribution extends AbstractViewContribution<PreferencesWidget> {

    @inject(FileService) protected readonly fileService: FileService;
    @inject(PreferenceProvider) @named(PreferenceScope.Workspace) protected readonly workspacePreferenceProvider: WorkspacePreferenceProvider;
    @inject(EditorManager) protected readonly editorManager: EditorManager;
    @inject(PreferenceService) protected readonly preferenceService: PreferenceService;
    @inject(ClipboardService) protected readonly clipboardService: ClipboardService;
    @inject(PreferencesWidget) protected readonly scopeTracker: PreferencesWidget;
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;

    constructor() {
        super({
            widgetId: PreferencesWidget.ID,
            widgetName: PreferencesWidget.LABEL,
            defaultWidgetOptions: {
                area: 'main',
            },
        });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(CommonCommands.OPEN_PREFERENCES, {
            execute: async (query?: string) => {
                const view = await this.openView({ activate: true });
                if (query) {
                    view.updateSearchTerm(query);
                }
            }
        });
        commands.registerCommand(PreferencesCommands.OPEN_PREFERENCES_JSON_TOOLBAR, {
            isEnabled: () => true,
            isVisible: w => this.withWidget(w, () => true),
            execute: (preferenceNode: Preference.NodeWithValueInAllScopes) => {
                this.openPreferencesJSON(preferenceNode);
            }
        });
        commands.registerCommand(PreferencesCommands.COPY_JSON_NAME, {
            isEnabled: Preference.EditorCommandArgs.is,
            isVisible: Preference.EditorCommandArgs.is,
            execute: ({ id, value }: Preference.EditorCommandArgs) => {
                this.clipboardService.writeText(id);
            }
        });
        commands.registerCommand(PreferencesCommands.COPY_JSON_VALUE, {
            isEnabled: Preference.EditorCommandArgs.is,
            isVisible: Preference.EditorCommandArgs.is,
            execute: ({ id, value }: { id: string, value: string; }) => {
                const jsonString = `"${id}": ${JSON.stringify(value)}`;
                this.clipboardService.writeText(jsonString);
            }
        });
        commands.registerCommand(PreferencesCommands.RESET_PREFERENCE, {
            isEnabled: Preference.EditorCommandArgs.is,
            isVisible: Preference.EditorCommandArgs.is,
            execute: ({ id }: Preference.EditorCommandArgs) => {
                this.preferenceService.set(id, undefined, Number(this.scopeTracker.currentScope.scope), this.scopeTracker.currentScope.uri);
            }
        });
        commands.registerCommand(PreferencesCommands.OPEN_USER_PREFERENCES, {
            execute: async () => this.openPreferencesWithScope(PreferenceScope.User)
        });
        commands.registerCommand(PreferencesCommands.OPEN_WORKSPACE_PREFERENCES, {
            isEnabled: () => !!this.workspaceService.workspace,
            isVisible: () => !!this.workspaceService.workspace,
            execute: async () => this.openPreferencesWithScope(PreferenceScope.Workspace)
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.FILE_SETTINGS_SUBMENU_OPEN, {
            commandId: CommonCommands.OPEN_PREFERENCES.id,
            label: CommonCommands.OPEN_PREFERENCES.label,
            order: 'a10',
        });
        menus.registerMenuAction(CommonMenus.SETTINGS_OPEN, {
            commandId: CommonCommands.OPEN_PREFERENCES.id,
            label: CommonCommands.OPEN_PREFERENCES.label,
            order: 'a10',
        });
        menus.registerMenuAction(PreferenceMenus.PREFERENCE_EDITOR_CONTEXT_MENU, {
            commandId: PreferencesCommands.RESET_PREFERENCE.id,
            label: PreferencesCommands.RESET_PREFERENCE.label,
            order: 'a'
        });
        menus.registerMenuAction(PreferenceMenus.PREFERENCE_EDITOR_COPY_ACTIONS, {
            commandId: PreferencesCommands.COPY_JSON_VALUE.id,
            label: PreferencesCommands.COPY_JSON_VALUE.label,
            order: 'b'
        });
        menus.registerMenuAction(PreferenceMenus.PREFERENCE_EDITOR_COPY_ACTIONS, {
            commandId: PreferencesCommands.COPY_JSON_NAME.id,
            label: PreferencesCommands.COPY_JSON_NAME.label,
            order: 'c'
        });
    }

    registerKeybindings(keybindings: KeybindingRegistry): void {
        keybindings.registerKeybinding({
            command: CommonCommands.OPEN_PREFERENCES.id,
            keybinding: (isOSX && !isFirefox) ? 'cmd+,' : 'ctrl+,'
        });
    }

    registerToolbarItems(toolbar: TabBarToolbarRegistry): void {
        toolbar.registerItem({
            id: PreferencesCommands.OPEN_PREFERENCES_JSON_TOOLBAR.id,
            command: PreferencesCommands.OPEN_PREFERENCES_JSON_TOOLBAR.id,
            tooltip: 'Open Preferences in JSON',
            priority: 0,
        });
    }

    protected async openPreferencesJSON(preferenceNode: Preference.NodeWithValueInAllScopes): Promise<void> {
        const wasOpenedFromEditor = preferenceNode.constructor !== PreferencesWidget;
        const { scope, activeScopeIsFolder, uri } = this.scopeTracker.currentScope;
        const scopeID = Number(scope);
        const preferenceId = wasOpenedFromEditor ? preferenceNode.id : '';
        // when opening from toolbar, widget is passed as arg by default (we don't need this info)
        if (wasOpenedFromEditor && preferenceNode.preference.values) {
            const currentPreferenceValue = preferenceNode.preference.values;
            const valueInCurrentScope = Preference.getValueInScope(currentPreferenceValue, scopeID) ?? currentPreferenceValue.defaultValue;
            this.preferenceService.set(preferenceId, valueInCurrentScope, scopeID, uri);
        }

        let jsonEditorWidget: EditorWidget;
        const jsonUriToOpen = await this.obtainConfigUri(scopeID, activeScopeIsFolder, uri);
        if (jsonUriToOpen) {
            jsonEditorWidget = await this.editorManager.open(jsonUriToOpen);

            if (wasOpenedFromEditor) {
                const text = jsonEditorWidget.editor.document.getText();
                if (preferenceId) {
                    const { index } = text.match(preferenceId)!;
                    const numReturns = text.slice(0, index).match(new RegExp('\n', 'g'))!.length;
                    jsonEditorWidget.editor.cursor = { line: numReturns, character: 4 + preferenceId.length + 4 };
                }
            }
        }
    }

    /**
     * Opens the preferences-view with the given scope.
     *
     * @param scope the preference scope.
     */
    protected async openPreferencesWithScope(scope: PreferenceScope): Promise<void> {
        const view = await this.openView({ activate: true });
        const titles = view.availableTitles;
        for (const title of titles) {
            if (title.scope === scope.toString()) {
                view.setScopeSelection(title as Preference.SelectedScopeDetails);
            }
        }
    }

    private async obtainConfigUri(serializedScope: number, activeScopeIsFolder: string, resource: string): Promise<URI | undefined> {
        let scope: PreferenceScope = serializedScope;
        if (activeScopeIsFolder === 'true') {
            scope = PreferenceScope.Folder;
        }
        const resourceUri = !!resource ? resource : undefined;
        const configUri = this.preferenceService.getConfigUri(scope, resourceUri);
        if (!configUri) {
            return undefined;
        }
        if (configUri && !await this.fileService.exists(configUri)) {
            await this.fileService.create(configUri);
        }
        return configUri;
    }

    /**
     * Determine if the current widget is the PreferencesWidget.
     */
    protected withWidget<T>(widget: Widget | undefined = this.tryGetWidget(), fn: (widget: PreferencesWidget) => T): T | false {
        if (widget instanceof PreferencesWidget && widget.id === PreferencesWidget.ID) {
            return fn(widget);
        }
        return false;
    }
}
