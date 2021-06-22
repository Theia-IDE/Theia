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

export const localizationPath = '/services/i18n';

export const AsyncLocalizationProvider = Symbol('AsyncLocalizationProvider');
export interface AsyncLocalizationProvider {
    getCurrentLanguage(): Promise<string>
    setCurrentLanguage(languageId: string): Promise<void>
    getAvailableLanguages(): Promise<string[]>
    loadLocalization(languageId: string): Promise<Localization>
}

export interface Localization {
    languageId: string;
    languageName?: string;
    localizedLanguageName?: string;
    translations: { [key: string]: string };
}
