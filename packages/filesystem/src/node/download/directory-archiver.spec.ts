/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
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

import * as fs from '@theia/core/shared/fs-extra';
import * as path from 'path';
import * as temp from 'temp';
import { extract } from 'tar-fs';
import { expect } from 'chai';
import URI from '@theia/core/lib/common/uri';
import { MockDirectoryArchiver } from './test/mock-directory-archiver';
import { FileUri } from '@theia/core/lib/node/file-uri';

/* eslint-disable no-unused-expressions */

const track = temp.track();

describe('directory-archiver', () => {

    after(() => {
        track.cleanupSync();
    });

    it('should archive a directory', async function (): Promise<unknown> {
        this.timeout(20_000);
        const fromPath = track.mkdirSync('from');
        fs.writeFileSync(path.join(fromPath, 'A.txt'), 'A');
        fs.writeFileSync(path.join(fromPath, 'B.txt'), 'B');
        expect(fs.readFileSync(path.join(fromPath, 'A.txt'), { encoding: 'utf8' })).to.be.equal('A');
        expect(fs.readFileSync(path.join(fromPath, 'B.txt'), { encoding: 'utf8' })).to.be.equal('B');
        const toPath = track.mkdirSync('to');
        const archiver = new MockDirectoryArchiver();
        await archiver.archive(fromPath, path.join(toPath, 'output.tar'));
        expect(fs.existsSync(path.join(toPath, 'output.tar'))).to.be.true;
        const assertPath = track.mkdirSync('assertPath');
        return new Promise<void>(resolve => {
            fs.createReadStream(path.join(toPath, 'output.tar')).pipe(extract(assertPath)).on('finish', () => {
                expect(fs.readdirSync(assertPath).sort()).to.be.deep.equal(['A.txt', 'B.txt']);
                expect(fs.readFileSync(path.join(assertPath, 'A.txt'), { encoding: 'utf8' })).to.be.equal(fs.readFileSync(path.join(fromPath, 'A.txt'), { encoding: 'utf8' }));
                expect(fs.readFileSync(path.join(assertPath, 'B.txt'), { encoding: 'utf8' })).to.be.equal(fs.readFileSync(path.join(fromPath, 'B.txt'), { encoding: 'utf8' }));
                resolve();
            });
        });
    });

    describe('findCommonParents', () => {
        ([
            {
                input: ['/A/B/C/D.txt', '/X/Y/Z.txt'],
                expected: new Map([['/A/B/C', ['/A/B/C/D.txt']], ['/X/Y', ['/X/Y/Z.txt']]]),
                folders: ['/A', '/A/B', '/A/B/C', '/X', '/X/Y']
            },
            {
                input: ['/A/B/C/D.txt', '/A/B/C/E.txt'],
                expected: new Map([['/A/B/C', ['/A/B/C/D.txt', '/A/B/C/E.txt']]]),
                folders: ['/A', '/A/B', '/A/B/C']
            },
            {
                input: ['/A', '/A/B/C/D.txt', '/A/B/C/E.txt'],
                expected: new Map([['/A', ['/A', '/A/B/C/D.txt', '/A/B/C/E.txt']]]),
                folders: ['/A', '/A/B', '/A/B/C']
            },
            {
                input: ['/A/B/C/D.txt', '/A/B/C/E.txt', '/A'],
                expected: new Map([['/A', ['/A', '/A/B/C/D.txt', '/A/B/C/E.txt']]]),
                folders: ['/A', '/A/B', '/A/B/C']
            },
            {
                input: ['/A/B/C/D.txt', '/A/B/X/E.txt'],
                expected: new Map([['/A/B', ['/A/B/C/D.txt', '/A/B/X/E.txt']]]),
                folders: ['/A', '/A/B', '/A/B/C', '/A/B/X']
            }
        ] as ({ input: string[], expected: Map<string, string[]>, folders?: string[] })[]).forEach(test => {
            const { input, expected, folders } = test;
            it(`should find the common parent URIs among [${input.join(', ')}] => [${Array.from(expected.keys()).join(', ')}]`, async () => {
                const archiver = new MockDirectoryArchiver(folders ? folders.map(FileUri.create) : []);
                const actual = await archiver.findCommonParents(input.map(FileUri.create));
                expect(asString(actual)).to.be.equal(asString(expected));
            });
        });

        function asString(map: Map<string, string[]>): string {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const obj: any = {};
            for (const key of Array.from(map.keys()).sort()) {
                const values = (map.get(key) || []).sort();
                obj[new URI(key).withScheme('file').toString()] = `[${values.map(v => new URI(v).withScheme('file').toString()).join(', ')}]`;
            }
            return JSON.stringify(obj);
        }

    });

});
