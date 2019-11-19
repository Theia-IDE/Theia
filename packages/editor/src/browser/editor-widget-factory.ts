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

import { injectable, inject, } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { SelectionService } from '@theia/core/lib/common';
import { NavigatableWidgetOptions, WidgetFactory, LabelProvider } from '@theia/core/lib/browser';
import { EditorWidget } from './editor-widget';
import { TextEditorProvider } from './editor';
import { BreadcrumbsRendererFactory } from '@theia/core/lib/browser/breadcrumbs';

@injectable()
export class EditorWidgetFactory implements WidgetFactory {

    static ID = 'code-editor-opener';

    readonly id = EditorWidgetFactory.ID;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(TextEditorProvider)
    protected readonly editorProvider: TextEditorProvider;

    @inject(SelectionService)
    protected readonly selectionService: SelectionService;

    @inject(BreadcrumbsRendererFactory)
    protected readonly breadcrumbsRendererFactory: BreadcrumbsRendererFactory;

    createWidget(options: NavigatableWidgetOptions): Promise<EditorWidget> {
        const uri = new URI(options.uri);
        return this.createEditor(uri);
    }

    protected async createEditor(uri: URI): Promise<EditorWidget> {
        const icon = await this.labelProvider.getIcon(uri);
        return this.editorProvider(uri).then(textEditor => {
            const breadcrumbsRenderer = this.breadcrumbsRendererFactory(uri);
            const newEditor = new EditorWidget(textEditor, breadcrumbsRenderer, this.selectionService);
            newEditor.id = this.id + ':' + uri.toString();
            newEditor.title.closable = true;
            newEditor.title.label = this.labelProvider.getName(uri);
            newEditor.title.iconClass = icon + ' file-icon';
            newEditor.title.caption = uri.path.toString();
            return newEditor;
        });
    }
}
