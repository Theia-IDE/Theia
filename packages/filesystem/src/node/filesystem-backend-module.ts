/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule } from "inversify";
import { ConnectionHandler, JsonRpcConnectionHandler } from "@theia/core/lib/common";
import { FileSystemNode } from './node-filesystem';
import { FileSystemWatcher, FileSystem, fileSystemPath, bindFileSystemPreferences } from "../common";
import { FileSystemWatcherServer, FileSystemWatcherClient, fileSystemWatcherPath } from '../common/filesystem-watcher-protocol';
import { ChokidarFileSystemWatcherServer } from './chokidar-filesystem-watcher';

export default new ContainerModule(bind => {
    bindFileSystemPreferences(bind);

    bind(FileSystemNode).toSelf().inSingletonScope();
    bind(FileSystem).toDynamicValue(ctx => ctx.container.get(FileSystemNode)).inSingletonScope();

    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(fileSystemPath, () =>
            ctx.container.get(FileSystem)
        )
    ).inSingletonScope();

    bind(ChokidarFileSystemWatcherServer).toSelf();
    bind(FileSystemWatcherServer).toDynamicValue(ctx =>
        ctx.container.get(ChokidarFileSystemWatcherServer)
    );
    bind(FileSystemWatcher).toSelf();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler<FileSystemWatcherClient>(fileSystemWatcherPath, client => {
            const server = ctx.container.get<FileSystemWatcherServer>(FileSystemWatcherServer);
            server.setClient(client);
            client.onDidCloseConnection(() => server.dispose());
            return server;
        })
    ).inSingletonScope();
});
