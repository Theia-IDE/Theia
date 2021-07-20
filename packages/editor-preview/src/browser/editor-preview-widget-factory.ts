/********************************************************************************
 * Copyright (C) 2018-2021 Google and others.
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

import URI from '@theia/core/lib/common/uri';
import { EditorWidgetFactory } from '@theia/editor/lib/browser/editor-widget-factory';
import { injectable } from '@theia/core/shared/inversify';
import { EditorPreviewWidget } from './editor-preview-widget';
import { EditorFactoryOptions } from '@theia/editor/lib/browser/editor';

/**
 * @deprecated Now identical to EditorFactoryOptions - use that instead.
 */
export interface EditorPreviewOptions extends EditorFactoryOptions { }

@injectable()
export class EditorPreviewWidgetFactory extends EditorWidgetFactory {
    static ID: string = 'editor-preview-widget';
    readonly id = EditorPreviewWidgetFactory.ID;

    async createWidget(options: EditorFactoryOptions): Promise<EditorPreviewWidget> {
        const uri = new URI(options.uri);
        const editor = await this.createEditor(uri, options) as EditorPreviewWidget;
        if (options.preview) {
            editor.initializePreview();
        }
        return editor;
    }

    protected async constructEditor(uri: URI, options?: EditorFactoryOptions): Promise<EditorPreviewWidget> {
        const textEditor = await this.editorProvider(uri, options);
        return new EditorPreviewWidget(textEditor, this.selectionService);
    }
}
