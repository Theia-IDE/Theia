/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
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

import { ContainerModule } from 'inversify';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { OpenHandler, WidgetFactory, FrontendApplicationContribution, KeybindingContext, KeybindingContribution, QuickOpenContribution } from '@theia/core/lib/browser';
import { VariableContribution } from '@theia/variable-resolver/lib/browser';
import { EditorManager, EditorAccess, ActiveEditorAccess, CurrentEditorAccess } from './editor-manager';
import { EditorContribution } from './editor-contribution';
import { EditorMenuContribution } from './editor-menu';
import { EditorCommandContribution } from './editor-command';
import { EditorTextFocusContext, StrictEditorTextFocusContext, DiffEditorTextFocusContext } from './editor-keybinding-contexts';
import { EditorKeybindingContribution } from './editor-keybinding';
import { bindEditorPreferences } from './editor-preferences';
import { EditorWidgetFactory } from './editor-widget-factory';
import { EditorNavigationContribution } from './editor-navigation-contribution';
import { NavigationLocationUpdater } from './navigation/navigation-location-updater';
import { NavigationLocationService } from './navigation/navigation-location-service';
import { NavigationLocationSimilarity } from './navigation/navigation-location-similarity';
import { EditorVariableContribution } from './editor-variable-contribution';
import { SemanticHighlightingService } from './semantic-highlight/semantic-highlighting-service';
import { EditorQuickOpenService } from './editor-quick-open-service';
import URI from '@theia/core/lib/common/uri';
import {
    BreadcrumbsRendererFactory,
    BreadcrumbsRenderer,
    BreadcrumbsURI,
    BreadcrumbRenderer,
    DefaultBreadcrumbRenderer
} from '@theia/core/lib/browser/breadcrumbs';

export default new ContainerModule(bind => {
    bindEditorPreferences(bind);

    bind(EditorWidgetFactory).toSelf().inSingletonScope();
    bind(WidgetFactory).toService(EditorWidgetFactory);

    bind(EditorManager).toSelf().inSingletonScope();
    bind(OpenHandler).toService(EditorManager);

    bind(CommandContribution).to(EditorCommandContribution).inSingletonScope();
    bind(MenuContribution).to(EditorMenuContribution).inSingletonScope();

    bind(StrictEditorTextFocusContext).toSelf().inSingletonScope();
    bind(KeybindingContext).toService(StrictEditorTextFocusContext);
    bind(KeybindingContext).to(EditorTextFocusContext).inSingletonScope();
    bind(KeybindingContext).to(DiffEditorTextFocusContext).inSingletonScope();
    bind(KeybindingContribution).to(EditorKeybindingContribution).inSingletonScope();

    bind(EditorContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(EditorContribution);

    bind(EditorNavigationContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(EditorNavigationContribution);
    bind(NavigationLocationService).toSelf().inSingletonScope();
    bind(NavigationLocationUpdater).toSelf().inSingletonScope();
    bind(NavigationLocationSimilarity).toSelf().inSingletonScope();

    bind(VariableContribution).to(EditorVariableContribution).inSingletonScope();

    bind(SemanticHighlightingService).toSelf().inSingletonScope();

    [CommandContribution, KeybindingContribution, QuickOpenContribution].forEach(serviceIdentifier => {
        bind(serviceIdentifier).toService(EditorContribution);
    });
    bind(EditorQuickOpenService).toSelf().inSingletonScope();

    bind(CurrentEditorAccess).toSelf().inSingletonScope();
    bind(ActiveEditorAccess).toSelf().inSingletonScope();
    bind(EditorAccess).to(CurrentEditorAccess).inSingletonScope().whenTargetNamed(EditorAccess.CURRENT);
    bind(EditorAccess).to(ActiveEditorAccess).inSingletonScope().whenTargetNamed(EditorAccess.ACTIVE);

    bind(BreadcrumbsRendererFactory).toFactory(ctx =>
        (uri: URI) => {
            const childContainer = ctx.container.createChild();
            childContainer.bind(BreadcrumbsURI).toConstantValue(uri);
            childContainer.bind(BreadcrumbsRenderer).toSelf();
            childContainer.bind(BreadcrumbRenderer).to(DefaultBreadcrumbRenderer).inSingletonScope();
            return childContainer.get(BreadcrumbsRenderer);
        }
    );
});
