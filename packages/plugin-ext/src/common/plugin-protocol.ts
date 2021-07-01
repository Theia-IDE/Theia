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
import { JsonRpcServer } from '@theia/core/lib/common/messaging/proxy-factory';
import { RPCProtocol } from './rpc-protocol';
import { Disposable } from '@theia/core/lib/common/disposable';
import { LogPart, KeysToAnyValues, KeysToKeysToAnyValue } from './types';
import { CharacterPair, CommentRule, PluginAPIFactory, Plugin } from './plugin-api-rpc';
import { ExtPluginApi } from './plugin-ext-api-contribution';
import { IJSONSchema, IJSONSchemaSnippet } from '@theia/core/lib/common/json-schema';
import { RecursivePartial } from '@theia/core/lib/common/types';
import { PreferenceSchema, PreferenceSchemaProperties } from '@theia/core/lib/common/preferences/preference-schema';
import { ProblemMatcherContribution, ProblemPatternContribution, TaskDefinition } from '@theia/task/lib/common';
import { ColorDefinition } from '@theia/core/lib/browser/color-registry';
import { ResourceLabelFormatter } from '@theia/core/lib/common/label-protocol';

export const hostedServicePath = '/services/hostedPlugin';

/**
 * Plugin engine (API) type, i.e. 'theiaPlugin', 'vscode', etc.
 */
export type PluginEngine = string;

/**
 * This interface describes a package.json object.
 */
export interface PluginPackage {
    name: string;
    publisher: string;
    version: string;
    engines: {
        [type in PluginEngine]: string;
    };
    theiaPlugin?: {
        frontend?: string;
        backend?: string;
    };
    main?: string;
    displayName: string;
    description: string;
    contributes?: PluginPackageContribution;
    packagePath: string;
    activationEvents?: string[];
    extensionDependencies?: string[];
    extensionPack?: string[];
    icon?: string;
}
export namespace PluginPackage {
    export function toPluginUrl(pck: PluginPackage | PluginModel, relativePath: string): string {
        return `hostedPlugin/${getPluginId(pck)}/${encodeURIComponent(relativePath)}`;
    }
}

/**
 * This interface describes a package.json contribution section object.
 */
export interface PluginPackageContribution {
    configuration?: RecursivePartial<PreferenceSchema> | RecursivePartial<PreferenceSchema>[];
    configurationDefaults?: RecursivePartial<PreferenceSchemaProperties>;
    languages?: PluginPackageLanguageContribution[];
    grammars?: PluginPackageGrammarsContribution[];
    customEditors?: PluginPackageCustomEditor[];
    viewsContainers?: { [location: string]: PluginPackageViewContainer[] };
    views?: { [location: string]: PluginPackageView[] };
    viewsWelcome?: PluginPackageViewWelcome[];
    commands?: PluginPackageCommand | PluginPackageCommand[];
    menus?: { [location: string]: PluginPackageMenu[] };
    submenus?: PluginPackageSubmenu[];
    keybindings?: PluginPackageKeybinding | PluginPackageKeybinding[];
    debuggers?: PluginPackageDebuggersContribution[];
    snippets?: PluginPackageSnippetsContribution[];
    themes?: PluginThemeContribution[];
    iconThemes?: PluginIconThemeContribution[];
    colors?: PluginColorContribution[];
    taskDefinitions?: PluginTaskDefinitionContribution[];
    problemMatchers?: PluginProblemMatcherContribution[];
    problemPatterns?: PluginProblemPatternContribution[];
    jsonValidation?: PluginJsonValidationContribution[];
    resourceLabelFormatters?: ResourceLabelFormatter[];
}

export interface PluginPackageCustomEditor {
    viewType: string;
    displayName: string;
    selector?: CustomEditorSelector[];
    priority?: CustomEditorPriority;
}

export interface CustomEditorSelector {
    readonly filenamePattern?: string;
}

export enum CustomEditorPriority {
    default = 'default',
    builtin = 'builtin',
    option = 'option',
}

export interface PluginPackageViewContainer {
    id: string;
    title: string;
    icon: string;
}

export interface PluginPackageView {
    id: string;
    name: string;
    when?: string;
}

export interface PluginPackageViewWelcome {
    view: string;
    contents: string;
    when?: string;
}

export interface PluginPackageCommand {
    command: string;
    title: string;
    category?: string;
    icon?: string | { light: string; dark: string; };
    enablement?: string;
}

export interface PluginPackageMenu {
    command?: string;
    submenu?: string;
    alt?: string;
    group?: string;
    when?: string;
}

export interface PluginPackageSubmenu {
    id: string;
    label: string;
}

