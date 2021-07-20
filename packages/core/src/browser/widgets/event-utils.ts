/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
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

export interface Handler<T> { (stimulus: T): unknown; }
export const isReactEvent = (event?: object): event is { persist(): unknown } => !!event && 'persist' in event;
export interface MinimalEvent {
    type: string;
    __superseded?: boolean;
}
export interface ClickHandlerOptions {
    /**
     * Time in milliseconds to wait for a second click.
     */
    timeout: number;
    /**
     * If `true`, the single-click handler will be invoked immediately on the first click. If true, `invokeSingleOnDouble` is ignored.
     * Use this option with caution: if the single-click handler triggers a rerender, it may invalidate or ignore the state of the handlers
     * created here.
     */
    invokeImmediately?: boolean;
    /**
     * If `true`, the single click handler will be invoked and awaited before the double-click handler is invoked.
     * Ignored if `invokeImmediately` is `true`.
     */
    invokeSingleOnDouble?: boolean;
}

/**
 * @returns a single handler that should be applied to be both 'click' and 'dblclick' events for a given element.
 * If the user clicks once in the interval specified, the single-click handler will be invoked.
 * If the user clicks twice in the interval, *only* the double-click handler will be invoked.
 */
export function createClickEventHandler<T extends MinimalEvent>(
    singleClickHandler: Handler<T>,
    doubleClickHandler: Handler<T>,
    options: ClickHandlerOptions,
): Handler<T> {
    const { timeout, invokeImmediately, invokeSingleOnDouble } = options;
    const shouldInvokeSingleOnDouble = invokeSingleOnDouble && !invokeImmediately;
    let deferredEvent: T | undefined;
    return async (event: T): Promise<void> => {
        if (isReactEvent(event)) {
            event.persist();
        }
        if (!deferredEvent && event.type === 'click') {
            deferredEvent = event;
            if (invokeImmediately) {
                singleClickHandler(event);
            }
            await new Promise(resolve => setTimeout(resolve, timeout));
            if (!event.__superseded) { // No double click has occurred.
                deferredEvent = undefined;
                if (!invokeImmediately) { // We haven't run it yet.
                    singleClickHandler(event);
                }
            }
        } else if (event.type === 'dblclick') {
            if (deferredEvent) {
                deferredEvent.__superseded = true;
                if (shouldInvokeSingleOnDouble) {
                    const eventToHandle = deferredEvent;
                    deferredEvent = undefined; // Clear state immediately in case of triple click.
                    try {
                        await singleClickHandler(eventToHandle);
                    } catch { }
                }
            }
            doubleClickHandler(event);
        }
    };
}
