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
import { SCM_VIEW_CONTAINER_ID } from '../scm-contribution';
import { ScmService } from '../scm-service';
import { TabBarDecorator } from '@theia/core/lib/browser/shell/tab-bar-decorator';
import { Title, Widget } from '@theia/core/lib/browser';
import { WidgetDecoration } from '@theia/core/lib/browser/widget-decoration';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { ScmPreferences } from '../scm-preferences';

@injectable()
export class ScmTabBarDecorator implements TabBarDecorator {

    readonly id = 'theia-scm-tabbar-decorator';
    protected readonly emitter = new Emitter<void>();

    private readonly toDispose = new DisposableCollection();
    private readonly toDisposeOnDidChange = new DisposableCollection();

    @inject(ScmService)
    protected readonly scmService: ScmService;

    @inject(ScmPreferences)
    protected readonly scmPreferences: ScmPreferences;

    @postConstruct()
    protected init(): void {
        this.toDispose.push(this.scmService.onDidChangeSelectedRepository(repository => {
            this.toDisposeOnDidChange.dispose();
            if (repository) {
                this.toDisposeOnDidChange.push(
                    repository.provider.onDidChange(() => this.fireDidChangeDecorations())
                );
            }
            this.fireDidChangeDecorations();
        }));
    }

    decorate(title: Title<Widget>): WidgetDecoration.Data[] {
        const countBadge = this.scmPreferences['scm.countBadge'];
        if (countBadge && title.owner.id === SCM_VIEW_CONTAINER_ID) {
            const changes = this.collectChangesCount();
            return changes > 0 ? [{ badge: changes }] : [];
        } else {
            return [];
        }
    }

    protected collectChangesCount(): number {
        const repository = this.scmService.selectedRepository;
        let changes = 0;
        if (!repository) {
            return 0;
        }
        repository.provider.groups.map(group => {
            if (group.id === 'index' || group.id === 'workingTree') {
                changes += group.resources.length;
            }
        });
        return changes;
    }

    get onDidChangeDecorations(): Event<void> {
        return this.emitter.event;
    }

    protected fireDidChangeDecorations(): void {
        this.emitter.fire(undefined);
    }

}