export interface PluginPackageKeybinding {
    key?: string;
    command: string;
    when?: string;
    mac?: string;
    linux?: string;
    win?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args?: any;
}

export interface PluginPackageGrammarsContribution {
    language?: string;
    scopeName: string;
    path: string;
    embeddedLanguages?: ScopeMap;
    tokenTypes?: ScopeMap;
    injectTo?: string[];
}

export interface ScopeMap {
    [scopeName: string]: string;
}

export interface PluginPackageSnippetsContribution {
    language?: string;
    path?: string;
}

export interface PluginColorContribution {
    id?: string;
    description?: string;
    defaults?: { light?: string, dark?: string, highContrast?: string };
}

export type PluginUiTheme = 'vs' | 'vs-dark' | 'hc-black';

export interface PluginThemeContribution {
    id?: string;
    label?: string;
    description?: string;
    path?: string;
    uiTheme?: PluginUiTheme;
}

export interface PluginIconThemeContribution {
    id?: string;
    label?: string;
    description?: string;
    path?: string;
    uiTheme?: PluginUiTheme;
}

export interface PlatformSpecificAdapterContribution {
    program?: string;
    args?: string[];
    runtime?: string;
    runtimeArgs?: string[];
}

/**
 * This interface describes a package.json debuggers contribution section object.
 */
export interface PluginPackageDebuggersContribution extends PlatformSpecificAdapterContribution {
    type: string;
    label?: string;
    languages?: string[];
    enableBreakpointsFor?: { languageIds: string[] };
    configurationAttributes: { [request: string]: IJSONSchema };
    configurationSnippets: IJSONSchemaSnippet[];
    variables?: ScopeMap;
    adapterExecutableCommand?: string;
    win?: PlatformSpecificAdapterContribution;
    winx86?: PlatformSpecificAdapterContribution;
    windows?: PlatformSpecificAdapterContribution;
    osx?: PlatformSpecificAdapterContribution;
    linux?: PlatformSpecificAdapterContribution;
}

/**
 * This interface describes a package.json languages contribution section object.
 */
export interface PluginPackageLanguageContribution {
    id: string;
    extensions?: string[];
    filenames?: string[];
    filenamePatterns?: string[];
    firstLine?: string;
    aliases?: string[];
    mimetypes?: string[];
    configuration?: string;
}

export interface PluginPackageLanguageContributionConfiguration {
    comments?: CommentRule;
    brackets?: CharacterPair[];
    autoClosingPairs?: (CharacterPair | AutoClosingPairConditional)[];
    surroundingPairs?: (CharacterPair | AutoClosingPair)[];
    wordPattern?: string;
    indentationRules?: IndentationRules;
    folding?: FoldingRules;
}

export interface PluginTaskDefinitionContribution {
    type: string;
    required: string[];
    properties?: {
        [name: string]: {
            type: string;
            description?: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [additionalProperty: string]: any;
        }
    }
}

export interface PluginProblemMatcherContribution extends ProblemMatcherContribution {
    name: string;
}

export interface PluginProblemPatternContribution extends ProblemPatternContribution {
    name: string;
}

export interface PluginJsonValidationContribution {
    fileMatch: string | string[];
    url: string;
}

export const PluginScanner = Symbol('PluginScanner');
/**
 * This scanner process package.json object and returns plugin metadata objects.
 */
export interface PluginScanner {
    /**
     * The type of plugin's API (engine name)
     */
    apiType: PluginEngine;

    /**
     * Creates plugin's model.
     *
     * @param {PluginPackage} plugin
     * @returns {PluginModel}
     */
    getModel(plugin: PluginPackage): PluginModel;

    /**
     * Creates plugin's lifecycle.
     *
     * @returns {PluginLifecycle}
     */
    getLifecycle(plugin: PluginPackage): PluginLifecycle;

    getContribution(plugin: PluginPackage): PluginContribution | undefined;

    /**
     * A mapping between a dependency as its defined in package.json
     * and its deployable form, e.g. `publisher.name` -> `vscode:extension/publisher.name`
     */
    getDependencies(plugin: PluginPackage): Map<string, string> | undefined;
}

/**
 * A plugin resolver is handling how to resolve a plugin link into a local resource.
 */
export const PluginDeployerResolver = Symbol('PluginDeployerResolver');
/**
 * A resolver handle a set of resource
 */
export interface PluginDeployerResolver {

    init?(pluginDeployerResolverInit: PluginDeployerResolverInit): void;

    accept(pluginSourceId: string): boolean;

    resolve(pluginResolverContext: PluginDeployerResolverContext): Promise<void>;

}

