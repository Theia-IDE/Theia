/********************************************************************************
 * Copyright (C) 2021 TypeFox and others.
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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { injectable } from 'inversify';
import * as ws from 'ws';

export const HttpWebsocketAdapterFactory = Symbol('HttpWebsocketAdapterFactory');

@injectable()
export class HttpWebsocketAdapter {

    readyState: number = ws.OPEN;
    alive: boolean = true;

    protected pendingTimeout: NodeJS.Timeout | undefined;
    protected pendingMessages: unknown[] = [];
    protected pendingMessagesResolve?: (messages: unknown[]) => void;

    getPendingMessages(): Promise<unknown[]> {
        this.alive = true;
        return new Promise(resolve => {
            const messages = this.pendingMessages;
            if (messages.length > 0) {
                this.pendingMessagesResolve = undefined;
                resolve(messages);
                this.pendingMessages = [];
            } else {
                this.pendingMessagesResolve = resolve;
                this.pendingTimeout = setTimeout(() => {
                    resolve([]);
                    this.pendingMessagesResolve = undefined;
                    this.pendingTimeout = undefined;
                }, 4000);
            }
        });
    }

    onerror: (event: { error: any, message: string, type: string, target: WebSocket }) => void;
    onclose: (event: { wasClean: boolean; code: number; reason: string; target: WebSocket }) => void;
    onmessage: (data: string) => void;

    send(data: any): void {
        this.pendingMessages.push(data);
        if (this.pendingMessagesResolve) {
            if (this.pendingTimeout) {
                clearTimeout(this.pendingTimeout);
            }
            this.pendingMessagesResolve(this.pendingMessages);
            this.pendingMessagesResolve = undefined;
            this.pendingMessages = [];
        }
    }

    // Events
    on(event: 'close', listener: (this: WebSocket, code: number, reason: string) => void): this;
    on(event: 'error', listener: (this: WebSocket, err: Error) => void): this;
    on(event: 'message', listener: (this: WebSocket, data: ws.Data) => void): this;
    on(event: string | symbol, listener: (this: WebSocket, ...args: any[]) => void): this {
        if (event === 'error') {
            this.onerror = listener;
        } else if (event === 'message') {
            this.onmessage = listener;
        } else if (event === 'close') {
            this.onclose = listener;
        }
        return this;
    }
}
