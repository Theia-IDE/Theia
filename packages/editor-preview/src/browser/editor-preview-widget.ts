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

import { Message } from '@theia/core/shared/@phosphor/messaging';
import { DockPanel, TabBar, Widget, PINNED_CLASS } from '@theia/core/lib/browser';
import { EditorWidget, TextEditor } from '@theia/editor/lib/browser';
import { Disposable, DisposableCollection, Emitter, SelectionService } from '@theia/core/lib/common';
import { find } from '@theia/core/shared/@phosphor/algorithm';

const PREVIEW_TITLE_CLASS = 'theia-editor-preview-title-unpinned';
export class EditorPreviewWidget extends EditorWidget {
    protected _isPreview = false;
    protected lastTabbar: TabBar<Widget> | undefined;

    protected readonly onDidChangePreviewStateEmitter = new Emitter<void>();
    readonly onDidChangePreviewState = this.onDidChangePreviewStateEmitter.event;

    protected readonly toDisposeOnLocationChange = new DisposableCollection();

    get isPreview(): boolean {
        return this._isPreview;
    }

    constructor(
        readonly editor: TextEditor,
        protected readonly selectionService: SelectionService
    ) {
        super(editor, selectionService);
        this.toDispose.push(this.onDidChangePreviewStateEmitter);
        this.toDispose.push(this.toDisposeOnLocationChange);
    }

    initializePreview(): void {
        const oneTimeListeners = new DisposableCollection();
        this._isPreview = true;
        this.title.className += ` ${PREVIEW_TITLE_CLASS}`;
        const oneTimeDirtyChangeListener = this.saveable.onDirtyChanged(() => {
            this.convertToNonPreview();
            oneTimeListeners.dispose();
        });
        oneTimeListeners.push(oneTimeDirtyChangeListener);
        const oneTimeTitleChangeHandler = () => {
            if (this.title.className.indexOf(PINNED_CLASS) >= 0) {
                this.convertToNonPreview();
                oneTimeListeners.dispose();
            }
        };
        this.title.changed.connect(oneTimeTitleChangeHandler);
        oneTimeListeners.push(Disposable.create(() => this.title.changed.disconnect(oneTimeTitleChangeHandler)));
        this.toDispose.push(oneTimeListeners);
    }

    convertToNonPreview(): void {
        if (this._isPreview) {
            this._isPreview = false;
            this.toDisposeOnLocationChange.dispose();
            this.lastTabbar = undefined;
            this.title.className = this.title.className.replace(PREVIEW_TITLE_CLASS, '');
            this.onDidChangePreviewStateEmitter.fire();
            this.onDidChangePreviewStateEmitter.dispose();
        }
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        if (this._isPreview) {
            this.checkForTabbarChange();
        }
    }

    protected checkForTabbarChange(): void {
        const { parent } = this;
        if (parent instanceof DockPanel) {
            this.toDisposeOnLocationChange.dispose();
            const newTabbar = find(parent.tabBars(), tabbar => !!tabbar.titles.find(title => title === this.title));
            if (this.lastTabbar && this.lastTabbar !== newTabbar) {
                this.convertToNonPreview();
            } else {
                this.lastTabbar = newTabbar;
                const listener = () => this.checkForTabbarChange();
                parent.layoutModified.connect(listener);
                this.toDisposeOnLocationChange.push(Disposable.create(() => parent.layoutModified.disconnect(listener)));
            }
        }
    }

    storeState(): { isPreview: boolean, editorState: object } {
        const { _isPreview: isPreview } = this;
        return { isPreview, editorState: this.editor.storeViewState() };
    }

    restoreState(oldState: { isPreview: boolean, editorState: object }): void {
        if (!oldState.isPreview) {
            this.convertToNonPreview();
        }
        this.editor.restoreViewState(oldState.editorState);
    }
}
