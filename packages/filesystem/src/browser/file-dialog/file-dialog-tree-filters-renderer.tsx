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

import { ReactRenderer } from '@theia/core/lib/browser/widgets/react-renderer';
import { FileDialogTree } from './file-dialog-tree';
import * as React from 'react';
import { FileDialogTreeAllFilesPosition, FileDialogProps } from './file-dialog';

export const FILE_TREE_FILTERS_LIST_CLASS = 'theia-FileTreeFiltersList';

/**
 * A set of file filters that are used by the dialog. Each entry is a human readable label,
 * like "TypeScript", and an array of extensions, e.g.
 * ```ts
 * {
 * 	'Images': ['png', 'jpg']
 * 	'TypeScript': ['ts', 'tsx']
 * }
 * ```
 */
export class FileDialogTreeFilters {
    [name: string]: string[];
}

export class FileDialogTreeFiltersRenderer extends ReactRenderer {

    constructor(
        readonly filters: FileDialogTreeFilters,
        readonly fileDialogTree: FileDialogTree,
        readonly fileDialogOptions?: FileDialogProps
    ) {
        super();
    }

    protected readonly handleFilterChanged = (e: React.ChangeEvent<HTMLSelectElement>) => this.onFilterChanged(e);

    protected doRender(): React.ReactNode {
        if (!this.filters) {
            return undefined;
        }

        const isAllFilePositionDefined = this.fileDialogOptions !== undefined && this.fileDialogOptions.allFilesPosition !== undefined;
        const allFilesPosition = isAllFilePositionDefined ? this.fileDialogOptions!.allFilesPosition : FileDialogTreeAllFilesPosition.FIRST;
        const allFilesElement = 'All Files';
        const fileTypes: string[] = [];
        if (allFilesPosition === FileDialogTreeAllFilesPosition.FIRST) {
            fileTypes.push(allFilesElement);
        }
        Object.keys(this.filters).forEach(element => {
            fileTypes.push(element);
        });
        if (allFilesPosition === FileDialogTreeAllFilesPosition.LAST) {
            fileTypes.push(allFilesElement);
        }

        const options = fileTypes.map(value => this.renderLocation(value));
        return <select className={'theia-select ' + FILE_TREE_FILTERS_LIST_CLASS} onChange={this.handleFilterChanged}>{...options}</select>;
    }

    protected renderLocation(value: string): React.ReactNode {
        return <option value={value} key={value}>{value}</option>;
    }

    protected onFilterChanged(e: React.ChangeEvent<HTMLSelectElement>): void {
        const locationList = this.locationList;
        if (locationList) {
            const value = locationList.value;
            const filters = this.filters[value];
            this.fileDialogTree.setFilter(filters);
        }

        e.preventDefault();
        e.stopPropagation();
    }

    get locationList(): HTMLSelectElement | undefined {
        const locationList = this.host.getElementsByClassName(FILE_TREE_FILTERS_LIST_CLASS)[0];
        if (locationList instanceof HTMLSelectElement) {
            return locationList;
        }
        return undefined;
    }

}
