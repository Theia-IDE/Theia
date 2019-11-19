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
import DocumentSymbol = monaco.languages.DocumentSymbol;
import SymbolKind = monaco.languages.SymbolKind;
import { FrontendApplicationContribution, FrontendApplication, TreeNode } from '@theia/core/lib/browser';
import { Range, EditorManager, EditorOpenerOptions } from '@theia/editor/lib/browser';
import DocumentSymbolProviderRegistry = monaco.modes.DocumentSymbolProviderRegistry;
import CancellationTokenSource = monaco.CancellationTokenSource;
import CancellationToken = monaco.CancellationToken;
import { DisposableCollection, Disposable } from '@theia/core';
import { OutlineViewService } from '@theia/outline-view/lib/browser/outline-view-service';
import { OutlineSymbolInformationNode } from '@theia/outline-view/lib/browser/outline-view-widget';
import URI from '@theia/core/lib/common/uri';
import { MonacoEditor } from './monaco-editor';

import debounce = require('lodash.debounce');

@injectable()
export class MonacoOutlineContribution implements FrontendApplicationContribution {

    protected readonly toDisposeOnEditor = new DisposableCollection();
    protected roots: MonacoOutlineSymbolInformationNode[] | undefined;
    protected canUpdateOutline: boolean = true;

    @inject(OutlineViewService) protected readonly outlineViewService: OutlineViewService;
    @inject(EditorManager) protected readonly editorManager: EditorManager;

    onStart(app: FrontendApplication): void {

        // updateOutline and handleCurrentEditorChanged need to be called even when the outline view widget is closed
        // in order to udpate breadcrumbs.
        DocumentSymbolProviderRegistry.onDidChange(
            debounce(() => this.updateOutline())
        );
        this.editorManager.onCurrentEditorChanged(
            debounce(() => this.handleCurrentEditorChanged(), 50)
        );
        this.handleCurrentEditorChanged();

        this.outlineViewService.onDidSelect(async node => {
            if (MonacoOutlineSymbolInformationNode.is(node) && node.parent) {
                const options: EditorOpenerOptions = {
                    mode: 'reveal',
                    selection: node.range
                };
                await this.selectInEditor(node, options);
            }
        });
        this.outlineViewService.onDidOpen(async node => {
            if (MonacoOutlineSymbolInformationNode.is(node)) {
                const options: EditorOpenerOptions = {
                    selection: {
                        start: node.range.start
                    }
                };
                await this.selectInEditor(node, options);
            }
        });
    }

    protected async selectInEditor(node: MonacoOutlineSymbolInformationNode, options?: EditorOpenerOptions): Promise<void> {
        // Avoid cyclic updates: Outline -> Editor -> Outline.
        this.canUpdateOutline = false;
        try {
            await this.editorManager.open(node.uri, options);
        } finally {
            this.canUpdateOutline = true;
        }
    }

    protected handleCurrentEditorChanged(): void {
        this.toDisposeOnEditor.dispose();
        this.toDisposeOnEditor.push(Disposable.create(() => this.roots = undefined));
        const editor = this.editorManager.currentEditor;
        if (editor) {
            const model = MonacoEditor.get(editor)!.getControl().getModel();
            if (model) {
                this.toDisposeOnEditor.push(model.onDidChangeContent(() => {
                    this.roots = undefined; // Invalidate the previously resolved roots.
                    this.updateOutline();
                }));
            }
            this.toDisposeOnEditor.push(editor.editor.onSelectionChanged(selection => this.updateOutline(selection)));
        }
        this.updateOutline();
    }

    protected tokenSource = new CancellationTokenSource();
    protected async updateOutline(editorSelection?: Range): Promise<void> {
        if (!this.canUpdateOutline) {
            return;
        }
        this.tokenSource.cancel();
        this.tokenSource = new CancellationTokenSource();
        const token = this.tokenSource.token;

        const editor = MonacoEditor.get(this.editorManager.currentEditor);
        const model = editor && editor.getControl().getModel();
        const roots = model && await this.createRoots(model, token, editorSelection);
        if (token.isCancellationRequested) {
            return;
        }
        this.outlineViewService.publish(roots || []);
    }

    protected async createRoots(model: monaco.editor.IModel, token: CancellationToken, editorSelection?: Range): Promise<MonacoOutlineSymbolInformationNode[]> {
        if (this.roots && this.roots.length > 0) {
            // Reset the selection on the tree nodes, so that we can apply the new ones based on the `editorSelection`.
            const resetSelection = (node: MonacoOutlineSymbolInformationNode) => {
                node.selected = false;
                node.children.forEach(resetSelection);
            };
            this.roots.forEach(resetSelection);
        } else {
            this.roots = [];
            const providers = await DocumentSymbolProviderRegistry.all(model);
            if (token.isCancellationRequested) {
                return [];
            }
            const uri = new URI(model.uri.toString());
            for (const provider of providers) {
                try {
                    const symbols = await provider.provideDocumentSymbols(model, token);
                    if (token.isCancellationRequested) {
                        return [];
                    }
                    const nodes = this.createNodes(uri, symbols || []);
                    this.roots.push(...nodes);
                } catch {
                    /* collect symbols from other providers */
                }
            }
        }
        this.applySelection(this.roots, editorSelection);
        return this.roots;
    }

