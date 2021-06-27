/********************************************************************************
 * Copyright (C) 2021 SAP SE or an SAP affiliate company and others.
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
import {
    ViewContainer,
    ViewContainerTitleOptions,
    WidgetFactory,
    WidgetManager
} from '@theia/core/lib/browser';
import { SearchInWorkspaceWidget } from './search-in-workspace-widget';

export const SEARCH_VIEW_CONTAINER_ID = 'search-view-container';
export const SEARCH_VIEW_CONTAINER_TITLE_OPTIONS: ViewContainerTitleOptions = {
    label: 'Search',
    iconClass: 'search-in-workspace-tab-icon',
    closeable: true
};

@injectable()
export class SearchInWorkspaceFactory implements WidgetFactory {

    static ID = SEARCH_VIEW_CONTAINER_ID;

    readonly id = SearchInWorkspaceFactory.ID;

    protected searchWidgetOptions: ViewContainer.Factory.WidgetOptions = {
        canHide: false,
        initiallyCollapsed: false,
        disableDraggingToOtherContainers: true
    };

    @inject(ViewContainer.Factory)
    protected readonly viewContainerFactory: ViewContainer.Factory;
    @inject(WidgetManager) protected readonly widgetManager: WidgetManager;

    async createWidget(): Promise<ViewContainer> {
        const viewContainer = this.viewContainerFactory({
            id: SEARCH_VIEW_CONTAINER_ID,
            progressLocationId: 'search'
        });
        viewContainer.setTitleOptions(SEARCH_VIEW_CONTAINER_TITLE_OPTIONS);
        const widget = await this.widgetManager.getOrCreateWidget(SearchInWorkspaceWidget.ID);
        viewContainer.addWidget(widget, this.searchWidgetOptions);
        return viewContainer;
    }
}
