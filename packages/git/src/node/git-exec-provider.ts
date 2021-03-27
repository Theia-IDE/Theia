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

import { injectable } from 'inversify';
import { Disposable, MaybePromise } from '@theia/core/';
import * as fs from 'fs';
import * as Path from 'path';
import findGit from 'find-git-exec';
import {
    GitProcess,
    IGitResult as DugiteResult,
    GitError as DugiteError,
    IGitExecutionOptions as DugiteExecutionOptions,
    RepositoryDoesNotExistErrorCode,
    GitNotFoundErrorCode
} from 'dugite-no-gpl';

/* eslint-disable no-null/no-null, @typescript-eslint/no-explicit-any */

/**
 * Provides an execution function that will be used to perform the Git commands.
 * This is the default, `NOOP`, provider and always resoles to `undefined`.
 *
 * If you would like to use, for instance, Git over SSH, you could rebind this default provider and have something like this:
 * ```typescript
 * @injectable()
 * export class GitSshExecProvider extends GitExecProvider {
 *
 *     // eslint-disable-next-line @typescript-eslint/no-explicit-any
 *     protected deferred = new Deferred<any>();
 *
 *     @postConstruct()
 *     protected async init(): Promise<void> {
 *         const connection = await new SSH().connect({
 *             host: 'your-host',
 *             username: 'your-username',
 *             password: 'your-password'
 *         });
 *         const { stdout } = await connection.execCommand('which git');
 *         process.env.LOCAL_GIT_PATH = stdout.trim();
 *         this.deferred.resolve(connection);
 *     }
 *
 *     async exec(): Promise<IGitExecutionOptions.ExecFunc> {
 *         const connection = await this.deferred.promise;
 *         const gitPath = process.env.LOCAL_GIT_PATH;
 *         if (!gitPath) {
 *             throw new Error("The 'LOCAL_GIT_PATH' must be set.");
 *         }
 *         return async (
 *             args: string[],
 *             options: { cwd: string, stdin?: string },
 *             callback: (error: Error | null, stdout: string, stderr: string) => void) => {
 *
 *             const command = `${gitPath} ${args.join(' ')}`;
 *             const { stdout, stderr, code } = await connection.execCommand(command, options);
 *             // eslint-disable-next-line no-null/no-null
 *             let error: Error | null = null;
 *             if (code) {
 *                 error = new Error(stderr || `Unknown error when executing the Git command. ${args}.`);
 *                 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 *                 (error as any).code = code;
 *             }
 *             callback(error, stdout, stderr);
 *         };
 *     }
 *
 *     dispose(): void {
 *         super.dispose();
 *         // Dispose your connection.
 *         this.deferred.promise.then(connection => {
 *             if (connection && 'dispose' in connection && typeof connection.dispose === 'function') {
 *                 connection.dispose();
 *             }
 *         });
 *     }
 *
 * }
 * ```
 */
@injectable()
export class GitExecProvider implements Disposable {

    /**
     * Provides a function that will be used to execute the Git commands. If resolves to `undefined`, then
     * the embedded Git executable will be used from [dugite](https://github.com/desktop/dugite).
     */
    exec(): MaybePromise<IGitExecutionOptions.ExecFunc | undefined> {
        return undefined;
    }

    dispose(): void {
        // NOOP
    }

}

const __GIT_PATH__: { gitDir: string | undefined, gitExecPath: string | undefined, searched: boolean } = { gitDir: undefined, gitExecPath: undefined, searched: false };

/**
 * An extension of the execution options in dugite that
 * allows us to piggy-back our own configuration options in the
 * same object.
 */
export interface IGitExecutionOptions extends DugiteExecutionOptions {
    /**
     * The exit codes which indicate success to the
     * caller. Unexpected exit codes will be logged and an
     * error thrown. Defaults to 0 if undefined.
     */
    readonly successExitCodes?: ReadonlySet<number>

    /**
     * The git errors which are expected by the caller. Unexpected errors will
     * be logged and an error thrown.
     */
    readonly expectedErrors?: ReadonlySet<DugiteError>

    /**
     * `path` is equivalent to `cwd`.
     * If the `exec` function is set:
     *   - then this will be called instead of the `child_process.execFile`. Clients will **not** have access to the `stdin`.
     *   - then the `USE_LOCAL_GIT` must be set to `"true"`. Otherwise, an error will be thrown.
     *   - the all other properties defined by this option will be ignored except the `env` property.
     */
    readonly exec?: IGitExecutionOptions.ExecFunc;
}

