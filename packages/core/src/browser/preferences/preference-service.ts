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

import { injectable, inject, postConstruct } from 'inversify';
import { Event, Emitter, DisposableCollection, Disposable, deepFreeze } from '../../common';
import { Deferred } from '../../common/promise-util';
import { PreferenceProvider, PreferenceProviderDataChange, PreferenceProviderDataChanges, PreferenceResolveResult } from './preference-provider';
import { PreferenceSchemaProvider, OverridePreferenceName } from './preference-contribution';
import URI from '../../common/uri';
import { PreferenceScope } from './preference-scope';
import { PreferenceConfigurations } from './preference-configurations';

export { PreferenceScope };

/**
 * Representation of a preference change. A preference value can be set to `undefined` for a specific scope.
 * This means that the value from a more general scope will be used.
 */
export interface PreferenceChange {
    /**
     * The name of the changed preference.
     */
    readonly preferenceName: string;
    /**
     * The new value of the changed preference.
     */
    readonly newValue?: any;
    /**
     * The old value of the changed preference.
     */
    readonly oldValue?: any;
    /**
     * The {@link PreferenceScope} of the changed preference.
     */
    readonly scope: PreferenceScope;
    /**
     * Tests wether the given resource is affected by the preference change.
     * @param resourceUri the uri of the resource to test.
     */
    affects(resourceUri?: string): boolean;
}

export class PreferenceChangeImpl implements PreferenceChange {
    constructor(
        private change: PreferenceProviderDataChange
    ) { }

    get preferenceName(): string {
        return this.change.preferenceName;
    }
    get newValue(): string {
        return this.change.newValue;
    }
    get oldValue(): string {
        return this.change.oldValue;
    }
    get scope(): PreferenceScope {
        return this.change.scope;
    }

    // TODO add tests
    affects(resourceUri?: string): boolean {
        const resourcePath = resourceUri && new URI(resourceUri).path;
        const domain = this.change.domain;
        return !resourcePath || !domain || domain.some(uri => new URI(uri).path.relativity(resourcePath) >= 0);
    }
}
/**
 * A key-value storage for {@link PreferenceChange}s. Used to aggregate multiple simultaneous preference changes.
 */
export interface PreferenceChanges {
    [preferenceName: string]: PreferenceChange
}

export const PreferenceService = Symbol('PreferenceService');
/**
 * Service to manage preferences including, among others, getting and setting preference values as well
 * as listening to preference changes.
 *
 * Depending on your use case you might also want to look at {@link createPreferenceProxy} with which
 * you can easily create a typesafe schema-based interface for your preferences. Internally the proxy
 * uses the PreferenceService so both approaches are compatible.
 */
