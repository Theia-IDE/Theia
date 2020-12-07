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

import { inject, injectable } from 'inversify';
import { EditorManager, TextEditor, EditorDecoration, EditorDecorationOptions, Range, Position, EditorDecorationStyle } from '@theia/editor/lib/browser';
import { GitFileBlame, Commit } from '@theia/git/lib/common';
import { Disposable, DisposableCollection } from '@theia/core';
import * as moment from 'moment';
import URI from '@theia/core/lib/common/uri';

@injectable()
export class BlameDecorator implements monaco.languages.HoverProvider {

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    protected registerHoverProvider(uri: string): Disposable {
        return monaco.languages.registerHoverProvider([{ pattern: new URI(uri).path.toString() }], this);
    }

    protected emptyHover: monaco.languages.Hover = {
        contents: [{
            value: ''
        }]
    };

    async provideHover(model: monaco.editor.ITextModel, position: monaco.Position, token: monaco.CancellationToken): Promise<monaco.languages.Hover> {
        const line = position.lineNumber - 1;
        const uri = model.uri.toString();
        const applications = this.appliedDecorations.get(uri);
        if (!applications) {
            return this.emptyHover;
        }
        const blame = applications.blame;
        if (!blame) {
            return this.emptyHover;
        }
        const commitLine = blame.lines.find(l => l.line === line);
        if (!commitLine) {
            return this.emptyHover;
        }
        const sha = commitLine.sha;
        const commit = blame.commits.find(c => c.sha === sha)!;
        const date = new Date(commit.author.timestamp);
        let commitMessage = commit.summary + '\n' + (commit.body || '');
        commitMessage = commitMessage.replace(/[`\>\#\*\_\-\+]/g, '\\$&').replace(/\n/g, '  \n');
        const value = `${commit.sha}\n \n ${commit.author.name}, ${date.toString()}\n \n> ${commitMessage}`;

        const hover = {
            contents: [{ value }],
            range: monaco.Range.fromPositions(new monaco.Position(position.lineNumber, 1), new monaco.Position(position.lineNumber, 10 ^ 10))
        };
        return hover;
    }

    protected appliedDecorations = new Map<string, AppliedBlameDecorations>();

    decorate(blame: GitFileBlame, editor: TextEditor, highlightLine: number): Disposable {
        const uri = editor.uri.toString();
        let applications = this.appliedDecorations.get(uri);
        if (!applications) {
            const that = applications = new AppliedBlameDecorations();
            this.appliedDecorations.set(uri, applications);
            applications.toDispose.push(this.registerHoverProvider(uri));
            applications.toDispose.push(Disposable.create(() => {
                this.appliedDecorations.delete(uri);
            }));
            applications.toDispose.push(Disposable.create(() => {
                editor.deltaDecorations({ oldDecorations: that.previousDecorations, newDecorations: [] });
            }));
        }
        if (applications.highlightedSha) {
            const sha = this.getShaForLine(blame, highlightLine);
            if (applications.highlightedSha === sha) {
                return applications;
            }
            applications.highlightedSha = sha;
        }
        const blameDecorations = this.toDecorations(blame, highlightLine);
        applications.previousStyles.dispose();
        applications.previousStyles.pushAll(blameDecorations.styles);
        const newDecorations = blameDecorations.editorDecorations;
        const oldDecorations = applications.previousDecorations;
        const appliedDecorations = editor.deltaDecorations({ oldDecorations, newDecorations });
        applications.previousDecorations.length = 0;
        applications.previousDecorations.push(...appliedDecorations);
        applications.blame = blame;
        return applications;
    }

    protected getShaForLine(blame: GitFileBlame, line: number): string | undefined {
        const commitLines = blame.lines;
        const commitLine = commitLines.find(c => c.line === line);
        return commitLine ? commitLine.sha : undefined;
    }

    protected toDecorations(blame: GitFileBlame, highlightLine: number): BlameDecorations {
        const beforeContentStyles = new Map<string, EditorDecorationStyle>();
        const commits = blame.commits;
        for (const commit of commits) {
            const sha = commit.sha;
            const commitTime = moment(commit.author.timestamp);
            const heat = this.getHeatColor(commitTime);
            const content = this.formatContentLine(commit, commitTime);
            const short = sha.substr(0, 7);
            const selector = 'git-' + short + '::before';
            beforeContentStyles.set(sha, new EditorDecorationStyle(selector, style => {
                EditorDecorationStyle.copyStyle(BlameDecorator.defaultGutterStyles, style);
                style.content = `'${content}'`;
                style.borderColor = heat;
            }));
        }
        const commitLines = blame.lines;
        const highlightedSha = this.getShaForLine(blame, highlightLine) || '';
        let previousLineSha = '';
        const editorDecorations: EditorDecoration[] = [];

        for (const commitLine of commitLines) {
            const { line, sha } = commitLine;
            const beforeContentClassName = beforeContentStyles.get(sha)!.className;
            const options = <EditorDecorationOptions>{
                beforeContentClassName,
            };
            if (sha === highlightedSha) {
                options.beforeContentClassName += ' ' + BlameDecorator.highlightStyle.className;
            }
            if (sha === previousLineSha) {
                options.beforeContentClassName += ' ' + BlameDecorator.continuationStyle.className;
            }
            previousLineSha = sha;
            const range = Range.create(Position.create(line, 0), Position.create(line, 0));
            editorDecorations.push(<EditorDecoration>{ range, options });
        }
        const styles = [...beforeContentStyles.values()];
        return { editorDecorations, styles };
    }

    protected formatContentLine(commit: Commit, commitTime: moment.Moment): string {
        const when = commitTime.fromNow();
        const contentWidth = BlameDecorator.maxWidth - when.length - 2;
        let content = commit.summary.substring(0, contentWidth + 1);
        content = content.replace('\n', '↩︎').replace(/'/g, "\\'");
        if (content.length > contentWidth) {
            let cropAt = content.lastIndexOf(' ', contentWidth - 4);
            if (cropAt < contentWidth / 2) {
                cropAt = contentWidth - 3;
            }
            content = content.substring(0, cropAt) + '...';
        }
        if (content.length < contentWidth) {
            content = content + '\u2007'.repeat(contentWidth - content.length); // fill up with blanks
        }
        return `${content} ${when}`;
    }

    protected now = moment();
    protected getHeatColor(commitTime: moment.Moment): string {
        const daysFromNow = this.now.diff(commitTime, 'days');
        if (daysFromNow <= 2) {
            return 'var(--md-orange-50)';
        }
        if (daysFromNow <= 5) {
            return 'var(--md-orange-100)';
        }
        if (daysFromNow <= 10) {
            return 'var(--md-orange-200)';
        }
        if (daysFromNow <= 15) {
            return 'var(--md-orange-300)';
        }
        if (daysFromNow <= 60) {
            return 'var(--md-orange-400)';
        }
        if (daysFromNow <= 180) {
            return 'var(--md-deep-orange-600)';
        }
        if (daysFromNow <= 365) {
            return 'var(--md-deep-orange-700)';
        }
        if (daysFromNow <= 720) {
            return 'var(--md-deep-orange-800)';
        }
        return 'var(--md-deep-orange-900)';
    }

}

export namespace BlameDecorator {

    export const maxWidth = 50; // character

    export const defaultGutterStyles = <CSSStyleDeclaration>{
        width: `${maxWidth}ch`,
        color: 'var(--theia-gitlens-gutterForegroundColor)',
        backgroundColor: 'var(--theia-gitlens-gutterBackgroundColor)',
        height: '100%',
        margin: '0 26px -1px 0',
        display: 'inline-block',
        borderRight: '2px solid',
    };

    export const continuationStyle = new EditorDecorationStyle('git-blame-continuation-line::before', style => {
        style.content = "'\u2007'"; // blank
    });

    export const highlightStyle = new EditorDecorationStyle('git-blame-highlight::before', style => {
        style.backgroundColor = 'var(--theia-gitlens-lineHighlightBackgroundColor)';
    });

}

export interface BlameDecorations {
    editorDecorations: EditorDecoration[]
    styles: EditorDecorationStyle[]
}

export class AppliedBlameDecorations implements Disposable {
    readonly toDispose = new DisposableCollection();
    readonly previousStyles = new DisposableCollection();
    readonly previousDecorations: string[] = [];
    blame: GitFileBlame | undefined;
    highlightedSha: string | undefined;

    dispose(): void {
        this.previousStyles.dispose();
        this.toDispose.dispose();
        this.blame = undefined;
    }
}
