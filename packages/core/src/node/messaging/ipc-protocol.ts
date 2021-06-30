
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

import { MessageConnection } from 'vscode-ws-jsonrpc';

const THEIA_PARENT_PID = 'THEIA_PARENT_PID';
const THEIA_ENTRY_POINT = 'THEIA_ENTRY_POINT';
const THEIA_ENV_REGEXP_EXCLUSION = new RegExp('^THEIA_*');

export const ipcEntryPoint: string | undefined = process.env[THEIA_ENTRY_POINT];

export type IPCEntryPoint = (connection: MessageConnection) => void;
export namespace IPCEntryPoint {
    /**
     * Throws if `THEIA_ENTRY_POINT` is undefined or empty.
     */
    export function getScriptFromEnv(): string {
        if (!ipcEntryPoint) {
            throw new Error(`"${THEIA_ENTRY_POINT}" is missing from the environment`);
        }
        return ipcEntryPoint;
    }
}

/**
 * Exit the current process if the parent process is not alive.
 * Relevant only for some OS, like Windows
 */
export function checkParentAlive(): void {
    if (process.env[THEIA_PARENT_PID]) {
        const parentPid = Number(process.env[THEIA_PARENT_PID]);

        if (typeof parentPid === 'number' && !isNaN(parentPid)) {
            setInterval(() => {
                try {
                    // throws an exception if the main process doesn't exist anymore.
                    process.kill(parentPid, 0);
                } catch {
                    process.exit();
                }
            }, 5000);
        }
    }
}

export function createIpcEnv(options?: {
    entryPoint?: string
    env?: NodeJS.ProcessEnv
}): NodeJS.ProcessEnv {
    const op = Object.assign({}, options);
    const childEnv = Object.assign({}, op.env);

    for (const key of Object.keys(childEnv)) {
        if (THEIA_ENV_REGEXP_EXCLUSION.test(key)) {
            delete childEnv[key];
        }
    }

    childEnv[THEIA_PARENT_PID] = String(process.pid);
    childEnv[THEIA_ENTRY_POINT] = op.entryPoint;

    return childEnv;
}
