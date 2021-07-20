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

import * as React from '@theia/core/shared/react';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { RecursivePartial } from '@theia/core';
import URI from '@theia/core/lib/common/uri';
import { Range } from '@theia/editor/lib/browser';
import { TREE_NODE_INFO_CLASS, WidgetOpenerOptions } from '@theia/core/lib/browser';
import { TreeElement } from '@theia/core/lib/browser/source-tree';
import { SourceBreakpoint } from '../breakpoint/breakpoint-marker';
import { DebugSource } from './debug-source';
import { DebugBreakpoint, DebugBreakpointOptions, DebugBreakpointData, DebugBreakpointDecoration } from './debug-breakpoint';

export class DebugSourceBreakpointData extends DebugBreakpointData {
    readonly origins: SourceBreakpoint[];
}

export class DebugSourceBreakpoint extends DebugBreakpoint<SourceBreakpoint> implements TreeElement {

    readonly origins: SourceBreakpoint[];

    constructor(origin: SourceBreakpoint, options: DebugBreakpointOptions) {
        super(new URI(origin.uri), options);
        this.origins = [origin];
    }

    update(data: Partial<DebugSourceBreakpointData>): void {
        super.update(data);
    }

    get origin(): SourceBreakpoint {
        return this.origins[0];
    }

    setEnabled(enabled: boolean): void {
        const { uri, raw } = this;
        let shouldUpdate = false;
        let breakpoints = raw && this.doRemove(this.origins.filter(origin => !(origin.raw.line === raw.line && origin.raw.column === raw.column)));
        // Check for breakpoints array with at least one entry
        if (breakpoints && breakpoints.length) {
            shouldUpdate = true;
        } else {
            breakpoints = this.breakpoints.getBreakpoints(uri);
        }
        for (const breakpoint of breakpoints) {
            if (breakpoint.raw.line === this.origin.raw.line && breakpoint.raw.column === this.origin.raw.column && breakpoint.enabled !== enabled) {
                breakpoint.enabled = enabled;
                shouldUpdate = true;
            }
        }
        if (shouldUpdate) {
            this.breakpoints.setBreakpoints(this.uri, breakpoints);
        }
    }

    updateOrigins(data: Partial<DebugProtocol.SourceBreakpoint>): void {
        const breakpoints = this.breakpoints.getBreakpoints(this.uri);
        let shouldUpdate = false;
        const originPositions = new Set();
        this.origins.forEach(origin => originPositions.add(origin.raw.line + ':' + origin.raw.column));
        for (const breakpoint of breakpoints) {
            if (originPositions.has(breakpoint.raw.line + ':' + breakpoint.raw.column)) {
                Object.assign(breakpoint.raw, data);
                shouldUpdate = true;
            }
        }
        if (shouldUpdate) {
            this.breakpoints.setBreakpoints(this.uri, breakpoints);
        }
    }

    /** 1-based */
    get line(): number {
        return this.raw && this.raw.line || this.origins[0].raw.line;
    }
    get column(): number | undefined {
        return this.raw && this.raw.column || this.origins[0].raw.column;
    }
    get endLine(): number | undefined {
        return this.raw && this.raw.endLine;
    }
    get endColumn(): number | undefined {
        return this.raw && this.raw.endColumn;
    }

    get condition(): string | undefined {
        return this.origin.raw.condition;
    }
    get hitCondition(): string | undefined {
        return this.origin.raw.hitCondition;
    }
    get logMessage(): string | undefined {
        return this.origin.raw.logMessage;
    }

    get source(): DebugSource | undefined {
        return this.raw && this.raw.source && this.session && this.session.getSource(this.raw.source);
    }

    async open(options: WidgetOpenerOptions = {
        mode: 'reveal'
    }): Promise<void> {
        const { line, column, endLine, endColumn } = this;
        const selection: RecursivePartial<Range> = {
            start: {
                line: line - 1,
                character: typeof column === 'number' ? column - 1 : undefined
            }
        };
        if (typeof endLine === 'number') {
            selection.end = {
                line: endLine - 1,
                character: typeof endColumn === 'number' ? endColumn - 1 : undefined
            };
        }
        if (this.source) {
            await this.source.open({
                ...options,
                selection
            });
        } else {
            await this.editorManager.open(this.uri, {
                ...options,
                selection
            });
        }
    }

    protected readonly setBreakpointEnabled = (event: React.ChangeEvent<HTMLInputElement>) => {
        this.setEnabled(event.target.checked);
    };

    protected doRender(): React.ReactNode {
        return <React.Fragment>
            <span className='line-info' title={this.labelProvider.getLongName(this.uri)}>
                <span className='name'>{this.labelProvider.getName(this.uri)} </span>
                <span className={'path ' + TREE_NODE_INFO_CLASS}>{this.labelProvider.getLongName(this.uri.parent)} </span>
            </span>
            <span className='line'>{this.renderPosition()}</span>
        </React.Fragment>;
    }

    renderPosition(): string {
        return this.line + (typeof this.column === 'number' ? ':' + this.column : '');
    }

    doGetDecoration(messages: string[] = []): DebugBreakpointDecoration {
        if (this.logMessage || this.condition || this.hitCondition) {
            const { session } = this;
            if (this.logMessage) {
                if (session && !session.capabilities.supportsLogPoints) {
                    return this.getUnsupportedBreakpointDecoration('Logpoints not supported by this debug type');
                }
                messages.push('Log Message: ' + this.logMessage);
            }
            if (this.condition) {
                if (session && !session.capabilities.supportsConditionalBreakpoints) {
                    return this.getUnsupportedBreakpointDecoration('Conditional breakpoints not supported by this debug type');
                }
                messages.push('Expression: ' + this.condition);
            }
            if (this.hitCondition) {
                if (session && !session.capabilities.supportsHitConditionalBreakpoints) {
                    return this.getUnsupportedBreakpointDecoration('Hit conditional breakpoints not supported by this debug type');
                }
                messages.push('Hit Count: ' + this.hitCondition);
            }
        }
        return super.doGetDecoration(messages);
    }

    protected getUnsupportedBreakpointDecoration(message: string): DebugBreakpointDecoration {
        return {
            className: 'theia-debug-breakpoint-unsupported',
            message: [message]
        };
    }

    protected getBreakpointDecoration(message?: string[]): DebugBreakpointDecoration {
        if (this.logMessage) {
            return {
                className: 'theia-debug-logpoint',
                message: message || ['Logpoint']
            };
        }
        if (this.condition || this.hitCondition) {
            return {
                className: 'theia-debug-conditional-breakpoint',
                message: message || ['Conditional Breakpoint']
            };
        }
        return {
            className: 'theia-debug-breakpoint',
            message: message || ['Breakpoint']
        };
    }

    remove(): void {
        const breakpoints = this.doRemove(this.origins);
        if (breakpoints) {
            this.breakpoints.setBreakpoints(this.uri, breakpoints);
        }
    }
    protected doRemove(origins: SourceBreakpoint[]): SourceBreakpoint[] | undefined {
        if (!origins.length) {
            return undefined;
        }
        const { uri } = this;
        const toRemove = new Set();
        origins.forEach(origin => toRemove.add(origin.raw.line + ':' + origin.raw.column));
        let shouldUpdate = false;
        const breakpoints = this.breakpoints.findMarkers({
            uri,
            dataFilter: data => {
                const result = !toRemove.has(data.raw.line + ':' + data.raw.column);
                shouldUpdate = shouldUpdate || !result;
                return result;
            }
        }).map(({ data }) => data);
        return shouldUpdate && breakpoints || undefined;
    }

}
