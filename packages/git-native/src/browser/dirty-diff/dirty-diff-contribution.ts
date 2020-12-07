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

import { inject, injectable } from 'inversify';
import { DirtyDiffDecorator } from '@theia/scm/lib/browser/dirty-diff/dirty-diff-decorator';
import { FrontendApplicationContribution, FrontendApplication } from '@theia/core/lib/browser';
import { DirtyDiffManager } from './dirty-diff-manager';

@injectable()
export class DirtyDiffContribution implements FrontendApplicationContribution {

    constructor(
        @inject(DirtyDiffManager) protected readonly dirtyDiffManager: DirtyDiffManager,
        @inject(DirtyDiffDecorator) protected readonly dirtyDiffDecorator: DirtyDiffDecorator,
    ) { }

    onStart(app: FrontendApplication): void {
        this.dirtyDiffManager.onDirtyDiffUpdate(update => this.dirtyDiffDecorator.applyDecorations(update));
    }

}
