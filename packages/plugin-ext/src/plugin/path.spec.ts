/********************************************************************************
 * Copyright (C) 2021 Red Hat, Inc. and others.
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

import * as chai from 'chai';

import { normalize, join } from './path';

const expect = chai.expect;

describe('Path implementation:', () => {

    it('should normalize \'/foo/bar//baz/asdf/quux/..\'', () => {
        const result = normalize('/foo/bar//baz/asdf/quux/..');
        expect(result).to.be.equal('/foo/bar/baz/asdf');
    });

    it('should normalize \'/foo/bar//baz/asdf/../quux/\'', () => {
        const result = normalize('/foo/bar//baz/asdf/../quux/');
        expect(result).to.be.equal('/foo/bar/baz/quux/');
    });

    it('should join(/foo, bar, baz/asdf, quux, ..)', () => {
        const result = join('/foo', 'bar', 'baz/asdf', 'quux', '..');
        expect(result).to.be.equal('/foo/bar/baz/asdf');
    });

});
