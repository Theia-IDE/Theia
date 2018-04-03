/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import 'reflect-metadata';

import * as process from 'process';
import * as stream from 'stream';
import { testContainer } from './inversify.spec-config';
import { TerminalProcessFactory } from './terminal-process';
import { isWindows } from "@theia/core/lib/common";

describe('TerminalProcess', () => {

    const terminalProcessFactory = testContainer.get<TerminalProcessFactory>(TerminalProcessFactory);

    test('test error on non existent path', async () => {

        /* Strangely, Linux returns exited with code 1 when using a non existing path but Windows throws an error.
        This would need to be investigated more.  */
        if (isWindows) {
            return expect(() => terminalProcessFactory({ command: '/non-existent' })).toThrow();
        } else {
            const terminalProcess = terminalProcessFactory({ command: '/non-existant' });
            const p = new Promise(resolve => {
                terminalProcess.onExit(event => {
                    if (event.code > 0) { resolve(); }
                });
            });

            await expect(p).resolves.toBeUndefined();
        }
    });

    test('test exit', async () => {
        const args = ['--version'];
        const terminalProcess = terminalProcessFactory({ command: process.execPath, 'args': args });
        const p = new Promise((resolve, reject) => {
            terminalProcess.onError(error => {
                reject();
            });
            terminalProcess.onExit(event => {
                if (event.code === 0) {
                    resolve();
                } else {
                    reject();
                }
            });
        });

        await expect(p).resolves.toBeUndefined();
    });

    test('test pipe stream', async () => {
        const args = ['--version'];
        const terminalProcess = terminalProcessFactory({ command: process.execPath, 'args': args });

        const outStream = new stream.PassThrough();

        const p = new Promise<string>((resolve, reject) => {
            let version = '';
            outStream.on('data', data => {
                version += data.toString();
            });
            /* node-pty is not sending 'end' on the stream as it quits
            only 'exit' is sent on the terminal process.  */
            terminalProcess.onExit(() => {
                resolve(version.trim());
            });
        });

        terminalProcess.createOutputStream().pipe(outStream);

        /* Avoid using equal since terminal characters can be inserted at the end.  */
        await expect(p).resolves.toContain(process.version);
    });
});
