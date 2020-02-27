/********************************************************************************
 * Copyright (C) 2019 TypeFox and others.
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

import { inject, injectable } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { PreferenceScope } from '@theia/core/lib/browser/preferences';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { AbstractResourcePreferenceProvider } from './abstract-resource-preference-provider';

@injectable()
export class WorkspaceFilePreferenceProviderOptions {
    workspaceUri: URI;
}

export const WorkspaceFilePreferenceProviderFactory = Symbol('WorkspaceFilePreferenceProviderFactory');
export type WorkspaceFilePreferenceProviderFactory = (options: WorkspaceFilePreferenceProviderOptions) => WorkspaceFilePreferenceProvider;

@injectable()
export class WorkspaceFilePreferenceProvider extends AbstractResourcePreferenceProvider {

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(WorkspaceFilePreferenceProviderOptions)
    protected readonly options: WorkspaceFilePreferenceProviderOptions;

    protected getUri(): URI {
        return this.options.workspaceUri;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected parse(content: string): any {
        const data = super.parse(content);
        if (data && 'settings' in data && data['settings'] && typeof data['settings'] === 'object') {
            return data.settings;
        }
        return {};
    }

    protected getPath(preferenceName: string): string[] {
        return ['settings', preferenceName];
    }

    protected getScope(): PreferenceScope {
        return PreferenceScope.Workspace;
    }

    getDomain(): string[] {
        // workspace file is treated as part of the workspace
        return this.workspaceService.tryGetRoots().map(r => r.uri).concat([this.options.workspaceUri.toString()]);
    }
}
