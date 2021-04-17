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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { SelectionService } from '../common/selection-service';
import { UriSelection } from '../common/selection';
import { Emitter } from '../common/event';
import { CommandHandler, HandlerPropertyTracker, CommandState } from './command';
import { MaybeArray } from '.';
import URI from './uri';
import { DisposableCollection } from './disposable';

export interface UriCommandHandler<T extends MaybeArray<URI>> extends CommandHandler {

    execute(uri: T, ...args: any[]): any;

    isEnabled?(uri: T, ...args: any[]): boolean;

    isVisible?(uri: T, ...args: any[]): boolean;

}

/**
 * Handler for a single URI-based selection.
 */
export interface SingleUriCommandHandler extends UriCommandHandler<URI> {

}

/**
 * Handler for multiple URIs.
 */
export interface MultiUriCommandHandler extends UriCommandHandler<URI[]> {

}

export class UriAwareCommandHandler<T extends MaybeArray<URI>> implements UriCommandHandler<T> {

    /**
     * @deprecated since 1.6.0. Please use `UriAwareCommandHandler.MonoSelect` or `UriAwareCommandHandler.MultiSelect`.
     */
    constructor(
        protected readonly selectionService: SelectionService,
        protected readonly handler: UriCommandHandler<T>,
        protected readonly options?: UriAwareCommandHandler.Options
    ) { }

    protected getUriFromArgs(...args: any[]): T | undefined {
        const [maybeUriArray] = args;
        const firstArgIsOK = this.isMulti()
            ? Array.isArray(maybeUriArray) && maybeUriArray.every(uri => uri instanceof URI)
            : maybeUriArray instanceof URI;

        return firstArgIsOK ? maybeUriArray : undefined;
    }

    protected getUriFromSelection(selection: Object | undefined): T | undefined {
        const uriOrUris = this.isMulti()
            ? UriSelection.getUris(selection)
            : UriSelection.getUri(selection);

        return uriOrUris as T;
    }

    protected getUri(...args: any[]): T | undefined {
        return this.getUriFromArgs(...args) ?? this.getUriFromSelection(this.selectionService.selection);
    }

    protected getArgsWithUri(...args: any[]): [T | undefined, ...any[]] {
        const uri = this.getUri(...args);
        const [maybeUri, ...others] = args;
        if (uri === maybeUri) {
            return [maybeUri, ...others];
        }
        return [uri, ...args];
    }

    execute(...args: any[]): object | undefined {
        const [uri, ...others] = this.getArgsWithUri(...args);
        return uri ? this.handler.execute(uri, ...others) : undefined;
    }

    isVisible(...args: any[]): boolean {
        // The command is to be visible, though possibly disabled, if it could be active with a change of selection.
        // It should only be not visible if the uri comes from args.
        const uri = this.getUriFromArgs(...args);
        if (uri) {
            if (this.handler.isVisible) {
                const others = args.slice(1);
                return this.handler.isVisible(uri, ...others);
            }
        }
        return true;
    }

    isEnabled(...args: any[]): boolean {
        const [uri, ...others] = this.getArgsWithUri(...args);
        if (uri) {
            if (this.handler.isEnabled) {
                return this.handler.isEnabled(uri, ...others);
            }
            return true;
        }
        return false;
    }

    /**
     *
     * @param args passed on as-is to the handler if the first arg is a URI or URI[], otherwise
     *          the URI or URI[] is obtained from the current selection and prepended to args.
     */
    trackActiveState(...args: any[]): HandlerPropertyTracker {
        const onChangeEmitter: Emitter<CommandState> = new Emitter();
        const toDispose = new DisposableCollection(onChangeEmitter);

        const uri = this.getUriFromArgs(...args);
        if (!uri) {
            // uri not specified in args, so it is coming from selection, so it may change
            toDispose.push(this.selectionService.onSelectionChanged(selection => {
                const handlerState = this.getHandlerStateGivenSelection(selection, args);
                onChangeEmitter.fire(handlerState);
            }));
            return {
                value: this.getHandlerStateGivenSelection(this.selectionService.selection, args),
                untrackable: false,
                onChange: onChangeEmitter.event, dispose: () => toDispose.dispose()
            };
        }

        // Uri is specified as first of the args, so does not come from selection
        return {
            value: this.getHandlerState(uri, ...args.slice(1)),
            untrackable: false,
            onChange: onChangeEmitter.event, dispose: () => toDispose.dispose()
        };
    }

    protected getHandlerStateGivenSelection(selection: Object | undefined, args: any[]): CommandState {
        const uriOrUris = this.getUriFromSelection(selection);
        if (uriOrUris) {
            return this.getHandlerState(uriOrUris, ...args);
        } else {
            return CommandState.Disabled;
        }
    }

    protected getHandlerState(uriOrUris: T, ...args: any[]): CommandState {
        const visible = this.handler.isVisible
            ? this.handler.isVisible(uriOrUris, ...args)
            : true;
        const enabled = this.handler.isEnabled
            ? this.handler.isEnabled(uriOrUris, ...args)
            : true;
        return visible ? enabled ? CommandState.Active : CommandState.Disabled : CommandState.Hidden;
    }

    protected isMulti(): boolean | undefined {
        return this.options && !!this.options.multi;
    }
}

export namespace UriAwareCommandHandler {
    /**
     * Further options for the URI aware command handler instantiation.
     */
    export interface Options {

        /**
         * `true` if the handler supports multiple selection. Otherwise, `false`. Defaults to `false`.
         */
        readonly multi?: boolean,
    }

    /**
     * @returns a command handler for mono-select contexts that expects a `URI` as the first parameter of its methods.
     */
    export function MonoSelect(selectionService: SelectionService, handler: UriCommandHandler<URI>): UriAwareCommandHandler<URI> {
        /* eslint-disable-next-line deprecation/deprecation*/ // Safe to use when the generic and the options agree.
        return new UriAwareCommandHandler<URI>(selectionService, handler, { multi: false });
    }

    /**
     * @returns a command handler for multi-select contexts that expects a `URI[]` as the first parameter of its methods.
     */
    export function MultiSelect(selectionService: SelectionService, handler: UriCommandHandler<URI[]>): UriAwareCommandHandler<URI[]> {
        /* eslint-disable-next-line deprecation/deprecation*/ // Safe to use when the generic and the options agree.
        return new UriAwareCommandHandler<URI[]>(selectionService, handler, { multi: true });
    }

}

