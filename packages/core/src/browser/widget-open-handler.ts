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

import { inject, postConstruct, injectable } from 'inversify';
import URI from '../common/uri';
import { MaybePromise, Emitter, Event } from '../common';
import { BaseWidget } from './widgets';
import { ApplicationShell } from './shell';
import { OpenHandler, OpenerOptions } from './opener-service';
import { WidgetManager } from './widget-manager';

export type WidgetOpenMode = 'open' | 'reveal' | 'activate';
/**
 * `WidgetOpenerOptions` define serializable generic options used by the {@link WidgetOpenHandler}.
 */
export interface WidgetOpenerOptions extends OpenerOptions {
    /**
     * Determines whether the widget should be only opened, revealed or activated.
     * By default is `activate`.
     */
    mode?: WidgetOpenMode;
    /**
     * Specify how an opened widget should be added to the shell.
     * By default to the main area.
     */
    widgetOptions?: ApplicationShell.WidgetOptions;
    /**
     * Specify what the widget is opened for
     * preview: preview of image/pdf/etc.
     * edit: source file
     * By default to `edit`
     */
    openFor?: 'preview' | 'edit';
}

/**
 * Generic base class for {@link OpenHandler}s that are opening a widget for a given {@link URI}.
 */
@injectable()
export abstract class WidgetOpenHandler<W extends BaseWidget> implements OpenHandler {

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(WidgetManager)
    protected readonly widgetManager: WidgetManager;

    protected readonly onCreatedEmitter = new Emitter<W>();
    /**
     * Emit when a new widget is created.
     */
    readonly onCreated: Event<W> = this.onCreatedEmitter.event;

    @postConstruct()
    protected init(): void {
        this.widgetManager.onDidCreateWidget(({ factoryId, widget }) => {
            if (factoryId === this.id) {
                this.onCreatedEmitter.fire(widget as W);
            }
        });
    }

    /**
     * The widget open handler id.
     *
     * #### Implementation
     * - A widget factory for this id should be registered.
     * - Subclasses should not implement `WidgetFactory`
     * to avoid exposing capabilities to create a widget outside of `WidgetManager`.
     */
    abstract readonly id: string;
    abstract canHandle(uri: URI, options?: WidgetOpenerOptions): MaybePromise<number>;

    /**
     * Open a widget for the given uri and options.
     * Reject if the given options are not widget options or a widget cannot be opened.
     * @param uri the uri of the resource that should be opened.
     * @param options the widget opener options.
     *
     * @returns promise of the widget that resolves when the widget has been opened.
     */
    async open(uri: URI, options?: WidgetOpenerOptions): Promise<W> {
        const widget = await this.getOrCreateWidget(uri, options);
        await this.doOpen(widget, options);
        return widget;
    }
    protected async doOpen(widget: W, options?: WidgetOpenerOptions): Promise<void> {
        const op: WidgetOpenerOptions = {
            mode: 'activate',
            ...options
        };
        if (!widget.isAttached) {
            this.shell.addWidget(widget, op.widgetOptions || { area: 'main' });
        }
        if (op.mode === 'activate') {
            await this.shell.activateWidget(widget.id);
        } else if (op.mode === 'reveal') {
            await this.shell.revealWidget(widget.id);
        }
    }

    /**
     * Tries to get an existing widget for the given uri.
     * @param uri the uri of the widget.
     *
     * @returns a promise that resolves to the existing widget or `undefined` if no widget for the given uri exists.
     */
    getByUri(uri: URI): Promise<W | undefined> {
        return this.getWidget(uri);
    }

    /**
     * Return an existing widget for the given uri or creates a new one.
     *
     * It does not open a widget, use {@link WidgetOpenHandler#open} instead.
     * @param uri uri of the widget.
     *
     * @returns a promise of the existing or newly created widget.
     */
    getOrCreateByUri(uri: URI): Promise<W> {
        return this.getOrCreateWidget(uri);
    }

    /**
     * Retrieves all open widgets that have been opened by this handler.
     *
     * @returns all open widgets for this open handler.
     */
    get all(): W[] {
        return this.widgetManager.getWidgets(this.id) as W[];
    }

    protected tryGetPendingWidget(uri: URI, options?: WidgetOpenerOptions): MaybePromise<W> | undefined {
        const factoryOptions = this.createWidgetOptions(uri, options);
        return this.widgetManager.tryGetPendingWidget(this.id, factoryOptions);
    }

    protected getWidget(uri: URI, options?: WidgetOpenerOptions): Promise<W | undefined> {
        const widgetOptions = this.createWidgetOptions(uri, options);
        return this.widgetManager.getWidget<W>(this.id, widgetOptions);
    }

    protected getOrCreateWidget(uri: URI, options?: WidgetOpenerOptions): Promise<W> {
        const widgetOptions = this.createWidgetOptions(uri, options);
        return this.widgetManager.getOrCreateWidget<W>(this.id, widgetOptions);
    }

    protected abstract createWidgetOptions(uri: URI, options?: WidgetOpenerOptions): Object;

    /**
     * Closes all widgets that have been opened by this open handler.
     * @param options the close options that should be applied to all widgets.
     *
     * @returns a promise of all closed widgets that resolves after they have been closed.
     */
    async closeAll(options?: ApplicationShell.CloseOptions): Promise<W[]> {
        const closed = await Promise.all(this.all.map(widget => this.shell.closeWidget(widget.id, options)));
        return closed.filter(widget => !!widget) as W[];
    }

}
