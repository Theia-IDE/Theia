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

import 'reflect-metadata';
import dynamicRequire = require('@theia/dynamic-require');
import { ConsoleLogger } from 'vscode-ws-jsonrpc/lib/logger';
import { createMessageConnection, IPCMessageReader, IPCMessageWriter, Trace } from 'vscode-ws-jsonrpc';
import { checkParentAlive, IPCEntryPoint } from './ipc-protocol';

checkParentAlive();

const entryPoint = IPCEntryPoint.getScriptFromEnv();
const reader = new IPCMessageReader(process);
const writer = new IPCMessageWriter(process);
const logger = new ConsoleLogger();
const connection = createMessageConnection(reader, writer, logger);
connection.trace(Trace.Off, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    log: (message: any, data?: string) => console.log(message, data)
});

dynamicRequire<{ default: IPCEntryPoint }>(entryPoint).default(connection);
