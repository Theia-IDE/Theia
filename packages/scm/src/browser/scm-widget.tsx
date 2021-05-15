/********************************************************************************
 * Copyright (C) 2019 Red Hat, Inc. and others.
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

/* eslint-disable no-null/no-null, @typescript-eslint/no-explicit-any */

import { Message } from '@theia/core/shared/@phosphor/messaging';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import {
    BaseWidget, Widget, StatefulWidget, Panel, PanelLayout, MessageLoop, CompositeTreeNode, SelectableTreeNode,
} from '@theia/core/lib/browser';
import { ScmCommitWidget } from './scm-commit-widget';
import { ScmAmendWidget } from './scm-amend-widget';
import { ScmNoRepositoryWidget } from './scm-no-repository-widget';
import { ScmService } from './scm-service';
import { ScmTreeWidget } from './scm-tree-widget';
import { ScmPreferences, ScmViewMode } from './scm-preferences';

@injectable()
export class ScmWidget extends BaseWidget implements StatefulWidget {

    protected panel: Panel;

    static ID = 'scm-view';

    @inject(ScmService) protected readonly scmService: ScmService;
    @inject(ScmCommitWidget) protected readonly commitWidget: ScmCommitWidget;
    @inject(ScmTreeWidget) readonly resourceWidget: ScmTreeWidget;
    @inject(ScmAmendWidget) protected readonly amendWidget: ScmAmendWidget;
    @inject(ScmNoRepositoryWidget) readonly noRepositoryWidget: ScmNoRepositoryWidget;
    @inject(ScmPreferences) protected readonly scmPreferences: ScmPreferences;

    set viewMode(mode: ScmViewMode) {
        this.resourceWidget.viewMode = mode;
    }
    get viewMode(): ScmViewMode {
        return this.resourceWidget.viewMode;
    }

    constructor() {
        super();
        this.node.tabIndex = 0;
        this.id = ScmWidget.ID;
        this.addClass('theia-scm');
        this.addClass('theia-scm-main-container');
    }

    @postConstruct()
    protected init(): void {
        const layout = new PanelLayout();
        this.layout = layout;
        this.panel = new Panel({
            layout: new PanelLayout({
            })
        });
        this.panel.node.tabIndex = -1;
        this.panel.node.setAttribute('class', 'theia-scm-panel');
        layout.addWidget(this.panel);

        this.containerLayout.addWidget(this.commitWidget);
        this.containerLayout.addWidget(this.resourceWidget);
        this.containerLayout.addWidget(this.amendWidget);
        this.containerLayout.addWidget(this.noRepositoryWidget);

        this.refresh();
        this.toDispose.push(this.scmService.onDidChangeSelectedRepository(() => this.refresh()));
        this.updateViewMode(this.scmPreferences.get('scm.defaultViewMode'));
        this.toDispose.push(this.scmPreferences.onPreferenceChanged(e => {
            if (e.preferenceName === 'scm.defaultViewMode') {
                this.updateViewMode(e.newValue as ScmViewMode);
            }
        }));
    }

    get containerLayout(): PanelLayout {
        return this.panel.layout as PanelLayout;
    }

    /**
     * Updates the view mode based on the preference value.
     * @param preference the view mode preference.
     */
    protected updateViewMode(preference: ScmViewMode): void {
        this.viewMode = preference;
    }

    protected readonly toDisposeOnRefresh = new DisposableCollection();
    protected refresh(): void {
        this.toDisposeOnRefresh.dispose();
        this.toDispose.push(this.toDisposeOnRefresh);
        const repository = this.scmService.selectedRepository;
        this.title.label = repository ? repository.provider.label : 'no repository found';
        this.title.caption = this.title.label;
        this.update();
        if (repository) {
            this.toDisposeOnRefresh.push(repository.onDidChange(() => this.update()));
            // render synchronously to avoid cursor jumping
            // see https://stackoverflow.com/questions/28922275/in-reactjs-why-does-setstate-behave-differently-when-called-synchronously/28922465#28922465
            this.toDisposeOnRefresh.push(repository.input.onDidChange(() => this.updateImmediately()));
            this.toDisposeOnRefresh.push(repository.input.onDidFocus(() => this.focusInput()));

            this.commitWidget.show();
            this.resourceWidget.show();
            this.amendWidget.show();
            this.noRepositoryWidget.hide();
        } else {
            this.commitWidget.hide();
            this.resourceWidget.hide();
            this.amendWidget.hide();
            this.noRepositoryWidget.show();
        }
    }

    protected updateImmediately(): void {
        this.onUpdateRequest(Widget.Msg.UpdateRequest);
    }

    protected onUpdateRequest(msg: Message): void {
        MessageLoop.sendMessage(this.commitWidget, msg);
        MessageLoop.sendMessage(this.resourceWidget, msg);
        MessageLoop.sendMessage(this.amendWidget, msg);
        MessageLoop.sendMessage(this.noRepositoryWidget, msg);
        super.onUpdateRequest(msg);
    }

    protected onAfterAttach(msg: Message): void {
        this.node.appendChild(this.commitWidget.node);
        this.node.appendChild(this.resourceWidget.node);
        this.node.appendChild(this.amendWidget.node);
        this.node.appendChild(this.noRepositoryWidget.node);

        super.onAfterAttach(msg);
        this.update();
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.refresh();
        if (this.commitWidget.isVisible) {
            this.commitWidget.focus();
        } else {
            this.node.focus();
        }
    }

    protected focusInput(): void {
        this.commitWidget.focus();
    }

    storeState(): any {
        const state: object = {
            commitState: this.commitWidget.storeState(),
            changesTreeState: this.resourceWidget.storeState(),
        };
        return state;
    }

    restoreState(oldState: any): void {
        const { commitState, changesTreeState } = oldState;
        this.commitWidget.restoreState(commitState);
        this.resourceWidget.restoreState(changesTreeState);
    }

    collapseScmTree(): void {
        const { model } = this.resourceWidget;
        const root = model.root;
        if (CompositeTreeNode.is(root)) {
            root.children.map(group => {
                if (CompositeTreeNode.is(group)) {
                    group.children.map(folderNode => {
                        if (CompositeTreeNode.is(folderNode)) {
                            model.collapseAll(folderNode);
                        }
                        if (SelectableTreeNode.isSelected(folderNode)) {
                            model.toggleNode(folderNode);
                        }
                    });
                }
            });
        }
    }
}
