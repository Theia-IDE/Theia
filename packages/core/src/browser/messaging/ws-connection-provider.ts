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

import { injectable, interfaces, decorate, unmanaged, inject } from 'inversify';
import { JsonRpcProxyFactory, JsonRpcProxy, Emitter, Event, MessageService, MessageServiceFactory } from '../../common';
import { WebSocketChannel } from '../../common/messaging/web-socket-channel';
import { Endpoint } from '../endpoint';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { AbstractConnectionProvider } from '../../common/messaging/abstract-connection-provider';
import { v4 as uuid } from 'uuid';

decorate(injectable(), JsonRpcProxyFactory);
decorate(unmanaged(), JsonRpcProxyFactory, 0);

export interface WebSocketOptions {
    /**
     * True by default.
     */
    reconnecting?: boolean;
}

export interface HttpFallbackOptions {
    /** Determines whether Theia is allowed to use the http fallback. True by default. */
    allowed: boolean;
    /** Amount of failed websocket connections attempts before the fallback is triggered. 2 by default. */
    trigger: number;
    /** The maximum duration after which the http request should timeout. 5000 by default. */
    pollingTimeout: number;
    /** The timeout duration (in ms) after a request was answered with an error code. 5000 by default. */
    errorTimeout: number;
    /** The minimum timeout duration (in ms) between two http requests. 0 by default. */
    requestTimeout: number;
}

@injectable()
export class WebSocketConnectionProvider extends AbstractConnectionProvider<WebSocketOptions> {

    protected readonly onSocketDidOpenEmitter: Emitter<void> = new Emitter();
    readonly onSocketDidOpen: Event<void> = this.onSocketDidOpenEmitter.event;

    protected readonly onSocketDidCloseEmitter: Emitter<void> = new Emitter();
    readonly onSocketDidClose: Event<void> = this.onSocketDidCloseEmitter.event;

    protected readonly onHttpFallbackDidActivateEmitter: Emitter<void> = new Emitter();
    readonly onHttpFallbackDidActivate: Event<void> = this.onHttpFallbackDidActivateEmitter.event;

    static createProxy<T extends object>(container: interfaces.Container, path: string, arg?: object): JsonRpcProxy<T> {
        return container.get(WebSocketConnectionProvider).createProxy<T>(path, arg);
    }

    @inject(MessageServiceFactory) protected readonly messageService: () => MessageService;

    protected readonly socket: ReconnectingWebSocket;
    protected useHttpFallback = false;
    protected httpFallbackCounter = 0;
    protected httpFallbackId = uuid();
    protected httpFallbackDisconnected = true;
    protected httpFallbackOptions: HttpFallbackOptions = {
        allowed: true,
        trigger: 2,
        errorTimeout: 5000,
        pollingTimeout: 5000,
        requestTimeout: 0
    };

    constructor() {
        super();
        const url = this.createWebSocketUrl(WebSocketChannel.wsPath);
        const socket = this.createWebSocket(url);
        socket.onerror = event => this.handleSocketError(event);
        socket.onopen = () => {
            this.fireSocketDidOpen();
        };
        socket.onclose = ({ code, reason }) => {
            for (const channel of [...this.channels.values()]) {
                channel.close(code, reason);
            }
            this.fireSocketDidClose();
        };
        socket.onmessage = ({ data }) => {
            this.httpFallbackCounter = 0;
            this.handleIncomingRawMessage(data);
        };
        this.socket = socket;
        window.addEventListener('offline', () => this.tryReconnect());
        window.addEventListener('online', () => this.tryReconnect());
    }

    handleSocketError(event: unknown): void {
        this.httpFallbackCounter += 1;
        if (this.httpFallbackOptions.allowed && this.httpFallbackCounter >= this.httpFallbackOptions.trigger) {
            this.useHttpFallback = true;
            this.socket.close();
            const httpUrl = this.createHttpWebSocketUrl(WebSocketChannel.wsPath);
            this.onHttpFallbackDidActivateEmitter.fire(undefined);
            this.longPolling(httpUrl);
            this.messageService().warn(
                'Could not establish a websocket connection. The application will be using the HTTP fallback mode. This may affect performance and the behavior of some features.'
            );
        }
        console.error(event);
    }

    async longPolling(url: string): Promise<void> {
        let timeoutDuration = this.httpFallbackOptions.requestTimeout;
        const controller = new AbortController();
        const pollingId = window.setTimeout(() => controller.abort(), this.httpFallbackOptions.pollingTimeout);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal,
                keepalive: true,
                body: JSON.stringify({ id: this.httpFallbackId, polling: true })
            });
            if (response.status === 200) {
                window.clearTimeout(pollingId);
                if (this.httpFallbackDisconnected) {
                    this.fireSocketDidOpen();
                }
                const json: string[] = await response.json();
                if (Array.isArray(json)) {
                    for (const item of json) {
                        this.handleIncomingRawMessage(item);
                    }
                } else {
                    throw new Error('Received invalid long polling response.');
                }
            } else if (response.status >= 400) {
                timeoutDuration = this.httpFallbackOptions.errorTimeout;
                this.httpFallbackDisconnected = true;
                this.fireSocketDidClose();
                throw new Error('Response has no valid status code: ' + response.status);
            }
        } catch (e) {
            console.error('Error occured during long polling', e);
        }
        setTimeout(() => this.longPolling(url), timeoutDuration);
    }

    openChannel(path: string, handler: (channel: WebSocketChannel) => void, options?: WebSocketOptions): void {
        if (this.useHttpFallback || this.socket.readyState === WebSocket.OPEN) {
            super.openChannel(path, handler, options);
        } else {
            const openChannel = () => {
                this.socket.removeEventListener('open', openChannel);
                this.openChannel(path, handler, options);
            };
            this.socket.addEventListener('open', openChannel);
            this.onHttpFallbackDidActivate(openChannel);
        }
    }

    protected createChannel(id: number): WebSocketChannel {
        const httpUrl = this.createHttpWebSocketUrl(WebSocketChannel.wsPath);
        return new WebSocketChannel(id, content => {
            if (this.useHttpFallback) {
                fetch(httpUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ id: this.httpFallbackId, content })
                });
            } else if (this.socket.readyState < WebSocket.CLOSING) {
                this.socket.send(content);
            }
        });
    }

    /**
     * Creates a websocket URL to the current location
     */
    protected createWebSocketUrl(path: string): string {
        const endpoint = new Endpoint({ path });
        return endpoint.getWebSocketUrl().toString();
    }

    protected createHttpWebSocketUrl(path: string): string {
        const endpoint = new Endpoint({ path });
        return endpoint.getRestUrl().toString();
    }

    /**
     * Creates a web socket for the given url
     */
    protected createWebSocket(url: string): ReconnectingWebSocket {
        return new ReconnectingWebSocket(url, undefined, {
            maxReconnectionDelay: 10000,
            minReconnectionDelay: 1000,
            reconnectionDelayGrowFactor: 1.3,
            connectionTimeout: 10000,
            maxRetries: Infinity,
            debug: false
        });
    }

    protected fireSocketDidOpen(): void {
        this.onSocketDidOpenEmitter.fire(undefined);
    }

    protected fireSocketDidClose(): void {
        this.onSocketDidCloseEmitter.fire(undefined);
    }

    protected tryReconnect(): void {
        if (!this.useHttpFallback && this.socket.readyState !== WebSocket.CONNECTING) {
            this.socket.reconnect();
        }
    }

}
