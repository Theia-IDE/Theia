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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Disposable } from './disposable';
import { MaybePromise } from './types';

/**
 * Represents a typed event.
 */
export interface Event<T> {

    /**
     *
     * @param listener The listener function will be call when the event happens.
     * @param thisArgs The 'this' which will be used when calling the event listener.
     * @param disposables An array to which a {{IDisposable}} will be added.
     * @return a disposable to remove the listener again.
     */
    (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]): Disposable;
    /**
     * An emitter will print a warning if more listeners are added for this event.
     * The event.maxListeners allows the limit to be modified for this specific event.
     * The value can be set to 0 to indicate an unlimited number of listener.
     */
    maxListeners: number
}

export namespace Event {
    const _disposable = { dispose(): void { } };
    export const None: Event<any> = Object.assign(function (): { dispose(): void } { return _disposable; }, {
        get maxListeners(): number { return 0; },
        set maxListeners(maxListeners: number) { }
    });

    /**
     * Given an event and a `map` function, returns another event which maps each element
     * through the mapping function.
     */
    export function map<I, O>(event: Event<I>, mapFunc: (i: I) => O): Event<O> {
        return Object.assign((listener: (e: O) => any, thisArgs?: any, disposables?: Disposable[]) => event(i => listener.call(thisArgs, mapFunc(i)), undefined, disposables), {
            maxListeners: 0,
        });
    }
}

type Callback = (...args: any[]) => any;
class CallbackList implements Iterable<Callback> {

    private _callbacks: Function[] | undefined;
    private _contexts: any[] | undefined;

    get length(): number {
        return this._callbacks && this._callbacks.length || 0;
    }

    public add(callback: Function, context: any = undefined, bucket?: Disposable[]): void {
        if (!this._callbacks) {
            this._callbacks = [];
            this._contexts = [];
        }
        this._callbacks.push(callback);
        this._contexts!.push(context);

        if (Array.isArray(bucket)) {
            bucket.push({ dispose: () => this.remove(callback, context) });
        }
    }

    public remove(callback: Function, context: any = undefined): void {
        if (!this._callbacks) {
            return;
        }

        let foundCallbackWithDifferentContext = false;
        for (let i = 0; i < this._callbacks.length; i++) {
            if (this._callbacks[i] === callback) {
                if (this._contexts![i] === context) {
                    // callback & context match => remove it
                    this._callbacks.splice(i, 1);
                    this._contexts!.splice(i, 1);
                    return;
                } else {
                    foundCallbackWithDifferentContext = true;
                }
            }
        }

        if (foundCallbackWithDifferentContext) {
            throw new Error('When adding a listener with a context, you should remove it with the same context');
        }
    }

    // tslint:disable-next-line:typedef
    public [Symbol.iterator]() {
        if (!this._callbacks) {
            return [][Symbol.iterator]();
        }
        const callbacks = this._callbacks.slice(0);
        const contexts = this._contexts!.slice(0);

        return callbacks.map((callback, i) =>
            (...args: any[]) => callback.apply(contexts[i], args)
        )[Symbol.iterator]();
    }

    public invoke(...args: any[]): any[] {
        const ret: any[] = [];
        for (const callback of this) {
            try {
                ret.push(callback(...args));
            } catch (e) {
                console.error(e);
            }
        }
        return ret;
    }

    public isEmpty(): boolean {
        return !this._callbacks || this._callbacks.length === 0;
    }

    public dispose(): void {
        this._callbacks = undefined;
        this._contexts = undefined;
    }
}

export interface EmitterOptions {
    onFirstListenerAdd?: Function;
    onLastListenerRemove?: Function;
}

export class Emitter<T = any> {

    private static LEAK_WARNING_THRESHHOLD = 175;

    private static _noop = function (): void { };

    private _event: Event<T>;
    protected _callbacks: CallbackList | undefined;
    private _disposed = false;

    private _leakingStacks: Map<string, number> | undefined;
    private _leakWarnCountdown = 0;

    constructor(
        private _options?: EmitterOptions
    ) { }

