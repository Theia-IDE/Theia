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

import * as Ajv from 'ajv';
import { inject, injectable, interfaces, named, postConstruct } from 'inversify';
import { ContributionProvider, bindContributionProvider, escapeRegExpCharacters, Emitter, Event, Disposable } from '../../common';
import { PreferenceScope } from './preference-scope';
import { PreferenceProvider, PreferenceProviderDataChange } from './preference-provider';
import {
    PreferenceSchema, PreferenceSchemaProperties, PreferenceDataSchema, PreferenceItem, PreferenceSchemaProperty, PreferenceDataProperty, JsonType,
    PreferenceSchemaModification, PreferenceSchemaPropertyModifications, PreferenceSchemaPropertyModification
} from '../../common/preferences/preference-schema';
import { FrontendApplicationConfigProvider } from '../frontend-application-config-provider';
import { FrontendApplicationConfig } from '@theia/application-package/lib/application-props';
import { bindPreferenceConfigurations, PreferenceConfigurations } from './preference-configurations';
export {
    PreferenceSchema, PreferenceSchemaProperties, PreferenceDataSchema, PreferenceItem, PreferenceSchemaProperty, PreferenceDataProperty, JsonType,
    PreferenceSchemaModification
};
import { Mutable } from '../../common/types';

/* eslint-disable guard-for-in, @typescript-eslint/no-explicit-any */

export const PreferenceContribution = Symbol('PreferenceContribution');

/**
 * A {@link PreferenceContribution} allows adding additional custom preferences.
 * For this, the {@link PreferenceContribution} has to provide a valid JSON Schema specifying which preferences
 * are available including their types and description.
 *
 * ### Example usage
 * ```typescript
 * const MyPreferencesSchema: PreferenceSchema = {
 *     'type': 'object',
 *     'properties': {
 *         'myext.decorations.enabled': {
 *             'type': 'boolean',
 *             'description': 'Show file status',
 *             'default': true
 *         },
 *         // [...]
 *     }
 * }
 * @injectable()
 * export class MyPreferenceContribution implements PreferenceContribution{
 *     schema= MyPreferencesSchema;
 * }
 * ```
 */
export interface PreferenceContribution {
    readonly schema: PreferenceSchema;
}

export const PreferenceModificationContribution = Symbol('PreferenceModificationContribution');
export interface PreferenceModificationContribution {
    readonly schemaModification: PreferenceSchemaModification;
}

export function bindPreferenceSchemaProvider(bind: interfaces.Bind): void {
    bindPreferenceConfigurations(bind);
    bind(PreferenceSchemaProvider).toSelf().inSingletonScope();
    bindContributionProvider(bind, PreferenceContribution);
    bindContributionProvider(bind, PreferenceModificationContribution);
}

export interface OverridePreferenceName {
    preferenceName: string
    overrideIdentifier: string
}
export namespace OverridePreferenceName {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function is(arg: any): arg is OverridePreferenceName {
        return !!arg && typeof arg === 'object' && 'preferenceName' in arg && 'overrideIdentifier' in arg;
    }
}

const OVERRIDE_PROPERTY = '\\[(.*)\\]$';
export const OVERRIDE_PROPERTY_PATTERN = new RegExp(OVERRIDE_PROPERTY);

const OVERRIDE_PATTERN_WITH_SUBSTITUTION = '\\[(${0})\\]$';
/**
 * Specialized {@link FrontendApplicationConfig} to configure default
 * preference values for the {@link PreferenceSchemaProvider}.
 */
export interface FrontendApplicationPreferenceConfig extends FrontendApplicationConfig {
    preferences: {
        [preferenceName: string]: any
    }
}
export namespace FrontendApplicationPreferenceConfig {
    export function is(config: FrontendApplicationConfig): config is FrontendApplicationPreferenceConfig {
        return 'preferences' in config && typeof config['preferences'] === 'object';
    }
}

/**
 * The {@link PreferenceSchemaProvider} collects all {@link PreferenceContribution}s and combines
 * the preference schema provided by these contributions into one collective schema. The preferences which
 * are provided by this {@link PreferenceProvider} are derived from this combined schema.
 */
@injectable()
export class PreferenceSchemaProvider extends PreferenceProvider {

    protected readonly preferences: { [name: string]: any } = {};
    protected readonly combinedSchema: PreferenceDataSchema = { properties: {}, patternProperties: {} };
    protected readonly workspaceSchema: PreferenceDataSchema = { properties: {}, patternProperties: {} };
    protected readonly folderSchema: PreferenceDataSchema = { properties: {}, patternProperties: {} };
    protected readonly modifications: PreferenceSchemaPropertyModifications = {};

    @inject(ContributionProvider) @named(PreferenceContribution)
    protected readonly preferenceContributions: ContributionProvider<PreferenceContribution>;

