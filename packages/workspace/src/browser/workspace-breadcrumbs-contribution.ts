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

import { FilepathBreadcrumb } from '@theia/filesystem/lib/browser/breadcrumbs/filepath-breadcrumb';
import { FilepathBreadcrumbsContribution } from '@theia/filesystem/lib/browser/breadcrumbs/filepath-breadcrumbs-contribution';
import { inject, injectable } from 'inversify';
import { WorkspaceService } from './workspace-service';
import URI from '@theia/core/lib/common/uri';

@injectable()
export class WorkspaceBreadcrumbsContribution extends FilepathBreadcrumbsContribution {

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    protected filterBreadcrumbs(uri: URI, breadcrumb: FilepathBreadcrumb): boolean {
        const workspaceRootUri = this.workspaceService.getWorkspaceRootUri(uri);
        return super.filterBreadcrumbs(uri, breadcrumb) && (!workspaceRootUri || !breadcrumb.uri.isEqualOrParent(workspaceRootUri));
    }
}
