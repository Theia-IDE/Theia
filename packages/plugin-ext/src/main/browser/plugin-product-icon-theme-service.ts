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

import { DidChangeLabelEvent, LabelProviderContribution, URIIconReference } from '@theia/core/lib/browser/label-provider';
import { ProductIconTheme, ProductIconThemeDefinition, ProductIconThemeService } from '@theia/core/lib/browser/product-icon-theme-service';
import URI from '@theia/core/lib/common/uri';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { FileStatNode } from '@theia/filesystem/lib/browser';
import { FileChangeType, FileStat } from '@theia/filesystem/lib/common/files';
import { WorkspaceRootNode } from '@theia/navigator/lib/browser/navigator-tree';
import { Disposable, DisposableCollection, Emitter } from '@theia/core/lib/common';
import { IconRegistry } from '@theia/core/lib/browser/icon-registry';
import { DeployedPlugin, getPluginId, ProductIconThemeContribution, UiTheme } from '../../common';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import * as jsoncparser from 'jsonc-parser';
import { PluginFontDefinition, PluginIconDefinitions, PluginIconParsingUtils } from './plugin-icon-theme-service';

export interface PluginProductIconThemeDocument {
    iconDefinitions: PluginIconDefinitions
    fonts: PluginFontDefinition[]
}

@injectable()
export class PluginProductIconThemeDefinition implements ProductIconThemeDefinition, ProductIconThemeContribution {
    id: string;
    label: string;
    description?: string;
    uri: string;
    uiTheme?: UiTheme;
    pluginId: string;
    packageUri: string;
}

export const PluginProductIconThemeFactory = Symbol('PluginProductIconThemeFactory');
export type PluginProductIconThemeFactory = (definition: PluginProductIconThemeDefinition) => PluginProductIconTheme;

@injectable()
export class PluginProductIconTheme extends PluginProductIconThemeDefinition implements ProductIconTheme, Disposable {
    @inject(PluginProductIconThemeDefinition) protected readonly definition: PluginProductIconThemeDefinition;
    @inject(ProductIconThemeService) protected readonly productIconThemeService: ProductIconThemeService;
    @inject(FileService) protected readonly fileService: FileService;
    @inject(IconRegistry) protected readonly iconRegistry: IconRegistry;

    protected readonly toDispose = new DisposableCollection();
    protected readonly toDeactivate = new DisposableCollection();
    protected readonly onDidChangeEmitter = new Emitter<DidChangeLabelEvent>();
    readonly onDidChange = this.onDidChangeEmitter.event;
    protected packageRootUri: URI;
    protected locationUri: URI;
    protected styleSheetContent: string | undefined;
    protected readonly toUnload = new DisposableCollection();
    protected readonly icons = new Set<string>();
    protected readonly toDisposeStyleElement = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        Object.assign(this, this.definition);
        this.packageRootUri = new URI(this.packageUri);
        this.locationUri = new URI(this.uri).parent;
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    protected fireDidChange(): void {
        this.onDidChangeEmitter.fire({ affects: () => true });
    }

    activate(): Disposable {
        if (!this.toDeactivate.disposed) {
            return this.toDeactivate;
        }
        this.toDeactivate.push(Disposable.create(() => this.fireDidChange()));
        this.doActivate();
        return this.toDeactivate;
    }
    protected async doActivate(): Promise<void> {
        await this.load();
        this.updateStyleElement();
    }

    protected updateStyleElement(): void {
        this.toDisposeStyleElement.dispose();
        if (this.toDeactivate.disposed || !this.styleSheetContent) {
            return;
        }
        const styleElement = document.createElement('style');
        styleElement.type = 'text/css';
        styleElement.className = 'theia-icon-theme';
        styleElement.innerText = this.styleSheetContent;
        document.head.appendChild(styleElement);
        const toRemoveStyleElement = Disposable.create(() => styleElement.remove());
        this.toDisposeStyleElement.push(toRemoveStyleElement);
        this.toDeactivate.push(toRemoveStyleElement);
        console.log('SENTINEL STYLE ELEMENT', styleElement);
        this.fireDidChange();
    }