    @inject(ContributionProvider) @named(PreferenceModificationContribution)
    protected readonly preferenceModificationContributions: ContributionProvider<PreferenceModificationContribution>;

    @inject(PreferenceConfigurations)
    protected readonly configurations: PreferenceConfigurations;

    protected readonly onDidPreferenceSchemaChangedEmitter = new Emitter<void>();
    readonly onDidPreferenceSchemaChanged: Event<void> = this.onDidPreferenceSchemaChangedEmitter.event;
    protected fireDidPreferenceSchemaChanged(): void {
        this.onDidPreferenceSchemaChangedEmitter.fire(undefined);
    }

    @postConstruct()
    protected init(): void {
        this.preferenceModificationContributions.getContributions().forEach(contrib => {
            this.doSetSchemaModification(contrib.schemaModification);
        });
        this.preferenceContributions.getContributions().forEach(contrib => {
            this.doSetSchema(contrib.schema);
        });
        this.combinedSchema.additionalProperties = false;
        this._ready.resolve();
    }

    protected readonly overrideIdentifiers = new Set<string>();

    /**
     * Register a new overrideIdentifier. Existing identifiers are not replaced.
     *
     * Allows overriding existing values while keeping both values in store.
     * For example to store different editor settings, e.g. "[markdown].editor.autoIndent",
     * "[json].editor.autoIndent" and "editor.autoIndent"
     * @param overrideIdentifier the new overrideIdentifier
     */
    registerOverrideIdentifier(overrideIdentifier: string): void {
        if (this.overrideIdentifiers.has(overrideIdentifier)) {
            return;
        }
        this.overrideIdentifiers.add(overrideIdentifier);
        this.updateOverridePatternPropertiesKey();
    }

    protected readonly overridePatternProperties: Required<Pick<PreferenceDataProperty, 'properties' | 'additionalProperties'>> & PreferenceDataProperty = {
        type: 'object',
        description: 'Configure editor settings to be overridden for a language.',
        errorMessage: 'Unknown Identifier. Use language identifiers',
        properties: {},
        additionalProperties: false
    };
    protected overridePatternPropertiesKey: string | undefined;
    protected updateOverridePatternPropertiesKey(): void {
        const oldKey = this.overridePatternPropertiesKey;
        const newKey = this.computeOverridePatternPropertiesKey();
        if (oldKey === newKey) {
            return;
        }
        if (oldKey) {
            delete this.combinedSchema.patternProperties[oldKey];
        }
        this.overridePatternPropertiesKey = newKey;
        if (newKey) {
            this.combinedSchema.patternProperties[newKey] = this.overridePatternProperties;
        }
        this.fireDidPreferenceSchemaChanged();
    }
    protected computeOverridePatternPropertiesKey(): string | undefined {
        let param: string = '';
        for (const overrideIdentifier of this.overrideIdentifiers.keys()) {
            if (param.length) {
                param += '|';
            }
            param += new RegExp(escapeRegExpCharacters(overrideIdentifier)).source;
        }
        return param.length ? OVERRIDE_PATTERN_WITH_SUBSTITUTION.replace('${0}', param) : undefined;
    }

    protected doUnsetSchema(changes: PreferenceProviderDataChange[]): PreferenceProviderDataChange[] {
        const inverseChanges: PreferenceProviderDataChange[] = [];
        for (const change of changes) {
            const preferenceName = change.preferenceName;
            const overridden = this.overriddenPreferenceName(preferenceName);
            if (overridden) {
                delete this.overridePatternProperties.properties[`[${overridden.overrideIdentifier}]`];
                this.removePropFromSchemas(`[${overridden.overrideIdentifier}]`);
            } else {
                this.removePropFromSchemas(preferenceName);
            }
            const newValue = change.oldValue;
            const oldValue = change.newValue;
            const { scope, domain } = change;
            const inverseChange: Mutable<PreferenceProviderDataChange> = { preferenceName, oldValue, scope, domain };
            if (typeof newValue === undefined) {
                delete this.preferences[preferenceName];
            } else {
                inverseChange.newValue = newValue;
                this.preferences[preferenceName] = newValue;
            }
            inverseChanges.push(inverseChange);
        }
        return inverseChanges;
    }

