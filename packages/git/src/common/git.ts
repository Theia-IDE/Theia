/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
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

import { ChildProcess } from 'child_process';
import { Disposable } from '@theia/core';
import {
    Repository, WorkingDirectoryStatus, Branch, GitResult, GitError, GitFileStatus,
    GitFileChange, CommitWithChanges, GitFileBlame, Remote as RemoteModel, StashEntry
} from './git-model';

/**
 * The WS endpoint path to the Git service.
 */
export const GitPath = '/services/git';

/**
 * Git symbol for DI.
 */
export const Git = Symbol('Git');

export namespace Git {

    /**
     * Options for various Git commands.
     */
    export namespace Options {

        /**
         * Refinements for the `git branch` command.
         */
        export namespace BranchCommand {

            /**
             * Option for listing branches in a Git repository.
             */
            export interface List {

                /**
                 * The type of the branches that has to be listed. If not
                 *  - `current` returns with the name of the currently active branch.
                 *  - `local` lists all locally available branch names.
                 *  - `remote` for listing all remote branches. One might has to perform a `git fetch` to integrate all the remote branches.
                 *  - `all` lists all remote and local branches including the currently active one.
                 */
                readonly type: 'current' | 'local' | 'remote' | 'all';

            }

            /**
             * Option for creating a new branch.
             */
            export interface Create {

                /**
                 * The desired name of the new branch.
                 */
                readonly toCreate: string;

                /**
                 * The new branch head will point to this commit. It may be given as a branch name, a commit-id, or a tag.
                 * If this option is omitted, the current `HEAD` will be used instead.
                 */
                readonly startPoint?: string;

            }

            /**
             * Option for deleting a branch. The branch must be fully merged in its upstream branch, or in `HEAD` if no upstream was set.
             */
            export interface Delete {

                /**
                 * The name of the branch to delete.
                 */
                readonly toDelete: string;

                /**
                 * When set to `true`, then allows deleting the branch irrespective of its merged status. `false` by default.
                 */
                readonly force?: boolean;

                /**
                 * When set to `true` then deletes the remote-tracking branches as well. It is `false` by default.
                 */
                readonly remote?: boolean;

            }

            /**
             * Option for renaming an existing branch.
             */
            export interface Rename {

                /**
                 * The desired new name of the branch.
                 */
                readonly newName: string;

                /**
                 * The name of the branch to rename. If not given, then the currently active branch will be renamed.
                 */
                readonly oldName?: string;

                /**
                 * If set to `true`, the allows renaming the branch even if the new branch name already exists. It is `false` by default.
                 */
                readonly force?: boolean;

            }

        }

        /**
         * Git clone options.
         */
        export interface Clone {

            /**
             * The desired destination path (given as a URI) for the cloned repository.
             * If the path does not exist it will be created. Cloning into an existing
             * directory is only allowed if the directory is empty.
             */
            readonly localUri: string;

            /**
             * The branch to checkout after the clone has completed. If not given,
             * the default branch will will be the current one which is usually the `master`.
             */
            readonly branch?: string;

        }

        /**
         * Git repositories options.
         */
        export interface Repositories {

            /**
             * The maximum count of repositories to look up, should be greater than 0.
             * Undefined to look up all repositories.
             */
            readonly maxCount?: number;

        }

        /**
         * Further refinements for unstaging files from either from the index or from the working-tree. Alternatively, resetting both.
         */
        export interface Unstage {

            /**
             * What to reset; the state of the index, the working-tree, or both. If not given, `all` will be used.
             */
            readonly reset?: 'index' | 'working-tree' | 'all';

            /**
             * The treeish to reset to. Defaults to `HEAD`.
             */
            readonly treeish?: string;

        }

        /**
         * Options for further `git checkout` refinements.
         */
        export namespace Checkout {

            /**
             * Options for checking out branches.
             */
            export interface CheckoutBranch {

