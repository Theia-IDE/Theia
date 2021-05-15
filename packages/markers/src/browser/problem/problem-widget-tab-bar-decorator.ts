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
import { Event, Emitter } from '@theia/core/lib/common/event';
import { ProblemManager } from './problem-manager';
import { TabBarDecorator } from '@theia/core/lib/browser/shell/tab-bar-decorator';
import { Title, Widget } from '@theia/core/lib/browser';
import { WidgetDecoration } from '@theia/core/lib/browser/widget-decoration';
import { ProblemPreferences } from './problem-preferences';

@injectable()
export class ProblemWidgetTabBarDecorator implements TabBarDecorator {

    readonly id = 'theia-problems-widget-tabbar-decorator';
    protected readonly emitter = new Emitter<void>();

    @inject(ProblemManager)
    protected readonly problemManager: ProblemManager;

    @inject(ProblemPreferences)
    protected readonly problemPreferences: ProblemPreferences;

    @postConstruct()
    protected init(): void {
        this.problemManager.onDidChangeMarkers(() => this.fireDidChangeDecorations());
    }

    decorate(title: Title<Widget>): WidgetDecoration.Data[] {
        const countBadge = this.problemPreferences['problems.countBadge'];
        if (countBadge && title.owner.id === 'problems') {
            const { infos, warnings, errors } = this.problemManager.getProblemStat();
            const markerCount = infos + warnings + errors;
            return markerCount > 0 ? [{ badge: markerCount }] : [];
        } else {
            return [];
        }
    }

    get onDidChangeDecorations(): Event<void> {
        return this.emitter.event;
    }

    protected fireDidChangeDecorations(): void {
        this.emitter.fire(undefined);
    }
}
