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

import { inject, injectable } from 'inversify';
import { KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser';
import { CommandContribution, CommandRegistry, Command, MenuContribution, MenuModelRegistry, Disposable, DisposableCollection } from '@theia/core/lib/common';
import { BlameDecorator } from './blame-decorator';
import { EditorManager, EditorKeybindingContexts, EditorWidget, EditorTextFocusContext, StrictEditorTextFocusContext } from '@theia/editor/lib/browser';
import { BlameManager } from './blame-manager';
import URI from '@theia/core/lib/common/uri';
import { EDITOR_CONTEXT_MENU_SCM } from '@theia/scm-extra/lib/browser/scm-extra-contribution';

import debounce = require('lodash.debounce');

export namespace BlameCommands {
    export const TOGGLE_GIT_ANNOTATIONS: Command = {
        id: 'git.editor.toggle.annotations',
        category: 'Git',
        label: 'Toggle Blame Annotations'
    };
    export const CLEAR_GIT_ANNOTATIONS: Command = {
        id: 'git.editor.clear.annotations'
    };
}

@injectable()
export class BlameContribution implements CommandContribution, KeybindingContribution, MenuContribution {

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(BlameDecorator)
    protected readonly decorator: BlameDecorator;

    @inject(BlameManager)
    protected readonly blameManager: BlameManager;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(BlameCommands.TOGGLE_GIT_ANNOTATIONS, {
            execute: () => {
                const editorWidget = this.currentFileEditorWidget;
                if (editorWidget) {
                    if (this.showsBlameAnnotations(editorWidget.editor.uri)) {
                        this.clearBlame(editorWidget.editor.uri);
                    } else {
                        this.showBlame(editorWidget);
                    }
                }
            },
            isVisible: () =>
                !!this.currentFileEditorWidget,
            isEnabled: () => {
                const editorWidget = this.currentFileEditorWidget;
                return !!editorWidget && this.isBlameable(editorWidget.editor.uri);
            }
        });
        commands.registerCommand(BlameCommands.CLEAR_GIT_ANNOTATIONS, {
            execute: () => {
                const editorWidget = this.currentFileEditorWidget;
                if (editorWidget) {
                    this.clearBlame(editorWidget.editor.uri);
                }
            },
            isVisible: () =>
                !!this.currentFileEditorWidget,
            isEnabled: () => {
                const editorWidget = this.currentFileEditorWidget;
                const enabled = !!editorWidget && this.showsBlameAnnotations(editorWidget.editor.uri);
                return enabled;
            }
        });
    }

    showsBlameAnnotations(uri: string | URI): boolean {
        return this.appliedDecorations.has(uri.toString());
    }

    protected get currentFileEditorWidget(): EditorWidget | undefined {
        const editorWidget = this.editorManager.currentEditor;
        if (editorWidget) {
            if (editorWidget.editor.uri.scheme === 'file') {
                return editorWidget;
            }
        }
        return undefined;
    }

    protected isBlameable(uri: string | URI): boolean {
        return this.blameManager.isBlameable(uri.toString());
    }

    protected appliedDecorations = new Map<string, Disposable>();

    protected async showBlame(editorWidget: EditorWidget): Promise<void> {
        const uri = editorWidget.editor.uri.toString();
        if (this.appliedDecorations.get(uri)) {
            return;
        }
        const editor = editorWidget.editor;
        const document = editor.document;
        const content = document.dirty ? document.getText() : undefined;
        const blame = await this.blameManager.getBlame(uri, content);
        if (blame) {
            const toDispose = new DisposableCollection();
            this.appliedDecorations.set(uri, toDispose);
            toDispose.push(this.decorator.decorate(blame, editor, editor.cursor.line));
            toDispose.push(editor.onDocumentContentChanged(() => this.clearBlame(uri)));
            toDispose.push(editor.onCursorPositionChanged(debounce(_position => {
                if (!toDispose.disposed) {
                    this.decorator.decorate(blame, editor, editor.cursor.line);
                }
            }, 50)));
            editorWidget.disposed.connect(() => this.clearBlame(uri));
        }
    }

    protected clearBlame(uri: string | URI): void {
        const decorations = this.appliedDecorations.get(uri.toString());
        if (decorations) {
            this.appliedDecorations.delete(uri.toString());
            decorations.dispose();
        }
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(EDITOR_CONTEXT_MENU_SCM, {
            commandId: BlameCommands.TOGGLE_GIT_ANNOTATIONS.id,
        });
    }

    registerKeybindings(keybindings: KeybindingRegistry): void {
        keybindings.registerKeybinding({
            command: BlameCommands.TOGGLE_GIT_ANNOTATIONS.id,
            context: EditorKeybindingContexts.editorTextFocus,
            keybinding: 'alt+b'
        });
        keybindings.registerKeybinding({
            command: BlameCommands.CLEAR_GIT_ANNOTATIONS.id,
            context: BlameAnnotationsKeybindingContext.showsBlameAnnotations,
            keybinding: 'esc'
        });
    }

}

@injectable()
export class BlameAnnotationsKeybindingContext extends EditorTextFocusContext {

    @inject(BlameContribution)
    protected readonly blameContribution: BlameContribution;

    @inject(StrictEditorTextFocusContext)
    protected readonly base: StrictEditorTextFocusContext;

    id = BlameAnnotationsKeybindingContext.showsBlameAnnotations;

    protected canHandle(widget: EditorWidget): boolean {
        return this.base.isEnabled() && this.blameContribution.showsBlameAnnotations(widget.editor.uri);
    }
}

export namespace BlameAnnotationsKeybindingContext {
    export const showsBlameAnnotations = 'showsBlameAnnotations';
}
