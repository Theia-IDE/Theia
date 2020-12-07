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

import { injectable, inject } from 'inversify';
import { LabelProviderContribution, LabelProvider, DidChangeLabelEvent } from '@theia/core/lib/browser/label-provider';
import URI from '@theia/core/lib/common/uri';
import { GIT_RESOURCE_SCHEME } from '@theia/git/lib/browser/git-resource';

@injectable()
export class GitUriLabelProviderContribution implements LabelProviderContribution {

    constructor(@inject(LabelProvider) protected labelProvider: LabelProvider) {
    }

    canHandle(element: object): number {
        if (element instanceof URI && element.scheme === GIT_RESOURCE_SCHEME) {
            return 20;
        }
        return 0;
    }

    getLongName(uri: URI): string {
        return this.labelProvider.getLongName(this.toFileUri(uri).withoutQuery().withoutFragment());
    }

    getName(uri: URI): string {
        return this.labelProvider.getName(this.toFileUri(uri)) + this.getTagSuffix(uri);
    }

    getIcon(uri: URI): string {
        return this.labelProvider.getIcon(this.toFileUri(uri));
    }

    affects(uri: URI, event: DidChangeLabelEvent): boolean {
        const fileUri = this.toFileUri(uri);
        return event.affects(fileUri) || event.affects(fileUri.withoutQuery().withoutFragment());
    }

    protected toFileUri(uri: URI): URI {
        return uri.withScheme('file');
    }

    protected getTagSuffix(uri: URI): string {
        if (uri.query) {
            return ` (${uri.query})`;
        } else {
            return '';
        }
    }
}
