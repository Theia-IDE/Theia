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

import { injectable, inject, postConstruct } from 'inversify';
import { ApplicationServer } from '@theia/core/lib/common/application-protocol';
import { OS } from '@theia/core/lib/common';
import { OpenerService } from '@theia/core/lib/browser';
import { Position } from '@theia/editor/lib/browser';
import { AbstractCmdClickTerminalContribution } from './terminal-linkmatcher';
import { TerminalWidget } from './terminal-widget-impl';
import { Path } from '@theia/core';
import { FileSystem } from '@theia/filesystem/lib/common';
import URI from '@theia/core/lib/common/uri';

@injectable()
export class TerminalLinkmatcherFiles extends AbstractCmdClickTerminalContribution {

    @inject(ApplicationServer) protected appServer: ApplicationServer;
    @inject(OpenerService) protected openerService: OpenerService;
    @inject(FileSystem) protected fileSystem: FileSystem;

    protected backendOs: Promise<OS.Type>;

    @postConstruct()
    protected init(): void {
        this.backendOs = this.appServer.getBackendOS();
    }

    async getRegExp(): Promise<RegExp> {
        const os = await this.backendOs;
        const baseLocalLinkClause = os === OS.Type.Windows ? winLocalLinkClause : unixLocalLinkClause;
        return new RegExp(`${baseLocalLinkClause}(${lineAndColumnClause})`);
    }

    getValidate(terminalWidget: TerminalWidget): (link: string) => Promise<boolean> {
        return async match => {
            try {
                const toOpen = await this.toURI(match, await terminalWidget.cwd);
                if (toOpen) {
                    // TODO: would be better to ask the opener service, but it returns positively even for unknown files.
                    const f = await this.fileSystem.getFileStat(toOpen.toString());
                    // eslint-disable-next-line no-null/no-null
                    return f !== undefined && f !== null && !f.isDirectory;
                }
            } catch (err) {
                console.trace('Error validating ' + match);
            }
            return false;
        };
    }

    getHandler(terminalWidget: TerminalWidget): (event: MouseEvent, link: string) => void {
        return async (event, fullMatch) => {
            const toOpen = await this.toURI(fullMatch, await terminalWidget.cwd);
            if (!toOpen) {
                return;
            }
            const position = await this.extractPosition(fullMatch);
            let options = {};
            if (position) {
                options = {
                    selection: {
                        start: position
                    }
                };
            }
            try {
                const opener = await this.openerService.getOpener(toOpen, options);
                opener.open(toOpen, options);
            } catch (err) {
                console.error('Cannot open link ' + fullMatch, err);
            }
        };
    }

    protected async toURI(match: string, cwd: URI): Promise<URI | undefined> {
        const path = await this.extractPath(match);
        if (!path) {
            return;
        }
        const pathObj = new Path(path);
        return pathObj.isAbsolute ? cwd.withPath(path) : cwd.resolve(path);
    }

    protected async extractPosition(link: string): Promise<Position> {
        const matches: string[] | null = (await this.getRegExp()).exec(link);
        const info: Position = {
            line: 1,
            character: 1
        };

        if (!matches) {
            return info;
        }

        const lineAndColumnMatchIndex = (await this.backendOs) === OS.Type.Windows ? winLineAndColumnMatchIndex : unixLineAndColumnMatchIndex;
        for (let i = 0; i < lineAndColumnClause.length; i++) {
            const lineMatchIndex = lineAndColumnMatchIndex + (lineAndColumnClauseGroupCount * i);
            const rowNumber = matches[lineMatchIndex];
            if (rowNumber) {
                info.line = parseInt(rowNumber, 10) - 1;
                const columnNumber = matches[lineMatchIndex + 2];
                if (columnNumber) {
                    info.character = parseInt(columnNumber, 10) - 1;
                }
                break;
            }
        }

        return info;
    }

    protected async extractPath(link: string): Promise<string | undefined> {
        const matches: string[] | null = (await this.getRegExp()).exec(link);
        if (!matches) {
            return undefined;
        }
        return matches[1];
    }
}

// The following regular expressions are taken from:
// https://github.com/microsoft/vscode/blob/fbbc1aa80332189aa0d3006cb2159b79a9eba480/src/vs/workbench/contrib/terminal/browser/terminalLinkHandler.ts

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const pathPrefix = '(\\.\\.?|\\~)';
const pathSeparatorClause = '\\/';
// '":; are allowed in paths but they are often separators so ignore them
// Also disallow \\ to prevent a catastrophic backtracking case #24798
const excludedPathCharactersClause = '[^\\0\\s!$`&*()\\[\\]+\'":;\\\\]';
/** A regex that matches paths in the form /foo, ~/foo, ./foo, ../foo, foo/bar */
const unixLocalLinkClause = '((' + pathPrefix + '|(' + excludedPathCharactersClause + ')+)?(' + pathSeparatorClause + '(' + excludedPathCharactersClause + ')+)+)';

const winDrivePrefix = '[a-zA-Z]:';
const winPathPrefix = '(' + winDrivePrefix + '|\\.\\.?|\\~)';
const winPathSeparatorClause = '(\\\\|\\/)';
const winExcludedPathCharactersClause = '[^\\0<>\\?\\|\\/\\s!$`&*()\\[\\]+\'":;]';
/** A regex that matches paths in the form c:\foo, ~\foo, .\foo, ..\foo, foo\bar */
const winLocalLinkClause = '((' + winPathPrefix + '|(' + winExcludedPathCharactersClause + ')+)?(' + winPathSeparatorClause + '(' + winExcludedPathCharactersClause + ')+)+)';

/** As xterm reads from DOM, space in that case is non-breaking char ASCII code - 160, replacing space with nonBreakingSpace or space ASCII code - 32. */
const lineAndColumnClause = [
    // "(file path)", line 45 [see #40468]
    '((\\S*)", line ((\\d+)( column (\\d+))?))',
    // (file path) on line 8, column 13
    '((\\S*) on line ((\\d+)(, column (\\d+))?))',
    // (file path):line 8, column 13
    '((\\S*):line ((\\d+)(, column (\\d+))?))',
    // (file path)(45), (file path) (45), (file path)(45,18), (file path) (45,18), (file path)(45, 18), (file path) (45, 18), also with []
    '(([^\\s\\(\\)]*)(\\s?[\\(\\[](\\d+)(,\\s?(\\d+))?)[\\)\\]])',
    // (file path):336, (file path):336:9
    '(([^:\\s\\(\\)<>\'\"\\[\\]]*)(:(\\d+))?(:(\\d+))?)'
].join('|').replace(/ /g, `[${'\u00A0'} ]`);

// Changing any regex may effect this value, hence changes this as well if required.
const winLineAndColumnMatchIndex = 12;
const unixLineAndColumnMatchIndex = 11;

// Each line and column clause have 6 groups (ie no. of expressions in round brackets)
const lineAndColumnClauseGroupCount = 6;
