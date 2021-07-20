/********************************************************************************
 * Copyright (C) 2018-2021 Google and others.
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
import { FrontendApplicationContribution, KeybindingContribution, WidgetFactory } from '@theia/core/lib/browser';
import { ContainerModule } from '@theia/core/shared/inversify';
import { bindEditorPreviewPreferences } from './editor-preview-preferences';
import { EditorPreviewManager } from './editor-preview-manager';
import { EditorManager } from '@theia/editor/lib/browser';
import { EditorPreviewWidgetFactory } from './editor-preview-widget-factory';
import { EditorPreviewContribution } from './editor-preview-contribution';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { OpenEditorsTreeDecorator } from '@theia/navigator/lib/browser/open-editors-widget/navigator-open-editors-decorator-service';
import { EditorPreviewTreeDecorator } from './editor-preview-tree-decorator';

export default new ContainerModule((bind, unbind, isBound, rebind) => {

    bind(EditorPreviewWidgetFactory).toSelf().inSingletonScope();
    bind(WidgetFactory).toService(EditorPreviewWidgetFactory);

    bind(EditorPreviewManager).toSelf().inSingletonScope();
    rebind(EditorManager).toService(EditorPreviewManager);

    bind(EditorPreviewContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(EditorPreviewContribution);
    bind(KeybindingContribution).toService(EditorPreviewContribution);
    bind(MenuContribution).toService(EditorPreviewContribution);

    bind(EditorPreviewTreeDecorator).toSelf().inSingletonScope();
    bind(OpenEditorsTreeDecorator).toService(EditorPreviewTreeDecorator);
    bind(FrontendApplicationContribution).toService(EditorPreviewTreeDecorator);
    bindEditorPreviewPreferences(bind);
});
