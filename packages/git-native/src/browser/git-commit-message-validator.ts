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

import { injectable } from 'inversify';
import { MaybePromise } from '@theia/core/lib/common/types';

@injectable()
export class GitCommitMessageValidator {

    static readonly MAX_CHARS_PER_LINE = 72;

    /**
     * Validates the input and returns with either a validation result with the status and message, or `undefined` if everything went fine.
     */
    validate(input: string | undefined): MaybePromise<GitCommitMessageValidator.Result | undefined> {
        if (input) {
            const lines = input.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const result = this.isLineValid(line, i);
                if (!!result) {
                    return result;
                }
            }
        }
        return undefined;
    }

    protected isLineValid(line: string, index: number): GitCommitMessageValidator.Result | undefined {
        if (index === 1 && line.length !== 0) {
            return {
                status: 'warning',
                message: 'The second line should be empty to separate the commit message from the body'
            };
        }
        const diff = line.length - this.maxCharsPerLine();
        if (diff > 0) {
            return {
                status: 'warning',
                message: `${diff} characters over ${this.maxCharsPerLine()} in current line`
            };
        }
        return undefined;
    }

    protected maxCharsPerLine(): number {
        return GitCommitMessageValidator.MAX_CHARS_PER_LINE;
    }

}

export namespace GitCommitMessageValidator {

    /**
     * Type for the validation result with a status and a corresponding message.
     */
    export type Result = Readonly<{ message: string, status: 'info' | 'success' | 'warning' | 'error' }>;

    export namespace Result {

        /**
         * `true` if the `message` and the `status` properties are the same on both `left` and `right`. Or both arguments are `undefined`. Otherwise, `false`.
         */
        export function equal(left: Result | undefined, right: Result | undefined): boolean {
            if (left && right) {
                return left.message === right.message && left.status === right.status;
            }
            return left === right;
        }

    }

}
