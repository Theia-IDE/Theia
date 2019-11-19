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

import * as React from 'react';
import { injectable } from 'inversify';
import { Breadcrumb } from './breadcrumb';
import { Breadcrumbs } from './breadcrumbs';

export const BreadcrumbRenderer = Symbol('BreadcrumbRenderer');
export interface BreadcrumbRenderer {
    /**
     * Renders the given breadcrumb. If `onClick` is given, it is called on breadcrumb click.
     */
    render(breadcrumb: Breadcrumb, onClick?: (breadcrumb: Breadcrumb, event: React.MouseEvent) => void): React.ReactNode;
}

@injectable()
export class DefaultBreadcrumbRenderer implements BreadcrumbRenderer {
    render(breadcrumb: Breadcrumb, onClick?: (breadcrumb: Breadcrumb, event: React.MouseEvent) => void): React.ReactNode {
        return <li key={breadcrumb.id} title={breadcrumb.longLabel}
            className={Breadcrumbs.Styles.BREADCRUMB_ITEM + (!onClick ? '' : ' ' + Breadcrumbs.Styles.BREADCRUMB_ITEM_HAS_POPUP)}
            onClick={event => onClick && onClick(breadcrumb, event)}
            tabIndex={0}
            data-breadcrumb-id={breadcrumb.id}
        >
            {breadcrumb.iconClass && <span className={breadcrumb.iconClass}></span>} <span> {breadcrumb.label}</span>
        </li >;
    }
}
