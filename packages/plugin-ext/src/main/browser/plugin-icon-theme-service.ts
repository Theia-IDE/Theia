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
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// some code is copied and modified from:
// https://github.com/microsoft/vscode/blob/7cf4cca47aa025a590fc939af54932042302be63/src/vs/workbench/services/themes/browser/fileIconThemeData.ts

import debounce = require('@theia/core/shared/lodash.debounce');
import * as jsoncparser from 'jsonc-parser';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { IconThemeService, IconTheme, IconThemeDefinition } from '@theia/core/lib/browser/icon-theme-service';
import { IconThemeContribution, DeployedPlugin, UiTheme, getPluginId } from '../../common/plugin-protocol';
import URI from '@theia/core/lib/common/uri';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { Emitter } from '@theia/core/lib/common/event';
import { RecursivePartial } from '@theia/core/lib/common/types';
import { LabelProviderContribution, DidChangeLabelEvent, LabelProvider, URIIconReference } from '@theia/core/lib/browser/label-provider';
import { ThemeType } from '@theia/core/lib/browser/theming';
import { FileStatNode, DirNode } from '@theia/filesystem/lib/browser';
import { WorkspaceRootNode } from '@theia/navigator/lib/browser/navigator-tree';
import { Endpoint } from '@theia/core/lib/browser/endpoint';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileStat, FileChangeType } from '@theia/filesystem/lib/common/files';

export interface PluginIconDefinition {
    iconPath: string;
    fontColor: string;
    fontCharacter: string;
    fontSize: string;
    fontId: string;
}

export interface PluginFontDefinition {
    id: string;
    weight: string;
    style: string;
    size: string;
    src: { path: string; format: string; }[];
}

export interface PluginIconsAssociation {
    folder?: string;
    file?: string;
    folderExpanded?: string;
    rootFolder?: string;
    rootFolderExpanded?: string;
    folderNames?: { [folderName: string]: string; };
    folderNamesExpanded?: { [folderName: string]: string; };
    fileExtensions?: { [extension: string]: string; };
    fileNames?: { [fileName: string]: string; };
    languageIds?: { [languageId: string]: string; };
}

export interface PluginIconDefinitions {
    [key: string]: PluginIconDefinition
}

export interface PluginIconThemeDocument extends PluginIconsAssociation {
    iconDefinitions: PluginIconDefinitions;
    fonts: PluginFontDefinition[];
    light?: PluginIconsAssociation;
    highContrast?: PluginIconsAssociation;
    hidesExplorerArrows?: boolean;
}

export const PluginIconThemeFactory = Symbol('PluginIconThemeFactory');
export type PluginIconThemeFactory = (definition: PluginIconThemeDefinition) => PluginIconTheme;

@injectable()
export class PluginIconThemeDefinition implements IconThemeDefinition, IconThemeContribution {
    id: string;
    label: string;
    description?: string;
    uri: string;
    uiTheme?: UiTheme;
    pluginId: string;
    packageUri: string;
    hasFileIcons?: boolean;
    hasFolderIcons?: boolean;
    hidesExplorerArrows?: boolean;
}

@injectable()
export class PluginIconTheme extends PluginIconThemeDefinition implements IconTheme, Disposable {

    @inject(FileService)
    protected readonly fileService: FileService;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(PluginIconThemeDefinition)
    protected readonly definition: PluginIconThemeDefinition;

    protected readonly onDidChangeEmitter = new Emitter<DidChangeLabelEvent>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    protected readonly toDeactivate = new DisposableCollection();
    protected readonly toUnload = new DisposableCollection();
    protected readonly toDisposeStyleElement = new DisposableCollection();
    protected readonly toDispose = new DisposableCollection(
        this.toDeactivate, this.toDisposeStyleElement, this.toUnload, this.onDidChangeEmitter
    );

    protected packageRootUri: URI;
    protected locationUri: URI;

