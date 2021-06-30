/********************************************************************************
 * Copyright (C) 2019 TypeFox and others.
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

import { injectable, postConstruct, inject } from 'inversify';
import { isOSX } from '../../common/os';
import { Emitter, Event } from '../../common/event';
import { ILogger } from '../../common/logger';
import { Deferred } from '../../common/promise-util';
import {
    NativeKeyboardLayout, KeyboardLayoutProvider, KeyboardLayoutChangeNotifier, KeyValidator, KeyValidationInput
} from '../../common/keyboard/keyboard-layout-provider';
import { LocalStorageService } from '../storage-service';

export type KeyboardLayoutSource = 'navigator.keyboard' | 'user-choice' | 'pressed-keys';

@injectable()
export class BrowserKeyboardLayoutProvider implements KeyboardLayoutProvider, KeyboardLayoutChangeNotifier, KeyValidator {

    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(LocalStorageService)
    protected readonly storageService: LocalStorageService;

    protected readonly initialized = new Deferred();
    protected readonly nativeLayoutChanged = new Emitter<NativeKeyboardLayout>();

    get onDidChangeNativeLayout(): Event<NativeKeyboardLayout> {
        return this.nativeLayoutChanged.event;
    }

    protected readonly tester = new KeyboardTester(loadAllLayouts());
    protected source: KeyboardLayoutSource = 'pressed-keys';
    protected currentLayout: KeyboardLayoutData = DEFAULT_LAYOUT_DATA;

    get allLayoutData(): KeyboardLayoutData[] {
        return this.tester.candidates.slice();
    }

    get currentLayoutData(): KeyboardLayoutData {
        return this.currentLayout;
    }

    get currentLayoutSource(): KeyboardLayoutSource {
        return this.source;
    }

    @postConstruct()
    protected async initialize(): Promise<void> {
        await this.loadState();
        const keyboard = (navigator as NavigatorExtension).keyboard;
        if (keyboard && keyboard.addEventListener) {
            keyboard.addEventListener('layoutchange', async () => {
                const newLayout = await this.getNativeLayout();
                this.nativeLayoutChanged.fire(newLayout);
            });
        }
        this.initialized.resolve();
    }

    async getNativeLayout(): Promise<NativeKeyboardLayout> {
        await this.initialized.promise;
        if (this.source === 'user-choice') {
            return this.currentLayout.raw;
        }
        const [layout, source] = await this.autodetect();
        this.setCurrent(layout, source);
        return layout.raw;
    }

    /**
     * Set user-chosen keyboard layout data.
     */
    async setLayoutData(layout: KeyboardLayoutData | 'autodetect'): Promise<KeyboardLayoutData> {
        if (layout === 'autodetect') {
            if (this.source === 'user-choice') {
                const [newLayout, source] = await this.autodetect();
                this.setCurrent(newLayout, source);
                this.nativeLayoutChanged.fire(newLayout.raw);
                return newLayout;
            }
            return this.currentLayout;
        } else {
            if (this.source !== 'user-choice' || layout !== this.currentLayout) {
                this.setCurrent(layout, 'user-choice');
                this.nativeLayoutChanged.fire(layout.raw);
            }
            return layout;
        }
    }

    /**
     * Test all known keyboard layouts with the given combination of pressed key and
     * produced character. Matching layouts have their score increased (see class
     * KeyboardTester). If this leads to a change of the top-scoring layout, a layout
     * change event is fired.
     */
    validateKey(keyCode: KeyValidationInput): void {
        if (this.source !== 'pressed-keys') {
            return;
        }
        const accepted = this.tester.updateScores(keyCode);
        if (!accepted) {
            return;
        }
        const layout = this.selectLayout();
        if (layout !== this.currentLayout && layout !== DEFAULT_LAYOUT_DATA) {
            this.setCurrent(layout, 'pressed-keys');
            this.nativeLayoutChanged.fire(layout.raw);
        }
    }

    protected setCurrent(layout: KeyboardLayoutData, source: KeyboardLayoutSource): void {
        this.currentLayout = layout;
        this.source = source;
        this.saveState();
        if (this.tester.inputCount && (source === 'pressed-keys' || source === 'navigator.keyboard')) {
            const from = source === 'pressed-keys' ? 'pressed keys' : 'browser API';
            const hardware = layout.hardware === 'mac' ? 'Mac' : 'PC';
            this.logger.info(`Detected keyboard layout from ${from}: ${layout.name} (${hardware})`);
        }
    }

    protected async autodetect(): Promise<[KeyboardLayoutData, KeyboardLayoutSource]> {
        const keyboard = (navigator as NavigatorExtension).keyboard;
        if (keyboard && keyboard.getLayoutMap) {
            try {
                const layoutMap = await keyboard.getLayoutMap();
                this.testLayoutMap(layoutMap);
                return [this.selectLayout(), 'navigator.keyboard'];
            } catch (error) {
                this.logger.warn('Failed to obtain keyboard layout map.', error);
            }
        }
        return [this.selectLayout(), 'pressed-keys'];
    }

    /**
     * @param layoutMap a keyboard layout map according to https://wicg.github.io/keyboard-map/
     */
    protected testLayoutMap(layoutMap: KeyboardLayoutMap): void {
        this.tester.reset();
        for (const [code, key] of layoutMap.entries()) {
            this.tester.updateScores({ code, character: key });
        }
    }

    /**
     * Select a layout based on the current tester state and the operating system
     * and language detected from the browser.
     */
    protected selectLayout(): KeyboardLayoutData {
        const candidates = this.tester.candidates;
        const scores = this.tester.scores;
        const topScore = this.tester.topScore;
        const language = navigator.language;
        let matchingOScount = 0;
        let topScoringCount = 0;
        for (let i = 0; i < candidates.length; i++) {
            if (scores[i] === topScore) {
                const candidate = candidates[i];
                if (osMatches(candidate.hardware)) {
                    if (language && language.startsWith(candidate.language)) {
                        return candidate;
                    }
                    matchingOScount++;
                }
                topScoringCount++;
            }
        }
        if (matchingOScount >= 1) {
            return candidates.find((c, i) => scores[i] === topScore && osMatches(c.hardware))!;
        }
        if (topScoringCount >= 1) {
            return candidates.find((_, i) => scores[i] === topScore)!;
        }
        return DEFAULT_LAYOUT_DATA;
    }

    protected saveState(): Promise<void> {
        const data: LayoutProviderState = {
            tester: this.tester.getState(),
            source: this.source,
            currentLayout: this.currentLayout !== DEFAULT_LAYOUT_DATA ? getLayoutId(this.currentLayout) : undefined
        };
        return this.storageService.setData('keyboard', data);
    }

    protected async loadState(): Promise<void> {
        const data = await this.storageService.getData<LayoutProviderState>('keyboard');
        if (data) {
            this.tester.setState(data.tester || {});
            this.source = data.source || 'pressed-keys';
            if (data.currentLayout) {
                const layout = this.tester.candidates.find(c => getLayoutId(c) === data.currentLayout);
                if (layout) {
                    this.currentLayout = layout;
                }
            } else {
                this.currentLayout = DEFAULT_LAYOUT_DATA;
            }
        }
    }

}

