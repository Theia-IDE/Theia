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

import { inject, injectable, optional, postConstruct } from '@theia/core/shared/inversify';
import { OpenerService, KeybindingRegistry, QuickAccessRegistry, QuickAccessProvider } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import URI from '@theia/core/lib/common/uri';
import { FileSearchService, WHITESPACE_QUERY_SEPARATOR } from '../common/file-search-service';
import { CancellationToken } from '@theia/core/lib/common';
import { LabelProvider } from '@theia/core/lib/browser/label-provider';
import { Command } from '@theia/core/lib/common';
import { NavigationLocationService } from '@theia/editor/lib/browser/navigation/navigation-location-service';
import * as fuzzy from '@theia/core/shared/fuzzy';
import { MessageService } from '@theia/core/lib/common/message-service';
import { FileSystemPreferences } from '@theia/filesystem/lib/browser';
import { EditorOpenerOptions, EditorWidget, Position, Range } from '@theia/editor/lib/browser';
import { findMatches, QuickInputService, QuickPickItem, QuickPicks } from '@theia/core/lib/browser/quick-input/quick-input-service';

export const quickFileOpen: Command = {
    id: 'file-search.openFile',
    category: 'File',
    label: 'Open File...'
};
export interface FilterAndRange {
    filter: string;
    range?: Range;
}

