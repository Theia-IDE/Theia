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

import { injectable, inject, optional } from '@theia/core/shared/inversify';
import { Position, Location } from '@theia/core/shared/vscode-languageserver-types';
import { CommandContribution, CommandRegistry, CommandHandler } from '@theia/core/lib/common/command';
import { CommonCommands, QuickInputService } from '@theia/core/lib/browser';
import { EditorCommands } from '@theia/editor/lib/browser';
import { MonacoEditor } from './monaco-editor';
import { MonacoCommandRegistry, MonacoEditorCommandHandler } from './monaco-command-registry';
import { MonacoEditorService } from './monaco-editor-service';
import { MonacoTextModelService } from './monaco-text-model-service';
import { ProtocolToMonacoConverter } from './protocol-to-monaco-converter';

export namespace MonacoCommands {

    export const COMMON_ACTIONS = new Map<string, string>([
        ['undo', CommonCommands.UNDO.id],
        ['redo', CommonCommands.REDO.id],
        ['editor.action.selectAll', CommonCommands.SELECT_ALL.id],
        ['actions.find', CommonCommands.FIND.id],
        ['editor.action.startFindReplaceAction', CommonCommands.REPLACE.id]
    ]);

    export const GO_TO_DEFINITION = 'editor.action.revealDefinition';

    export const EXCLUDE_ACTIONS = new Set([
        'editor.action.quickCommand',
        'editor.action.clipboardCutAction',
        'editor.action.clipboardCopyAction',
        'editor.action.clipboardPasteAction'
    ]);
}

@injectable()
export class MonacoEditorCommandHandlers implements CommandContribution {

    @inject(MonacoCommandRegistry)
    protected readonly monacoCommandRegistry: MonacoCommandRegistry;

    @inject(CommandRegistry)
    protected readonly commandRegistry: CommandRegistry;

    @inject(ProtocolToMonacoConverter)
    protected readonly p2m: ProtocolToMonacoConverter;

    @inject(QuickInputService) @optional()
    protected readonly quickInputService: QuickInputService;

    @inject(MonacoEditorService)
    protected readonly codeEditorService: MonacoEditorService;

    @inject(MonacoTextModelService)
    protected readonly textModelService: MonacoTextModelService;

    @inject(monaco.contextKeyService.ContextKeyService)
    protected readonly contextKeyService: monaco.contextKeyService.ContextKeyService;

    registerCommands(): void {
        this.registerMonacoCommands();
        this.registerEditorCommandHandlers();
    }

    /**
     * Register commands from Monaco to Theia registry.
     *
     * Monaco has different kind of commands which should be handled differently by Theia.
     *
     * ### Editor Actions
     *
     * They should be registered with a label to be visible in the quick command palette.
     *
     * Such actions should be enabled only if the current editor is available and
     * it supports such action in the current context.
     *
     * ### Editor Commands
     *
     * Such actions should be enabled only if the current editor is available.
     *
     * `actions.find` and `editor.action.startFindReplaceAction` are registered as handlers for `find` and `replace`.
     * If handlers are not enabled then the core should prevent the default browser behavior.
     * Other Theia extensions can register alternative implementations using custom enablement.
     *
     * ### Global Commands
     *
     * These commands are not necessary dependent on the current editor and enabled always.
     * But they depend on services which are global in VS Code, but bound to the editor in Monaco,
     * i.e. `ICodeEditorService` or `IContextKeyService`. We should take care of providing Theia implementations for such services.
     *
     * #### Global Native or Editor Commands
     *
     * Namely: `undo`, `redo` and `editor.action.selectAll`. They depend on `ICodeEditorService`.
     * They will try to delegate to the current editor and if it is not available delegate to the browser.
     * They are registered as handlers for corresponding core commands always.
     * Other Theia extensions can provide alternative implementations by introducing a dependency to `@theia/monaco` extension.
     *
     * #### Global Language Commands
     *
     * Like `_executeCodeActionProvider`, they depend on `ICodeEditorService` and `ITextModelService`.
     *
     * #### Global Context Commands
     *
     * It is `setContext`. It depends on `IContextKeyService`.
     *
     * #### Global Editor Commands
     *
     * Like `openReferenceToSide` and `openReference`, they depend on `IListService`.
     * We treat all commands which don't match any other category of global commands as global editor commands
     * and execute them using the instantiation service of the current editor.
     */
    protected registerMonacoCommands(): void {
        const editorRegistry = monaco.editorExtensions.EditorExtensionsRegistry;
        const editorActions = new Map(editorRegistry.getEditorActions().map(({ id, label }) => [id, label]));

        const { codeEditorService, textModelService, contextKeyService } = this;
        const [, globalInstantiationService] = monaco.services.StaticServices.init({ codeEditorService, textModelService, contextKeyService });
        const monacoCommands = monaco.commands.CommandsRegistry.getCommands();
        for (const id of monacoCommands.keys()) {
            if (MonacoCommands.EXCLUDE_ACTIONS.has(id)) {
                continue;
            }
            const handler: CommandHandler = {
                execute: (...args) => {
                    /*
                     * We check monaco focused code editor first since they can contain inline like the debug console and embedded editors like in the peek reference.
                     * If there is not such then we check last focused editor tracked by us.
                     */
                    const editor = codeEditorService.getFocusedCodeEditor() || codeEditorService.getActiveCodeEditor();
                    if (editorActions.has(id)) {
                        const action = editor && editor.getAction(id);
                        if (!action) {
                            return;
                        }
                        return action.run();
                    }
                    const editorCommand = !!editorRegistry.getEditorCommand(id) ||
                        !(id.startsWith('_execute') || id === 'setContext' || MonacoCommands.COMMON_ACTIONS.has(id));
                    const instantiationService = editorCommand ? editor && editor['_instantiationService'] : globalInstantiationService;
                    if (!instantiationService) {
                        return;
                    }
                    return instantiationService.invokeFunction(
                        monacoCommands.get(id)!.handler,
                        ...args
                    );
                },
                isEnabled: () => {
                    const editor = codeEditorService.getFocusedCodeEditor() || codeEditorService.getActiveCodeEditor();

                    if (editorActions.has(id)) {
                        const action = editor && editor.getAction(id);
                        return !!action && action.isSupported();
                    }
                    if (!!editorRegistry.getEditorCommand(id)) {
                        return !!editor;
                    }
                    return true;
                }
            };
            const label = editorActions.get(id);
            this.commandRegistry.registerCommand({ id, label }, handler);
            const coreCommand = MonacoCommands.COMMON_ACTIONS.get(id);
            if (coreCommand) {
                this.commandRegistry.registerHandler(coreCommand, handler);
            }
        }
    }

