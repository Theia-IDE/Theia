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

import { Widget } from '@theia/core/shared/@phosphor/widgets';
import { injectable, inject, optional } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { MaybePromise } from '@theia/core/lib/common/types';
import { QuickInputService } from '@theia/core/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common/menu';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { NavigatableWidget, NavigatableWidgetOpenHandler } from '@theia/core/lib/browser/navigatable';
import { open, OpenerService } from '@theia/core/lib/browser/opener-service';
import { LabelProvider } from '@theia/core/lib/browser/label-provider';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application';
import { WidgetOpenerOptions } from '@theia/core/lib/browser/widget-open-handler';
import { MiniBrowserService } from '../common/mini-browser-service';
import { MiniBrowser, MiniBrowserProps } from './mini-browser';
import { LocationMapperService } from './location-mapper-service';

export namespace MiniBrowserCommands {
    export const PREVIEW: Command = {
        id: 'mini-browser.preview',
        label: 'Open Preview',
        iconClass: 'theia-open-preview-icon'
    };
    export const OPEN_SOURCE: Command = {
        id: 'mini-browser.open.source',
        iconClass: 'theia-open-file-icon'
    };
    export const OPEN_URL: Command = {
        id: 'mini-browser.openUrl',
        category: 'Preview',
        label: 'Open URL'
    };
}

/**
 * Further options for opening a new `Mini Browser` widget.
 */
export interface MiniBrowserOpenerOptions extends WidgetOpenerOptions, MiniBrowserProps {

}

