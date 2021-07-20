/********************************************************************************
 * Copyright (C) 2020 TypeFox and others.
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
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// based on https://github.com/microsoft/vscode/blob/04c36be045a94fee58e5f8992d3e3fd980294a84/src/vs/platform/files/common/fileService.ts
// and https://github.com/microsoft/vscode/blob/04c36be045a94fee58e5f8992d3e3fd980294a84/src/vs/workbench/services/textfile/browser/textFileService.ts
// and https://github.com/microsoft/vscode/blob/04c36be045a94fee58e5f8992d3e3fd980294a84/src/vs/workbench/services/textfile/electron-browser/nativeTextFileService.ts
// and https://github.com/microsoft/vscode/blob/04c36be045a94fee58e5f8992d3e3fd980294a84/src/vs/workbench/services/workingCopy/common/workingCopyFileService.ts
// and https://github.com/microsoft/vscode/blob/04c36be045a94fee58e5f8992d3e3fd980294a84/src/vs/workbench/services/workingCopy/common/workingCopyFileOperationParticipant.ts

/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-null/no-null */
/* eslint-disable @typescript-eslint/tslint/config */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { injectable, inject, named, postConstruct } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { timeout, Deferred } from '@theia/core/lib/common/promise-util';
import { CancellationToken, CancellationTokenSource } from '@theia/core/lib/common/cancellation';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { WaitUntilEvent, Emitter, AsyncEmitter } from '@theia/core/lib/common/event';
import { ContributionProvider } from '@theia/core/lib/common/contribution-provider';
import { TernarySearchTree } from '@theia/core/lib/common/ternary-search-tree';
import {
    ensureFileSystemProviderError, etag, ETAG_DISABLED,
    FileChangesEvent,
    FileOperation, FileOperationError,
    FileOperationEvent, FileOperationResult, FileSystemProviderCapabilities,
    FileSystemProviderErrorCode, FileType, hasFileFolderCopyCapability, hasOpenReadWriteCloseCapability, hasReadWriteCapability,
    CreateFileOptions, FileContent, FileStat, FileStatWithMetadata,
    FileStreamContent, FileSystemProvider,
    FileSystemProviderWithFileReadWriteCapability, FileSystemProviderWithOpenReadWriteCloseCapability,
    ReadFileOptions, ResolveFileOptions, ResolveMetadataFileOptions,
    Stat, WatchOptions, WriteFileOptions,
    toFileOperationResult, toFileSystemProviderErrorCode,
    ResolveFileResult, ResolveFileResultWithMetadata,
    MoveFileOptions, CopyFileOptions, BaseStatWithMetadata, FileDeleteOptions, FileOperationOptions, hasAccessCapability, hasUpdateCapability,
    hasFileReadStreamCapability, FileSystemProviderWithFileReadStreamCapability
} from '../common/files';
import { BinaryBuffer, BinaryBufferReadable, BinaryBufferReadableStream, BinaryBufferReadableBufferedStream, BinaryBufferWriteableStream } from '@theia/core/lib/common/buffer';
import { ReadableStream, isReadableStream, isReadableBufferedStream, transform, consumeStream, peekStream, peekReadable, Readable } from '@theia/core/lib/common/stream';
import { LabelProvider } from '@theia/core/lib/browser/label-provider';
import { FileSystemPreferences } from './filesystem-preferences';
import { ProgressService } from '@theia/core/lib/common/progress-service';
import { DelegatingFileSystemProvider } from '../common/delegating-file-system-provider';
import type { TextDocumentContentChangeEvent } from '@theia/core/shared/vscode-languageserver-protocol';
import { EncodingRegistry } from '@theia/core/lib/browser/encoding-registry';
import { UTF8, UTF8_with_bom } from '@theia/core/lib/common/encodings';
import { EncodingService, ResourceEncoding, DecodeStreamResult } from '@theia/core/lib/common/encoding-service';
import { Mutable } from '@theia/core/lib/common/types';
import { readFileIntoStream } from '../common/io';
import { FileSystemWatcherErrorHandler } from './filesystem-watcher-error-handler';
import { FileSystemUtils } from '../common/filesystem-utils';

export interface FileOperationParticipant {

    /**
     * Participate in a file operation of a working copy. Allows to
     * change the working copy before it is being saved to disk.
     */
    participate(
        target: URI,
        source: URI | undefined,
        operation: FileOperation,
        timeout: number,
        token: CancellationToken
    ): Promise<void>;
}

export interface ReadEncodingOptions {

    /**
     * The optional encoding parameter allows to specify the desired encoding when resolving
     * the contents of the file.
     */
    encoding?: string;

    /**
     * The optional guessEncoding parameter allows to guess encoding from content of the file.
     */
    autoGuessEncoding?: boolean;
}

export interface WriteEncodingOptions {

    /**
     * The encoding to use when updating a file.
     */
    encoding?: string;

    /**
     * If set to true, will enforce the selected encoding and not perform any detection using BOMs.
     */
    overwriteEncoding?: boolean;
}

export interface ReadTextFileOptions extends ReadEncodingOptions, ReadFileOptions {
    /**
     * The optional acceptTextOnly parameter allows to fail this request early if the file
     * contents are not textual.
     */
    acceptTextOnly?: boolean;
}

interface BaseTextFileContent extends BaseStatWithMetadata {

    /**
     * The encoding of the content if known.
     */
    encoding: string;
}

export interface TextFileContent extends BaseTextFileContent {

    /**
     * The content of a text file.
     */
    value: string;
}

export interface TextFileStreamContent extends BaseTextFileContent {

    /**
     * The line grouped content of a text file.
     */
    value: ReadableStream<string>;
}

export interface CreateTextFileOptions extends WriteEncodingOptions, CreateFileOptions { }

export interface WriteTextFileOptions extends WriteEncodingOptions, WriteFileOptions { }

export interface UpdateTextFileOptions extends WriteEncodingOptions, WriteFileOptions {
    readEncoding: string
}

export interface UserFileOperationEvent extends WaitUntilEvent {

    /**
     * An identifier to correlate the operation through the
     * different event types (before, after, error).
     */
    readonly correlationId: number;

    /**
     * The file operation that is taking place.
     */
    readonly operation: FileOperation;

    /**
     * The resource the event is about.
     */
    readonly target: URI;

    /**
     * A property that is defined for move operations.
     */
    readonly source?: URI;
}

export const FileServiceContribution = Symbol('FileServiceContribution');

/**
 * A {@link FileServiceContribution} can be used to add custom {@link FileSystemProvider}s.
 * For this, the contribution has to listen to the {@link FileSystemProviderActivationEvent} and register
 * the custom {@link FileSystemProvider}s according to the scheme when this event is fired.
 *
 * ### Example usage
 * ```ts
 * export class MyFileServiceContribution implements FileServiceContribution {
 *     registerFileSystemProviders(service: FileService): void {
 *         service.onWillActivateFileSystemProvider(event => {
 *             if (event.scheme === 'mySyncProviderScheme') {
 *                 service.registerProvider('mySyncProviderScheme', this.mySyncProvider);
 *             }
 *             if (event.scheme === 'myAsyncProviderScheme') {
 *                 event.waitUntil((async () => {
 *                     const myAsyncProvider = await this.createAsyncProvider();
 *                     service.registerProvider('myAsyncProviderScheme', myAsyncProvider);
 *                 })());
 *             }
 *         });
 *
 *     }
 *```
 */
export interface FileServiceContribution {
    /**
     * Register custom file system providers for the given {@link FileService}.
     * @param service The file service for which the providers should be registered.
     */
    registerFileSystemProviders(service: FileService): void;
}

/**
 * Represents the `FileSystemProviderRegistration` event.
 * This event is fired by the {@link FileService} if a {@link FileSystemProvider} is
 * registered to or unregistered from the service.
 */
export interface FileSystemProviderRegistrationEvent {
    /** `True` if a new provider has been registered, `false` if a provider has been unregistered. */
    added: boolean;
    /** The (uri) scheme for which the provider was (previously) registered */
    scheme: string;
    /** The affected file system provider for which this event was fired. */
    provider?: FileSystemProvider;
}

/**
 * Represents the `FileSystemProviderCapabilitiesChange` event.
 * This event is fired by the {@link FileService} if the capabilities of one of its managed
 * {@link FileSystemProvider}s have changed.
 */
export interface FileSystemProviderCapabilitiesChangeEvent {
    /** The affected file system provider for which this event was fired. */
    provider: FileSystemProvider;
    /** The (uri) scheme for which the provider is registered */
    scheme: string;
}

/**
 * Represents the `FileSystemProviderActivation` event.
 * This event is fired by the {@link FileService} if it wants to activate the
 * {@link FileSystemProvider} for a specific scheme.
 */
export interface FileSystemProviderActivationEvent extends WaitUntilEvent {
    /** The (uri) scheme for which the provider should be activated */
    scheme: string;
}

