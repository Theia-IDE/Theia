/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
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
import { TreeDecorator, TreeDecoration } from '@theia/core/lib/browser/tree/tree-decorator';
import { Emitter } from '@theia/core/lib/common/event';
import { Tree } from '@theia/core/lib/browser/tree/tree';
import {
    ApplicationShell,
    DepthFirstTreeIterator,
    FrontendApplication,
    FrontendApplicationContribution,
    NavigatableWidget,
    Saveable,
    Widget,
} from '@theia/core/lib/browser';
import { Disposable } from '@theia/core/lib/common';
import { OpenEditorNode } from '@theia/navigator/lib/browser/open-editors-widget/navigator-open-editors-tree-model';
import { EditorPreviewWidget } from './editor-preview-widget';
import { EditorPreviewManager } from './editor-preview-manager';

@injectable()
export class EditorPreviewTreeDecorator implements TreeDecorator, FrontendApplicationContribution {
    @inject(EditorPreviewManager) protected readonly editorPreviewManager: EditorPreviewManager;
    @inject(ApplicationShell) protected readonly shell: ApplicationShell;

    readonly id = 'theia-open-editors-file-decorator';
    protected decorationsMap = new Map<string, TreeDecoration.Data>();

    protected readonly decorationsChangedEmitter = new Emitter();
    readonly onDidChangeDecorations = this.decorationsChangedEmitter.event;
    protected readonly toDisposeOnDirtyChanged = new Map<string, Disposable>();
    protected readonly toDisposeOnPreviewPinned = new Map<string, Disposable>();

    onDidInitializeLayout(app: FrontendApplication): void {
        this.shell.onDidAddWidget(widget => this.registerEditorListeners(widget));
        this.shell.onDidRemoveWidget(widget => this.unregisterEditorListeners(widget));
        this.editorWidgets.forEach(widget => this.registerEditorListeners(widget));
    }

    protected registerEditorListeners(widget: Widget): void {
        const saveable = Saveable.get(widget);
        if (saveable) {
            this.toDisposeOnDirtyChanged.set(widget.id, saveable.onDirtyChanged(() => {
                this.fireDidChangeDecorations((tree: Tree) => this.collectDecorators(tree));
            }));
        }
        if (widget instanceof EditorPreviewWidget) {
            this.toDisposeOnPreviewPinned.set(widget.id, widget.onDidChangePreviewState(() => {
                this.fireDidChangeDecorations((tree: Tree) => this.collectDecorators(tree));
                this.toDisposeOnPreviewPinned.get(widget.id)?.dispose();
                this.toDisposeOnDirtyChanged.delete(widget.id);
            }));
        }
    }

    protected unregisterEditorListeners(widget: Widget): void {
        this.toDisposeOnDirtyChanged.get(widget.id)?.dispose();
        this.toDisposeOnDirtyChanged.delete(widget.id);
        this.toDisposeOnPreviewPinned.get(widget.id)?.dispose();
        this.toDisposeOnPreviewPinned.delete(widget.id);
    }

    protected get editorWidgets(): NavigatableWidget[] {
        return this.shell.widgets.filter((widget): widget is NavigatableWidget => NavigatableWidget.is(widget));
    }

    protected fireDidChangeDecorations(event: (tree: Tree) => Map<string, TreeDecoration.Data>): void {
        this.decorationsChangedEmitter.fire(event);
    }

    decorations(tree: Tree): Map<string, TreeDecoration.Data> {
        return this.collectDecorators(tree);
    }

    // Add workspace root as caption suffix and italicize if PreviewWidget
    protected collectDecorators(tree: Tree): Map<string, TreeDecoration.Data> {
        const result = new Map<string, TreeDecoration.Data>();
        if (tree.root === undefined) {
            return result;
        }
        for (const node of new DepthFirstTreeIterator(tree.root)) {
            if (OpenEditorNode.is(node)) {
                const { widget } = node;
                const isPreviewWidget = widget instanceof EditorPreviewWidget && widget.isPreview;
                const decorations: TreeDecoration.Data = {
                    fontData: { style: isPreviewWidget ? 'italic' : undefined }
                };
                result.set(node.id, decorations);
            }
        }
        return result;
    }
}
