/********************************************************************************
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

import { promises as fs } from 'fs';
import { EOL } from 'os';

interface PluginDownloadInfo {
    /**
     * URL where to download this plugins
     */
    resolved: string;
    /**
     * Subresource integrity hash of the plugin data
     */
    integrity: string;
}

interface PluginDownloadInfoMapping { [key: string]: PluginDownloadInfo };

/**
 * Lock file with plugin integrity
 */
export class PluginLockFile {
    private filePath: string;
    private lockMapping: PluginDownloadInfoMapping;

    /**
     * True if lock was modified
     */
    dirty: boolean;

    /**
     * Create a lock file.
     * @param filePath path of the lock file
     */
    constructor(filePath: string) {
        this.filePath = filePath;
        this.lockMapping = {};
        this.dirty = false;
    }

    /**
     * Read the lock file if file exists.
     */
    async load(): Promise<void> {
        if (await fs.stat(this.filePath).then(() => true, () => false)) {
            this.lockMapping = JSON.parse(await fs.readFile(this.filePath, 'utf-8'));
        }
        this.dirty = false;
    }

    /**
     * Save the lock file.
     */
    async save(): Promise<void> {
        const pluginResolvedSorted: PluginDownloadInfoMapping = {};
        // Sort json keys
        Object.keys(this.lockMapping).sort().forEach(element => {
            pluginResolvedSorted[element] = this.lockMapping[element];
        });
        await fs.writeFile(
            this.filePath,
            // Normalize end of lines for windows
            JSON.stringify(pluginResolvedSorted, undefined, 4).replace(/\n/g, EOL),
        );
        this.dirty = false;
    }

    getDownloadInfo(pluginSpec: string): PluginDownloadInfo {
        return this.lockMapping[pluginSpec];
    }

    setDownloadInfo(pluginSpec: string, pluginLock: PluginDownloadInfo): void {
        if (this.lockMapping[pluginSpec] !== undefined) {
            throw new Error(`lock for ${pluginSpec} already exist`);
        }
        this.lockMapping[pluginSpec] = pluginLock;
        this.dirty = true;
    }
}
