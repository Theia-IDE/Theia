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

import * as Path from 'path';
import { injectable, inject, postConstruct } from 'inversify';
import { git } from 'dugite-extra/lib/core/git';
import { push } from 'dugite-extra/lib/command/push';
import { pull } from 'dugite-extra/lib/command/pull';
import { clone } from 'dugite-extra/lib/command/clone';
import { fetch } from 'dugite-extra/lib/command/fetch';
import { stash } from 'dugite-extra/lib/command/stash';
import { merge } from 'dugite-extra/lib/command/merge';
import { FileUri } from '@theia/core/lib/node/file-uri';
import { getStatus } from 'dugite-extra/lib/command/status';
import { createCommit } from 'dugite-extra/lib/command/commit';
import { stage, unstage } from 'dugite-extra/lib/command/stage';
import { reset, GitResetMode } from 'dugite-extra/lib/command/reset';
import { getTextContents, getBlobContents } from 'dugite-extra/lib/command/show';
import { checkoutBranch, checkoutPaths } from 'dugite-extra/lib/command/checkout';
import { createBranch, deleteBranch, renameBranch, listBranch } from 'dugite-extra/lib/command/branch';
import { IStatusResult, IAheadBehind, AppFileStatus, WorkingDirectoryStatus as DugiteStatus, FileChange as DugiteFileChange } from 'dugite-extra/lib/model/status';
import { Branch as DugiteBranch } from 'dugite-extra/lib/model/branch';
import { Commit as DugiteCommit, CommitIdentity as DugiteCommitIdentity } from 'dugite-extra/lib/model/commit';
import { ILogger } from '@theia/core';
import { Deferred } from '@theia/core/lib/common/promise-util';
import * as strings from '@theia/core/lib/common/strings';
import {
    Git, GitUtils, Repository, WorkingDirectoryStatus, GitFileChange, GitFileStatus, Branch, Commit,
    CommitIdentity, GitResult, CommitWithChanges, GitFileBlame, CommitLine, GitError, Remote, StashEntry
} from '../common';
import { GitRepositoryManager } from './git-repository-manager';
import { GitExecProvider } from './git-exec-provider';
import { GitEnvProvider } from './env/git-env-provider';
import { GitInit } from './init/git-init';

/**
 * Parsing and converting raw Git output into Git model instances.
 */
@injectable()
export abstract class OutputParser<T> {

    /** This is the `NUL` delimiter. Equals wih `%x00`. */
    static readonly LINE_DELIMITER = '\0';

    abstract parse(repositoryUri: string, raw: string, delimiter?: string): T[];
    abstract parse(repositoryUri: string, items: string[]): T[];
    abstract parse(repositoryUri: string, input: string | string[], delimiter?: string): T[];

    protected toUri(repositoryUri: string, pathSegment: string): string {
        return FileUri.create(Path.join(FileUri.fsPath(repositoryUri), pathSegment)).toString();
    }

    protected split(input: string | string[], delimiter: string): string[] {
        return (Array.isArray(input) ? input : input.split(delimiter)).filter(item => item && item.length > 0);
    }

}

/**
 * Status parser for converting raw Git `--name-status` output into file change objects.
 */
@injectable()
export class NameStatusParser extends OutputParser<GitFileChange> {

    parse(repositoryUri: string, input: string | string[], delimiter: string = OutputParser.LINE_DELIMITER): GitFileChange[] {
        const items = this.split(input, delimiter);
        const changes: GitFileChange[] = [];
        let index = 0;
        while (index < items.length) {
            const rawStatus = items[index];
            const status = GitUtils.mapStatus(rawStatus);
            if (GitUtils.isSimilarityStatus(rawStatus)) {
                const uri = this.toUri(repositoryUri, items[index + 2]);
                const oldUri = this.toUri(repositoryUri, items[index + 1]);
                changes.push({
                    status,
                    uri,
                    oldUri,
                    staged: true
                });
                index = index + 3;
            } else {
                const uri = this.toUri(repositoryUri, items[index + 1]);
                changes.push({
                    status,
                    uri,
                    staged: true
                });
                index = index + 2;
            }
        }
        return changes;
    }

}

/**
 * Built-in Git placeholders for tuning the `--format` option for `git diff` or `git log`.
 */
