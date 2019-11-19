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

import { Disposable, DisposableCollection } from '../../common/disposable';
import { Breadcrumbs } from './breadcrumbs';

/**
 * This class creates a popup container at the given position
 * so that contributions can attach their HTML elements
 * as childs of `BreadcrumbPopupContainer#container`.
 *
 * - `dispose()` is called on blur or on hit on escape
 */
export class BreadcrumbPopupContainer implements Disposable {

    protected toDispose: DisposableCollection = new DisposableCollection();

    readonly container: HTMLElement;
    public isOpen: boolean;

    constructor(
        protected readonly parent: HTMLElement,
        public readonly breadcrumbId: string,
        position: { x: number, y: number }
    ) {
        this.container = this.createPopupDiv(position);
        document.addEventListener('keyup', this.escFunction);
        this.container.focus();
        this.isOpen = true;
    }

    protected createPopupDiv(position: { x: number, y: number }): HTMLDivElement {
        const result = window.document.createElement('div');
        result.className = Breadcrumbs.Styles.BREADCRUMB_POPUP;
        result.style.left = `${position.x}px`;
        result.style.top = `${position.y}px`;
        result.tabIndex = 0;
        result.onblur = event => this.onBlur(event, this.breadcrumbId);
        this.parent.appendChild(result);
        return result;
    }

    protected onBlur = (event: FocusEvent, breadcrumbId: string) => {
        if (event.relatedTarget && event.relatedTarget instanceof HTMLElement) {
            // event.relatedTarget is the element that has the focus after this popup looses the focus.
            // If a breadcrumb was clicked the following holds the breadcrumb ID of the clicked breadcrumb.
            const clickedBreadcrumbId = event.relatedTarget.getAttribute('data-breadcrumb-id');
            if (clickedBreadcrumbId && clickedBreadcrumbId === breadcrumbId) {
                // This is a click on the breadcrumb that has openend this popup.
                // We do not close this popup here but let the click event of the breadcrumb handle this instead
                // because it needs to know that this popup is open to decide if it just closes this popup or
                // also open a new popup.
                return;
            }
            if (this.container.contains(event.relatedTarget)) {
                // A child element gets focus. Set the focus to the container again.
                // Otherwise the popup would not be closed when elements outside the popup get the focus.
                // A popup content should not relay on getting a focus.
                this.container.focus();
                return;
            }
        }
        this.dispose();
    }

    protected escFunction = (event: KeyboardEvent) => {
        if (event.key === 'Escape' || event.key === 'Esc') {
            this.dispose();
        }
    }

    dispose(): void {
        this.toDispose.dispose();
        if (this.parent.contains(this.container)) {
            this.parent.removeChild(this.container);
        }
        this.isOpen = false;
        document.removeEventListener('keyup', this.escFunction);
    }

    addDisposable(disposable: Disposable | undefined): void {
        if (disposable) { this.toDispose.push(disposable); }
    }
}
