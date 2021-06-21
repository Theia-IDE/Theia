/********************************************************************************
 * Copyright (C) 2019 Ericsson and others.
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { Event, Emitter } from '@theia/core/lib/common';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import {
    ApplyToKind, FileLocationKind, NamedProblemMatcher,
    ProblemPattern, ProblemMatcher, ProblemMatcherContribution, WatchingMatcher
} from '../common';
import { ProblemPatternRegistry } from './task-problem-pattern-registry';
import { Severity } from '@theia/core/lib/common/severity';

@injectable()
export class ProblemMatcherRegistry {

    private readonly matchers = new Map<string, NamedProblemMatcher>();
    private readyPromise: Promise<void>;

    @inject(ProblemPatternRegistry)
    protected readonly problemPatternRegistry: ProblemPatternRegistry;

    protected readonly onDidChangeProblemMatcherEmitter = new Emitter<void>();
    get onDidChangeProblemMatcher(): Event<void> {
        return this.onDidChangeProblemMatcherEmitter.event;
    }

    @postConstruct()
    protected init(): void {
        this.problemPatternRegistry.onReady().then(() => {
            this.fillDefaults();
            this.readyPromise = new Promise<void>((res, rej) => res(undefined));
            this.onDidChangeProblemMatcherEmitter.fire(undefined);
        });
    }

    onReady(): Promise<void> {
        return this.readyPromise;
    }

    /**
     * Add a problem matcher to the registry.
     *
     * @param definition the problem matcher to be added.
     */
    register(matcher: ProblemMatcherContribution): Disposable {
        if (!matcher.name) {
            console.error('Only named Problem Matchers can be registered.');
            return Disposable.NULL;
        }
        const toDispose = new DisposableCollection(Disposable.create(() => {
            /* mark as not disposed */
            this.onDidChangeProblemMatcherEmitter.fire(undefined);
        }));
        this.doRegister(matcher, toDispose).then(() => this.onDidChangeProblemMatcherEmitter.fire(undefined));
        return toDispose;
    }
    protected async doRegister(matcher: ProblemMatcherContribution, toDispose: DisposableCollection): Promise<void> {
        const problemMatcher = await this.getProblemMatcherFromContribution(matcher);
        if (toDispose.disposed) {
            return;
        }
        toDispose.push(this.add(problemMatcher as NamedProblemMatcher));
    }

    /**
     * Finds the problem matcher from the registry by its name.
     *
     * @param name the name of the problem matcher
     * @return the problem matcher. If the task definition is not found, `undefined` is returned.
     */
    get(name: string): NamedProblemMatcher | undefined {
        if (name.startsWith('$')) {
            return this.matchers.get(name.slice(1));
        }
        return this.matchers.get(name);
    }

    /**
     * Returns all registered problem matchers in the registry.
     */
    getAll(): NamedProblemMatcher[] {
        const all: NamedProblemMatcher[] = [];
        for (const matcherName of this.matchers.keys()) {
            all.push(this.get(matcherName)!);
        }
        all.sort((one, other) => one.name.localeCompare(other.name));
        return all;
    }

    /**
     * Transforms the `ProblemMatcherContribution` to a `ProblemMatcher`
     *
     * @return the problem matcher
     */
    async getProblemMatcherFromContribution(matcher: ProblemMatcherContribution): Promise<ProblemMatcher> {
        let baseMatcher: NamedProblemMatcher | undefined;
        if (matcher.base) {
            baseMatcher = this.get(matcher.base);
        }

        let fileLocation: FileLocationKind | undefined;
        let filePrefix: string | undefined;
        if (matcher.fileLocation === undefined) {
            fileLocation = baseMatcher ? baseMatcher.fileLocation : FileLocationKind.Relative;
            filePrefix = baseMatcher ? baseMatcher.filePrefix : '${workspaceFolder}';
        } else {
            const locationAndPrefix = this.getFileLocationKindAndPrefix(matcher);
            fileLocation = locationAndPrefix.fileLocation;
            filePrefix = locationAndPrefix.filePrefix;
        }

        const patterns: ProblemPattern[] = [];
        if (matcher.pattern) {
            if (typeof matcher.pattern === 'string') {
                await this.problemPatternRegistry.onReady();
                const registeredPattern = this.problemPatternRegistry.get(matcher.pattern);
                if (Array.isArray(registeredPattern)) {
                    patterns.push(...registeredPattern);
                } else if (!!registeredPattern) {
                    patterns.push(registeredPattern);
                }
            } else if (Array.isArray(matcher.pattern)) {
                patterns.push(...matcher.pattern.map(p => ProblemPattern.fromProblemPatternContribution(p)));
            } else {
                patterns.push(ProblemPattern.fromProblemPatternContribution(matcher.pattern));
            }
        } else if (baseMatcher) {
            if (Array.isArray(baseMatcher.pattern)) {
                patterns.push(...baseMatcher.pattern);
            } else {
                patterns.push(baseMatcher.pattern);
            }
        }

        let deprecated: boolean | undefined = matcher.deprecated;
        if (deprecated === undefined && baseMatcher) {
            deprecated = baseMatcher.deprecated;
        }

        let applyTo: ApplyToKind | undefined;
        if (matcher.applyTo === undefined) {
            applyTo = baseMatcher ? baseMatcher.applyTo : ApplyToKind.allDocuments;
        } else {
            applyTo = ApplyToKind.fromString(matcher.applyTo) || ApplyToKind.allDocuments;
        }

        let severity: Severity = Severity.fromValue(matcher.severity);
        if (matcher.severity === undefined && baseMatcher && baseMatcher.severity !== undefined) {
            severity = baseMatcher.severity;
        }
        let watching: WatchingMatcher | undefined = WatchingMatcher.fromWatchingMatcherContribution(matcher.background || matcher.watching);
        if (watching === undefined && baseMatcher) {
            watching = baseMatcher.watching;
        }
        const problemMatcher = {
            name: matcher.name || (baseMatcher ? baseMatcher.name : undefined),
            label: matcher.label || baseMatcher?.label || '',
            deprecated,
            owner: matcher.owner || (baseMatcher ? baseMatcher.owner : ''),
            source: matcher.source || (baseMatcher ? baseMatcher.source : undefined),
            applyTo,
            fileLocation,
            filePrefix,
            pattern: patterns,
            severity,
            watching
        };
        return problemMatcher;
    }

    private add(matcher: NamedProblemMatcher): Disposable {
        this.matchers.set(matcher.name, matcher);
        return Disposable.create(() => this.matchers.delete(matcher.name));
    }

    private getFileLocationKindAndPrefix(matcher: ProblemMatcherContribution): { fileLocation: FileLocationKind, filePrefix: string } {
        let fileLocation = FileLocationKind.Relative;
        let filePrefix = '${workspaceFolder}';
        if (matcher.fileLocation !== undefined) {
            if (Array.isArray(matcher.fileLocation)) {
                if (matcher.fileLocation.length > 0) {
                    const locationKind = FileLocationKind.fromString(matcher.fileLocation[0]);
                    if (matcher.fileLocation.length === 1 && locationKind === FileLocationKind.Absolute) {
                        fileLocation = locationKind;
                    } else if (matcher.fileLocation.length === 2 && locationKind === FileLocationKind.Relative && matcher.fileLocation[1]) {
                        fileLocation = locationKind;
                        filePrefix = matcher.fileLocation[1];
                    }
                }
            } else {
                const locationKind = FileLocationKind.fromString(matcher.fileLocation);
                if (locationKind) {
                    fileLocation = locationKind;
                    if (locationKind === FileLocationKind.Relative) {
                        filePrefix = '${workspaceFolder}';
                    }
                }
            }
        }
        return { fileLocation, filePrefix };
    }

    // copied from https://github.com/Microsoft/vscode/blob/1.33.1/src/vs/workbench/contrib/tasks/common/problemMatcher.ts
    private fillDefaults(): void {
        this.add({
            name: 'msCompile',
            label: 'Microsoft compiler problems',
            owner: 'msCompile',
            applyTo: ApplyToKind.allDocuments,
            fileLocation: FileLocationKind.Absolute,
            pattern: (this.problemPatternRegistry.get('msCompile'))!
        });

        this.add({
            name: 'lessCompile',
            label: 'Less problems',
            deprecated: true,
            owner: 'lessCompile',
            source: 'less',
            applyTo: ApplyToKind.allDocuments,
            fileLocation: FileLocationKind.Absolute,
            pattern: (this.problemPatternRegistry.get('lessCompile'))!,
            severity: Severity.Error
        });

        this.add({
            name: 'gulp-tsc',
            label: 'Gulp TSC Problems',
            owner: 'typescript',
            source: 'ts',
            applyTo: ApplyToKind.closedDocuments,
            fileLocation: FileLocationKind.Relative,
            filePrefix: '${workspaceFolder}',
            pattern: (this.problemPatternRegistry.get('gulp-tsc'))!
        });

        this.add({
            name: 'jshint',
            label: 'JSHint problems',
            owner: 'jshint',
            source: 'jshint',
            applyTo: ApplyToKind.allDocuments,
            fileLocation: FileLocationKind.Absolute,
            pattern: (this.problemPatternRegistry.get('jshint'))!
        });

        this.add({
            name: 'jshint-stylish',
            label: 'JSHint stylish problems',
            owner: 'jshint',
            source: 'jshint',
            applyTo: ApplyToKind.allDocuments,
            fileLocation: FileLocationKind.Absolute,
            pattern: (this.problemPatternRegistry.get('jshint-stylish'))!
        });

        this.add({
            name: 'eslint-compact',
            label: 'ESLint compact problems',
            owner: 'eslint',
            source: 'eslint',
            applyTo: ApplyToKind.allDocuments,
            fileLocation: FileLocationKind.Absolute,
            filePrefix: '${workspaceFolder}',
            pattern: (this.problemPatternRegistry.get('eslint-compact'))!
        });

        this.add({
            name: 'eslint-stylish',
            label: 'ESLint stylish problems',
            owner: 'eslint',
            source: 'eslint',
            applyTo: ApplyToKind.allDocuments,
            fileLocation: FileLocationKind.Absolute,
            pattern: (this.problemPatternRegistry.get('eslint-stylish'))!
        });

        this.add({
            name: 'go',
            label: 'Go problems',
            owner: 'go',
            source: 'go',
            applyTo: ApplyToKind.allDocuments,
            fileLocation: FileLocationKind.Relative,
            filePrefix: '${workspaceFolder}',
            pattern: (this.problemPatternRegistry.get('go'))!
        });
    }
}
