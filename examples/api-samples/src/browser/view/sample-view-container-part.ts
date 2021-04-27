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

import { BaseWidget } from '@theia/core/lib/browser';
import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { Emitter } from '@theia/core/lib/common';

@injectable()
export class SampleViewContainerPart extends BaseWidget {
    static ID = 'sample-view-container-part';

    protected readonly iconDisplayChangedEmitter = new Emitter<void>();
    readonly onIconDisplayChanged = this.iconDisplayChangedEmitter.event;

    protected _shouldShowPlus = true;
    protected message: HTMLDivElement;

    get shouldShowPlus(): boolean {
        return this._shouldShowPlus;
    }

    @postConstruct()
    protected init(): void {
        this.toDispose.push(this.iconDisplayChangedEmitter);
        this.title.label = 'Sample View Container Part';
        this.addClass(SampleViewContainerPart.ID);
        this.id = SampleViewContainerPart.ID;
        this.node.style.padding = 'var(--theia-ui-padding)';
        this.node.style.textAlign = 'center';
        this.message = document.createElement('div');
        this.message.classList.add(`${SampleViewContainerPart.ID}-message`);
        this.message.textContent = this.getMessage(this.shouldShowPlus);
        const button = document.createElement('button');
        button.classList.add('theia-button');
        button.onclick = this.changeDisplay.bind(this);
        button.textContent = 'Change Icon';
        button.style.marginBlockStart = 'calc(var(--theia-ui-padding) * 2)';
        button.style.marginBlockEnd = 'calc(var(--theia-ui-padding) * 2)';
        this.node.appendChild(this.message);
        this.node.appendChild(button);
    }

    protected getMessage(shouldShowPlus: boolean): string {
        return `You should see a ${shouldShowPlus ? 'plus' : 'minus'} sign icon when you hover over this widget.`;
    }

    changeDisplay(): void {
        this._shouldShowPlus = !this.shouldShowPlus;
        this.message.textContent = this.getMessage(this.shouldShowPlus);
        this.iconDisplayChangedEmitter.fire();
    }
}
