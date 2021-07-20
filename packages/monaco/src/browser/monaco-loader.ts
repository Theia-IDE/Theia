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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { nls } from '@theia/core/lib/browser/nls';

export function loadVsRequire(context: any): Promise<any> {
    // Monaco uses a custom amd loader that over-rides node's require.
    // Keep a reference to an original require so we can restore it after executing the amd loader file.
    const originalRequire = context.require;
    return new Promise(resolve => {
        if (document.readyState === 'loading') {
            window.addEventListener('load', attachVsLoader, { once: true });
        } else {
            attachVsLoader();
        }
        function attachVsLoader(): void {
            const vsLoader = document.createElement('script');
            vsLoader.type = 'text/javascript';
            vsLoader.src = './vs/loader.js';
            vsLoader.charset = 'utf-8';
            vsLoader.addEventListener('load', () => {
                // Save Monaco's amd require and restore the original require
                const amdRequire = context.require;
                if (originalRequire) {
                    context.require = originalRequire;
                }
                resolve(amdRequire);
            });
            document.body.appendChild(vsLoader);
        };
    });
}

export function loadMonaco(vsRequire: any): Promise<void> {
    return new Promise<void>(resolve => {
        // Monaco is only available in certain languages
        // For now, we don't have a plan to load languages contributed by language packs on startup
        if (nls.locale && ['de', 'es', 'fr', 'it', 'ja', 'ko', 'ru', 'zh-cn', 'zh-tw'].includes(nls.locale)) {
            vsRequire.config({
                'vs/nls': {
                    availableLanguages: {
                        '*': nls.locale
                    }
                }
            });
        }
        vsRequire(['vs/editor/editor.main'], () => {
            vsRequire([
                'vs/platform/commands/common/commands',
                'vs/platform/actions/common/actions',
                'vs/platform/keybinding/common/keybindingsRegistry',
                'vs/platform/keybinding/common/keybindingResolver',
                'vs/platform/keybinding/common/usLayoutResolvedKeybinding',
                'vs/base/common/keybindingLabels',
                'vs/base/common/keyCodes',
                'vs/base/common/mime',
                'vs/editor/browser/editorExtensions',
                'vs/editor/standalone/browser/simpleServices',
                'vs/editor/standalone/browser/standaloneServices',
                'vs/editor/standalone/browser/standaloneLanguages',
                'vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess',
                'vs/editor/standalone/browser/quickAccess/standaloneGotoSymbolQuickAccess',
                'vs/base/parts/quickinput/browser/quickInput',
                'vs/platform/quickinput/browser/quickInput',
                'vs/platform/quickinput/common/quickAccess',
                'vs/platform/quickinput/browser/quickAccess',
                'vs/platform/quickinput/browser/pickerQuickAccess',
                'vs/base/browser/ui/list/listWidget',
                'vs/platform/registry/common/platform',
                'vs/base/common/filters',
                'vs/platform/theme/common/themeService',
                'vs/platform/theme/common/styler',
                'vs/platform/theme/common/colorRegistry',
                'vs/base/common/color',
                'vs/base/common/platform',
                'vs/editor/common/modes',
                'vs/editor/contrib/suggest/suggest',
                'vs/editor/contrib/snippet/snippetParser',
                'vs/editor/contrib/format/format',
                'vs/platform/configuration/common/configuration',
                'vs/platform/configuration/common/configurationModels',
                'vs/editor/common/services/resolverService',
                'vs/editor/browser/services/codeEditorService',
                'vs/editor/browser/services/codeEditorServiceImpl',
                'vs/editor/browser/services/openerService',
                'vs/platform/markers/common/markerService',
                'vs/platform/contextkey/common/contextkey',
                'vs/platform/contextkey/browser/contextKeyService',
                'vs/editor/common/model/wordHelper',
                'vs/base/common/errors',
                'vs/base/common/path',
                'vs/editor/common/model/textModel',
                'vs/base/common/strings',
                'vs/base/common/async'
            ], (commands: any, actions: any,
                keybindingsRegistry: any, keybindingResolver: any, resolvedKeybinding: any, keybindingLabels: any,
                keyCodes: any, mime: any, editorExtensions: any, simpleServices: any,
                standaloneServices: any, standaloneLanguages: any, standaloneGotoLineQuickAccess: any, standaloneGotoSymbolQuickAccess: any, quickInput: any,
                quickInputPlatform: any, quickAccess: any, quickAccessBrowser: any, pickerQuickAccess: any, listWidget: any, // helpQuickAccess: any, commandsQuickAccess: any,
                platformRegistry: any,
                filters: any, themeService: any, styler: any, colorRegistry: any, color: any,
                platform: any, modes: any, suggest: any, snippetParser: any,
                format: any,
                configuration: any, configurationModels: any,
                resolverService: any,
                codeEditorService: any, codeEditorServiceImpl: any, openerService: any,
                markerService: any,
                contextKey: any, contextKeyService: any,
                wordHelper: any,
                error: any, path: any,
                textModel: any, strings: any, async: any) => {
                const global: any = self;
                global.monaco.commands = commands;
                global.monaco.actions = actions;
                global.monaco.keybindings = Object.assign({}, keybindingsRegistry, keybindingResolver, resolvedKeybinding, keybindingLabels, keyCodes);
                global.monaco.services = Object.assign({}, simpleServices, standaloneServices,
                    standaloneLanguages, configuration, configurationModels,
                    resolverService, codeEditorService, codeEditorServiceImpl, markerService, openerService);
                global.monaco.quickInput = Object.assign({}, quickInput, quickAccess, quickAccessBrowser, quickInputPlatform,
                    pickerQuickAccess, standaloneGotoLineQuickAccess, standaloneGotoSymbolQuickAccess);
                global.monaco.filters = filters;
                global.monaco.theme = Object.assign({}, themeService, styler);
                global.monaco.color = Object.assign({}, colorRegistry, color);
                global.monaco.platform = Object.assign({}, platform, platformRegistry);
                global.monaco.editorExtensions = editorExtensions;
                global.monaco.modes = modes;
                global.monaco.suggest = suggest;
                global.monaco.snippetParser = snippetParser;
                global.monaco.format = format;
                global.monaco.contextkey = contextKey;
                global.monaco.contextKeyService = contextKeyService;
                global.monaco.mime = mime;
                global.monaco.wordHelper = wordHelper;
                global.monaco.error = error;
                global.monaco.path = path;
                global.monaco.textModel = textModel;
                global.monaco.strings = strings;
                global.monaco.async = async;
                global.monaco.list = listWidget;
                resolve();
            });
        });
    });
}

export function clearMonacoQuickAccessProviders(): void {
    const registry = monaco.platform.Registry.as<monaco.quickInput.IQuickAccessRegistry>('workbench.contributions.quickaccess');

    // Clear Monaco QuickAccessRegistry as it currently includes monaco internal providers and not Theia's providers
    registry.clear();
}