export enum CommitPlaceholders {
    HASH = '%H',
    SHORT_HASH = '%h',
    AUTHOR_EMAIL = '%aE',
    AUTHOR_NAME = '%aN',
    AUTHOR_DATE = '%aI',
    AUTHOR_RELATIVE_DATE = '%ar',
    SUBJECT = '%s',
    BODY = '%b'
}

/**
 * Parser for converting raw, Git commit details into `CommitWithChanges` instances.
 */
@injectable()
export class CommitDetailsParser extends OutputParser<CommitWithChanges> {

    static readonly ENTRY_DELIMITER = '\x01';
    static readonly COMMIT_CHUNK_DELIMITER = '\x02';
    static readonly DEFAULT_PLACEHOLDERS = [
        CommitPlaceholders.HASH,
        CommitPlaceholders.AUTHOR_EMAIL,
        CommitPlaceholders.AUTHOR_NAME,
        CommitPlaceholders.AUTHOR_DATE,
        CommitPlaceholders.AUTHOR_RELATIVE_DATE,
        CommitPlaceholders.SUBJECT,
        CommitPlaceholders.BODY];

    @inject(NameStatusParser)
    protected readonly nameStatusParser: NameStatusParser;

    parse(repositoryUri: string, input: string | string[], delimiter: string = CommitDetailsParser.COMMIT_CHUNK_DELIMITER): CommitWithChanges[] {
        const chunks = this.split(input, delimiter);
        const changes: CommitWithChanges[] = [];
        for (const chunk of chunks) {
            const [sha, email, name, timestamp, authorDateRelative, summary, body, rawChanges] = chunk.trim().split(CommitDetailsParser.ENTRY_DELIMITER);
            const fileChanges = this.nameStatusParser.parse(repositoryUri, (rawChanges || '').trim());
            changes.push({
                sha,
                author: { timestamp, email, name },
                authorDateRelative,
                summary,
                body,
                fileChanges
            });
        }
        return changes;
    }

    getFormat(...placeholders: CommitPlaceholders[]): string {
        return '%x02' + placeholders.join('%x01') + '%x01';
    }

}

@injectable()
export class GitBlameParser {

    async parse(fileUri: string, gitBlameOutput: string, commitBody: (sha: string) => Promise<string>): Promise<GitFileBlame | undefined> {
        if (!gitBlameOutput) {
            return undefined;
        }
        const parsedEntries = this.parseEntries(gitBlameOutput);
        return this.createFileBlame(fileUri, parsedEntries, commitBody);
    }

    protected parseEntries(rawOutput: string): GitBlameParser.Entry[] {
        const result: GitBlameParser.Entry[] = [];
        let current: GitBlameParser.Entry | undefined;
        for (const line of strings.split(rawOutput, '\n')) {
            if (current === undefined) {
                current = {};
            }
            if (GitBlameParser.pumpEntry(current, line)) {
                result.push(current);
                current = undefined;
            }
        }
        return result;
    }

    protected async createFileBlame(uri: string, blameEntries: GitBlameParser.Entry[], commitBody: (sha: string) => Promise<string>): Promise<GitFileBlame> {
        const commits = new Map<string, Commit>();
        const lines: CommitLine[] = [];
        for (const entry of blameEntries) {
            const sha = entry.sha!;
            let commit = commits.get(sha);
            if (!commit) {
                commit = <Commit>{
                    sha,
                    author: {
                        name: entry.author,
                        email: entry.authorMail,
                        timestamp: entry.authorTime ? new Date(entry.authorTime * 1000).toISOString() : '',
                    },
                    summary: entry.summary,
                    body: await commitBody(sha)
                };
                commits.set(sha, commit);
            }
            const lineCount = entry.lineCount!;
            for (let lineOffset = 0; lineOffset < lineCount; lineOffset++) {
                const line = <CommitLine>{
                    sha,
                    line: entry.line! + lineOffset
                };
                lines[line.line] = line;
            }
        }
        const fileBlame = <GitFileBlame>{ uri, commits: Array.from(commits.values()), lines };
        return fileBlame;
    }

}

export namespace GitBlameParser {
    export interface Entry {
        fileName?: string,
        sha?: string,
        previousSha?: string,
        line?: number,
        lineCount?: number,
        author?: string,
        authorMail?: string,
        authorTime?: number,
        summary?: string,
    }