export const enum TextFileOperationResult {
    FILE_IS_BINARY
}

export class TextFileOperationError extends FileOperationError {

    constructor(
        message: string,
        public textFileOperationResult: TextFileOperationResult,
        public options?: ReadTextFileOptions & WriteTextFileOptions
    ) {
        super(message, FileOperationResult.FILE_OTHER_ERROR);
        Object.setPrototypeOf(this, TextFileOperationError.prototype);
    }

}

/**
 * The {@link FileService} is the common facade responsible for all interactions with file systems.
 * It manages all registered {@link FileSystemProvider}s and
 *  forwards calls to the responsible {@link FileSystemProvider}, determined by the scheme.
 * For additional documentation regarding the provided functions see also {@link FileSystemProvider}.
 */
@injectable()
export class FileService {

    private readonly BUFFER_SIZE = 64 * 1024;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(FileSystemPreferences)
    protected readonly preferences: FileSystemPreferences;

    @inject(ProgressService)
    protected readonly progressService: ProgressService;

    @inject(EncodingRegistry)
    protected readonly encodingRegistry: EncodingRegistry;

    @inject(EncodingService)
    protected readonly encodingService: EncodingService;

    @inject(ContributionProvider) @named(FileServiceContribution)
    protected readonly contributions: ContributionProvider<FileServiceContribution>;

    @inject(FileSystemWatcherErrorHandler)
    protected readonly watcherErrorHandler: FileSystemWatcherErrorHandler;

    @postConstruct()
    protected init(): void {
        for (const contribution of this.contributions.getContributions()) {
            contribution.registerFileSystemProviders(this);
        }
    }

    // #region Events

    private correlationIds = 0;

    private readonly onWillRunUserOperationEmitter = new AsyncEmitter<UserFileOperationEvent>();
    /**
     * An event that is emitted when file operation is being performed.
     * This event is triggered by user gestures.
     */
    readonly onWillRunUserOperation = this.onWillRunUserOperationEmitter.event;

    private readonly onDidFailUserOperationEmitter = new AsyncEmitter<UserFileOperationEvent>();
    /**
     * An event that is emitted when file operation is failed.
     * This event is triggered by user gestures.
     */
    readonly onDidFailUserOperation = this.onDidFailUserOperationEmitter.event;

    private readonly onDidRunUserOperationEmitter = new AsyncEmitter<UserFileOperationEvent>();
    /**
     * An event that is emitted when file operation is finished.
     * This event is triggered by user gestures.
     */
    readonly onDidRunUserOperation = this.onDidRunUserOperationEmitter.event;

    // #endregion

    // #region File System Provider

    private onDidChangeFileSystemProviderRegistrationsEmitter = new Emitter<FileSystemProviderRegistrationEvent>();
    readonly onDidChangeFileSystemProviderRegistrations = this.onDidChangeFileSystemProviderRegistrationsEmitter.event;

    private onWillActivateFileSystemProviderEmitter = new Emitter<FileSystemProviderActivationEvent>();
    /**
     * See `FileServiceContribution.registerProviders`.
     */
    readonly onWillActivateFileSystemProvider = this.onWillActivateFileSystemProviderEmitter.event;

    private onDidChangeFileSystemProviderCapabilitiesEmitter = new Emitter<FileSystemProviderCapabilitiesChangeEvent>();
    readonly onDidChangeFileSystemProviderCapabilities = this.onDidChangeFileSystemProviderCapabilitiesEmitter.event;

    private readonly providers = new Map<string, FileSystemProvider>();
    private readonly activations = new Map<string, Promise<FileSystemProvider>>();

    /**
     * Registers a new {@link FileSystemProvider} for the given scheme.
     * @param scheme The (uri) scheme for which the provider should be registered.
     * @param provider The file system provider that should be registered.
     *
     * @returns A `Disposable` that can be invoked to unregister the given provider.
     */
    registerProvider(scheme: string, provider: FileSystemProvider): Disposable {
        if (this.providers.has(scheme)) {
            throw new Error(`A filesystem provider for the scheme '${scheme}' is already registered.`);
        }

        this.providers.set(scheme, provider);
        this.onDidChangeFileSystemProviderRegistrationsEmitter.fire({ added: true, scheme, provider });

        const providerDisposables = new DisposableCollection();
        providerDisposables.push(provider.onDidChangeFile(changes => this.onDidFilesChangeEmitter.fire(new FileChangesEvent(changes))));
        providerDisposables.push(provider.onFileWatchError(() => this.handleFileWatchError()));
        providerDisposables.push(provider.onDidChangeCapabilities(() => this.onDidChangeFileSystemProviderCapabilitiesEmitter.fire({ provider, scheme })));

        return Disposable.create(() => {
            this.onDidChangeFileSystemProviderRegistrationsEmitter.fire({ added: false, scheme, provider });
            this.providers.delete(scheme);

            providerDisposables.dispose();
        });
    }

    /**
     * Try to activate the registered provider for the given scheme
     * @param scheme  The uri scheme for which the responsible provider should be activated.
     *
     * @returns A promise of the activated file system provider. Only resolves if a provider is available for this scheme, gets rejected otherwise.
     */
    async activateProvider(scheme: string): Promise<FileSystemProvider> {
        let provider = this.providers.get(scheme);
        if (provider) {
            return provider;
        }
        let activation = this.activations.get(scheme);
        if (!activation) {
            const deferredActivation = new Deferred<FileSystemProvider>();
            this.activations.set(scheme, activation = deferredActivation.promise);
            WaitUntilEvent.fire(this.onWillActivateFileSystemProviderEmitter, { scheme }).then(() => {
                provider = this.providers.get(scheme);
                if (!provider) {
                    const error = new Error();
                    error.name = 'ENOPRO';
                    error.message = `No file system provider found for scheme ${scheme}`;
                    throw error;
                } else {
                    deferredActivation.resolve(provider);
                }
            }).catch(e => deferredActivation.reject(e));
        }
        return activation;
    }

    /**
     * Tests if the service (i.e. any of its registered {@link FileSystemProvider}s) can handle the given resource.
     * @param resource `URI` of the resource to test.
     *
     * @returns `true` if the resource can be handled, `false` otherwise.
     */
    canHandleResource(resource: URI): boolean {
        return this.providers.has(resource.scheme);
    }

    /**
     * Tests if the service (i.e the {@link FileSystemProvider} registered for the given uri scheme) provides the given capability.
     * @param resource `URI` of the resource to test.
     * @param capability The required capability.
     *
     * @returns `true` if the resource can be handled and the required capability can be provided.
     */
    hasCapability(resource: URI, capability: FileSystemProviderCapabilities): boolean {
        const provider = this.providers.get(resource.scheme);

        return !!(provider && (provider.capabilities & capability));
    }

    protected async withProvider(resource: URI): Promise<FileSystemProvider> {
        // Assert path is absolute
        if (!resource.path.isAbsolute) {
            throw new FileOperationError(`Unable to resolve filesystem provider with relative file path ${this.resourceForError(resource)}`, FileOperationResult.FILE_INVALID_PATH);
        }

        return this.activateProvider(resource.scheme);
    }

    private async withReadProvider(resource: URI): Promise<FileSystemProviderWithFileReadWriteCapability | FileSystemProviderWithOpenReadWriteCloseCapability> {
        const provider = await this.withProvider(resource);

        if (hasOpenReadWriteCloseCapability(provider) || hasReadWriteCapability(provider)) {
            return provider;
        }

        throw new Error(`Filesystem provider for scheme '${resource.scheme}' neither has FileReadWrite, FileReadStream nor FileOpenReadWriteClose capability which is needed for the read operation.`);
    }

    private async withWriteProvider(resource: URI): Promise<FileSystemProviderWithFileReadWriteCapability | FileSystemProviderWithOpenReadWriteCloseCapability> {
        const provider = await this.withProvider(resource);
        if (hasOpenReadWriteCloseCapability(provider) || hasReadWriteCapability(provider)) {
            return provider;
        }

        throw new Error(`Filesystem provider for scheme '${resource.scheme}' neither has FileReadWrite nor FileOpenReadWriteClose capability which is needed for the write operation.`);
    }

    // #endregion

    private onDidRunOperationEmitter = new Emitter<FileOperationEvent>();
    /**
     * An event that is emitted when operation is finished.
     * This event is triggered by user gestures and programmatically.
     */
    readonly onDidRunOperation = this.onDidRunOperationEmitter.event;

    /**
     * Try to resolve file information and metadata for the given resource.
     * @param resource `URI` of the resource that should be resolved.
     * @param options  Options to customize the resolvement process.
     *
     * @return A promise that resolves if the resource could be successfully resolved.
     */
    resolve(resource: URI, options: ResolveMetadataFileOptions): Promise<FileStatWithMetadata>;
    resolve(resource: URI, options?: ResolveFileOptions | undefined): Promise<FileStat>;
    async resolve(resource: any, options?: any) {
        try {
            return await this.doResolveFile(resource, options);
        } catch (error) {

            // Specially handle file not found case as file operation result
            if (toFileSystemProviderErrorCode(error) === FileSystemProviderErrorCode.FileNotFound) {
                throw new FileOperationError(`Unable to resolve non-existing file '${this.resourceForError(resource)}'`, FileOperationResult.FILE_NOT_FOUND);
            }

            // Bubble up any other error as is
            throw ensureFileSystemProviderError(error);
        }
    }

