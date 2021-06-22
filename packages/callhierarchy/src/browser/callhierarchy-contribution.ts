/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
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

import { injectable, inject } from '@theia/core/shared/inversify';
import { MenuModelRegistry, CommandRegistry, Command } from '@theia/core/lib/common';
import { AbstractViewContribution, OpenViewArguments, KeybindingRegistry } from '@theia/core/lib/browser';
import { EDITOR_CONTEXT_MENU } from '@theia/editor/lib/browser';
import { CallHierarchyTreeWidget } from './callhierarchy-tree/callhierarchy-tree-widget';
import { CALLHIERARCHY_ID } from './callhierarchy';
import { CurrentEditorAccess } from './current-editor-access';
import { CallHierarchyServiceProvider } from './callhierarchy-service';
import URI from '@theia/core/lib/common/uri';
import { nls } from '@theia/core/lib/browser/nls';

export const CALL_HIERARCHY_TOGGLE_COMMAND_ID = 'callhierarchy:toggle';
export const CALL_HIERARCHY_LABEL = 'Call Hierarchy';

export namespace CallHierarchyCommands {
    export const OPEN: Command = {
        id: 'callhierarchy:open',
        label: nls.localize('callHierarchy.open', 'Open Call Hierarchy')
    };
}

@injectable()
export class CallHierarchyContribution extends AbstractViewContribution<CallHierarchyTreeWidget> {

    @inject(CurrentEditorAccess) protected readonly editorAccess: CurrentEditorAccess;
    @inject(CallHierarchyServiceProvider) protected readonly callHierarchyServiceProvider: CallHierarchyServiceProvider;
    constructor() {
        super({
            widgetId: CALLHIERARCHY_ID,
            widgetName: CALL_HIERARCHY_LABEL,
            defaultWidgetOptions: {
                area: 'bottom'
            },
            toggleCommandId: CALL_HIERARCHY_TOGGLE_COMMAND_ID,
            toggleKeybinding: 'ctrlcmd+shift+f1'
        });
    }

    protected isCallHierarchyAvailable(): boolean {
        const selection = this.editorAccess.getSelection();
        const languageId = this.editorAccess.getLanguageId();
        return !!selection && !!languageId && !!this.callHierarchyServiceProvider.get(languageId, new URI(selection.uri));
    }

    async openView(args?: Partial<OpenViewArguments>): Promise<CallHierarchyTreeWidget> {
        const widget = await super.openView(args);
        const selection = this.editorAccess.getSelection();
        const languageId = this.editorAccess.getLanguageId();
        widget.initializeModel(selection, languageId);
        return widget;
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(CallHierarchyCommands.OPEN, {
            execute: () => this.openView({
                toggle: false,
                activate: true
            }),
            isEnabled: this.isCallHierarchyAvailable.bind(this)
        });
        super.registerCommands(commands);
    }

    registerMenus(menus: MenuModelRegistry): void {
        const menuPath = [...EDITOR_CONTEXT_MENU, 'navigation'];
        menus.registerMenuAction(menuPath, {
            commandId: CallHierarchyCommands.OPEN.id,
            label: CALL_HIERARCHY_LABEL
        });
        super.registerMenus(menus);
    }

    registerKeybindings(keybindings: KeybindingRegistry): void {
        super.registerKeybindings(keybindings);
        keybindings.registerKeybinding({
            command: CallHierarchyCommands.OPEN.id,
            keybinding: 'ctrlcmd+f1'
        });
    }
}
