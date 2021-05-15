/********************************************************************************
 * Copyright (C) 2020 Arm and others.
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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Message } from '@theia/core/shared/@phosphor/messaging';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import {
    BaseWidget, Widget, StatefulWidget, Panel, PanelLayout, MessageLoop
} from '@theia/core/lib/browser';
import { GitCommitDetailWidgetOptions } from './git-commit-detail-widget-options';
import { GitCommitDetailHeaderWidget } from './git-commit-detail-header-widget';
import { ScmService } from '@theia/scm/lib/browser/scm-service';
import { GitDiffTreeModel } from '../diff/git-diff-tree-model';
import { ScmTreeWidget } from '@theia/scm/lib/browser/scm-tree-widget';
import { ScmPreferences, ScmViewMode } from '@theia/scm/lib/browser/scm-preferences';

@injectable()
export class GitCommitDetailWidget extends BaseWidget implements StatefulWidget {

    protected panel: Panel;

    @inject(ScmService) protected readonly scmService: ScmService;
    @inject(GitCommitDetailHeaderWidget) protected readonly commitDetailHeaderWidget: GitCommitDetailHeaderWidget;
    @inject(ScmTreeWidget) protected readonly resourceWidget: ScmTreeWidget;
    @inject(GitDiffTreeModel) protected readonly model: GitDiffTreeModel;
    @inject(ScmPreferences) protected readonly scmPreferences: ScmPreferences;

    set viewMode(mode: ScmViewMode) {
        this.resourceWidget.viewMode = mode;
    }
    get viewMode(): ScmViewMode {
        return this.resourceWidget.viewMode;
    }

    constructor(
        @inject(GitCommitDetailWidgetOptions) protected readonly options: GitCommitDetailWidgetOptions
    ) {
        super();
        this.id = 'commit' + options.commitSha;
        this.title.label = options.commitSha.substr(0, 8);
        this.title.closable = true;
        this.title.iconClass = 'icon-git-commit tab-git-icon';

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

        this.containerLayout.addWidget(this.commitDetailHeaderWidget);
        this.containerLayout.addWidget(this.resourceWidget);

        this.updateViewMode(this.scmPreferences.get('scm.defaultViewMode'));
        this.toDispose.push(this.scmPreferences.onPreferenceChanged(e => {
            if (e.preferenceName === 'scm.defaultViewMode') {
                this.updateViewMode(e.newValue as ScmViewMode);
            }
        }));

        const diffOptions = {
            range: {
                fromRevision: this.options.commitSha + '~1',
                toRevision: this.options.commitSha
            }
        };
        this.model.setContent({ rootUri: this.options.rootUri, diffOptions });
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
        MessageLoop.sendMessage(this.commitDetailHeaderWidget, msg);
        MessageLoop.sendMessage(this.resourceWidget, msg);
        super.onUpdateRequest(msg);
    }

    protected onAfterAttach(msg: Message): void {
        this.node.appendChild(this.commitDetailHeaderWidget.node);
        this.node.appendChild(this.resourceWidget.node);

        super.onAfterAttach(msg);
        this.update();
    }

    storeState(): any {
        const state: object = {
            changesTreeState: this.resourceWidget.storeState(),
        };
        return state;
    }

    restoreState(oldState: any): void {
        const { changesTreeState } = oldState;
        this.resourceWidget.restoreState(changesTreeState);
    }

}