                /**
                 * Branch to checkout; if it refers to a branch, then that branch is checked out.
                 * Otherwise, if it refers to a valid commit, your `HEAD` becomes "detached" and you are no
                 * longer on any branch.
                 */
                readonly branch: string;

                /**
                 * When switching branches, proceed even if the index or the working tree differs from `HEAD`.
                 * This is used to throw away local changes.
                 */
                readonly force?: boolean;

                /**
                 * When switching branches, if you have local modifications to one or more files that are different
                 * between the current branch and the branch to which you are switching, the command refuses to
                 * switch branches in order to preserve your modifications in context. However, with this option,
                 * a three-way merge between the current branch, your working tree contents, and the new branch is done,
                 * and you will be on the new branch.
                 */
                readonly merge?: boolean;

                /**
                 * The name for the new local branch.
                 */
                readonly newBranch?: string;

            }

            /**
             * Options for checking out files from the working tree.
             *
             *  - When trying to revert a resource to the state of the index, set `paths`.
             *  - When trying to revert the state of a resource to the repository `HEAD`, then set `paths` and `treeish` to `HEAD`.
             *  - If you would like to check out the state of a file from the `HEAD` of a branch, set `treeish` to `nameOfTheBranch`.
             *  - And if you would like to check out a historical revision of a branch, set `treeish` to `nameOfTheBranch~2` which will be
             *      two commits before the most recent one on the desired branch.
             */
            export interface WorkingTreeFile {

                /**
                 * This is used to restore modified or deleted paths to their original contents from the index or replace
                 * paths with the contents from a named tree-ish (most often a commit-ish).
                 *
                 * One can specify a regular expression for the paths, in such cases, it must be escaped with single-quotes.
                 * For instance checking out a `Hello.ts` file will be simply `"Hello.ts"`, if one would like to checkout
                 * all TS files, then this for should be used: ```ts
                 * const options = {
                 *   paths: `'*.ts'`
                 * }
                 * ```.
                 */
                readonly paths: string | string[];

                /**
                 * When checking out paths from the index, do not fail upon unmerged entries; instead, unmerged
                 * entries are ignored.
                 */
                readonly force?: boolean;

                /**
                 * When checking out paths from the index, this option lets you recreate the conflicted merge in the
                 * specified paths.
                 */
                readonly merge?: boolean;

                /**
                 * Tree to checkout from. If not specified, the index will be used. `git checkout -- ./fileName.ext`.
                 * If you want to get the state from the repository ,use `HEAD` which will be equivalent with `git checkout HEAD -- ./fileName.ext`.
                 */
                readonly treeish?: string;

            }

        }

        /**
         * Options for the `git commit` command refinement.
         */
        export interface Commit {

            /**
             * If `true` replaces the tip of the current branch by creating a new commit.
             * The recorded tree is prepared as usual, and the message from the original commit is used as the starting point, instead of an empty message,
             * when no other message is specified. The new commit has the same parents and author as the current one. Defaults to `false`.
             */
            readonly amend?: boolean;

            /**
             * Adds the `Signed-off-by` line by the committer at the end of the commit log message. `false` by default.
             */
            readonly signOff?: boolean;

        }

        /**
         * Options for further refining the `git show` command.
         */
        export interface Show {

            /**
             * The desired encoding which should be used when retrieving the file content.
             * `utf8` should be used for text content and `binary` for blobs. The default one is `utf8`.
             */
            readonly encoding?: 'utf8' | 'binary';

            /**
             * A commit SHA or some other identifier that ultimately dereferences to a commit/tree.
             * `HEAD` is the local `HEAD`, and `index` is the the staged. If not specified,
             * then `index` will be used instead. But this can be `HEAD~2` or `ed14ef1~1` where `ed14ef1` is a commit hash.
             */
            readonly commitish?: 'index' | string;

        }