export interface KeyboardLayoutData {
    name: string;
    hardware: 'pc' | 'mac';
    language: string;
    raw: NativeKeyboardLayout;
}

function osMatches(hardware: 'pc' | 'mac'): boolean {
    return isOSX ? hardware === 'mac' : hardware === 'pc';
}

/**
 * This is the fallback keyboard layout selected when nothing else matches.
 * It has an empty mapping, so user inputs are handled like with a standard US keyboard.
 */
export const DEFAULT_LAYOUT_DATA: KeyboardLayoutData = {
    name: 'US',
    hardware: isOSX ? 'mac' : 'pc',
    language: 'en',
    raw: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        info: {} as any,
        mapping: {}
    }
};

export interface LayoutProviderState {
    tester?: KeyboardTesterState;
    source?: KeyboardLayoutSource;
    currentLayout?: string;
}

export interface KeyboardTesterState {
    scores?: { [id: string]: number };
    topScore?: number;
    testedInputs?: { [key: string]: string }
}

/**
 * Holds score values for all known keyboard layouts. Scores are updated
 * by comparing key codes with the corresponding character produced by
 * the user's keyboard.
 */
export class KeyboardTester {

    readonly scores: number[];
    topScore: number = 0;

    private readonly testedInputs = new Map<string, string>();

    get inputCount(): number {
        return this.testedInputs.size;
    }

    constructor(readonly candidates: KeyboardLayoutData[]) {
        this.scores = this.candidates.map(() => 0);
    }

    reset(): void {
        for (let i = 0; i < this.scores.length; i++) {
            this.scores[i] = 0;
        }
        this.topScore = 0;
        this.testedInputs.clear();
    }

    updateScores(input: KeyValidationInput): boolean {
        let property: 'value' | 'withShift' | 'withAltGr' | 'withShiftAltGr';
        if (input.shiftKey && input.altKey) {
            property = 'withShiftAltGr';
        } else if (input.shiftKey) {
            property = 'withShift';
        } else if (input.altKey) {
            property = 'withAltGr';
        } else {
            property = 'value';
        }
        const inputKey = `${input.code}.${property}`;
        if (this.testedInputs.has(inputKey)) {
            if (this.testedInputs.get(inputKey) === input.character) {
                return false;
            } else {
                // The same input keystroke leads to a different character:
                // probably a keyboard layout change, so forget all previous scores
                this.reset();
            }
        }

        const scores = this.scores;
        for (let i = 0; i < this.candidates.length; i++) {
            scores[i] += this.testCandidate(this.candidates[i], input, property);
            if (scores[i] > this.topScore) {
                this.topScore = scores[i];
            }
        }
        this.testedInputs.set(inputKey, input.character);
        return true;
    }