    protected doSetSchema(schema: PreferenceSchema): PreferenceProviderDataChange[] {
        const ajv = new Ajv();
        const valid = ajv.validateSchema(schema);
        if (!valid) {
            const errors = !!ajv.errors ? ajv.errorsText(ajv.errors) : 'unknown validation error';
            console.warn('A contributed preference schema has validation issues : ' + errors);
        }
        const scope = PreferenceScope.Default;
        const domain = this.getDomain();
        const changes: PreferenceProviderDataChange[] = [];
        const defaultScope = PreferenceSchema.getDefaultScope(schema);
        const overridable = schema.overridable || false;
        for (const preferenceName of Object.keys(schema.properties)) {
            if (this.combinedSchema.properties[preferenceName]) {
                console.error('Preference name collision detected in the schema for property: ' + preferenceName);
            } else {
                const schemaProps = PreferenceDataProperty.fromPreferenceSchemaProperty(schema.properties[preferenceName], defaultScope);
                if (typeof schemaProps.overridable !== 'boolean' && overridable) {
                    schemaProps.overridable = true;
                }
                if (schemaProps.overridable) {
                    this.overridePatternProperties.properties[preferenceName] = schemaProps;
                }
                this.updateSchemaProps(preferenceName, schemaProps);

                const modifiedProperties = this.schema(preferenceName, schemaProps);
                const value = schemaProps.defaultValue = this.getDefaultValue(modifiedProperties, preferenceName);
                if (this.testOverrideValue(preferenceName, value)) {
                    for (const overriddenPreferenceName in value) {
                        const overrideValue = value[overriddenPreferenceName];
                        const overridePreferenceName = `${preferenceName}.${overriddenPreferenceName}`;
                        changes.push(this.doSetPreferenceValue(overridePreferenceName, overrideValue, { scope, domain }));
                    }
                } else {
                    changes.push(this.doSetPreferenceValue(preferenceName, value, { scope, domain }));
                }
            }
        }
        return changes;
    }

    protected doSetPreferenceValue(preferenceName: string, newValue: any, { scope, domain }: {
        scope: PreferenceScope,
        domain?: string[]
    }): PreferenceProviderDataChange {
        const oldValue = this.preferences[preferenceName];
        this.preferences[preferenceName] = newValue;
        return { preferenceName, oldValue, newValue, scope, domain };
    }

    /** @deprecated since 0.6.0 pass preferenceName as the second arg */
    protected getDefaultValue(property: PreferenceItem): any;
    protected getDefaultValue(property: PreferenceItem, preferenceName: string): any;
    protected getDefaultValue(property: PreferenceItem, preferenceName?: string): any {
        const config = FrontendApplicationConfigProvider.get();
        if (preferenceName && FrontendApplicationPreferenceConfig.is(config) && preferenceName in config.preferences) {
            return config.preferences[preferenceName];
        }
        if (property.defaultValue !== undefined) {
            return property.defaultValue;
        }
        if (property.default !== undefined) {
            return property.default;
        }
        const type = Array.isArray(property.type) ? property.type[0] : property.type;
        switch (type) {
            case 'boolean':
                return false;
            case 'integer':
            case 'number':
                return 0;
            case 'string':
                return '';
            case 'array':
                return [];
            case 'object':
                return {};
        }
        // eslint-disable-next-line no-null/no-null
        return null;
    }

    protected doSetSchemaModification(schemaModification: PreferenceSchemaModification): void {
        for (const preferenceName of Object.keys(schemaModification.properties)) {
            const modifiableProperties = this.combinedSchema.properties[preferenceName];
            const previousModifications = this.modifications[preferenceName] ?? {};
            const newModifications: PreferenceSchemaPropertyModification = schemaModification.properties[preferenceName];
            this.modifications[preferenceName] = { ...previousModifications, ...newModifications };

            // Validate that the modifications only constrain the schema, cannot allow extra values
            const modifiedEnum = newModifications.enum;
            if (modifiedEnum !== undefined) {
                if (modifiableProperties) {
                    if (modifiableProperties.type !== 'string') {
                        console.warn(`Override of preference ${preferenceName} cannot constrain to enum values because the property is not string type.`);
                        continue;
                    }
                    if (modifiableProperties.enum && modifiableProperties.enum.some(v => !modifiedEnum.includes(v))) {
                        console.warn(`Override of preference enum ${preferenceName} cannot add enum values, it can only constrain the set of values.`);
                        continue;
                    }
                }
            }
            const modifiedMinimum = newModifications.minimum;
            if (modifiedMinimum !== undefined) {
                if (modifiableProperties) {
                    if (modifiableProperties.minimum && modifiedMinimum < modifiableProperties.minimum) {
                        console.warn(`Override of preference minimum ${preferenceName} cannot reduce the minimum, it can only increase it.`);
                        continue;
                    }
                }
            }
        }
    }

    protected schema(preferenceName: string, propertySchema: PreferenceDataProperty): PreferenceDataProperty {
        const modifications = this.modifications[preferenceName];
        return modifications ? { ...propertySchema, ...modifications } : propertySchema;
    }