    /**
     * For the public to allow to subscribe
     * to events from this Emitter
     */
    get event(): Event<T> {
        if (!this._event) {
            this._event = Object.assign((listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]) => {
                if (!this._callbacks) {
                    this._callbacks = new CallbackList();
                }
                if (this._options && this._options.onFirstListenerAdd && this._callbacks.isEmpty()) {
                    this._options.onFirstListenerAdd(this);
                }
                this._callbacks.add(listener, thisArgs);
                const removeMaxListenersCheck = this.checkMaxListeners(this._event.maxListeners);

                const result: Disposable = {
                    dispose: () => {
                        if (removeMaxListenersCheck) {
                            removeMaxListenersCheck();
                        }
                        result.dispose = Emitter._noop;
                        if (!this._disposed) {
                            this._callbacks!.remove(listener, thisArgs);
                            result.dispose = Emitter._noop;
                            if (this._options && this._options.onLastListenerRemove && this._callbacks!.isEmpty()) {
                                this._options.onLastListenerRemove(this);
                            }
                        }
                    }
                };
                if (Array.isArray(disposables)) {
                    disposables.push(result);
                }

                return result;
            }, {
                maxListeners: Emitter.LEAK_WARNING_THRESHHOLD
            }
            );
        }
        return this._event;
    }

    protected checkMaxListeners(maxListeners: number): (() => void) | undefined {
        if (maxListeners === 0 || !this._callbacks) {
            return undefined;
        }
        const listenerCount = this._callbacks.length;
        if (listenerCount <= maxListeners) {
            return undefined;
        }

        const popStack = this.pushLeakingStack();

        this._leakWarnCountdown -= 1;
        if (this._leakWarnCountdown <= 0) {
            // only warn on first exceed and then every time the limit
            // is exceeded by 50% again
            this._leakWarnCountdown = maxListeners * 0.5;

            let topStack: string;
            let topCount = 0;
            this._leakingStacks!.forEach((stackCount, stack) => {
                if (!topStack || topCount < stackCount) {
                    topStack = stack;
                    topCount = stackCount;
                }
            });

            // eslint-disable-next-line max-len
            console.warn(`Possible Emitter memory leak detected. ${listenerCount} listeners added. Use event.maxListeners to increase the limit (${maxListeners}). MOST frequent listener (${topCount}):`);
            console.warn(topStack!);
        }

        return popStack;
    }

    protected pushLeakingStack(): () => void {
        if (!this._leakingStacks) {
            this._leakingStacks = new Map();
        }
        const stack = new Error().stack!.split('\n').slice(3).join('\n');
        const count = (this._leakingStacks.get(stack) || 0);
        this._leakingStacks.set(stack, count + 1);
        return () => this.popLeakingStack(stack);
    }

    protected popLeakingStack(stack: string): void {
        if (!this._leakingStacks) {
            return;
        }
        const count = (this._leakingStacks.get(stack) || 0);
        this._leakingStacks.set(stack, count - 1);
    }

    /**
     * To be kept private to fire an event to
     * subscribers
     */
    fire(event: T): any {
        if (this._callbacks) {
            this._callbacks.invoke(event);
        }
    }

    /**
     * Process each listener one by one.
     * Return `false` to stop iterating over the listeners, `true` to continue.
     */
    async sequence(processor: (listener: (e: T) => any) => MaybePromise<boolean>): Promise<void> {
        if (this._callbacks) {
            for (const listener of this._callbacks) {
                if (!await processor(listener)) {
                    break;
                }
            }
        }
    }

    dispose(): void {
        if (this._leakingStacks) {
            this._leakingStacks.clear();
            this._leakingStacks = undefined;
        }
        if (this._callbacks) {
            this._callbacks.dispose();
            this._callbacks = undefined;
        }
        this._disposed = true;
    }
}

export interface WaitUntilEvent {
    /**
     * Allows to pause the event loop until the provided thenable resolved.
     *
     * *Note:* It can only be called during event dispatch and not in an asynchronous manner
     *
     * @param thenable A thenable that delays execution.
     */
    waitUntil(thenable: Promise<any>): void;
}
export namespace WaitUntilEvent {
    /**
     * Fire all listeners in the same tick.
     *
     * Use `AsyncEmitter.fire` to fire listeners async one after another.
     */
    export async function fire<T>(
        emitter: Emitter<T & WaitUntilEvent>,
        event: Omit<T, 'waitUntil'>,
        timeout: number | undefined = undefined
    ): Promise<void> {
        const waitables: Promise<void>[] = [];
        (event as any as WaitUntilEvent).waitUntil = thenable => {
            if (Object.isFrozen(waitables)) {
                throw new Error('waitUntil cannot be called asynchronously.');
            }
            waitables.push(thenable);
        };
        try {
            emitter.fire(event as T & WaitUntilEvent);
            // Asynchronous calls to `waitUntil` should fail.
            Object.freeze(waitables);
        } finally {
            delete (event as Partial<WaitUntilEvent>).waitUntil;
        }
        if (!waitables.length) {
            return;
        }
        if (timeout !== undefined) {
            await Promise.race([Promise.all(waitables), new Promise(resolve => setTimeout(resolve, timeout))]);
        } else {
            await Promise.all(waitables);
        }
    }
}

import { CancellationToken } from './cancellation';

export class AsyncEmitter<T> extends Emitter<T & WaitUntilEvent> {

    protected deliveryQueue?: Promise<void>;

    /**
     * Fire listeners async one after another.
     */
    async fire(
        event: Omit<T, 'waitUntil'>,
        token: CancellationToken = CancellationToken.None,
        promiseJoin?: (p: Promise<any>, listener: Function) => Promise<any>
    ): Promise<void> {
        const callbacks = this._callbacks;
        if (!callbacks) {
            return;
        }
        const listeners = [...callbacks];
        if (this.deliveryQueue) {
            return this.deliveryQueue = this.deliveryQueue.then(() => this.deliver(listeners, event, token, promiseJoin));
        }
        return this.deliveryQueue = this.deliver(listeners, event, token, promiseJoin);
    }

    protected async deliver(
        listeners: Callback[],
        event: Omit<T, 'waitUntil'>,
        token: CancellationToken,
        promiseJoin?: (p: Promise<any>, listener: Function) => Promise<any>
    ): Promise<void> {
        for (const listener of listeners) {
            if (token.isCancellationRequested) {
                return;
            }
            const waitables: Promise<void>[] = [];
            (event as any as WaitUntilEvent).waitUntil = thenable => {
                if (Object.isFrozen(waitables)) {
                    throw new Error('waitUntil cannot be called asynchronously.');
                }
                if (promiseJoin) {
                    thenable = promiseJoin(thenable, listener);
                }
                waitables.push(thenable);
            };
            try {
                listener(event);
                // Asynchronous calls to `waitUntil` should fail.
                Object.freeze(waitables);
            } finally {
                delete (event as Partial<WaitUntilEvent>).waitUntil;
            }
            if (!waitables.length) {
                return;
            }
            try {
                await Promise.all(waitables);
            } catch (e) {
                console.error(e);
            }
        }
    }

}
