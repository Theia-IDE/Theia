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

/* eslint-disable max-len */

import { TextDocumentContentChangeEvent } from '@theia/core/shared/vscode-languageserver-protocol';
import { ApplicationError } from '@theia/core/lib/common';

/**
 * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `FileService` instead
 */
export const FileSystem = Symbol('FileSystem');
export interface FileSystem {

    /**
     * Returns the file stat for the given URI.
     *
     * If the uri points to a folder it will contain one level of unresolved children.
     *
     * `undefined` if a file for the given URI does not exist.
     *
     * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `FileService.resolve` instead
     */
    getFileStat(uri: string): Promise<FileStat | undefined>;

    /**
     * Finds out if a file identified by the resource exists.
     *
     * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `FileService.exists` instead
     */
    exists(uri: string): Promise<boolean>;

    /**
     * Resolve the contents of a file identified by the resource.
     *
     * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `FileService.read` instead
     */
    resolveContent(uri: string, options?: { encoding?: string }): Promise<{ stat: FileStat, content: string }>;

    /**
     * Updates the content replacing its previous value.
     *
     * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `FileService.write` instead
     */
    setContent(file: FileStat, content: string, options?: { encoding?: string }): Promise<FileStat>;

    /**
     * Updates the content replacing its previous value.
     *
     * The optional parameter `overwriteEncoding` can be used to transform the encoding of a file.
     *
     * |   | encoding | overwriteEncoding | behaviour |
     * |---|----------|-------------------|-----------|
     * | 1 | undefined |    undefined     | read & write file in default encoding |
     * | 2 | undefined |        ✓         | read file in default encoding; write file in `overwriteEncoding` |
     * | 3 |     ✓    |     undefined     | read & write file in `encoding` |
     * | 4 |     ✓    |        ✓         | read file in `encoding`; write file in `overwriteEncoding` |
     *
     * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `FileService.write` instead
     */
    updateContent(file: FileStat, contentChanges: TextDocumentContentChangeEvent[], options?: { encoding?: string, overwriteEncoding?: string }): Promise<FileStat>;

    /**
     * Moves the file to a new path identified by the resource.
     *
     * The optional parameter overwrite can be set to replace an existing file at the location.
     *
     * |           | missing | file | empty dir |    dir    |
     * |-----------|---------|------|-----------|-----------|
     * | missing   |    x    |   x  |     x     |     x     |
     * | file      |    ✓    |   x  |     x     |     x     |
     * | empty dir |    ✓    |   x  |     x     | overwrite |
     * | dir       |    ✓    |   x  | overwrite | overwrite |
     *
     * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `FileService.move` instead
     */
    move(sourceUri: string, targetUri: string, options?: FileMoveOptions): Promise<FileStat>;

    /**
     * Copies the file to a path identified by the resource.
     *
     * The optional parameter overwrite can be set to replace an existing file at the location.
     *
     * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `FileService.copy` instead
     */
    copy(sourceUri: string, targetUri: string, options?: { overwrite?: boolean, recursive?: boolean }): Promise<FileStat>;

    /**
     * Creates a new file with the given path. The returned promise
     * will have the stat model object as a result.
     *
     * The optional parameter content can be used as value to fill into the new file.
     *
     * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `FileService.create` instead
     */
    createFile(uri: string, options?: { content?: string, encoding?: string }): Promise<FileStat>;

    /**
     * Creates a new folder with the given path. The returned promise
     * will have the stat model object as a result.
     *
     * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `FileService.createFolder` instead
     */
    createFolder(uri: string): Promise<FileStat>;

    /**
     * Creates a new empty file if the given path does not exist and otherwise
     * will set the mtime and atime of the file to the current date.
     */
    touchFile(uri: string): Promise<FileStat>;

    /**
     * Deletes the provided file. The optional moveToTrash parameter allows to
     * move the file to trash.
     *
     * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `FileService.delete` instead
     */
    delete(uri: string, options?: FileDeleteOptions): Promise<void>;

    /**
     * Returns the encoding of the given file resource.
     *
     * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908) use `FileService.read` without `autoGuessEncoding` option instead
     */
    getEncoding(uri: string): Promise<string>;

    /**
     * Guess encoding of a given file based on its content.
     *
     * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `FileService.read` with `autoGuessEncoding` option instead
     */
    guessEncoding(uri: string): Promise<string | undefined>;

    /**
     * Return list of available roots.
     */
    getRoots(): Promise<FileStat[]>;

    /**
     * Returns a promise that resolves to a file stat representing the current user's home directory.
     *
     * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `EnvVariablesServer.getHomeDirUri` instead
     */
    getCurrentUserHome(): Promise<FileStat | undefined>;

