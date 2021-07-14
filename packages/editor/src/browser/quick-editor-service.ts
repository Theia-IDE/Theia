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

import { injectable, inject } from '@theia/core/shared/inversify';
import { CancellationToken } from '@theia/core/lib/common';
import URI from '@theia/core/lib/common/uri';
import { LabelProvider } from '@theia/core/lib/browser/label-provider';
import { OpenerService } from '@theia/core/lib/browser/opener-service';
import { QuickAccessProvider, QuickAccessRegistry } from '@theia/core/lib/browser/quick-input/quick-access';
import { QuickAccessContribution } from '@theia/core/lib/browser/quick-input/quick-access';
import { filterItems, QuickPickItem, QuickPickSeparator } from '@theia/core/lib/browser/quick-input/quick-input-service';
import { EditorManager, EditorWidget } from '.';

@injectable()
export class QuickEditorService implements QuickAccessContribution, QuickAccessProvider {
    static PREFIX = 'edt ';

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(QuickAccessRegistry)
    protected readonly quickAccessRegistry: QuickAccessRegistry;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    registerQuickAccessProvider(): void {
        this.quickAccessRegistry.registerQuickAccessProvider({
            getInstance: () => this,
            prefix: QuickEditorService.PREFIX,
            placeholder: '',
            helpEntries: [{ description: 'Show All Opened Editors', needsEditor: false }]
        });
    }

    getPicks(filter: string, token: CancellationToken): (QuickPickItem | QuickPickSeparator)[] {
        const editorItems: QuickPickItem[] = [];

        // Get the alphabetically sorted list of URIs of all currently opened editor widgets.
        const widgets: URI[] = this.editorManager.all
            .map((w: EditorWidget) => w.editor.uri)
            .sort();

        if (widgets.length === 0) {
            editorItems.push(({
                label: 'List of opened editors is currently empty'
            }));
        } else {
            for (const uri of widgets) {
                const item = this.toItem(uri);
                editorItems.push(item);
            }
        }

        return filterItems(editorItems.slice(), filter);
    }

    protected toItem(uri: URI): QuickPickItem {
        const description = this.labelProvider.getLongName(uri.parent);
        const icon = this.labelProvider.getIcon(uri);
        const iconClasses = icon === '' ? undefined : [icon + ' file-icon'];

        return {
            label: this.labelProvider.getName(uri),
            description: description,
            iconClasses,
            ariaLabel: uri.path.toString(),
            alwaysShow: true,
            execute: () => this.openFile(uri)
        };
    }

    protected openFile(uri: URI): void {
        this.openerService.getOpener(uri)
            .then(opener => opener.open(uri));
    }
}
