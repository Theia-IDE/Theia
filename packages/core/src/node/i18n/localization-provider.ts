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

import { injectable } from 'inversify';
import { Localization } from '../../common/i18n/localization';

export const LocalizationProvider = Symbol('LocalizationProvider');

export interface LocalizationProvider {
    getCurrentLanguage(): string
    setCurrentLanguage(languageId: string): void
    getAvailableLanguages(): string[]
    addLocalizations(...localizations: Localization[]): void
    loadLocalization(languageId: string): Localization
}

@injectable()
export class LocalizationProviderImpl implements LocalizationProvider {

    protected localizations: Map<string, Localization> = new Map();
    protected currentLanguage: string = 'en';

    addLocalizations(...localizations: Localization[]): void {
        for (const localization of localizations) {
            if (!this.localizations.has(localization.languageId)) {
                this.localizations.set(localization.languageId, localization);
            } else {
                Object.assign(this.localizations.get(localization.languageId)!.translations, localization.translations);
            }
        }
    }

    setCurrentLanguage(languageId: string): void {
        this.currentLanguage = languageId;
    }

    getCurrentLanguage(): string {
        return this.currentLanguage;
    }

    getAvailableLanguages(): string[] {
        return Array.from(this.localizations.keys()).sort((a, b) => a.localeCompare(b));
    }

    loadLocalization(languageId: string): Localization {
        return this.localizations.get(languageId) ||
        {
            languageId,
            translations: {}
        };
    }

}
