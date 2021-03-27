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

import * as React from 'react';
import { DISABLED_CLASS } from '@theia/core/lib/browser';

export class DebugAction extends React.Component<DebugAction.Props> {

    render(): React.ReactNode {
        const { enabled, label, iconClass } = this.props;
        const classNames = ['debug-action', 'codicon', 'codicon-' + iconClass];
        if (enabled === false) {
            classNames.push(DISABLED_CLASS);
        }
        return <span tabIndex={0}
            className={classNames.join(' ')}
            title={label}
            onClick={this.props.run}
            ref={this.setRef} />;
    }

    focus(): void {
        if (this.ref) {
            this.ref.focus();
        }
    }

    protected ref: HTMLElement | undefined;
    protected setRef = (ref: HTMLElement | null) => this.ref = ref || undefined;

}
export namespace DebugAction {
    export interface Props {
        label: string
        iconClass: string
        run: () => void
        enabled?: boolean
    }
}
