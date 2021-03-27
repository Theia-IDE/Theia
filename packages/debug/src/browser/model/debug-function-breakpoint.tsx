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

import * as React from 'react';
import { TreeElement } from '@theia/core/lib/browser/source-tree';
import { FunctionBreakpoint } from '../breakpoint/breakpoint-marker';
import { BreakpointManager } from '../breakpoint/breakpoint-manager';
import { DebugBreakpoint, DebugBreakpointOptions, DebugBreakpointDecoration } from './debug-breakpoint';
import { SingleTextInputDialog } from '@theia/core/lib/browser/dialogs';

export class DebugFunctionBreakpoint extends DebugBreakpoint<FunctionBreakpoint> implements TreeElement {

    constructor(readonly origin: FunctionBreakpoint, options: DebugBreakpointOptions) {
        super(BreakpointManager.FUNCTION_URI, options);
    }

    setEnabled(enabled: boolean): void {
        const breakpoints = this.breakpoints.getFunctionBreakpoints();
        const breakpoint = breakpoints.find(b => b.id === this.id);
        if (breakpoint && breakpoint.enabled !== enabled) {
            breakpoint.enabled = enabled;
            this.breakpoints.setFunctionBreakpoints(breakpoints);
        }
    }

    protected isEnabled(): boolean {
        return super.isEnabled() && this.isSupported();
    }

    protected isSupported(): boolean {
        const { session } = this;
        return !session || !!session.capabilities.supportsFunctionBreakpoints;
    }

    remove(): void {
        const breakpoints = this.breakpoints.getFunctionBreakpoints();
        const newBreakpoints = breakpoints.filter(b => b.id !== this.id);
        if (breakpoints.length !== newBreakpoints.length) {
            this.breakpoints.setFunctionBreakpoints(newBreakpoints);
        }
    }

    get name(): string {
        return this.origin.raw.name;
    }

    protected doRender(): React.ReactNode {
        return <span className='line-info'>{this.name}</span>;
    }

    protected doGetDecoration(): DebugBreakpointDecoration {
        if (!this.isSupported()) {
            return this.getDisabledBreakpointDecoration('Function breakpoints are not supported by this debug type');
        }
        return super.doGetDecoration();
    }

    protected getBreakpointDecoration(message?: string[]): DebugBreakpointDecoration {
        return {
            className: 'codicon-debug-breakpoint-function',
            message: message || ['Function Breakpoint']
        };
    }

    async open(): Promise<void> {
        const input = new SingleTextInputDialog({
            title: 'Add Function Breakpoint',
            initialValue: this.name
        });
        const newValue = await input.open();
        if (newValue !== undefined && newValue !== this.name) {
            const breakpoints = this.breakpoints.getFunctionBreakpoints();
            const breakpoint = breakpoints.find(b => b.id === this.id);
            if (breakpoint) {
                if (breakpoint.raw.name !== newValue) {
                    breakpoint.raw.name = newValue;
                    this.breakpoints.setFunctionBreakpoints(breakpoints);
                }
            } else {
                this.origin.raw.name = newValue;
                breakpoints.push(this.origin);
                this.breakpoints.setFunctionBreakpoints(breakpoints);
            }
        }
    }

}
