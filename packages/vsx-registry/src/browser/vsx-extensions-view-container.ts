/********************************************************************************
 * Copyright (C) 2020 TypeFox and others.
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
 *******************************************************************************‚*/

import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { ViewContainer, PanelLayout, ViewContainerPart, Message } from '@theia/core/lib/browser';
import { VSXExtensionsSearchBar } from './vsx-extensions-search-bar';
import { VSXExtensionsWidget, } from './vsx-extensions-widget';
import { VSXExtensionsModel } from './vsx-extensions-model';

@injectable()
export class VSXExtensionsViewContainer extends ViewContainer {

    static ID = 'vsx-extensions-view-container';
    static LABEL = 'Extensions';

    @inject(VSXExtensionsSearchBar)
    protected readonly searchBar: VSXExtensionsSearchBar;

    @inject(VSXExtensionsModel)
    protected readonly model: VSXExtensionsModel;

    @postConstruct()
    protected init(): void {
        super.init();
        this.id = VSXExtensionsViewContainer.ID;
        this.addClass('theia-vsx-extensions-view-container');

        this.setTitleOptions({
            label: VSXExtensionsViewContainer.LABEL,
            iconClass: 'codicon codicon-extensions',
            closeable: true
        });
    }

    protected onActivateRequest(msg: Message): void {
        this.searchBar.activate();
    }

    protected onAfterAttach(msg: Message): void {
        super.onBeforeAttach(msg);
        this.updateMode();
        this.toDisposeOnDetach.push(this.model.search.onDidChangeQuery(() => this.updateMode()));
    }

    protected configureLayout(layout: PanelLayout): void {
        layout.addWidget(this.searchBar);
        super.configureLayout(layout);
    }

    protected currentMode: VSXExtensionsViewContainer.Mode = VSXExtensionsViewContainer.InitialMode;
    protected readonly lastModeState = new Map<VSXExtensionsViewContainer.Mode, ViewContainer.State>();

    protected updateMode(): void {
        const currentMode: VSXExtensionsViewContainer.Mode = !this.model.search.query ? VSXExtensionsViewContainer.DefaultMode : VSXExtensionsViewContainer.SearchResultMode;
        if (currentMode === this.currentMode) {
            return;
        }
        if (this.currentMode !== VSXExtensionsViewContainer.InitialMode) {
            this.lastModeState.set(this.currentMode, super.doStoreState());
        }
        this.currentMode = currentMode;
        const lastState = this.lastModeState.get(currentMode);
        if (lastState) {
            super.doRestoreState(lastState);
        } else {
            for (const part of this.getParts()) {
                this.applyModeToPart(part);
            }
        }
        if (this.currentMode === VSXExtensionsViewContainer.SearchResultMode) {
            const searchPart = this.getParts().find(part => part.wrapped.id === VSXExtensionsWidget.SEARCH_RESULT_ID);
            if (searchPart) {
                searchPart.collapsed = false;
                searchPart.show();
            }
        }
    }

    protected registerPart(part: ViewContainerPart): void {
        super.registerPart(part);
        this.applyModeToPart(part);
    }

    protected applyModeToPart(part: ViewContainerPart): void {
        const partMode = (part.wrapped.id === VSXExtensionsWidget.SEARCH_RESULT_ID ? VSXExtensionsViewContainer.SearchResultMode : VSXExtensionsViewContainer.DefaultMode);
        if (this.currentMode === partMode) {
            part.show();
        } else {
            part.hide();
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected doStoreState(): any {
        const modes: VSXExtensionsViewContainer.State['modes'] = {};
        for (const mode of this.lastModeState.keys()) {
            modes[mode] = this.lastModeState.get(mode);
        }
        return {
            query: this.model.search.query,
            modes
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected doRestoreState(state: any): void {
        // eslint-disable-next-line guard-for-in
        for (const key in state.modes) {
            const mode = Number(key) as VSXExtensionsViewContainer.Mode;
            const modeState = state.modes[mode];
            if (modeState) {
                this.lastModeState.set(mode, modeState);
            }
        }
        this.model.search.query = state.query;
    }

}
export namespace VSXExtensionsViewContainer {
    export const InitialMode = 0;
    export const DefaultMode = 1;
    export const SearchResultMode = 2;
    export type Mode = typeof InitialMode | typeof DefaultMode | typeof SearchResultMode;
    export interface State {
        query: string;
        modes: {
            [mode: number]: ViewContainer.State | undefined
        }
    }
}
