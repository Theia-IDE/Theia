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

import { injectable, postConstruct, inject, interfaces, Container } from '@theia/core/shared/inversify';
import {
    BaseWidget, PanelLayout, Message, ApplicationShell, Widget, StatefulWidget, ViewContainer
} from '@theia/core/lib/browser';
import { DebugSessionWidget } from './debug-session-widget';
import { DebugConfigurationWidget } from './debug-configuration-widget';
import { DebugViewModel } from './debug-view-model';
import { DebugSessionManager } from '../debug-session-manager';
import { ProgressBarFactory } from '@theia/core/lib/browser/progress-bar-factory';

@injectable()
export class DebugWidget extends BaseWidget implements StatefulWidget, ApplicationShell.TrackableWidgetProvider {

    static createContainer(parent: interfaces.Container): Container {
        const child = DebugSessionWidget.createContainer(parent, {});
        child.bind(DebugConfigurationWidget).toSelf();
        child.bind(DebugWidget).toSelf();
        return child;
    }
    static createWidget(parent: interfaces.Container): DebugWidget {
        return DebugWidget.createContainer(parent).get(DebugWidget);
    }

    static ID = 'debug';
    static LABEL = 'Debug';

    @inject(DebugViewModel)
    readonly model: DebugViewModel;

    @inject(DebugSessionManager)
    readonly sessionManager: DebugSessionManager;

    @inject(DebugConfigurationWidget)
    protected readonly toolbar: DebugConfigurationWidget;

    @inject(DebugSessionWidget)
    protected readonly sessionWidget: DebugSessionWidget;

    @inject(ProgressBarFactory)
    protected readonly progressBarFactory: ProgressBarFactory;

    @postConstruct()
    protected init(): void {
        this.id = DebugWidget.ID;
        this.title.label = DebugWidget.LABEL;
        this.title.caption = DebugWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-debug-alt';
        this.addClass('theia-debug-container');
        this.toDispose.pushAll([
            this.toolbar,
            this.sessionWidget,
            this.sessionManager.onDidCreateDebugSession(session => this.model.push(session)),
            this.sessionManager.onDidDestroyDebugSession(session => this.model.delete(session))
        ]);
        for (const session of this.sessionManager.sessions) {
            this.model.push(session);
        }

        const layout = this.layout = new PanelLayout();
        layout.addWidget(this.toolbar);
        layout.addWidget(this.sessionWidget);

        this.toDispose.push(this.progressBarFactory({ container: this.node, insertMode: 'prepend', locationId: 'debug' }));
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.toolbar.focus();
    }

    getTrackableWidgets(): Widget[] {
        return this.sessionWidget.getTrackableWidgets();
    }

    storeState(): object {
        return this.sessionWidget.storeState();
    }

    restoreState(oldState: ViewContainer.State): void {
        this.sessionWidget.restoreState(oldState);
    }

}
