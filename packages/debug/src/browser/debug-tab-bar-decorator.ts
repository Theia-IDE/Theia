/********************************************************************************
 * Copyright (C) 2020 Ericsson and others.
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

import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { DebugSessionManager } from './debug-session-manager';
import { DebugWidget } from './view/debug-widget';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { TabBarDecorator } from '@theia/core/lib/browser/shell/tab-bar-decorator';
import { Title, Widget } from '@theia/core/lib/browser';
import { WidgetDecoration } from '@theia/core/lib/browser/widget-decoration';
import { DisposableCollection } from '@theia/core/lib/common';
import { DebugPreferences } from './debug-preferences';

@injectable()
export class DebugTabBarDecorator implements TabBarDecorator {
    readonly id = 'theia-debug-tabbar-decorator';

    protected readonly emitter = new Emitter<void>();
    protected toDispose = new DisposableCollection();

    @inject(DebugSessionManager)
    protected readonly debugSessionManager: DebugSessionManager;

    @inject(DebugPreferences)
    protected readonly debugPreferences: DebugPreferences;

    @postConstruct()
    protected init(): void {
        this.toDispose.pushAll([
            this.debugSessionManager.onDidStartDebugSession(() => this.fireDidChangeDecorations()),
            this.debugSessionManager.onDidDestroyDebugSession(() => this.fireDidChangeDecorations())
        ]);
    }

    decorate(title: Title<Widget>): WidgetDecoration.Data[] {
        const countBadge = this.debugPreferences['debug.countBadge'];
        return (countBadge && title.owner.id === DebugWidget.ID)
            ? [{ badge: this.debugSessionManager.sessions.length }]
            : [];
    }

    get onDidChangeDecorations(): Event<void> {
        return this.emitter.event;
    }

    protected fireDidChangeDecorations(): void {
        this.emitter.fire(undefined);
    }
}