        /**
         * Options for further refining the `git stash` command.
         */
        export interface Stash {
            /**
             * The kind of stash action.
             */
            readonly action?: 'push' | 'apply' | 'pop' | 'list' | 'drop' | 'clear';

            /**
             * The stash id.
             * This is an optional argument for actions of kind 'apply', 'pop' and 'drop'.
             */
            readonly id?: string;

            /**
             * The stash message.
             * This is an optional argument for the `push` action.
             */
            readonly message?: string;
        }

        /**
         * Options for the `git fetch` command.
         */
        export interface Fetch {

            /**
             * The name of the remote to fetch from. If not given, then the default remote will be used. Defaults to the `origin`.
             */
            readonly remote?: string;

        }

        /**
         * Further refinements for the `git push` command.
         */
        export interface Push {

            /**
             * The name of the remote to push to. If not given, then the default remote will be used. It is the `origin` by default.
             */
            readonly remote?: string;

            /**
             * The name of the local branch to push. If not given, then the currently active branch will be used instead.
             */
            readonly localBranch?: string;

            /**
             * The name of the remote branch to push to. If not given then the changes will be pushed to the remote branch associated with the
             * local branch.
             *
             * `git push <remote> <localBranch>:<remoteBranch>`
             */
            readonly remoteBranch?: string;

            /**
             * Set upstream for every branch that is up to date or successfully pushed,
             * add upstream (tracking) reference, used by argument-less git-pull and other commands.
             */
            readonly setUpstream?: boolean;

            /**
             * Usually, the command refuses to update a remote ref that is not an ancestor of the local ref used to overwrite it.
             * This flag disables these checks, and can cause the remote repository to lose commits; use it with care.
             */
            readonly force?: boolean;

        }

        /**
         * Options for the `git pull` command.
         */
        export interface Pull {

            /**
             * The name of the remote to pull from. If not given, then the default remote will be used. Defaults to the `origin`.
             */
            readonly remote?: string;

            /**
             * The name of the branch to pull form. This is required when one performs a `git pull` from a remote which is not
             * the default remote tracking of the currently active branch.
             */
            readonly branch?: string;

            /**
             * When true, rebase the current branch on top of the upstream branch after fetching.
             */
            readonly rebase?: boolean

        }

        /**
         * Additional technical rectifications for the `git reset` command.
         */
        export interface Reset {

            /**
             * The `git reset` mode. The followings are supported:
             *  - `hard`,
             *  - `sort`, or
             *  - `mixed`.
             *
             * Those correspond to the consecutive `--hard`, `--soft`, and `--mixed` Git options.
             */
            readonly mode: 'hard' | 'soft' | 'mixed';

            /**
             * The reference to reset to. By default, resets to `HEAD`.
             */
            readonly ref?: string;

        }

        /**
         * Additional options for the `git merge` command.
         */
        export interface Merge {

            /**
             * The name of the branch that should be merged into the current branch.
             */
            readonly branch: string;

        }

        /**
         * A set of configuration options that can be passed when executing a low-level Git command.
         */
        export interface Execution {

            /**
             * The exit codes which indicate success to the caller. Unexpected exit codes will be logged and an
             * error thrown. Defaults to `0` if `undefined`.
             */
            readonly successExitCodes?: ReadonlyArray<number>;

            /**
             * The Git errors which are expected by the caller. Unexpected errors will
             * be logged and an error thrown.
             */
            readonly expectedErrors?: ReadonlyArray<GitError>;

            /**
             * An optional collection of key-value pairs which will be
             * set as environment variables before executing the Git
             * process.
             */
            readonly env?: Object;

            /**
             * An optional string which will be written to the child process
             * stdin stream immediately after spawning the process.
             */
            readonly stdin?: string;

            /**
             * The encoding to use when writing to `stdin`, if the `stdin`
             * parameter is a string.
             */
            readonly stdinEncoding?: string;

            /**
             * The size the output buffer to allocate to the spawned process. Set this
             * if you are anticipating a large amount of output.
             *
             * If not specified, this will be 10MB (10485760 bytes) which should be
             * enough for most Git operations.
             */
            readonly maxBuffer?: number;