export namespace IGitExecutionOptions {
    export type ExecFunc = (args: string[], options: { cwd: string, stdin?: string }, callback: (error: Error | null, stdout: string, stderr: string) => void) => void;
}

/**
 * The result of using `git`. This wraps dugite's results to provide
 * the parsed error if one occurs.
 */
export interface IGitResult extends DugiteResult {
    /**
     * The parsed git error. This will be undefined when the exit code is include in
     * the `successExitCodes`, or when dugite was unable to parse the
     * error.
     */
    readonly gitError: DugiteError | undefined

    /** The human-readable error description, from which `gitError` was determined. */
    readonly gitErrorDescription: string | undefined
}

function getResultMessage(result: IGitResult): string {
    const description = result.gitErrorDescription;
    if (description) {
        return description;
    }

    if (result.stderr.length) {
        return result.stderr;
    } else if (result.stdout.length) {
        return result.stdout;
    } else {
        return 'Unknown error';
    }
}

export class GitError extends Error {
    /** The result from the failed command. */
    public readonly result: IGitResult;

    /** The args for the failed command. */
    public readonly args: ReadonlyArray<string>;

    public constructor(result: IGitResult, args: ReadonlyArray<string>) {
        super(getResultMessage(result));

        this.name = 'GitError';
        this.result = result;
        this.args = args;
    }
}

