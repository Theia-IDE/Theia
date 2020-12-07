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

import { Disposable } from '@theia/core';
import { Repository } from '@theia/git/lib/common/git-model';

/**
 * The WS endpoint path to the Git service.
 */
export const GitNativePath = '/services/git-native';

/**
 * Git symbol for DI.
 */
export const GitNative = Symbol('GitNative');

export namespace GitNative {

    /**
     * Options for various Git commands.
     */
    export namespace Options {

        /**
         * Git repositories options.
         */
        export interface Repositories {

            /**
             * The maximum count of repositories to look up, should be greater than 0.
             * Undefined to look up all repositories.
             */
            readonly maxCount?: number;

        }

    }
}

/**
 * Provides basic functionality for Git.
 */
export interface GitNative extends Disposable {

    /**
     * Resolves to an array of repositories discovered in the workspace given with the workspace root URI.
     */
    repositories(workspaceRootUri: string, options: GitNative.Options.Repositories): Promise<Repository[]>;

}