export const PluginDeployerDirectoryHandler = Symbol('PluginDeployerDirectoryHandler');
export interface PluginDeployerDirectoryHandler {
    accept(pluginDeployerEntry: PluginDeployerEntry): boolean;

    handle(context: PluginDeployerDirectoryHandlerContext): Promise<void>;
}

export const PluginDeployerFileHandler = Symbol('PluginDeployerFileHandler');
export interface PluginDeployerFileHandler {

    accept(pluginDeployerEntry: PluginDeployerEntry): boolean;

    handle(context: PluginDeployerFileHandlerContext): Promise<void>;
}

export interface PluginDeployerResolverInit {

}

export interface PluginDeployerResolverContext {

    addPlugin(pluginId: string, path: string): void;

    getPlugins(): PluginDeployerEntry[];

    getOriginId(): string;

}

export interface PluginDeployerStartContext {
    readonly userEntries: string[]
    readonly systemEntries: string[]
}

export const PluginDeployer = Symbol('PluginDeployer');
export interface PluginDeployer {

    start(): void;

}

export const PluginDeployerParticipant = Symbol('PluginDeployerParticipant');
/**
 * A participant can hook into the plugin deployer lifecycle.
 */
export interface PluginDeployerParticipant {
    onWillStart?(context: PluginDeployerStartContext): Promise<void>;
}

export enum PluginDeployerEntryType {

    FRONTEND,

    BACKEND
}

/**
 * Whether a plugin installed by a user or system.
 */
export enum PluginType {
    System,
    User
};

export interface PluginDeployerEntry {

    /**
     * ID (before any resolution)
     */
    id(): string;

    /**
     * Original resolved path
     */
    originalPath(): string;

    /**
     * Local path on the filesystem.
     */
    path(): string;

    /**
     * Get a specific entry
     */
    getValue<T>(key: string): T;

    /**
     * Store a value
     */
    storeValue<T>(key: string, value: T): void;

    /**
     * Update path
     */
    updatePath(newPath: string): void;

    getChanges(): string[];

    isFile(): boolean;

    isDirectory(): boolean;

    /**
     * Resolved if a resolver has handle this plugin
     */
    isResolved(): boolean;

    resolvedBy(): string;

    /**
     * Accepted when a handler is telling this location can go live
     */
    isAccepted(...types: PluginDeployerEntryType[]): boolean;

    accept(...types: PluginDeployerEntryType[]): void;

    hasError(): boolean;

    type: PluginType
    /**
     * A fs path to a directory where a plugin is located.
     * Depending on a plugin format it can be different from `path`.
     * Use `path` if you want to resolve something within a plugin, like `README.md` file.
     * Use `rootPath` if you want to manipulate the entire plugin location, like delete or move it.
     */
    rootPath: string
}

export interface PluginDeployerFileHandlerContext {

    unzip(sourcePath: string, destPath: string): Promise<void>;

    pluginEntry(): PluginDeployerEntry;

}

export interface PluginDeployerDirectoryHandlerContext {

    pluginEntry(): PluginDeployerEntry;

}

/**
 * This interface describes a plugin model object, which is populated from package.json.
 */
export interface PluginModel {
    id: string;
    name: string;
    publisher: string;
    version: string;
    displayName: string;
    description: string;
    engine: {
        type: PluginEngine;
        version: string;
    };
    entryPoint: PluginEntryPoint;
    packageUri: string;
    /**
     * @deprecated since 1.1.0 - because it lead to problems with getting a relative path
     * needed by Icon Themes to correctly load Fonts, use packageUri instead.
     */
    packagePath: string;
    iconUrl?: string;
    readmeUrl?: string;
    licenseUrl?: string;
}

export interface PluginEntryPoint {
    frontend?: string;
    backend?: string;
}

/**
 * This interface describes some static plugin contributions.
 */
export interface PluginContribution {
    activationEvents?: string[];
    configuration?: PreferenceSchema[];
    configurationDefaults?: PreferenceSchemaProperties;
    languages?: LanguageContribution[];
    grammars?: GrammarsContribution[];
    customEditors?: CustomEditor[];
    viewsContainers?: { [location: string]: ViewContainer[] };
    views?: { [location: string]: View[] };
    viewsWelcome?: ViewWelcome[];
    commands?: PluginCommand[]
    menus?: { [location: string]: Menu[] };
    submenus?: Submenu[];
    keybindings?: Keybinding[];
    debuggers?: DebuggerContribution[];
    snippets?: SnippetContribution[];
    themes?: ThemeContribution[];
    iconThemes?: IconThemeContribution[];
    colors?: ColorDefinition[];
    taskDefinitions?: TaskDefinition[];
    problemMatchers?: ProblemMatcherContribution[];
    problemPatterns?: ProblemPatternContribution[];
    resourceLabelFormatters?: ResourceLabelFormatter[];
}

