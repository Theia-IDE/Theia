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
import { interfaces, injectable } from 'inversify';
import { RPCProtocol } from '@theia/plugin-ext/lib/common/rpc-protocol';
import { MainPluginApiProvider } from '@theia/plugin-ext/lib/common';
import { TheiaAPIInitParameters } from '@theia/plugin-ext/lib/plugin/plugin-context';
import { TheiaMainPluginAPIProvider } from '@theia/plugin-ext/lib/main/browser/theia-main-plugin-api-provider';

@injectable()
export class VSCodeMainPluginAPIProvider implements MainPluginApiProvider {
    readonly id: string = 'vscode';

    initialize(rpc: RPCProtocol, container: interfaces.Container): void {
        // main API will be set up by theia
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async computeInitParameters?(rpc: RPCProtocol, container: interfaces.Container): Promise<TheiaAPIInitParameters> {
        const theiaMainPluginAPIProvider: TheiaMainPluginAPIProvider = container.get(TheiaMainPluginAPIProvider);
        return theiaMainPluginAPIProvider.computeInitParameters!(rpc, container);
    }
}