export interface PreferenceService extends Disposable {
    /**
     * Promise indicating whether the service successfully initialized.
     */
    readonly ready: Promise<void>;
    /**
     * Retrieve the stored value for the given preference.
     *
     * @param preferenceName the preference identifier.
     *
     * @returns the value stored for the given preference when it exists, `undefined` otherwise.
     */
    get<T>(preferenceName: string): T | undefined;
    /**
     * Retrieve the stored value for the given preference.
     *
     * @param preferenceName the preference identifier.
     * @param defaultValue the value to return when no value for the given preference is stored.
     *
     * @returns the value stored for the given preference when it exists, otherwise the given default value.
     */
    get<T>(preferenceName: string, defaultValue: T): T;
    /**
     * Retrieve the stored value for the given preference and resourceUri.
     *
     * @param preferenceName the preference identifier.
     * @param defaultValue the value to return when no value for the given preference is stored.
     * @param resourceUri the uri of the resource for which the preference is stored. This used to retrieve
     * a potentially different value for the same preference for different resources, for example `files.encoding`.
     *
     * @returns the value stored for the given preference and resourceUri when it exists, otherwise the given
     * default value.
     */
    get<T>(preferenceName: string, defaultValue: T, resourceUri?: string): T;
    /**
     * Retrieve the stored value for the given preference and resourceUri.
     *
     * @param preferenceName the preference identifier.
     * @param defaultValue the value to return when no value for the given preference is stored.
     * @param resourceUri the uri of the resource for which the preference is stored. This used to retrieve
     * a potentially different value for the same preference for different resources, for example `files.encoding`.
     *
     * @returns the value stored for the given preference and resourceUri when it exists, otherwise the given
     * default value.
     */
    get<T>(preferenceName: string, defaultValue?: T, resourceUri?: string): T | undefined;
    /**
     * Sets the given preference to the given value.
     *
     * @param preferenceName the preference identifier.
     * @param value the new value of the preference.
     * @param scope the scope for which the value shall be set, i.e. user, workspace etc.
     * When the folder scope is specified a resourceUri must be provided.
     * @param resourceUri the uri of the resource for which the preference is stored. This used to store
     * a potentially different value for the same preference for different resources, for example `files.encoding`.
     *
     * @returns a promise which resolves to `undefined` when setting the preference was successful. Otherwise it rejects
     * with an error.
     */
    set(preferenceName: string, value: any, scope?: PreferenceScope, resourceUri?: string): Promise<void>;
    /**
     * Registers a callback which will be called whenever a preference is changed.
     */
    onPreferenceChanged: Event<PreferenceChange>;
    /**
     * Registers a callback which will be called whenever one or more preferences are changed.
     */
    onPreferencesChanged: Event<PreferenceChanges>;
    /**
     * Retrieve the stored value for the given preference and resourceUri in all available scopes.
     *
     * @param preferenceName the preference identifier.
     * @param resourceUri the uri of the resource for which the preference is stored.
     *
     * @return an object containing the value of the given preference for all scopes.
     */
    inspect<T>(preferenceName: string, resourceUri?: string): PreferenceInspection<T> | undefined;
    /**
     * Returns a new preference identifier based on the given OverridePreferenceName.
     *
     * @param options the override specification.
     *
     * @returns the calculated string based on the given OverridePreferenceName.
     */
    overridePreferenceName(options: OverridePreferenceName): string;
    /**
     * Tries to split the given preference identifier into the original OverridePreferenceName attributes
     * with which this identifier was created. Returns `undefined` if this is not possible, for example
     * when the given preference identifier was not generated by `overridePreferenceName`.
     *
     * This method is checked when resolving preferences. Therefore together with "overridePreferenceName"
     * this can be used to handle specialized preferences, e.g. "[markdown].editor.autoIndent" and "editor.autoIndent".
     *
     * @param preferenceName the preferenceName which might have been created via {@link PreferenceService.overridePreferenceName}.
     *
     * @returns the OverridePreferenceName which was used to create the given `preferenceName` if this was the case,
     * `undefined` otherwise.
     */
    overriddenPreferenceName(preferenceName: string): OverridePreferenceName | undefined;
    /**
     * Retrieve the stored value for the given preference and resourceUri.
     *
     * @param preferenceName the preference identifier.
     * @param defaultValue the value to return when no value for the given preference is stored.
     * @param resourceUri the uri of the resource for which the preference is stored. This used to retrieve
     * a potentially different value for the same preference for different resources, for example `files.encoding`.
     *
     * @returns an object containing the value stored for the given preference and resourceUri when it exists,
     * otherwise the given default value. If determinable the object will also contain the uri of the configuration
     * resource in which the preference was stored.
     */
    resolve<T>(preferenceName: string, defaultValue?: T, resourceUri?: string): PreferenceResolveResult<T>;
    /**
     * Returns the uri of the configuration resource for the given scope and optional resource uri.
     *
     * @param scope the PreferenceScope to query for.
     * @param resourceUri the optional uri of the resource-specific preference handling
     *
     * @returns the uri of the configuration resource for the given scope and optional resource uri it it exists,
     * `undefined` otherwise.
     */
    getConfigUri(scope: PreferenceScope, resourceUri?: string): URI | undefined;
}

/**
 * Return type of the {@link PreferenceService.inspect} call.
 */
export interface PreferenceInspection<T> {
    /**
     * The preference identifier.
     */
    preferenceName: string,
    /**
     * Value in default scope.
     */
    defaultValue: T | undefined,
    /**
     * Value in user scope.
     */
    globalValue: T | undefined,
    /**
     * Value in workspace scope.
     */
    workspaceValue: T | undefined,
    /**
     * Value in folder scope.
     */
    workspaceFolderValue: T | undefined
}

