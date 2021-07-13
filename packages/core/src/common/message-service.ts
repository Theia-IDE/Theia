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

import { injectable, inject } from 'inversify';
import {
    MessageClient,
    MessageType,
    MessageOptions,
    Progress,
    ProgressUpdate,
    ProgressMessage
} from './message-service-protocol';
import { CancellationTokenSource } from './cancellation';

export const MessageServiceFactory = Symbol('MessageServiceFactory');

/**
 * Service to log and categorize messages, show progress information and offer actions.
 *
 * The messages are processed by this service and forwarded to an injected {@link MessageClient}.
 * For example "@theia/messages" provides such a client, rendering messages as notifications
 * in the frontend.
 *
 * ### Example usage
 *
 * ```typescript
 *   @inject(MessageService)
 *   protected readonly messageService: MessageService;
 *
 *   messageService.warn("Typings not available");
 *
 *   messageService.error("Could not restore state", ["Rollback", "Ignore"])
 *   .then(action => action === "Rollback" && rollback());
 * ```
 */
@injectable()
export class MessageService {

    constructor(
        @inject(MessageClient) protected readonly client: MessageClient
    ) { }

    /**
     * Logs the message and, if given, offers actions to act on it.
     * @param message the message to log.
     * @param actions the actions to offer. Can be omitted.
     *
     * @returns the selected action if there is any, `undefined` when there was no action or none was selected.
     */
    log<T extends string>(message: string, ...actions: T[]): Promise<T | undefined>;
    /**
     * Logs the message and, if given, offers actions to act on it.
     * @param message the message to log.
     * @param options additional options. Can be omitted
     * @param actions the actions to offer. Can be omitted.
     *
     * @returns the selected action if there is any, `undefined` when there was no action or none was selected.
     */
    log<T extends string>(message: string, options?: MessageOptions, ...actions: T[]): Promise<T | undefined>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    log(message: string, ...args: any[]): Promise<string | undefined> {
        return this.processMessage(MessageType.Log, message, args);
    }

    /**
     * Logs the message as "info" and, if given, offers actions to act on it.
     * @param message the message to log.
     * @param actions the actions to offer. Can be omitted.
     *
     * @returns the selected action if there is any, `undefined` when there was no action or none was selected.
     */
    info<T extends string>(message: string, ...actions: T[]): Promise<T | undefined>;
    /**
     * Logs the message as "info" and, if given, offers actions to act on it.
     * @param message the message to log.
     * @param options additional options. Can be omitted
     * @param actions the actions to offer. Can be omitted.
     *
     * @returns the selected action if there is any, `undefined` when there was no action or none was selected.
     */
    info<T extends string>(message: string, options?: MessageOptions, ...actions: T[]): Promise<T | undefined>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    info(message: string, ...args: any[]): Promise<string | undefined> {
        return this.processMessage(MessageType.Info, message, args);
    }

    /**
     * Logs the message as "warning" and, if given, offers actions to act on it.
     * @param message the message to log.
     * @param actions the actions to offer. Can be omitted.
     *
     * @returns the selected action if there is any, `undefined` when there was no action or none was selected.
     */
    warn<T extends string>(message: string, ...actions: T[]): Promise<T | undefined>;
    /**
     * Logs the message as "warning" and, if given, offers actions to act on it.
     * @param message the message to log.
     * @param options additional options. Can be omitted
     * @param actions the actions to offer. Can be omitted.
     *
     * @returns the selected action if there is any, `undefined` when there was no action or none was selected.
     */
    warn<T extends string>(message: string, options?: MessageOptions, ...actions: T[]): Promise<T | undefined>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warn(message: string, ...args: any[]): Promise<string | undefined> {
        return this.processMessage(MessageType.Warning, message, args);
    }

    /**
     * Logs the message as "error" and, if given, offers actions to act on it.
     * @param message the message to log.
     * @param actions the actions to offer. Can be omitted.
     *
     * @returns the selected action if there is any, `undefined` when there was no action or none was selected.
     */
    error<T extends string>(message: string, ...actions: T[]): Promise<T | undefined>;
    /**
     * Logs the message as "error" and, if given, offers actions to act on it.
     * @param message the message to log.
     * @param options additional options. Can be omitted
     * @param actions the actions to offer. Can be omitted.
     *
     * @returns the selected action if there is any, `undefined` when there was no action or none was selected.
     */
    error<T extends string>(message: string, options?: MessageOptions, ...actions: T[]): Promise<T | undefined>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error(message: string, ...args: any[]): Promise<string | undefined> {
        return this.processMessage(MessageType.Error, message, args);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected processMessage(type: MessageType, text: string, args?: any[]): Promise<string | undefined> {
        if (!!args && args.length > 0) {
            const first = args[0];
            const actions = Array.from(new Set<string>(args.filter(a => typeof a === 'string')));
            const options = (typeof first === 'object' && !Array.isArray(first))
                ? <MessageOptions>first
                : undefined;
            return this.client.showMessage({ type, options, text, actions });
        }
        return this.client.showMessage({ type, text });
    }

    /**
     * Shows the given message as a progress.
     *
     * @param message the message to show for the progress.
     * @param onDidCancel an optional callback which will be invoked if the progress indicator was canceled.
     *
     * @returns a promise resolving to a {@link Progress} object with which the progress can be updated.
     *
     * ### Example usage
     *
     * ```typescript
     *   @inject(MessageService)
     *   protected readonly messageService: MessageService;
     *
     *   // this will show "Progress" as a cancelable message
     *   this.messageService.showProgress({text: 'Progress'});
     *
     *   // this will show "Rolling back" with "Cancel" and an additional "Skip" action
     *   this.messageService.showProgress({
     *     text: `Rolling back`,
     *     actions: ["Skip"],
     *   },
     *   () => console.log("canceled"))
     *   .then((progress) => {
     *     // register if interested in the result (only necessary for custom actions)
     *     progress.result.then((result) => {
     *       // will be 'Cancel', 'Skip' or `undefined`
     *       console.log("result is", result);
     *     });
     *     progress.report({message: "Cleaning references", work: {done: 10, total: 100}});
     *     progress.report({message: "Restoring previous state", work: {done: 80, total: 100}});
     *     progress.report({message: "Complete", work: {done: 100, total: 100}});
     *     // we are done so we can cancel the progress message, note that this will also invoke `onDidCancel`
     *     progress.cancel();
     *   });
     * ```
     */
    async showProgress(message: ProgressMessage, onDidCancel?: () => void): Promise<Progress> {
        const id = this.newProgressId();
        const cancellationSource = new CancellationTokenSource();
        const report = (update: ProgressUpdate) => {
            this.client.reportProgress(id, update, message, cancellationSource.token);
        };
        const actions = new Set<string>(message.actions);
        if (ProgressMessage.isCancelable(message)) {
            actions.delete(ProgressMessage.Cancel);
            actions.add(ProgressMessage.Cancel);
        }
        const clientMessage = { ...message, actions: Array.from(actions) };
        const result = this.client.showProgress(id, clientMessage, cancellationSource.token);
        if (ProgressMessage.isCancelable(message) && typeof onDidCancel === 'function') {
            result.then(value => {
                if (value === ProgressMessage.Cancel) {
                    onDidCancel();
                }
            });
        }
        return {
            id,
            cancel: () => cancellationSource.cancel(),
            result,
            report
        };
    }

    private progressIdPrefix = Math.random().toString(36).substring(5);
    private counter = 0;
    protected newProgressId(): string {
        return `${this.progressIdPrefix}-${++this.counter}`;
    }
}