            /**
             * An optional callback which will be invoked with the child
             * process instance after spawning the Git process.
             *
             * Note that if the `stdin` parameter was specified the `stdin`
             * stream will be closed by the time this callback fires.
             *
             * Defining this property could make the `exec` function invocation **non-client** compatible.
             */
            readonly processCallback?: (process: ChildProcess) => void;

            /**
             * The name for the command based on its caller's context.
             * This could be used only for performance measurements and debugging. It has no runtime behavior effects.
             */
            readonly name?: string;

        }

        /**
         * Range that is used for representing to individual commitish when calculating either `git log` or `git diff`.
         */
        export interface Range {

            /**
             * The last revision that should be included among the result running this query. Here, the revision can be a tag, a commitish,
             * or even an expression (`HEAD~3`). For more details to specify the revision, see [here](https://git-scm.com/docs/gitrevisions#_specifying_revisions).
             */
            readonly toRevision?: string;

            /**
             * Either the from revision (`string`) or a positive integer that is equivalent to the `~` suffix, which means the commit object that is the `fromRevision`<sup>th</sup>
             * generation ancestor of the named, `toRevision` commit object, following only the first parents. If not specified, equivalent to `origin..toRevision`.
             */
            readonly fromRevision?: number | string;

        }

        /**
         * Optional configuration for the `git diff` command.
         */
        export interface Diff {

            /**
             * The Git revision range that will be used when calculating the diff.
             */
            readonly range?: Range;

            /**
             * The URI of the resource in the repository to get the diff. Can be an individual file or a directory.
             */
            readonly uri?: string;

        }

        /**
         * Optional configuration for the `git log` command.
         */
        export interface Log extends Diff {

            /**
             * The name of the branch to run the `git log` command. If not specified, then the currently active branch will be used.
             */
            readonly branch?: string;

            /**
             * Limits the number of commits. Also known as `-n` or `--number. If not specified, or not a positive integer, then will be ignored, and the returning list
             * of commits will not be limited.
             */
            readonly maxCount?: number;

            /**
             * Decides whether the commit hash should be the abbreviated version.
             */
            readonly shortSha?: boolean;
        }

        /**
         * Optional configuration for the `git blame` command.
         */
        export interface Blame {
            /**
             * Dirty state content.
             */
            readonly content?: string;
        }

        /**
         * Further refinements for the `git ls-files`.
         */
        export interface LsFiles {

            /**
             * If any the file does not appear in the index, treat this as an error that results in the error code 1.
             */
            readonly errorUnmatch?: true;

        }

        /**
         * Options for the `git remote` command.
         */
        export interface Remote {

            /**
             * Be more verbose and get remote url for `fetch` and `push` actions.
             */
            readonly verbose?: true,

        }

        /**
         * Options for the `git rev-parse` command.
         */
        export interface RevParse {

            /**
             * The reference to parse.
             */
            readonly ref: string;

        }

    }
}

/**
 * Provides basic functionality for Git.
 */
export interface Git extends Disposable {

    gitIsReady(): Promise<void>;

    getGitEnv(): Promise<Object>;

    /**
     * Clones a remote repository into the desired local location.
     *
     * @param remoteUrl the URL of the remote.
     * @param options the clone options.
     */
    clone(remoteUrl: string, options: Git.Options.Clone): Promise<Repository>;

    /**
     * Returns with the working directory status of the given Git repository.
     *
     * @param the repository to get the working directory status from.
     */
    status(repository: Repository): Promise<WorkingDirectoryStatus>;

    /**
     * Stages the given file or files in the working clone. The invocation will be rejected if
     * any files (given with their file URIs) is not among the changed files.
     *
     * @param repository the repository to stage the files.
     * @param uri one or multiple file URIs to stage in the working clone.
     */
    add(repository: Repository, uri: string | string[]): Promise<void>;

