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
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import URI from '@theia/core/lib/common/uri';
import { EditorManager } from '@theia/editor/lib/browser';
import { LabelProvider, DISABLED_CLASS } from '@theia/core/lib/browser';
import { TreeElement } from '@theia/core/lib/browser/source-tree';
import { DebugSession } from '../debug-session';
import { BaseBreakpoint } from '../breakpoint/breakpoint-marker';
import { BreakpointManager } from '../breakpoint/breakpoint-manager';

export class DebugBreakpointData {
    readonly raw?: DebugProtocol.Breakpoint;
}

export class DebugBreakpointOptions {
    readonly labelProvider: LabelProvider;
    readonly breakpoints: BreakpointManager;
    readonly editorManager: EditorManager;
    readonly session?: DebugSession;
}

export class DebugBreakpointDecoration {
    readonly className: string;
    readonly message: string[];
}

export abstract class DebugBreakpoint<T extends BaseBreakpoint = BaseBreakpoint> extends DebugBreakpointOptions implements TreeElement {

    readonly raw?: DebugProtocol.Breakpoint;

    constructor(
        readonly uri: URI,
        options: DebugBreakpointOptions
    ) {
        super();
        Object.assign(this, options);
    }

    abstract get origin(): T;

    update(data: DebugBreakpointData): void {
        Object.assign(this, data);
    }

    get idFromAdapter(): number | undefined {
        return this.raw && this.raw.id;
    }

    get id(): string {
        return this.origin.id;
    }

    get enabled(): boolean {
        return this.breakpoints.breakpointsEnabled && this.origin.enabled;
    }

    get installed(): boolean {
        return !!this.raw;
    }

    get verified(): boolean {
        return !!this.raw ? this.raw.verified : true;
    }

    get message(): string {
        return this.raw && this.raw.message || '';
    }

    abstract setEnabled(enabled: boolean): void;

    abstract remove(): void;

    protected readonly setBreakpointEnabled = (event: React.ChangeEvent<HTMLInputElement>) => {
        this.setEnabled(event.target.checked);
    };

    render(): React.ReactNode {
        const classNames = ['theia-source-breakpoint'];
        if (!this.isEnabled()) {
            classNames.push(DISABLED_CLASS);
        }
        const decoration = this.getDecoration();
        return <div title={decoration.message.join('\n')} className={classNames.join(' ')}>
            <span className={'theia-debug-breakpoint-icon codicon ' + decoration.className} />
            <input className='theia-input' type='checkbox' checked={this.origin.enabled} onChange={this.setBreakpointEnabled} />
            {this.doRender()}
        </div>;
    }

    protected isEnabled(): boolean {
        return this.breakpoints.breakpointsEnabled && this.verified;
    }

    protected abstract doRender(): React.ReactNode;

    getDecoration(): DebugBreakpointDecoration {
        if (!this.enabled) {
            return this.getDisabledBreakpointDecoration();
        }
        if (this.installed && !this.verified) {
            return this.getUnverifiedBreakpointDecoration();
        }
        return this.doGetDecoration();
    }

    protected getUnverifiedBreakpointDecoration(): DebugBreakpointDecoration {
        const decoration = this.getBreakpointDecoration();
        return {
            className: decoration.className + '-unverified',
            message: [this.message || 'Unverified ' + decoration.message[0]]
        };
    }

    protected getDisabledBreakpointDecoration(message?: string): DebugBreakpointDecoration {
        const decoration = this.getBreakpointDecoration();
        return {
            className: decoration.className + '-disabled',
            message: [message || ('Disabled ' + decoration.message[0])]
        };
    }

    protected doGetDecoration(messages: string[] = []): DebugBreakpointDecoration {
        if (this.message) {
            if (messages.length) {
                messages[messages.length - 1].concat(', ' + this.message);
            } else {
                messages.push(this.message);
            }
        }
        return this.getBreakpointDecoration(messages);
    }

    protected abstract getBreakpointDecoration(message?: string[]): DebugBreakpointDecoration;

}