    export function isUncommittedSha(sha: string | undefined): boolean {
        return (sha || '').startsWith('0000000');
    }

    export function pumpEntry(entry: Entry, outputLine: string): boolean {
        const parts = outputLine.split(' ');
        if (parts.length < 2) {
            return false;
        }
        const uncommitted = isUncommittedSha(entry.sha);
        const firstPart = parts[0];
        if (entry.sha === undefined) {
            entry.sha = firstPart;
            entry.line = parseInt(parts[2], 10) - 1; // to zero based
            entry.lineCount = parseInt(parts[3], 10);
        } else if (firstPart === 'author') {
            entry.author = uncommitted ? 'You' : parts.slice(1).join(' ');
        } else if (firstPart === 'author-mail') {
            const rest = parts.slice(1).join(' ');
            const matches = rest.match(/(<(.*)>)/);
            entry.authorMail = matches ? matches[2] : rest;
        } else if (firstPart === 'author-time') {
            entry.authorTime = parseInt(parts[1], 10);
        } else if (firstPart === 'summary') {
            let summary = parts.slice(1).join(' ');
            if (summary.startsWith('"') && summary.endsWith('"')) {
                summary = summary.substr(1, summary.length - 2);
            }
            entry.summary = uncommitted ? 'uncommitted' : summary;
        } else if (firstPart === 'previous') {
            entry.previousSha = parts[1];
        } else if (firstPart === 'filename') {
            entry.fileName = parts.slice(1).join(' ');
            return true;
        }
        return false;
    }

}

/**
 * `dugite-extra` based Git implementation.
 */
@injectable()
export class DugiteGit implements Git {

    protected readonly limit = 1000;

    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(GitRepositoryManager)
    protected readonly manager: GitRepositoryManager;

    @inject(NameStatusParser)
    protected readonly nameStatusParser: NameStatusParser;

    @inject(CommitDetailsParser)
    protected readonly commitDetailsParser: CommitDetailsParser;

    @inject(GitBlameParser)
    protected readonly blameParser: GitBlameParser;

    @inject(GitExecProvider)
    protected readonly execProvider: GitExecProvider;

    @inject(GitEnvProvider)
    protected readonly envProvider: GitEnvProvider;

    @inject(GitInit)
    protected readonly gitInit: GitInit;

    protected ready: Deferred<void> = new Deferred();
    protected gitEnv: Deferred<Object> = new Deferred();

    @postConstruct()
    protected init(): void {
        this.envProvider.getEnv().then(env => this.gitEnv.resolve(env));
        this.gitInit.init()
            .catch(err => {
                this.logger.error('An error occurred during the Git initialization.', err);
                this.ready.resolve();
            })
            .then(() => this.ready.resolve());
    }

    dispose(): void {
        this.execProvider.dispose();
        this.gitInit.dispose();
    }

    gitIsReady(): Promise<void> {
        return this.ready.promise;
    }

    getGitEnv(): Promise<Object> {
        return this.gitEnv.promise;
    }

    async clone(remoteUrl: string, options: Git.Options.Clone): Promise<Repository> {
        await this.ready.promise;
        const { localUri, branch } = options;
        const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
        await clone(remoteUrl, this.getFsPath(localUri), { branch }, { exec, env });
        return { localUri };
    }

    async status(repository: Repository): Promise<WorkingDirectoryStatus> {
        await this.ready.promise;
        const repositoryPath = this.getFsPath(repository);
        const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
        const dugiteStatus = await getStatus(repositoryPath, true, this.limit, { exec, env });
        return this.mapStatus(dugiteStatus, repository);
    }

    async add(repository: Repository, uri: string | string[]): Promise<void> {
        await this.ready.promise;
        const paths = (Array.isArray(uri) ? uri : [uri]).map(FileUri.fsPath);
        const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
        return this.manager.run(repository, () =>
            stage(this.getFsPath(repository), paths, { exec, env })
        );
    }

