/********************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
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

// Method `$changeLanguage` copied and modified
// from https://github.com/microsoft/vscode/blob/e9c50663154c369a06355ce752b447af5b580dc3/src/vs/workbench/api/browser/mainThreadLanguages.ts#L30-L42

import {
    LanguagesMain,
    SerializedLanguageConfiguration,
    SerializedRegExp,
    SerializedIndentationRule,
    SerializedOnEnterRule,
    MAIN_RPC_CONTEXT,
    LanguagesExt,
    WorkspaceEditDto,
    ResourceTextEditDto,
    PluginInfo,
    PLUGIN_RPC_CONTEXT
} from '../../common/plugin-api-rpc';
import { injectable, inject, postConstruct } from 'inversify';
import {
    SerializedDocumentFilter, MarkerData, Range, WorkspaceSymbolProvider, RelatedInformation,
    MarkerSeverity, DocumentLink, WorkspaceSymbolParams, CodeAction
} from '../../common/plugin-api-rpc-model';
import { RPCProtocol, ProxyIdentifier } from '../../common/rpc-protocol';
import { fromLanguageSelector } from '../../plugin/type-converters';
import { DocumentFilter, MonacoModelIdentifier, testGlob } from 'monaco-languageclient/lib';
import { MonacoLanguages } from '@theia/monaco/lib/browser/monaco-languages';
import CoreURI from '@theia/core/lib/common/uri';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { Emitter } from '@theia/core/lib/common/event';
import { ProblemManager } from '@theia/markers/lib/browser';
import * as vst from 'vscode-languageserver-types';
import * as theia from '@theia/plugin';
import { UriComponents } from '../../common/uri-components';
import { CancellationToken } from '@theia/core/lib/common';
import { LanguageSelector } from '@theia/languages/lib/common/language-selector';
import { CallHierarchyService, CallHierarchyServiceProvider, Caller, Definition } from '@theia/callhierarchy/lib/browser';
import { toDefinition, toUriComponents, fromDefinition, fromPosition, toCaller } from './callhierarchy/callhierarchy-type-converters';
import { Position, DocumentUri } from 'vscode-languageserver-types';
import { RPCProtocolServiceProvider } from './main-context';

@injectable()
export class LanguagesMainImpl implements LanguagesMain, Disposable, RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any> = PLUGIN_RPC_CONTEXT.LANGUAGES_MAIN;

    @inject(MonacoLanguages)
    private readonly monacoLanguages: MonacoLanguages;

    @inject(ProblemManager)
    private readonly problemManager: ProblemManager;

    @inject(CallHierarchyServiceProvider)
    private readonly callHierarchyServiceContributionRegistry: CallHierarchyServiceProvider;

    @inject(RPCProtocol)
    private readonly rpc: RPCProtocol;

    private proxy: LanguagesExt;
    private readonly services = new Map<number, Disposable>();
    private readonly toDispose = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        this.proxy = this.rpc.getProxy(MAIN_RPC_CONTEXT.LANGUAGES_EXT);
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    $getLanguages(): Promise<string[]> {
        return Promise.resolve(monaco.languages.getLanguages().map(l => l.id));
    }

    $changeLanguage(resource: UriComponents, languageId: string): Promise<void> {
        const uri = monaco.Uri.revive(resource);
        const model = monaco.editor.getModel(uri);
        if (!model) {
            return Promise.reject(new Error('Invalid uri'));
        }
        const langId = monaco.languages.getEncodedLanguageId(languageId);
        if (!langId) {
            return Promise.reject(new Error(`Unknown language ID: ${languageId}`));
        }
        monaco.editor.setModelLanguage(model, languageId);
        return Promise.resolve(undefined);
    }

    protected register(handle: number, service: Disposable): void {
        this.services.set(handle, service);
        this.toDispose.push(Disposable.create(() => this.$unregister(handle)));
    }

    $unregister(handle: number): void {
        const disposable = this.services.get(handle);
        if (disposable) {
            this.services.delete(handle);
            disposable.dispose();
        }
    }

    $setLanguageConfiguration(handle: number, languageId: string, configuration: SerializedLanguageConfiguration): void {
        const config: monaco.languages.LanguageConfiguration = {
            comments: configuration.comments,
            brackets: configuration.brackets,
            wordPattern: reviveRegExp(configuration.wordPattern),
            indentationRules: reviveIndentationRule(configuration.indentationRules),
            onEnterRules: reviveOnEnterRules(configuration.onEnterRules),
        };

        this.register(handle, monaco.languages.setLanguageConfiguration(languageId, config));
    }

    $registerCompletionSupport(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[], triggerCharacters: string[], supportsResolveDetails: boolean): void {
        this.register(handle, monaco.modes.CompletionProviderRegistry.register(fromLanguageSelector(selector), {
            triggerCharacters,
            provideCompletionItems: (model, position, context, token) => this.provideCompletionItems(handle, model, position, context, token),
            resolveCompletionItem: supportsResolveDetails
                ? (model, position, suggestion, token) => Promise.resolve(this.resolveCompletionItem(handle, model, position, suggestion, token))
                : undefined
        }));
    }

    protected provideCompletionItems(handle: number, model: monaco.editor.ITextModel, position: monaco.Position,
        context: monaco.languages.CompletionContext, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.CompletionList> {
        return this.proxy.$provideCompletionItems(handle, model.uri, position, context, token).then(result => {
            if (!result) {
                return undefined;
            }
            return {
                suggestions: result.completions,
                incomplete: result.incomplete,
                dispose: () => this.proxy.$releaseCompletionItems(handle, result.id)
            };
        });
    }

    protected resolveCompletionItem(handle: number, model: monaco.editor.ITextModel, position: monaco.Position,
        item: monaco.languages.CompletionItem, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.CompletionItem> {
        return this.proxy.$resolveCompletionItem(handle, model.uri, position, item, token);
    }

    $registerDefinitionProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const definitionProvider = this.createDefinitionProvider(handle);
        this.register(handle, monaco.languages.registerDefinitionProvider(languageSelector, definitionProvider));
    }

    $registerDeclarationProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const declarationProvider = this.createDeclarationProvider(handle);
        this.register(handle, monaco.languages.registerDeclarationProvider(languageSelector, declarationProvider));
    }

    $registerReferenceProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const referenceProvider = this.createReferenceProvider(handle);
        this.register(handle, monaco.languages.registerReferenceProvider(languageSelector, referenceProvider));
    }

    protected createReferenceProvider(handle: number): monaco.languages.ReferenceProvider {
        return {
            provideReferences: (model, position, context, token) => this.provideReferences(handle, model, position, context, token)
        };
    }

    protected provideReferences(handle: number, model: monaco.editor.ITextModel, position: monaco.Position,
        context: monaco.languages.ReferenceContext, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.Location[]> {
        return this.proxy.$provideReferences(handle, model.uri, position, context, token).then(result => {
            if (!result) {
                return undefined;
            }

            if (Array.isArray(result)) {
                const references: monaco.languages.Location[] = [];
                for (const item of result) {
                    references.push({ ...item, uri: monaco.Uri.revive(item.uri) });
                }
                return references;
            }

            return undefined;
        });
    }

    $registerSignatureHelpProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[], metadata: theia.SignatureHelpProviderMetadata): void {
        const languageSelector = fromLanguageSelector(selector);
        const signatureHelpProvider = this.createSignatureHelpProvider(handle, metadata);
        this.register(handle, monaco.languages.registerSignatureHelpProvider(languageSelector, signatureHelpProvider));
    }

    $clearDiagnostics(id: string): void {
        for (const uri of this.problemManager.getUris()) {
            this.problemManager.setMarkers(new CoreURI(uri), id, []);
        }
    }

    $changeDiagnostics(id: string, delta: [string, MarkerData[]][]): void {
        for (const [uriString, markers] of delta) {
            const uri = new CoreURI(uriString);
            this.problemManager.setMarkers(uri, id, markers.map(reviveMarker));
        }
    }

    $registerImplementationProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const implementationProvider = this.createImplementationProvider(handle);
        this.register(handle, monaco.languages.registerImplementationProvider(languageSelector, implementationProvider));
    }

    protected createImplementationProvider(handle: number): monaco.languages.ImplementationProvider {
        return {
            provideImplementation: (model, position, token) => this.provideImplementation(handle, model, position, token)
        };
    }

    protected provideImplementation(handle: number, model: monaco.editor.ITextModel,
        position: monaco.Position, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.Definition> {
        return this.proxy.$provideImplementation(handle, model.uri, position, token).then(result => {
            if (!result) {
                return undefined;
            }

            if (Array.isArray(result)) {
                // using DefinitionLink because Location is mandatory part of DefinitionLink
                const definitionLinks: monaco.languages.LocationLink[] = [];
                for (const item of result) {
                    definitionLinks.push({ ...item, uri: monaco.Uri.revive(item.uri) });
                }
                return definitionLinks;
            } else {
                // single Location
                return <monaco.languages.Location>{
                    uri: monaco.Uri.revive(result.uri),
                    range: result.range
                };
            }
        });
    }

    $registerTypeDefinitionProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const typeDefinitionProvider = this.createTypeDefinitionProvider(handle);
        this.register(handle, monaco.languages.registerTypeDefinitionProvider(languageSelector, typeDefinitionProvider));
    }

    protected createTypeDefinitionProvider(handle: number): monaco.languages.TypeDefinitionProvider {
        return {
            provideTypeDefinition: (model, position, token) => this.provideTypeDefinition(handle, model, position, token)
        };
    }

    protected provideTypeDefinition(handle: number, model: monaco.editor.ITextModel,
        position: monaco.Position, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.Definition> {
        return this.proxy.$provideTypeDefinition(handle, model.uri, position, token).then(result => {
            if (!result) {
                return undefined;
            }

            if (Array.isArray(result)) {
                // using DefinitionLink because Location is mandatory part of DefinitionLink
                const definitionLinks: monaco.languages.LocationLink[] = [];
                for (const item of result) {
                    definitionLinks.push({ ...item, uri: monaco.Uri.revive(item.uri) });
                }
                return definitionLinks;
            } else {
                // single Location
                return <monaco.languages.Location>{
                    uri: monaco.Uri.revive(result.uri),
                    range: result.range
                };
            }
        });
    }

    $registerHoverProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const hoverProvider = this.createHoverProvider(handle);
        this.register(handle, monaco.languages.registerHoverProvider(languageSelector, hoverProvider));
    }

    protected createHoverProvider(handle: number): monaco.languages.HoverProvider {
        return {
            provideHover: (model, position, token) => this.provideHover(handle, model, position, token)
        };
    }

    protected provideHover(handle: number, model: monaco.editor.ITextModel, position: monaco.Position,
        token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.Hover> {
        return this.proxy.$provideHover(handle, model.uri, position, token);
    }

    $registerDocumentHighlightProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const documentHighlightProvider = this.createDocumentHighlightProvider(handle);
        this.register(handle, monaco.languages.registerDocumentHighlightProvider(languageSelector, documentHighlightProvider));
    }

    protected createDocumentHighlightProvider(handle: number): monaco.languages.DocumentHighlightProvider {
        return {
            provideDocumentHighlights: (model, position, token) => this.provideDocumentHighlights(handle, model, position, token)
        };
    }

    protected provideDocumentHighlights(handle: number, model: monaco.editor.ITextModel, position: monaco.Position,
        token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.DocumentHighlight[]> {
        return this.proxy.$provideDocumentHighlights(handle, model.uri, position, token).then(result => {
            if (!result) {
                return undefined;
            }

            if (Array.isArray(result)) {
                const highlights: monaco.languages.DocumentHighlight[] = [];
                for (const item of result) {
                    highlights.push(
                        {
                            ...item,
                            kind: (item.kind ? item.kind : monaco.languages.DocumentHighlightKind.Text)
                        });
                }
                return highlights;
            }

            return undefined;
        });
    }

    $registerWorkspaceSymbolProvider(handle: number, pluginInfo: PluginInfo): void {
        const workspaceSymbolProvider = this.createWorkspaceSymbolProvider(handle);
        this.register(handle, this.monacoLanguages.registerWorkspaceSymbolProvider(workspaceSymbolProvider));
    }

    protected createWorkspaceSymbolProvider(handle: number): WorkspaceSymbolProvider {
        return {
            provideWorkspaceSymbols: (params, token) => this.provideWorkspaceSymbols(handle, params, token),
            resolveWorkspaceSymbol: (symbol, token) => this.resolveWorkspaceSymbol(handle, symbol, token)
        };
    }

    protected provideWorkspaceSymbols(handle: number, params: WorkspaceSymbolParams, token: monaco.CancellationToken): Thenable<vst.SymbolInformation[]> {
        return this.proxy.$provideWorkspaceSymbols(handle, params.query, token);
    }

    protected resolveWorkspaceSymbol(handle: number, symbol: vst.SymbolInformation, token: monaco.CancellationToken): Thenable<vst.SymbolInformation> {
        return this.proxy.$resolveWorkspaceSymbol(handle, symbol, token);
    }

    $registerDocumentLinkProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const linkProvider = this.createLinkProvider(handle);
        this.register(handle, monaco.languages.registerLinkProvider(languageSelector, linkProvider));
    }

    protected createLinkProvider(handle: number): monaco.languages.LinkProvider {
        return {
            provideLinks: async (model, token) => this.provideLinks(handle, model, token),
            resolveLink: async (link, token) => this.resolveLink(handle, link, token)
        };
    }

    protected async provideLinks(handle: number, model: monaco.editor.ITextModel,
        token: monaco.CancellationToken): Promise<monaco.languages.ProviderResult<monaco.languages.ILinksList>> {
        const links = await this.proxy.$provideDocumentLinks(handle, model.uri, token);
        if (!links) {
            return undefined;
        }
        return {
            links: links.map(link => this.toMonacoLink(link)),
            dispose: () => {
                // TODO this.proxy.$releaseDocumentLinks(handle, links.cacheId);
            }
        };
    }

    protected async resolveLink(handle: number, link: monaco.languages.ILink,
        token: monaco.CancellationToken): Promise<monaco.languages.ProviderResult<monaco.languages.ILink>> {
        const resolved = await this.proxy.$resolveDocumentLink(handle, link, token);
        return resolved && this.toMonacoLink(resolved);
    }

    protected toMonacoLink(link: DocumentLink): monaco.languages.ILink {
        return {
            ...link,
            url: !!link.url && typeof link.url !== 'string' ? monaco.Uri.revive(link.url) : link.url
        };
    }

    $registerCodeLensSupport(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[], eventHandle: number): void {
        const languageSelector = fromLanguageSelector(selector);
        const lensProvider = this.createCodeLensProvider(handle);

        if (typeof eventHandle === 'number') {
            const emitter = new Emitter<monaco.languages.CodeLensProvider>();
            this.register(eventHandle, emitter);
            lensProvider.onDidChange = emitter.event;
        }

        this.register(handle, monaco.languages.registerCodeLensProvider(languageSelector, lensProvider));
    }

    protected createCodeLensProvider(handle: number): monaco.languages.CodeLensProvider {
        return {
            provideCodeLenses: async (model, token) => this.provideCodeLenses(handle, model, token),
            resolveCodeLens: (model, codeLens, token) => this.resolveCodeLens(handle, model, codeLens, token)
        };
    }

    protected async provideCodeLenses(handle: number, model: monaco.editor.ITextModel,
        token: monaco.CancellationToken): Promise<monaco.languages.ProviderResult<monaco.languages.CodeLensList>> {
        const lenses = await this.proxy.$provideCodeLenses(handle, model.uri, token);
        if (!lenses) {
            return undefined;
        }
        return {
            lenses,
            dispose: () => {
                // TODO this.proxy.$releaseCodeLenses
            }
        };
    }

    protected resolveCodeLens(handle: number, model: monaco.editor.ITextModel,
        codeLens: monaco.languages.CodeLens, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.CodeLens> {
        return this.proxy.$resolveCodeLens(handle, model.uri, codeLens, token);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $emitCodeLensEvent(eventHandle: number, event?: any): void {
        const obj = this.services.get(eventHandle);
        if (obj instanceof Emitter) {
            obj.fire(event);
        }
    }

    $registerOutlineSupport(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const symbolProvider = this.createDocumentSymbolProvider(handle);
        this.register(handle, monaco.modes.DocumentSymbolProviderRegistry.register(languageSelector, symbolProvider));
    }

    protected createDocumentSymbolProvider(handle: number): monaco.languages.DocumentSymbolProvider {
        return {
            provideDocumentSymbols: (model, token) => this.provideDocumentSymbols(handle, model, token)
        };
    }

    protected provideDocumentSymbols(handle: number, model: monaco.editor.ITextModel,
        token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.DocumentSymbol[]> {
        return this.proxy.$provideDocumentSymbols(handle, model.uri, token);
    }

    protected createDefinitionProvider(handle: number): monaco.languages.DefinitionProvider {
        return {
            provideDefinition: (model, position, token) => this.provideDefinition(handle, model, position, token)
        };
    }

    protected createDeclarationProvider(handle: number): monaco.languages.DeclarationProvider {
        return {
            provideDeclaration: (model, position, token) => this.provideDeclaration(handle, model, position, token)
        };
    }

    protected provideDeclaration(handle: number, model: monaco.editor.ITextModel, position: monaco.Position,
        token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.Definition> {
        return this.proxy.$provideDeclaration(handle, model.uri, position, token).then(result => {
            if (!result) {
                return undefined;
            }

            if (Array.isArray(result)) {
                // using DefinitionLink because Location is mandatory part of DefinitionLink
                const definitionLinks: monaco.languages.LocationLink[] = [];
                for (const item of result) {
                    definitionLinks.push({ ...item, uri: monaco.Uri.revive(item.uri) });
                }
                return definitionLinks;
            } else {
                // single Location
                return <monaco.languages.Location>{
                    uri: monaco.Uri.revive(result.uri),
                    range: result.range
                };
            }
        });
    }

    protected provideDefinition(handle: number, model: monaco.editor.ITextModel,
        position: monaco.Position, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.Definition> {
        return this.proxy.$provideDefinition(handle, model.uri, position, token).then(result => {
            if (!result) {
                return undefined;
            }

            if (Array.isArray(result)) {
                // using DefinitionLink because Location is mandatory part of DefinitionLink
                const definitionLinks: monaco.languages.LocationLink[] = [];
                for (const item of result) {
                    definitionLinks.push({ ...item, uri: monaco.Uri.revive(item.uri) });
                }
                return definitionLinks;
            } else {
                // single Location
                return <monaco.languages.Location>{
                    uri: monaco.Uri.revive(result.uri),
                    range: result.range
                };
            }
        });
    }

    protected createSignatureHelpProvider(handle: number, metadata: theia.SignatureHelpProviderMetadata): monaco.languages.SignatureHelpProvider {
        return {
            signatureHelpTriggerCharacters: metadata.triggerCharacters,
            signatureHelpRetriggerCharacters: metadata.retriggerCharacters,
            provideSignatureHelp: async (model, position, token, context) => this.provideSignatureHelp(handle, model, position, token, context)
        };
    }

    protected async provideSignatureHelp(handle: number, model: monaco.editor.ITextModel,
        position: monaco.Position, token: monaco.CancellationToken,
        context: monaco.languages.SignatureHelpContext): Promise<monaco.languages.ProviderResult<monaco.languages.SignatureHelpResult>> {
        const value = await this.proxy.$provideSignatureHelp(handle, model.uri, position, context, token);
        if (!value) {
            return undefined;
        }
        return {
            value,
            dispose: () => {
                if (typeof value.id === 'number') {
                    this.proxy.$releaseSignatureHelp(handle, value.id);
                }
            }
        };
    }

    $registerDocumentFormattingSupport(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const documentFormattingEditSupport = this.createDocumentFormattingSupport(handle);
        this.register(handle, monaco.languages.registerDocumentFormattingEditProvider(languageSelector, documentFormattingEditSupport));
    }

    createDocumentFormattingSupport(handle: number): monaco.languages.DocumentFormattingEditProvider {
        return {
            provideDocumentFormattingEdits: (model, options, token) => this.provideDocumentFormattingEdits(handle, model, options, token)
        };
    }

    protected provideDocumentFormattingEdits(handle: number, model: monaco.editor.ITextModel,
        options: monaco.languages.FormattingOptions, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.TextEdit[]> {
        return this.proxy.$provideDocumentFormattingEdits(handle, model.uri, options, token);
    }

    $registerRangeFormattingProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const rangeFormattingEditProvider = this.createRangeFormattingProvider(handle);
        this.register(handle, monaco.languages.registerDocumentRangeFormattingEditProvider(languageSelector, rangeFormattingEditProvider));
    }

    createRangeFormattingProvider(handle: number): monaco.languages.DocumentRangeFormattingEditProvider {
        return {
            provideDocumentRangeFormattingEdits: (model, range: Range, options, token) => this.provideDocumentRangeFormattingEdits(handle, model, range, options, token)
        };
    }

    protected provideDocumentRangeFormattingEdits(handle: number, model: monaco.editor.ITextModel,
        range: Range, options: monaco.languages.FormattingOptions, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.TextEdit[]> {
        return this.proxy.$provideDocumentRangeFormattingEdits(handle, model.uri, range, options, token);
    }

    $registerOnTypeFormattingProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[], autoFormatTriggerCharacters: string[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const onTypeFormattingProvider = this.createOnTypeFormattingProvider(handle, autoFormatTriggerCharacters);
        this.register(handle, monaco.languages.registerOnTypeFormattingEditProvider(languageSelector, onTypeFormattingProvider));
    }

    protected createOnTypeFormattingProvider(
        handle: number,
        autoFormatTriggerCharacters: string[]
    ): monaco.languages.OnTypeFormattingEditProvider {
        return {
            autoFormatTriggerCharacters,
            provideOnTypeFormattingEdits: (model, position, ch, options, token) => this.provideOnTypeFormattingEdits(handle, model, position, ch, options, token)
        };
    }

    protected provideOnTypeFormattingEdits(handle: number, model: monaco.editor.ITextModel, position: monaco.Position,
        ch: string, options: monaco.languages.FormattingOptions, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.TextEdit[]> {
        return this.proxy.$provideOnTypeFormattingEdits(handle, model.uri, position, ch, options, token);
    }

    $registerFoldingRangeProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const provider = this.createFoldingRangeProvider(handle);
        this.register(handle, monaco.languages.registerFoldingRangeProvider(languageSelector, provider));
    }

    createFoldingRangeProvider(handle: number): monaco.languages.FoldingRangeProvider {
        return {
            provideFoldingRanges: (model, context, token) => this.provideFoldingRanges(handle, model, context, token)
        };
    }

    protected provideFoldingRanges(handle: number, model: monaco.editor.ITextModel,
        context: monaco.languages.FoldingContext, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.FoldingRange[]> {
        return this.proxy.$provideFoldingRange(handle, model.uri, context, token);
    }

    $registerDocumentColorProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const colorProvider = this.createColorProvider(handle);
        this.register(handle, monaco.languages.registerColorProvider(languageSelector, colorProvider));
    }

    createColorProvider(handle: number): monaco.languages.DocumentColorProvider {
        return {
            provideDocumentColors: (model, token) => this.provideDocumentColors(handle, model, token),
            provideColorPresentations: (model, colorInfo, token) => this.provideColorPresentations(handle, model, colorInfo, token)
        };
    }

    protected provideDocumentColors(handle: number, model: monaco.editor.ITextModel,
        token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.IColorInformation[]> {
        return this.proxy.$provideDocumentColors(handle, model.uri, token).then(documentColors =>
            documentColors.map(documentColor => {
                const [red, green, blue, alpha] = documentColor.color;
                const color = {
                    red: red,
                    green: green,
                    blue: blue,
                    alpha: alpha
                };

                return {
                    color,
                    range: documentColor.range
                };
            })
        );
    }

    protected provideColorPresentations(handle: number, model: monaco.editor.ITextModel,
        colorInfo: monaco.languages.IColorInformation, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.IColorPresentation[]> {
        return this.proxy.$provideColorPresentations(handle, model.uri, {
            color: [
                colorInfo.color.red,
                colorInfo.color.green,
                colorInfo.color.blue,
                colorInfo.color.alpha
            ],
            range: colorInfo.range
        }, token);
    }

    $registerQuickFixProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[], providedCodeActionKinds?: string[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const quickFixProvider = {
            provideCodeActions: (model: monaco.editor.ITextModel, range: monaco.Range,
                context: monaco.languages.CodeActionContext, token: monaco.CancellationToken): monaco.languages.CodeActionList | Promise<monaco.languages.CodeActionList> => {
                const markers = monaco.services.StaticServices.markerService.get().read({ resource: model.uri }).filter(m => monaco.Range.areIntersectingOrTouching(m, range));
                return this.provideCodeActions(handle, model, range, { markers, only: context.only }, token);
            },
            providedCodeActionKinds
        };
        this.register(handle, monaco.modes.CodeActionProviderRegistry.register(languageSelector, quickFixProvider));
    }

    protected async provideCodeActions(handle: number, model: monaco.editor.ITextModel,
        rangeOrSelection: Range, context: monaco.languages.CodeActionContext,
        token: monaco.CancellationToken): Promise<monaco.languages.CodeActionList | monaco.languages.CodeActionList> {
        const actions = await this.proxy.$provideCodeActions(handle, model.uri, rangeOrSelection, {
            ...context
        }, token);
        if (!actions) {
            return undefined!;
        }
        return {
            actions: actions.map(a => toMonacoAction(a)),
            dispose: () => {
                // TODO this.proxy.$releaseCodeActions(handle, cacheId);
            }
        };
    }

    $registerRenameProvider(handle: number, pluginInfo: PluginInfo, selector: SerializedDocumentFilter[], supportsResolveLocation: boolean): void {
        const languageSelector = fromLanguageSelector(selector);
        const renameProvider = this.createRenameProvider(handle, supportsResolveLocation);
        this.register(handle, monaco.languages.registerRenameProvider(languageSelector, renameProvider));
    }

    protected createRenameProvider(handle: number, supportsResolveLocation: boolean): monaco.languages.RenameProvider {
        return {
            provideRenameEdits: (model, position, newName, token) => this.provideRenameEdits(handle, model, position, newName, token)
            ,
            resolveRenameLocation: supportsResolveLocation
                ? (model, position, token) =>
                    this.resolveRenameLocation(handle, model, position, token)
                : undefined
        };
    }

    protected provideRenameEdits(handle: number, model: monaco.editor.ITextModel,
        position: monaco.Position, newName: string, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.WorkspaceEdit & monaco.languages.Rejection> {
        return this.proxy.$provideRenameEdits(handle, model.uri, position, newName, token).then(toMonacoWorkspaceEdit);
    }

    $registerCallHierarchyProvider(handle: number, selector: SerializedDocumentFilter[]): void {
        const languageSelector = fromLanguageSelector(selector);
        const callHierarchyService = this.createCallHierarchyService(handle, languageSelector);
        this.register(handle, this.callHierarchyServiceContributionRegistry.add(callHierarchyService));
    }

    protected createCallHierarchyService(handle: number, language: LanguageSelector): CallHierarchyService {
        return {
            selector: language,
            getRootDefinition: (uri: DocumentUri, position: Position, cancellationToken: CancellationToken) =>
                this.proxy.$provideRootDefinition(handle, toUriComponents(uri), fromPosition(position), cancellationToken)
                    .then(def => toDefinition(def)),
            getCallers: (definition: Definition, cancellationToken: CancellationToken) => this.proxy.$provideCallers(handle, fromDefinition(definition), cancellationToken)
                .then(result => {
                    if (!result) {
                        return undefined!;
                    }

                    if (Array.isArray(result)) {
                        const callers: Caller[] = [];
                        for (const item of result) {
                            callers.push(toCaller(item));
                        }
                        return callers;
                    }

                    return undefined!;
                })
        };
    }

    protected matchModel(selector: LanguageSelector | undefined, model: MonacoModelIdentifier): boolean {
        if (Array.isArray(selector)) {
            return selector.some(filter => this.matchModel(filter, model));
        }
        if (DocumentFilter.is(selector)) {
            if (!!selector.language && selector.language !== model.languageId) {
                return false;
            }
            if (!!selector.scheme && selector.scheme !== model.uri.scheme) {
                return false;
            }
            if (!!selector.pattern && !testGlob(selector.pattern, model.uri.path)) {
                return false;
            }
            return true;
        }
        return selector === model.languageId;
    }

    protected resolveRenameLocation(handle: number, model: monaco.editor.ITextModel,
        position: monaco.Position, token: monaco.CancellationToken): monaco.languages.ProviderResult<monaco.languages.RenameLocation> {
        return this.proxy.$resolveRenameLocation(handle, model.uri, position, token);
    }

}

function reviveMarker(marker: MarkerData): vst.Diagnostic {
    const monacoMarker: vst.Diagnostic = {
        code: marker.code,
        severity: reviveSeverity(marker.severity),
        range: reviveRange(marker.startLineNumber, marker.startColumn, marker.endLineNumber, marker.endColumn),
        message: marker.message,
        source: marker.source,
        relatedInformation: undefined
    };

    if (marker.relatedInformation) {
        monacoMarker.relatedInformation = marker.relatedInformation.map(reviveRelated);
    }

    return monacoMarker;
}

function reviveSeverity(severity: MarkerSeverity): vst.DiagnosticSeverity {
    switch (severity) {
        case MarkerSeverity.Error: return vst.DiagnosticSeverity.Error;
        case MarkerSeverity.Warning: return vst.DiagnosticSeverity.Warning;
        case MarkerSeverity.Info: return vst.DiagnosticSeverity.Information;
        case MarkerSeverity.Hint: return vst.DiagnosticSeverity.Hint;
    }
}

function reviveRange(startLine: number, startColumn: number, endLine: number, endColumn: number): vst.Range {
    // note: language server range is 0-based, marker is 1-based, so need to deduct 1 here
    return {
        start: {
            line: startLine - 1,
            character: startColumn - 1
        },
        end: {
            line: endLine - 1,
            character: endColumn - 1
        }
    };
}

function reviveRelated(related: RelatedInformation): vst.DiagnosticRelatedInformation {
    return {
        message: related.message,
        location: {
            uri: related.resource,
            range: reviveRange(related.startLineNumber, related.startColumn, related.endLineNumber, related.endColumn)
        }
    };
}

function reviveRegExp(regExp?: SerializedRegExp): RegExp | undefined {
    if (typeof regExp === 'undefined' || regExp === null) {
        return undefined;
    }
    return new RegExp(regExp.pattern, regExp.flags);
}

function reviveIndentationRule(indentationRule?: SerializedIndentationRule): monaco.languages.IndentationRule | undefined {
    if (typeof indentationRule === 'undefined' || indentationRule === null) {
        return undefined;
    }
    return {
        increaseIndentPattern: reviveRegExp(indentationRule.increaseIndentPattern)!,
        decreaseIndentPattern: reviveRegExp(indentationRule.decreaseIndentPattern)!,
        indentNextLinePattern: reviveRegExp(indentationRule.indentNextLinePattern),
        unIndentedLinePattern: reviveRegExp(indentationRule.unIndentedLinePattern),
    };
}

function reviveOnEnterRule(onEnterRule: SerializedOnEnterRule): monaco.languages.OnEnterRule {
    return {
        beforeText: reviveRegExp(onEnterRule.beforeText)!,
        afterText: reviveRegExp(onEnterRule.afterText),
        action: onEnterRule.action
    };
}

function reviveOnEnterRules(onEnterRules?: SerializedOnEnterRule[]): monaco.languages.OnEnterRule[] | undefined {
    if (typeof onEnterRules === 'undefined' || onEnterRules === null) {
        return undefined;
    }
    return onEnterRules.map(reviveOnEnterRule);
}

function toMonacoAction(action: CodeAction): monaco.languages.CodeAction {
    return {
        ...action,
        diagnostics: action.diagnostics ? action.diagnostics.map(m => toMonacoMarkerData(m)) : undefined,
        edit: action.edit ? toMonacoWorkspaceEdit(action.edit) : undefined
    };
}

function toMonacoMarkerData(marker: MarkerData): monaco.editor.IMarkerData {
    return {
        ...marker,
        relatedInformation: marker.relatedInformation
            ? marker.relatedInformation.map(i => toMonacoRelatedInformation(i))
            : undefined
    };
}

function toMonacoRelatedInformation(relatedInfo: RelatedInformation): monaco.editor.IRelatedInformation {
    return {
        ...relatedInfo,
        resource: monaco.Uri.parse(relatedInfo.resource)
    };
}

export function toMonacoWorkspaceEdit(data: WorkspaceEditDto | undefined): monaco.languages.WorkspaceEdit {
    return {
        edits: (data && data.edits || []).map(edit => {
            if (ResourceTextEditDto.is(edit)) {
                return { resource: monaco.Uri.revive(edit.resource), edits: edit.edits };
            } else {
                return { newUri: monaco.Uri.revive(edit.newUri), oldUri: monaco.Uri.revive(edit.oldUri), options: edit.options };
            }
        })
    };
}

@injectable()
export class LanguagesMainServiceProvider implements RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    class: any;

    @inject(LanguagesMainImpl)
    private readonly languagesMainImpl: LanguagesMainImpl;

    @postConstruct()
    protected init(): void {
        this.identifier = PLUGIN_RPC_CONTEXT.LANGUAGES_MAIN;
        this.class = this.languagesMainImpl;
    }
}