export interface SnippetContribution {
    uri: string
    source: string
    language?: string
}

export type UiTheme = 'vs' | 'vs-dark' | 'hc-black';

export interface ThemeContribution {
    id?: string;
    label?: string;
    description?: string;
    uri: string;
    uiTheme?: UiTheme;
}

export interface IconThemeContribution {
    id: string;
    label?: string;
    description?: string;
    uri: string;
    uiTheme?: UiTheme;
}

export interface GrammarsContribution {
    format: 'json' | 'plist';
    language?: string;
    scope: string;
    grammar?: string | object;
    grammarLocation?: string;
    embeddedLanguages?: ScopeMap;
    tokenTypes?: ScopeMap;
    injectTo?: string[];
}

/**
 * The language contribution
 */
export interface LanguageContribution {
    id: string;
    extensions?: string[];
    filenames?: string[];
    filenamePatterns?: string[];
    firstLine?: string;
    aliases?: string[];
    mimetypes?: string[];
    configuration?: LanguageConfiguration;
}

export interface LanguageConfiguration {
    brackets?: CharacterPair[];
    indentationRules?: IndentationRules;
    surroundingPairs?: AutoClosingPair[];
    autoClosingPairs?: AutoClosingPairConditional[];
    comments?: CommentRule;
    folding?: FoldingRules;
    wordPattern?: string;
}

/**
 * This interface describes a package.json debuggers contribution section object.
 */
export interface DebuggerContribution extends PlatformSpecificAdapterContribution {
    type: string,
    label?: string,
    languages?: string[],
    enableBreakpointsFor?: {
        languageIds: string[]
    },
    configurationAttributes?: IJSONSchema[],
    configurationSnippets?: IJSONSchemaSnippet[],
    variables?: ScopeMap,
    adapterExecutableCommand?: string
    win?: PlatformSpecificAdapterContribution;
    winx86?: PlatformSpecificAdapterContribution;
    windows?: PlatformSpecificAdapterContribution;
    osx?: PlatformSpecificAdapterContribution;
    linux?: PlatformSpecificAdapterContribution;
}

export interface IndentationRules {
    increaseIndentPattern: string;
    decreaseIndentPattern: string;
    unIndentedLinePattern?: string;
    indentNextLinePattern?: string;
}
export interface AutoClosingPair {
    close: string;
    open: string;
}

export interface AutoClosingPairConditional extends AutoClosingPair {
    notIn?: string[];
}

export interface FoldingMarkers {
    start: string;
    end: string;
}

export interface FoldingRules {
    offSide?: boolean;
    markers?: FoldingMarkers;
}

/**
 * Custom Editors contribution
 */
export interface CustomEditor {
    viewType: string;
    displayName: string;
    selector: CustomEditorSelector[];
    priority: CustomEditorPriority;
}

/**
 * Views Containers contribution
 */
export interface ViewContainer {
    id: string;
    title: string;
    iconUrl: string;
}

/**
 * View contribution
 */
export interface View {
    id: string;
    name: string;
    when?: string;
}

/**
 * View Welcome contribution
 */
export interface ViewWelcome {
    view: string;
    content: string;
    when?: string;
    order: number;
}

export interface PluginCommand {
    command: string;
    title: string;
    category?: string;
    iconUrl?: IconUrl;
    themeIcon?: string;
    enablement?: string;
}

export type IconUrl = string | { light: string; dark: string; };

/**
 * Menu contribution
 */
export interface Menu {
    command?: string;
    submenu?: string
    alt?: string;
    group?: string;
    when?: string;
}

export interface Submenu {
    id: string;
    label: string;
}

/**
 * Keybinding contribution
 */
export interface Keybinding {
    keybinding?: string;
    command: string;
    when?: string;
    mac?: string;
    linux?: string;
    win?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args?: any;
}

/**
 * This interface describes a plugin lifecycle object.
 */
export interface PluginLifecycle {
    startMethod: string;
    stopMethod: string;
    /**
     * Frontend module name, frontend plugin should expose this name.
     */
    frontendModuleName?: string;
    /**
     * Path to the script which should do some initialization before frontend plugin is loaded.
     */
    frontendInitPath?: string;
    /**
     * Path to the script which should do some initialization before backend plugin is loaded.
     */
    backendInitPath?: string;
}

/**
 * The export function of initialization module of backend plugin.
 */
