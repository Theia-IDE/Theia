/********************************************************************************
 * Copyright (C) 2019 RedHat and others.
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
import { ClipboardMain, PLUGIN_RPC_CONTEXT } from '../../common';
import { ClipboardService } from '@theia/core/lib/browser/clipboard-service';
import { RPCProtocolServiceProvider } from './main-context';
import { ProxyIdentifier } from '../../common/rpc-protocol';

@injectable()
export class ClipboardMainImpl implements ClipboardMain, RPCProtocolServiceProvider {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identifier: ProxyIdentifier<any> = PLUGIN_RPC_CONTEXT.CLIPBOARD_MAIN;

    @inject(ClipboardService)
    protected readonly clipboardService: ClipboardService;

    async $readText(): Promise<string> {
        const result = await this.clipboardService.readText();
        return result;
    }

    async $writeText(value: string): Promise<void> {
        await this.clipboardService.writeText(value);
    }

}