    protected testCandidate(candidate: KeyboardLayoutData, input: KeyValidationInput,
        property: 'value' | 'withShift' | 'withAltGr' | 'withShiftAltGr'): number {
        const keyMapping = candidate.raw.mapping[input.code];
        if (keyMapping && keyMapping[property]) {
            return keyMapping[property] === input.character ? 1 : 0;
        } else {
            return 0;
        }
    }

    getState(): KeyboardTesterState {
        const scores: { [id: string]: number } = {};
        for (let i = 0; i < this.scores.length; i++) {
            scores[getLayoutId(this.candidates[i])] = this.scores[i];
        }
        const testedInputs: { [key: string]: string } = {};
        for (const [key, character] of this.testedInputs.entries()) {
            testedInputs[key] = character;
        }
        return {
            scores,
            topScore: this.topScore,
            testedInputs
        };
    }

    setState(state: KeyboardTesterState): void {
        this.reset();
        if (state.scores) {
            const layoutIds = this.candidates.map(getLayoutId);
            for (const id in state.scores) {
                if (state.scores.hasOwnProperty(id)) {
                    const index = layoutIds.indexOf(id);
                    if (index > 0) {
                        this.scores[index] = state.scores[id];
                    }
                }
            }
        }
        if (state.topScore) {
            this.topScore = state.topScore;
        }
        if (state.testedInputs) {
            for (const key in state.testedInputs) {
                if (state.testedInputs.hasOwnProperty(key)) {
                    this.testedInputs.set(key, state.testedInputs[key]);
                }
            }
        }
    }

}

/**
 * API specified by https://wicg.github.io/keyboard-map/
 */
interface NavigatorExtension extends Navigator {
    keyboard: Keyboard;
}

interface Keyboard {
    getLayoutMap(): Promise<KeyboardLayoutMap>;
    addEventListener(type: 'layoutchange', listener: EventListenerOrEventListenerObject): void;
}

type KeyboardLayoutMap = Map<string, string>;

function getLayoutId(layout: KeyboardLayoutData): string {
    return `${layout.language}-${layout.name.replace(' ', '_')}-${layout.hardware}`;
}

/**
 * Keyboard layout files are expected to have the following name scheme:
 *     `language-name-hardware.json`
 *
 * - `language`: A language subtag according to IETF BCP 47
 * - `name`:     Display name of the keyboard layout (without dashes)
 * - `hardware`: `pc` or `mac`
 */
function loadLayout(fileName: string): KeyboardLayoutData {
    const [language, name, hardware] = fileName.split('-');
    return {
        name: name.replace('_', ' '),
        hardware: hardware as 'pc' | 'mac',
        language,
        // Webpack knows what to do here and it should bundle all files under `../../../src/common/keyboard/layouts/`
        // eslint-disable-next-line import/no-dynamic-require
        raw: require('../../../src/common/keyboard/layouts/' + fileName + '.json')
    };
}

function loadAllLayouts(): KeyboardLayoutData[] {
    // The order of keyboard layouts is relevant for autodetection. Layouts with
    // lower index have a higher chance of being selected.
    // The current ordering approach is to sort by estimated number of developers
    // in the respective country (taken from the Stack Overflow Developer Survey),
    // but keeping all layouts of the same language together.
    return [
        'en-US-pc',
        'en-US-mac',
        'en-Dvorak-pc',
        'en-Dvorak-mac',
        'en-Dvorak_Lefthanded-pc',
        'en-Dvorak_Lefthanded-mac',
        'en-Dvorak_Righthanded-pc',
        'en-Dvorak_Righthanded-mac',
        'en-Colemak-mac',
        'en-British-pc',
        'en-British-mac',
        'de-German-pc',
        'de-German-mac',
        'de-Swiss_German-pc',
        'de-Swiss_German-mac',
        'fr-French-pc',
        'fr-French-mac',
        'fr-Canadian_French-pc',
        'fr-Canadian_French-mac',
        'fr-Swiss_French-pc',
        'fr-Swiss_French-mac',
        'fr-Bepo-pc',
        'pt-Portuguese-pc',
        'pt-Portuguese-mac',
        'pt-Brazilian-mac',
        'pl-Polish-pc',
        'pl-Polish-mac',
        'nl-Dutch-pc',
        'nl-Dutch-mac',
        'es-Spanish-pc',
        'es-Spanish-mac',
        'it-Italian-pc',
        'it-Italian-mac',
        'sv-Swedish-pc',
        'sv-Swedish-mac',
        'tr-Turkish_Q-pc',
        'tr-Turkish_Q-mac',
        'cs-Czech-pc',
        'cs-Czech-mac',
        'ro-Romanian-pc',
        'ro-Romanian-mac',
        'da-Danish-pc',
        'da-Danish-mac',
        'nb-Norwegian-pc',
        'nb-Norwegian-mac',
        'hu-Hungarian-pc',
        'hu-Hungarian-mac'
    ].map(loadLayout);
}