    async unstage(repository: Repository, uri: string | string[], options?: Git.Options.Unstage): Promise<void> {
        await this.ready.promise;
        const paths = (Array.isArray(uri) ? uri : [uri]).map(FileUri.fsPath);
        const treeish = options && options.treeish ? options.treeish : undefined;
        const where = options && options.reset ? options.reset : undefined;
        const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
        return this.manager.run(repository, () =>
            unstage(this.getFsPath(repository), paths, treeish, where, { exec, env })
        );
    }

    async branch(repository: Repository, options: { type: 'current' }): Promise<Branch | undefined>;
    async branch(repository: Repository, options: { type: 'local' | 'remote' | 'all' }): Promise<Branch[]>;
    async branch(repository: Repository, options: Git.Options.BranchCommand.Create | Git.Options.BranchCommand.Rename | Git.Options.BranchCommand.Delete): Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async branch(repository: any, options: any): Promise<void | undefined | Branch | Branch[]> {
        await this.ready.promise;
        const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
        const repositoryPath = this.getFsPath(repository);
        if (GitUtils.isBranchList(options)) {
            if (options.type === 'current') {
                const currentBranch = await listBranch(repositoryPath, options.type, { exec, env });
                return currentBranch ? this.mapBranch(currentBranch) : undefined;
            }
            const branches = await listBranch(repositoryPath, options.type, { exec, env });
            return Promise.all(branches.map(branch => this.mapBranch(branch)));
        }
        return this.manager.run(repository, () => {
            if (GitUtils.isBranchCreate(options)) {
                return createBranch(repositoryPath, options.toCreate, { startPoint: options.startPoint }, { exec, env });
            }
            if (GitUtils.isBranchRename(options)) {
                return renameBranch(repositoryPath, options.newName, options.newName, { force: !!options.force }, { exec, env });
            }
            if (GitUtils.isBranchDelete(options)) {
                return deleteBranch(repositoryPath, options.toDelete, { force: !!options.force, remote: !!options.remote }, { exec, env });
            }
            return this.fail(repository, `Unexpected git branch options: ${options}.`);
        });
    }

    async checkout(repository: Repository, options: Git.Options.Checkout.CheckoutBranch | Git.Options.Checkout.WorkingTreeFile): Promise<void> {
        await this.ready.promise;
        const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
        return this.manager.run(repository, () => {
            const repositoryPath = this.getFsPath(repository);
            if (GitUtils.isBranchCheckout(options)) {
                return checkoutBranch(repositoryPath, options.branch, { exec, env });
            }
            if (GitUtils.isWorkingTreeFileCheckout(options)) {
                const paths = (Array.isArray(options.paths) ? options.paths : [options.paths]).map(FileUri.fsPath);
                return checkoutPaths(repositoryPath, paths, { exec, env });
            }
            return this.fail(repository, `Unexpected git checkout options: ${options}.`);
        });
    }

    async commit(repository: Repository, message?: string, options?: Git.Options.Commit): Promise<void> {
        await this.ready.promise;
        const signOff = options && options.signOff;
        const amend = options && options.amend;
        const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
        return this.manager.run(repository, () =>
            createCommit(this.getFsPath(repository), message || '', signOff, amend, { exec, env })
        );
    }

    async fetch(repository: Repository, options?: Git.Options.Fetch): Promise<void> {
        await this.ready.promise;
        const repositoryPath = this.getFsPath(repository);
        const r = await this.getDefaultRemote(repositoryPath, options ? options.remote : undefined);
        if (r) {
            const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
            return this.manager.run(repository, () =>
                fetch(repositoryPath, r!, { exec, env })
            );
        }
        this.fail(repository, 'No remote repository specified. Please, specify either a URL or a remote name from which new revisions should be fetched.');
    }

    async push(repository: Repository, { remote, localBranch, remoteBranch, setUpstream, force }: Git.Options.Push = {}): Promise<void> {
        await this.ready.promise;
        const repositoryPath = this.getFsPath(repository);
        const currentRemote = await this.getDefaultRemote(repositoryPath, remote);
        if (currentRemote === undefined) {
            this.fail(repository, 'No configured push destination.');
        }
        const branch = await this.getCurrentBranch(repositoryPath, localBranch);
        const branchName = typeof branch === 'string' ? branch : branch.name;
        if (setUpstream || force) {
            const args = ['push'];
            if (force) {
                args.push('--force');
            }
            if (setUpstream) {
                args.push('--set-upstream');
            }
            if (currentRemote) {
                args.push(currentRemote);
            }
            args.push(branchName + (remoteBranch ? `:${remoteBranch}` : ''));
            await this.exec(repository, args);
        } else {
            const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
            return this.manager.run(repository, () =>
                push(repositoryPath, currentRemote!, branchName, remoteBranch, { exec, env })
            );
        }
    }

