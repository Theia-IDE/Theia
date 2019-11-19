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

import * as React from 'react';
import { injectable, inject, postConstruct } from 'inversify';
import { ReactRenderer } from '../widgets';
import { Breadcrumb } from './breadcrumb';
import { Breadcrumbs } from './breadcrumbs';
import { BreadcrumbsService } from './breadcrumbs-service';
import { BreadcrumbRenderer } from './breadcrumb-renderer';
import PerfectScrollbar from 'perfect-scrollbar';
import URI from '../../common/uri';
import { BreadcrumbPopupContainer } from './breadcrumb-popup-container';
import { DisposableCollection } from '../../common/disposable';
import { CorePreferences } from '../core-preferences';

export const BreadcrumbsURI = Symbol('BreadcrumbsURI');

@injectable()
export class BreadcrumbsRenderer extends ReactRenderer {

    @inject(BreadcrumbsService)
    protected readonly breadcrumbsService: BreadcrumbsService;

    @inject(BreadcrumbRenderer)
    protected readonly breadcrumbRenderer: BreadcrumbRenderer;

    @inject(CorePreferences)
    protected readonly corePreferences: CorePreferences;

    private breadcrumbs: Breadcrumb[] = [];

    private popup: BreadcrumbPopupContainer | undefined;

    private scrollbar: PerfectScrollbar | undefined;

    private toDispose: DisposableCollection = new DisposableCollection();

    constructor(
        @inject(BreadcrumbsURI) readonly uri: URI
    ) { super(); }

    @postConstruct()
    init(): void {
        this.toDispose.push(this.breadcrumbsService.onDidChangeBreadcrumbs(uri => { if (this.uri.toString() === uri.toString()) { this.refresh(); } }));
        this.toDispose.push(this.corePreferences.onPreferenceChanged(_ => this.refresh()));
    }

    dispose(): void {
        super.dispose();
        this.toDispose.dispose();
        if (this.popup) { this.popup.dispose(); }
        if (this.scrollbar) {
            this.scrollbar.destroy();
            this.scrollbar = undefined;
        }
    }

    async refresh(): Promise<void> {
        if (this.corePreferences['breadcrumbs.enabled']) {
            this.breadcrumbs = await this.breadcrumbsService.getBreadcrumbs(this.uri);
        } else {
            this.breadcrumbs = [];
        }
        this.render();

        if (!this.scrollbar) {
            if (this.host.firstChild) {
                this.scrollbar = new PerfectScrollbar(this.host.firstChild as HTMLElement, {
                    handlers: ['drag-thumb', 'keyboard', 'wheel', 'touch'],
                    useBothWheelAxes: true,
                    scrollXMarginOffset: 4,
                    suppressScrollY: true
                });
            }
        } else {
            this.scrollbar.update();
        }
        this.scrollToEnd();
    }

    private scrollToEnd(): void {
        if (this.host.firstChild) {
            const breadcrumbsHtmlElement = (this.host.firstChild as HTMLElement);
            breadcrumbsHtmlElement.scrollLeft = breadcrumbsHtmlElement.scrollWidth;
        }
    }

    protected doRender(): React.ReactNode {
        return <ul key={'ul'} className={Breadcrumbs.Styles.BREADCRUMBS}>{this.renderBreadcrumbs()}</ul>;
    }

    protected renderBreadcrumbs(): React.ReactNode {
        return this.breadcrumbs.map(breadcrumb => this.breadcrumbRenderer.render(breadcrumb, this.togglePopup));
    }

    protected togglePopup = (breadcrumb: Breadcrumb, event: React.MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();
        let openPopup = true;
        if (this.popup) {
            if (this.popup.isOpen) {
                this.popup.dispose();

                // There is a popup open. If the popup is the popup that belongs to the currently clicked breadcrumb
                // just close the popup. When another breadcrumb was clicked open the new popup immediately.
                openPopup = !(this.popup.breadcrumbId === breadcrumb.id);
            }
            this.popup = undefined;
        }
        if (openPopup) {
            if (event.nativeEvent.target && event.nativeEvent.target instanceof HTMLElement) {
                const breadcrumbsHtmlElement = BreadcrumbsRenderer.findParentBreadcrumbsHtmlElement(event.nativeEvent.target as HTMLElement);
                if (breadcrumbsHtmlElement && breadcrumbsHtmlElement.parentElement && breadcrumbsHtmlElement.parentElement.lastElementChild) {
                    const position: { x: number, y: number } = BreadcrumbsRenderer.determinePopupAnchor(event.nativeEvent) || event.nativeEvent;
                    this.breadcrumbsService.openPopup(breadcrumb, position).then(popup => { this.popup = popup; });
                }
            }
        }
    }
}

export namespace BreadcrumbsRenderer {

    /**
     * Traverse upstream (starting with the HTML element `child`) to find a parent HTML element
     * that has the CSS class `Breadcrumbs.Styles.BREADCRUMB_ITEM`.
     */
    export function findParentItemHtmlElement(child: HTMLElement): HTMLElement | undefined {
        return findParentHtmlElement(child, Breadcrumbs.Styles.BREADCRUMB_ITEM);
    }

    /**
     * Traverse upstream (starting with the HTML element `child`) to find a parent HTML element
     * that has the CSS class `Breadcrumbs.Styles.BREADCRUMBS`.
     */
    export function findParentBreadcrumbsHtmlElement(child: HTMLElement): HTMLElement | undefined {
        return findParentHtmlElement(child, Breadcrumbs.Styles.BREADCRUMBS);
    }

    /**
     * Traverse upstream (starting with the HTML element `child`) to find a parent HTML element
     * that has the given CSS class.
     */
    export function findParentHtmlElement(child: HTMLElement, cssClass: string): HTMLElement | undefined {
        if (child.classList.contains(cssClass)) {
            return child;
        } else {
            if (child.parentElement !== null) {
                return findParentHtmlElement(child.parentElement, cssClass);
            }
        }
    }

    /**
     * Determines the popup anchor for the given mouse event.
     *
     * It finds the parent HTML element with CSS class `Breadcrumbs.Styles.BREADCRUMB_ITEM` of event's target element
     * and return the bottom left corner of this element.
     */
    export function determinePopupAnchor(event: MouseEvent): { x: number, y: number } | undefined {
        if (event.target === null || !(event.target instanceof HTMLElement)) {
            return undefined;
        }
        const itemHtmlElement = findParentItemHtmlElement(event.target);
        if (itemHtmlElement) {
            return {
                x: itemHtmlElement.getBoundingClientRect().left,
                y: itemHtmlElement.getBoundingClientRect().bottom
            };
        }
    }
}

export const BreadcrumbsRendererFactory = Symbol('BreadcrumbsRendererFactory');
export interface BreadcrumbsRendererFactory {
    (uri: URI): BreadcrumbsRenderer;
}
