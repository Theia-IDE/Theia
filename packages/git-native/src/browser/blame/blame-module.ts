/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
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

import { interfaces } from 'inversify';
import { KeybindingContribution, KeybindingContext } from '@theia/core/lib/browser';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { BlameContribution, BlameAnnotationsKeybindingContext } from './blame-contribution';
import { BlameDecorator } from './blame-decorator';
import { BlameManager } from './blame-manager';

export function bindBlame(bind: interfaces.Bind): void {
    bind(BlameContribution).toSelf().inSingletonScope();
    bind(BlameManager).toSelf().inSingletonScope();
    bind(BlameDecorator).toSelf().inSingletonScope();
    for (const serviceIdentifier of [CommandContribution, KeybindingContribution, MenuContribution]) {
        bind(serviceIdentifier).toService(BlameContribution);
    }
    bind(BlameAnnotationsKeybindingContext).toSelf().inSingletonScope();
    bind(KeybindingContext).toService(BlameAnnotationsKeybindingContext);
}
