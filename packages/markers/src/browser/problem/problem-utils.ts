/********************************************************************************
 * Copyright (C) 2020 Ericsson and others.
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

import { Marker } from '../../common/marker';
import { Diagnostic, DiagnosticSeverity } from '@theia/core/shared/vscode-languageserver-types';

export namespace ProblemUtils {

    /**
     * Comparator for severity.
     * - The highest severity (`error`) come first followed by others.
     * - `undefined` severities are treated as the last ones.
     * @param a the first marker for comparison.
     * @param b the second marker for comparison.
     */
    export const severityCompareMarker = (a: Marker<Diagnostic>, b: Marker<Diagnostic>): number =>
        (a.data.severity || Number.MAX_SAFE_INTEGER) - (b.data.severity || Number.MAX_SAFE_INTEGER);

    /**
     * Comparator for severity.
     * - The highest severity (`error`) come first followed by others.
     * - `undefined` severities are treated as the last ones.
     * @param a the first severity for comparison.
     * @param b the second severity for comparison.
     */
    export const severityCompare = (a: DiagnosticSeverity | undefined, b: DiagnosticSeverity | undefined): number =>
        (a || Number.MAX_SAFE_INTEGER) - (b || Number.MAX_SAFE_INTEGER);

    /**
     * Comparator for line numbers.
     * - The lowest line number comes first.
     * @param a the first marker for comparison.
     * @param b the second marker for comparison.
     */
    export const lineNumberCompare = (a: Marker<Diagnostic>, b: Marker<Diagnostic>): number => a.data.range.start.line - b.data.range.start.line;

    /**
     * Comparator for column numbers.
     * - The lowest column number comes first.
     * @param a the first marker for comparison.
     * @param b the second marker for comparison.
     */
    export const columnNumberCompare = (a: Marker<Diagnostic>, b: Marker<Diagnostic>): number => a.data.range.start.character - b.data.range.start.character;

    /**
     * Comparator for marker owner (source).
     * - The order is alphabetical.
     * @param a the first marker for comparison.
     * @param b the second marker for comparison.
     */
    export const ownerCompare = (a: Marker<Diagnostic>, b: Marker<Diagnostic>): number => a.owner.localeCompare(b.owner);

}
