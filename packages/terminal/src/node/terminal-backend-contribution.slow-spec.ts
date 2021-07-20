/********************************************************************************
 * Copyright (C) 2018 Ericsson and others.
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

import { createTerminalTestContainer } from './test/terminal-test-container';
import { BackendApplication } from '@theia/core/lib/node/backend-application';
import { IShellTerminalServer } from '../common/shell-terminal-protocol';
import * as http from 'http';
import * as https from 'https';
import { terminalsPath } from '../common/terminal-protocol';
import { TestWebSocketChannel } from '@theia/core/lib/node/messaging/test/test-web-socket-channel';

describe('Terminal Backend Contribution', function (): void {

    this.timeout(10000);
    let server: http.Server | https.Server;
    let shellTerminalServer: IShellTerminalServer;

    beforeEach(async () => {
        const container = createTerminalTestContainer();
        const application = container.get(BackendApplication);
        shellTerminalServer = container.get(IShellTerminalServer);
        server = await application.start();
    });

    afterEach(() => {
        const s = server;
        server = undefined!;
        shellTerminalServer = undefined!;
        s.close();
    });

    it('is data received from the terminal ws server', async () => {
        const terminalId = await shellTerminalServer.create({});
        await new Promise<void>((resolve, reject) => {
            const channel = new TestWebSocketChannel({ server, path: `${terminalsPath}/${terminalId}` });
            channel.onError(reject);
            channel.onClose((code, reason) => reject(new Error(`channel is closed with '${code}' code and '${reason}' reason`)));
            channel.onOpen(() => {
                resolve();
                channel.close();
            });
        });
    });
});