export interface BackendInitializationFn {
    (apiFactory: PluginAPIFactory, plugin: Plugin): void;
}

export interface BackendLoadingFn {
    (rpc: RPCProtocol, plugin: Plugin): void;
}

export interface PluginContext {
    subscriptions: Disposable[];
}

export interface ExtensionContext {
    subscriptions: Disposable[];
}

export interface PluginMetadata {
    host: string;
    model: PluginModel;
    lifecycle: PluginLifecycle;
}

export const MetadataProcessor = Symbol('MetadataProcessor');
export interface MetadataProcessor {
    process(pluginMetadata: PluginMetadata): void;
}

export function getPluginId(plugin: PluginPackage | PluginModel): string {
    return `${plugin.publisher}_${plugin.name}`.replace(/\W/g, '_');
}

export function buildFrontendModuleName(plugin: PluginPackage | PluginModel): string {
    return `${plugin.publisher}_${plugin.name}`.replace(/\W/g, '_');
}

export const HostedPluginClient = Symbol('HostedPluginClient');
export interface HostedPluginClient {
    postMessage(pluginHost: string, message: string): Promise<void>;

    log(logPart: LogPart): void;

    onDidDeploy(): void;
}

export interface PluginDependencies {
    metadata: PluginMetadata
    mapping?: Map<string, string>
}

export const PluginDeployerHandler = Symbol('PluginDeployerHandler');
export interface PluginDeployerHandler {
    deployFrontendPlugins(frontendPlugins: PluginDeployerEntry[]): Promise<string[]>;
    deployBackendPlugins(backendPlugins: PluginDeployerEntry[]): Promise<string[]>;

    undeployPlugin(pluginId: string): Promise<boolean>;

    getPluginDependencies(pluginToBeInstalled: PluginDeployerEntry): Promise<PluginDependencies | undefined>
}

export interface GetDeployedPluginsParams {
    pluginIds: string[]
}

export interface DeployedPlugin {
    /**
     * defaults to system
     */
    type?: PluginType;
    metadata: PluginMetadata;
    contributes?: PluginContribution;
}

export const HostedPluginServer = Symbol('HostedPluginServer');
export interface HostedPluginServer extends JsonRpcServer<HostedPluginClient> {

    getDeployedPluginIds(): Promise<string[]>;

    getDeployedPlugins(params: GetDeployedPluginsParams): Promise<DeployedPlugin[]>;

    getExtPluginAPI(): Promise<ExtPluginApi[]>;

    onMessage(targetHost: string, message: string): Promise<void>;

}

export const PLUGIN_HOST_BACKEND = 'main';

export interface WorkspaceStorageKind {
    workspace?: string | undefined;
    roots: string[];
}
export type GlobalStorageKind = undefined;
export type PluginStorageKind = GlobalStorageKind | WorkspaceStorageKind;

/**
 * The JSON-RPC workspace interface.
 */
export const pluginServerJsonRpcPath = '/services/plugin-ext';
export const PluginServer = Symbol('PluginServer');
export interface PluginServer {

    /**
     * Deploy a plugin.
     *
     * @param type whether a plugin is installed by a system or a user, defaults to a user
     */
    deploy(pluginEntry: string, type?: PluginType): Promise<DeployResult>;

    undeploy(pluginId: string): Promise<void>;

    setStorageValue(key: string, value: KeysToAnyValues, kind: PluginStorageKind): Promise<boolean>;
    getStorageValue(key: string, kind: PluginStorageKind): Promise<KeysToAnyValues>;
    getAllStorageValues(kind: PluginStorageKind): Promise<KeysToKeysToAnyValue>;
}

export interface DeployResult {
    deployedPluginIds: string[];
    unresolvedPluginIds: string[];
}

export const ServerPluginRunner = Symbol('ServerPluginRunner');
export interface ServerPluginRunner {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    acceptMessage(pluginHostId: string, jsonMessage: string): boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onMessage(pluginHostId: string, jsonMessage: string): void;
    setClient(client: HostedPluginClient): void;
    setDefault(defaultRunner: ServerPluginRunner): void;
    clientClosed(): void;

    /**
     * Provides additional deployed plugins.
     */
    getExtraDeployedPlugins(): Promise<DeployedPlugin[]>;

    /**
     * Provides additional plugin ids.
     */
    getExtraDeployedPluginIds(): Promise<string[]>;

}

export const PluginHostEnvironmentVariable = Symbol('PluginHostEnvironmentVariable');
export interface PluginHostEnvironmentVariable {
    process(env: NodeJS.ProcessEnv): void;
}
