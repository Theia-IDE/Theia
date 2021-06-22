/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
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

import { ContainerModule } from 'inversify';
import { localizationPath } from '../../common/i18n/localization';
import { LocalizationProviderImpl, LocalizationProvider } from './localization-provider';
import { ConnectionHandler, JsonRpcConnectionHandler, bindContributionProvider } from '../../common';
import { LocalizationRegistry, LocalizationContribution, TheiaLocalizationContribution } from './localization-contribution';
import { LocalizationBackendContribution } from './localization-backend-contribution';
import { BackendApplicationContribution } from '../backend-application';

export default new ContainerModule(bind => {
    bind(LocalizationProvider).to(LocalizationProviderImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler(localizationPath, () => ctx.container.get(LocalizationProvider))
    ).inSingletonScope();
    bind(LocalizationRegistry).toSelf().inSingletonScope();
    bindContributionProvider(bind, LocalizationContribution);
    bind(TheiaLocalizationContribution).toSelf().inSingletonScope();
    bind(LocalizationContribution).toService(TheiaLocalizationContribution);
    bind(LocalizationBackendContribution).toSelf().inSingletonScope();
    bind(BackendApplicationContribution).toService(LocalizationBackendContribution);
});
