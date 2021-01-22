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

import '../../src/browser/style/index.css';

import { ContainerModule } from 'inversify';
import {
    KeybindingContext, bindViewContribution,
    FrontendApplicationContribution, ViewContainer,
    ApplicationShellLayoutMigration,
    LabelProviderContribution
} from '@theia/core/lib/browser';
import { FileNavigatorWidget, FILE_NAVIGATOR_ID, EXPLORER_VIEW_CONTAINER_ID, EXPLORER_VIEW_CONTAINER_TITLE_OPTIONS } from './navigator-widget';
import { NavigatorActiveContext } from './navigator-keybinding-context';
import { FileNavigatorContribution } from './navigator-contribution';
import { createFileNavigatorWidget } from './navigator-container';
import { WidgetFactory, WidgetManager } from '@theia/core/lib/browser/widget-manager';
import { bindFileNavigatorPreferences } from './navigator-preferences';
import { FileNavigatorFilter } from './navigator-filter';
import { NavigatorContextKeyService } from './navigator-context-key-service';
import { TabBarToolbarContribution } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { NavigatorDiff } from './navigator-diff';
import { NavigatorLayoutVersion3Migration } from './navigator-layout-migrations';
import { NavigatorTabBarDecorator } from './navigator-tab-bar-decorator';
import { TabBarDecorator } from '@theia/core/lib/browser/shell/tab-bar-decorator';
import { WorkspaceRootLabelProvider } from './navigator-label-provider';

export default new ContainerModule(bind => {
    bindFileNavigatorPreferences(bind);
    bind(FileNavigatorFilter).toSelf().inSingletonScope();

    bind(NavigatorContextKeyService).toSelf().inSingletonScope();

    bindViewContribution(bind, FileNavigatorContribution);
    bind(FrontendApplicationContribution).toService(FileNavigatorContribution);
    bind(TabBarToolbarContribution).toService(FileNavigatorContribution);

    bind(KeybindingContext).to(NavigatorActiveContext).inSingletonScope();

    bind(FileNavigatorWidget).toDynamicValue(ctx =>
        createFileNavigatorWidget(ctx.container)
    );
    bind(WidgetFactory).toDynamicValue(({ container }) => ({
        id: FILE_NAVIGATOR_ID,
        createWidget: () => container.get(FileNavigatorWidget)
    })).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(({ container }) => ({
        id: EXPLORER_VIEW_CONTAINER_ID,
        createWidget: async () => {
            const viewContainer = container.get<ViewContainer.Factory>(ViewContainer.Factory)({
                id: EXPLORER_VIEW_CONTAINER_ID,
                progressLocationId: 'explorer'
            });
            viewContainer.setTitleOptions(EXPLORER_VIEW_CONTAINER_TITLE_OPTIONS);
            const widget = await container.get(WidgetManager).getOrCreateWidget(FILE_NAVIGATOR_ID);
            viewContainer.addWidget(widget, {
                canHide: false,
                initiallyCollapsed: false
            });
            return viewContainer;
        }
    }));
    bind(ApplicationShellLayoutMigration).to(NavigatorLayoutVersion3Migration).inSingletonScope();

    bind(NavigatorDiff).toSelf().inSingletonScope();
    bind(NavigatorTabBarDecorator).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(NavigatorTabBarDecorator);
    bind(TabBarDecorator).toService(NavigatorTabBarDecorator);

    bind(WorkspaceRootLabelProvider).toSelf().inSingletonScope();
    bind(LabelProviderContribution).toService(WorkspaceRootLabelProvider);

});