    /**
     * Resolves to an array of URIs pointing to the available drives on the filesystem.
     *
     * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `EnvVariablesServer.getDrives` instead
     */
    getDrives(): Promise<string[]>;

    /**
     * Tests a user's permissions for the file or directory specified by URI.
     * The mode argument is an optional integer that specifies the accessibility checks to be performed.
     * Check `FileAccess.Constants` for possible values of mode.
     * It is possible to create a mask consisting of the bitwise `OR` of two or more values (e.g. FileAccess.Constants.W_OK | FileAccess.Constants.R_OK).
     * If `mode` is not defined, `FileAccess.Constants.F_OK` will be used instead.
     *
     * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `FileService.access` instead
     */
    access(uri: string, mode?: number): Promise<boolean>

    /**
     * Returns the path of the given file URI, specific to the backend's operating system.
     * If the URI is not a file URI, undefined is returned.
     *
     * USE WITH CAUTION: You should always prefer URIs to paths if possible, as they are
     * portable and platform independent. Paths should only be used in cases you directly
     * interact with the OS, e.g. when running a command on the shell.
     *
     * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `FileService.fsPath` instead
     */
    getFsPath(uri: string): Promise<string | undefined>
}

export namespace FileAccess {

    export namespace Constants {

        /**
         * Flag indicating that the file is visible to the calling process.
         * This is useful for determining if a file exists, but says nothing about rwx permissions. Default if no mode is specified.
         */
        export const F_OK: number = 0;

        /**
         * Flag indicating that the file can be read by the calling process.
         */
        export const R_OK: number = 4;

        /**
         * Flag indicating that the file can be written by the calling process.
         */
        export const W_OK: number = 2;

        /**
         * Flag indicating that the file can be executed by the calling process.
         * This has no effect on Windows (will behave like `FileAccess.F_OK`).
         */
        export const X_OK: number = 1;

    }

}

export interface FileMoveOptions {
    overwrite?: boolean;
}

export interface FileDeleteOptions {
    moveToTrash?: boolean
}

/**
 * A file resource with meta information.
 *
 * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `FileStat` from `@theia/filesystem/lib/common/files` instead
 */
export interface FileStat {

    /**
     * The URI of the file.
     */
    uri: string;

    /**
     * The last modification of this file.
     */
    lastModification: number;

    /**
     * `true` if the resource is a directory. Otherwise, `false`.
     */
    isDirectory: boolean;

    /**
     * The children of the file stat.
     * If it is `undefined` and `isDirectory` is `true`, then this file stat is unresolved.
     */
    children?: FileStat[];

    /**
     * The size of the file if known.
     */
    size?: number;

}

export namespace FileStat {
    export function is(candidate: Object | undefined): candidate is FileStat {
        return typeof candidate === 'object' && ('uri' in candidate) && ('lastModification' in candidate) && ('isDirectory' in candidate);
    }

    export function equals(one: object | undefined, other: object | undefined): boolean {
        if (!one || !other || !is(one) || !is(other)) {
            return false;
        }
        return one.uri === other.uri
            && one.lastModification === other.lastModification
            && one.isDirectory === other.isDirectory;
    }
}

/**
 * @deprecated since 1.4.0 - in order to support VS Code FS API (https://github.com/eclipse-theia/theia/pull/7908), use `FileOperationError` instead
 */
export namespace FileSystemError {
    export const FileNotFound = ApplicationError.declare(-33000, (uri: string, prefix?: string) => ({
        message: `${prefix ? prefix + ' ' : ''}'${uri}' has not been found.`,
        data: { uri }
    }));
    export const FileExists = ApplicationError.declare(-33001, (uri: string, prefix?: string) => ({
        message: `${prefix ? prefix + ' ' : ''}'${uri}' already exists.`,
        data: { uri }
    }));
    export const FileIsDirectory = ApplicationError.declare(-33002, (uri: string, prefix?: string) => ({
        message: `${prefix ? prefix + ' ' : ''}'${uri}' is a directory.`,
        data: { uri }
    }));
    export const FileNotDirectory = ApplicationError.declare(-33003, (uri: string, prefix?: string) => ({
        message: `${prefix ? prefix + ' ' : ''}'${uri}' is not a directory.`,
        data: { uri }
    }));
    export const FileIsOutOfSync = ApplicationError.declare(-33004, (file: FileStat, stat: FileStat) => ({
        message: `'${file.uri}' is out of sync.`,
        data: { file, stat }
    }));
}
