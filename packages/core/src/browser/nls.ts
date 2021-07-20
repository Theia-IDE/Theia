/********************************************************************************
 * Copyright (C) 2021 TypeFox and others.
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

import { Localization } from '../common/i18n/localization';
import { Endpoint } from './endpoint';

class TranslationContainer {

    localization?: Localization;

    localize(key: string, defaultValue: string, args: string[]): string {
        let value = defaultValue;
        if (this.localization) {
            const translation = this.localization.translations[key];
            if (translation) {
                // vscode's localizations often contain additional '&&' symbols, which we simply ignore
                value = translation.replace(/&&/g, '');
            }
        }
        return this.format(value, args);
    }

    format(message: string, args: string[]): string {
        let result = message;
        if (args.length > 0) {
            result = message.replace(/\{(\d+)\}/g, (match, rest) => {
                const index = rest[0];
                const arg = args[index];
                let replacement = match;
                if (typeof arg === 'string') {
                    replacement = arg;
                } else if (typeof arg === 'number' || typeof arg === 'boolean' || !arg) {
                    replacement = String(arg);
                }
                return replacement;
            });
        }
        return result;
    }
}

const container = new TranslationContainer();

export namespace nls {

    export const localeId = 'localeId';

    export const locale = typeof window === 'object' && window && window.localStorage.getItem('localeId') || undefined;

    export function localize(key: string, defaultValue: string, ...args: string[]): string {
        return container.localize(key, defaultValue, args);
    }
}

export async function loadTranslations(): Promise<void> {
    if (nls.locale) {
        const endpoint = new Endpoint({ path: '/i18n/' + nls.locale }).getRestUrl().toString();
        const response = await fetch(endpoint);
        container.localization = await response.json();
    }
}
