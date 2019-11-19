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

/** A single breadcrumb in the breadcrumbs bar. */
export interface Breadcrumb {

    /** An ID of this breadcrumb that should be unique in the breadcrumbs bar. */
    readonly id: string

    /** The breadcrumb type. Should be the same as the contribution type `BreadcrumbsContribution#type`. */
    readonly type: symbol

    /** The text that will be rendered as label. */
    readonly label: string

    /** A longer text that will be used as tooltip text. */
    readonly longLabel: string

    /** A CSS class for the icon. */
    readonly iconClass?: string
}