    async pull(repository: Repository, { remote, branch, rebase }: Git.Options.Pull = {}): Promise<void> {
        await this.ready.promise;
        const repositoryPath = this.getFsPath(repository);
        const currentRemote = await this.getDefaultRemote(repositoryPath, remote);
        if (currentRemote === undefined) {
            this.fail(repository, 'No remote repository specified. Please, specify either a URL or a remote name from which new revisions should be fetched.');
        }
        if (rebase) {
            const args = ['pull'];
            if (rebase) {
                args.push('-r');
            }
            if (currentRemote) {
                args.push(currentRemote);
            }
            if (branch) {
                args.push(branch);
            }
            await this.exec(repository, args);
        } else {
            const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
            return this.manager.run(repository, () => pull(repositoryPath, currentRemote!, branch, { exec, env }));
        }
    }

    async reset(repository: Repository, options: Git.Options.Reset): Promise<void> {
        await this.ready.promise;
        const repositoryPath = this.getFsPath(repository);
        const mode = this.getResetMode(options.mode);
        const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
        return this.manager.run(repository, () =>
            reset(repositoryPath, mode, options.ref ? options.ref : 'HEAD', { exec, env })
        );
    }

    async merge(repository: Repository, options: Git.Options.Merge): Promise<void> {
        await this.ready.promise;
        const repositoryPath = this.getFsPath(repository);
        const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
        return this.manager.run(repository, () =>
            merge(repositoryPath, options.branch, { exec, env })
        );
    }

    async show(repository: Repository, uri: string, options?: Git.Options.Show): Promise<string> {
        await this.ready.promise;
        const encoding = options ? options.encoding || 'utf8' : 'utf8';
        const commitish = this.getCommitish(options);
        const repositoryPath = this.getFsPath(repository);
        const path = this.getFsPath(uri);
        const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
        if (encoding === 'binary') {
            return (await getBlobContents(repositoryPath, commitish, path, { exec, env })).toString();
        }
        return (await getTextContents(repositoryPath, commitish, path, { exec, env })).toString();
    }

    async stash(repository: Repository, options?: Readonly<{ action?: 'push', message?: string }>): Promise<void>;
    async stash(repository: Repository, options: Readonly<{ action: 'list' }>): Promise<StashEntry[]>;
    async stash(repository: Repository, options: Readonly<{ action: 'clear' }>): Promise<void>;
    async stash(repository: Repository, options: Readonly<{ action: 'apply' | 'pop' | 'drop', id?: string }>): Promise<void>;
    async stash(repository: Repository, options?: Git.Options.Stash): Promise<StashEntry[] | void> {
        const repositoryPath: string = this.getFsPath(repository);
        try {
            if (!options || (options && !options.action)) {
                await stash.push(repositoryPath, options ? options.message : undefined);
                return;
            }
            switch (options.action) {
                case 'push':
                    await stash.push(repositoryPath, options.message);
                    break;
                case 'apply':
                    await stash.apply(repositoryPath, options.id);
                    break;
                case 'pop':
                    await stash.pop(repositoryPath, options.id);
                    break;
                case 'list':
                    const stashList = await stash.list(repositoryPath);
                    const stashes: StashEntry[] = [];
                    stashList.forEach(stashItem => {
                        const splitIndex = stashItem.indexOf(':');
                        stashes.push({
                            id: stashItem.substring(0, splitIndex),
                            message: stashItem.substring(splitIndex + 1)
                        });
                    });
                    return stashes;
                case 'drop':
                    await stash.drop(repositoryPath, options.id);
                    break;
            }
        } catch (err) {
            this.fail(repository, err);
        }
    }

