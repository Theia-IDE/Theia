/********************************************************************************
 * Copyright (C) 2019 Ericsson and others.
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

import { PreferenceScope } from './preference-scope';

export interface PreferenceSchema {
    [name: string]: any,
    scope?: 'application' | 'window' | 'resource' | PreferenceScope,
    overridable?: boolean;
    properties: PreferenceSchemaProperties
}
export namespace PreferenceSchema {
    export function is(obj: Object | undefined): obj is PreferenceSchema {
        return !!obj && ('properties' in obj) && PreferenceSchemaProperties.is((<any>obj)['properties']);
    }
    export function getDefaultScope(schema: PreferenceSchema): PreferenceScope {
        let defaultScope: PreferenceScope = PreferenceScope.Workspace;
        if (!PreferenceScope.is(schema.scope)) {
            defaultScope = PreferenceScope.fromString(<string>schema.scope) || PreferenceScope.Workspace;
        } else {
            defaultScope = schema.scope;
        }
        return defaultScope;
    }
}

export interface PreferenceSchemaProperties {
    [name: string]: PreferenceSchemaProperty
}
export namespace PreferenceSchemaProperties {
    export function is(obj: Object | undefined): obj is PreferenceSchemaProperties {
        return !!obj && typeof obj === 'object';
    }
}

export interface PreferenceDataSchema {
    [name: string]: any,
    scope?: PreferenceScope,
    properties: {
        [name: string]: PreferenceDataProperty
    }
    patternProperties: {
        [name: string]: PreferenceDataProperty
    };
}

export interface PreferenceItem {
    type?: JsonType | JsonType[];
    minimum?: number;
    /**
     * content assist (UI) default value
     */
    default?: any;
    /**
     * preference default value, if `undefined` then `default`
     */
    defaultValue?: any;
    enum?: string[];
    items?: PreferenceItem;
    properties?: { [name: string]: PreferenceItem };
    additionalProperties?: object | boolean;
    [name: string]: any;
    overridable?: boolean;
    hidden?: boolean;
}

export interface PreferenceSchemaProperty extends PreferenceItem {
    description?: string;
    markdownDescription?: string;
    scope?: 'application' | 'machine' | 'window' | 'resource' | 'language-overridable' | 'machine-overridable' | PreferenceScope;
}

export interface PreferenceDataProperty extends PreferenceItem {
    description?: string;
    markdownDescription?: string;
    scope?: PreferenceScope;
}
export namespace PreferenceDataProperty {
    export function fromPreferenceSchemaProperty(schemaProps: PreferenceSchemaProperty, defaultScope: PreferenceScope = PreferenceScope.Workspace): PreferenceDataProperty {
        if (!schemaProps.scope) {
            schemaProps.scope = defaultScope;
        } else if (typeof schemaProps.scope === 'string') {
            return Object.assign(schemaProps, { scope: PreferenceScope.fromString(schemaProps.scope) || defaultScope });
        }
        return <PreferenceDataProperty>schemaProps;
    }
}

export interface PreferenceSchemaModification {
    properties: PreferenceSchemaPropertyModifications
}

export interface PreferenceSchemaPropertyModifications {
    [name: string]: PreferenceSchemaPropertyModification
}

export interface PreferenceSchemaPropertyModification {
    minimum?: number;
    default?: any;
    enum?: string[];
    description?: string;
    hidden?: boolean;
}

export type JsonType = 'string' | 'array' | 'number' | 'integer' | 'object' | 'boolean' | 'null';
