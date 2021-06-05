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

import type { BrowserWindowConstructorOptions } from 'electron';

export interface NpmRegistryProps {

    /**
     * Defaults to `false`.
     */
    readonly next: boolean;

    /**
     * Defaults to `https://registry.npmjs.org/`.
     */
    readonly registry: string;

}
export namespace NpmRegistryProps {
    export const DEFAULT: NpmRegistryProps = {
        next: false,
        registry: 'https://registry.npmjs.org/'
    };
}

/**
 * Representation of all backend and frontend related Theia extension and application properties.
 */
export interface ApplicationProps extends NpmRegistryProps {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly [key: string]: any;

    /**
     * Whether the extension targets the browser or electron. Defaults to `browser`.
     */
    readonly target: ApplicationProps.Target;

    /**
     * Frontend related properties.
     */
    readonly frontend: Readonly<{ config: FrontendApplicationConfig }>;

    /**
     * Backend specific properties.
     */
    readonly backend: Readonly<{ config: BackendApplicationConfig }>;

    /**
     * Generator specific properties.
     */
    readonly generator: Readonly<{ config: GeneratorConfig }>;
}
export namespace ApplicationProps {
    export enum ApplicationTarget {
        browser = 'browser',
        electron = 'electron'
    };

    export type Target = keyof typeof ApplicationTarget;

    export const DEFAULT: ApplicationProps = {
        ...NpmRegistryProps.DEFAULT,
        target: 'browser',
        backend: {
            config: {}
        },
        frontend: {
            config: {
                applicationName: 'Eclipse Theia',
                defaultTheme: 'dark',
                defaultIconTheme: 'none',
                defaultProductIconTheme: 'default'
            }
        },
        generator: {
            config: {
                preloadTemplate: ''
            }
        }
    };

}

/**
 * Base configuration for the Theia application.
 */
export interface ApplicationConfig {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly [key: string]: any;
}

/**
 * Application configuration for the frontend. The following properties will be injected into the `index.html`.
 */
export interface FrontendApplicationConfig extends ApplicationConfig {

    /**
     * The default theme for the application. If not given, defaults to `dark`. If invalid theme is given, also defaults to `dark`.
     */
    readonly defaultTheme: string;

    /**
     * The default icon theme for the application. If not given, defaults to `none`. If invalid theme is given, also defaults to `none`.
     */
    readonly defaultIconTheme: string;

    /**
     * The default product icon theme for the application. If not given, defaults to standard icons. If invalid theme is given, also defaults to standard icons.
     */
    readonly defaultProductIconTheme: string

    /**
     * The name of the application. `Eclipse Theia` by default.
     */
    readonly applicationName: string;

    /**
     * Electron specific configuration.
     */
    readonly electron?: Readonly<ElectronFrontendApplicationConfig>;
}

export interface ElectronFrontendApplicationConfig {

    /**
     * If set to `true`, reloading the current browser window won't be possible with the `Ctrl/Cmd + R` keybinding.
     * It is `false` by default. Has no effect if not in an electron environment.
     */
    readonly disallowReloadKeybinding?: boolean;

    /**
     * Override or add properties to the electron `windowOptions`.
     */
    readonly windowOptions?: BrowserWindowConstructorOptions;
}

/**
 * Application configuration for the backend.
 */
export interface BackendApplicationConfig extends ApplicationConfig {

    /**
     * If true and in Electron mode, only one instance of the application is allowed to run at a time.
     */
    singleInstance?: boolean;

}

/**
 * Configuration for the generator.
 */
export interface GeneratorConfig {

    /**
     * Template to use for extra preload content markup (file path or HTML)
     */
    readonly preloadTemplate: string;

}