/**
 * We cannot load providers directly in the case if they depend on `PreferenceService` somehow.
 * It allows to load them lazily after DI is configured.
 */
export const PreferenceProviderProvider = Symbol('PreferenceProviderProvider');
export type PreferenceProviderProvider = (scope: PreferenceScope, uri?: URI) => PreferenceProvider;

@injectable()
export class PreferenceServiceImpl implements PreferenceService {

    protected readonly onPreferenceChangedEmitter = new Emitter<PreferenceChange>();
    readonly onPreferenceChanged = this.onPreferenceChangedEmitter.event;

    protected readonly onPreferencesChangedEmitter = new Emitter<PreferenceChanges>();
    readonly onPreferencesChanged = this.onPreferencesChangedEmitter.event;

    protected readonly toDispose = new DisposableCollection(this.onPreferenceChangedEmitter, this.onPreferencesChangedEmitter);

    @inject(PreferenceSchemaProvider)
    protected readonly schema: PreferenceSchemaProvider;

    @inject(PreferenceProviderProvider)
    protected readonly providerProvider: PreferenceProviderProvider;

    @inject(PreferenceConfigurations)
    protected readonly configurations: PreferenceConfigurations;

    protected readonly preferenceProviders = new Map<PreferenceScope, PreferenceProvider>();

    protected async initializeProviders(): Promise<void> {
        try {
            for (const scope of PreferenceScope.getScopes()) {
                const provider = this.providerProvider(scope);
                this.preferenceProviders.set(scope, provider);
                this.toDispose.push(provider.onDidPreferencesChanged(changes =>
                    this.reconcilePreferences(changes)
                ));
                await provider.ready;
            }
            this._ready.resolve();
        } catch (e) {
            this._ready.reject(e);
        }
    }

