/********************************************************************************
 * Copyright (c) 2021 SAP SE or an SAP affiliate company and others.
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

import { CancellationToken, Disposable } from '../../common';
import { QuickPicks } from './quick-input-service';

export const QuickAccessContribution = Symbol('QuickAccessContribution');
/**
 * Bind this contribution in order to register quick access providers with the
 * QuickAccessRegistry at startup
 */
export interface QuickAccessContribution {
    registerQuickAccessProvider(): void;
}

export interface QuickAccessProvider {
    getPicks(filter: string, token: CancellationToken): QuickPicks | Promise<QuickPicks>;
    reset?(): void;
}

export interface QuickAccessProviderHelp {
    prefix?: string;
    description: string;
    needsEditor: boolean;
}

export interface QuickAccessProviderDescriptor {
    /**
     * return an instance of QuickAccssProvider. Implementers are free to return that same instance multiple times
     */
    readonly getInstance: () => QuickAccessProvider;
    /**
     * The prefix for quick access picker to use the provider for.
     */
    readonly prefix: string;
    /**
     * A placeholder to use for the input field when the provider is active.
     * This will also be read out by screen readers and thus helps for
     * accessibility.
     */
    readonly placeholder?: string;
    /**
     * Help entries for this quick access provider
     */
    readonly helpEntries: QuickAccessProviderHelp[];
    /**
     * A context key that will be set automatically when this quick access is being shown
     */
    readonly contextKey?: string;
}

export const QuickAccessRegistry = Symbol('QuickAccessRegistry');

/**
 * A registry for quick access providers.
 */
export interface QuickAccessRegistry {
    registerQuickAccessProvider(provider: QuickAccessProviderDescriptor): Disposable;
    getQuickAccessProviders(): QuickAccessProviderDescriptor[];
    getQuickAccessProvider(prefix: string): QuickAccessProviderDescriptor | undefined;
    clear(): void;
}
