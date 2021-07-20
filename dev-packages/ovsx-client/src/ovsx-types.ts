/********************************************************************************
 * Copyright (C) 2020 TypeFox and others.
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

/**
 * The possible options when performing a search.
 *
 * For available options, and default values consult the `swagger`: https://open-vsx.org/swagger-ui/#/registry-api/searchUsingGET.
 *
 * Should be aligned with https://github.com/eclipse/openvsx/blob/b5694a712e07d266801394916bac30609e16d77b/server/src/main/java/org/eclipse/openvsx/RegistryAPI.java#L246-L266
 */
export interface VSXSearchParam {
    /**
     * The query text for searching.
     */
    query?: string;
    /**
     * The extension category.
     */
    category?: string;
    /**
     * The maximum number of entries to return.
     */
    size?: number;
    /**
     * The number of entries to skip (usually a multiple of the page size).
     */
    offset?: number;
    /**
     * The sort order.
     */
    sortOrder?: 'asc' | 'desc';
    /**
     * The sort key.
     */
    sortBy?: 'averageRating' | 'downloadCount' | 'relevance' | 'timestamp';
    /**
     * Determines whether to include information regarding all available entries for the entry.
     */
    includeAllVersions?: boolean;
}

/**
 * Should be aligned with https://github.com/eclipse/openvsx/blob/e8f64fe145fc05d2de1469735d50a7a90e400bc4/server/src/main/java/org/eclipse/openvsx/json/SearchResultJson.java
 */
export interface VSXSearchResult {
    readonly error?: string;
    readonly offset: number;
    readonly extensions: VSXSearchEntry[];
}

export interface VSXAllVersions {
    url: string,
    version: string,
    engines?: {
        [version: string]: string
    }
}

/**
 * Should be aligned with https://github.com/eclipse/openvsx/blob/master/server/src/main/java/org/eclipse/openvsx/json/SearchEntryJson.java
 */
export interface VSXSearchEntry {
    readonly url: string;
    readonly files: {
        download: string
        readme?: string
        changelog?: string
        license?: string
        icon?: string
    }
    readonly name: string;
    readonly namespace: string;
    readonly version: string;
    readonly timestamp: string;
    readonly averageRating?: number;
    readonly downloadCount: number;
    readonly displayName?: string;
    readonly description?: string;
    readonly allVersions: VSXAllVersions[];
}

export type VSXExtensionNamespaceAccess = 'public' | 'restricted';

/**
 * Should be aligned with https://github.com/eclipse/openvsx/blob/master/server/src/main/java/org/eclipse/openvsx/json/UserJson.java
 */
export interface VSXUser {
    loginName: string
    homepage?: string
}

export interface VSXExtensionRawFiles {
    download: string
    readme?: string
    changelog?: string
    license?: string
    icon?: string
}

/**
 * Should be aligned with https://github.com/eclipse/openvsx/blob/master/server/src/main/java/org/eclipse/openvsx/json/ExtensionJson.java
 */
export interface VSXExtensionRaw {
    readonly error?: string;
    readonly namespaceUrl: string;
    readonly reviewsUrl: string;
    readonly name: string;
    readonly namespace: string;
    readonly publishedBy: VSXUser
    readonly namespaceAccess: VSXExtensionNamespaceAccess;
    readonly files: VSXExtensionRawFiles,
    readonly allVersions: {
        [version: string]: string
    }
    readonly averageRating?: number;
    readonly downloadCount: number;
    readonly reviewCount: number;
    readonly version: string;
    readonly timestamp: string;
    readonly preview?: boolean;
    readonly displayName?: string;
    readonly description?: string;
    readonly categories?: string[];
    readonly tags?: string[];
    readonly license?: string;
    readonly homepage?: string;
    readonly repository?: string;
    readonly bugs?: string;
    readonly markdown?: string;
    readonly galleryColor?: string;
    readonly galleryTheme?: string;
    readonly qna?: string;
    readonly engines?: { [engine: string]: string };
}

export interface VSXQueryParam {
    namespaceName?: string;
    extensionName?: string;
    extensionVersion?: string;
    extensionId?: string;
    extensionUuid?: string;
    namespaceUuid?: string;
    includeAllVersions?: boolean;
}

export interface VSXQueryResult {
    extensions?: VSXExtensionRaw[];
}

export interface VSXResponseError extends Error {
    statusCode: number
}

export namespace VSXResponseError {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function is(error: any): error is VSXResponseError {
        return !!error && typeof error === 'object'
            && 'statusCode' in error && typeof error['statusCode'] === 'number';
    }
}

/**
 * Builtin namespaces maintained by the framework.
 */
export namespace VSXBuiltinNamespaces {
    /**
     * Namespace for individual vscode builtin extensions.
     */
    export const VSCODE = 'vscode';
    /**
     * Namespace for vscode builtin extension packs.
     * - corresponds to: https://github.com/eclipse-theia/vscode-builtin-extensions/blob/af9cfeb2ea23e1668a8340c1c2fb5afd56be07d7/src/create-extension-pack.js#L45
     */
    export const THEIA = 'eclipse-theia';
}
