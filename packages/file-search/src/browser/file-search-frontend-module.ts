/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
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

import { ContainerModule, interfaces } from '@theia/core/shared/inversify';
import { CommandContribution } from '@theia/core/lib/common';
import { WebSocketConnectionProvider, KeybindingContribution } from '@theia/core/lib/browser';
import { QuickFileOpenFrontendContribution } from './quick-file-open-contribution';
import { QuickFileOpenService } from './quick-file-open';
import { fileSearchServicePath, FileSearchService } from '../common/file-search-service';
import { QuickAccessContribution } from '@theia/core/lib/browser/quick-input/quick-access';

export default new ContainerModule((bind: interfaces.Bind) => {
    bind(FileSearchService).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<FileSearchService>(fileSearchServicePath);
    }).inSingletonScope();

    bind(QuickFileOpenFrontendContribution).toSelf().inSingletonScope();
    [CommandContribution, KeybindingContribution, QuickAccessContribution].forEach(serviceIdentifier =>
        bind(serviceIdentifier).toService(QuickFileOpenFrontendContribution)
    );

    bind(QuickFileOpenService).toSelf().inSingletonScope();
});
