/********************************************************************************
 * Copyright (C) 2019 Arm and others.
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

import { HgCommandServer, CommandResults } from './hg-command-server';
import { HgInit } from '../init/hg-init';
import { FileUri } from '@theia/core/lib/node';
import { ChildProcess } from 'child_process';
import { Disposable } from '@theia/core';

/**
 * Clone a repository.
 * @param fromUrl Mercurial URL to clone from (can be an HTTPS URL, a file:// URL, a file path, etc.)
 * @param toPath File system path to clone to
 * @param opts Optional extra command line options
 * @param progressCallback Optionally receive progress updates
 */
export const clone = async (
    hgInit: HgInit,
    fromUrl: string,
    toPath: string,
    opts: string[] = [],
    progressCallback?: (progress: number) => void
): Promise<HGRepo> => {
    if (fromUrl.startsWith('file://')) {
        // Theia's file URI is not compatible with Mercurial's: hg does not like the encoded ':' ('%3A') before the Windows drive letter
        fromUrl = FileUri.fsPath(fromUrl);
    }

    const server = new HgCommandServer();
    const workingDirectoryPath = process.cwd();
    const args = ['clone', fromUrl, toPath, ...opts];
    const outputLineCallback = (line: string) => {
        if (progressCallback) {
            processCloneOutput(progressCallback, line);
        }
    };
    await server.start(path => hgInit.startCommandServer(path), workingDirectoryPath);
    const result = await server.runCommand(args, outputLineCallback);
    server.stop();

    if (result.resultCode === 0) {
        return new HGRepo(path => hgInit.startCommandServer(path), toPath);
    } else {
        throw new Error(`Result code from Hg command line: ${result.resultCode}`);
    }
};

const processCloneOutput = (progressCallback: (progress: number) => void, line: string): void => {
    const trimmed = line.trim();

    if (trimmed === 'requesting all changes') {
        progressCallback(0.1);
    } else if (trimmed === 'adding changesets') {
        progressCallback(0.5);
    } else if (trimmed === 'adding manifests') {
        progressCallback(0.9);
    }
};

const commandServers: Map<string, HGRepo> = new Map();

/**
 * This implementation leaves all command servers running for ten seconds.  The reason for a short period
 * is that users cannot delete Mercurial repositories if a command server has the repository locked.
 *
 * @param hgInit
 * @param localUri
 */
export const getHgRepo = async (hgInit: HgInit, localUri: string): Promise<HGRepo> => {
    const repo = commandServers.get(localUri);
    if (repo) {
        delayedClose(localUri, repo);
        return repo;
    }

    const newRepo = new HGRepo(path => hgInit.startCommandServer(path), FileUri.fsPath(localUri));
    await newRepo.start();
    commandServers.set(localUri, newRepo);
    delayedClose(localUri, newRepo);
    return newRepo;
};

/**
 * Shuts down the command server 10 seconds after the last operation started.
 */
const delayedClose = async (localUri: string, repo: HGRepo) => {
    repo.latestCommandCounter++;
    const thisCommandCounter = repo.latestCommandCounter;
    setTimeout(() => {
        if (thisCommandCounter === repo.latestCommandCounter) {
            // Note that a new command may arrive before the command server shutdown
            // has completed.  We can only assume that Mercurial handles this correctly.
            commandServers.delete(localUri);
            repo.dispose();
        }
    }, 10000);
};

export class HGRepo implements Disposable {

    protected server = new HgCommandServer();

    protected queue: Promise<void> = Promise.resolve();

    public latestCommandCounter: number = 0;

    /*
     * Create a new HGRepo with a path defined by the passed in path.
     */
    constructor(private readonly startCommandServer: (path: string) => Promise<ChildProcess>, private readonly path: string) { }

    public async start(): Promise<void> {
        await this.server.start(this.startCommandServer, this.path);
    }

    public dispose(): void {
        this.server.stop();
    }

    /*
     * Execute server command, throwing any errors
     */
    public async runCommand(args: string | string[], responseProvider?: (promptKey: string) => Promise<string>): Promise<string[]> {
        const argsArray: string[] = typeof args === 'string' ? [args] : args;
        const q: Promise<CommandResults> = this.queue.then(() => this.server.runCommand(argsArray, undefined, responseProvider));
        this.queue = q.then(() => { });
        const commandResults = await q;
        if (commandResults.resultCode !== 0) {
            throw new Error(`"hg ${argsArray.join(' ')}" failed: ${commandResults.outputChunks.join('\n')} ${commandResults.errorChunks.join()}`);
        }
        return commandResults.outputChunks;
    }

    /*
     * Execute server command, returning errors in result
     */
    public async runCommandReturningErrors(args: string | string[], responseProvider?: (promptKey: string) => Promise<string>): Promise<CommandResults> {
        const argsArray: string[] = typeof args === 'string' ? [args] : args;
        const q: Promise<CommandResults> = this.queue.then(() => this.server.runCommand(argsArray, undefined, responseProvider));
        this.queue = q.then(() => { });
        const commandResults = await q;
        return commandResults;
    }
}
