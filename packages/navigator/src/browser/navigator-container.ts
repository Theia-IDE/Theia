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

import { Container, interfaces } from '@theia/core/shared/inversify';
import { Tree, TreeModel, TreeProps, defaultTreeProps, TreeDecoratorService } from '@theia/core/lib/browser';
import { createFileTreeContainer, FileTree, FileTreeModel, FileTreeWidget } from '@theia/filesystem/lib/browser';
import { FileNavigatorTree } from './navigator-tree';
import { FileNavigatorModel } from './navigator-model';
import { FileNavigatorWidget } from './navigator-widget';
import { NAVIGATOR_CONTEXT_MENU } from './navigator-contribution';
import { NavigatorDecoratorService } from './navigator-decorator-service';

export const FILE_NAVIGATOR_PROPS = <TreeProps>{
    ...defaultTreeProps,
    contextMenuPath: NAVIGATOR_CONTEXT_MENU,
    multiSelect: true,
    search: true,
    globalSelection: true
};

export function createFileNavigatorContainer(parent: interfaces.Container): Container {
    const child = createFileTreeContainer(parent);

    child.unbind(FileTree);
    child.bind(FileNavigatorTree).toSelf();
    child.rebind(Tree).toService(FileNavigatorTree);

    child.unbind(FileTreeModel);
    child.bind(FileNavigatorModel).toSelf();
    child.rebind(TreeModel).toService(FileNavigatorModel);

    child.unbind(FileTreeWidget);
    child.bind(FileNavigatorWidget).toSelf();

    child.rebind(TreeProps).toConstantValue(FILE_NAVIGATOR_PROPS);

    child.bind(NavigatorDecoratorService).toSelf().inSingletonScope();
    child.rebind(TreeDecoratorService).toService(NavigatorDecoratorService);

    return child;
}

export function createFileNavigatorWidget(parent: interfaces.Container): FileNavigatorWidget {
    return createFileNavigatorContainer(parent).get(FileNavigatorWidget);
}