    private async doResolveFile(resource: URI, options: ResolveMetadataFileOptions): Promise<FileStatWithMetadata>;
    private async doResolveFile(resource: URI, options?: ResolveFileOptions): Promise<FileStat>;
    private async doResolveFile(resource: URI, options?: ResolveFileOptions): Promise<FileStat> {
        const provider = await this.withProvider(resource);

        const resolveTo = options?.resolveTo;
        const resolveSingleChildDescendants = options?.resolveSingleChildDescendants;
        const resolveMetadata = options?.resolveMetadata;

        const stat = await provider.stat(resource);

        let trie: TernarySearchTree<URI, boolean> | undefined;

        return this.toFileStat(provider, resource, stat, undefined, !!resolveMetadata, (stat, siblings) => {

            // lazy trie to check for recursive resolving
            if (!trie) {
                trie = TernarySearchTree.forUris<true>(!!(provider.capabilities & FileSystemProviderCapabilities.PathCaseSensitive));
                trie.set(resource, true);
                if (Array.isArray(resolveTo) && resolveTo.length) {
                    resolveTo.forEach(uri => trie!.set(uri, true));
                }
            }

            // check for recursive resolving
            if (Boolean(trie.findSuperstr(stat.resource) || trie.get(stat.resource))) {
                return true;
            }

            // check for resolving single child folders
            if (stat.isDirectory && resolveSingleChildDescendants) {
                return siblings === 1;
            }

            return false;
        });
    }

    private async toFileStat(provider: FileSystemProvider, resource: URI, stat: Stat | { type: FileType } & Partial<Stat>, siblings: number | undefined, resolveMetadata: boolean, recurse: (stat: FileStat, siblings?: number) => boolean): Promise<FileStat>;
    private async toFileStat(provider: FileSystemProvider, resource: URI, stat: Stat, siblings: number | undefined, resolveMetadata: true, recurse: (stat: FileStat, siblings?: number) => boolean): Promise<FileStatWithMetadata>;
    private async toFileStat(provider: FileSystemProvider, resource: URI, stat: Stat | { type: FileType } & Partial<Stat>, siblings: number | undefined, resolveMetadata: boolean, recurse: (stat: FileStat, siblings?: number) => boolean): Promise<FileStat> {
        const fileStat = FileStat.fromStat(resource, stat);

        // check to recurse for directories
        if (fileStat.isDirectory && recurse(fileStat, siblings)) {
            try {
                const entries = await provider.readdir(resource);
                const resolvedEntries = await Promise.all(entries.map(async ([name, type]) => {
                    try {
                        const childResource = resource.resolve(name);
                        const childStat = resolveMetadata ? await provider.stat(childResource) : { type };

                        return await this.toFileStat(provider, childResource, childStat, entries.length, resolveMetadata, recurse);
                    } catch (error) {
                        console.trace(error);

                        return null; // can happen e.g. due to permission errors
                    }
                }));

                // make sure to get rid of null values that signal a failure to resolve a particular entry
                fileStat.children = resolvedEntries.filter(e => !!e) as FileStat[];
            } catch (error) {
                console.trace(error);

                fileStat.children = []; // gracefully handle errors, we may not have permissions to read
            }

            return fileStat;
        }

        return fileStat;
    }

    /**
     * Try to resolve file information and metadata for all given resource.
     * @param toResolve An array of all the resources (and corresponding resolvement options) that should be resolved.
     *
     * @returns A promise of all resolved resources. The promise is not rejected if any of the given resources cannot be resolved.
     * Instead this is reflected with the `success` flag of the corresponding {@link ResolveFileResult}.
     */
    async resolveAll(toResolve: { resource: URI, options?: ResolveFileOptions }[]): Promise<ResolveFileResult[]>;
    async resolveAll(toResolve: { resource: URI, options: ResolveMetadataFileOptions }[]): Promise<ResolveFileResultWithMetadata[]>;
    async resolveAll(toResolve: { resource: URI; options?: ResolveFileOptions; }[]): Promise<ResolveFileResult[]> {
        return Promise.all(toResolve.map(async entry => {
            try {
                return { stat: await this.doResolveFile(entry.resource, entry.options), success: true };
            } catch (error) {
                console.trace(error);

                return { stat: undefined, success: false };
            }
        }));
    }

    /**
     * Tests if the given resource exists in the filesystem.
     * @param resource `URI` of the resource which should be tested.
     * @throws Will throw an error if no {@link FileSystemProvider} is registered for the given resource.
     *
     * @returns A promise that resolves to `true` if the resource exists.
     */
    async exists(resource: URI): Promise<boolean> {
        const provider = await this.withProvider(resource);

        try {
            const stat = await provider.stat(resource);

            return !!stat;
        } catch (error) {
            return false;
        }
    }

