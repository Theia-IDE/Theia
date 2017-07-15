/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import * as paths from 'path';
import * as process from 'process';
import * as cp from 'child_process';
import BaseGenerator = require('yeoman-generator');

import { Model } from "./generator-model";

export const NPM = require('check-if-windows') ? 'npm.cmd' : 'npm';

export abstract class AbstractAppGenerator extends BaseGenerator {

    protected readonly model = new Model();

    initializing(prefix = 'theia', defaults: object = this.model.config): void {
        this.model.pck = this.fs.readJSON(`${prefix}.package.json`) || {};
        this.config.defaults(defaults);
        Object.assign(this.model.config, this.config.getAll());
    }

    configuring(): void {
        this.model.readLocalExtensionPackages((extension, path) => {
            const extensionPath = paths.join(process.cwd(), `${path}/package.json`);
            return this.fs.readJSON(extensionPath, undefined);
        })
        this.model.readExtensionPackages((extension, version) => {
            return JSON.parse(cp.execSync([NPM, 'view', `${extension}@${version}`, '--json'].join(' '), {
                encoding: 'utf8'
            }));
        });
    }

}