    protected styleSheetContent: string | undefined;
    protected readonly icons = new Set<string>();

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
        this.fireDidChange();
    }

    protected reload = debounce(() => {
        this.toUnload.dispose();
        this.doActivate();
    }, 50);

    /**
     * This should be aligned with
     * https://github.com/microsoft/vscode/blob/7cf4cca47aa025a590fc939af54932042302be63/src/vs/workbench/services/themes/browser/fileIconThemeData.ts#L201
     */
    protected async load(): Promise<void> {
        if (this.styleSheetContent !== undefined) {
            return;
        }
        this.styleSheetContent = '';
        this.toUnload.push(Disposable.create(() => {
            this.styleSheetContent = undefined;
            this.hasFileIcons = undefined;
            this.hasFolderIcons = undefined;
            this.hidesExplorerArrows = undefined;
            this.icons.clear();
        }));

        const uri = new URI(this.uri);
        const result = await this.fileService.read(uri);
        const content = result.value;
        const json: RecursivePartial<PluginIconThemeDocument> = jsoncparser.parse(content, undefined, { disallowComments: false });
        this.hidesExplorerArrows = !!json.hidesExplorerArrows;

        const toUnwatch = this.fileService.watch(uri);
        if (this.toUnload.disposed) {
            toUnwatch.dispose();
        } else {
            this.toUnload.push(toUnwatch);
            this.toUnload.push(this.fileService.onDidFilesChange(e => {
                if (e.contains(uri, FileChangeType.ADDED) || e.contains(uri, FileChangeType.UPDATED)) {
                    this.reload();
                }
            }));
        }

        const iconDefinitions = json.iconDefinitions;
        if (!iconDefinitions) {
            return;
        }
        const definitionSelectors = new Map<string, string[]>();
        const acceptSelector = (themeType: ThemeType, definitionId: string, ...icons: string[]) => {
            if (!iconDefinitions[definitionId]) {
                return;
            }
            let selector = '';
            for (const icon of icons) {
                if (icon) {
                    selector += '.' + icon;
                    this.icons.add(icon);
                }
            }
            if (!selector) {
                return;
            }
            const selectors = definitionSelectors.get(definitionId) || [];
            if (themeType !== 'dark') {
                selector = '.theia-' + themeType + ' ' + selector;
            }
            selectors.push(selector);
            selectors.push(selector + '::before');
            definitionSelectors.set(definitionId, selectors);
        };
        this.collectSelectors(json, acceptSelector.bind(undefined, 'dark'));
        if (json.light) {
            this.collectSelectors(json.light, acceptSelector.bind(undefined, 'light'));
        }
        if (json.highContrast) {
            this.collectSelectors(json.highContrast, acceptSelector.bind(undefined, 'hc'));
        }

        if (!this.icons.size) {
            return;
        }

        const fonts = json.fonts;
        if (Array.isArray(fonts)) {
            for (const font of fonts) {
                if (font) {
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
            const firstFont = fonts[0];
            if (firstFont && firstFont.id) {
                this.styleSheetContent += `.${this.fileIcon}::before, .${this.folderIcon}::before, .${this.rootFolderIcon}::before {
    font-family: '${firstFont.id}';
    font-size: ${firstFont.size || '150%'};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    vertical-align: top;
}
`;
            }
        }

        for (const definitionId of definitionSelectors.keys()) {
            const iconDefinition = iconDefinitions[definitionId];
            const selectors = definitionSelectors.get(definitionId);
            if (selectors && iconDefinition) {
                const cssUrl = PluginIconParsingUtils.toCSSUrl(iconDefinition.iconPath, this.locationUri, this.packageRootUri, this.pluginId);
                if (cssUrl) {
                    this.styleSheetContent += `${selectors.join(', ')} {
    content: ' ';
    background-image: ${cssUrl};
    background-size: 16px;
    background-position: left center;
    background-repeat: no-repeat;
}
`;
                }
                if (iconDefinition.fontCharacter || iconDefinition.fontColor) {
                    let body = '';
                    if (iconDefinition.fontColor) {
                        body += ` color: ${iconDefinition.fontColor};`;
                    }
                    if (iconDefinition.fontCharacter) {
                        body += ` content: '${iconDefinition.fontCharacter}';`;
                    }
                    if (iconDefinition.fontSize) {
                        body += ` font-size: ${iconDefinition.fontSize};`;
                    }
                    if (iconDefinition.fontId) {
                        body += ` font-family: ${iconDefinition.fontId};`;
                    }
                    this.styleSheetContent += `${selectors.join(', ')} {${body} }\n`;
                }
            }
        }
    }

    protected escapeCSS(value: string): string {
        value = value.replace(/[^\-a-zA-Z0-9]/g, '-');
        if (value.charAt(0).match(/[0-9\-]/)) {
            value = '-' + value;
        }
        return value;
    }

    protected readonly fileIcon = 'theia-plugin-file-icon';
    protected readonly folderIcon = 'theia-plugin-folder-icon';
    protected readonly folderExpandedIcon = 'theia-plugin-folder-expanded-icon';
    protected readonly rootFolderIcon = 'theia-plugin-root-folder-icon';
    protected readonly rootFolderExpandedIcon = 'theia-plugin-root-folder-expanded-icon';
    protected folderNameIcon(folderName: string): string {
        return 'theia-plugin-' + this.escapeCSS(folderName.toLowerCase()) + '-folder-name-icon';
    }
    protected expandedFolderNameIcon(folderName: string): string {
        return 'theia-plugin-' + this.escapeCSS(folderName.toLowerCase()) + '-expanded-folder-name-icon';
    }
    protected fileNameIcon(fileName: string): string[] {
        fileName = fileName.toLowerCase();
        const extIndex = fileName.indexOf('.');
        const icons = extIndex !== -1 ? this.fileExtensionIcon(fileName.substr(extIndex + 1)) : [];
        icons.unshift('theia-plugin-' + this.escapeCSS(fileName) + '-file-name-icon');
        return icons;
    }
    protected fileExtensionIcon(fileExtension: string): string[] {
        fileExtension = fileExtension.toString();
        const icons = [];
        const segments = fileExtension.split('.');
        if (segments.length) {
            if (segments.length) {
                for (let i = 0; i < segments.length; i++) {
                    icons.push('theia-plugin-' + this.escapeCSS(segments.slice(i).join('.')) + '-ext-file-icon');
                }
                icons.push('theia-plugin-ext-file-icon'); // extra segment to increase file-ext score
            }
        }
        return icons;
    }
    protected languageIcon(languageId: string): string {
        return 'theia-plugin-' + this.escapeCSS(languageId) + '-lang-file-icon';
    }

    protected collectSelectors(
        associations: RecursivePartial<PluginIconsAssociation>,
        accept: (definitionId: string, ...icons: string[]) => void
    ): void {
        if (associations.folder) {
            accept(associations.folder, this.folderIcon);
            this.hasFolderIcons = true;
        }
        if (associations.folderExpanded) {
            accept(associations.folderExpanded, this.folderExpandedIcon);
            this.hasFolderIcons = true;
        }
        const rootFolder = associations.rootFolder || associations.folder;
        if (rootFolder) {
            accept(rootFolder, this.rootFolderIcon);
            this.hasFolderIcons = true;
        }
        const rootFolderExpanded = associations.rootFolderExpanded || associations.folderExpanded;
        if (rootFolderExpanded) {
            accept(rootFolderExpanded, this.rootFolderExpandedIcon);
            this.hasFolderIcons = true;
        }
        if (associations.file) {
            accept(associations.file, this.fileIcon);
            this.hasFileIcons = true;
        }
        const folderNames = associations.folderNames;
        if (folderNames) {
            // eslint-disable-next-line guard-for-in
            for (const folderName in folderNames) {
                accept(folderNames[folderName]!, this.folderNameIcon(folderName), this.folderIcon);
                this.hasFolderIcons = true;
            }
        }
        const folderNamesExpanded = associations.folderNamesExpanded;
        if (folderNamesExpanded) {
            // eslint-disable-next-line guard-for-in
            for (const folderName in folderNamesExpanded) {
                accept(folderNamesExpanded[folderName]!, this.expandedFolderNameIcon(folderName), this.folderExpandedIcon);
                this.hasFolderIcons = true;
            }
        }
        const languageIds = associations.languageIds;
        if (languageIds) {
            if (!languageIds.jsonc && languageIds.json) {
                languageIds.jsonc = languageIds.json;
            }
            // eslint-disable-next-line guard-for-in
            for (const languageId in languageIds) {
                accept(languageIds[languageId]!, this.languageIcon(languageId), this.fileIcon);
                this.hasFileIcons = true;
            }
        }
        const fileExtensions = associations.fileExtensions;
        if (fileExtensions) {
            // eslint-disable-next-line guard-for-in
            for (const fileExtension in fileExtensions) {
                accept(fileExtensions[fileExtension]!, ...this.fileExtensionIcon(fileExtension), this.fileIcon);
                this.hasFileIcons = true;
            }
        }
        const fileNames = associations.fileNames;
        if (fileNames) {
            // eslint-disable-next-line guard-for-in
            for (const fileName in fileNames) {
                accept(fileNames[fileName]!, ...this.fileNameIcon(fileName), this.fileIcon);
                this.hasFileIcons = true;
            }
        }
    }

    /**
     * This should be aligned with
     * https://github.com/microsoft/vscode/blob/7cf4cca47aa025a590fc939af54932042302be63/src/vs/editor/common/services/getIconClasses.ts#L5
     */
    getIcon(element: URI | URIIconReference | FileStat | FileStatNode | WorkspaceRootNode): string {
        let icon = '';
        for (const className of this.getClassNames(element)) {
            if (this.icons.has(className)) {
                if (icon) {
                    icon += ' ';
                }
                icon += className;
            }
        }
        return icon;
    }

    protected getClassNames(element: URI | URIIconReference | FileStat | FileStatNode | WorkspaceRootNode): string[] {
        if (WorkspaceRootNode.is(element)) {
            const name = this.labelProvider.getName(element);
            if (element.expanded) {
                return [this.rootFolderExpandedIcon, this.expandedFolderNameIcon(name)];
            }
            return [this.rootFolderIcon, this.folderNameIcon(name)];
        }
        if (DirNode.is(element)) {
            if (element.expanded) {
                const name = this.labelProvider.getName(element);
                return [this.folderExpandedIcon, this.expandedFolderNameIcon(name)];
            }
            return this.getFolderClassNames(element);
        }
        if (FileStatNode.is(element)) {
            return this.getFileClassNames(element, element.fileStat.resource.toString());
        }
        if (FileStat.is(element)) {
            if (element.isDirectory) {
                return this.getFolderClassNames(element);
            }
            return this.getFileClassNames(element, element.resource.toString());
        }
        if (URIIconReference.is(element)) {
            if (element.id === 'folder') {
                return this.getFolderClassNames(element);
            }
            return this.getFileClassNames(element, element.uri && element.uri.toString());
        }
        return this.getFileClassNames(element, element.toString());
    }

    protected getFolderClassNames(element: object): string[] {
        const name = this.labelProvider.getName(element);
        return [this.folderIcon, this.folderNameIcon(name)];
    }

    protected getFileClassNames(element: object, uri?: string): string[] {
        const name = this.labelProvider.getName(element);
        const classNames = this.fileNameIcon(name);
        if (uri) {
            const language = monaco.services.StaticServices.modeService.get().createByFilepathOrFirstLine(monaco.Uri.parse(uri));
            classNames.push(this.languageIcon(language.languageIdentifier.language));
            classNames.unshift(this.fileIcon);
        }
        return classNames;
    }

}

@injectable()
export class PluginIconThemeService implements LabelProviderContribution {

    @inject(IconThemeService)
    protected readonly iconThemeService: IconThemeService;

    @inject(PluginIconThemeFactory)
    protected readonly iconThemeFactory: PluginIconThemeFactory;

    protected readonly onDidChangeEmitter = new Emitter<DidChangeLabelEvent>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    protected fireDidChange(): void {
        this.onDidChangeEmitter.fire({ affects: () => true });
    }

    register(contribution: IconThemeContribution, plugin: DeployedPlugin): Disposable {
        const pluginId = getPluginId(plugin.metadata.model);
        const packageUri = plugin.metadata.model.packageUri;
        const iconTheme = this.iconThemeFactory({
            id: contribution.id,
            label: contribution.label || new URI(contribution.uri).path.base,
            description: contribution.description,
            uri: contribution.uri,
            uiTheme: contribution.uiTheme,
            pluginId,
            packageUri
        });
        return new DisposableCollection(
            iconTheme,
            iconTheme.onDidChange(() => this.fireDidChange()),
            this.iconThemeService.register(iconTheme)
        );
    }

    canHandle(element: object): number {
        const current = this.iconThemeService.getDefinition(this.iconThemeService.current);
        if (current instanceof PluginIconTheme && (
            (element instanceof URI && element.scheme === 'file') || URIIconReference.is(element) || FileStat.is(element) || FileStatNode.is(element)
        )) {
            return Number.MAX_SAFE_INTEGER;
        }
        return 0;
    }

    getIcon(element: URI | URIIconReference | FileStat | FileStatNode | WorkspaceRootNode): string | undefined {
        const current = this.iconThemeService.getDefinition(this.iconThemeService.current);
        if (current instanceof PluginIconTheme) {
            return current.getIcon(element);
        }
        return undefined;
    }

}

export namespace PluginIconParsingUtils {
    export const toCSSUrl = (iconPath: string | undefined, locationUri: URI, packageRootUri: URI, pluginId: string): string | undefined => {
        if (!iconPath) {
            return undefined;
        }
        const iconUri = locationUri.resolve(iconPath);
        const relativePath = packageRootUri.path.relative(iconUri.path.normalize());
        return relativePath && `url('${new Endpoint({
            path: `hostedPlugin/${pluginId}/${encodeURIComponent(relativePath.normalize().toString())}`
        }).getRestUrl().toString()}')`;
    };
}
