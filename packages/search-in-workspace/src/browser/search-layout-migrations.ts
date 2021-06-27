/********************************************************************************
 * Copyright (C) 2021 SAP SE or an SAP affiliate company and others.
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

import { injectable } from '@theia/core/shared/inversify';
import { ApplicationShellLayoutMigration, WidgetDescription, ApplicationShellLayoutMigrationContext } from '@theia/core/lib/browser/shell/shell-layout-restorer';
import { SearchInWorkspaceWidget } from './search-in-workspace-widget';
import { SEARCH_VIEW_CONTAINER_ID, SEARCH_VIEW_CONTAINER_TITLE_OPTIONS } from './search-in-workspace-factory';

@injectable()
export class SearchLayoutVersion3Migration implements ApplicationShellLayoutMigration {
    readonly layoutVersion = 3.0;
    onWillInflateWidget(desc: WidgetDescription, { parent }: ApplicationShellLayoutMigrationContext): WidgetDescription | undefined {
        if (desc.constructionOptions.factoryId === SearchInWorkspaceWidget.ID && !parent) {
            return {
                constructionOptions: {
                    factoryId: SEARCH_VIEW_CONTAINER_ID
                },
                innerWidgetState: {
                    parts: [
                        {
                            widget: {
                                constructionOptions: {
                                    factoryId: SearchInWorkspaceWidget.ID
                                },
                                innerWidgetState: desc.innerWidgetState
                            },
                            partId: {
                                factoryId: SearchInWorkspaceWidget.ID
                            },
                            collapsed: false,
                            hidden: false
                        }
                    ],
                    title: SEARCH_VIEW_CONTAINER_TITLE_OPTIONS
                }
            };
        }
        return undefined;
    }
}