    protected createNodes(uri: URI, symbols: DocumentSymbol[]): MonacoOutlineSymbolInformationNode[] {
        let rangeBased = false;
        const ids = new Map();
        const roots: MonacoOutlineSymbolInformationNode[] = [];
        const nodesByName = symbols.sort(this.orderByPosition).reduce((result, symbol) => {
            const node = this.createNode(uri, symbol, ids);
            if (symbol.children) {
                MonacoOutlineSymbolInformationNode.insert(roots, node);
            } else {
                rangeBased = rangeBased || symbol.range.startLineNumber !== symbol.range.endLineNumber;
                const values = result.get(symbol.name) || [];
                values.push({ symbol, node });
                result.set(symbol.name, values);
            }
            return result;
        }, new Map<string, MonacoOutlineContribution.NodeAndSymbol[]>());

        for (const nodes of nodesByName.values()) {
            for (const { node, symbol } of nodes) {
                if (!symbol.containerName) {
                    MonacoOutlineSymbolInformationNode.insert(roots, node);
                } else {
                    const possibleParents = nodesByName.get(symbol.containerName);
                    if (possibleParents) {
                        const parent = possibleParents.find(possibleParent => this.parentContains(symbol, possibleParent.symbol, rangeBased));
                        if (parent) {
                            node.parent = parent.node;
                            MonacoOutlineSymbolInformationNode.insert(parent.node.children, node);
                        }
                    }
                }
            }
        }
        if (!roots.length) {
            const nodes = nodesByName.values().next().value;
            if (nodes && !nodes[0].node.parent) {
                return [nodes[0].node];
            }
            return [];
        }
        return roots;
    }

