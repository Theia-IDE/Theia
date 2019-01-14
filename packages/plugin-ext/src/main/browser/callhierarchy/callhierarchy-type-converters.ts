/********************************************************************************
 * Copyright (C) 2019 Red Hat, Inc. and others.
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

import {  Definition as CallHierarchyDefinition, Caller as CallHierarchyCaller } from '@theia/callhierarchy/lib/browser';
import * as model from '../../../api/model';
import * as callhierarchy from 'vscode-languageserver-types';
import URI from 'vscode-uri';
import { UriComponents } from '../../../common/uri-components';
import { Location } from 'vscode-languageserver-types';

export function toUriComponents(uri: string): UriComponents {
    return URI.parse(uri);
}

export function fromUriComponents(uri: UriComponents): string {
    return URI.revive(uri).toString();
}

export function fromLocation (location: Location): model.Location {
    return <model.Location> {
        uri: URI.parse(location.uri),
        range: fromRange(location.range)
    };
}

export function toLocation (location: model.Location): Location {
    return <Location> {
        uri: URI.revive(location.uri).toString(),
        range: toRange(location.range)
    };
}

export function fromRange(range: callhierarchy.Range | undefined): model.Range | undefined {
    if (!range) {
        return undefined;
    }
    const { start, end } = range;
    return {
        startLineNumber: start.line + 1,
        startColumn: start.character + 1,
        endLineNumber: end.line + 1,
        endColumn: end.character + 1
    };
}

export function toRange(range: model.Range | undefined): callhierarchy.Range | undefined {
    if (!range) {
        return undefined;
    }

    return callhierarchy.Range.create(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
}

export function toReferences(items: model.Location[]): Location[] {
    return items.map(toLocation);
}

export namespace SymbolKindConverter {
    // tslint:disable-next-line:no-null-keyword
    const fromMapping: { [kind: number]: model.SymbolKind } = Object.create(null);
    fromMapping[callhierarchy.SymbolKind.File] = model.SymbolKind.File;
    fromMapping[callhierarchy.SymbolKind.Module] = model.SymbolKind.Module;
    fromMapping[callhierarchy.SymbolKind.Namespace] = model.SymbolKind.Namespace;
    fromMapping[callhierarchy.SymbolKind.Package] = model.SymbolKind.Package;
    fromMapping[callhierarchy.SymbolKind.Class] = model.SymbolKind.Class;
    fromMapping[callhierarchy.SymbolKind.Method] = model.SymbolKind.Method;
    fromMapping[callhierarchy.SymbolKind.Property] = model.SymbolKind.Property;
    fromMapping[callhierarchy.SymbolKind.Field] = model.SymbolKind.Field;
    fromMapping[callhierarchy.SymbolKind.Constructor] = model.SymbolKind.Constructor;
    fromMapping[callhierarchy.SymbolKind.Enum] = model.SymbolKind.Enum;
    fromMapping[callhierarchy.SymbolKind.Interface] = model.SymbolKind.Interface;
    fromMapping[callhierarchy.SymbolKind.Function] = model.SymbolKind.Function;
    fromMapping[callhierarchy.SymbolKind.Variable] = model.SymbolKind.Variable;
    fromMapping[callhierarchy.SymbolKind.Constant] = model.SymbolKind.Constant;
    fromMapping[callhierarchy.SymbolKind.String] = model.SymbolKind.String;
    fromMapping[callhierarchy.SymbolKind.Number] = model.SymbolKind.Number;
    fromMapping[callhierarchy.SymbolKind.Boolean] = model.SymbolKind.Boolean;
    fromMapping[callhierarchy.SymbolKind.Array] = model.SymbolKind.Array;
    fromMapping[callhierarchy.SymbolKind.Object] = model.SymbolKind.Object;
    fromMapping[callhierarchy.SymbolKind.Key] = model.SymbolKind.Key;
    fromMapping[callhierarchy.SymbolKind.Null] = model.SymbolKind.Null;
    fromMapping[callhierarchy.SymbolKind.EnumMember] = model.SymbolKind.EnumMember;
    fromMapping[callhierarchy.SymbolKind.Struct] = model.SymbolKind.Struct;
    fromMapping[callhierarchy.SymbolKind.Event] = model.SymbolKind.Event;
    fromMapping[callhierarchy.SymbolKind.Operator] = model.SymbolKind.Operator;
    fromMapping[callhierarchy.SymbolKind.TypeParameter] = model.SymbolKind.TypeParameter;

    export function fromSymbolKind(kind: callhierarchy.SymbolKind): model.SymbolKind {
        return fromMapping[kind] || model.SymbolKind.Property;
    }

    // tslint:disable-next-line:no-null-keyword
    const toMapping: { [kind: number]: callhierarchy.SymbolKind } = Object.create(null);
    toMapping[model.SymbolKind.File] = callhierarchy.SymbolKind.File;
    toMapping[model.SymbolKind.Module] = callhierarchy.SymbolKind.Module;
    toMapping[model.SymbolKind.Namespace] = callhierarchy.SymbolKind.Namespace;
    toMapping[model.SymbolKind.Package] = callhierarchy.SymbolKind.Package;
    toMapping[model.SymbolKind.Class] = callhierarchy.SymbolKind.Class;
    toMapping[model.SymbolKind.Method] = callhierarchy.SymbolKind.Method;
    toMapping[model.SymbolKind.Property] = callhierarchy.SymbolKind.Property;
    toMapping[model.SymbolKind.Field] = callhierarchy.SymbolKind.Field;
    toMapping[model.SymbolKind.Constructor] = callhierarchy.SymbolKind.Constructor;
    toMapping[model.SymbolKind.Enum] = callhierarchy.SymbolKind.Enum;
    toMapping[model.SymbolKind.Interface] = callhierarchy.SymbolKind.Interface;
    toMapping[model.SymbolKind.Function] = callhierarchy.SymbolKind.Function;
    toMapping[model.SymbolKind.Variable] = callhierarchy.SymbolKind.Variable;
    toMapping[model.SymbolKind.Constant] = callhierarchy.SymbolKind.Constant;
    toMapping[model.SymbolKind.String] = callhierarchy.SymbolKind.String;
    toMapping[model.SymbolKind.Number] = callhierarchy.SymbolKind.Number;
    toMapping[model.SymbolKind.Boolean] = callhierarchy.SymbolKind.Boolean;
    toMapping[model.SymbolKind.Array] = callhierarchy.SymbolKind.Array;
    toMapping[model.SymbolKind.Object] = callhierarchy.SymbolKind.Object;
    toMapping[model.SymbolKind.Key] = callhierarchy.SymbolKind.Key;
    toMapping[model.SymbolKind.Null] = callhierarchy.SymbolKind.Null;
    toMapping[model.SymbolKind.EnumMember] = callhierarchy.SymbolKind.EnumMember;
    toMapping[model.SymbolKind.Struct] = callhierarchy.SymbolKind.Struct;
    toMapping[model.SymbolKind.Event] = callhierarchy.SymbolKind.Event;
    toMapping[model.SymbolKind.Operator] = callhierarchy.SymbolKind.Operator;
    toMapping[model.SymbolKind.TypeParameter] = callhierarchy.SymbolKind.TypeParameter;

    export function toSymbolKind(kind: model.SymbolKind): callhierarchy.SymbolKind {
        return toMapping[kind] || model.SymbolKind.Property;
    }
}

export function toDefinition(definition: model.CallHierarchyDefinition | undefined): CallHierarchyDefinition | undefined {
    if (!definition) {
        return undefined;
    }

    return <CallHierarchyDefinition> {
        location: toLocation(definition.location),
        symbolName: definition.symbolName,
        symbolKind: SymbolKindConverter.toSymbolKind(definition.symbolKind),
        containerName: definition.containerName,
        callers: (definition.callers) ?  definition.callers.map(toCaller) : undefined
    };
}

export function fromDefinition(definition: CallHierarchyDefinition): model.CallHierarchyDefinition {
    return <model.CallHierarchyDefinition> {
        location: fromLocation(definition.location),
        symbolName: definition.symbolName,
        symbolKind: SymbolKindConverter.fromSymbolKind(definition.symbolKind),
        containerName: definition.containerName,
        callers: (definition.callers) ?  definition.callers.map(fromCaller) : undefined
    };
}

export function toCaller(caller: model.CallHierarchyCaller): CallHierarchyCaller {
    return <CallHierarchyCaller> {
        callerDefinition: toDefinition(caller.callerDefinition),
        references: caller.references.map(toLocation)
    };
}

export function fromCaller(caller: CallHierarchyCaller): model.CallHierarchyCaller {
    return <model.CallHierarchyCaller> {
        callerDefinition: fromDefinition(caller.callerDefinition),
        references: caller.references.map(fromLocation)
    };
}