    async remote(repository: Repository): Promise<string[]>;
    async remote(repository: Repository, options: { verbose: true }): Promise<Remote[]>;
    async remote(repository: Repository, options?: Git.Options.Remote): Promise<string[] | Remote[]> {
        await this.ready.promise;
        const repositoryPath = this.getFsPath(repository);
        const remotes = await this.getRemotes(repositoryPath);
        const names = remotes.map(a => a.name);
        return (options && options.verbose === true) ? remotes : names;
    }

    async exec(repository: Repository, args: string[], options?: Git.Options.Execution): Promise<GitResult> {
        await this.ready.promise;
        const repositoryPath = this.getFsPath(repository);
        return this.manager.run(repository, async () => {
            const name = options && options.name ? options.name : '';
            const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
            let opts = {};
            if (options) {
                opts = {
                    ...options
                };
                if (options.successExitCodes) {
                    opts = { ...opts, successExitCodes: new Set(options.successExitCodes) };
                }
                if (options.expectedErrors) {
                    opts = { ...opts, expectedErrors: new Set(options.expectedErrors) };
                }
            }
            opts = {
                ...opts,
                exec,
                env
            };
            return git(args, repositoryPath, name, opts);
        });
    }

    async diff(repository: Repository, options?: Git.Options.Diff): Promise<GitFileChange[]> {
        await this.ready.promise;
        const args = ['diff', '--name-status', '-C', '-M', '-z'];
        args.push(this.mapRange((options || {}).range));
        if (options && options.uri) {
            const relativePath = Path.relative(this.getFsPath(repository), this.getFsPath(options.uri));
            args.push(...['--', relativePath !== '' ? relativePath : '.']);
        }
        const result = await this.exec(repository, args);
        return this.nameStatusParser.parse(repository.localUri, result.stdout.trim());
    }

    async log(repository: Repository, options?: Git.Options.Log): Promise<CommitWithChanges[]> {
        await this.ready.promise;
        // If remaining commits should be calculated by the backend, then run `git rev-list --count ${fromRevision | HEAD~fromRevision}`.
        // How to use `mailmap` to map authors: https://www.kernel.org/pub/software/scm/git/docs/git-shortlog.html.
        const args = ['log'];
        if (options && options.branch) {
            args.push(options.branch);
        }
        const range = this.mapRange((options || {}).range);
        args.push(...[range, '-C', '-M', '-m', '--first-parent']);
        const maxCount = options && options.maxCount ? options.maxCount : 0;
        if (Number.isInteger(maxCount) && maxCount > 0) {
            args.push(...['-n', `${maxCount}`]);
        }
        const placeholders: CommitPlaceholders[] =
            options && options.shortSha ?
                [CommitPlaceholders.SHORT_HASH, ...CommitDetailsParser.DEFAULT_PLACEHOLDERS.slice(1)] : CommitDetailsParser.DEFAULT_PLACEHOLDERS;
        args.push(...['--name-status', '--date=unix', `--format=${this.commitDetailsParser.getFormat(...placeholders)}`, '-z', '--']);
        if (options && options.uri) {
            const file = Path.relative(this.getFsPath(repository), this.getFsPath(options.uri)) || '.';
            args.push(...[file]);
        }

        const successExitCodes = [0, 128];
        let result = await this.exec(repository, args, { successExitCodes });
        if (result.exitCode !== 0) {
            // Note that if no range specified then the 'to revision' defaults to HEAD
            const rangeInvolvesHead = !options || !options.range || options.range.toRevision === 'HEAD';
            const repositoryHasNoHead = !await this.revParse(repository, { ref: 'HEAD' });
            // The 'log' command could potentially be valid when no HEAD if the revision range does not involve HEAD */
            if (rangeInvolvesHead && repositoryHasNoHead) {
                // The range involves HEAD but there is no HEAD.  'no head' most likely means a newly created repository with
                // no commits, but could potentially have commits with no HEAD.  This is effectively an empty repository.
                return [];
            }
            // Either the range did not involve HEAD or HEAD exists.  The error must be something else,
            // so re-run but this time we don't ignore the error.
            result = await this.exec(repository, args);
        }

        return this.commitDetailsParser.parse(
            repository.localUri, result.stdout.trim()
                .split(CommitDetailsParser.COMMIT_CHUNK_DELIMITER)
                .filter(item => item && item.length > 0));
    }