// Supports patterns of <path><#|:><line><#|:|,><col?>
const LINE_COLON_PATTERN = /\s?[#:\(](?:line )?(\d*)(?:[#:,](\d*))?\)?\s*$/;
export type FileQuickPickItem = QuickPickItem & { uri: URI };

@injectable()
export class QuickFileOpenService implements QuickAccessProvider {
    static readonly PREFIX = '';

    @inject(KeybindingRegistry)
    protected readonly keybindingRegistry: KeybindingRegistry;
    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;
    @inject(OpenerService)
    protected readonly openerService: OpenerService;
    @inject(QuickInputService) @optional()
    protected readonly quickInputService: QuickInputService;
    @inject(QuickAccessRegistry)
    protected readonly quickAccessRegistry: QuickAccessRegistry;
    @inject(FileSearchService)
    protected readonly fileSearchService: FileSearchService;
    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;
    @inject(NavigationLocationService)
    protected readonly navigationLocationService: NavigationLocationService;
    @inject(MessageService)
    protected readonly messageService: MessageService;
    @inject(FileSystemPreferences)
    protected readonly fsPreferences: FileSystemPreferences;

    registerQuickAccessProvider(): void {
        this.quickAccessRegistry.registerQuickAccessProvider({
            getInstance: () => this,
            prefix: QuickFileOpenService.PREFIX,
            placeholder: this.getPlaceHolder(),
            helpEntries: [{ description: 'Open File', needsEditor: false }]
        });
    }

    /**
     * Whether to hide .gitignored (and other ignored) files.
     */
    protected hideIgnoredFiles = true;

    /**
     * Whether the dialog is currently open.
     */
    protected isOpen = false;
    private updateIsOpen = true;

    protected filterAndRangeDefault = { filter: '', range: undefined };

    /**
     * Tracks the user file search filter and location range e.g. fileFilter:line:column or fileFilter:line,column
     */
    protected filterAndRange: FilterAndRange = this.filterAndRangeDefault;

    /**
     * The score constants when comparing file search results.
     */
    private static readonly Scores = {
        max: 1000,  // represents the maximum score from fuzzy matching (Infinity).
        exact: 500, // represents the score assigned to exact matching.
        partial: 250 // represents the score assigned to partial matching.
    };

    @postConstruct()
    protected init(): void {
        this.quickInputService?.onHide(() => {
            if (this.updateIsOpen) {
                this.isOpen = false;
            } else {
                this.updateIsOpen = true;
            }
        });
    }

    isEnabled(): boolean {
        return this.workspaceService.opened;
    }

    open(): void {
        // Triggering the keyboard shortcut while the dialog is open toggles
        // showing the ignored files.
        if (this.isOpen) {
            this.hideIgnoredFiles = !this.hideIgnoredFiles;
            this.hideQuickPick();
        } else {
            this.hideIgnoredFiles = true;
            this.filterAndRange = this.filterAndRangeDefault;
            this.isOpen = true;
        }

        this.quickInputService?.open(this.filterAndRange.filter);
    }

    protected hideQuickPick(): void {
        this.updateIsOpen = false;
        this.quickInputService?.hide();
    }

    /**
     * Get a string (suitable to show to the user) representing the keyboard
     * shortcut used to open the quick file open menu.
     */
    protected getKeyCommand(): string | undefined {
        const keyCommand = this.keybindingRegistry.getKeybindingsForCommand(quickFileOpen.id);
        if (keyCommand) {
            // We only consider the first keybinding.
            const accel = this.keybindingRegistry.acceleratorFor(keyCommand[0], '+');
            return accel.join(' ');
        }

        return undefined;
    }

    async getPicks(filter: string, token: CancellationToken): Promise<QuickPicks> {
        const roots = this.workspaceService.tryGetRoots();

        this.filterAndRange = this.splitFilterAndRange(filter);
        const fileFilter = this.filterAndRange.filter;

        const alreadyCollected = new Set<string>();
        const recentlyUsedItems: QuickPicks = [];

        const locations = [...this.navigationLocationService.locations()].reverse();
        for (const location of locations) {
            const uriString = location.uri.toString();

            if (location.uri.scheme === 'file' && !alreadyCollected.has(uriString) && fuzzy.test(fileFilter, uriString)) {
                if (recentlyUsedItems.length === 0) {
                    recentlyUsedItems.push({ type: 'separator', label: 'recently opened' });
                }
                const item = this.toItem(fileFilter, location.uri);
                recentlyUsedItems.push(item);
                alreadyCollected.add(uriString);
            }
        }

        if (fileFilter.length > 0) {
            const handler = async (results: string[]) => {
                if (token.isCancellationRequested || results.length <= 0) {
                    return [];
                }

                const result = [...recentlyUsedItems];
                const fileSearchResultItems: FileQuickPickItem[] = [];

                for (const fileUri of results) {
                    if (!alreadyCollected.has(fileUri)) {
                        const item = this.toItem(fileFilter, fileUri);
                        fileSearchResultItems.push(item);
                        alreadyCollected.add(fileUri);
                    }
                }

                // Create a copy of the file search results and sort.
                const sortedResults = fileSearchResultItems.slice();
                sortedResults.sort((a, b) => this.compareItems(a, b));

                if (sortedResults.length > 0) {
                    result.unshift({ type: 'separator', label: 'file results' });
                    result.push(...sortedResults);
                }

                // Return the recently used items, followed by the search results.
                return result;
            };

            return this.fileSearchService.find(fileFilter, {
                rootUris: roots.map(r => r.resource.toString()),
                fuzzyMatch: true,
                limit: 200,
                useGitIgnore: this.hideIgnoredFiles,
                excludePatterns: this.hideIgnoredFiles
                    ? Object.keys(this.fsPreferences['files.exclude'])
                    : undefined,
            }, token).then(handler);
        } else {
            return roots.length !== 0 ? recentlyUsedItems : [];
        }
    }
    protected compareItems(
        left: FileQuickPickItem,
        right: FileQuickPickItem): number {

        /**
         * Score a given string.
         *
         * @param str the string to score on.
         * @returns the score.
         */
        function score(str: string | undefined): number {
            if (!str) {
                return 0;
            }
            // Adjust for whitespaces in the query.
            const querySplit = query.split(WHITESPACE_QUERY_SEPARATOR);
            const queryJoin = querySplit.join('');

            // Check exact and partial exact matches.
            let exactMatch = true;
            let partialMatch = false;
            querySplit.forEach(part => {
                const partMatches = str.includes(part);
                exactMatch = exactMatch && partMatches;
                partialMatch = partialMatch || partMatches;
            });

            // Check fuzzy matches.
            const fuzzyMatch = fuzzy.match(queryJoin, str);
            let matchScore = 0;
            // eslint-disable-next-line no-null/no-null
            if (!!fuzzyMatch && matchScore !== null) {
                matchScore = (fuzzyMatch.score === Infinity) ? QuickFileOpenService.Scores.max : fuzzyMatch.score;
            }

            // Prioritize exact matches, then partial exact matches, then fuzzy matches.
            if (exactMatch) {
                return matchScore + QuickFileOpenService.Scores.exact;
            } else if (partialMatch) {
                return matchScore + QuickFileOpenService.Scores.partial;
            } else {
                // eslint-disable-next-line no-null/no-null
                return (fuzzyMatch === null) ? 0 : matchScore;
            }
        }

        const query: string = normalize(this.filterAndRange.filter);

        const compareByLabelScore = (l: FileQuickPickItem, r: FileQuickPickItem) => score(r.label) - score(l.label);
        const compareByLabelIndex = (l: FileQuickPickItem, r: FileQuickPickItem) => r.label.indexOf(query) - l.label.indexOf(query);
        const compareByLabel = (l: FileQuickPickItem, r: FileQuickPickItem) => r.label.localeCompare(l.label);

        const compareByPathScore = (l: FileQuickPickItem, r: FileQuickPickItem) => score(r.uri.path.toString()) - score(l.uri.path.toString());
        const compareByPathIndex = (l: FileQuickPickItem, r: FileQuickPickItem) => r.uri.path.toString().indexOf(query) - l.uri.path.toString().indexOf(query);
        const compareByPathLabel = (l: FileQuickPickItem, r: FileQuickPickItem) => r.uri.path.toString().localeCompare(l.uri.path.toString());

        return compareWithDiscriminators(left, right, compareByLabelScore, compareByLabelIndex, compareByLabel, compareByPathScore, compareByPathIndex, compareByPathLabel);
    }

    openFile(uri: URI): void {
        const options = this.buildOpenerOptions();
        const closedEditor = this.navigationLocationService.closedEditorsStack.find(editor => editor.uri.path.toString() === uri.path.toString());
        this.openerService.getOpener(uri, options)
            .then(opener => opener.open(uri, options))
            .then(widget => {
                // Attempt to restore the editor state if it exists, and no selection is explicitly requested.
                if (widget instanceof EditorWidget && closedEditor && !options.selection) {
                    widget.editor.restoreViewState(closedEditor.viewState);
                }
            })
            .catch(error => this.messageService.error(error));
    }

    protected buildOpenerOptions(): EditorOpenerOptions {
        return { selection: this.filterAndRange.range };
    }

    private toItem(lookFor: string, uriOrString: URI | string): FileQuickPickItem {
        const uri = uriOrString instanceof URI ? uriOrString : new URI(uriOrString);
        const label = this.labelProvider.getName(uri);
        const description = this.getItemDescription(uri);
        const iconClasses = this.getItemIconClasses(uri);

        return {
            label,
            description,
            highlights: {
                label: findMatches(label, lookFor),
                description: findMatches(description, lookFor)
            },
            iconClasses,
            uri,
            execute: () => this.openFile(uri)
        };
    }

    private getItemIconClasses(uri: URI): string[] | undefined {
        const icon = this.labelProvider.getIcon(uri);
        return icon !== '' ? [icon + ' file-icon'] : [];
    }

    private getItemDescription(uri: URI): string {
        let description = this.labelProvider.getLongName(uri.parent);
        if (this.workspaceService.isMultiRootWorkspaceOpened) {
            const rootUri = this.workspaceService.getWorkspaceRootUri(uri);
            if (rootUri) {
                description = `${this.labelProvider.getLongName(rootUri)} • ${description}`;
            }
        }
        return description;
    }

    private getPlaceHolder(): string {
        let placeholder = 'File name to search (append : to go to line).';
        const keybinding = this.getKeyCommand();
        if (keybinding) {
            placeholder += ` (Press ${keybinding} to show/hide ignored files)`;
        }
        return placeholder;
    }

    /**
     * Splits the given expression into a structure of search-file-filter and
     * location-range.
     *
     * @param expression patterns of <path><#|:><line><#|:|,><col?>
     */
    protected splitFilterAndRange(expression: string): FilterAndRange {
        let filter = expression;
        let range = undefined;

        // Find line and column number from the expression using RegExp.
        const patternMatch = LINE_COLON_PATTERN.exec(expression);

        if (patternMatch) {
            const line = parseInt(patternMatch[1] ?? '', 10);
            if (Number.isFinite(line)) {
                const lineNumber = line > 0 ? line - 1 : 0;

                const column = parseInt(patternMatch[2] ?? '', 10);
                const startColumn = Number.isFinite(column) && column > 0 ? column - 1 : 0;
                const position = Position.create(lineNumber, startColumn);

                filter = expression.substr(0, patternMatch.index);
                range = Range.create(position, position);
            }
        }
        return { filter, range };
    }
}

/**
 * Normalize a given string.
 *
 * @param str the raw string value.
 * @returns the normalized string value.
 */
function normalize(str: string): string {
    return str.trim().toLowerCase();
}

function compareWithDiscriminators<T>(left: T, right: T, ...discriminators: ((left: T, right: T) => number)[]): number {
    let comparisonValue = 0;
    let i = 0;

    while (comparisonValue === 0 && i < discriminators.length) {
        comparisonValue = discriminators[i](left, right);
        i++;
    }
    return comparisonValue;
}
