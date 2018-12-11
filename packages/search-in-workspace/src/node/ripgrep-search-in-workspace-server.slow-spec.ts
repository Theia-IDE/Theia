/********************************************************************************
 * Copyright (C) 2017-2018 Ericsson and others.
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

import { Container } from 'inversify';
import { ILogger, isWindows } from '@theia/core';
import { FileUri } from '@theia/core/lib/node/file-uri';
import { MockLogger } from '@theia/core/lib/common/test/mock-logger';
import { RawProcessFactory, RawProcessOptions, RawProcess, ProcessManager } from '@theia/process/lib/node';
import { RipgrepSearchInWorkspaceServer } from './ripgrep-search-in-workspace-server';
import { SearchInWorkspaceClient, SearchInWorkspaceResult } from '../common/search-in-workspace-interface';
import * as path from 'path';
import * as temp from 'temp';
import * as fs from 'fs';
import { expect } from 'chai';

// Allow creating temporary files, but remove them when we are done.
const track = temp.track();

// The root dirs we'll use to test searching.
let rootDirA: string;
let rootDirB: string;
let rootDirAUri: string;
let rootDirBUri: string;

// Remember the content of the test files we create, to validate that the
// reported line text is right.
const fileLines: Map<string, string[]> = new Map();

// The class under test.
let ripgrepServer: RipgrepSearchInWorkspaceServer;

// Mock client that accumulates the returned results in a list.
class ResultAccumulator implements SearchInWorkspaceClient {
    results: SearchInWorkspaceResult[] = [];
    onDoneCallback: () => void;

    constructor(onDoneCallback: () => void) {
        this.onDoneCallback = onDoneCallback;
    }

    onResult(searchId: number, result: SearchInWorkspaceResult): void {
        this.results.push(result);
    }

    onDone(searchId: number): void {
        // Sort the results, so that the order is predictable.
        this.results.sort(SearchInWorkspaceResult.compare);
        this.onDoneCallback();
    }
}

// Create a test file relative to rootDir.
function createTestFile(filename: string, text: string) {
    const dir = getRootPathFromName(filename);
    fs.writeFileSync(path.join(dir, filename), text);
    fileLines.set(filename, text.split('\n'));
}

// Returns the path of the root folder by the file name
const getRootPathFromName = (name: string) => {
    const names: { [file: string]: string } = {
        carrots: rootDirA,
        potatoes: rootDirA,
        regexes: rootDirA,
        small: `${rootDirA}/small`,
        'file:with:some:colons': rootDirA,
        'file with spaces': rootDirA,
        'utf8-file': rootDirA,
        'special shell characters': rootDirA,
        'glob.txt': rootDirA,
        glob: rootDirA,
        'lots-of-matches': rootDirA,
        orange: rootDirB
    };
    return names[name];
};

before(() => {
    rootDirA = track.mkdirSync();
    rootDirB = track.mkdirSync();
    rootDirAUri = FileUri.create(rootDirA).toString();
    rootDirBUri = FileUri.create(rootDirB).toString();

    createTestFile('carrots', `\
This is a carrot.
Most carrots are orange, but some carrots are not.
Once capitalized, the word carrot looks like this: CARROT.
Carrot is a funny word.
`);
    createTestFile('potatoes', `\
Potatoes, unlike carrots, are generally not orange.  But sweet potatoes are,
it's very confusing.
`);

    createTestFile('regexes', `\
aaa hello. x h3lo y hell0h3lllo
hello1
`);

    fs.mkdirSync(rootDirA + '/small');
    createTestFile('small', 'A small file.\n');

    if (!isWindows) {
        createTestFile('file:with:some:colons', `\
Are you looking for this: --foobar?
`);
    }

    createTestFile('file with spaces', `\
Are you looking for this: --foobar?
`);

    createTestFile('utf8-file', `\
Var är jag?  Varför är jag här?
`);

    createTestFile('special shell characters', `\
If one uses \`salut";\' echo foo && echo bar; "\` as a search term it should not be a problem to find here.
`);

    createTestFile('glob.txt', `\
test -glob patterns
`);

    createTestFile('glob', `\
test --glob patterns
`);

    let lotsOfMatchesText = '';
    for (let i = 0; i < 100000; i++) {
        lotsOfMatchesText += 'lots-of-matches\n';
    }
    createTestFile('lots-of-matches', lotsOfMatchesText);

    createTestFile('orange', `\
the oranges' orange looks slightly different from carrots' orange.
`);
});

beforeEach(() => {
    const container = new Container();
    container.bind(ILogger).to(MockLogger);
    container.bind(RipgrepSearchInWorkspaceServer).toSelf();
    container.bind(ProcessManager).toSelf().inSingletonScope();
    container.bind(RawProcess).toSelf().inTransientScope();
    container.bind(RawProcessFactory).toFactory(ctx =>
        (options: RawProcessOptions) => {
            const child = new Container({ defaultScope: 'Singleton' });
            child.parent = ctx.container;

            child.bind(RawProcessOptions).toConstantValue(options);
            return child.get(RawProcess);
        }
    );

    ripgrepServer = container.get(RipgrepSearchInWorkspaceServer);
});

after(() => {
    try {
        track.cleanupSync();
    } catch (ex) {
        console.log("Couldn't cleanup search-in-workspace temp directory.", ex);
    }
});

// Compare expected and actual search results.
//
// For convenience, the expected entries do not have their lineText field set
// by individual tests.  Using on the file and line fields, this function
// retrieves the expected line text based on what we have written to the test
// files.
//
// The expected entries should also have the file field set relatively to
// rootDir.  This function will update the field to contain the absolute path.

function compareSearchResults(expected: SearchInWorkspaceResult[], actual: SearchInWorkspaceResult[]) {
    expect(actual.length).eq(expected.length);

    if (actual.length !== expected.length) {
        return;
    }

    for (let i = 0; i < actual.length; i++) {
        const e = expected[i];
        const lines = fileLines.get(e.fileUri);
        if (lines) {
            const line = lines[e.line - 1];
            e.lineText = line;
            e.fileUri = FileUri.create(path.join(getRootPathFromName(e.fileUri), e.fileUri)).toString();

            const a = actual.find(l => l.fileUri === e.fileUri && l.line === e.line && l.character === e.character);
            expect(a).deep.eq(e);
        } else {
            // We don't know this file...
            expect.fail();
        }
    }
}

describe('ripgrep-search-in-workspace-server', function () {
    this.timeout(10000);

    // Try some simple patterns with different case.
    it('should return 7 results when searching for "carrot"', done => {
        const pattern = 'carrot';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'carrots', line: 1, character: 11, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 2, character: 6, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 2, character: 35, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 3, character: 28, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 3, character: 52, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 4, character: 1, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'potatoes', line: 1, character: 18, length: pattern.length, lineText: '' }
            ];
            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri]);
    });

    it('should return 5 results when searching for "carrot" case sensitive', done => {
        const pattern = 'carrot';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'carrots', line: 1, character: 11, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 2, character: 6, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 2, character: 35, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 3, character: 28, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'potatoes', line: 1, character: 18, length: pattern.length, lineText: '' }
            ];

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri], {
            matchCase: true
        });
    });

    it('should return 4 results when searching for "carrot" matching whole words, case insensitive', done => {
        const pattern = 'carrot';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'carrots', line: 1, character: 11, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 3, character: 28, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 3, character: 52, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 4, character: 1, length: pattern.length, lineText: '' }
            ];

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri], {
            matchWholeWord: true
        });
    });

    it('should return 4 results when searching for "carrot" matching whole words, case sensitive', done => {
        const pattern = 'carrot';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'carrots', line: 1, character: 11, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 3, character: 28, length: pattern.length, lineText: '' }
            ];

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri], {
            matchWholeWord: true,
            matchCase: true
        });
    });

    it('should return 1 result when searching for "Carrot"', done => {
        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'carrots', line: 4, character: 1, length: 6, lineText: '' },
            ];

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search('Carrot', [rootDirAUri], { matchCase: true });
    });

    it('should return 0 result when searching for "CarroT"', done => {
        const pattern = 'CarroT';

        const client = new ResultAccumulator(() => {
            compareSearchResults([], client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri], { matchCase: true });
    });

    // Try something that we know isn't there.
    it('should find 0 result when searching for "PINEAPPLE"', done => {
        const pattern = 'PINEAPPLE';

        const client = new ResultAccumulator(() => {
            compareSearchResults([], client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri]);
    });

    // Try a pattern with a space.
    it('should find 1 result when searching for "carrots are orange"', done => {
        const pattern = 'carrots are orange';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'carrots', line: 2, character: 6, length: pattern.length, lineText: '' },
            ];

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri]);
    });

    // Try with an output size that exceeds the default node buffer size
    // (200 * 1024) when spawning a new process.
    it('should work with a lot of results', done => {
        // This can take a bit of time.
        this.timeout(150000);
        const pattern = 'lots-of-matches';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [];

            for (let i = 1; i <= 100; i++) {
                expected.push({
                    root: rootDirAUri,
                    fileUri: 'lots-of-matches',
                    line: i,
                    character: 1,
                    length: pattern.length,
                    lineText: '',
                });
            }

            compareSearchResults(expected, client.results);
            done();
        });

        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri]);
    });

    // Try limiting the number of returned results.
    it('should limit the number of returned results', done => {
        const pattern = 'lots-of-matches';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [];

            for (let i = 1; i <= 100; i++) {
                expected.push({
                    root: rootDirAUri,
                    fileUri: 'lots-of-matches',
                    line: i,
                    character: 1,
                    length: pattern.length,
                    lineText: '',
                });
            }

            compareSearchResults(expected, client.results);
            done();
        });

        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri], {
            maxResults: 1000,
        });
    });

    // Try with regexes.
    it('should search for regexes', done => {
        const pattern = 'h[e3]l+[o0]';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'regexes', line: 1, character: 5, length: 5, lineText: '' },
                { root: rootDirAUri, fileUri: 'regexes', line: 1, character: 14, length: 4, lineText: '' },
                { root: rootDirAUri, fileUri: 'regexes', line: 1, character: 21, length: 5, lineText: '' },
                { root: rootDirAUri, fileUri: 'regexes', line: 1, character: 26, length: 6, lineText: '' },
                { root: rootDirAUri, fileUri: 'regexes', line: 2, character: 1, length: 5, lineText: '' },
            ];

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri], {
            useRegExp: true
        });
    });

    // Try without regex
    it('should search for fixed string', done => {
        const pattern = 'hello.';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'regexes', line: 1, character: 5, length: 6, lineText: '' }
            ];

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri], {
            useRegExp: false
        });
    });

    // Try with a pattern starting with -, and in filenames containing colons and spaces.
    it('should search a pattern starting with -', done => {
        const pattern = '-fo+bar';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'file with spaces', line: 1, character: 28, length: 7, lineText: '' },
            ];

            if (!isWindows) {
                expected.push(
                    { root: rootDirAUri, fileUri: 'file:with:some:colons', line: 1, character: 28, length: 7, lineText: '' }
                );
            }

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri], { useRegExp: true });
    });

    // Try with a pattern starting with --, and in filenames containing colons and spaces.
    it('should search a pattern starting with --', done => {
        const pattern = '--fo+bar';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'file with spaces', line: 1, character: 27, length: 8, lineText: '' },
            ];

            if (!isWindows) {
                expected.push(
                    { root: rootDirAUri, fileUri: 'file:with:some:colons', line: 1, character: 27, length: 8, lineText: '' }
                );
            }

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri], { useRegExp: true });
    });

    it('should search a pattern starting with a dash w/o regex', done => {
        const pattern = '-foobar';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'file with spaces', line: 1, character: 28, length: 7, lineText: '' },
            ];

            if (!isWindows) {
                expected.push(
                    { root: rootDirAUri, fileUri: 'file:with:some:colons', line: 1, character: 28, length: 7, lineText: '' }
                );
            }

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri]);
    });

    it('should search a pattern starting with two dashes w/o regex', done => {
        const pattern = '--foobar';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'file with spaces', line: 1, character: 27, length: 8, lineText: '' },
            ];

            if (!isWindows) {
                expected.push(
                    { root: rootDirAUri, fileUri: 'file:with:some:colons', line: 1, character: 27, length: 8, lineText: '' }
                );
            }

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri]);
    });

    it('should search a whole pattern starting with - w/o regex', done => {
        const pattern = '-glob';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'glob', line: 1, character: 7, length: 5, lineText: '' },
                { root: rootDirAUri, fileUri: 'glob.txt', line: 1, character: 6, length: 5, lineText: '' }
            ];

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri], { matchWholeWord: true });
    });

    it('should search a whole pattern starting with -- w/o regex', done => {
        const pattern = '--glob';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'glob', line: 1, character: 6, length: 6, lineText: '' }
            ];

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri], { matchWholeWord: true });
    });

    it('should search a pattern in .txt file', done => {
        const pattern = '-glob';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'glob.txt', line: 1, character: 6, length: 5, lineText: '' }
            ];

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri], { include: ['*.txt'] });
    });

    it('should search a whole pattern in .txt file', done => {
        const pattern = '-glob';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'glob.txt', line: 1, character: 6, length: 5, lineText: '' }
            ];

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri], { include: ['*.txt'], matchWholeWord: true });
    });

    // Try searching in an UTF-8 file.
    it('should search in a UTF-8 file', done => {
        const pattern = ' jag';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'utf8-file', line: 1, character: 7, length: 4, lineText: '' },
                { root: rootDirAUri, fileUri: 'utf8-file', line: 1, character: 23, length: 4, lineText: '' },
            ];

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri]);
    });

    // Try searching a pattern that contains unicode characters.
    it('should search a UTF-8 pattern', done => {
        const pattern = ' h?är';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'utf8-file', line: 1, character: 4, length: 3, lineText: '' },
                { root: rootDirAUri, fileUri: 'utf8-file', line: 1, character: 20, length: 3, lineText: '' },
                { root: rootDirAUri, fileUri: 'utf8-file', line: 1, character: 27, length: 4, lineText: '' },
            ];

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri], { useRegExp: true });
    });

    // A regex that may match an empty string should not return zero-length
    // results.  Run the test in a directory without big files, because it
    // makes rg print all searched lines, which can take a lot of time.
    it('should not return zero-length matches', done => {
        const pattern = '(hello)?';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
            ];

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri + '/small']);
    });

    it('should search a pattern with special characters ', done => {
        const pattern = 'salut";\' echo foo && echo bar; "';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirAUri, fileUri: 'special shell characters', line: 1, character: 14, length: 32, lineText: '' },
            ];

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri], { useRegExp: true });
    });

    it('should find patterns across all directories', done => {
        const pattern = 'carrot';

        const client = new ResultAccumulator(() => {
            const expected: SearchInWorkspaceResult[] = [
                { root: rootDirBUri, fileUri: 'orange', line: 1, character: 51, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 1, character: 11, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 2, character: 6, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 2, character: 35, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 3, character: 28, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 3, character: 52, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'carrots', line: 4, character: 1, length: pattern.length, lineText: '' },
                { root: rootDirAUri, fileUri: 'potatoes', line: 1, character: 18, length: pattern.length, lineText: '' }
            ];

            compareSearchResults(expected, client.results);
            done();
        });
        ripgrepServer.setClient(client);
        ripgrepServer.search(pattern, [rootDirAUri, rootDirBUri]);
    });
});
