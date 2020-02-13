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
import Uri from 'vscode-uri';
import { Resource, ResourceResolver } from '@theia/core/lib/common/resource';
import URI from '@theia/core/lib/common/uri';
import { injectable } from 'inversify';
import { Disposable, DisposableCollection } from '@theia/core';
import { FileSystemExt } from '../../common';

@injectable()
export class FSResourceResolver implements ResourceResolver, Disposable {

    // resource providers by schemas
    private providers = new Map<string, FSResourceProvider>();
    private toDispose = new DisposableCollection();

    resolve(uri: URI): Resource {
        const provider = this.providers.get(uri.scheme);
        if (provider) {
            return provider.get(uri);
        }
        throw new Error(`Unable to find a Resource Provider for scheme '${uri.scheme}'`);
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    registerResourceProvider(handle: number, scheme: string, proxy: FileSystemExt): Disposable {
        if (this.providers.has(scheme)) {
            throw new Error(`Resource Provider for scheme '${scheme}' is already registered`);
        }

        const provider = new FSResourceProvider(handle, proxy);
        this.providers.set(scheme, provider);

        const disposable = Disposable.create(() => {
            provider.dispose();
            this.providers.delete(scheme);
        });
        this.toDispose.push(disposable);
        return disposable;
    }
}

class FSResourceProvider implements Disposable {

    private resourceCache = new Map<string, FSResource>();

    constructor(private handle: number, private proxy: FileSystemExt) { }

    get(uri: URI): Resource {
        let resource = this.resourceCache.get(uri.toString());
        if (!resource) {
            resource = new FSResource(this.handle, uri, this.proxy);
            this.resourceCache.set(uri.toString(), resource);
        }
        return resource;
    }

    dispose(): void {
        this.resourceCache.clear();
    }
}

/** Resource that delegates reading/saving a content to a plugin's FileSystemProvider. */
export class FSResource implements Resource {

    constructor(private handle: number, public uri: URI, private proxy: FileSystemExt) { }

    readContents(options?: { encoding?: string }): Promise<string> {
        return this.proxy.$readFile(this.handle, Uri.parse(this.uri.toString()), options);
    }

    saveContents(content: string, options?: { encoding?: string }): Promise<void> {
        return this.proxy.$writeFile(this.handle, Uri.parse(this.uri.toString()), content, options);
    }

    dispose(): void { }
}