@injectable()
export class MiniBrowserOpenHandler extends NavigatableWidgetOpenHandler<MiniBrowser>
    implements FrontendApplicationContribution, CommandContribution, MenuContribution, TabBarToolbarContribution {

    static PREVIEW_URI = new URI().withScheme('__minibrowser__preview__');

    /**
     * Instead of going to the backend with each file URI to ask whether it can handle the current file or not,
     * we have this map of extension and priority pairs that we populate at application startup.
     * The real advantage of this approach is the following: [Phosphor cannot run async code when invoking `isEnabled`/`isVisible`
     * for the command handlers](https://github.com/eclipse-theia/theia/issues/1958#issuecomment-392829371)
     * so the menu item would be always visible for the user even if the file type cannot be handled eventually.
     * Hopefully, we could get rid of this hack once we have migrated the existing Phosphor code to [React](https://github.com/eclipse-theia/theia/issues/1915).
     */
    protected readonly supportedExtensions: Map<string, number> = new Map();

    readonly id = MiniBrowser.ID;
    readonly label = 'Preview';

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(QuickInputService) @optional()
    protected readonly quickInputService: QuickInputService;

    @inject(MiniBrowserService)
    protected readonly miniBrowserService: MiniBrowserService;

    @inject(LocationMapperService)
    protected readonly locationMapperService: LocationMapperService;

    onStart(): void {
        this.miniBrowserService.supportedFileExtensions().then(entries => {
            entries.forEach(entry => {
                const { extension, priority } = entry;
                this.supportedExtensions.set(extension, priority);
            });
        });
    }

    canHandle(uri: URI, options?: WidgetOpenerOptions): number {
        // It does not guard against directories. For instance, a folder with this name: `Hahahah.html`.
        // We could check with the FS, but then, this method would become async again.
        const extension = uri.toString().split('.').pop();
        if (extension) {
            // Set the priority negative if an open handler is called for 'edit' (not for 'preview')
            if (options && options.openFor === 'edit') {
                return -100;
            }
            return this.supportedExtensions.get(extension.toLocaleLowerCase()) || 0;
        }
        return 0;
    }

    async open(uri: URI, options?: MiniBrowserOpenerOptions): Promise<MiniBrowser> {
        const widget = await super.open(uri, options);
        const area = this.shell.getAreaFor(widget);
        if (area === 'right' || area === 'left') {
            const panelLayout = area === 'right' ? this.shell.getLayoutData().rightPanel : this.shell.getLayoutData().leftPanel;
            const minSize = this.shell.mainPanel.node.offsetWidth / 2;
            if (panelLayout && panelLayout.size && panelLayout.size <= minSize) {
                requestAnimationFrame(() => this.shell.resize(minSize, area));
            }
        }
        return widget;
    }

    protected async getOrCreateWidget(uri: URI, options?: MiniBrowserOpenerOptions): Promise<MiniBrowser> {
        const props = await this.options(uri, options);
        const widget = await super.getOrCreateWidget(uri, props);
        widget.setProps(props);
        return widget;
    }

    protected async options(uri?: URI, options?: MiniBrowserOpenerOptions): Promise<MiniBrowserOpenerOptions & { widgetOptions: ApplicationShell.WidgetOptions }> {
        // Get the default options.
        let result = await this.defaultOptions();
        if (uri) {
            // Decorate it with a few properties inferred from the URI.
            const startPage = uri.toString(true);
            const name = this.labelProvider.getName(uri);
            const iconClass = `${this.labelProvider.getIcon(uri)} file-icon`;
            // The background has to be reset to white only for "real" web-pages but not for images, for instance.
            const resetBackground = await this.resetBackground(uri);
            result = {
                ...result,
                startPage,
                name,
                iconClass,
                // Make sure the toolbar is not visible. We have the `iframe.src` anyway.
                toolbar: 'hide',
                resetBackground
            };
        }
        if (options) {
            // Explicit options overrule everything.
            result = {
                ...result,
                ...options
            };
        }
        return result;
    }

    protected resetBackground(uri: URI): MaybePromise<boolean> {
        const { scheme } = uri;
        const uriStr = uri.toString();
        return scheme === 'http'
            || scheme === 'https'
            || (scheme === 'file'
                && (uriStr.endsWith('html') || uriStr.endsWith('.htm'))
            );
    }

    protected async defaultOptions(): Promise<MiniBrowserOpenerOptions & { widgetOptions: ApplicationShell.WidgetOptions }> {
        return {
            mode: 'activate',
            widgetOptions: { area: 'main' },
            sandbox: MiniBrowserProps.SandboxOptions.DEFAULT,
            toolbar: 'show'
        };
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(MiniBrowserCommands.PREVIEW, {
            execute: widget => this.preview(widget),
            isEnabled: widget => this.canPreviewWidget(widget),
            isVisible: widget => this.canPreviewWidget(widget)
        });
        commands.registerCommand(MiniBrowserCommands.OPEN_SOURCE, {
            execute: widget => this.openSource(widget),
            isEnabled: widget => !!this.getSourceUri(widget),
            isVisible: widget => !!this.getSourceUri(widget)
        });
        commands.registerCommand(MiniBrowserCommands.OPEN_URL, {
            execute: (arg?: string) => this.openUrl(arg)
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(['editor_context_menu', 'navigation'], {
            commandId: MiniBrowserCommands.PREVIEW.id
        });
    }

    registerToolbarItems(toolbar: TabBarToolbarRegistry): void {
        toolbar.registerItem({
            id: MiniBrowserCommands.PREVIEW.id,
            command: MiniBrowserCommands.PREVIEW.id,
            tooltip: 'Open Preview to the Side'
        });
        toolbar.registerItem({
            id: MiniBrowserCommands.OPEN_SOURCE.id,
            command: MiniBrowserCommands.OPEN_SOURCE.id,
            tooltip: 'Open Source'
        });
    }

    protected canPreviewWidget(widget?: Widget): boolean {
        const uri = this.getUriToPreview(widget);
        return !!uri && !!this.canHandle(uri);
    }

    protected getUriToPreview(widget?: Widget): URI | undefined {
        const current = this.getWidgetToPreview(widget);
        return current && current.getResourceUri();
    }

    protected getWidgetToPreview(widget?: Widget): NavigatableWidget | undefined {
        const current = widget ? widget : this.shell.currentWidget;
        // MiniBrowser is NavigatableWidget and should be excluded from widgets to preview
        return !(current instanceof MiniBrowser) && NavigatableWidget.is(current) && current || undefined;
    }

    protected async preview(widget?: Widget): Promise<void> {
        const ref = this.getWidgetToPreview(widget);
        if (!ref) {
            return;
        }
        const uri = ref.getResourceUri();
        if (!uri) {
            return;
        }
        await this.open(uri, {
            mode: 'reveal',
            widgetOptions: { ref, mode: 'open-to-right' }
        });
    }

    protected async openSource(ref?: Widget): Promise<void> {
        const uri = this.getSourceUri(ref);
        if (uri) {
            await open(this.openerService, uri, {
                widgetOptions: { ref, mode: 'open-to-left' },
                openFor: 'edit'
            });
        }
    }

    protected getSourceUri(ref?: Widget): URI | undefined {
        const uri = ref instanceof MiniBrowser && ref.getResourceUri() || undefined;
        if (!uri || uri.scheme === 'http' || uri.scheme === 'https') {
            return undefined;
        }
        return uri;
    }

    protected async openUrl(arg?: string): Promise<void> {
        const url = arg ? arg : await this.quickInputService?.input({
            prompt: 'URL to open',
            placeHolder: 'Type a URL'
        });
        if (url) {
            await this.openPreview(url);
        }
    }

    async openPreview(startPage: string): Promise<MiniBrowser> {
        const props = await this.getOpenPreviewProps(await this.locationMapperService.map(startPage));
        return this.open(MiniBrowserOpenHandler.PREVIEW_URI, props);
    }

    protected async getOpenPreviewProps(startPage: string): Promise<MiniBrowserOpenerOptions> {
        const resetBackground = await this.resetBackground(new URI(startPage));
        return {
            name: 'Preview',
            startPage,
            toolbar: 'read-only',
            widgetOptions: {
                area: 'right'
            },
            resetBackground,
            iconClass: 'theia-mini-browser-icon',
            openFor: 'preview'
        };
    }

}