    /**
     * Removes the given file or files among the staged files in the working clone. The invocation will be rejected if
     * any files (given with their file URIs) is not among the staged files.
     *
     * @param repository the repository to where the staged files have to be removed from.
     * @param uri one or multiple file URIs to unstage in the working clone. If the array is empty, all the changed files will be staged.
     * @param options optional refinements for the the unstaging operation.
     */
    unstage(repository: Repository, uri: string | string[], options?: Git.Options.Unstage): Promise<void>;

    /**
     * Returns with the currently active branch, or `undefined` if the current branch is in detached mode.
     *
     * @param the repository where the current branch has to be queried.
     * @param options the type of the branch, which is always the `current`.
     */
    branch(repository: Repository, options: { type: 'current' }): Promise<Branch | undefined>;

    /**
     * Returns with an array of branches.
     *
     * @param the repository where the branches has to be queried.
     * @param options the type of the branch, which is either the `local`, the `remote`, or `all` of them.
     */
    branch(repository: Repository, options: { type: 'local' | 'remote' | 'all' }): Promise<Branch[]>;

    /**
     * Creates, renames, and deletes a branch.
     *
     * @param the repository where the branch modification has to be performed.
     * @param options further Git command refinements for the branch modification.
     */
    /* eslint-disable @typescript-eslint/indent */
    branch(repository: Repository, options:
        Git.Options.BranchCommand.Create |
        Git.Options.BranchCommand.Rename |
        Git.Options.BranchCommand.Delete
    ): Promise<void>;
    /* eslint-enable @typescript-eslint/indent */

    /**
     * Switches branches or restores working tree files.
     *
     * @param repository the repository to where the `git checkout` has to be performed.
     * @param options further checkout options.
     */
    checkout(repository: Repository, options: Git.Options.Checkout.CheckoutBranch | Git.Options.Checkout.WorkingTreeFile): Promise<void>;

    /**
     * Commits the changes of all staged files in the working directory.
     *
     * @param repository the repository where the staged changes has to be committed.
     * @param message the optional commit message.
     */
    commit(repository: Repository, message?: string, options?: Git.Options.Commit): Promise<void>;

    /**
     * Fetches branches and/or tags (collectively, `refs`) from the repository, along with the objects necessary to complete their histories.
     * The remotely-tracked branches will be updated too.
     *
     * @param repository the repository to fetch from.
     * @param options optional options for `git fetch` refinement.
     */
    fetch(repository: Repository, options?: Git.Options.Fetch): Promise<void>;

    /**
     * Updates the `refs` using local `refs`, while sending objects necessary to complete the given `refs` by pushing
     * all committed changed from the local Git repository to the `remote` one.
     *
     * @param repository the repository to push to.
     * @param options optional refinements for the `git push` command.
     */
    push(repository: Repository, options?: Git.Options.Push): Promise<void>;

    /**
     * Fetches from and integrates with another repository. It incorporates changes from a repository into the current branch.
     * In its default mode, `git pull` is shorthand for `git fetch` followed by `git merge FETCH_HEAD`.
     *
     * @param repository the repository to pull from.
     * @param options optional refinements for the `git pull` command.
     */
    pull(repository: Repository, options?: Git.Options.Pull): Promise<void>;

    /**
     * Resets the current `HEAD` of the entire working directory to the specified state.
     *
     * @param repository the repository which state has to be reset.
     * @param options further clarifying the `git reset` command.
     */
    reset(repository: Repository, options: Git.Options.Reset): Promise<void>;

    /**
     * Merges the given branch into the currently active branch.
     *
     * @param repository the repository to merge from.
     * @param options `git merge` command refinements.
     */
    merge(repository: Repository, options: Git.Options.Merge): Promise<void>;

