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

import URI from '../../common/uri';
import { Breadcrumb } from './breadcrumb';
import { Disposable } from '../../common';

export const BreadcrumbsContribution = Symbol('BreadcrumbsContribution');
export interface BreadcrumbsContribution {

    /**
     * The breadcrumb type. Breadcrumbs returned by `#computeBreadcrumbs(uri)` should have this as `Breadcrumb#type`.
     */
    readonly type: symbol;

    /**
     * The priority of this breadcrumbs contribution. Contributions with lower priority are rendered first.
     */
    readonly priority: number;

    /**
     * Computes breadcrumbs for a given URI.
     */
    computeBreadcrumbs(uri: URI): Promise<Breadcrumb[]>;

    /**
     * Attaches the breadcrumb popup content for the given breadcrumb as child to the given parent.
     * If it returns a Disposable, it is called when the popup closes.
     */
    attachPopupContent(breadcrumb: Breadcrumb, parent: HTMLElement): Promise<Disposable | undefined>;
}
