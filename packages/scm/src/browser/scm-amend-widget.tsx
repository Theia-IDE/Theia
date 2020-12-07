/********************************************************************************
 * Copyright (C) 2020 Arm and others.
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

import { injectable, inject } from 'inversify';
import * as React from 'react';
import { ReactWidget, StorageService } from '@theia/core/lib/browser';
import { ScmService } from './scm-service';
import { ScmAvatarService } from './scm-avatar-service';
import { ScmAmendComponent } from './scm-amend-component';

@injectable()
export class ScmAmendWidget extends ReactWidget {

    static ID = 'scm-amend-widget';

    @inject(ScmService) protected readonly scmService: ScmService;
    @inject(ScmAvatarService) protected readonly avatarService: ScmAvatarService;
    @inject(StorageService) protected readonly storageService: StorageService;

    constructor() {
        super();
        this.scrollOptions = {
            suppressScrollX: true,
            minScrollbarLength: 35
        };
        this.addClass('theia-scm-commit-container');
        this.id = ScmAmendWidget.ID;
    }

    protected render(): React.ReactNode {
        const repository = this.scmService.selectedRepository;
        if (repository && repository.provider.amendSupport) {
            return React.createElement(
                ScmAmendComponent,
                {
                    key: `amend:${repository.provider.rootUri}`,
                    style: { flexGrow: 0 },
                    repository: repository,
                    scmAmendSupport: repository.provider.amendSupport,
                    setCommitMessage: this.setInputValue,
                    avatarService: this.avatarService,
                    storageService: this.storageService,
                }
            );
        }
    }

    protected setInputValue = (event: React.FormEvent<HTMLTextAreaElement> | React.ChangeEvent<HTMLTextAreaElement> | string) => {
        const repository = this.scmService.selectedRepository;
        if (repository) {
            repository.input.value = typeof event === 'string' ? event : event.currentTarget.value;
        }
    };

}
