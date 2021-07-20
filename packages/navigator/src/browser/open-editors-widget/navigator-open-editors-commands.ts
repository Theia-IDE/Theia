/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
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

import { Command } from '@theia/core/lib/common';

export namespace OpenEditorsCommands {
    export const CLOSE_ALL_TABS_FROM_TOOLBAR: Command = {
        id: 'navigator.close.all.editors.toolbar',
        category: 'File',
        label: 'Close All Editors',
        iconClass: 'codicon codicon-close-all'
    };

    export const SAVE_ALL_TABS_FROM_TOOLBAR: Command = {
        id: 'navigator.save.all.editors.toolbar',
        category: 'File',
        label: 'Save All Editors',
        iconClass: 'codicon codicon-save-all'
    };

    export const CLOSE_ALL_EDITORS_IN_GROUP_FROM_ICON: Command = {
        id: 'navigator.close.all.in.area.icon',
        category: 'View',
        label: 'Close Group',
        iconClass: 'codicon codicon-close-all'
    };

    export const SAVE_ALL_IN_GROUP_FROM_ICON: Command = {
        id: 'navigator.save.all.in.area.icon',
        category: 'File',
        label: 'Save All in Group',
        iconClass: 'codicon codicon-save-all'
    };
}
