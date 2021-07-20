/********************************************************************************
 * Copyright (C) 2017 Ericsson and others.
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
import * as process from 'process';
import * as stream from 'stream';
import { createProcessTestContainer } from './test/process-test-container';
import { RawProcessFactory } from './raw-process';
import * as temp from 'temp';
import * as fs from 'fs';
import * as path from 'path';
import { isWindows } from '@theia/core';
import { IProcessStartEvent, ProcessErrorEvent } from './process';

/* Allow to create temporary files, but delete them when we're done.  */
const track = temp.track();

/**
 * Globals
 */

const expect = chai.expect;
const FORK_TEST_FILE = path.join(__dirname, '../../src/node/test/process-fork-test.js');

describe('RawProcess', function (): void {

    this.timeout(20_000);

    let rawProcessFactory: RawProcessFactory;

    beforeEach(() => {
        rawProcessFactory = createProcessTestContainer().get<RawProcessFactory>(RawProcessFactory);
    });

    after(() => {
        track.cleanupSync();
    });

    it('test error on non-existent path', async function (): Promise<void> {
        const error = await new Promise<ProcessErrorEvent>((resolve, reject) => {
            const proc = rawProcessFactory({ command: '/non-existent' });
            proc.onStart(reject);
            proc.onError(resolve);
            proc.onExit(reject);
        });

        expect(error.code).eq('ENOENT');
    });

    it('test error on non-executable path', async function (): Promise<void> {
        // Create a non-executable file.
        const f = track.openSync('non-executable');
        fs.writeSync(f.fd, 'echo bob');

        // Make really sure it's non-executable.
        let mode = fs.fstatSync(f.fd).mode;
        mode &= ~fs.constants.S_IXUSR;
        mode &= ~fs.constants.S_IXGRP;
        mode &= ~fs.constants.S_IXOTH;
        fs.fchmodSync(f.fd, mode);

        fs.closeSync(f.fd);

        const error = await new Promise<ProcessErrorEvent>((resolve, reject) => {
            const proc = rawProcessFactory({ command: f.path });
            proc.onStart(reject);
            proc.onError(resolve);
            proc.onExit(reject);
        });

        // On Windows, we get 'UNKNOWN'.
        const expectedCode = isWindows ? 'UNKNOWN' : 'EACCES';

        expect(error.code).eq(expectedCode);
    });

    it('test start event', function (): Promise<IProcessStartEvent> {
        return new Promise<IProcessStartEvent>(async (resolve, reject) => {
            const args = ['-e', 'process.exit(3)'];
            const rawProcess = rawProcessFactory({ command: process.execPath, 'args': args });
            rawProcess.onStart(resolve);
            rawProcess.onError(reject);
            rawProcess.onExit(reject);
        });
    });

    it('test exit', async function (): Promise<void> {
        const args = ['--version'];
        const rawProcess = rawProcessFactory({ command: process.execPath, 'args': args });
        const p = new Promise<number>((resolve, reject) => {
            rawProcess.onError(error => {
                reject();
            });
            rawProcess.onExit(event => {
                if (event.code === undefined) {
                    reject(new Error('exit code is undefined'));
                } else {
                    resolve(event.code);
                }
            });
        });

        const exitCode = await p;
        expect(exitCode).equal(0);
    });

    it('test pipe stdout stream', async function (): Promise<void> {
        const output = await new Promise<string>(async (resolve, reject) => {
            const args = ['-e', 'console.log("text to stdout")'];
            const outStream = new stream.PassThrough();
            const rawProcess = rawProcessFactory({ command: process.execPath, 'args': args });
            rawProcess.onError(reject);

            rawProcess.outputStream.pipe(outStream);

            let buf = '';
            outStream.on('data', data => {
                buf += data.toString();
            });
            outStream.on('end', () => {
                resolve(buf.trim());
            });
        });

        expect(output).to.be.equal('text to stdout');
    });

    it('test pipe stderr stream', async function (): Promise<void> {
        const output = await new Promise<string>(async (resolve, reject) => {
            const args = ['-e', 'console.error("text to stderr")'];
            const outStream = new stream.PassThrough();
            const rawProcess = rawProcessFactory({ command: process.execPath, 'args': args });
            rawProcess.onError(reject);

            rawProcess.errorStream.pipe(outStream);

            let buf = '';
            outStream.on('data', data => {
                buf += data.toString();
            });
            outStream.on('end', () => {
                resolve(buf.trim());
            });
        });

        expect(output).to.be.equal('text to stderr');
    });

    it('test forked pipe stdout stream', async function (): Promise<void> {
        const args = ['version'];
        const rawProcess = rawProcessFactory({ modulePath: FORK_TEST_FILE, args, options: { stdio: 'pipe' } });

        const outStream = new stream.PassThrough();

        const p = new Promise<string>((resolve, reject) => {
            let version = '';
            outStream.on('data', data => {
                version += data.toString();
            });
            outStream.on('end', () => {
                resolve(version.trim());
            });
        });

        rawProcess.outputStream.pipe(outStream);

        expect(await p).to.be.equal('1.0.0');
    });

    it('test forked pipe stderr stream', async function (): Promise<void> {
        const rawProcess = rawProcessFactory({ modulePath: FORK_TEST_FILE, args: [], options: { stdio: 'pipe' } });

        const outStream = new stream.PassThrough();

        const p = new Promise<string>((resolve, reject) => {
            let version = '';
            outStream.on('data', data => {
                version += data.toString();
            });
            outStream.on('end', () => {
                resolve(version.trim());
            });
        });

        rawProcess.errorStream.pipe(outStream);

        expect(await p).to.have.string('Error');
    });
});
