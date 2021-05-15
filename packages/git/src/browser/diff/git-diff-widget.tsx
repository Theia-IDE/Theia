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

import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import {
    BaseWidget, Widget, StatefulWidget, Panel, PanelLayout, Message, MessageLoop
} from '@theia/core/lib/browser';
import { EditorManager, DiffNavigatorProvider } from '@theia/editor/lib/browser';
import { GitDiffTreeModel } from './git-diff-tree-model';
import { GitWatcher } from '../../common';
import { GitDiffHeaderWidget } from './git-diff-header-widget';
import { ScmService } from '@theia/scm/lib/browser/scm-service';
import { GitRepositoryProvider } from '../git-repository-provider';
import { ScmTreeWidget } from '@theia/scm/lib/browser/scm-tree-widget';
import { ScmPreferences, ScmViewMode } from '@theia/scm/lib/browser/scm-preferences';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const GIT_DIFF = 'git-diff';
@injectable()
export class GitDiffWidget extends BaseWidget implements StatefulWidget {

    protected readonly GIT_DIFF_TITLE = 'Diff';

    @inject(GitRepositoryProvider) protected readonly repositoryProvider: GitRepositoryProvider;
    @inject(DiffNavigatorProvider) protected readonly diffNavigatorProvider: DiffNavigatorProvider;
    @inject(EditorManager) protected readonly editorManager: EditorManager;
    @inject(GitWatcher) protected readonly gitWatcher: GitWatcher;
    @inject(GitDiffHeaderWidget) protected readonly diffHeaderWidget: GitDiffHeaderWidget;
    @inject(ScmTreeWidget) protected readonly resourceWidget: ScmTreeWidget;
    @inject(GitDiffTreeModel) protected readonly model: GitDiffTreeModel;
    @inject(ScmService) protected readonly scmService: ScmService;
    @inject(ScmPreferences) protected readonly scmPreferences: ScmPreferences;

    protected panel: Panel;

    constructor() {
        super();
        this.id = GIT_DIFF;
        this.title.label = this.GIT_DIFF_TITLE;
        this.title.caption = this.GIT_DIFF_TITLE;
        this.title.closable = true;
        this.title.iconClass = 'theia-git-diff-icon';

        this.addClass('theia-scm');
        this.addClass('theia-git');
        this.addClass('git-diff-container');
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

        this.containerLayout.addWidget(this.diffHeaderWidget);
        this.containerLayout.addWidget(this.resourceWidget);

        this.updateViewMode(this.scmPreferences.get('scm.defaultViewMode'));
        this.toDispose.push(this.scmPreferences.onPreferenceChanged(e => {
            if (e.preferenceName === 'scm.defaultViewMode') {
                this.updateViewMode(e.newValue as ScmViewMode);
            }
        }));
    }

    set viewMode(mode: ScmViewMode) {
        this.resourceWidget.viewMode = mode;
    }
    get viewMode(): ScmViewMode {
        return this.resourceWidget.viewMode;
    }

    async setContent(options: GitDiffTreeModel.Options): Promise<void> {
        this.model.setContent(options);
        this.diffHeaderWidget.setContent(options.diffOptions);
        this.update();
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

    protected updateImmediately(): void {
        this.onUpdateRequest(Widget.Msg.UpdateRequest);
    }

    protected onUpdateRequest(msg: Message): void {
        MessageLoop.sendMessage(this.diffHeaderWidget, msg);
        MessageLoop.sendMessage(this.resourceWidget, msg);
        super.onUpdateRequest(msg);
    }

    protected onAfterAttach(msg: Message): void {
        this.node.appendChild(this.diffHeaderWidget.node);
        this.node.appendChild(this.resourceWidget.node);

        super.onAfterAttach(msg);
        this.update();
    }

    goToPreviousChange(): void {
        this.resourceWidget.goToPreviousChange();
    }

    goToNextChange(): void {
        this.resourceWidget.goToNextChange();
    }

    storeState(): any {
        const state: object = {
            commitState: this.diffHeaderWidget.storeState(),
            changesTreeState: this.resourceWidget.storeState(),
        };
        return state;
    }

    restoreState(oldState: any): void {
        const { commitState, changesTreeState } = oldState;
        this.diffHeaderWidget.restoreState(commitState);
        this.resourceWidget.restoreState(changesTreeState);
    }

}
