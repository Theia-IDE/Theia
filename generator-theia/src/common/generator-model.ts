/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import * as path from 'path';

export interface NodePackage {
    dependencies?: Dependencies;
    [property: string]: any;
}

export interface TheiaNodePackage {
    name: string;
    theiaExtensions?: Extension[];
}

export interface Extension {
    frontend?: string;
    frontendElectron?: string;
    backend?: string;
    backendElectron?: string;
}

export interface Dependencies {
    [name: string]: string
}

export interface Config {
    copyright: string;
    node_modulesPath: string;
    localDependencies?: Dependencies;
}

export interface ExtensionConfig {
    testSupport: boolean;
    extensionKeyword: string;
}

export function sortByKey(object: { [key: string]: any }): { [key: string]: any } {
    return Object.keys(object).sort().reduce((sorted, key) => {
        sorted[key] = object[key];
        return sorted;
    }, {});
}

export const defaultExtensionKeyword = "theia-extension";

export class Model {
    target: 'web' | 'electron-renderer' | undefined;
    pck: NodePackage = {};
    config: Config = {
        copyright: '',
        node_modulesPath: "./node_modules"
    };
    readonly defaultExtensionConfig = <ExtensionConfig>{
        testSupport: true
    };
    extensionConfig: ExtensionConfig = {
        ...this.defaultExtensionConfig,
        extensionKeyword: defaultExtensionKeyword
    };

    protected _frontendModules: Map<string, string> | undefined;
    protected _frontendElectronModules: Map<string, string> | undefined;
    protected _backendModules: Map<string, string> | undefined;
    protected _backendElectronModules: Map<string, string> | undefined;
    protected readonly extensionPackages = new Map<string, TheiaNodePackage>();

    get allExtensions(): string[] {
        return this.pck.dependencies ? Object.keys(this.pck.dependencies) : [];
    }

    readExtensionPackages(read: (extension: string, version: string) => TheiaNodePackage | undefined): void {
        if (!this.pck.dependencies) {
            return;
        }
        // tslint:disable-next-line:forin
        for (const extension in this.pck.dependencies) {
            const version = this.pck.dependencies[extension];
            this.readExtensionPackage(extension, () => read(extension, version));
        }
    }

    readLocalExtensionPackages(read: (extension: string, path: string) => TheiaNodePackage | undefined): void {
        if (!this.config.localDependencies) {
            return;
        }
        // tslint:disable-next-line:forin
        for (const extension in this.config.localDependencies) {
            const path = this.config.localDependencies[extension];
            this.readExtensionPackage(extension, () => read(extension, path));
        }
    }

    protected readExtensionPackage(extension: string, read: () => TheiaNodePackage | undefined): void {
        if (!this.extensionPackages.has(extension)) {
            const extensionPackage: TheiaNodePackage | undefined = read();
            if (extensionPackage) {
                this.extensionPackages.set(extension, extensionPackage);
            }
        }
    }

    get frontendModules(): Map<string, string> {
        if (!this._frontendModules) {
            this._frontendModules = this.computeModules('frontend');
        }
        return this._frontendModules;
    }

    get frontendElectronModules(): Map<string, string> {
        if (!this._frontendElectronModules) {
            this._frontendElectronModules = this.computeModules('frontendElectron', 'frontend');
        }
        return this._frontendElectronModules;
    }

    get backendModules(): Map<string, string> {
        if (!this._backendModules) {
            this._backendModules = this.computeModules('backend');
        }
        return this._backendModules;
    }

    get backendElectronModules(): Map<string, string> {
        if (!this._backendElectronModules) {
            this._backendElectronModules = this.computeModules('backendElectron', 'backend');
        }
        return this._backendElectronModules;
    }

    protected computeModules<P extends keyof Extension, S extends keyof Extension = P>(primary: P, secondary?: S): Map<string, string> {
        const result = new Map<string, string>();
        let moduleIndex = 1;
        for (const extensionPackage of this.extensionPackages.values()) {
            const extensions = extensionPackage.theiaExtensions;
            if (extensions) {
                for (const extension of extensions) {
                    const modulePath = extension[primary] || (secondary && extension[secondary]);
                    if (typeof modulePath === 'string') {
                        const extensionPath = path.join(extensionPackage.name, modulePath).split(path.sep).join('/');
                        result.set(`${primary}_${moduleIndex}`, extensionPath);
                        moduleIndex = moduleIndex + 1;
                    }
                }
            }
        }
        return result;
    }

}
