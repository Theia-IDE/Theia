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

import { EditorManager, EditorOpenerOptions, EditorWidget, EditorFactoryOptions } from '@theia/editor/lib/browser';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { EditorPreviewPreferences } from './editor-preview-preferences';
import { DisposableCollection } from '@theia/core/lib/common';
import URI from '@theia/core/lib/common/uri';
import { EditorPreviewWidgetFactory } from './editor-preview-widget-factory';
import { EditorPreviewWidget } from './editor-preview-widget';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';

@injectable()
export class EditorPreviewManager extends EditorManager {
    readonly id = EditorPreviewWidgetFactory.ID;

    @inject(EditorPreviewPreferences) protected readonly preferences: EditorPreviewPreferences;
    @inject(FrontendApplicationStateService) protected readonly stateService: FrontendApplicationStateService;

    protected currentPreview: EditorPreviewWidget | undefined;
    protected toDisposeOnPreviewChange = new DisposableCollection();
    /**
     * Until the layout has been restored, widget state is not reliable, so we ignore creation events.
     */
    protected layoutIsSet = false;

    @postConstruct()
    protected init(): void {
        super.init();
        // All editors are created, but not all are opened. This sets up the logic to swap previews when the editor is attached.
        this.onCreated((widget: EditorPreviewWidget) => {
            if (this.layoutIsSet && widget.isPreview) {
                const oneTimeDisposable = widget.onDidChangeVisibility(() => {
                    const { currentPreview } = this;
                    this.handleNewPreview(widget);
                    currentPreview?.dispose();
                    oneTimeDisposable.dispose();
                });
            }
        });

        this.preferences.onPreferenceChanged(change => {
            if (!change.newValue) {
                this.currentPreview?.convertToNonPreview();
            };
        });

        this.stateService.reachedState('initialized_layout').then(() => {
            const editors = this.all as EditorPreviewWidget[];
            const currentPreview = editors.find(editor => editor.isPreview);
            if (currentPreview) {
                this.handleNewPreview(currentPreview);
            }
            this.layoutIsSet = true;
        });

        document.addEventListener('dblclick', this.convertEditorOnDoubleClick.bind(this));
    }

    protected async doOpen(widget: EditorPreviewWidget, options?: EditorOpenerOptions): Promise<void> {
        const { preview, widgetOptions = { area: 'main' }, mode = 'activate' } = options ?? {};
        if (!widget.isAttached) {
            if (preview) {
                const insertionOptions = this.currentPreview ? { ref: this.currentPreview } : widgetOptions;
                await this.shell.addWidget(widget, insertionOptions);
            } else {
                this.shell.addWidget(widget, widgetOptions);
            }
        } else if (!preview && widget === this.currentPreview) {
            widget.convertToNonPreview();
        }

        if (mode === 'activate') {
            await this.shell.activateWidget(widget.id);
        } else if (mode === 'reveal') {
            await this.shell.revealWidget(widget.id);
        }
    }

    protected handleNewPreview(widget: EditorPreviewWidget): void {
        this.toDisposeOnPreviewChange.dispose();
        this.currentPreview = widget;
        this.toDisposeOnPreviewChange.push({ dispose: () => this.currentPreview = undefined });
        this.toDisposeOnPreviewChange.push(widget.onDidChangePreviewState(() => this.toDisposeOnPreviewChange.dispose()));
        this.toDisposeOnPreviewChange.push(widget.onDidDispose(() => this.toDisposeOnPreviewChange.dispose()));
    }

    protected async getOrCreateWidget(uri: URI, options?: EditorOpenerOptions): Promise<EditorWidget> {
        return this.tryGetPendingWidget(uri, options) ?? super.getOrCreateWidget(uri, options);
    }

    protected createWidgetOptions(uri: URI, options?: EditorOpenerOptions): EditorFactoryOptions {
        const navigatableOptions = super.createWidgetOptions(uri, options);
        navigatableOptions.preview = !!(options?.preview && this.preferences['editor.enablePreview']);
        return navigatableOptions;
    }

    protected convertEditorOnDoubleClick(event: Event): void {
        const widget = this.shell.findTargetedWidget(event);
        if (widget === this.currentPreview) {
            this.currentPreview?.convertToNonPreview();
        }
    }
}