function pathExists(path?: string): Boolean {
    if (path === undefined) {
        return false;
    }
    try {
        fs.accessSync(path, (fs as any).F_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * `path` is the `pwd` where the Git command gets executed.
 */
function gitExternal(args: string[], path: string, options: IGitExecutionOptions): Promise<DugiteResult> {
    if (options.exec === undefined) {
        throw new Error('options.exec must be defined.');
    }
    // XXX: this is just to keep the original code from here https://github.com/desktop/dugite/blob/master/lib/git-process.ts#L172-L227
    const maxBuffer = options.maxBuffer ? options.maxBuffer : 10 * 1024 * 1024;
    const { exec } = options;
    return new Promise<DugiteResult>((resolve, reject) => {
        let stdin: string | undefined = undefined;
        if (options.stdin !== undefined) {
            if (typeof options.stdin === 'string') {
                stdin = options.stdin;
            } else {
                stdin = options.stdin.toString('utf8');
            }
        }
        exec(args, { cwd: path, stdin }, (err: Error | null, stdout: string, stderr: string) => {
            if (!err) {
                resolve({ stdout, stderr, exitCode: 0 });
                return;
            }

            const errWithCode = err as (Error & { code: number | string | undefined });

            let code = errWithCode.code;

            // If the error's code is a string then it means the code isn't the
            // process's exit code but rather an error coming from Node's bowels,
            // e.g., ENOENT.
            if (typeof code === 'string') {
                if (code === 'ENOENT') {
                    let message = err.message;
                    if (pathExists(process.env.LOCAL_GIT_DIRECTORY) === false) {
                        message = 'Unable to find path to repository on disk.';
                        code = RepositoryDoesNotExistErrorCode;
                    } else {
                        message = `Git could not be found at the expected path: '${process.env.LOCAL_GIT_DIRECTORY
                            }'. This might be a problem with how the application is packaged, so confirm this folder hasn't been removed when packaging.`;
                        code = GitNotFoundErrorCode;
                    }

                    const error = new Error(message) as (Error & { code: number | string | undefined });
                    error.name = err.name;
                    error.code = code;
                    reject(error);
                } else {
                    reject(err);
                }

                return;
            }

            if (typeof code === 'number') {
                resolve({ stdout, stderr, exitCode: code });
                return;
            }

            // Git has returned an output that couldn't fit in the specified buffer
            // as we don't know how many bytes it requires, rethrow the error with
            // details about what it was previously set to...
            if (err.message === 'stdout maxBuffer exceeded') {
                reject(
                    new Error(
                        `The output from the command could not fit into the allocated stdout buffer. Set options.maxBuffer to a larger value than ${maxBuffer
                        } bytes`
                    )
                );
            } else {
                reject(err);
            }
        });
    });
}

/**
 * Shell out to git with the given arguments, at the given path.
 *
 * @param {args}             The arguments to pass to `git`.
 *
 * @param {path}             The working directory path for the execution of the
 *                           command.
 *
 * @param {name}             The name for the command based on its caller's
 *                           context. This will be used for performance
 *                           measurements and debugging.
 *
 * @param {options}          Configuration options for the execution of git,
 *                           see IGitExecutionOptions for more information.
 *
 * Returns the result. If the command exits with a code not in
 * `successExitCodes` or an error not in `expectedErrors`, a `GitError` will be
 * thrown.
 */
export async function git(args: string[], path: string, name: string, options?: IGitExecutionOptions): Promise<IGitResult> {

    if (
        options
        && options.exec
        && (typeof process.env.LOCAL_GIT_PATH === 'undefined')) {
        throw new Error('LOCAL_GIT_PATH must be specified when using an exec function.');
    }

    const defaultOptions: IGitExecutionOptions = {
        successExitCodes: new Set([0]),
        expectedErrors: new Set(),
    };

    const opts = { ...defaultOptions, ...options };
    let result: DugiteResult;
    if (options && options.exec) {
        result = await gitExternal(args, path, options);
    } else {
        await initGitEnv();
        await configureGitEnv();
        result = await GitProcess.exec(args, path, options);
    }

    const exitCode = result.exitCode;

    let gitError: DugiteError | undefined = undefined;
    let gitErrorDescription: string | undefined = undefined;
    const acceptableExitCode = opts.successExitCodes ? opts.successExitCodes.has(exitCode) : false;
    if (!acceptableExitCode) {
        gitError = GitProcess.parseError(result.stderr) || undefined;
        if (gitError) {
            gitErrorDescription = result.stderr;
        } else {
            gitError = GitProcess.parseError(result.stdout) || undefined;
            if (gitError) {
                gitErrorDescription = result.stdout;
            }
        }
    }

    const gitResult = { ...result, gitError, gitErrorDescription };

    let acceptableError = true;
    if (gitError && opts.expectedErrors) {
        acceptableError = opts.expectedErrors.has(gitError);
    }

    if ((gitError && acceptableError) || acceptableExitCode) {
        return gitResult;
    }

    console.error(`The command \`git ${args.join(' ')}\` exited with an unexpected code: ${exitCode}. The caller should either handle this error, or expect that exit code.`);
    if (result.stdout.length) {
        console.error(result.stdout);
    }

    if (result.stderr.length) {
        console.error(result.stderr);
    }

    if (gitError) {
        console.error(`(The error was parsed as ${gitError}: ${gitErrorDescription})`);
    }

    throw new GitError(gitResult, args);
}

async function initGitEnv(): Promise<void> {
    if (process.env.USE_LOCAL_GIT === 'true' && !process.env.LOCAL_GIT_DIRECTORY && !process.env.GIT_EXEC_PATH && !__GIT_PATH__.searched) {
        console.log("'USE_LOCAL_GIT' is set to true. Trying to use local Git for 'dugite' execution.");
        try {
            const gitInfo = await findGit();
            if (gitInfo && gitInfo.path && gitInfo.execPath) {
                // We need to traverse up two levels to get the expected Git directory.
                // `dugite` expects the directory path instead of the executable path.
                // https://github.com/desktop/dugite/issues/111
                const gitDir = Path.dirname(Path.dirname(gitInfo.path));
                if (fs.existsSync(gitDir) && fs.existsSync(gitInfo.execPath)) {
                    __GIT_PATH__.gitDir = gitDir;
                    __GIT_PATH__.gitExecPath = gitInfo.execPath;
                    console.log(`Using external Git executable. Git path: ${gitInfo.path}. Git exec-path: ${gitInfo.execPath}. [Version: ${gitInfo.version}]`);
                } else {
                    throw new Error(`Cannot find local Git executable: ${gitInfo}.`);
                }
            }
        } catch (error) {
            console.error('Cannot find local Git executable.', error);
            __GIT_PATH__.gitDir = undefined;
            __GIT_PATH__.gitExecPath = undefined;
        } finally {
            __GIT_PATH__.searched = true;
        }
    }
}

async function configureGitEnv(): Promise<void> {
    if (process.env.USE_LOCAL_GIT === 'true'
        && !process.env.LOCAL_GIT_DIRECTORY
        && !process.env.GIT_EXEC_PATH
        && __GIT_PATH__.searched
        && __GIT_PATH__.gitDir
        && __GIT_PATH__.gitExecPath) {

        process.env.LOCAL_GIT_DIRECTORY = __GIT_PATH__.gitDir;
        process.env.GIT_EXEC_PATH = __GIT_PATH__.gitExecPath;
    }
}
