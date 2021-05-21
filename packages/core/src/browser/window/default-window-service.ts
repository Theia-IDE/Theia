/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
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

import { inject, injectable, named } from 'inversify';
import { Event, Emitter } from '../../common';
import { CorePreferences } from '../core-preferences';
import { ContributionProvider } from '../../common/contribution-provider';
import { FrontendApplicationContribution, FrontendApplication } from '../frontend-application';
import { WindowService } from './window-service';
import { DEFAULT_WINDOW_HASH } from './window-service';

@injectable()
export class DefaultWindowService implements WindowService, FrontendApplicationContribution {

    protected frontendApplication: FrontendApplication;

    protected onUnloadEmitter = new Emitter<void>();
    get onUnload(): Event<void> {
        return this.onUnloadEmitter.event;
    }

    @inject(CorePreferences)
    protected readonly corePreferences: CorePreferences;

    @inject(ContributionProvider)
    @named(FrontendApplicationContribution)
    protected readonly contributions: ContributionProvider<FrontendApplicationContribution>;

    onStart(app: FrontendApplication): void {
        this.frontendApplication = app;
        this.registerUnloadListeners();
    }

    openNewWindow(url: string): undefined {
        window.open(url, undefined, 'noopener');
        return undefined;
    }

    openNewDefaultWindow(): void {
        this.openNewWindow(DEFAULT_WINDOW_HASH);
    }

    canUnload(): boolean {
        const confirmExit = this.corePreferences['application.confirmExit'];
        let preventUnload = confirmExit === 'always';
        for (const contribution of this.contributions.getContributions()) {
            if (contribution.onWillStop?.(this.frontendApplication)) {
                preventUnload = true;
            }
        }
        return confirmExit === 'never' || !preventUnload;
    }

    /**
     * Implement the mechanism to detect unloading of the page.
     */
    protected registerUnloadListeners(): void {
        window.addEventListener('beforeunload', event => {
            if (!this.canUnload()) {
                return this.preventUnload(event);
            }
        });
        // In a browser, `unload` is correctly fired when the page unloads, unlike Electron.
        // If `beforeunload` is cancelled, the user will be prompted to leave or stay.
        // If the user stays, the page won't be unloaded, so `unload` is not fired.
        // If the user leaves, the page will be unloaded, so `unload` is fired.
        window.addEventListener('unload', () => this.onUnloadEmitter.fire());
    }

    /**
     * Notify the browser that we do not want to unload.
     *
     * Notes:
     *  - Shows a confirmation popup in browsers.
     *  - Prevents the window from closing without confirmation in electron.
     *
     * @param event The beforeunload event
     */
    protected preventUnload(event: BeforeUnloadEvent): string | void {
        event.returnValue = '';
        event.preventDefault();
        return '';
    }

}