    @postConstruct()
    protected init(): void {
        this.toDispose.push(Disposable.create(() => this._ready.reject(new Error('preference service is disposed'))));
        this.initializeProviders();
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    protected readonly _ready = new Deferred<void>();
    get ready(): Promise<void> {
        return this._ready.promise;
    }

    protected reconcilePreferences(changes: PreferenceProviderDataChanges): void {
        const changesToEmit: PreferenceChanges = {};
        const acceptChange = (change: PreferenceProviderDataChange) =>
            this.getAffectedPreferenceNames(change, preferenceName =>
                changesToEmit[preferenceName] = new PreferenceChangeImpl({ ...change, preferenceName })
            );

        for (const preferenceName of Object.keys(changes)) {
            let change = changes[preferenceName];
            if (change.newValue === undefined) {
                const overridden = this.overriddenPreferenceName(change.preferenceName);
                if (overridden) {
                    change = {
                        ...change, newValue: this.doGet(overridden.preferenceName)
                    };
                }
            }
            if (this.schema.isValidInScope(preferenceName, PreferenceScope.Folder)) {
                acceptChange(change);
                continue;
            }
            for (const scope of PreferenceScope.getReversedScopes()) {
                if (this.schema.isValidInScope(preferenceName, scope)) {
                    const provider = this.getProvider(scope);
                    if (provider) {
                        const value = provider.get(preferenceName);
                        if (scope > change.scope && value !== undefined) {
                            // preference defined in a more specific scope
                            break;
                        } else if (scope === change.scope && change.newValue !== undefined) {
                            // preference is changed into something other than `undefined`
                            acceptChange(change);
                        } else if (scope < change.scope && change.newValue === undefined && value !== undefined) {
                            // preference is changed to `undefined`, use the value from a more general scope
                            change = {
                                ...change,
                                newValue: value,
                                scope
                            };
                            acceptChange(change);
                        }
                    }
                } else if (change.newValue === undefined && change.scope === PreferenceScope.Default) {
                    // preference is removed
                    acceptChange(change);
                    break;
                }
            }
        }

        // emit the changes
        const changedPreferenceNames = Object.keys(changesToEmit);
        if (changedPreferenceNames.length > 0) {
            this.onPreferencesChangedEmitter.fire(changesToEmit);
        }
        changedPreferenceNames.forEach(preferenceName => this.onPreferenceChangedEmitter.fire(changesToEmit[preferenceName]));
    }
    protected getAffectedPreferenceNames(change: PreferenceProviderDataChange, accept: (affectedPreferenceName: string) => void): void {
        accept(change.preferenceName);
        for (const overridePreferenceName of this.schema.getOverridePreferenceNames(change.preferenceName)) {
            if (!this.doHas(overridePreferenceName)) {
                accept(overridePreferenceName);
            }
        }
    }

    protected getProvider(scope: PreferenceScope): PreferenceProvider | undefined {
        return this.preferenceProviders.get(scope);
    }

    has(preferenceName: string, resourceUri?: string): boolean {
        return this.get(preferenceName, undefined, resourceUri) !== undefined;
    }

    get<T>(preferenceName: string): T | undefined;
    get<T>(preferenceName: string, defaultValue: T): T;
    get<T>(preferenceName: string, defaultValue: T, resourceUri: string): T;
    get<T>(preferenceName: string, defaultValue?: T, resourceUri?: string): T | undefined;
    get<T>(preferenceName: string, defaultValue?: T, resourceUri?: string): T | undefined {
        return this.resolve<T>(preferenceName, defaultValue, resourceUri).value;
    }

    resolve<T>(preferenceName: string, defaultValue?: T, resourceUri?: string): PreferenceResolveResult<T> {
        const { value, configUri } = this.doResolve(preferenceName, defaultValue, resourceUri);
        if (value === undefined) {
            const overridden = this.overriddenPreferenceName(preferenceName);
            if (overridden) {
                return this.doResolve(overridden.preferenceName, defaultValue, resourceUri);
            }
        }
        return { value, configUri };
    }

    async set(preferenceName: string, value: any, scope: PreferenceScope | undefined, resourceUri?: string): Promise<void> {
        const resolvedScope = scope !== undefined ? scope : (!resourceUri ? PreferenceScope.Workspace : PreferenceScope.Folder);
        if (resolvedScope === PreferenceScope.User && this.configurations.isSectionName(preferenceName.split('.', 1)[0])) {
            throw new Error(`Unable to write to User Settings because ${preferenceName} does not support for global scope.`);
        }
        if (resolvedScope === PreferenceScope.Folder && !resourceUri) {
            throw new Error('Unable to write to Folder Settings because no resource is provided.');
        }
        const provider = this.getProvider(resolvedScope);
        if (provider && await provider.setPreference(preferenceName, value, resourceUri)) {
            return;
        }
        throw new Error(`Unable to write to ${PreferenceScope.getScopeNames(resolvedScope)[0]} Settings.`);
    }

    getBoolean(preferenceName: string): boolean | undefined;
    getBoolean(preferenceName: string, defaultValue: boolean): boolean;
    getBoolean(preferenceName: string, defaultValue: boolean, resourceUri: string): boolean;
    getBoolean(preferenceName: string, defaultValue?: boolean, resourceUri?: string): boolean | undefined {
        const value = resourceUri ? this.get(preferenceName, defaultValue, resourceUri) : this.get(preferenceName, defaultValue);
        // eslint-disable-next-line no-null/no-null
        return value !== null && value !== undefined ? !!value : defaultValue;
    }

    getString(preferenceName: string): string | undefined;
    getString(preferenceName: string, defaultValue: string): string;
    getString(preferenceName: string, defaultValue: string, resourceUri: string): string;
    getString(preferenceName: string, defaultValue?: string, resourceUri?: string): string | undefined {
        const value = resourceUri ? this.get(preferenceName, defaultValue, resourceUri) : this.get(preferenceName, defaultValue);
        // eslint-disable-next-line no-null/no-null
        if (value === null || value === undefined) {
            return defaultValue;
        }
        return value.toString();
    }

    getNumber(preferenceName: string): number | undefined;
    getNumber(preferenceName: string, defaultValue: number): number;
    getNumber(preferenceName: string, defaultValue: number, resourceUri: string): number;
    getNumber(preferenceName: string, defaultValue?: number, resourceUri?: string): number | undefined {
        const value = resourceUri ? this.get(preferenceName, defaultValue, resourceUri) : this.get(preferenceName, defaultValue);
        // eslint-disable-next-line no-null/no-null
        if (value === null || value === undefined) {
            return defaultValue;
        }
        if (typeof value === 'number') {
            return value;
        }
        return Number(value);
    }

    inspect<T>(preferenceName: string, resourceUri?: string): {
        preferenceName: string,
        defaultValue: T | undefined,
        globalValue: T | undefined, // User Preference
        workspaceValue: T | undefined, // Workspace Preference
        workspaceFolderValue: T | undefined // Folder Preference
    } | undefined {
        const defaultValue = this.inspectInScope<T>(preferenceName, PreferenceScope.Default, resourceUri);
        const globalValue = this.inspectInScope<T>(preferenceName, PreferenceScope.User, resourceUri);
        const workspaceValue = this.inspectInScope<T>(preferenceName, PreferenceScope.Workspace, resourceUri);
        const workspaceFolderValue = this.inspectInScope<T>(preferenceName, PreferenceScope.Folder, resourceUri);

        return { preferenceName, defaultValue, globalValue, workspaceValue, workspaceFolderValue };
    }
    protected inspectInScope<T>(preferenceName: string, scope: PreferenceScope, resourceUri?: string): T | undefined {
        const value = this.doInspectInScope<T>(preferenceName, scope, resourceUri);
        if (value === undefined) {
            const overridden = this.overriddenPreferenceName(preferenceName);
            if (overridden) {
                return this.doInspectInScope(overridden.preferenceName, scope, resourceUri);
            }
        }
        return value;
    }

    overridePreferenceName(options: OverridePreferenceName): string {
        return this.schema.overridePreferenceName(options);
    }
    overriddenPreferenceName(preferenceName: string): OverridePreferenceName | undefined {
        return this.schema.overriddenPreferenceName(preferenceName);
    }

    protected doHas(preferenceName: string, resourceUri?: string): boolean {
        return this.doGet(preferenceName, undefined, resourceUri) !== undefined;
    }
    protected doInspectInScope<T>(preferenceName: string, scope: PreferenceScope, resourceUri?: string): T | undefined {
        const provider = this.getProvider(scope);
        return provider && provider.get<T>(preferenceName, resourceUri);
    }
    protected doGet<T>(preferenceName: string, defaultValue?: T, resourceUri?: string): T | undefined {
        return this.doResolve(preferenceName, defaultValue, resourceUri).value;
    }
    protected doResolve<T>(preferenceName: string, defaultValue?: T, resourceUri?: string): PreferenceResolveResult<T> {
        const result: PreferenceResolveResult<T> = {};
        const propertyIsHidden = this.schema.isPropertyHidden(preferenceName);
        if (propertyIsHidden) {
            const { configUri, value } = this.schema.resolve<T>(preferenceName, resourceUri);
            result.configUri = configUri;
            result.value = value;
        } else {
            for (const scope of PreferenceScope.getScopes()) {
                if (this.schema.isValidInScope(preferenceName, scope)) {
                    const provider = this.getProvider(scope);
                    if (provider) {
                        const { configUri, value } = provider.resolve<T>(preferenceName, resourceUri);
                        if (value !== undefined) {
                            result.configUri = configUri;
                            result.value = PreferenceProvider.merge(result.value as any, value as any) as any;
                        }
                    }
                }
            }
        }
        return {
            configUri: result.configUri,
            value: result.value !== undefined ? deepFreeze(result.value) : defaultValue
        };
    }

    getConfigUri(scope: PreferenceScope, resourceUri?: string): URI | undefined {
        const provider = this.getProvider(scope);
        if (!provider) {
            return undefined;
        }
        const configUri = provider.getConfigUri(resourceUri);
        if (configUri) {
            return configUri;
        }
        return provider.getContainingConfigUri && provider.getContainingConfigUri(resourceUri);
    }

}
