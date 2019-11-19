/********************************************************************************
 * Copyright (C) 2019 TypeFox and others.
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

import { Breadcrumb } from '@theia/core/lib/browser/breadcrumbs/breadcrumb';
import { FilepathBreadcrumbType } from './filepath-breadcrumbs-contribution';
import URI from '@theia/core/lib/common/uri';

export class FilepathBreadcrumb implements Breadcrumb {
    constructor(
        readonly uri: URI,
        readonly label: string,
        readonly longLabel: string,
        readonly iconClass: string
    ) { }

    get id(): string {
        return this.type.toString() + '_' + this.uri.toString();
    }

    get type(): symbol {
        return FilepathBreadcrumbType;
    }
}

export namespace FilepathBreadcrumb {
    export function is(breadcrumb: Breadcrumb): breadcrumb is FilepathBreadcrumb {
        return 'uri' in breadcrumb;
    }
}
