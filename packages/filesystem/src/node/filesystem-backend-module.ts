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

import * as path from 'path';
import { ContainerModule, interfaces } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler, ILogger } from '@theia/core/lib/common';
import { FileSystemWatcherServer, FileSystemWatcherService } from '../common/filesystem-watcher-protocol';
import { FileSystemWatcherServerClient } from './filesystem-watcher-client';
import { NsfwFileSystemWatcherService, NsfwFileSystemWatcherServerOptions } from './nsfw-watcher/nsfw-filesystem-service';
import { MessagingService } from '@theia/core/lib/node/messaging/messaging-service';
import { NodeFileUploadService } from './node-file-upload-service';
import { NsfwOptions } from './nsfw-watcher/nsfw-options';
import { DiskFileSystemProvider } from './disk-file-system-provider';
import {
    remoteFileSystemPath, RemoteFileSystemServer, RemoteFileSystemClient, FileSystemProviderServer, RemoteFileSystemProxyFactory
} from '../common/remote-file-system-provider';
import { FileSystemProvider } from '../common/files';
import { EncodingService } from '@theia/core/lib/common/encoding-service';
import { IPCConnectionProvider } from '@theia/core/lib/node';
import { JsonRpcProxyFactory, ConnectionErrorHandler } from '@theia/core';
import { FileSystemWatcherServiceDispatcher } from './filesystem-watcher-dispatcher';

export const NSFW_SINGLE_THREADED = process.argv.includes('--no-cluster');
export const NSFW_WATCHER_VERBOSE = process.argv.includes('--nsfw-watcher-verbose');

export const NsfwFileSystemWatcherServiceProcessOptions = Symbol('NsfwFileSystemWatcherServiceProcessOptions');
/**
 * Options to control the way the `NsfwFileSystemWatcherService` process is spawned.
 */
export interface NsfwFileSystemWatcherServiceProcessOptions {
    /**
     * Path to the script that will run the `NsfwFileSystemWatcherService` in a new process.
     */
    entryPoint: string;
}

export default new ContainerModule(bind => {
    bind(EncodingService).toSelf().inSingletonScope();
    bindFileSystemWatcherServer(bind);
    bind(DiskFileSystemProvider).toSelf();
    bind(FileSystemProvider).toService(DiskFileSystemProvider);
    bind(FileSystemProviderServer).toSelf();
    bind(RemoteFileSystemServer).toService(FileSystemProviderServer);
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler<RemoteFileSystemClient>(remoteFileSystemPath, client => {
            const server = ctx.container.get<RemoteFileSystemServer>(RemoteFileSystemServer);
            server.setClient(client);
            client.onDidCloseConnection(() => server.dispose());
            return server;
        }, RemoteFileSystemProxyFactory)
    ).inSingletonScope();
    bind(NodeFileUploadService).toSelf().inSingletonScope();
    bind(MessagingService.Contribution).toService(NodeFileUploadService);
});

export function bindFileSystemWatcherServer(bind: interfaces.Bind): void {
    bind<NsfwOptions>(NsfwOptions).toConstantValue({});

    bind(FileSystemWatcherServiceDispatcher).toSelf().inSingletonScope();

    bind(FileSystemWatcherServerClient).toSelf();
    bind(FileSystemWatcherServer).toService(FileSystemWatcherServerClient);

    bind<NsfwFileSystemWatcherServiceProcessOptions>(NsfwFileSystemWatcherServiceProcessOptions).toDynamicValue(ctx => ({
        entryPoint: path.join(__dirname, 'nsfw-watcher'),
    })).inSingletonScope();
    bind<NsfwFileSystemWatcherServerOptions>(NsfwFileSystemWatcherServerOptions).toDynamicValue(ctx => {
        const logger = ctx.container.get<ILogger>(ILogger);
        const nsfwOptions = ctx.container.get<NsfwOptions>(NsfwOptions);
        return {
            nsfwOptions,
            verbose: NSFW_WATCHER_VERBOSE,
            info: (message, ...args) => logger.info(message, ...args),
            error: (message, ...args) => logger.error(message, ...args),
        };
    }).inSingletonScope();

    bind<FileSystemWatcherService>(FileSystemWatcherService).toDynamicValue(
        ctx => NSFW_SINGLE_THREADED
            ? createNsfwFileSystemWatcherService(ctx)
            : spawnNsfwFileSystemWatcherServiceProcess(ctx)
    ).inSingletonScope();
}

/**
 * Run the watch server in the current process.
 */
export function createNsfwFileSystemWatcherService(ctx: interfaces.Context): FileSystemWatcherService {
    const options = ctx.container.get<NsfwFileSystemWatcherServerOptions>(NsfwFileSystemWatcherServerOptions);
    const dispatcher = ctx.container.get<FileSystemWatcherServiceDispatcher>(FileSystemWatcherServiceDispatcher);
    const server = new NsfwFileSystemWatcherService(options);
    server.setClient(dispatcher);
    return server;
}

/**
 * Run the watch server in a child process.
 * Return a proxy forwarding calls to the child process.
 */
export function spawnNsfwFileSystemWatcherServiceProcess(ctx: interfaces.Context): FileSystemWatcherService {
    const options = ctx.container.get<NsfwFileSystemWatcherServiceProcessOptions>(NsfwFileSystemWatcherServiceProcessOptions);
    const dispatcher = ctx.container.get<FileSystemWatcherServiceDispatcher>(FileSystemWatcherServiceDispatcher);
    const serverName = 'nsfw-watcher';
    const logger = ctx.container.get<ILogger>(ILogger);
    const nsfwOptions = ctx.container.get<NsfwOptions>(NsfwOptions);
    const ipcConnectionProvider = ctx.container.get<IPCConnectionProvider>(IPCConnectionProvider);
    const proxyFactory = new JsonRpcProxyFactory<FileSystemWatcherService>();
    const serverProxy = proxyFactory.createProxy();
    // We need to call `.setClient` before listening, else the JSON-RPC calls won't go through.
    serverProxy.setClient(dispatcher);
    const args: string[] = [
        `--nsfwOptions=${JSON.stringify(nsfwOptions)}`
    ];
    if (NSFW_WATCHER_VERBOSE) {
        args.push('--verbose');
    }
    ipcConnectionProvider.listen({
        serverName,
        entryPoint: options.entryPoint,
        errorHandler: new ConnectionErrorHandler({
            serverName,
            logger,
        }),
        env: process.env,
        args,
    }, connection => proxyFactory.listen(connection));
    return serverProxy;
}