    async revParse(repository: Repository, options: Git.Options.RevParse): Promise<string | undefined> {
        const ref = options.ref;
        const successExitCodes = [0, 128];
        const result = await this.exec(repository, ['rev-parse', ref], { successExitCodes });
        if (result.exitCode === 0) {
            return result.stdout; // sha
        }
    }

    async blame(repository: Repository, uri: string, options?: Git.Options.Blame): Promise<GitFileBlame | undefined> {
        await this.ready.promise;
        const args = ['blame', '--root', '--incremental'];
        const file = Path.relative(this.getFsPath(repository), this.getFsPath(uri));
        const repositoryPath = this.getFsPath(repository);
        const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
        const status = await getStatus(repositoryPath, true, this.limit, { exec, env });
        const isUncommitted = (change: DugiteFileChange) => change.status === AppFileStatus.New && change.path === file;
        const changes = status.workingDirectory.files;
        if (changes.some(isUncommitted)) {
            return undefined;
        }
        const stdin = options ? options.content : undefined;
        if (stdin) {
            args.push('--contents', '-');
        }
        const gitResult = await this.exec(repository, [...args, '--', file], { stdin });
        const output = gitResult.stdout.trim();
        const commitBodyReader = async (sha: string) => {
            if (GitBlameParser.isUncommittedSha(sha)) {
                return '';
            }
            const revResult = await this.exec(repository, ['rev-list', '--format=%B', '--max-count=1', sha]);
            const revOutput = revResult.stdout;
            let nl = revOutput.indexOf('\n');
            if (nl > 0) {
                nl = revOutput.indexOf('\n', nl + 1);
            }
            return revOutput.substr(Math.max(0, nl)).trim();
        };
        const blame = await this.blameParser.parse(uri, output, commitBodyReader);
        return blame;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async lsFiles(repository: Repository, uri: string, options?: Git.Options.LsFiles): Promise<any> {
        await this.ready.promise;
        const args = ['ls-files'];
        const relativePath = Path.relative(this.getFsPath(repository), this.getFsPath(uri));
        const file = (relativePath === '') ? '.' : relativePath;
        if (options && options.errorUnmatch) {
            args.push('--error-unmatch', file);
            const successExitCodes = [0, 1];
            const expectedErrors = [GitError.OutsideRepository];
            const result = await this.exec(repository, args, { successExitCodes, expectedErrors });
            const { exitCode } = result;
            return exitCode === 0;
        }
    }

    private getCommitish(options?: Git.Options.Show): string {
        if (options && options.commitish) {
            return 'index' === options.commitish ? '' : options.commitish;
        }
        return '';
    }

    private async getRemotes(repositoryPath: string): Promise<Remote[]> {
        await this.ready.promise;
        const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
        const result = await git(['remote', '-v'], repositoryPath, 'remote', { exec, env });
        const out = result.stdout || '';
        const results = out.trim().match(/\S+/g);
        if (results) {
            const values: Remote[] = [];
            for (let i = 0; i < results.length; i += 6) {
                values.push({ name: results[i], fetch: results[i + 1], push: results[i + 4] });
            }
            return values;
        } else {
            return [];
        }
    }

    private async getDefaultRemote(repositoryPath: string, remote?: string): Promise<string | undefined> {
        if (remote === undefined) {
            const remotes = await this.getRemotes(repositoryPath);
            const name = remotes.map(a => a.name);
            return name.shift();
        }
        return remote;
    }

    private async getCurrentBranch(repositoryPath: string, localBranch?: string): Promise<Branch | string> {
        await this.ready.promise;
        if (localBranch !== undefined) {
            return localBranch;
        }
        const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
        const branch = await listBranch(repositoryPath, 'current', { exec, env });
        if (branch === undefined) {
            return this.fail(repositoryPath, 'No current branch.');
        }
        if (Array.isArray(branch)) {
            return this.fail(repositoryPath, `Implementation error. Listing branch with the 'current' flag must return with single value. Was: ${branch}`);
        }
        return this.mapBranch(branch);
    }

    private getResetMode(mode: 'hard' | 'soft' | 'mixed'): GitResetMode {
        switch (mode) {
            case 'hard': return GitResetMode.Hard;
            case 'soft': return GitResetMode.Soft;
            case 'mixed': return GitResetMode.Mixed;
            default: throw new Error(`Unexpected Git reset mode: ${mode}.`);
        }
    }

    private async mapBranch(toMap: DugiteBranch): Promise<Branch> {
        const tip = await this.mapTip(toMap.tip);
        return {
            name: toMap.name,
            nameWithoutRemote: toMap.nameWithoutRemote,
            remote: toMap.remote,
            type: toMap.type,
            upstream: toMap.upstream,
            upstreamWithoutRemote: toMap.upstreamWithoutRemote,
            tip
        };
    }

    private async mapTip(toMap: DugiteCommit): Promise<Commit> {
        const author = await this.mapCommitIdentity(toMap.author);
        return {
            author,
            body: toMap.body,
            parentSHAs: [...toMap.parentSHAs],
            sha: toMap.sha,
            summary: toMap.summary
        };
    }

    private async mapCommitIdentity(toMap: DugiteCommitIdentity): Promise<CommitIdentity> {
        return {
            timestamp: toMap.date.toISOString(),
            email: toMap.email,
            name: toMap.name,
        };
    }

    private async mapStatus(toMap: IStatusResult, repository: Repository): Promise<WorkingDirectoryStatus> {
        const repositoryPath = this.getFsPath(repository);
        const [aheadBehind, changes] = await Promise.all([this.mapAheadBehind(toMap.branchAheadBehind), this.mapFileChanges(toMap.workingDirectory, repositoryPath)]);
        return {
            exists: toMap.exists,
            branch: toMap.currentBranch,
            upstreamBranch: toMap.currentUpstreamBranch,
            aheadBehind,
            changes,
            currentHead: toMap.currentTip,
            incomplete: toMap.incomplete
        };
    }

    private async mapAheadBehind(toMap: IAheadBehind | undefined): Promise<{ ahead: number, behind: number } | undefined> {
        return toMap ? { ...toMap } : undefined;
    }

    private async mapFileChanges(toMap: DugiteStatus, repositoryPath: string): Promise<GitFileChange[]> {
        return Promise.all(toMap.files.map(file => this.mapFileChange(file, repositoryPath)));
    }

    private async mapFileChange(toMap: DugiteFileChange, repositoryPath: string): Promise<GitFileChange> {
        const [uri, status, oldUri] = await Promise.all([
            this.getUri(Path.join(repositoryPath, toMap.path)),
            this.mapFileStatus(toMap.status),
            toMap.oldPath ? this.getUri(Path.join(repositoryPath, toMap.oldPath)) : undefined
        ]);
        return {
            uri,
            status,
            oldUri,
            staged: toMap.staged
        };
    }

    private mapFileStatus(toMap: AppFileStatus): GitFileStatus {
        switch (toMap) {
            case AppFileStatus.Conflicted: return GitFileStatus.Conflicted;
            case AppFileStatus.Copied: return GitFileStatus.Copied;
            case AppFileStatus.Deleted: return GitFileStatus.Deleted;
            case AppFileStatus.Modified: return GitFileStatus.Modified;
            case AppFileStatus.New: return GitFileStatus.New;
            case AppFileStatus.Renamed: return GitFileStatus.Renamed;
            default: throw new Error(`Unexpected application file status: ${toMap}`);
        }
    }

    private mapRange(toMap: Git.Options.Range | undefined): string {
        let range = 'HEAD';
        if (toMap) {
            if (typeof toMap.fromRevision === 'number') {
                const toRevision = toMap.toRevision || 'HEAD';
                range = `${toRevision}~${toMap.fromRevision}..${toRevision}`;
            } else if (typeof toMap.fromRevision === 'string') {
                range = `${toMap.fromRevision}${toMap.toRevision ? '..' + toMap.toRevision : ''}`;
            } else if (toMap.toRevision) {
                range = toMap.toRevision;
            }
        }
        return range;
    }

    private getFsPath(repository: Repository | string): string {
        const uri = typeof repository === 'string' ? repository : repository.localUri;
        return FileUri.fsPath(uri);
    }

    private getUri(path: string): string {
        return FileUri.create(path).toString();
    }

    private fail(repository: Repository | string, message?: string): never {
        const p = typeof repository === 'string' ? repository : repository.localUri;
        const m = message ? `${message} ` : '';
        throw new Error(`${m}[${p}]`);
    }

}
