/********************************************************************************
 * Copyright (C) 2015-2018 Red Hat, Inc.
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

import { injectable, inject } from 'inversify';
import {
    PluginEngine,
    PluginModel,
    PluginPackage,
    PluginScanner,
    PluginLifecycle,
    buildFrontendModuleName,
    PluginContribution,
    PluginPackageLanguageContribution,
    LanguageContribution,
    PluginPackageLanguageContributionConfiguration,
    LanguageConfiguration,
    PluginTaskDefinitionContribution,
    AutoClosingPairConditional,
    AutoClosingPair,
    ViewContainer,
    Keybinding,
    PluginPackageKeybinding,
    PluginPackageViewContainer,
    View,
    PluginPackageView,
    Menu,
    PluginPackageMenu,
    PluginPackageDebuggersContribution,
    DebuggerContribution,
    SnippetContribution,
    PluginPackageCommand,
    PluginCommand,
    IconUrl,
    ThemeContribution,
    IconThemeContribution
} from '../../../common/plugin-protocol';
import * as fs from 'fs';
import * as path from 'path';
import { isObject } from 'util';
import { GrammarsReader } from './grammars-reader';
import { CharacterPair } from '../../../common/plugin-api-rpc';
import * as jsoncparser from 'jsonc-parser';
import { IJSONSchema } from '@theia/core/lib/common/json-schema';
import { deepClone } from '@theia/core/lib/common/objects';
import { FileUri } from '@theia/core/lib/node/file-uri';
import { PreferenceSchema, PreferenceSchemaProperties } from '@theia/core/lib/common/preferences/preference-schema';
import { RecursivePartial } from '@theia/core/lib/common/types';
import { ProblemMatcherContribution, ProblemPatternContribution, TaskDefinition } from '@theia/task/lib/common/task-protocol';
import { ColorDefinition } from '@theia/core/lib/browser/color-registry';

namespace nls {
    export function localize(key: string, _default: string): string {
        return _default;
    }
}

const INTERNAL_CONSOLE_OPTIONS_SCHEMA = {
    enum: ['neverOpen', 'openOnSessionStart', 'openOnFirstSessionStart'],
    default: 'openOnFirstSessionStart',
    description: nls.localize('internalConsoleOptions', 'Controls when the internal debug console should open.')
};

const colorIdPattern = '^\\w+[.\\w+]*$';

@injectable()
export class TheiaPluginScanner implements PluginScanner {

    private readonly _apiType: PluginEngine = 'theiaPlugin';

    @inject(GrammarsReader)
    private readonly grammarsReader: GrammarsReader;

    get apiType(): PluginEngine {
        return this._apiType;
    }

    getModel(plugin: PluginPackage): PluginModel {
        const result: PluginModel = {
            packagePath: plugin.packagePath,
            packageUri: FileUri.create(plugin.packagePath).toString(),
            // see id definition: https://github.com/microsoft/vscode/blob/15916055fe0cb9411a5f36119b3b012458fe0a1d/src/vs/platform/extensions/common/extensions.ts#L167-L169
            id: `${plugin.publisher.toLowerCase()}.${plugin.name.toLowerCase()}`,
            name: plugin.name,
            publisher: plugin.publisher,
            version: plugin.version,
            displayName: plugin.displayName,
            description: plugin.description,
            engine: {
                type: this._apiType,
                version: plugin.engines[this._apiType]
            },
            entryPoint: {
                frontend: plugin.theiaPlugin!.frontend,
                backend: plugin.theiaPlugin!.backend
            }
        };
        return result;
    }

    getLifecycle(plugin: PluginPackage): PluginLifecycle {
        return {
            startMethod: 'start',
            stopMethod: 'stop',
            frontendModuleName: buildFrontendModuleName(plugin)
        };
    }

    getDependencies(rawPlugin: PluginPackage): Map<string, string> | undefined {
        // skip it since there is no way to load transitive dependencies for Theia plugins yet
        return undefined;
    }

    getContribution(rawPlugin: PluginPackage): PluginContribution | undefined {
        if (!rawPlugin.contributes && !rawPlugin.activationEvents) {
            return undefined;
        }

        const contributions: PluginContribution = {
            activationEvents: rawPlugin.activationEvents
        };

        if (!rawPlugin.contributes) {
            return contributions;
        }

        try {
            if (rawPlugin.contributes.configuration) {
                const configurations = Array.isArray(rawPlugin.contributes.configuration) ? rawPlugin.contributes.configuration : [rawPlugin.contributes.configuration];
                contributions.configuration = [];
                for (const c of configurations) {
                    const config = this.readConfiguration(c, rawPlugin.packagePath);
                    if (config) {
                        contributions.configuration.push(config);
                    }
                }
            }
        } catch (err) {
            console.error(`Could not read '${rawPlugin.name}' contribution 'configuration'.`, rawPlugin.contributes.configuration, err);
        }

        const configurationDefaults = rawPlugin.contributes.configurationDefaults;
        contributions.configurationDefaults = PreferenceSchemaProperties.is(configurationDefaults) ? configurationDefaults : undefined;

        try {
            if (rawPlugin.contributes!.languages) {
                const languages = this.readLanguages(rawPlugin.contributes.languages!, rawPlugin.packagePath);
                contributions.languages = languages;
            }
        } catch (err) {
            console.error(`Could not read '${rawPlugin.name}' contribution 'languages'.`, rawPlugin.contributes!.languages, err);
        }

        try {
            if (rawPlugin.contributes!.grammars) {
                const grammars = this.grammarsReader.readGrammars(rawPlugin.contributes.grammars!, rawPlugin.packagePath);
                contributions.grammars = grammars;
            }
        } catch (err) {
            console.error(`Could not read '${rawPlugin.name}' contribution 'grammars'.`, rawPlugin.contributes!.grammars, err);
        }

        try {
            if (rawPlugin.contributes && rawPlugin.contributes.viewsContainers) {
                const viewsContainers = rawPlugin.contributes.viewsContainers;
                contributions.viewsContainers = {};

                for (const location of Object.keys(viewsContainers)) {
                    const containers = this.readViewsContainers(viewsContainers[location], rawPlugin);
                    const loc = location === 'activitybar' ? 'left' : location;
                    if (contributions.viewsContainers[loc]) {
                        contributions.viewsContainers[loc] = contributions.viewsContainers[loc].concat(containers);
                    } else {
                        contributions.viewsContainers[loc] = containers;
                    }
                }
            }
        } catch (err) {
            console.error(`Could not read '${rawPlugin.name}' contribution 'viewsContainers'.`, rawPlugin.contributes!.viewsContainers, err);
        }

        try {
            if (rawPlugin.contributes!.views) {
                contributions.views = {};

                Object.keys(rawPlugin.contributes.views!).forEach(location => {
                    const views = this.readViews(rawPlugin.contributes!.views![location]);
                    contributions.views![location] = views;
                });
            }
        } catch (err) {
            console.error(`Could not read '${rawPlugin.name}' contribution 'views'.`, rawPlugin.contributes!.views, err);
        }

        try {
            const pluginCommands = rawPlugin.contributes.commands;
            if (pluginCommands) {
                const commands = Array.isArray(pluginCommands) ? pluginCommands : [pluginCommands];
                contributions.commands = commands.map(command => this.readCommand(command, rawPlugin));
            }
        } catch (err) {
            console.error(`Could not read '${rawPlugin.name}' contribution 'commands'.`, rawPlugin.contributes!.commands, err);
        }

        try {
            if (rawPlugin.contributes!.menus) {
                contributions.menus = {};

                Object.keys(rawPlugin.contributes.menus!).forEach(location => {
                    const menus = this.readMenus(rawPlugin.contributes!.menus![location]);
                    contributions.menus![location] = menus;
                });
            }
        } catch (err) {
            console.error(`Could not read '${rawPlugin.name}' contribution 'menus'.`, rawPlugin.contributes!.menus, err);
        }

        try {
            if (rawPlugin.contributes! && rawPlugin.contributes.keybindings) {
                const rawKeybindings = Array.isArray(rawPlugin.contributes.keybindings) ? rawPlugin.contributes.keybindings : [rawPlugin.contributes.keybindings];
                contributions.keybindings = rawKeybindings.map(rawKeybinding => this.readKeybinding(rawKeybinding));
            }
        } catch (err) {
            console.error(`Could not read '${rawPlugin.name}' contribution 'keybindings'.`, rawPlugin.contributes!.keybindings, err);
        }

        try {
            if (rawPlugin.contributes!.debuggers) {
                const debuggers = this.readDebuggers(rawPlugin.contributes.debuggers!);
                contributions.debuggers = debuggers;
            }
        } catch (err) {
            console.error(`Could not read '${rawPlugin.name}' contribution 'debuggers'.`, rawPlugin.contributes!.debuggers, err);
        }

        try {
            if (rawPlugin.contributes!.taskDefinitions) {
                const definitions = rawPlugin.contributes!.taskDefinitions!;
                contributions.taskDefinitions = definitions.map(definitionContribution => this.readTaskDefinition(rawPlugin.name, definitionContribution));
            }
        } catch (err) {
            console.error(`Could not read '${rawPlugin.name}' contribution 'taskDefinitions'.`, rawPlugin.contributes!.taskDefinitions, err);
        }

        try {
            if (rawPlugin.contributes!.problemMatchers) {
                contributions.problemMatchers = rawPlugin.contributes!.problemMatchers as ProblemMatcherContribution[];
            }
        } catch (err) {
            console.error(`Could not read '${rawPlugin.name}' contribution 'problemMatchers'.`, rawPlugin.contributes!.problemMatchers, err);
        }

        try {
            if (rawPlugin.contributes!.problemPatterns) {
                contributions.problemPatterns = rawPlugin.contributes!.problemPatterns as ProblemPatternContribution[];
            }
        } catch (err) {
            console.error(`Could not read '${rawPlugin.name}' contribution 'problemPatterns'.`, rawPlugin.contributes!.problemPatterns, err);
        }

        try {
            contributions.snippets = this.readSnippets(rawPlugin);
        } catch (err) {
            console.error(`Could not read '${rawPlugin.name}' contribution 'snippets'.`, rawPlugin.contributes!.snippets, err);
        }

        try {
            contributions.themes = this.readThemes(rawPlugin);
        } catch (err) {
            console.error(`Could not read '${rawPlugin.name}' contribution 'themes'.`, rawPlugin.contributes.themes, err);
        }

        try {
            contributions.iconThemes = this.readIconThemes(rawPlugin);
        } catch (err) {
            console.error(`Could not read '${rawPlugin.name}' contribution 'iconThemes'.`, rawPlugin.contributes.iconThemes, err);
        }

        try {
            contributions.colors = this.readColors(rawPlugin);
        } catch (err) {
            console.error(`Could not read '${rawPlugin.name}' contribution 'colors'.`, rawPlugin.contributes.colors, err);
        }
        return contributions;
    }

    protected readCommand({ command, title, category, icon }: PluginPackageCommand, pck: PluginPackage): PluginCommand {
        let iconUrl: IconUrl | undefined;
        if (icon) {
            if (typeof icon === 'string') {
                iconUrl = this.toPluginUrl(pck, icon);
            } else {
                iconUrl = {
                    light: this.toPluginUrl(pck, icon.light),
                    dark: this.toPluginUrl(pck, icon.dark)
                };
            }
        }
        return { command, title, category, iconUrl };
    }

    protected toPluginUrl(pck: PluginPackage, relativePath: string): string {
        return PluginPackage.toPluginUrl(pck, relativePath);
    }

    protected readColors(pck: PluginPackage): ColorDefinition[] | undefined {
        if (!pck.contributes || !pck.contributes.colors) {
            return undefined;
        }
        const result: ColorDefinition[] = [];
        for (const contribution of pck.contributes.colors) {
            if (typeof contribution.id !== 'string' || contribution.id.length === 0) {
                console.error("'configuration.colors.id' must be defined and can not be empty");
                continue;
            }
            if (!contribution.id.match(colorIdPattern)) {
                console.error("'configuration.colors.id' must follow the word[.word]*");
                continue;
            }
            if (typeof contribution.description !== 'string' || contribution.id.length === 0) {
                console.error("'configuration.colors.description' must be defined and can not be empty");
                continue;
            }
            const defaults = contribution.defaults;
            if (!defaults || typeof defaults !== 'object' || typeof defaults.light !== 'string' || typeof defaults.dark !== 'string' || typeof defaults.highContrast !== 'string') {
                console.error("'configuration.colors.defaults' must be defined and must contain 'light', 'dark' and 'highContrast'");
                continue;
            }
            result.push({
                id: contribution.id,
                description: contribution.description,
                defaults: {
                    light: defaults.light,
                    dark: defaults.dark,
                    hc: defaults.highContrast
                }
            });
        }
        return result;
    }

    protected readThemes(pck: PluginPackage): ThemeContribution[] | undefined {
        if (!pck.contributes || !pck.contributes.themes) {
            return undefined;
        }
        const result: ThemeContribution[] = [];
        for (const contribution of pck.contributes.themes) {
            if (contribution.path) {
                result.push({
                    id: contribution.id,
                    uri: FileUri.create(path.join(pck.packagePath, contribution.path)).toString(),
                    description: contribution.description,
                    label: contribution.label,
                    uiTheme: contribution.uiTheme
                });
            }
        }
        return result;
    }

    protected readIconThemes(pck: PluginPackage): IconThemeContribution[] | undefined {
        if (!pck.contributes || !pck.contributes.iconThemes) {
            return undefined;
        }
        const result: IconThemeContribution[] = [];
        for (const contribution of pck.contributes.iconThemes) {
            if (typeof contribution.id !== 'string') {
                console.error('Expected string in `contributes.iconThemes.id`. Provided value:', contribution.id);
                continue;
            }
            if (typeof contribution.path !== 'string') {
                console.error('Expected string in `contributes.iconThemes.path`. Provided value:', contribution.path);
                continue;
            }
            result.push({
                id: contribution.id,
                uri: FileUri.create(path.join(pck.packagePath, contribution.path)).toString(),
                description: contribution.description,
                label: contribution.label,
                uiTheme: contribution.uiTheme
            });
        }
        return result;
    }

    protected readSnippets(pck: PluginPackage): SnippetContribution[] | undefined {
        if (!pck.contributes || !pck.contributes.snippets) {
            return undefined;
        }
        const result: SnippetContribution[] = [];
        for (const contribution of pck.contributes.snippets) {
            if (contribution.path) {
                result.push({
                    language: contribution.language,
                    source: pck.displayName || pck.name,
                    uri: FileUri.create(path.join(pck.packagePath, contribution.path)).toString()
                });
            }
        }
        return result;
    }

    protected readJson<T>(filePath: string): T | undefined {
        const content = this.readFileSync(filePath);
        return content ? jsoncparser.parse(content, undefined, { disallowComments: false }) : undefined;
    }
    protected readFileSync(filePath: string): string {
        try {
            return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
        } catch (e) {
            console.error(e);
            return '';
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readConfiguration(rawConfiguration: RecursivePartial<PreferenceSchema>, pluginPath: string): PreferenceSchema | undefined {
        return PreferenceSchema.is(rawConfiguration) ? rawConfiguration : undefined;
    }

    private readKeybinding(rawKeybinding: PluginPackageKeybinding): Keybinding {
        return {
            keybinding: rawKeybinding.key,
            command: rawKeybinding.command,
            when: rawKeybinding.when,
            mac: rawKeybinding.mac,
            linux: rawKeybinding.linux,
            win: rawKeybinding.win
        };
    }

    private readViewsContainers(rawViewsContainers: PluginPackageViewContainer[], pck: PluginPackage): ViewContainer[] {
        return rawViewsContainers.map(rawViewContainer => this.readViewContainer(rawViewContainer, pck));
    }

    private readViewContainer(rawViewContainer: PluginPackageViewContainer, pck: PluginPackage): ViewContainer {
        return {
            id: rawViewContainer.id,
            title: rawViewContainer.title,
            iconUrl: this.toPluginUrl(pck, rawViewContainer.icon)
        };
    }

    private readViews(rawViews: PluginPackageView[]): View[] {
        return rawViews.map(rawView => this.readView(rawView));
    }

    private readView(rawView: PluginPackageView): View {
        const result: View = {
            id: rawView.id,
            name: rawView.name,
            when: rawView.when
        };

        return result;
    }

    private readMenus(rawMenus: PluginPackageMenu[]): Menu[] {
        return rawMenus.map(rawMenu => this.readMenu(rawMenu));
    }

    private readMenu(rawMenu: PluginPackageMenu): Menu {
        const result: Menu = {
            command: rawMenu.command,
            alt: rawMenu.alt,
            group: rawMenu.group,
            when: rawMenu.when
        };
        return result;
    }

    private readLanguages(rawLanguages: PluginPackageLanguageContribution[], pluginPath: string): LanguageContribution[] {
        return rawLanguages.map(language => this.readLanguage(language, pluginPath));
    }

    private readLanguage(rawLang: PluginPackageLanguageContribution, pluginPath: string): LanguageContribution {
        // TODO: add validation to all parameters
        const result: LanguageContribution = {
            id: rawLang.id,
            aliases: rawLang.aliases,
            extensions: rawLang.extensions,
            filenamePatterns: rawLang.filenamePatterns,
            filenames: rawLang.filenames,
            firstLine: rawLang.firstLine,
            mimetypes: rawLang.mimetypes
        };
        if (rawLang.configuration) {
            const rawConfiguration = this.readJson<PluginPackageLanguageContributionConfiguration>(path.resolve(pluginPath, rawLang.configuration));
            if (rawConfiguration) {
                const configuration: LanguageConfiguration = {
                    brackets: rawConfiguration.brackets,
                    comments: rawConfiguration.comments,
                    folding: rawConfiguration.folding,
                    wordPattern: rawConfiguration.wordPattern,
                    autoClosingPairs: this.extractValidAutoClosingPairs(rawLang.id, rawConfiguration),
                    indentationRules: rawConfiguration.indentationRules,
                    surroundingPairs: this.extractValidSurroundingPairs(rawLang.id, rawConfiguration)
                };
                result.configuration = configuration;
            }
        }
        return result;

    }

    private readDebuggers(rawDebuggers: PluginPackageDebuggersContribution[]): DebuggerContribution[] {
        return rawDebuggers.map(rawDebug => this.readDebugger(rawDebug));
    }

    private readDebugger(rawDebugger: PluginPackageDebuggersContribution): DebuggerContribution {
        const result: DebuggerContribution = {
            type: rawDebugger.type,
            label: rawDebugger.label,
            languages: rawDebugger.languages,
            enableBreakpointsFor: rawDebugger.enableBreakpointsFor,
            variables: rawDebugger.variables,
            adapterExecutableCommand: rawDebugger.adapterExecutableCommand,
            configurationSnippets: rawDebugger.configurationSnippets,
            win: rawDebugger.win,
            winx86: rawDebugger.winx86,
            windows: rawDebugger.windows,
            osx: rawDebugger.osx,
            linux: rawDebugger.linux,
            program: rawDebugger.program,
            args: rawDebugger.args,
            runtime: rawDebugger.runtime,
            runtimeArgs: rawDebugger.runtimeArgs
        };

        result.configurationAttributes = rawDebugger.configurationAttributes
            && this.resolveSchemaAttributes(rawDebugger.type, rawDebugger.configurationAttributes);

        return result;
    }

    private readTaskDefinition(pluginName: string, definitionContribution: PluginTaskDefinitionContribution): TaskDefinition {
        const propertyKeys = definitionContribution.properties ? Object.keys(definitionContribution.properties) : [];
        return {
            taskType: definitionContribution.type,
            source: pluginName,
            properties: {
                required: definitionContribution.required,
                all: propertyKeys,
                schema: definitionContribution
            }
        };
    }

    protected resolveSchemaAttributes(type: string, configurationAttributes: { [request: string]: IJSONSchema }): IJSONSchema[] {
        const taskSchema = {};
        return Object.keys(configurationAttributes).map(request => {
            const attributes: IJSONSchema = deepClone(configurationAttributes[request]);
            const defaultRequired = ['name', 'type', 'request'];
            attributes.required = attributes.required && attributes.required.length ? defaultRequired.concat(attributes.required) : defaultRequired;
            attributes.additionalProperties = false;
            attributes.type = 'object';
            if (!attributes.properties) {
                attributes.properties = {};
            }
            const properties = attributes.properties;
            properties['type'] = {
                enum: [type],
                description: nls.localize('debugType', 'Type of configuration.'),
                pattern: '^(?!node2)',
                errorMessage: nls.localize('debugTypeNotRecognised',
                    'The debug type is not recognized. Make sure that you have a corresponding debug extension installed and that it is enabled.'),
                patternErrorMessage: nls.localize('node2NotSupported',
                    '"node2" is no longer supported, use "node" instead and set the "protocol" attribute to "inspector".')
            };
            properties['name'] = {
                type: 'string',
                description: nls.localize('debugName', 'Name of configuration; appears in the launch configuration drop down menu.'),
                default: 'Launch'
            };
            properties['request'] = {
                enum: [request],
                description: nls.localize('debugRequest', 'Request type of configuration. Can be "launch" or "attach".'),
            };
            properties['debugServer'] = {
                type: 'number',
                description: nls.localize('debugServer',
                    'For debug extension development only: if a port is specified VS Code tries to connect to a debug adapter running in server mode'),
                default: 4711
            };
            properties['preLaunchTask'] = {
                anyOf: [taskSchema, {
                    type: ['string'],
                }],
                default: '',
                description: nls.localize('debugPrelaunchTask', 'Task to run before debug session starts.')
            };
            properties['postDebugTask'] = {
                anyOf: [taskSchema, {
                    type: ['string'],
                }],
                default: '',
                description: nls.localize('debugPostDebugTask', 'Task to run after debug session ends.')
            };
            properties['internalConsoleOptions'] = INTERNAL_CONSOLE_OPTIONS_SCHEMA;

            const osProperties = Object.assign({}, properties);
            properties['windows'] = {
                type: 'object',
                description: nls.localize('debugWindowsConfiguration', 'Windows specific launch configuration attributes.'),
                properties: osProperties
            };
            properties['osx'] = {
                type: 'object',
                description: nls.localize('debugOSXConfiguration', 'OS X specific launch configuration attributes.'),
                properties: osProperties
            };
            properties['linux'] = {
                type: 'object',
                description: nls.localize('debugLinuxConfiguration', 'Linux specific launch configuration attributes.'),
                properties: osProperties
            };
            Object.keys(attributes.properties).forEach(name => {
                // Use schema allOf property to get independent error reporting #21113
                attributes!.properties![name].pattern = attributes!.properties![name].pattern || '^(?!.*\\$\\{(env|config|command)\\.)';
                attributes!.properties![name].patternErrorMessage = attributes!.properties![name].patternErrorMessage ||
                    nls.localize('deprecatedVariables', "'env.', 'config.' and 'command.' are deprecated, use 'env:', 'config:' and 'command:' instead.");
            });

            return attributes;
        });
    }

    private extractValidAutoClosingPairs(langId: string, configuration: PluginPackageLanguageContributionConfiguration): AutoClosingPairConditional[] | undefined {
        const source = configuration.autoClosingPairs;
        if (typeof source === 'undefined') {
            return undefined;
        }
        if (!Array.isArray(source)) {
            console.warn(`[${langId}]: language configuration: expected \`autoClosingPairs\` to be an array.`);
            return undefined;
        }

        let result: AutoClosingPairConditional[] | undefined = undefined;
        // tslint:disable-next-line:one-variable-per-declaration
        for (let i = 0, len = source.length; i < len; i++) {
            const pair = source[i];
            if (Array.isArray(pair)) {
                if (!isCharacterPair(pair)) {
                    console.warn(`[${langId}]: language configuration: expected \`autoClosingPairs[${i}]\` to be an array of two strings or an object.`);
                    continue;
                }
                result = result || [];
                result.push({ open: pair[0], close: pair[1] });
            } else {
                if (!isObject(pair)) {
                    console.warn(`[${langId}]: language configuration: expected \`autoClosingPairs[${i}]\` to be an array of two strings or an object.`);
                    continue;
                }
                if (typeof pair.open !== 'string') {
                    console.warn(`[${langId}]: language configuration: expected \`autoClosingPairs[${i}].open\` to be a string.`);
                    continue;
                }
                if (typeof pair.close !== 'string') {
                    console.warn(`[${langId}]: language configuration: expected \`autoClosingPairs[${i}].close\` to be a string.`);
                    continue;
                }
                if (typeof pair.notIn !== 'undefined') {
                    if (!isStringArr(pair.notIn)) {
                        console.warn(`[${langId}]: language configuration: expected \`autoClosingPairs[${i}].notIn\` to be a string array.`);
                        continue;
                    }
                }
                result = result || [];
                result.push({ open: pair.open, close: pair.close, notIn: pair.notIn });
            }
        }
        return result;
    }

    private extractValidSurroundingPairs(langId: string, configuration: PluginPackageLanguageContributionConfiguration): AutoClosingPair[] | undefined {
        const source = configuration.surroundingPairs;
        if (typeof source === 'undefined') {
            return undefined;
        }
        if (!Array.isArray(source)) {
            console.warn(`[${langId}]: language configuration: expected \`surroundingPairs\` to be an array.`);
            return undefined;
        }

        let result: AutoClosingPair[] | undefined = undefined;
        // tslint:disable-next-line:one-variable-per-declaration
        for (let i = 0, len = source.length; i < len; i++) {
            const pair = source[i];
            if (Array.isArray(pair)) {
                if (!isCharacterPair(pair)) {
                    console.warn(`[${langId}]: language configuration: expected \`surroundingPairs[${i}]\` to be an array of two strings or an object.`);
                    continue;
                }
                result = result || [];
                result.push({ open: pair[0], close: pair[1] });
            } else {
                if (!isObject(pair)) {
                    console.warn(`[${langId}]: language configuration: expected \`surroundingPairs[${i}]\` to be an array of two strings or an object.`);
                    continue;
                }
                if (typeof pair.open !== 'string') {
                    console.warn(`[${langId}]: language configuration: expected \`surroundingPairs[${i}].open\` to be a string.`);
                    continue;
                }
                if (typeof pair.close !== 'string') {
                    console.warn(`[${langId}]: language configuration: expected \`surroundingPairs[${i}].close\` to be a string.`);
                    continue;
                }
                result = result || [];
                result.push({ open: pair.open, close: pair.close });
            }
        }
        return result;
    }

}

function isCharacterPair(something: CharacterPair): boolean {
    return (
        isStringArr(something)
        && something.length === 2
    );
}

function isStringArr(something: string[]): boolean {
    if (!Array.isArray(something)) {
        return false;
    }
    // tslint:disable-next-line:one-variable-per-declaration
    for (let i = 0, len = something.length; i < len; i++) {
        if (typeof something[i] !== 'string') {
            return false;
        }
    }
    return true;

}
