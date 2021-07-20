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

import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { Panel, Widget } from '@theia/core/shared/@phosphor/widgets';
import { MenuModelRegistry } from '@theia/core/lib/common/menu';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { ViewContextKeyService } from './view-context-key-service';
import { StatefulWidget } from '@theia/core/lib/browser/shell/shell-layout-restorer';
import { Message } from '@theia/core/shared/@phosphor/messaging';
import { TreeViewWidget } from './tree-view-widget';

@injectable()
export class PluginViewWidgetIdentifier {
    id: string;
    viewId: string;
}

@injectable()
export class PluginViewWidget extends Panel implements StatefulWidget {

    @inject(MenuModelRegistry)
    protected readonly menus: MenuModelRegistry;

    @inject(CommandRegistry)
    protected readonly commands: CommandRegistry;

    @inject(ViewContextKeyService)
    protected readonly contextKeys: ViewContextKeyService;

    @inject(PluginViewWidgetIdentifier)
    readonly options: PluginViewWidgetIdentifier;

    currentViewContainerId: string | undefined;

    constructor() {
        super();
        this.node.tabIndex = -1;
        this.node.style.height = '100%';
    }

    @postConstruct()
    protected init(): void {
        this.id = this.options.id;
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        const widget = this.widgets[0];
        if (widget) {
            widget.activate();
            this.updateWidgetMessage();
        } else {
            this.node.focus();
        }
    }

    storeState(): PluginViewWidget.State {
        return {
            label: this.title.label,
            message: this.message,
            widgets: this.widgets,
            suppressUpdateViewVisibility: this._suppressUpdateViewVisibility,
            currentViewContainerId: this.currentViewContainerId
        };
    }

    restoreState(state: PluginViewWidget.State): void {
        this.title.label = state.label;
        this.message = state.message;
        this.suppressUpdateViewVisibility = state.suppressUpdateViewVisibility;
        this.currentViewContainerId = state.currentViewContainerId;
        for (const widget of state.widgets) {
            this.addWidget(widget);
        }
    }

    protected _suppressUpdateViewVisibility = false;
    set suppressUpdateViewVisibility(suppressUpdateViewVisibility: boolean) {
        this._suppressUpdateViewVisibility = !this.updatingViewVisibility && suppressUpdateViewVisibility;
    }

    protected updatingViewVisibility = false;
    updateViewVisibility(cb: () => void): void {
        if (this._suppressUpdateViewVisibility) {
            return;
        }
        try {
            this.updatingViewVisibility = true;
            cb();
        } finally {
            this.updatingViewVisibility = false;
        }
    }

    private _message: string | undefined;
    get message(): string | undefined {
        return this._message;
    }

    set message(message: string | undefined) {
        this._message = message;
        this.updateWidgetMessage();
    }

    private updateWidgetMessage(): void {
        const widget = this.widgets[0];
        if (widget) {
            if (widget instanceof TreeViewWidget) {
                widget.message = this._message;
            }
        }
    }

    addWidget(widget: Widget): void {
        super.addWidget(widget);
        this.updateWidgetMessage();
    }

    insertWidget(index: number, widget: Widget): void {
        super.insertWidget(index, widget);
        this.updateWidgetMessage();
    }
}
export namespace PluginViewWidget {
    export interface State {
        label: string,
        message?: string,
        widgets: ReadonlyArray<Widget>,
        suppressUpdateViewVisibility: boolean;
        currentViewContainerId: string | undefined;
    }
}
