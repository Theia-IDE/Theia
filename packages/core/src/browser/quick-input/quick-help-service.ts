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
import { CancellationToken } from '../../common';
import { QuickAccessContribution, QuickAccessProvider, QuickAccessRegistry } from './quick-access';
import { QuickInputService, QuickPickItem, QuickPickSeparator } from './quick-input-service';

@injectable()
export class QuickHelpService implements QuickAccessProvider, QuickAccessContribution {
    static PREFIX = '?';

    @inject(QuickAccessRegistry)
    protected quickAccessRegistry: QuickAccessRegistry;

    @inject(QuickInputService)
    protected quickInputService: QuickInputService;

    getPicks(filter: string, token: CancellationToken): (QuickPickItem | QuickPickSeparator)[] {
        const { editorProviders, globalProviders } = this.getQuickAccessProviders();
        const result: (QuickPickItem | QuickPickSeparator)[] = editorProviders.length === 0 || globalProviders.length === 0 ?
            // Without groups
            [
                ...(editorProviders.length === 0 ? globalProviders : editorProviders)
            ] :

            // With groups
            [
                { type: 'separator', label: 'global commands' },
                ...globalProviders,
                { type: 'separator', label: 'editor commands' },
                ...editorProviders
            ];
        return result;
    }

    private getQuickAccessProviders(): { editorProviders: QuickPickItem[], globalProviders: QuickPickItem[] } {
        const globalProviders: QuickPickItem[] = [];
        const editorProviders: QuickPickItem[] = [];

        const providers = this.quickAccessRegistry.getQuickAccessProviders();

        for (const provider of providers.sort((providerA, providerB) => providerA.prefix.localeCompare(providerB.prefix))) {
            if (provider.prefix === QuickHelpService.PREFIX) {
                continue; // exclude help which is already active
            }

            for (const helpEntry of provider.helpEntries) {
                const prefix = helpEntry.prefix || provider.prefix;
                const label = prefix || '\u2026' /* ... */;

                (helpEntry.needsEditor ? editorProviders : globalProviders).push({
                    label,
                    ariaLabel: `${label}, ${helpEntry.description}`,
                    description: helpEntry.description,
                    execute: () => this.quickInputService.open(prefix)
                });
            }
        }

        return { editorProviders, globalProviders };
    }

    registerQuickAccessProvider(): void {
        this.quickAccessRegistry.registerQuickAccessProvider(
            {
                getInstance: () => this,
                prefix: QuickHelpService.PREFIX,
                placeholder: 'Type "?" to get help on the actions you can take from here.',
                helpEntries: [{ description: 'Show all Quick Access Providers', needsEditor: false }]
            }
        );
    }
}
