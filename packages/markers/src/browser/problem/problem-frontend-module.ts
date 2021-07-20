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

import '../../../src/browser/style/index.css';

import { ContainerModule } from '@theia/core/shared/inversify';
import { ProblemWidget, PROBLEMS_WIDGET_ID } from './problem-widget';
import { ProblemContribution } from './problem-contribution';
import { createProblemWidget } from './problem-container';
import { FrontendApplicationContribution, bindViewContribution, ApplicationShellLayoutMigration, LabelProviderContribution } from '@theia/core/lib/browser';
import { ProblemManager } from './problem-manager';
import { WidgetFactory } from '@theia/core/lib/browser/widget-manager';
import { NavigatorTreeDecorator } from '@theia/navigator/lib/browser/navigator-decorator-service';
import { ProblemDecorator } from './problem-decorator';
import { ProblemTabBarDecorator } from './problem-tabbar-decorator';
import { TabBarToolbarContribution } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { ProblemLayoutVersion3Migration } from './problem-layout-migrations';
import { TabBarDecorator } from '@theia/core/lib/browser/shell/tab-bar-decorator';
import { bindProblemPreferences } from './problem-preferences';
import { MarkerTreeLabelProvider } from '../marker-tree-label-provider';
import { ProblemWidgetTabBarDecorator } from './problem-widget-tab-bar-decorator';
import { OpenEditorsTreeDecorator } from '@theia/navigator/lib/browser/open-editors-widget/navigator-open-editors-decorator-service';

export default new ContainerModule(bind => {
    bindProblemPreferences(bind);

    bind(ProblemManager).toSelf().inSingletonScope();

    bind(ProblemWidget).toDynamicValue(ctx =>
        createProblemWidget(ctx.container)
    );
    bind(WidgetFactory).toDynamicValue(context => ({
        id: PROBLEMS_WIDGET_ID,
        createWidget: () => context.container.get<ProblemWidget>(ProblemWidget)
    }));
    bind(ApplicationShellLayoutMigration).to(ProblemLayoutVersion3Migration).inSingletonScope();

    bindViewContribution(bind, ProblemContribution);
    bind(FrontendApplicationContribution).toService(ProblemContribution);
    bind(TabBarToolbarContribution).toService(ProblemContribution);

    bind(ProblemDecorator).toSelf().inSingletonScope();
    bind(NavigatorTreeDecorator).toService(ProblemDecorator);
    bind(OpenEditorsTreeDecorator).toService(ProblemDecorator);
    bind(ProblemTabBarDecorator).toSelf().inSingletonScope();
    bind(TabBarDecorator).toService(ProblemTabBarDecorator);

    bind(MarkerTreeLabelProvider).toSelf().inSingletonScope();
    bind(LabelProviderContribution).toService(MarkerTreeLabelProvider);

    bind(ProblemWidgetTabBarDecorator).toSelf().inSingletonScope();
    bind(TabBarDecorator).toService(ProblemWidgetTabBarDecorator);
});
