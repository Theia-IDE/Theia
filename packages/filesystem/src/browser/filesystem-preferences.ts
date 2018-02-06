/*
 * Copyright (C) 2017-2018 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { interfaces } from "inversify";
import {
    createPreferenceProxy,
    PreferenceProxy,
    PreferenceService,
    PreferenceSchema,
    PreferenceContribution,
    Configuration
} from '@theia/preferences-api';

export const filesystemPreferenceSchema: PreferenceSchema = {
    "type": "object",
    "properties": {
        "files.watcherExclude": {
            "default": {
                "**/.git/objects/**": true,
                "**/.git/subtree-cache/**": true,
                "**/node_modules/**": true
            },
            "description": "List of paths to exclude from the filesystem watcher",
            "additionalProperties": {
                "type": "boolean"
            }
        }
    }
};

export const FileSystemPreferences = Symbol('FileSystemPreferences');
export type FileSystemPreferences = PreferenceProxy<Configuration>;

export function createFileSystemPreferences(preferences: PreferenceService): FileSystemPreferences {
    return createPreferenceProxy(preferences, filesystemPreferenceSchema);
}

export function bindFileSystemPreferences(bind: interfaces.Bind): void {
    bind(FileSystemPreferences).toDynamicValue(ctx => {
        const preferences = ctx.container.get<PreferenceService>(PreferenceService);
        return createFileSystemPreferences(preferences);
    }).inSingletonScope();

    bind(PreferenceContribution).toConstantValue({ schema: filesystemPreferenceSchema });
}
