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

import { injectable, inject } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { MaybePromise } from '@theia/core/lib/common';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import {
    FrontendApplicationContribution, ApplicationShell,
    NavigatableWidget, NavigatableWidgetOptions,
    Saveable, WidgetManager, StatefulWidget, FrontendApplication
} from '@theia/core/lib/browser';
import { FileSystemWatcher, FileChangeEvent, FileMoveEvent, FileChangeType } from './filesystem-watcher';
import { MimeService } from '@theia/core/lib/browser/mime-service';
import { FileSystemPreferences } from './filesystem-preferences';

export namespace FileSystemCommands {

}

@injectable()
export class FileSystemFrontendContribution implements FrontendApplicationContribution, CommandContribution {

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(WidgetManager)
    protected readonly widgetManager: WidgetManager;

    @inject(FileSystemWatcher)
    protected readonly fileSystemWatcher: FileSystemWatcher;

    @inject(MimeService)
    protected readonly mimeService: MimeService;

    @inject(FileSystemPreferences)
    protected readonly preferences: FileSystemPreferences;

    initialize(): void {
        this.fileSystemWatcher.onFilesChanged(event => this.run(() => this.updateWidgets(event)));
        this.fileSystemWatcher.onDidMove(event => this.run(() => this.moveWidgets(event)));
    }

    onStart?(app: FrontendApplication): MaybePromise<void> {
        this.updateAssociations();
        this.preferences.onPreferenceChanged(e => {
            if (e.preferenceName === 'files.associations') {
                this.updateAssociations();
            }
        });
    }

    registerCommands(commands: CommandRegistry): void {

    }

    protected pendingOperation = Promise.resolve();
    protected run(operation: () => MaybePromise<void>): Promise<void> {
        return this.pendingOperation = this.pendingOperation.then(async () => {
            try {
                await operation();
            } catch (e) {
                console.error(e);
            }
        });
    }

    protected async moveWidgets(event: FileMoveEvent): Promise<void> {
        const promises: Promise<void>[] = [];
        for (const [resourceUri, widget] of NavigatableWidget.get(this.shell.widgets)) {
            promises.push(this.moveWidget(resourceUri, widget, event));
        }
        await Promise.all(promises);
    }
    protected async moveWidget(resourceUri: URI, widget: NavigatableWidget, event: FileMoveEvent): Promise<void> {
        const newResourceUri = this.createMoveToUri(resourceUri, widget, event);
        if (!newResourceUri) {
            return;
        }
        const description = this.widgetManager.getDescription(widget);
        if (!description) {
            return;
        }
        const { factoryId, options } = description;
        if (!NavigatableWidgetOptions.is(options)) {
            return;
        }
        const newWidget = await this.widgetManager.getOrCreateWidget(factoryId, <NavigatableWidgetOptions>{
            ...options,
            uri: newResourceUri.toString()
        });
        const oldState = StatefulWidget.is(widget) ? widget.storeState() : undefined;
        if (oldState && StatefulWidget.is(newWidget)) {
            newWidget.restoreState(oldState);
        }
        const area = this.shell.getAreaFor(widget) || 'main';
        this.shell.addWidget(newWidget, {
            area, ref: widget
        });
        if (this.shell.activeWidget === widget) {
            this.shell.activateWidget(newWidget.id);
        } else if (widget.isVisible) {
            this.shell.revealWidget(newWidget.id);
        }
    }
    protected createMoveToUri(resourceUri: URI, widget: NavigatableWidget, event: FileMoveEvent): URI | undefined {
        const path = event.sourceUri.relative(resourceUri);
        const targetUri = path && event.targetUri.resolve(path);
        return targetUri && widget.createMoveToUri(targetUri);
    }

    protected readonly deletedSuffix = ' (deleted from disk)';
    protected updateWidgets(event: FileChangeEvent): void {
        const relevantEvent = event.filter(({ type }) => type !== FileChangeType.UPDATED);
        if (relevantEvent.length) {
            this.doUpdateWidgets(relevantEvent);
        }
    }
    protected doUpdateWidgets(event: FileChangeEvent): void {
        const dirty = new Set<string>();
        const toClose = new Map<string, NavigatableWidget[]>();
        for (const [uri, widget] of NavigatableWidget.get(this.shell.widgets)) {
            this.updateWidget(uri, widget, event, { dirty, toClose });
        }
        for (const [uriString, widgets] of toClose.entries()) {
            if (!dirty.has(uriString)) {
                for (const widget of widgets) {
                    widget.close();
                }
            }
        }
    }
    protected updateWidget(uri: URI, widget: NavigatableWidget, event: FileChangeEvent, { dirty, toClose }: {
        dirty: Set<string>;
        toClose: Map<string, NavigatableWidget[]>
    }): void {
        const label = widget.title.label;
        const deleted = label.endsWith(this.deletedSuffix);
        if (FileChangeEvent.isDeleted(event, uri)) {
            const uriString = uri.toString();
            if (Saveable.isDirty(widget)) {
                if (!deleted) {
                    widget.title.label += this.deletedSuffix;
                }
                dirty.add(uriString);
            }
            const widgets = toClose.get(uriString) || [];
            widgets.push(widget);
            toClose.set(uriString, widgets);
        } else if (FileChangeEvent.isAdded(event, uri)) {
            if (deleted) {
                widget.title.label = widget.title.label.substr(0, label.length - this.deletedSuffix.length);
            }
        }
    }

    protected updateAssociations(): void {
        const fileAssociations = this.preferences['files.associations'];
        const mimeAssociations = Object.keys(fileAssociations).map(filepattern => ({ id: fileAssociations[filepattern], filepattern }));
        this.mimeService.setAssociations(mimeAssociations);
    }
}
