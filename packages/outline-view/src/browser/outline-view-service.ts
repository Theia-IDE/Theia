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
import { Event, Emitter, DisposableCollection } from '@theia/core';
import { WidgetFactory } from '@theia/core/lib/browser';
import { OutlineViewWidget, OutlineViewWidgetFactory, OutlineSymbolInformationNode } from './outline-view-widget';
import { Widget } from '@phosphor/widgets';

@injectable()
export class OutlineViewService implements WidgetFactory {

    id = 'outline-view';

    protected widget?: OutlineViewWidget;
    protected readonly onDidChangeOutlineEmitter = new Emitter<OutlineSymbolInformationNode[]>();
    protected readonly onDidChangeOpenStateEmitter = new Emitter<boolean>();
    protected readonly onDidSelectEmitter = new Emitter<OutlineSymbolInformationNode>();
    protected readonly onDidOpenEmitter = new Emitter<OutlineSymbolInformationNode>();

    constructor(@inject(OutlineViewWidgetFactory) protected factory: OutlineViewWidgetFactory) { }

    get onDidSelect(): Event<OutlineSymbolInformationNode> {
        return this.onDidSelectEmitter.event;
    }

    get onDidOpen(): Event<OutlineSymbolInformationNode> {
        return this.onDidOpenEmitter.event;
    }

    get onDidChangeOutline(): Event<OutlineSymbolInformationNode[]> {
        return this.onDidChangeOutlineEmitter.event;
    }

    get onDidChangeOpenState(): Event<boolean> {
        return this.onDidChangeOpenStateEmitter.event;
    }

    get open(): boolean {
        return this.widget !== undefined && this.widget.isVisible;
    }

    /**
     * Publish the collection of outline view symbols.
     * - Publishing includes setting the `OutlineViewWidget` tree with symbol information.
     * @param roots the list of outline symbol information nodes.
     */
    publish(roots: OutlineSymbolInformationNode[]): void {
        if (this.widget) {
            this.widget.setOutlineTree(roots);
        }
        // onDidChangeOutline needs to be fired even when the outline view widget is closed
        // in order to udpate breadcrumbs.
        this.onDidChangeOutlineEmitter.fire(roots);
    }

    createWidget(): Promise<Widget> {
        this.widget = this.factory();
        const disposables = new DisposableCollection();
        disposables.push(this.widget.onDidChangeOpenStateEmitter.event(open => this.onDidChangeOpenStateEmitter.fire(open)));
        disposables.push(this.widget.model.onOpenNode(node => this.onDidOpenEmitter.fire(node as OutlineSymbolInformationNode)));
        disposables.push(this.widget.model.onSelectionChanged(selection => this.onDidSelectEmitter.fire(selection[0] as OutlineSymbolInformationNode)));
        this.widget.disposed.connect(() => {
            this.widget = undefined;
            disposables.dispose();
        });
        return Promise.resolve(this.widget);
    }
}