    protected registerEditorCommandHandlers(): void {
        this.monacoCommandRegistry.registerHandler(EditorCommands.SHOW_REFERENCES.id, this.newShowReferenceHandler());
        this.monacoCommandRegistry.registerHandler(EditorCommands.CONFIG_INDENTATION.id, this.newConfigIndentationHandler());
        this.monacoCommandRegistry.registerHandler(EditorCommands.CONFIG_EOL.id, this.newConfigEolHandler());
        this.monacoCommandRegistry.registerHandler(EditorCommands.INDENT_USING_SPACES.id, this.newConfigTabSizeHandler(true));
        this.monacoCommandRegistry.registerHandler(EditorCommands.INDENT_USING_TABS.id, this.newConfigTabSizeHandler(false));
    }

    protected newShowReferenceHandler(): MonacoEditorCommandHandler {
        return {
            execute: (editor: MonacoEditor, uri: string, position: Position, locations: Location[]) => {
                editor.commandService.executeCommand(
                    'editor.action.showReferences',
                    monaco.Uri.parse(uri),
                    this.p2m.asPosition(position),
                    locations.map(l => this.p2m.asLocation(l))
                );
            }
        };
    }

    protected newConfigIndentationHandler(): MonacoEditorCommandHandler {
        return {
            execute: editor => this.configureIndentation(editor)
        };
    }
    protected configureIndentation(editor: MonacoEditor): void {
        const items = [true, false].map(useSpaces => ({
            label: `Indent Using ${useSpaces ? 'Spaces' : 'Tabs'}`,
            execute: () => this.configureTabSize(editor, useSpaces)
        })
        );
        this.quickInputService?.showQuickPick(items, { placeholder: 'Select Action' });
    }

    protected newConfigEolHandler(): MonacoEditorCommandHandler {
        return {
            execute: editor => this.configureEol(editor)
        };
    }

    protected configureEol(editor: MonacoEditor): void {
        const items = ['LF', 'CRLF'].map(lineEnding =>
        ({
            label: lineEnding,
            execute: () => this.setEol(editor, lineEnding)
        }));
        this.quickInputService?.showQuickPick(items, { placeholder: 'Select End of Line Sequence' });
    }

    protected setEol(editor: MonacoEditor, lineEnding: string): void {
        const model = editor.document && editor.document.textEditorModel;
        if (model) {
            if (lineEnding === 'CRLF' || lineEnding === '\r\n') {
                model.pushEOL(monaco.editor.EndOfLineSequence.CRLF);
            } else {
                model.pushEOL(monaco.editor.EndOfLineSequence.LF);
            }
        }
    }

    protected newConfigTabSizeHandler(useSpaces: boolean): MonacoEditorCommandHandler {
        return {
            execute: editor => this.configureTabSize(editor, useSpaces)
        };
    }
    protected configureTabSize(editor: MonacoEditor, useSpaces: boolean): void {
        const model = editor.document && editor.document.textEditorModel;
        if (model) {
            const { tabSize } = model.getOptions();
            const sizes = Array.from(Array(8), (_, x) => x + 1);
            const tabSizeOptions = sizes.map(size =>
            ({
                label: size === tabSize ? `${size}   Configured Tab Size` : size.toString(),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                execute: () => model.updateOptions({
                    tabSize: size || tabSize,
                    insertSpaces: useSpaces
                })
            }));
            this.quickInputService?.showQuickPick(tabSizeOptions, { placeholder: 'Select Tab Size for Current File' });
        }
    }
}