    /**
     * Sets the selection on the sub-trees based on the optional editor selection.
     * Select the narrowest node that is strictly contains the editor selection.
     */
    protected applySelection(roots: MonacoOutlineSymbolInformationNode[], editorSelection?: Range): boolean {
        if (editorSelection) {
            for (const root of roots) {
                if (this.parentContains(editorSelection, root.fullRange, true)) {
                    const { children } = root;
                    root.selected = !root.expanded || !this.applySelection(children, editorSelection);
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Returns `true` if `candidate` is strictly contained inside `parent`
     *
     * If the argument is a `DocumentSymbol`, then `getFullRange` will be used to retrieve the range of the underlying symbol.
     */
    protected parentContains(candidate: DocumentSymbol | Range, parent: DocumentSymbol | Range, rangeBased: boolean): boolean {
        // TODO: move this code to the `monaco-languageclient`: https://github.com/eclipse-theia/theia/pull/2885#discussion_r217800446
        const candidateRange = Range.is(candidate) ? candidate : this.getFullRange(candidate);
        const parentRange = Range.is(parent) ? parent : this.getFullRange(parent);
        const sameStartLine = candidateRange.start.line === parentRange.start.line;
        const startColGreaterOrEqual = candidateRange.start.character >= parentRange.start.character;
        const startLineGreater = candidateRange.start.line > parentRange.start.line;
        const sameEndLine = candidateRange.end.line === parentRange.end.line;
        const endColSmallerOrEqual = candidateRange.end.character <= parentRange.end.character;
        const endLineSmaller = candidateRange.end.line < parentRange.end.line;
        return (((sameStartLine && startColGreaterOrEqual || startLineGreater) &&
            (sameEndLine && endColSmallerOrEqual || endLineSmaller)) || !rangeBased);
    }

    /**
     * `monaco` to LSP `Range` converter. Converts the `1-based` location indices into `0-based` ones.
     */
    protected asRange(range: monaco.IRange): Range {
        const { startLineNumber, startColumn, endLineNumber, endColumn } = range;
        return {
            start: {
                line: startLineNumber - 1,
                character: startColumn - 1
            },
            end: {
                line: endLineNumber - 1,
                character: endColumn - 1
            }
        };
    }

    /**
     * Returns with a range enclosing this symbol not including leading/trailing whitespace but everything else like comments.
     * This information is typically used to determine if the clients cursor is inside the symbol to reveal in the symbol in the UI.
     * This allows to obtain the range including the associated comments.
     *
     * See: [`DocumentSymbol#range`](https://microsoft.github.io/language-server-protocol/specification#textDocument_documentSymbol) for more details.
     */
    protected getFullRange(documentSymbol: DocumentSymbol): Range {
        return this.asRange(documentSymbol.range);
    }

    /**
     * The range that should be selected and revealed when this symbol is being picked, e.g the name of a function. Must be contained by the `getSelectionRange`.
     *
     * See: [`DocumentSymbol#selectionRange`](https://microsoft.github.io/language-server-protocol/specification#textDocument_documentSymbol) for more details.
     */
    protected getNameRange(documentSymbol: DocumentSymbol): Range {
        return this.asRange(documentSymbol.selectionRange);
    }

    protected createNode(uri: URI, symbol: DocumentSymbol, ids: Map<string, number>, parent?: MonacoOutlineSymbolInformationNode): MonacoOutlineSymbolInformationNode {
        const id = this.createId(symbol.name, ids);
        const children: MonacoOutlineSymbolInformationNode[] = [];
        const node: MonacoOutlineSymbolInformationNode = {
            children,
            id,
            iconClass: SymbolKind[symbol.kind].toString().toLowerCase(),
            name: this.getName(symbol),
            detail: this.getDetail(symbol),
            parent,
            uri,
            range: this.getNameRange(symbol),
            fullRange: this.getFullRange(symbol),
            selected: false,
            expanded: this.shouldExpand(symbol)
        };
        if (symbol.children) {
            for (const child of symbol.children) {
                MonacoOutlineSymbolInformationNode.insert(children, this.createNode(uri, child, ids, node));
            }
        }
        return node;
    }

    protected getName(symbol: DocumentSymbol): string {
        return symbol.name;
    }

    protected getDetail(symbol: DocumentSymbol): string {
        return symbol.detail;
    }

    protected createId(name: string, ids: Map<string, number>): string {
        const counter = ids.get(name);
        const index = typeof counter === 'number' ? counter + 1 : 0;
        ids.set(name, index);
        return name + '_' + index;
    }

    protected shouldExpand(symbol: DocumentSymbol): boolean {
        return [SymbolKind.Class,
        SymbolKind.Enum, SymbolKind.File,
        SymbolKind.Interface, SymbolKind.Module,
        SymbolKind.Namespace, SymbolKind.Object,
        SymbolKind.Package, SymbolKind.Struct].indexOf(symbol.kind) !== -1;
    }

    protected orderByPosition(symbol: DocumentSymbol, symbol2: DocumentSymbol): number {
        const startLineComparison = symbol.range.startLineNumber - symbol2.range.startLineNumber;
        if (startLineComparison !== 0) {
            return startLineComparison;
        }
        const startOffsetComparison = symbol.range.startColumn - symbol2.range.startColumn;
        if (startOffsetComparison !== 0) {
            return startOffsetComparison;
        }
        const endLineComparison = symbol.range.endLineNumber - symbol2.range.endLineNumber;
        if (endLineComparison !== 0) {
            return endLineComparison;
        }
        return symbol.range.endColumn - symbol2.range.endColumn;
    }

}
export namespace MonacoOutlineContribution {
    export interface NodeAndSymbol {
        node: MonacoOutlineSymbolInformationNode;
        symbol: DocumentSymbol
    }
}

export interface MonacoOutlineSymbolInformationNode extends OutlineSymbolInformationNode {
    uri: URI;
    range: Range;
    fullRange: Range;
    detail?: string;
    parent: MonacoOutlineSymbolInformationNode | undefined;
    children: MonacoOutlineSymbolInformationNode[];
}

export namespace MonacoOutlineSymbolInformationNode {
    export function is(node: TreeNode): node is MonacoOutlineSymbolInformationNode {
        return OutlineSymbolInformationNode.is(node) && 'uri' in node && 'range' in node;
    }
    export function insert(nodes: MonacoOutlineSymbolInformationNode[], node: MonacoOutlineSymbolInformationNode): void {
        const index = nodes.findIndex(current => compare(node, current) < 0);
        if (index === -1) {
            nodes.push(node);
        } else {
            nodes.splice(index, 0, node);
        }
    }
    export function compare(node: MonacoOutlineSymbolInformationNode, node2: MonacoOutlineSymbolInformationNode): number {
        const startLineComparison = node.range.start.line - node2.range.start.line;
        if (startLineComparison !== 0) {
            return startLineComparison;
        }
        const startColumnComparison = node.range.start.character - node2.range.start.character;
        if (startColumnComparison !== 0) {
            return startColumnComparison;
        }
        const endLineComparison = node2.range.end.line - node.range.end.line;
        if (endLineComparison !== 0) {
            return endLineComparison;
        }
        return node2.range.end.character - node.range.end.character;
    }
}
