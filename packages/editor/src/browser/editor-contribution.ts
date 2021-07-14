/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
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

import { EditorManager } from './editor-manager';
import { TextEditor } from './editor';
import { injectable, inject, optional } from '@theia/core/shared/inversify';
import { StatusBarAlignment, StatusBar } from '@theia/core/lib/browser/status-bar/status-bar';
import { FrontendApplicationContribution, DiffUris, DockLayout, QuickInputService } from '@theia/core/lib/browser';
import { ContextKeyService } from '@theia/core/lib/browser/context-key-service';
import { CommandHandler, DisposableCollection } from '@theia/core';
import { EditorCommands } from './editor-command';
import { CommandRegistry, CommandContribution } from '@theia/core/lib/common';
import { KeybindingRegistry, KeybindingContribution } from '@theia/core/lib/browser';
import { LanguageService } from '@theia/core/lib/browser/language-service';
import { SUPPORTED_ENCODINGS } from '@theia/core/lib/browser/supported-encodings';

@injectable()
export class EditorContribution implements FrontendApplicationContribution, CommandContribution, KeybindingContribution {

    @inject(StatusBar) protected readonly statusBar: StatusBar;
    @inject(EditorManager) protected readonly editorManager: EditorManager;
    @inject(LanguageService) protected readonly languages: LanguageService;

    @inject(ContextKeyService)
    protected readonly contextKeyService: ContextKeyService;

    @inject(QuickInputService) @optional()
    protected readonly quickInputService: QuickInputService;

    onStart(): void {
        this.initEditorContextKeys();

        this.updateStatusBar();
        this.editorManager.onCurrentEditorChanged(() => this.updateStatusBar());
    }

    protected initEditorContextKeys(): void {
        const editorIsOpen = this.contextKeyService.createKey<boolean>('editorIsOpen', false);
        const textCompareEditorVisible = this.contextKeyService.createKey<boolean>('textCompareEditorVisible', false);
        const updateContextKeys = () => {
            const widgets = this.editorManager.all;
            editorIsOpen.set(!!widgets.length);
            textCompareEditorVisible.set(widgets.some(widget => DiffUris.isDiffUri(widget.editor.uri)));
        };
        updateContextKeys();
        for (const widget of this.editorManager.all) {
            widget.disposed.connect(updateContextKeys);
        }
        this.editorManager.onCreated(widget => {
            updateContextKeys();
            widget.disposed.connect(updateContextKeys);
        });
    }

    protected readonly toDisposeOnCurrentEditorChanged = new DisposableCollection();
    protected updateStatusBar(): void {
        this.toDisposeOnCurrentEditorChanged.dispose();

        const widget = this.editorManager.currentEditor;
        const editor = widget && widget.editor;
        this.updateLanguageStatus(editor);
        this.updateEncodingStatus(editor);
        this.setCursorPositionStatus(editor);
        if (editor) {
            this.toDisposeOnCurrentEditorChanged.pushAll([
                editor.onLanguageChanged(() => this.updateLanguageStatus(editor)),
                editor.onEncodingChanged(() => this.updateEncodingStatus(editor)),
                editor.onCursorPositionChanged(() => this.setCursorPositionStatus(editor))
            ]);
        }
    }

    protected updateLanguageStatus(editor: TextEditor | undefined): void {
        if (!editor) {
            this.statusBar.removeElement('editor-status-language');
            return;
        }
        const language = this.languages.getLanguage(editor.document.languageId);
        const languageName = language ? language.name : '';
        this.statusBar.setElement('editor-status-language', {
            text: languageName,
            alignment: StatusBarAlignment.RIGHT,
            priority: 1,
            command: EditorCommands.CHANGE_LANGUAGE.id,
            tooltip: 'Select Language Mode'
        });
    }

    protected updateEncodingStatus(editor: TextEditor | undefined): void {
        if (!editor) {
            this.statusBar.removeElement('editor-status-encoding');
            return;
        }
        this.statusBar.setElement('editor-status-encoding', {
            text: SUPPORTED_ENCODINGS[editor.getEncoding()].labelShort,
            alignment: StatusBarAlignment.RIGHT,
            priority: 10,
            command: EditorCommands.CHANGE_ENCODING.id,
            tooltip: 'Select Encoding'
        });
    }

    protected setCursorPositionStatus(editor: TextEditor | undefined): void {
        if (!editor) {
            this.statusBar.removeElement('editor-status-cursor-position');
            return;
        }
        const { cursor } = editor;
        this.statusBar.setElement('editor-status-cursor-position', {
            text: `Ln ${cursor.line + 1}, Col ${editor.getVisibleColumn(cursor)}`,
            alignment: StatusBarAlignment.RIGHT,
            priority: 100,
            tooltip: 'Go To Line',
            command: 'editor.action.gotoLine'
        });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(EditorCommands.SHOW_ALL_OPENED_EDITORS, {
            execute: () => this.quickInputService?.open('edt ')
        });
        const splitHandlerFactory = (splitMode: DockLayout.InsertMode): CommandHandler => ({
            isEnabled: () => !!this.editorManager.currentEditor,
            isVisible: () => !!this.editorManager.currentEditor,
            execute: async () => {
                const { currentEditor } = this.editorManager;
                if (currentEditor) {
                    const selection = currentEditor.editor.selection;
                    const newEditor = await this.editorManager.openToSide(currentEditor.editor.uri, { selection, widgetOptions: { mode: splitMode } });
                    const oldEditorState = currentEditor.editor.storeViewState();
                    newEditor.editor.restoreViewState(oldEditorState);
                }
            }
        });
        commands.registerCommand(EditorCommands.SPLIT_EDITOR_HORIZONTAL, splitHandlerFactory('split-right'));
        commands.registerCommand(EditorCommands.SPLIT_EDITOR_VERTICAL, splitHandlerFactory('split-bottom'));
        commands.registerCommand(EditorCommands.SPLIT_EDITOR_RIGHT, splitHandlerFactory('split-right'));
        commands.registerCommand(EditorCommands.SPLIT_EDITOR_DOWN, splitHandlerFactory('split-bottom'));
        commands.registerCommand(EditorCommands.SPLIT_EDITOR_UP, splitHandlerFactory('split-top'));
        commands.registerCommand(EditorCommands.SPLIT_EDITOR_LEFT, splitHandlerFactory('split-left'));
    }

    registerKeybindings(keybindings: KeybindingRegistry): void {
        keybindings.registerKeybinding({
            command: EditorCommands.SHOW_ALL_OPENED_EDITORS.id,
            keybinding: 'ctrlcmd+k ctrlcmd+p'
        });
        keybindings.registerKeybinding({
            command: EditorCommands.SPLIT_EDITOR_HORIZONTAL.id,
            keybinding: 'ctrlcmd+\\',
        });
        keybindings.registerKeybinding({
            command: EditorCommands.SPLIT_EDITOR_VERTICAL.id,
            keybinding: 'ctrlcmd+k ctrlcmd+\\',
        });
    }
}
