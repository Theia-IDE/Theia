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

import { MenuPath } from '@theia/core/lib/common';

export const OPEN_EDITORS_CONTEXT_MENU: MenuPath = ['open-editors-context-menu'];
export namespace OpenEditorsContextMenu {
    export const NAVIGATION = [...OPEN_EDITORS_CONTEXT_MENU, '1_navigation'];
    export const CLIPBOARD = [...OPEN_EDITORS_CONTEXT_MENU, '2_clipboard'];
    export const SAVE = [...OPEN_EDITORS_CONTEXT_MENU, '3_save'];
    export const COMPARE = [...OPEN_EDITORS_CONTEXT_MENU, '4_compare'];
    export const MODIFICATION = [...OPEN_EDITORS_CONTEXT_MENU, '5_modification'];
}
