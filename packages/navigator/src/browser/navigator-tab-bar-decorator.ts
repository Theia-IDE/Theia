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

import { inject, injectable } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { TabBarDecorator } from '@theia/core/lib/browser/shell/tab-bar-decorator';
import { EXPLORER_VIEW_CONTAINER_ID } from './navigator-widget-factory';
import { ApplicationShell, FrontendApplication, FrontendApplicationContribution, Saveable, Title, Widget } from '@theia/core/lib/browser';
import { WidgetDecoration } from '@theia/core/lib/browser/widget-decoration';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { FileNavigatorPreferences } from './navigator-preferences';

@injectable()
export class NavigatorTabBarDecorator implements TabBarDecorator, FrontendApplicationContribution {

    @inject(FileNavigatorPreferences)
    protected readonly fileNavigatorPreferences: FileNavigatorPreferences;

    readonly id = 'theia-navigator-tabbar-decorator';
    protected applicationShell: ApplicationShell;

    protected readonly emitter = new Emitter<void>();
    private readonly toDispose = new DisposableCollection();
    private readonly toDisposeOnDirtyChanged = new Map<string, Disposable>();

    onStart(app: FrontendApplication): void {
        this.applicationShell = app.shell;
        if (!!this.getDirtyEditorsCount()) {
            this.fireDidChangeDecorations();
        }
        this.toDispose.pushAll([
            this.applicationShell.onDidAddWidget(widget => {
                const saveable = Saveable.get(widget);
                if (saveable) {
                    this.toDisposeOnDirtyChanged.set(widget.id, saveable.onDirtyChanged(() => this.fireDidChangeDecorations()));
                }
            }),
            this.applicationShell.onDidRemoveWidget(widget => this.toDisposeOnDirtyChanged.get(widget.id)?.dispose())
        ]);
    }

    decorate(title: Title<Widget>): WidgetDecoration.Data[] {
        const countBadge = this.fileNavigatorPreferences['explorer.countBadge'];
        if (countBadge && title.owner.id === EXPLORER_VIEW_CONTAINER_ID) {
            const changes = this.getDirtyEditorsCount();
            return changes > 0 ? [{ badge: changes }] : [];
        } else {
            return [];
        }
    }

    protected getDirtyEditorsCount(): number {
        return this.applicationShell.widgets.filter(widget => Saveable.isDirty(widget)).length;
    }

    get onDidChangeDecorations(): Event<void> {
        return this.emitter.event;
    }

    protected fireDidChangeDecorations(): void {
        this.emitter.fire(undefined);
    }
}
