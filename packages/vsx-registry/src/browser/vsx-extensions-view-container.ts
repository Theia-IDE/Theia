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
import { VSXExtensionsModel } from './vsx-extensions-model';
import { VSXSearchMode } from './vsx-extensions-search-model';
import { generateExtensionWidgetId } from './vsx-extensions-widget';
import { VSXExtensionsSourceOptions } from './vsx-extensions-source';

@injectable()
export class VSXExtensionsViewContainer extends ViewContainer {

    static ID = 'vsx-extensions-view-container';
    static LABEL = 'Extensions';

    protected get disableDNDBetweenContainers(): boolean {
        return true;
    }

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
            iconClass: 'theia-vsx-extensions-icon',
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

    protected currentMode: VSXSearchMode = VSXSearchMode.Initial;
    protected readonly lastModeState = new Map<VSXSearchMode, ViewContainer.State>();

    protected updateMode(): void {
        const currentMode = this.model.search.getModeForQuery();
        if (currentMode === this.currentMode) {
            return;
        }
        if (this.currentMode !== VSXSearchMode.Initial) {
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

        const specialWidgets = this.getWidgetsForMode();
        if (specialWidgets?.length) {
            const widgetChecker = new Set(specialWidgets);
            const relevantParts = this.getParts().filter(part => widgetChecker.has(part.wrapped.id));
            relevantParts.forEach(part => {
                part.collapsed = false;
                part.show();
            });
        }
    }

    protected registerPart(part: ViewContainerPart): void {
        super.registerPart(part);
        this.applyModeToPart(part);
    }

    protected applyModeToPart(part: ViewContainerPart): void {
        if (this.shouldShowWidget(part)) {
            part.show();
        } else {
            part.hide();
        }
    }

    protected shouldShowWidget(part: ViewContainerPart): boolean {
        const widgetsToShow = this.getWidgetsForMode();
        if (widgetsToShow.length) {
            return widgetsToShow.includes(part.wrapped.id);
        }
        return part.wrapped.id !== generateExtensionWidgetId(VSXExtensionsSourceOptions.SEARCH_RESULT);
    }

    protected getWidgetsForMode(): string[] {
        switch (this.currentMode) {
            case VSXSearchMode.Builtin:
                return [generateExtensionWidgetId(VSXExtensionsSourceOptions.BUILT_IN)];
            case VSXSearchMode.Installed:
                return [generateExtensionWidgetId(VSXExtensionsSourceOptions.INSTALLED)];
            case VSXSearchMode.Recommended:
                return [generateExtensionWidgetId(VSXExtensionsSourceOptions.RECOMMENDED)];
            case VSXSearchMode.Search:
                return [generateExtensionWidgetId(VSXExtensionsSourceOptions.SEARCH_RESULT)];
            default:
                return [];
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
            const mode = Number(key) as VSXSearchMode;
            const modeState = state.modes[mode];
            if (modeState) {
                this.lastModeState.set(mode, modeState);
            }
        }
        this.model.search.query = state.query;
    }

}
export namespace VSXExtensionsViewContainer {
    export interface State {
        query: string;
        modes: {
            [mode: number]: ViewContainer.State | undefined
        }
    }
}