    /**
     * Tests a user's permissions for the given resource.
     */
    async access(resource: URI, mode?: number): Promise<boolean> {
        const provider = await this.withProvider(resource);

        if (!hasAccessCapability(provider)) {
            return false;
        }
        try {
            await provider.access(resource, mode);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Resolves the fs path of the given URI.
     *
     * USE WITH CAUTION: You should always prefer URIs to paths if possible, as they are
     * portable and platform independent. Paths should only be used in cases you directly
     * interact with the OS, e.g. when running a command on the shell.
     *
     * If you need to display human readable simple or long names then use `LabelProvider` instead.
     * @param resource `URI` of the resource that should be resolved.
     * @throws Will throw an error if no {@link FileSystemProvider} is registered for the given resource.
     *
     * @returns A promise of the resolved fs path.
     */
    async fsPath(resource: URI): Promise<string> {
        const provider = await this.withProvider(resource);

        if (!hasAccessCapability(provider)) {
            return resource.path.toString();
        }
        return provider.fsPath(resource);
    }

    // #region Text File Reading/Writing

    async create(resource: URI, value?: string | Readable<string>, options?: CreateTextFileOptions): Promise<FileStatWithMetadata> {
        if (options?.fromUserGesture === false) {
            return this.doCreate(resource, value, options);
        }
        await this.runFileOperationParticipants(resource, undefined, FileOperation.CREATE);

        const event = { correlationId: this.correlationIds++, operation: FileOperation.CREATE, target: resource };
        await this.onWillRunUserOperationEmitter.fire(event);

        let stat: FileStatWithMetadata;
        try {
            stat = await this.doCreate(resource, value, options);
        } catch (error) {
            await this.onDidFailUserOperationEmitter.fire(event);
            throw error;
        }

        await this.onDidRunUserOperationEmitter.fire(event);

        return stat;
    }

    protected async doCreate(resource: URI, value?: string | Readable<string>, options?: CreateTextFileOptions): Promise<FileStatWithMetadata> {
        const encoding = await this.getWriteEncoding(resource, options);
        const encoded = await this.encodingService.encodeStream(value, encoding);
        return this.createFile(resource, encoded, options);
    }

    async write(resource: URI, value: string | Readable<string>, options?: WriteTextFileOptions): Promise<FileStatWithMetadata & { encoding: string }> {
        const encoding = await this.getWriteEncoding(resource, options);
        const encoded = await this.encodingService.encodeStream(value, encoding);
        return Object.assign(await this.writeFile(resource, encoded, options), { encoding: encoding.encoding });
    }

    async read(resource: URI, options?: ReadTextFileOptions): Promise<TextFileContent> {
        const [bufferStream, decoder] = await this.doRead(resource, {
            ...options,
            // optimization: since we know that the caller does not
            // care about buffering, we indicate this to the reader.
            // this reduces all the overhead the buffered reading
            // has (open, read, close) if the provider supports
            // unbuffered reading.
            preferUnbuffered: true
        });

        return {
            ...bufferStream,
            encoding: decoder.detected.encoding || UTF8,
            value: await consumeStream(decoder.stream, strings => strings.join(''))
        };
    }

    async readStream(resource: URI, options?: ReadTextFileOptions): Promise<TextFileStreamContent> {
        const [bufferStream, decoder] = await this.doRead(resource, options);

        return {
            ...bufferStream,
            encoding: decoder.detected.encoding || UTF8,
            value: decoder.stream
        };
    }

    private async doRead(resource: URI, options?: ReadTextFileOptions & { preferUnbuffered?: boolean }): Promise<[FileStreamContent, DecodeStreamResult]> {
        options = this.resolveReadOptions(options);

        // read stream raw (either buffered or unbuffered)
        let bufferStream: FileStreamContent;
        if (options?.preferUnbuffered) {
            const content = await this.readFile(resource, options);
            bufferStream = {
                ...content,
                value: BinaryBufferReadableStream.fromBuffer(content.value)
            };
        } else {
            bufferStream = await this.readFileStream(resource, options);
        }

        const decoder = await this.encodingService.decodeStream(bufferStream.value, {
            guessEncoding: options.autoGuessEncoding,
            overwriteEncoding: detectedEncoding => this.getReadEncoding(resource, options, detectedEncoding)
        });

        // validate binary
        if (options?.acceptTextOnly && decoder.detected.seemsBinary) {
            throw new TextFileOperationError('File seems to be binary and cannot be opened as text', TextFileOperationResult.FILE_IS_BINARY, options);
        }

        return [bufferStream, decoder];
    }

    protected resolveReadOptions(options?: ReadTextFileOptions): ReadTextFileOptions {
        options = {
            ...options,
            autoGuessEncoding: typeof options?.autoGuessEncoding === 'boolean' ? options.autoGuessEncoding : this.preferences['files.autoGuessEncoding']
        };
        const limits: Mutable<ReadTextFileOptions['limits']> = options.limits = options.limits || {};
        if (typeof limits.size !== 'number') {
            limits.size = this.preferences['files.maxFileSizeMB'] * 1024 * 1024;
        }
        return options;
    }

    async update(resource: URI, changes: TextDocumentContentChangeEvent[], options: UpdateTextFileOptions): Promise<FileStatWithMetadata & { encoding: string }> {
        const provider = this.throwIfFileSystemIsReadonly(await this.withWriteProvider(resource), resource);
        try {
            await this.validateWriteFile(provider, resource, options);
            if (hasUpdateCapability(provider)) {
                const encoding = await this.getEncodingForResource(resource, options ? options.encoding : undefined);;
                const stat = await provider.updateFile(resource, changes, {
                    readEncoding: options.readEncoding,
                    writeEncoding: encoding,
                    overwriteEncoding: options.overwriteEncoding || false
                });
                return Object.assign(FileStat.fromStat(resource, stat), { encoding: stat.encoding });
            } else {
                throw new Error('incremental file update is not supported');
            }
        } catch (error) {
            this.rethrowAsFileOperationError('Unable to write file', resource, error, options);
        }
    }

    // #endregion

    // #region File Reading/Writing

    async createFile(resource: URI, bufferOrReadableOrStream: BinaryBuffer | BinaryBufferReadable | BinaryBufferReadableStream = BinaryBuffer.fromString(''), options?: CreateFileOptions): Promise<FileStatWithMetadata> {

        // validate overwrite
        if (!options?.overwrite && await this.exists(resource)) {
            throw new FileOperationError(`Unable to create file '${this.resourceForError(resource)}' that already exists when overwrite flag is not set`, FileOperationResult.FILE_MODIFIED_SINCE, options);
        }

        // do write into file (this will create it too)
        const fileStat = await this.writeFile(resource, bufferOrReadableOrStream);

        // events
        this.onDidRunOperationEmitter.fire(new FileOperationEvent(resource, FileOperation.CREATE, fileStat));

        return fileStat;
    }

    async writeFile(resource: URI, bufferOrReadableOrStream: BinaryBuffer | BinaryBufferReadable | BinaryBufferReadableStream, options?: WriteFileOptions): Promise<FileStatWithMetadata> {
        const provider = this.throwIfFileSystemIsReadonly(await this.withWriteProvider(resource), resource);

        try {

            // validate write
            const stat = await this.validateWriteFile(provider, resource, options);

            // mkdir recursively as needed
            if (!stat) {
                await this.mkdirp(provider, resource.parent);
            }

            // optimization: if the provider has unbuffered write capability and the data
            // to write is a Readable, we consume up to 3 chunks and try to write the data
            // unbuffered to reduce the overhead. If the Readable has more data to provide
            // we continue to write buffered.
            let bufferOrReadableOrStreamOrBufferedStream: BinaryBuffer | BinaryBufferReadable | BinaryBufferReadableStream | BinaryBufferReadableBufferedStream;
            if (hasReadWriteCapability(provider) && !(bufferOrReadableOrStream instanceof BinaryBuffer)) {
                if (isReadableStream(bufferOrReadableOrStream)) {
                    const bufferedStream = await peekStream(bufferOrReadableOrStream, 3);
                    if (bufferedStream.ended) {
                        bufferOrReadableOrStreamOrBufferedStream = BinaryBuffer.concat(bufferedStream.buffer);
                    } else {
                        bufferOrReadableOrStreamOrBufferedStream = bufferedStream;
                    }
                } else {
                    bufferOrReadableOrStreamOrBufferedStream = peekReadable(bufferOrReadableOrStream, data => BinaryBuffer.concat(data), 3);
                }
            } else {
                bufferOrReadableOrStreamOrBufferedStream = bufferOrReadableOrStream;
            }

            // write file: unbuffered (only if data to write is a buffer, or the provider has no buffered write capability)
            if (!hasOpenReadWriteCloseCapability(provider) || (hasReadWriteCapability(provider) && bufferOrReadableOrStreamOrBufferedStream instanceof BinaryBuffer)) {
                await this.doWriteUnbuffered(provider, resource, bufferOrReadableOrStreamOrBufferedStream);
            }

            // write file: buffered
            else {
                await this.doWriteBuffered(provider, resource, bufferOrReadableOrStreamOrBufferedStream instanceof BinaryBuffer ? BinaryBufferReadable.fromBuffer(bufferOrReadableOrStreamOrBufferedStream) : bufferOrReadableOrStreamOrBufferedStream);
            }
        } catch (error) {
            this.rethrowAsFileOperationError('Unable to write file', resource, error, options);
        }

        return this.resolve(resource, { resolveMetadata: true });
    }

    private async validateWriteFile(provider: FileSystemProvider, resource: URI, options?: WriteFileOptions): Promise<Stat | undefined> {
        let stat: Stat | undefined = undefined;
        try {
            stat = await provider.stat(resource);
        } catch (error) {
            return undefined; // file might not exist
        }

        // file cannot be directory
        if ((stat.type & FileType.Directory) !== 0) {
            throw new FileOperationError(`Unable to write file ${this.resourceForError(resource)} that is actually a directory`, FileOperationResult.FILE_IS_DIRECTORY, options);
        }

        if (this.modifiedSince(stat, options)) {
            throw new FileOperationError('File Modified Since', FileOperationResult.FILE_MODIFIED_SINCE, options);
        }

        return stat;
    }

    /**
     * Dirty write prevention: if the file on disk has been changed and does not match our expected
     * mtime and etag, we bail out to prevent dirty writing.
     *
     * First, we check for a mtime that is in the future before we do more checks. The assumption is
     * that only the mtime is an indicator for a file that has changed on disk.
     *
     * Second, if the mtime has advanced, we compare the size of the file on disk with our previous
     * one using the etag() function. Relying only on the mtime check has proven to produce false
     * positives due to file system weirdness (especially around remote file systems). As such, the
     * check for size is a weaker check because it can return a false negative if the file has changed
     * but to the same length. This is a compromise we take to avoid having to produce checksums of
     * the file content for comparison which would be much slower to compute.
     */
    protected modifiedSince(stat: Stat, options?: WriteFileOptions): boolean {
        return !!options && typeof options.mtime === 'number' && typeof options.etag === 'string' && options.etag !== ETAG_DISABLED &&
            typeof stat.mtime === 'number' && typeof stat.size === 'number' &&
            options.mtime < stat.mtime && options.etag !== etag({ mtime: options.mtime /* not using stat.mtime for a reason, see above */, size: stat.size });
    }

    async readFile(resource: URI, options?: ReadFileOptions): Promise<FileContent> {
        const provider = await this.withReadProvider(resource);

        const stream = await this.doReadAsFileStream(provider, resource, {
            ...options,
            // optimization: since we know that the caller does not
            // care about buffering, we indicate this to the reader.
            // this reduces all the overhead the buffered reading
            // has (open, read, close) if the provider supports
            // unbuffered reading.
            preferUnbuffered: true
        });

        return {
            ...stream,
            value: await BinaryBufferReadableStream.toBuffer(stream.value)
        };
    }

    async readFileStream(resource: URI, options?: ReadFileOptions): Promise<FileStreamContent> {
        const provider = await this.withReadProvider(resource);

        return this.doReadAsFileStream(provider, resource, options);
    }

    private async doReadAsFileStream(provider: FileSystemProviderWithFileReadWriteCapability | FileSystemProviderWithOpenReadWriteCloseCapability, resource: URI, options?: ReadFileOptions & { preferUnbuffered?: boolean }): Promise<FileStreamContent> {

        // install a cancellation token that gets cancelled
        // when any error occurs. this allows us to resolve
        // the content of the file while resolving metadata
        // but still cancel the operation in certain cases.
        const cancellableSource = new CancellationTokenSource();

        // validate read operation
        const statPromise = this.validateReadFile(resource, options).then(stat => stat, error => {
            cancellableSource.cancel();

            throw error;
        });

        try {

            // if the etag is provided, we await the result of the validation
            // due to the likelyhood of hitting a NOT_MODIFIED_SINCE result.
            // otherwise, we let it run in parallel to the file reading for
            // optimal startup performance.
            if (options && typeof options.etag === 'string' && options.etag !== ETAG_DISABLED) {
                await statPromise;
            }

            let fileStreamPromise: Promise<BinaryBufferReadableStream>;

            // read unbuffered (only if either preferred, or the provider has no buffered read capability)
            if (!(hasOpenReadWriteCloseCapability(provider) || hasFileReadStreamCapability(provider)) || (hasReadWriteCapability(provider) && options?.preferUnbuffered)) {
                fileStreamPromise = this.readFileUnbuffered(provider, resource, options);
            }

            // read streamed (always prefer over primitive buffered read)
            else if (hasFileReadStreamCapability(provider)) {
                fileStreamPromise = Promise.resolve(this.readFileStreamed(provider, resource, cancellableSource.token, options));
            }

            // read buffered
            else {
                fileStreamPromise = Promise.resolve(this.readFileBuffered(provider, resource, cancellableSource.token, options));
            }

            const [fileStat, fileStream] = await Promise.all([statPromise, fileStreamPromise]);

            return {
                ...fileStat,
                value: fileStream
            };
        } catch (error) {
            this.rethrowAsFileOperationError('Unable to read file', resource, error, options);
        }
    }

    private readFileStreamed(provider: FileSystemProviderWithFileReadStreamCapability, resource: URI, token: CancellationToken, options: ReadFileOptions = Object.create(null)): BinaryBufferReadableStream {
        const fileStream = provider.readFileStream(resource, options, token);

        return transform(fileStream, {
            data: data => data instanceof BinaryBuffer ? data : BinaryBuffer.wrap(data),
            error: error => this.asFileOperationError('Unable to read file', resource, error, options)
        }, data => BinaryBuffer.concat(data));
    }

    private readFileBuffered(provider: FileSystemProviderWithOpenReadWriteCloseCapability, resource: URI, token: CancellationToken, options: ReadFileOptions = Object.create(null)): BinaryBufferReadableStream {
        const stream = BinaryBufferWriteableStream.create();

        readFileIntoStream(provider, resource, stream, data => data, {
            ...options,
            bufferSize: this.BUFFER_SIZE,
            errorTransformer: error => this.asFileOperationError('Unable to read file', resource, error, options)
        }, token);

        return stream;
    }

    protected rethrowAsFileOperationError(message: string, resource: URI, error: Error, options?: ReadFileOptions & WriteFileOptions & CreateFileOptions): never {
        throw this.asFileOperationError(message, resource, error, options);
    }
    protected asFileOperationError(message: string, resource: URI, error: Error, options?: ReadFileOptions & WriteFileOptions & CreateFileOptions): FileOperationError {
        const fileOperationError = new FileOperationError(`${message} '${this.resourceForError(resource)}' (${ensureFileSystemProviderError(error).toString()})`,
            toFileOperationResult(error), options);
        fileOperationError.stack = `${fileOperationError.stack}\nCaused by: ${error.stack}`;
        return fileOperationError;
    }

    private async readFileUnbuffered(provider: FileSystemProviderWithFileReadWriteCapability, resource: URI, options?: ReadFileOptions): Promise<BinaryBufferReadableStream> {
        let buffer = await provider.readFile(resource);

        // respect position option
        if (options && typeof options.position === 'number') {
            buffer = buffer.slice(options.position);
        }

        // respect length option
        if (options && typeof options.length === 'number') {
            buffer = buffer.slice(0, options.length);
        }

        // Throw if file is too large to load
        this.validateReadFileLimits(resource, buffer.byteLength, options);

        return BinaryBufferReadableStream.fromBuffer(BinaryBuffer.wrap(buffer));
    }

    private async validateReadFile(resource: URI, options?: ReadFileOptions): Promise<FileStatWithMetadata> {
        const stat = await this.resolve(resource, { resolveMetadata: true });

        // Throw if resource is a directory
        if (stat.isDirectory) {
            throw new FileOperationError(`Unable to read file '${this.resourceForError(resource)}' that is actually a directory`, FileOperationResult.FILE_IS_DIRECTORY, options);
        }

        // Throw if file not modified since (unless disabled)
        if (options && typeof options.etag === 'string' && options.etag !== ETAG_DISABLED && options.etag === stat.etag) {
            throw new FileOperationError('File not modified since', FileOperationResult.FILE_NOT_MODIFIED_SINCE, options);
        }

        // Throw if file is too large to load
        this.validateReadFileLimits(resource, stat.size, options);

        return stat;
    }

    private validateReadFileLimits(resource: URI, size: number, options?: ReadFileOptions): void {
        if (options?.limits) {
            let tooLargeErrorResult: FileOperationResult | undefined = undefined;

            if (typeof options.limits.memory === 'number' && size > options.limits.memory) {
                tooLargeErrorResult = FileOperationResult.FILE_EXCEEDS_MEMORY_LIMIT;
            }

            if (typeof options.limits.size === 'number' && size > options.limits.size) {
                tooLargeErrorResult = FileOperationResult.FILE_TOO_LARGE;
            }

            if (typeof tooLargeErrorResult === 'number') {
                throw new FileOperationError(`Unable to read file '${this.resourceForError(resource)}' that is too large to open`, tooLargeErrorResult);
            }
        }
    }

    // #endregion

    // #region Move/Copy/Delete/Create Folder

    async move(source: URI, target: URI, options?: MoveFileOptions): Promise<FileStatWithMetadata> {
        if (options?.fromUserGesture === false) {
            return this.doMove(source, target, options.overwrite);
        }
        await this.runFileOperationParticipants(target, source, FileOperation.MOVE);

        const event = { correlationId: this.correlationIds++, operation: FileOperation.MOVE, target, source };
        await this.onWillRunUserOperationEmitter.fire(event);
        let stat: FileStatWithMetadata;
        try {
            stat = await this.doMove(source, target, options?.overwrite);
        } catch (error) {
            await this.onDidFailUserOperationEmitter.fire(event);
            throw error;
        }

        await this.onDidRunUserOperationEmitter.fire(event);
        return stat;
    }

    protected async doMove(source: URI, target: URI, overwrite?: boolean): Promise<FileStatWithMetadata> {
        const sourceProvider = this.throwIfFileSystemIsReadonly(await this.withWriteProvider(source), source);
        const targetProvider = this.throwIfFileSystemIsReadonly(await this.withWriteProvider(target), target);

        // move
        const mode = await this.doMoveCopy(sourceProvider, source, targetProvider, target, 'move', !!overwrite);

        // resolve and send events
        const fileStat = await this.resolve(target, { resolveMetadata: true });
        this.onDidRunOperationEmitter.fire(new FileOperationEvent(source, mode === 'move' ? FileOperation.MOVE : FileOperation.COPY, fileStat));

        return fileStat;
    }

    async copy(source: URI, target: URI, options?: CopyFileOptions): Promise<FileStatWithMetadata> {
        if (options?.fromUserGesture === false) {
            return this.doCopy(source, target, options.overwrite);
        }
        await this.runFileOperationParticipants(target, source, FileOperation.COPY);

        const event = { correlationId: this.correlationIds++, operation: FileOperation.COPY, target, source };
        await this.onWillRunUserOperationEmitter.fire(event);
        let stat: FileStatWithMetadata;
        try {
            stat = await this.doCopy(source, target, options?.overwrite);
        } catch (error) {
            await this.onDidFailUserOperationEmitter.fire(event);
            throw error;
        }

        await this.onDidRunUserOperationEmitter.fire(event);
        return stat;
    }

    protected async doCopy(source: URI, target: URI, overwrite?: boolean): Promise<FileStatWithMetadata> {
        const sourceProvider = await this.withReadProvider(source);
        const targetProvider = this.throwIfFileSystemIsReadonly(await this.withWriteProvider(target), target);

        // copy
        const mode = await this.doMoveCopy(sourceProvider, source, targetProvider, target, 'copy', !!overwrite);

        // resolve and send events
        const fileStat = await this.resolve(target, { resolveMetadata: true });
        this.onDidRunOperationEmitter.fire(new FileOperationEvent(source, mode === 'copy' ? FileOperation.COPY : FileOperation.MOVE, fileStat));

        return fileStat;
    }

    private async doMoveCopy(sourceProvider: FileSystemProvider, source: URI, targetProvider: FileSystemProvider, target: URI, mode: 'move' | 'copy', overwrite: boolean): Promise<'move' | 'copy'> {
        if (source.toString() === target.toString()) {
            return mode; // simulate node.js behaviour here and do a no-op if paths match
        }

        // validation
        const { exists, isSameResourceWithDifferentPathCase } = await this.doValidateMoveCopy(sourceProvider, source, targetProvider, target, mode, overwrite);

        // if target exists get valid target
        if (exists && !overwrite) {
            const parent = await this.resolve(target.parent);
            const name = isSameResourceWithDifferentPathCase ? target.path.name : target.path.name + '_copy';
            target = FileSystemUtils.generateUniqueResourceURI(target.parent, parent, name, target.path.ext);
        }

        // delete as needed (unless target is same resource with different path case)
        if (exists && !isSameResourceWithDifferentPathCase && overwrite) {
            await this.delete(target, { recursive: true });
        }

        // create parent folders
        await this.mkdirp(targetProvider, target.parent);

        // copy source => target
        if (mode === 'copy') {

            // same provider with fast copy: leverage copy() functionality
            if (sourceProvider === targetProvider && hasFileFolderCopyCapability(sourceProvider)) {
                await sourceProvider.copy(source, target, { overwrite });
            }

            // when copying via buffer/unbuffered, we have to manually
            // traverse the source if it is a folder and not a file
            else {
                const sourceFile = await this.resolve(source);
                if (sourceFile.isDirectory) {
                    await this.doCopyFolder(sourceProvider, sourceFile, targetProvider, target);
                } else {
                    await this.doCopyFile(sourceProvider, source, targetProvider, target);
                }
            }

            return mode;
        }

        // move source => target
        else {

            // same provider: leverage rename() functionality
            if (sourceProvider === targetProvider) {
                await sourceProvider.rename(source, target, { overwrite });

                return mode;
            }

            // across providers: copy to target & delete at source
            else {
                await this.doMoveCopy(sourceProvider, source, targetProvider, target, 'copy', overwrite);

                await this.delete(source, { recursive: true });

                return 'copy';
            }
        }
    }

    private async doCopyFile(sourceProvider: FileSystemProvider, source: URI, targetProvider: FileSystemProvider, target: URI): Promise<void> {

        // copy: source (buffered) => target (buffered)
        if (hasOpenReadWriteCloseCapability(sourceProvider) && hasOpenReadWriteCloseCapability(targetProvider)) {
            return this.doPipeBuffered(sourceProvider, source, targetProvider, target);
        }

        // copy: source (buffered) => target (unbuffered)
        if (hasOpenReadWriteCloseCapability(sourceProvider) && hasReadWriteCapability(targetProvider)) {
            return this.doPipeBufferedToUnbuffered(sourceProvider, source, targetProvider, target);
        }

        // copy: source (unbuffered) => target (buffered)
        if (hasReadWriteCapability(sourceProvider) && hasOpenReadWriteCloseCapability(targetProvider)) {
            return this.doPipeUnbufferedToBuffered(sourceProvider, source, targetProvider, target);
        }

        // copy: source (unbuffered) => target (unbuffered)
        if (hasReadWriteCapability(sourceProvider) && hasReadWriteCapability(targetProvider)) {
            return this.doPipeUnbuffered(sourceProvider, source, targetProvider, target);
        }
    }

    private async doCopyFolder(sourceProvider: FileSystemProvider, sourceFolder: FileStat, targetProvider: FileSystemProvider, targetFolder: URI): Promise<void> {

        // create folder in target
        await targetProvider.mkdir(targetFolder);

        // create children in target
        if (Array.isArray(sourceFolder.children)) {
            await Promise.all(sourceFolder.children.map(async sourceChild => {
                const targetChild = targetFolder.resolve(sourceChild.name);
                if (sourceChild.isDirectory) {
                    return this.doCopyFolder(sourceProvider, await this.resolve(sourceChild.resource), targetProvider, targetChild);
                } else {
                    return this.doCopyFile(sourceProvider, sourceChild.resource, targetProvider, targetChild);
                }
            }));
        }
    }

    private async doValidateMoveCopy(sourceProvider: FileSystemProvider, source: URI, targetProvider: FileSystemProvider, target: URI, mode: 'move' | 'copy', overwrite?: boolean): Promise<{ exists: boolean, isSameResourceWithDifferentPathCase: boolean }> {
        let isSameResourceWithDifferentPathCase = false;

        // Check if source is equal or parent to target (requires providers to be the same)
        if (sourceProvider === targetProvider) {
            const isPathCaseSensitive = !!(sourceProvider.capabilities & FileSystemProviderCapabilities.PathCaseSensitive);
            if (!isPathCaseSensitive) {
                isSameResourceWithDifferentPathCase = source.toString().toLowerCase() === target.toString().toLowerCase();
            }

            if (isSameResourceWithDifferentPathCase && mode === 'copy') {
                throw new Error(`Unable to copy when source '${this.resourceForError(source)}' is same as target '${this.resourceForError(target)}' with different path case on a case insensitive file system`);
            }

            if (!isSameResourceWithDifferentPathCase && target.isEqualOrParent(source, isPathCaseSensitive)) {
                throw new Error(`Unable to move/copy when source '${this.resourceForError(source)}' is parent of target '${this.resourceForError(target)}'.`);
            }
        }

        // Extra checks if target exists and this is not a rename
        const exists = await this.exists(target);
        if (exists && !isSameResourceWithDifferentPathCase) {

            // Special case: if the target is a parent of the source, we cannot delete
            // it as it would delete the source as well. In this case we have to throw
            if (sourceProvider === targetProvider) {
                const isPathCaseSensitive = !!(sourceProvider.capabilities & FileSystemProviderCapabilities.PathCaseSensitive);
                if (source.isEqualOrParent(target, isPathCaseSensitive)) {
                    throw new Error(`Unable to move/copy '${this.resourceForError(source)}' into '${this.resourceForError(target)}' since a file would replace the folder it is contained in.`);
                }
            }
        }

        return { exists, isSameResourceWithDifferentPathCase };
    }

    async createFolder(resource: URI): Promise<FileStatWithMetadata> {
        const provider = this.throwIfFileSystemIsReadonly(await this.withProvider(resource), resource);

        // mkdir recursively
        await this.mkdirp(provider, resource);

        // events
        const fileStat = await this.resolve(resource, { resolveMetadata: true });
        this.onDidRunOperationEmitter.fire(new FileOperationEvent(resource, FileOperation.CREATE, fileStat));

        return fileStat;
    }

    private async mkdirp(provider: FileSystemProvider, directory: URI): Promise<void> {
        const directoriesToCreate: string[] = [];

        // mkdir until we reach root
        while (!directory.path.isRoot) {
            try {
                const stat = await provider.stat(directory);
                if ((stat.type & FileType.Directory) === 0) {
                    throw new Error(`Unable to create folder ${this.resourceForError(directory)} that already exists but is not a directory`);
                }

                break; // we have hit a directory that exists -> good
            } catch (error) {

                // Bubble up any other error that is not file not found
                if (toFileSystemProviderErrorCode(error) !== FileSystemProviderErrorCode.FileNotFound) {
                    throw error;
                }

                // Upon error, remember directories that need to be created
                directoriesToCreate.push(directory.path.base);

                // Continue up
                directory = directory.parent;
            }
        }

        // Create directories as needed
        for (let i = directoriesToCreate.length - 1; i >= 0; i--) {
            directory = directory.resolve(directoriesToCreate[i]);

            try {
                await provider.mkdir(directory);
            } catch (error) {
                if (toFileSystemProviderErrorCode(error) !== FileSystemProviderErrorCode.FileExists) {
                    // For mkdirp() we tolerate that the mkdir() call fails
                    // in case the folder already exists. This follows node.js
                    // own implementation of fs.mkdir({ recursive: true }) and
                    // reduces the chances of race conditions leading to errors
                    // if multiple calls try to create the same folders
                    // As such, we only throw an error here if it is other than
                    // the fact that the file already exists.
                    // (see also https://github.com/microsoft/vscode/issues/89834)
                    throw error;
                }
            }
        }
    }

    async delete(resource: URI, options?: FileOperationOptions & Partial<FileDeleteOptions>): Promise<void> {
        if (options?.fromUserGesture === false) {
            return this.doDelete(resource, options);
        }
        await this.runFileOperationParticipants(resource, undefined, FileOperation.DELETE);

        const event = { correlationId: this.correlationIds++, operation: FileOperation.DELETE, target: resource };
        await this.onWillRunUserOperationEmitter.fire(event);
        try {
            await this.doDelete(resource, options);
        } catch (error) {
            await this.onDidFailUserOperationEmitter.fire(event);
            throw error;
        }

        await this.onDidRunUserOperationEmitter.fire(event);
    }

    protected async doDelete(resource: URI, options?: Partial<FileDeleteOptions>): Promise<void> {
        const provider = this.throwIfFileSystemIsReadonly(await this.withProvider(resource), resource);

        // Validate trash support
        const useTrash = !!options?.useTrash;
        if (useTrash && !(provider.capabilities & FileSystemProviderCapabilities.Trash)) {
            throw new Error(`Unable to delete file '${this.resourceForError(resource)}' via trash because provider does not support it.`);
        }

        // Validate delete
        const exists = await this.exists(resource);
        if (!exists) {
            throw new FileOperationError(`Unable to delete non-existing file '${this.resourceForError(resource)}'`, FileOperationResult.FILE_NOT_FOUND);
        }

        // Validate recursive
        const recursive = !!options?.recursive;
        if (!recursive && exists) {
            const stat = await this.resolve(resource);
            if (stat.isDirectory && Array.isArray(stat.children) && stat.children.length > 0) {
                throw new Error(`Unable to delete non-empty folder '${this.resourceForError(resource)}'.`);
            }
        }

        // Delete through provider
        await provider.delete(resource, { recursive, useTrash });

        // Events
        this.onDidRunOperationEmitter.fire(new FileOperationEvent(resource, FileOperation.DELETE));
    }

    // #endregion

    // #region File Watching

    private onDidFilesChangeEmitter = new Emitter<FileChangesEvent>();
    /**
     * An event that is emitted when files are changed on the disk.
     */
    readonly onDidFilesChange = this.onDidFilesChangeEmitter.event;

    private activeWatchers = new Map<string, { disposable: Disposable, count: number }>();

    watch(resource: URI, options: WatchOptions = { recursive: false, excludes: [] }): Disposable {
        const resolvedOptions: WatchOptions = {
            ...options,
            // always ignore temporary upload files
            excludes: options.excludes.concat('**/theia_upload_*')
        };

        let watchDisposed = false;
        let watchDisposable = Disposable.create(() => watchDisposed = true);

        // Watch and wire in disposable which is async but
        // check if we got disposed meanwhile and forward
        this.doWatch(resource, resolvedOptions).then(disposable => {
            if (watchDisposed) {
                disposable.dispose();
            } else {
                watchDisposable = disposable;
            }
        }, error => console.error(error));

        return Disposable.create(() => watchDisposable.dispose());
    }

    async doWatch(resource: URI, options: WatchOptions): Promise<Disposable> {
        const provider = await this.withProvider(resource);
        const key = this.toWatchKey(provider, resource, options);

        // Only start watching if we are the first for the given key
        const watcher = this.activeWatchers.get(key) || { count: 0, disposable: provider.watch(resource, options) };
        if (!this.activeWatchers.has(key)) {
            this.activeWatchers.set(key, watcher);
        }

        // Increment usage counter
        watcher.count += 1;

        return Disposable.create(() => {

            // Unref
            watcher.count--;

            // Dispose only when last user is reached
            if (watcher.count === 0) {
                watcher.disposable.dispose();
                this.activeWatchers.delete(key);
            }
        });
    }

    private toWatchKey(provider: FileSystemProvider, resource: URI, options: WatchOptions): string {
        return [
            this.toMapKey(provider, resource),  // lowercase path if the provider is case insensitive
            String(options.recursive),          // use recursive: true | false as part of the key
            options.excludes.join()             // use excludes as part of the key
        ].join();
    }

    // #endregion

    // #region Helpers

    private writeQueues: Map<string, Promise<void>> = new Map();

    private ensureWriteQueue(provider: FileSystemProvider, resource: URI, task: () => Promise<void>): Promise<void> {
        // ensure to never write to the same resource without finishing
        // the one write. this ensures a write finishes consistently
        // (even with error) before another write is done.
        const queueKey = this.toMapKey(provider, resource);
        const writeQueue = (this.writeQueues.get(queueKey) || Promise.resolve()).then(task, task);
        this.writeQueues.set(queueKey, writeQueue);
        return writeQueue;
    }

    private toMapKey(provider: FileSystemProvider, resource: URI): string {
        const isPathCaseSensitive = !!(provider.capabilities & FileSystemProviderCapabilities.PathCaseSensitive);

        return isPathCaseSensitive ? resource.toString() : resource.toString().toLowerCase();
    }

    private async doWriteBuffered(provider: FileSystemProviderWithOpenReadWriteCloseCapability, resource: URI, readableOrStreamOrBufferedStream: BinaryBufferReadable | BinaryBufferReadableStream | BinaryBufferReadableBufferedStream): Promise<void> {
        return this.ensureWriteQueue(provider, resource, async () => {

            // open handle
            const handle = await provider.open(resource, { create: true });

            // write into handle until all bytes from buffer have been written
            try {
                if (isReadableStream(readableOrStreamOrBufferedStream) || isReadableBufferedStream(readableOrStreamOrBufferedStream)) {
                    await this.doWriteStreamBufferedQueued(provider, handle, readableOrStreamOrBufferedStream);
                } else {
                    await this.doWriteReadableBufferedQueued(provider, handle, readableOrStreamOrBufferedStream);
                }
            } catch (error) {
                throw ensureFileSystemProviderError(error);
            } finally {

                // close handle always
                await provider.close(handle);
            }
        });
    }

    private async doWriteStreamBufferedQueued(provider: FileSystemProviderWithOpenReadWriteCloseCapability, handle: number, streamOrBufferedStream: BinaryBufferReadableStream | BinaryBufferReadableBufferedStream): Promise<void> {
        let posInFile = 0;
        let stream: BinaryBufferReadableStream;

        // Buffered stream: consume the buffer first by writing
        // it to the target before reading from the stream.
        if (isReadableBufferedStream(streamOrBufferedStream)) {
            if (streamOrBufferedStream.buffer.length > 0) {
                const chunk = BinaryBuffer.concat(streamOrBufferedStream.buffer);
                await this.doWriteBuffer(provider, handle, chunk, chunk.byteLength, posInFile, 0);

                posInFile += chunk.byteLength;
            }

            // If the stream has been consumed, return early
            if (streamOrBufferedStream.ended) {
                return;
            }

            stream = streamOrBufferedStream.stream;
        }

        // Unbuffered stream - just take as is
        else {
            stream = streamOrBufferedStream;
        }

        return new Promise(async (resolve, reject) => {

            stream.on('data', async chunk => {

                // pause stream to perform async write operation
                stream.pause();

                try {
                    await this.doWriteBuffer(provider, handle, chunk, chunk.byteLength, posInFile, 0);
                } catch (error) {
                    return reject(error);
                }

                posInFile += chunk.byteLength;

                // resume stream now that we have successfully written
                // run this on the next tick to prevent increasing the
                // execution stack because resume() may call the event
                // handler again before finishing.
                setTimeout(() => stream.resume());
            });

            stream.on('error', error => reject(error));
            stream.on('end', () => resolve());
        });
    }

    private async doWriteReadableBufferedQueued(provider: FileSystemProviderWithOpenReadWriteCloseCapability, handle: number, readable: BinaryBufferReadable): Promise<void> {
        let posInFile = 0;

        let chunk: BinaryBuffer | null;
        while ((chunk = readable.read()) !== null) {
            await this.doWriteBuffer(provider, handle, chunk, chunk.byteLength, posInFile, 0);

            posInFile += chunk.byteLength;
        }
    }

    private async doWriteBuffer(provider: FileSystemProviderWithOpenReadWriteCloseCapability, handle: number, buffer: BinaryBuffer, length: number, posInFile: number, posInBuffer: number): Promise<void> {
        let totalBytesWritten = 0;
        while (totalBytesWritten < length) {
            const bytesWritten = await provider.write(handle, posInFile + totalBytesWritten, buffer.buffer, posInBuffer + totalBytesWritten, length - totalBytesWritten);
            totalBytesWritten += bytesWritten;
        }
    }

    private async doWriteUnbuffered(provider: FileSystemProviderWithFileReadWriteCapability, resource: URI, bufferOrReadableOrStreamOrBufferedStream: BinaryBuffer | BinaryBufferReadable | BinaryBufferReadableStream | BinaryBufferReadableBufferedStream): Promise<void> {
        return this.ensureWriteQueue(provider, resource, () => this.doWriteUnbufferedQueued(provider, resource, bufferOrReadableOrStreamOrBufferedStream));
    }

    private async doWriteUnbufferedQueued(provider: FileSystemProviderWithFileReadWriteCapability, resource: URI, bufferOrReadableOrStreamOrBufferedStream: BinaryBuffer | BinaryBufferReadable | BinaryBufferReadableStream | BinaryBufferReadableBufferedStream): Promise<void> {
        let buffer: BinaryBuffer;
        if (bufferOrReadableOrStreamOrBufferedStream instanceof BinaryBuffer) {
            buffer = bufferOrReadableOrStreamOrBufferedStream;
        } else if (isReadableStream(bufferOrReadableOrStreamOrBufferedStream)) {
            buffer = await BinaryBufferReadableStream.toBuffer(bufferOrReadableOrStreamOrBufferedStream);
        } else if (isReadableBufferedStream(bufferOrReadableOrStreamOrBufferedStream)) {
            buffer = await BinaryBufferReadableBufferedStream.toBuffer(bufferOrReadableOrStreamOrBufferedStream);
        } else {
            buffer = BinaryBufferReadable.toBuffer(bufferOrReadableOrStreamOrBufferedStream);
        }

        return provider.writeFile(resource, buffer.buffer, { create: true, overwrite: true });
    }

    private async doPipeBuffered(sourceProvider: FileSystemProviderWithOpenReadWriteCloseCapability, source: URI, targetProvider: FileSystemProviderWithOpenReadWriteCloseCapability, target: URI): Promise<void> {
        return this.ensureWriteQueue(targetProvider, target, () => this.doPipeBufferedQueued(sourceProvider, source, targetProvider, target));
    }

    private async doPipeBufferedQueued(sourceProvider: FileSystemProviderWithOpenReadWriteCloseCapability, source: URI, targetProvider: FileSystemProviderWithOpenReadWriteCloseCapability, target: URI): Promise<void> {
        let sourceHandle: number | undefined = undefined;
        let targetHandle: number | undefined = undefined;

        try {

            // Open handles
            sourceHandle = await sourceProvider.open(source, { create: false });
            targetHandle = await targetProvider.open(target, { create: true });

            const buffer = BinaryBuffer.alloc(this.BUFFER_SIZE);

            let posInFile = 0;
            let posInBuffer = 0;
            let bytesRead = 0;
            do {
                // read from source (sourceHandle) at current position (posInFile) into buffer (buffer) at
                // buffer position (posInBuffer) up to the size of the buffer (buffer.byteLength).
                bytesRead = await sourceProvider.read(sourceHandle, posInFile, buffer.buffer, posInBuffer, buffer.byteLength - posInBuffer);

                // write into target (targetHandle) at current position (posInFile) from buffer (buffer) at
                // buffer position (posInBuffer) all bytes we read (bytesRead).
                await this.doWriteBuffer(targetProvider, targetHandle, buffer, bytesRead, posInFile, posInBuffer);

                posInFile += bytesRead;
                posInBuffer += bytesRead;

                // when buffer full, fill it again from the beginning
                if (posInBuffer === buffer.byteLength) {
                    posInBuffer = 0;
                }
            } while (bytesRead > 0);
        } catch (error) {
            throw ensureFileSystemProviderError(error);
        } finally {
            await Promise.all([
                typeof sourceHandle === 'number' ? sourceProvider.close(sourceHandle) : Promise.resolve(),
                typeof targetHandle === 'number' ? targetProvider.close(targetHandle) : Promise.resolve(),
            ]);
        }
    }

    private async doPipeUnbuffered(sourceProvider: FileSystemProviderWithFileReadWriteCapability, source: URI, targetProvider: FileSystemProviderWithFileReadWriteCapability, target: URI): Promise<void> {
        return this.ensureWriteQueue(targetProvider, target, () => this.doPipeUnbufferedQueued(sourceProvider, source, targetProvider, target));
    }

    private async doPipeUnbufferedQueued(sourceProvider: FileSystemProviderWithFileReadWriteCapability, source: URI, targetProvider: FileSystemProviderWithFileReadWriteCapability, target: URI): Promise<void> {
        return targetProvider.writeFile(target, await sourceProvider.readFile(source), { create: true, overwrite: true });
    }

    private async doPipeUnbufferedToBuffered(sourceProvider: FileSystemProviderWithFileReadWriteCapability, source: URI, targetProvider: FileSystemProviderWithOpenReadWriteCloseCapability, target: URI): Promise<void> {
        return this.ensureWriteQueue(targetProvider, target, () => this.doPipeUnbufferedToBufferedQueued(sourceProvider, source, targetProvider, target));
    }

    private async doPipeUnbufferedToBufferedQueued(sourceProvider: FileSystemProviderWithFileReadWriteCapability, source: URI, targetProvider: FileSystemProviderWithOpenReadWriteCloseCapability, target: URI): Promise<void> {

        // Open handle
        const targetHandle = await targetProvider.open(target, { create: true });

        // Read entire buffer from source and write buffered
        try {
            const buffer = await sourceProvider.readFile(source);
            await this.doWriteBuffer(targetProvider, targetHandle, BinaryBuffer.wrap(buffer), buffer.byteLength, 0, 0);
        } catch (error) {
            throw ensureFileSystemProviderError(error);
        } finally {
            await targetProvider.close(targetHandle);
        }
    }

    private async doPipeBufferedToUnbuffered(sourceProvider: FileSystemProviderWithOpenReadWriteCloseCapability, source: URI, targetProvider: FileSystemProviderWithFileReadWriteCapability, target: URI): Promise<void> {

        // Read buffer via stream buffered
        const buffer = await BinaryBufferReadableStream.toBuffer(this.readFileBuffered(sourceProvider, source, CancellationToken.None));

        // Write buffer into target at once
        await this.doWriteUnbuffered(targetProvider, target, buffer);
    }

    protected throwIfFileSystemIsReadonly<T extends FileSystemProvider>(provider: T, resource: URI): T {
        if (provider.capabilities & FileSystemProviderCapabilities.Readonly) {
            throw new FileOperationError(`Unable to modify readonly file ${this.resourceForError(resource)}`, FileOperationResult.FILE_PERMISSION_DENIED);
        }

        return provider;
    }

    private resourceForError(resource: URI): string {
        return this.labelProvider.getLongName(resource);
    }

    // #endregion

    // #region File operation participants

    private readonly participants: FileOperationParticipant[] = [];

    addFileOperationParticipant(participant: FileOperationParticipant): Disposable {
        this.participants.push(participant);

        return Disposable.create(() => {
            const index = this.participants.indexOf(participant);
            if (index > -1) {
                this.participants.splice(index, 1);
            }
        });
    }

    async runFileOperationParticipants(target: URI, source: URI | undefined, operation: FileOperation): Promise<void> {
        const participantsTimeout = this.preferences['files.participants.timeout'];
        if (participantsTimeout <= 0) {
            return;
        }

        const cancellationTokenSource = new CancellationTokenSource();

        return this.progressService.withProgress(this.progressLabel(operation), 'window', async () => {
            for (const participant of this.participants) {
                if (cancellationTokenSource.token.isCancellationRequested) {
                    break;
                }

                try {
                    const promise = participant.participate(target, source, operation, participantsTimeout, cancellationTokenSource.token);
                    await Promise.race([
                        promise,
                        timeout(participantsTimeout, cancellationTokenSource.token).then(() => cancellationTokenSource.dispose(), () => { /* no-op if cancelled */ })
                    ]);
                } catch (err) {
                    console.warn(err);
                }
            }
        });
    }

    private progressLabel(operation: FileOperation): string {
        switch (operation) {
            case FileOperation.CREATE:
                return "Running 'File Create' participants...";
            case FileOperation.MOVE:
                return "Running 'File Rename' participants...";
            case FileOperation.COPY:
                return "Running 'File Copy' participants...";
            case FileOperation.DELETE:
                return "Running 'File Delete' participants...";
        }
    }

    // #endregion

    // #region encoding

    protected async getWriteEncoding(resource: URI, options?: WriteEncodingOptions): Promise<ResourceEncoding> {
        const encoding = await this.getEncodingForResource(resource, options ? options.encoding : undefined);
        return this.encodingService.toResourceEncoding(encoding, {
            overwriteEncoding: options?.overwriteEncoding,
            read: async length => {
                const buffer = await BinaryBufferReadableStream.toBuffer((await this.readFileStream(resource, { length })).value);
                return buffer.buffer;
            }
        });
    }

    protected getReadEncoding(resource: URI, options?: ReadEncodingOptions, detectedEncoding?: string): Promise<string> {
        let preferredEncoding: string | undefined;

        // Encoding passed in as option
        if (options?.encoding) {
            if (detectedEncoding === UTF8_with_bom && options.encoding === UTF8) {
                preferredEncoding = UTF8_with_bom; // indicate the file has BOM if we are to resolve with UTF 8
            } else {
                preferredEncoding = options.encoding; // give passed in encoding highest priority
            }
        } else if (detectedEncoding) {
            preferredEncoding = detectedEncoding;
        }

        return this.getEncodingForResource(resource, preferredEncoding);
    }

    protected async getEncodingForResource(resource: URI, preferredEncoding?: string): Promise<string> {
        resource = await this.toUnderlyingResource(resource);
        return this.encodingRegistry.getEncodingForResource(resource, preferredEncoding);
    }

    /**
     * Converts to an underlying fs provider resource format.
     *
     * For example converting `user-storage` resources to `file` resources under a user home:
     * user-storage:/user/settings.json => file://home/.theia/settings.json
     */
    async toUnderlyingResource(resource: URI): Promise<URI> {
        let provider = await this.withProvider(resource);
        while (provider instanceof DelegatingFileSystemProvider) {
            resource = provider.toUnderlyingResource(resource);
            provider = await this.withProvider(resource);
        }
        return resource;
    }

    // #endregion

    protected handleFileWatchError(): void {
        this.watcherErrorHandler.handleError();
    }
}