    getCombinedSchema(): PreferenceDataSchema {
        const properties: { [key: string]: PreferenceDataProperty; } = {};
        for (const preferenceName of Object.keys(this.combinedSchema.properties)) {
            const value = this.combinedSchema.properties[preferenceName];
            const modifications = this.modifications[preferenceName];
            if (modifications) {
                if (!modifications.hidden) {
                    const modifiedValue = this.schema(preferenceName, value);
                    properties[preferenceName] = modifiedValue;
                }
            } else {
                properties[preferenceName] = value;
            }
        }
        return { ...this.combinedSchema, properties };
    }

    getPropertySchema(preferenceName: string): PreferenceDataProperty | undefined {
        const property = this.combinedSchema.properties[preferenceName];
        if (property) {
            return this.schema(preferenceName, property);
        }
    }

    getSchema(scope: PreferenceScope): PreferenceDataSchema {
        switch (scope) {
            case PreferenceScope.Default:
            case PreferenceScope.User:
                return this.combinedSchema;
            case PreferenceScope.Workspace:
                return this.workspaceSchema;
            case PreferenceScope.Folder:
                return this.folderSchema;
        }
    }

    setSchema(schema: PreferenceSchema): Disposable {
        const changes = this.doSetSchema(schema);
        if (!changes.length) {
            return Disposable.NULL;
        }
        this.fireDidPreferenceSchemaChanged();
        this.emitPreferencesChangedEvent(changes);
        return Disposable.create(() => {
            const inverseChanges = this.doUnsetSchema(changes);
            if (!inverseChanges.length) {
                return;
            }
            this.fireDidPreferenceSchemaChanged();
            this.emitPreferencesChangedEvent(inverseChanges);
        });
    }

    getPreferences(): { [name: string]: any } {
        return this.preferences;
    }

    async setPreference(): Promise<boolean> {
        return false;
    }

    isValidInScope(preferenceName: string, scope: PreferenceScope): boolean {
        let property;
        const overridden = this.overriddenPreferenceName(preferenceName);
        if (overridden) {
            // try from overridden schema
            property = this.overridePatternProperties[`[${overridden.overrideIdentifier}]`];
            property = property && property[overridden.preferenceName];
            if (!property) {
                // try from overridden identifier
                property = this.overridePatternProperties[overridden.preferenceName];
            }
            if (!property) {
                // try from overridden value
                property = this.getPropertySchema(overridden.preferenceName);
            }
        } else {
            property = this.getPropertySchema(preferenceName);
        }
        return property && property.scope! >= scope;
    }

    *getPreferenceNames(): IterableIterator<string> {
        for (const preferenceName in this.combinedSchema.properties) {
            yield preferenceName;
            for (const overridePreferenceName of this.getOverridePreferenceNames(preferenceName)) {
                yield overridePreferenceName;
            }
        }
    }

    *getOverridePreferenceNames(preferenceName: string): IterableIterator<string> {
        const preference = this.getPropertySchema(preferenceName);
        if (preference && preference.overridable) {
            for (const overrideIdentifier of this.overrideIdentifiers) {
                yield this.overridePreferenceName({ preferenceName, overrideIdentifier });
            }
        }
    }

    overridePreferenceName({ preferenceName, overrideIdentifier }: OverridePreferenceName): string {
        return `[${overrideIdentifier}].${preferenceName}`;
    }
    overriddenPreferenceName(name: string): OverridePreferenceName | undefined {
        const index = name.indexOf('.');
        if (index === -1) {
            return undefined;
        }
        const matches = name.substr(0, index).match(OVERRIDE_PROPERTY_PATTERN);
        const overrideIdentifier = matches && matches[1];
        if (!overrideIdentifier || !this.overrideIdentifiers.has(overrideIdentifier)) {
            return undefined;
        }
        const preferenceName = name.substr(index + 1);
        return { preferenceName, overrideIdentifier };
    }

    testOverrideValue(name: string, value: any): value is PreferenceSchemaProperties {
        return PreferenceSchemaProperties.is(value) && OVERRIDE_PROPERTY_PATTERN.test(name);
    }

    private updateSchemaProps(key: string, property: PreferenceDataProperty): void {
        this.combinedSchema.properties[key] = property;

        switch (property.scope) {
            case PreferenceScope.Workspace:
                this.workspaceSchema.properties[key] = property;
                break;
            case PreferenceScope.Folder:
                this.folderSchema.properties[key] = property;
                break;
        }
    }

    private removePropFromSchemas(key: string): void {
        const scope = this.combinedSchema.properties[key].scope;

        delete this.combinedSchema.properties[key];
        switch (scope) {
            case PreferenceScope.Workspace:
                delete this.workspaceSchema.properties[key];
                break;
            case PreferenceScope.Folder:
                delete this.folderSchema.properties[key];
                break;
        }
    }

    isPropertyHidden(preferenceName: string): boolean {
        const modifications = this.modifications[preferenceName];
        return modifications && !!modifications.hidden;
    }
}
