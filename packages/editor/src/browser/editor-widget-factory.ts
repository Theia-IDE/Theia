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

import { injectable, inject, } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { SelectionService } from '@theia/core/lib/common';
import { WidgetFactory, LabelProvider } from '@theia/core/lib/browser';
import { EditorWidget } from './editor-widget';
import { EditorFactoryOptions, TextEditorProvider } from './editor';

@injectable()
export class EditorWidgetFactory implements WidgetFactory {

    static createID(uri: URI, counter?: number): string {
        return EditorWidgetFactory.ID
            + `:${uri.toString()}`
            + (counter !== undefined ? `:${counter}` : '');
    }

    static ID = 'code-editor-opener';

    readonly id = EditorWidgetFactory.ID;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(TextEditorProvider)
    protected readonly editorProvider: TextEditorProvider;

    @inject(SelectionService)
    protected readonly selectionService: SelectionService;

    createWidget(options: EditorFactoryOptions): Promise<EditorWidget> {
        const uri = new URI(options.uri);
        return this.createEditor(uri, options);
    }

    protected async createEditor(uri: URI, options?: EditorFactoryOptions): Promise<EditorWidget> {
        const newEditor = await this.constructEditor(uri);

        this.setLabels(newEditor, uri);
        const labelListener = this.labelProvider.onDidChange(event => {
            if (event.affects(uri)) {
                this.setLabels(newEditor, uri);
            }
        });
        newEditor.onDispose(() => labelListener.dispose());

        newEditor.id = EditorWidgetFactory.createID(uri, options?.counter);

        newEditor.title.closable = true;
        return newEditor;
    }

    protected async constructEditor(uri: URI, options?: EditorFactoryOptions): Promise<EditorWidget> {
        const textEditor = await this.editorProvider(uri);
        return new EditorWidget(textEditor, this.selectionService);
    }

    private setLabels(editor: EditorWidget, uri: URI): void {
        editor.title.caption = this.labelProvider.getLongName(uri);
        const icon = this.labelProvider.getIcon(uri);
        editor.title.label = this.labelProvider.getName(uri);
        editor.title.iconClass = icon + ' file-icon';
    }
}
