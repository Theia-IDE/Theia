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

import { injectable, inject } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { toArray } from '@theia/core/shared/@phosphor/algorithm';
import { TabBar, Widget } from '@theia/core/shared/@phosphor/widgets';

@injectable()
export class ViewColumnService {
    private readonly columnValues = new Map<string, number>();
    private readonly viewColumnIds = new Map<number, string[]>();

    protected readonly onViewColumnChangedEmitter = new Emitter<{ id: string, viewColumn: number }>();

    constructor(
        @inject(ApplicationShell) private readonly shell: ApplicationShell,
    ) {
        let oldColumnValues = new Map<string, number>();
        const update = async () => {
            await new Promise<void>((resolve => setTimeout(() => resolve())));
            this.updateViewColumns();
            this.viewColumnIds.forEach((ids: string[], viewColumn: number) => {
                ids.forEach((id: string) => {
                    if (!oldColumnValues.has(id) || oldColumnValues.get(id) !== viewColumn) {
                        this.onViewColumnChangedEmitter.fire({ id, viewColumn });
                    }
                });
            });
            oldColumnValues = new Map(this.columnValues.entries());
        };
        this.shell.mainPanel.widgetAdded.connect(() => update());
        this.shell.mainPanel.widgetRemoved.connect(() => update());
    }

    get onViewColumnChanged(): Event<{ id: string, viewColumn: number }> {
        return this.onViewColumnChangedEmitter.event;
    }

    updateViewColumns(): void {
        this.columnValues.clear();
        this.viewColumnIds.clear();

        const rows = new Map<number, Set<number>>();
        const columns = new Map<number, Map<number, TabBar<Widget>>>();
        for (const tabBar of toArray(this.shell.mainPanel.tabBars())) {
            if (!tabBar.node.style.top || !tabBar.node.style.left) {
                continue;
            }
            const top = parseInt(tabBar.node.style.top);
            const left = parseInt(tabBar.node.style.left);

            const row = rows.get(top) || new Set<number>();
            row.add(left);
            rows.set(top, row);

            const column = columns.get(left) || new Map<number, TabBar<Widget>>();
            column.set(top, tabBar);
            columns.set(left, column);
        }
        const firstRow = rows.get([...rows.keys()].sort()[0]);
        if (!firstRow) {
            return;
        }
        const lefts = [...firstRow.keys()].sort();
        for (let i = 0; i < lefts.length; i++) {
            const column = columns.get(lefts[i]);
            if (!column) {
                break;
            }
            const cellIndexes = [...column.keys()].sort();
            let viewColumn = Math.min(i, 2);
            for (let j = 0; j < cellIndexes.length; j++) {
                const cell = column.get(cellIndexes[j]);
                if (!cell) {
                    break;
                }
                this.setViewColumn(cell, viewColumn);
                if (viewColumn < 7) {
                    viewColumn += 3;
                }
            }
        }
    }

    protected setViewColumn(tabBar: TabBar<Widget>, viewColumn: number): void {
        const ids = [];
        for (const title of tabBar.titles) {
            const id = title.owner.id;
            ids.push(id);
            this.columnValues.set(id, viewColumn);
        }
        this.viewColumnIds.set(viewColumn, ids);
    }

    getViewColumnIds(viewColumn: number): string[] {
        return this.viewColumnIds.get(viewColumn) || [];
    }

    getViewColumn(id: string): number | undefined {
        return this.columnValues.get(id);
    }

    hasViewColumn(id: string): boolean {
        return this.columnValues.has(id);
    }

    viewColumnsSize(): number {
        return this.viewColumnIds.size;
    }
}