    /**
     * Retrieves and shows the content of a resource from the repository at a given reference, commit, or tree.
     * Resolves to a promise that will produce a string containing the contents of the file or an error if the file does not exists in the given revision.
     *
     * @param repository the repository to get the file content from.
     * @param uri the URI of the file who's content has to be retrieved and shown.
     * @param options the options for further refining the `git show`.
     */
    show(repository: Repository, uri: string, options?: Git.Options.Show): Promise<string>;

    /**
     * The default `git stash` command. Equivalent to `git stash push`. If the `message` is not defined, the Git default *WIP on branchname* will be used instead.
     */
    stash(repository: Repository, options?: Readonly<{ action?: 'push', message?: string }>): Promise<void>;

    /**
     * Resolves to an array of stashed entries that you currently have. Same as `git stash list`.
     */
    stash(repository: Repository, options: Readonly<{ action: 'list' }>): Promise<StashEntry[]>;

    /**
     * Removes all the stash entries.
     */
    stash(repository: Repository, options: Readonly<{ action: 'clear' }>): Promise<void>;

    /**
     * Performs stash actions depending on given action option.
     * pop:
     * Removes a single stashed state from the stash list and applies it on top of the current working tree state.
     * The single stashed state is identified by the optional `id`. If the `id` is not defined the latest stash will be popped.
     *
     * apply:
     * Like `git stash pop`, but does not remove the state from the stash list.
     *
     * drop:
     * Removes a single stash entry from the list of stash entries. When the `id` is not given, it removes the latest one.
     */
    stash(repository: Repository, options: Readonly<{ action: 'apply' | 'pop' | 'drop', id?: string }>): Promise<void>;

    /**
     * It resolves to an array of configured remotes names for the given repository.
     *
     * @param repository the repository to get the remote names.
     */
    remote(repository: Repository): Promise<string[]>;

    /**
     * It resolves to an array of configured remote objects for the given Git action.
     *
     * @param repository the repository to get the remote objects.
     * @param options `git remote` command refinements.
     */
    remote(repository: Repository, options: { verbose: true }): Promise<RemoteModel[]>;

    /**
     * Executes the Git command and resolves to the result. If an executed Git command exits with a code that is not in the `successExitCodes` or an error not in `expectedErrors`,
     * a `GitError` will be thrown.
     *
     * @param repository the repository where one can execute the command. (Although the repository path is not necessarily mandatory for each Git commands,
     * such as `git config -l`, or `git --version`, we treat the repository as a required argument to have a symmetric API.)
     * @param args the array of arguments for Git.
     * @param options options can be used to tweaked additional configurations for the low-level command execution.
     */
    exec(repository: Repository, args: string[], options?: Git.Options.Execution): Promise<GitResult>;

    /**
     * Shows the difference between content pairs in the working tree, commits, or index.
     *
     * @param repository the repository where where the diff has to be calculated.
     * @param options optional configuration for further refining the `git diff` command execution.
     */
    diff(repository: Repository, options?: Git.Options.Diff): Promise<GitFileChange[]>;

    /**
     * Returns a list with commits and their respective file changes.
     *
     * @param repository the repository where the log has to be calculated.
     * @param options optional configuration for further refining the `git log` command execution.
     */
    log(repository: Repository, options?: Git.Options.Log): Promise<CommitWithChanges[]>;

    /**
     * Returns the commit SHA of the given ref if the ref exists, or returns 'undefined' if the
     * given ref does not exist.
     *
     * @param repository the repository where the ref may be found.
     * @param options configuration containing the ref and optionally other properties for further refining the `git rev-parse` command execution.
     */
    revParse(repository: Repository, options: Git.Options.RevParse): Promise<string | undefined>;

    /**
     * Returns the annotations of each line in the given file.
     *
     * @param repository the repository which contains the given file.
     * @param uri the URI of the file to get the annotations for.
     * @param options more options refining the `git blame`.
     */
    blame(repository: Repository, uri: string, options?: Git.Options.Blame): Promise<GitFileBlame | undefined>;

