/********************************************************************************
 * Copyright (c) 2021 SAP SE or an SAP affiliate company and others.
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

import { inject, injectable } from 'inversify';
import { filterItems, QuickPickItem, QuickPicks } from '..';
import { CancellationToken, Disposable } from '../../common';
import { ContextKeyService } from '../context-key-service';
import { QuickAccessProvider, QuickAccessRegistry } from './quick-access';
import { QuickAccessContribution } from './quick-access';

export interface QuickViewItem {
    readonly label: string;
    readonly when?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly open: () => any;
}

@injectable()
export class QuickViewService implements QuickAccessContribution, QuickAccessProvider {
    static PREFIX = 'view ';

    protected readonly items: (QuickPickItem & { when?: string })[] = [];
    private hiddenItemLabels = new Set<string | undefined>();

    @inject(QuickAccessRegistry)
    protected readonly quickAccessRegistry: QuickAccessRegistry;

    @inject(ContextKeyService)
    protected readonly contextKexService: ContextKeyService;

    registerItem(item: QuickViewItem): Disposable {
        const quickOpenItem = {
            label: item.label,
            accept: () => item.open(),
            when: item.when
        };
        this.items.push(quickOpenItem);
        this.items.sort((a, b) => a.label!.localeCompare(b.label!));

        return Disposable.create(() => {
            const index = this.items.indexOf(quickOpenItem);
            if (index !== -1) {
                this.items.splice(index, 1);
            }
        });
    }

    hideItem(label: string): void {
        this.hiddenItemLabels.add(label);
    }

    showItem(label: string): void {
        this.hiddenItemLabels.delete(label);
    }

    registerQuickAccessProvider(): void {
        this.quickAccessRegistry.registerQuickAccessProvider({
            getInstance: () => this,
            prefix: QuickViewService.PREFIX,
            placeholder: '',
            helpEntries: [{ description: 'Open View', needsEditor: false }]
        });
    }

    getPicks(filter: string, token: CancellationToken): QuickPicks {
        const items = this.items.filter(item =>
            (item.when === undefined || this.contextKexService.match(item.when)) &&
            (!this.hiddenItemLabels.has(item.label))
        );
        return filterItems(items, filter);
    }

    readonly prefix = 'view ';

}