    // Compare with https://github.com/microsoft/vscode/blob/adf68a52d56dfa7b4d8a573a2fef682917f7f709/src/vs/workbench/services/themes/browser/productIconThemeData.ts#L186
    protected async load(): Promise<void> {
        if (this.styleSheetContent !== undefined) {
            return;
        }
        // const warnings: string[] = [];
        this.styleSheetContent = '';
        this.toUnload.push(Disposable.create(() => {
            this.styleSheetContent = undefined;
            this.icons.clear();
        }));

        const documentUri = new URI(this.uri);
        const textContent = (await this.fileService.read(documentUri)).value;
        const productIconThemeDocument: PluginProductIconThemeDocument = jsoncparser.parse(textContent, undefined, { disallowComments: false });
        const toUnwatch = this.fileService.watch(documentUri);
        if (this.toUnload.disposed) {
            toUnwatch.dispose();
        } else {
            this.toUnload.push(toUnwatch);
            this.toUnload.push(this.fileService.onDidFilesChange(e => {
                if (e.contains(documentUri, FileChangeType.ADDED) || e.contains(documentUri, FileChangeType.UPDATED)) {
                    // this.reload();
                }
            }));
        }

        const { fonts } = productIconThemeDocument ?? [];
        const fontIdMap = new Map<string, string>();
        const firstFont = fonts[0];
        this.parseFonts(fonts, fontIdMap);
        const { iconDefinitions } = productIconThemeDocument;
        if (!iconDefinitions) {
            return;
        }

        // For now, select TabBar icons and overwrite the CSS
        for (const key in iconDefinitions) {
            if (iconDefinitions[key]) {
                const definition = iconDefinitions[key];
                const iconMatch = this.iconRegistry.getIconById(key);
                if (iconMatch) {
                    if (definition.fontCharacter) {
                        const fontId = definition.fontId !== undefined ? fontIdMap.get(definition.fontId) : firstFont.id;
                        if (fontId && iconMatch.id) {
                            this.styleSheetContent += `.codicon.codicon-${iconMatch.id}::before {
    content: '${definition.fontCharacter}' !important;
    font-family: ${fontId} !important;
}`;
                            console.log('SENTINEL CONTENT', this.styleSheetContent);
                        }
                    }
                }
            }
        }
    }

    protected parseFonts(fonts: PluginFontDefinition[], fontIdMap: Map<string, string>): void {
        if (Array.isArray(fonts)) {
            for (const font of fonts) {
                if (font) {
                    // fontIdMap.set(font.id, )
                    let src = '';
                    if (Array.isArray(font.src)) {
                        for (const srcLocation of font.src) {
                            if (srcLocation && srcLocation.path) {
                                const cssUrl = PluginIconParsingUtils.toCSSUrl(srcLocation.path, this.locationUri, this.packageRootUri, this.pluginId);
                                if (cssUrl) {
                                    if (src) {
                                        src += ', ';
                                    }
                                    src += `${cssUrl} format('${srcLocation.format}')`;
                                }
                            }
                        }
                    }
                    if (src) {
                        this.styleSheetContent += `@font-face {
    src: ${src};
    font-family: '${font.id}';
    font-weight: ${font.weight};
    font-style: ${font.style};
}
`;
                    }
                }
            }
        }
    }

    getIcon(element: URI | URIIconReference | FileStat | FileStatNode | WorkspaceRootNode): string | undefined {
        const current = this.productIconThemeService.getDefinition(this.productIconThemeService.current);
        if (current instanceof PluginProductIconTheme) {
            return current.getIcon(element);
        }
        return undefined;
    }
}

@injectable()
export class PluginProductIconThemeService implements LabelProviderContribution {

    @inject(ProductIconThemeService)
    protected readonly productIconThemeService: ProductIconThemeService;

    @inject(PluginProductIconThemeFactory)
    protected readonly productIconThemeFactory: PluginProductIconThemeFactory;

    protected readonly onDidChangeEmitter = new Emitter<DidChangeLabelEvent>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    protected fireDidChange(): void {
        this.onDidChangeEmitter.fire({ affects: () => true });
    }

    register(contribution: ProductIconThemeContribution, plugin: DeployedPlugin): Disposable {
        const pluginId = getPluginId(plugin.metadata.model);
        const packageUri = plugin.metadata.model.packageUri;
        const productIconTheme = this.productIconThemeFactory({
            id: contribution.id,
            label: contribution.label || new URI(contribution.uri).path.base,
            description: contribution.description,
            uri: contribution.uri,
            uiTheme: contribution.uiTheme,
            pluginId,
            packageUri
        });
        return new DisposableCollection(
            productIconTheme,
            productIconTheme.onDidChange(() => this.fireDidChange()),
            this.productIconThemeService.register(productIconTheme)
        );
    }

    canHandle(element: object): number {
        const current = this.productIconThemeService.getDefinition(this.productIconThemeService.current);
        if (current instanceof PluginProductIconTheme && (
            (element instanceof URI && element.scheme === 'file') || URIIconReference.is(element) || FileStat.is(element) || FileStatNode.is(element)
        )) {
            return Number.MAX_SAFE_INTEGER;
        }
        return 0;
    }

    getIcon(element: URI | URIIconReference | FileStat | FileStatNode | WorkspaceRootNode): string | undefined {
        const current = this.productIconThemeService.getDefinition(this.productIconThemeService.current);
        if (current instanceof PluginProductIconTheme) {
            return current.getIcon(element);
        }
        return undefined;
    }

}
