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

import * as fs from 'fs-extra';
import * as Path from 'path'; // Upper case?
import { injectable, inject, postConstruct } from 'inversify';
import { git, IGitExecutionOptions, GitError } from './git-exec-provider';
import { FileUri } from '@theia/core/lib/node/file-uri';
import { ILogger } from '@theia/core';
import { Deferred } from '@theia/core/lib/common/promise-util';
import * as strings from '@theia/core/lib/common/strings';
import {
    Git, GitUtils, Repository, WorkingDirectoryStatus, GitFileChange, GitFileStatus, Branch, BranchType, Commit,
    CommitIdentity, GitResult, CommitWithChanges, GitFileBlame, CommitLine, GitError as GitErrorCode, Remote, StashEntry
} from '../common';
import { GitRepositoryManager } from './git-repository-manager';
import { GitLocator } from './git-locator/git-locator-protocol';
import { GitExecProvider } from './git-exec-provider';
import { GitEnvProvider } from './env/git-env-provider';
import { GitInit } from './init/git-init';
import { relative } from 'path';
import { ChildProcess } from 'child_process';
const upath = require('upath');

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
 * `dugite` based Git implementation.
 */
@injectable()
export class DugiteGit implements Git {

    protected readonly limit = 1000;

    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(GitLocator)
    protected readonly locator: GitLocator;

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
        this.locator.dispose();
        this.execProvider.dispose();
        this.gitInit.dispose();
    }

    async clone(remoteUrl: string, options: Git.Options.Clone): Promise<Repository> {
        await this.ready.promise;

        const { localUri, branch } = options;

        const args = [
            'clone', '--recursive', '--progress',
        ];

        if (branch) {
            args.push('-b', branch);
        }

        const path = this.getFsPath(localUri);
        args.push('--', remoteUrl, path);

        await git(args, __dirname, 'clone', {});

        return { localUri };
    }

    async repositories(workspaceRootUri: string, options: Git.Options.Repositories): Promise<Repository[]> {
        await this.ready.promise;
        const workspaceRootPath = this.getFsPath(workspaceRootUri);
        const repositories: Repository[] = [];
        const containingPath = await this.resolveContainingPath(workspaceRootPath);
        if (containingPath) {
            repositories.push({
                localUri: this.getUri(containingPath)
            });
        }
        const maxCount = typeof options.maxCount === 'number' ? options.maxCount - repositories.length : undefined;
        if (typeof maxCount === 'number' && maxCount <= 0) {
            return repositories;
        }
        for (const repositoryPath of await this.locator.locate(workspaceRootPath, {
            maxCount
        })) {
            if (containingPath !== repositoryPath) {
                repositories.push({
                    localUri: this.getUri(repositoryPath)
                });
            }
        }
        return repositories;
    }

    async status(repository: Repository): Promise<WorkingDirectoryStatus> {
        await this.ready.promise;
        const repositoryPath = this.getFsPath(repository);
        const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);

        const noOptionalLocks = true;
        const options: IGitExecutionOptions = { exec, env };

        const args: string[] = [];
        if (noOptionalLocks) {
            // We need to check if the configured git version can use it or not. It is supported from 2.15.0
            if (typeof process.env.GIT__CAN_USE_NO_OPTIONAL_LOCKS === 'undefined') {
                console.info("Checking whether '--no-optional-locks' can be used with the current Git executable. Minimum required version is '2.15.0'.");
                let version: { major: number, minor: number } | undefined;
                let canUseNoOptionalLocks = false;
                try {
                    version = await this.getGitVersion(repository);
                } catch (e) {
                    console.error('Error ocurred when determining the Git version.', e);
                }
                if (!version) {
                    console.warn("Cannot determine the Git version. Disabling '--no-optional-locks' for all subsequent calls.");
                } else {
                    canUseNoOptionalLocks = version.major >= 2 && version.minor >= 15;
                    if (!canUseNoOptionalLocks) {
                        console.warn(`Git version was: '${version.major}.${version.minor}'. Disabling '--no-optional-locks' for all subsequent calls.`);
                    } else {
                        console.info(`'--no-optional-locks' is a valid Git option for the current Git version: '${version.major}.${version.minor}'.`);
                    }
                }
                process.env.GIT__CAN_USE_NO_OPTIONAL_LOCKS = `${canUseNoOptionalLocks}`;
            }
            if (process.env.GIT__CAN_USE_NO_OPTIONAL_LOCKS === 'true') {
                args.push('--no-optional-locks');
            }
        }
        args.push('status', '--untracked-files=all', '--branch', '--porcelain=2', '-z');
        const result = await git(
            args,
            repositoryPath,
            'getStatus',
            options
        );

        let currentBranch: string | undefined = undefined;
        let currentUpstreamBranch: string | undefined = undefined;
        let currentTip: string | undefined = undefined;
        let branchAheadBehind: { ahead: number, behind: number } | undefined = undefined;

        const ChangedEntryType = '1';
        const RenamedOrCopiedEntryType = '2';
        const UnmergedEntryType = 'u';
        const UntrackedEntryType = '?';
        const IgnoredEntryType = '!';

        interface IStatusHeader {
            readonly value: string
        }

        /** A representation of a parsed status entry from git status */
        interface IStatusEntry {
            /** The path to the file relative to the repository root */
            readonly path: string

            /** The two character long status code */
            readonly statusCode: string
        }

        function parseEntry(field: string, fieldsToSkip: number): IStatusEntry {
            let position = 4;
            while (fieldsToSkip !== 0) {
                position = field.indexOf(' ', position + 1);
                fieldsToSkip--;
            }
            return {
                statusCode: field.substring(2, 4),
                path: field.substring(position + 1)
            };
        }
        // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
        function parseChangedEntry(field: string): IStatusEntry {
            return parseEntry(field, 6);
        }

        // 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path><sep><origPath>
        function parsedRenamedOrCopiedEntry(field: string): IStatusEntry {
            return parseEntry(field, 7);
        }

        // u <xy> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
        function parseUnmergedEntry(field: string): IStatusEntry {
            return parseEntry(field, 8);
        }

        function parseUntrackedEntry(field: string): IStatusEntry {
            return {
                statusCode: '??',
                path: field.substring(2),
            };
        }

        const headers = new Array<IStatusHeader>();
        const changes = new Array<GitFileChange>();
        let limitCounter = 0;
        let incomplete = false;
        const fields = result.stdout.split('\0');
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];

            if (limitCounter === this.limit) {
                incomplete = true;
                break;
            }

            if (field.startsWith('# ') && field.length > 2) {
                headers.push({ value: field.substr(2) });
                continue;
            }

            const entryKind = field.substr(0, 1);
            switch (entryKind) {
                case ChangedEntryType: {
                    const entry = parseChangedEntry(field);
                    const uri = this.getUri(Path.join(repositoryPath, entry.path));
                    if (entry.statusCode[0] !== '.') {
                        changes.push({
                            uri,
                            staged: true,
                            status: this.getStatusFromCode(entry.statusCode[0]),
                        });
                    }
                    if (entry.statusCode[1] !== '.') {
                        changes.push({
                            uri,
                            staged: false,
                            status: this.getStatusFromCode(entry.statusCode[1]),
                        });
                    }
                    break;
                }
                case RenamedOrCopiedEntryType: {
                    const oldPathFromNextLine = fields[++i];
                    const entry = parsedRenamedOrCopiedEntry(field);
                    const uri = this.getUri(Path.join(repositoryPath, entry.path));
                    const oldUri = this.getUri(Path.join(repositoryPath, oldPathFromNextLine));
                    if (entry.statusCode[0] !== '.') {
                        changes.push({
                            uri,
                            staged: true,
                            ...this.getStatusAndOldUri(entry.statusCode[0], oldUri)
                        });
                    }
                    if (entry.statusCode[1] !== '.') {
                        changes.push({
                            uri,
                            staged: false,
                            ...this.getStatusAndOldUri(entry.statusCode[1], oldUri)
                        });
                    }
                    break;
                }
                case UnmergedEntryType: {
                    const entry = parseUnmergedEntry(field);
                    const change: GitFileChange = {
                        uri: this.getUri(Path.join(repositoryPath, entry.path)),
                        status: GitFileStatus.Conflicted,
                    };
                    changes.push(change);
                    break;
                }
                case UntrackedEntryType: {
                    const entry = parseUntrackedEntry(field);
                    const change: GitFileChange = {
                        uri: this.getUri(Path.join(repositoryPath, entry.path)),
                        status: GitFileStatus.New,
                        staged: false
                    };
                    changes.push(change);
                    break;
                }
                case IgnoredEntryType:
                // Ignored, we don't care about these for now
            }

            limitCounter++;
        }

        const changesWithoutNestedRepositories = changes.filter(file => !this.isNestedGitRepository(file));

        for (const entry of headers) {
            let m: RegExpMatchArray | null;
            const value = entry.value;

            // This intentionally does not match branch.oid initial
            if ((m = value.match(/^branch\.oid ([a-f0-9]+)$/))) {
                currentTip = m[1];
            } else if ((m = value.match(/^branch.head (.*)/))) {
                if (m[1] !== '(detached)') {
                    currentBranch = m[1];
                }
            } else if ((m = value.match(/^branch.upstream (.*)/))) {
                currentUpstreamBranch = m[1];
            } else if ((m = value.match(/^branch.ab \+(\d+) -(\d+)$/))) {
                const ahead = parseInt(m[1], 10);
                const behind = parseInt(m[2], 10);

                if (!isNaN(ahead) && !isNaN(behind)) {
                    branchAheadBehind = { ahead, behind };
                }
            }
        }

        return {
            branch: currentBranch,
            currentHead: currentTip,
            upstreamBranch: currentUpstreamBranch,
            aheadBehind: branchAheadBehind,
            exists: true,
            changes: changesWithoutNestedRepositories,
            incomplete
        };
    }

    private isNestedGitRepository(fileChange: GitFileChange): boolean {
        return fileChange.uri.endsWith('/');
    }

    protected getStatusFromCode(statusCode: string): GitFileStatus {
        switch (statusCode) {
            case 'M': return GitFileStatus.Modified;
            case 'D': return GitFileStatus.Deleted;
            case 'A': return GitFileStatus.New;
            case 'R': return GitFileStatus.Renamed;
            case 'C': return GitFileStatus.Copied;
            default: throw new Error(`Unexpected application file status: ${statusCode}`);
        }
    }

    protected getStatusAndOldUri(statusCharacter: string, oldPath: string): { status: GitFileStatus, oldPath?: string } {
        const status = this.getStatusFromCode(statusCharacter);
        if (statusCharacter === 'R' || statusCharacter === 'C') {
            return { status, oldPath };
        } else {
            return { status };
        }
    }

    async add(repository: Repository, uri: string | string[]): Promise<void> {
        const repositoryPath = this.getFsPath(repository);
        const filePaths = (Array.isArray(uri) ? uri : [uri]).map(FileUri.fsPath);

        const paths: string[] = [];
        if (filePaths === undefined || (Array.isArray(filePaths) && filePaths.length === 0)) {
            paths.push('.');
        } else {
            paths.push(...(Array.isArray(filePaths) ? filePaths : [filePaths]).map(f => Path.relative(repositoryPath, f)));
        }
        const args = ['add', ...paths];
        await this.execWithName(repository, args, 'add');
    }

    async unstage(repository: Repository, uri: string | string[], options?: Git.Options.Unstage): Promise<void> {
        const filePaths = (Array.isArray(uri) ? uri : [uri]).map(FileUri.fsPath);
        const treeish = options && options.treeish ? options.treeish : undefined;
        const where = options && options.reset ? options.reset : undefined;

        const _treeish = treeish || 'HEAD';
        const _where = where || 'all';
        const branch = await this.execWithName(repository, ['branch'], 'branch');
        const args: string[] = [];
        // Detached HEAD.
        if (!branch.stdout.trim()) {
            args.push(...['rm', '--cached', '-r', '--']);
        } else {
            if (_where === 'working-tree') {
                args.push(...['checkout-index', '-f', '-u']);
            } else {
                args.push('reset');
                if (_where === 'index') {
                    args.push('-q');
                }
            }
            args.push(...[_treeish, '--']);
        }

        const repositoryPath = this.getFsPath(repository);
        const paths: string[] = [];
        if (filePaths === undefined || (Array.isArray(filePaths) && filePaths.length === 0)) {
            paths.push('.');
        } else {
            paths.push(...(Array.isArray(filePaths) ? filePaths : [filePaths]).map(f => Path.relative(repositoryPath, f)));
        }
        args.push(...paths);
        await this.execWithName(repository, args, 'unstage');
    }

    async branch(repository: Repository, options: { type: 'current' }): Promise<Branch | undefined>;
    async branch(repository: Repository, options: { type: 'local' | 'remote' | 'all' }): Promise<Branch[]>;
    async branch(repository: Repository, options: Git.Options.BranchCommand.Create | Git.Options.BranchCommand.Rename | Git.Options.BranchCommand.Delete): Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async branch(repository: any, options: any): Promise<void | undefined | Branch | Branch[]> {
        await this.ready.promise;
        if (GitUtils.isBranchList(options)) {
            const { type } = options;
            if (type === 'current') {
                return this.currentBranch(repository);
            }
            const branches = (await this.getBranches(repository, []))
                .filter(branch => {
                    switch (type) {
                        case 'local': return branch.type === BranchType.Local;
                        case 'remote': return branch.type === BranchType.Remote;
                        case 'all': return true;
                    }
                });
            return Promise.all(branches);
        }
        if (GitUtils.isBranchCreate(options)) {
            return this.createBranch(repository, options.toCreate, { startPoint: options.startPoint });
        }
        if (GitUtils.isBranchRename(options)) {
            return this.renameBranch(repository, options.newName, options.newName, { force: !!options.force });
        }
        if (GitUtils.isBranchDelete(options)) {
            return this.deleteBranch(repository, options.toDelete, { force: !!options.force, remote: !!options.remote });
        }
        return this.fail(repository, `Unexpected git branch options: ${options}.`);
    }

    delimiter = '1F';
    delimiterString = String.fromCharCode(parseInt(this.delimiter, 16));
    forEachRefFormat = [
        '%(refname)',
        '%(refname:short)',
        '%(upstream:short)',
        '%(objectname)', // SHA
        '%(author)',
        '%(parent)', // parent SHAs
        '%(subject)',
        '%(body)',
        `%${this.delimiter}`, // indicate end-of-line as %(body) may contain newlines
    ].join('%00');

    protected async currentBranch(repository: Repository): Promise<Branch | undefined> {
        const opts = {
            successExitCodes: [0, 1, 128]
        };

        // const currentBranch = await listBranch(repositoryPath, options.type, { exec, env });
        const result = await this.execWithName(repository, ['rev-parse', '--abbrev-ref', 'HEAD'], 'getCurrentBranch', opts);
        const { exitCode } = result;
        // If the error code 1 is returned if no upstream.
        // If the error code 128 is returned if the branch is unborn.
        if (exitCode === 1 || exitCode === 128) {
            return undefined;
        }
        // New branches have a `heads/` prefix.
        const name = result.stdout.trim().replace(/^heads\//, '');
        const matchingBranches = await this.getBranches(repository, [`refs/heads/${name}`]);
        return matchingBranches.shift();
    }

    protected async createBranch(
        repository: Repository,
        name: string,
        createOptions?: { startPoint?: string, checkout?: boolean }): Promise<void> {

        const startPoint = createOptions ? createOptions.startPoint : undefined;
        const checkout = createOptions ? createOptions.checkout : false;
        const args = checkout ? ['checkout', '-b', name] : ['branch', name];
        if (startPoint) {
            args.push(startPoint);
        }
        await this.execWithName(repository, args, 'createBranch');
    }

    protected async renameBranch(repository: Repository, name: string, newName: string, renameOptions?: { force?: boolean }): Promise<void> {
        const force = renameOptions ? renameOptions.force : false;
        const args = ['branch', `${force ? '-M' : '-m'}`, name, newName];
        await this.execWithName(repository, args, 'renameBranch');
    }

    protected async deleteBranch(repository: Repository, name: string, deleteOptions?: { force?: boolean, remote?: boolean }): Promise<void> {
        const force = deleteOptions ? deleteOptions.force : false;
        const remote = deleteOptions ? deleteOptions.remote : false;
        const args = ['branch', `${force ? '-D' : '-d'}`, `${name}`];
        const branches = remote ? await this.getBranches(repository, []) : [];
        await this.execWithName(repository, args, 'deleteBranch');
        if (remote && branches && branches.length) {
            const branch = branches.find(b => b.name.replace(/^heads\//, '') === name);
            if (branch && branch.remote) {
                // Push the remote deletion.
                await this.execWithName(repository, ['push', branch.remote, `:${branch.upstreamWithoutRemote}`], 'deleteRemoteBranch');
            }
        }
    }

    protected async getBranches(repository: Repository, prefixes: string[]): Promise<Branch[]> {
        if (!prefixes || !prefixes.length) {
            prefixes = ['refs/heads', 'refs/remotes'];
        }
        // Branches are ordered by their commit date, in inverse chronological order. The first item is the most recent.
        const args = ['for-each-ref', `--format=${this.forEachRefFormat}`, '--sort=-committerdate', ...prefixes];
        const result = await this.execWithName(repository, args, 'getBranches');
        const names = result.stdout;
        const lines = names.split(this.delimiterString);

        // Remove the trailing newline.
        lines.splice(-1, 1);

        return lines.map((line: string, ix: number) => {
            // Preceding newline character after first row.
            const pieces = (ix > 0 ? line.substr(1) : line).split('\0');

            const ref = pieces[0];
            const name = pieces[1];
            const upstream = pieces[2];
            const sha = pieces[3];
            const author = this.parseIdentity(pieces[4]);
            const parentSHAs = pieces[5].split(' ');
            const summary = pieces[6];
            const body = pieces[7];

            const tip = { sha, summary, body, author, parentSHAs };

            const type = ref.startsWith('refs/head') ? BranchType.Local : BranchType.Remote;

            /** The name of the upstream's remote. */
            let remote: string | undefined;
            if (upstream.length !== 0) {
                const pieces2 = upstream.match(/(.*?)\/.*/);
                if (!!pieces2 && pieces2.length >= 2) {
                    remote = pieces2[1];
                }
            }

            /**
             * The name of the branch's upstream without the remote prefix.
             */
            let upstreamWithoutRemote: string | undefined;
            if (upstream.length !== 0) {
                upstreamWithoutRemote = this.removeRemotePrefix(upstream);
            }

            /**
             * The name of the branch without the remote prefix. If the branch is a local
             * branch, this is the same as its `name`.
             */
            let nameWithoutRemote: string;
            if (type === BranchType.Local) {
                nameWithoutRemote = name;
            } else {
                const withoutRemote = this.removeRemotePrefix(name);
                nameWithoutRemote = withoutRemote || name;
            }

            return {
                name,
                nameWithoutRemote,
                remote,
                type,
                upstream: upstream.length > 0 ? upstream : undefined,
                upstreamWithoutRemote,
                tip
            };

        });
    }

    async checkout(repository: Repository, options: Git.Options.Checkout.CheckoutBranch | Git.Options.Checkout.WorkingTreeFile): Promise<void> {
        const repositoryPath = this.getFsPath(repository);
        if (GitUtils.isBranchCheckout(options)) {
            const args = ['checkout', options.branch, '--'];
            await this.execWithName(repository, args, 'checkout');
            return;
        }
        if (GitUtils.isWorkingTreeFileCheckout(options)) {
            const paths = (Array.isArray(options.paths) ? options.paths : [options.paths]).map(FileUri.fsPath);
            const args = ['checkout', 'HEAD', '--'];
            args.push(...paths.map(p => Path.relative(repositoryPath, p)));
            await this.execWithName(repository, args, 'checkout');
            return;
        }
        return this.fail(repository, `Unexpected git checkout options: ${options}.`);
    }

    async commit(repository: Repository, message?: string, options?: Git.Options.Commit): Promise<void> {
        await this.ready.promise;
        const args = ['commit', '-F', '-'];
        if (options) {
            if (options.signOff) {
                args.push('-s');
            }
            if (options.amend) {
                args.push('--amend');
            }
        }
        const opts = {
            stdin: message || ''
        };

        try {
            await this.execWithName(repository, args, 'createCommit', opts);
        } catch (e) {
            // Commit failures could come from a pre-commit hook rejection. So display
            // a bit more context than we otherwise would.
            if (e instanceof GitError) {
                const output = e.result.stderr.trim();
                let standardError = '';
                if (output.length > 0) {
                    standardError = `, with output: '${output}'`;
                }
                const exitCode = e.result.exitCode;
                const error = new Error(`Commit failed - exit code ${exitCode} received${standardError}`);
                error.name = 'commit-failed';
                throw error;
            } else {
                throw e;
            }
        }
    }

    async fetch(repository: Repository, options?: Git.Options.Fetch): Promise<void> {
        const repositoryPath = this.getFsPath(repository);
        const remote = await this.getDefaultRemote(repositoryPath, options ? options.remote : undefined);
        if (remote) {
            const args = ['fetch', remote];
            await this.execWithName(repository, args, 'fetch');
        }
        this.fail(repository, 'No remote repository specified. Please, specify either a URL or a remote name from which new revisions should be fetched.');
    }

    async push(repository: Repository, { remote, localBranch, remoteBranch, setUpstream, force }: Git.Options.Push = {}): Promise<void> {
        const repositoryPath = this.getFsPath(repository);
        const currentRemote = await this.getDefaultRemote(repositoryPath, remote);
        if (currentRemote === undefined) {
            this.fail(repository, 'No configured push destination.');
        }
        const args = ['push'];

        let branchName: string;
        if (localBranch !== undefined) {
            branchName = localBranch;
        } else {
            const branch = await this.currentBranch(repository);
            if (branch === undefined) {
                return this.fail(repositoryPath, 'No current branch.');
            }
            branchName = branch.name;
        }

        if (force) {
            args.push('--force');
        }
        if (setUpstream) {
            args.push('--set-upstream');
        }
        args.push(
            currentRemote,
            remoteBranch ? `${branchName}:${remoteBranch}` : branchName,
        );
        await this.execWithName(repository, args, 'push');
    }

    async pull(repository: Repository, { remote, branch, rebase }: Git.Options.Pull = {}): Promise<void> {
        const repositoryPath = this.getFsPath(repository);
        const currentRemote = await this.getDefaultRemote(repositoryPath, remote);
        if (currentRemote === undefined) {
            this.fail(repository, 'No remote repository specified. Please, specify either a URL or a remote name from which new revisions should be fetched.');
        }
        const args = ['pull'];
        if (rebase) {
            args.push('-r');
        }
        args.push(currentRemote);
        if (branch) {
            args.push(branch);
        }
        await this.execWithName(repository, args, 'pull');
    }

    async reset(repository: Repository, options: Git.Options.Reset): Promise<void> {
        const args = ['reset'];
        switch (options.mode) {
            case 'hard': args.push('--hard');
            case 'soft': args.push('--soft');
            case 'mixed': args.push('--mixed');
        }
        const ref = options.ref ? options.ref : 'HEAD';
        args.push(ref, '--');
        await this.execWithName(repository, args, 'reset');
    }

    async merge(repository: Repository, options: Git.Options.Merge): Promise<void> {
        await this.execWithName(repository, ['merge', options.branch], 'merge');
    }

    /**
     * Retrieve the text (UTF-8) or binary contents of a file from the repository at a given
     * reference, commit, or tree.
     *
     * Returns a promise that will produce a Buffer instance containing
     * the text (UTF-8) or binary contents of the resource or an error if the file doesn't
     * exists in the given revision.
     *
     * @param repositoryPath - The repository from where to read the file. Or the FS path to the repository.
     * @param commitish  - A commit SHA or some other identifier that ultimately dereferences to a commit/tree. `HEAD` is the `HEAD`. If empty string, shows the index state.
     * @param path       - The absolute FS path which is contained in the repository.
     */
    async show(repository: Repository, uri: string, options?: Git.Options.Show): Promise<string> {
        await this.ready.promise;

        const encoding = options?.encoding || 'utf8';
        const processCallback: (process: ChildProcess) => void = cb => { if (cb.stdout) { cb.stdout.setEncoding(encoding); } };
        const commitish = this.getCommitish(options);
        const path = this.getFsPath(uri);
        const args = ['show'];
        if (encoding === 'binary') {
            args.push(`${commitish}:${path}`);
        } else {
            const repositoryPath = this.getFsPath(repository);
            args.push(`${commitish}:${upath.normalizeSafe(relative(repositoryPath, path))}`);
        }
        const contents = await this.execWithName(repository, args, 'getContents', { processCallback });
        return Buffer.from(contents.stdout, encoding).toString();
    }

    async stash(repository: Repository, options?: Readonly<{ action?: 'push', message?: string }>): Promise<void>;
    async stash(repository: Repository, options: Readonly<{ action: 'list' }>): Promise<StashEntry[]>;
    async stash(repository: Repository, options: Readonly<{ action: 'clear' }>): Promise<void>;
    async stash(repository: Repository, options: Readonly<{ action: 'apply' | 'pop' | 'drop', id?: string }>): Promise<void>;
    async stash(repository: Repository, options?: Git.Options.Stash): Promise<StashEntry[] | void> {
        try {
            const args: string[] = ['stash'];
            if (!options || (options && !options.action)) {
                args.push('push');
                if (options && options.message) {
                    args.push('-m', options.message);
                }
                await this.execWithName(repository, args, 'stash-push');
                return;
            }
            switch (options.action) {
                case 'push':
                    args.push('push');
                    if (options.message) {
                        args.push('-m', options.message);
                    }
                    await this.execWithName(repository, args, 'stash-push');
                    break;
                case 'apply':
                    args.push('apply');
                    if (options.id) {
                        args.push(options.id);
                    }
                    await this.execWithName(repository, args, 'stash-apply');
                    break;
                case 'pop':
                    args.push('pop');
                    if (options.id) {
                        args.push(options.id);
                    }
                    await this.execWithName(repository, args, 'stash-pop');
                    break;
                case 'list':
                    args.push('list');
                    const result = await this.execWithName(repository, args, 'stash-list');
                    const stashList = result.stdout !== '' ? result.stdout.trim().split('\n') : [];
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
                    args.push('drop');
                    if (options.id) {
                        args.push(options.id);
                    }
                    await this.execWithName(repository, args, 'stash-drop');
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

    async execWithName(repository: Repository, args: string[], name: string, options?: Git.Options.Execution): Promise<GitResult> {
        await this.ready.promise;
        const repositoryPath = this.getFsPath(repository);
        return this.manager.run(repository, async () => {
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

    async exec(repository: Repository, args: string[], options?: Git.Options.Execution): Promise<GitResult> {
        const name = options && options.name ? options.name : '';
        return this.execWithName(repository, args, name, options);
    }

    async diff(repository: Repository, options?: Git.Options.Diff): Promise<GitFileChange[]> {
        await this.ready.promise;
        const args = ['diff', '--name-status', '-C', '-M', '-z'];
        args.push(this.mapRange((options || {}).range));
        if (options && options.uri) {
            const relativePath = Path.relative(this.getFsPath(repository), this.getFsPath(options.uri));
            args.push(...['--', relativePath !== '' ? relativePath : '.']);
        }
        const result = await this.execWithName(repository, args, 'diff');
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
        let result = await this.execWithName(repository, args, 'log', { successExitCodes });
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
            result = await this.execWithName(repository, args, 'log');
        }

        return this.commitDetailsParser.parse(
            repository.localUri, result.stdout.trim()
                .split(CommitDetailsParser.COMMIT_CHUNK_DELIMITER)
                .filter(item => item && item.length > 0));
    }

    async revParse(repository: Repository, options: Git.Options.RevParse): Promise<string | undefined> {
        const ref = options.ref;
        const successExitCodes = [0, 128];
        const result = await this.execWithName(repository, ['rev-parse', ref], 'rev-parse', { successExitCodes });
        if (result.exitCode === 0) {
            return result.stdout; // sha
        }
    }

    async blame(repository: Repository, uri: string, options?: Git.Options.Blame): Promise<GitFileBlame | undefined> {
        await this.ready.promise;
        const args = ['blame', '--root', '--incremental'];
        const file = Path.relative(this.getFsPath(repository), this.getFsPath(uri));

        const statusResult = await this.execWithName(
            repository,
            ['status', '--untracked-files=all', '--porcelain=2', '-z', file],
            'status-for-blame'
        );
        const statusLines = statusResult.stdout.split('\0');
        const fileIsUncommitted = statusLines.some(line => line.startsWith('1 A') || line.startsWith('?'));
        if (fileIsUncommitted) {
            return undefined;
        }

        const stdin = options ? options.content : undefined;
        if (stdin) {
            args.push('--contents', '-');
        }
        const gitResult = await this.execWithName(repository, [...args, '--', file], 'blame', { stdin });
        const output = gitResult.stdout.trim();
        const commitBodyReader = async (sha: string) => {
            if (GitBlameParser.isUncommittedSha(sha)) {
                return '';
            }
            const revResult = await this.execWithName(repository, ['rev-list', '--format=%B', '--max-count=1', sha], 'rev-list-for-blame');
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
            const expectedErrors = [GitErrorCode.OutsideRepository];
            const result = await this.execWithName(repository, args, 'ls-files', { successExitCodes, expectedErrors });
            const { exitCode } = result;
            return exitCode === 0;
        }
    }

    protected async getGitVersion(repository: Repository): Promise<{ major: number, minor: number }> {
        await this.ready.promise;
        const args = ['--version'];
        const result = await this.execWithName(repository, args, 'version');
        const version = (result.stdout || '').trim();

        const parsed = version.replace(/^git version /, '');
        const [rawMajor, rawMinor] = parsed.split('.');
        if (rawMajor && rawMinor) {
            const major = parseInt(rawMajor, 10);
            const minor = parseInt(rawMinor, 10);
            if (Number.isInteger(major) && Number.isInteger(minor)) {
                return { major, minor };
            }
        }

        throw new Error(`Git version string is not valid: ${parsed}`);
    }

    private getCommitish(options?: Git.Options.Show): string {
        if (options && options.commitish) {
            return 'index' === options.commitish ? '' : options.commitish;
        }
        return '';
    }

    // TODO: akitta what about symlinks? What if the workspace root is a symlink?
    // Maybe, we should use `--show-cdup` here instead of `--show-toplevel` because `show-toplevel` dereferences symlinks.
    private async resolveContainingPath(repositoryPath: string): Promise<string | undefined> {
        await this.ready.promise;
        // Do not log an error if we are not contained in a Git repository. Treat exit code 128 as a success too.
        const [exec, env] = await Promise.all([this.execProvider.exec(), this.gitEnv.promise]);
        const options = { successExitCodes: new Set([0, 128]), exec, env };
        const result = await git(['rev-parse', '--show-toplevel'], repositoryPath, 'rev-parse', options);
        const out = result.stdout;
        if (out && out.length !== 0) {
            try {
                return fs.realpathSync(out.trim());
            } catch (e) {
                this.logger.error(e);
                return undefined;
            }
        }
        return undefined;
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

    /**
     * Parses a Git ident string (GIT_AUTHOR_IDENT or GIT_COMMITTER_IDENT)
     * into a commit identity. Returns null if string could not be parsed.
     */
    private parseIdentity(identity: string): CommitIdentity {
        // See fmt_ident in ident.c:
        //  https://github.com/git/git/blob/3ef7618e6/ident.c#L346
        //
        // Format is "NAME <EMAIL> DATE"
        //  Markus Olsson <j.markus.olsson@gmail.com> 1475670580 +0200
        //
        // Note that `git var` will strip any < and > from the name and email, see:
        //  https://github.com/git/git/blob/3ef7618e6/ident.c#L396
        //
        // Note also that this expects a date formatted with the RAW option in git see:
        //  https://github.com/git/git/blob/35f6318d4/date.c#L191
        //
        const m = identity.match(/^(.*?) <(.*?)> (\d+) (\+|-)?(\d{2})(\d{2})/);
        if (!m) {
            throw new Error(`Couldn't parse author identity ${identity}.`);
        }

        const name = m[1];
        const email = m[2];
        // The date is specified as seconds from the epoch,
        // Date() expects milliseconds since the epoch.
        const date = new Date(parseInt(m[3], 10) * 1000);

        // The RAW option never uses alphanumeric timezone identifiers and in my
        // testing I've never found it to omit the leading + for a positive offset
        // but the docs for strprintf seems to suggest it might on some systems so
        // we're playing it safe.
        const tzSign = m[4] === '-' ? '-' : '+';
        const tzHH = m[5];
        const tzmm = m[6];

        const tzMinutes = parseInt(tzHH, 10) * 60 + parseInt(tzmm, 10);
        const tzOffset = tzMinutes * (tzSign === '-' ? -1 : 1);

        const timestamp = date.toISOString();
        return { name, email, timestamp, tzOffset };
    }

    /**
     * Remove the remote prefix from the string. If there is no prefix, returns
     * `undefined`. E.g.:
     *
     *  origin/my-branch       -> my-branch
     *  origin/thing/my-branch -> thing/my-branch
     *  my-branch              -> undefined
     */
    private removeRemotePrefix(name: string): string | undefined {
        const pieces = name.match(/.*?\/(.*)/);
        if (!pieces || pieces.length < 2) {
            return undefined;
        }
        return pieces[1];
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