    /**
     * Resolves to `true` if the file is managed by the Git repository. Otherwise, `false`.
     */
    lsFiles(repository: Repository, uri: string, options: { errorUnmatch: true }): Promise<boolean>;
    /**
     * Shows information about files in the index and the working tree
     *
     * @param repository the repository where the `git lf-files` has to be executed.
     * @param uri the URI of the file to check.
     * @param options further options for the command executions.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lsFiles(repository: Repository, uri: string, options?: Git.Options.LsFiles): Promise<any>;

}

/**
 * Contains a set of utility functions for [Git](#Git).
 */
export namespace GitUtils {

    /**
     * `true` if the argument is an option for renaming an existing branch in the repository.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function isBranchRename(arg: any | undefined): arg is Git.Options.BranchCommand.Rename {
        return !!arg && ('newName' in arg);
    }

    /**
     * `true` if the argument is an option for deleting an existing branch in the repository.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function isBranchDelete(arg: any | undefined): arg is Git.Options.BranchCommand.Delete {
        return !!arg && ('toDelete' in arg);
    }

    /**
     * `true` if the argument is an option for creating a new branch in the repository.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function isBranchCreate(arg: any | undefined): arg is Git.Options.BranchCommand.Create {
        return !!arg && ('toCreate' in arg);
    }

    /**
     * `true` if the argument is an option for listing the branches in a repository.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function isBranchList(arg: any | undefined): arg is Git.Options.BranchCommand.List {
        return !!arg && ('type' in arg);
    }

    /**
     * `true` if the argument is an option for checking out a new local branch.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function isBranchCheckout(arg: any | undefined): arg is Git.Options.Checkout.CheckoutBranch {
        return !!arg && ('branch' in arg);
    }

    /**
     * `true` if the argument is an option for checking out a working tree file.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function isWorkingTreeFileCheckout(arg: any | undefined): arg is Git.Options.Checkout.WorkingTreeFile {
        return !!arg && ('paths' in arg);
    }

    /**
     * The error code for when the path to a repository doesn't exist.
     */
    const RepositoryDoesNotExistErrorCode = 'repository-does-not-exist-error';

    /**
     * `true` if the argument is an error indicating the absence of a local Git repository.
     * Otherwise, `false`.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function isRepositoryDoesNotExistError(error: any | undefined): boolean {
        // TODO this is odd here.This piece of code is already implementation specific, so this should go to the Git API.
        // But how can we ensure that the `any` type error is serializable?
        if (error instanceof Error && ('code' in error)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (<any>error).code === RepositoryDoesNotExistErrorCode;
        }
        return false;
    }

    /**
     * Maps the raw status text from Git to a Git file status enumeration.
     */
    export function mapStatus(rawStatus: string): GitFileStatus {
        const status = rawStatus.trim();

        if (status === 'M') {
            return GitFileStatus.Modified;
        } // modified
        if (status === 'A') {
            return GitFileStatus.New;
        } // added
        if (status === 'D') {
            return GitFileStatus.Deleted;
        } // deleted
        if (status === 'R') {
            return GitFileStatus.Renamed;
        } // renamed
        if (status === 'C') {
            return GitFileStatus.Copied;
        } // copied

        // git log -M --name-status will return a RXXX - where XXX is a percentage
        if (status.match(/R[0-9]+/)) {
            return GitFileStatus.Renamed;
        }

        // git log -C --name-status will return a CXXX - where XXX is a percentage
        if (status.match(/C[0-9]+/)) {
            return GitFileStatus.Copied;
        }

        return GitFileStatus.Modified;
    }

    /**
     * `true` if the argument is a raw Git status with similarity percentage. Otherwise, `false`.
     */
    export function isSimilarityStatus(rawStatus: string): boolean {
        return !!rawStatus.match(/R[0-9][0-9][0-9]/) || !!rawStatus.match(/C[0-9][0-9][0-9]/);
    }

}
