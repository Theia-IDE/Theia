/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
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

import { inject, injectable } from 'inversify';
import { Emitter } from '../common';
import { Disposable, DisposableCollection } from '../common/disposable';
import { FrontendApplicationConfigProvider } from './frontend-application-config-provider';
import { DidChangeLabelEvent, LabelProviderContribution } from './label-provider';

export interface ProductIconThemeDefinition {
    readonly id: string
    readonly label: string
    readonly description?: string
}

export interface ProductIconTheme extends ProductIconThemeDefinition {
    activate(): Disposable;
}

@injectable()
export class NoneProductIconTheme implements ProductIconTheme, LabelProviderContribution {

    readonly id = 'default';
    readonly label = 'Default';
    readonly description = 'Default';

    protected readonly onDidChangeEmitter = new Emitter<DidChangeLabelEvent>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    protected readonly toDeactivate = new DisposableCollection();

    activate(): Disposable {
        if (this.toDeactivate.disposed) {
            this.toDeactivate.push(Disposable.create(() => this.fireDidChange()));
            this.fireDidChange();
        }
        return this.toDeactivate;
    }

    protected fireDidChange(): void {
        this.onDidChangeEmitter.fire({ affects: () => true });
    }

    canHandle(): number {
        if (this.toDeactivate.disposed) {
            return 0;
        }
        return Number.MAX_SAFE_INTEGER;
    }
}

@injectable()
export class ProductIconThemeService {
    protected readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    protected readonly productIconThemes = new Map<string, ProductIconTheme>();

    get ids(): IterableIterator<string> {
        return this.productIconThemes.keys();
    }
    get definitions(): IterableIterator<ProductIconThemeDefinition> {
        return this.productIconThemes.values();
    }
    getDefinition(id: string): ProductIconThemeDefinition | undefined {
        return this.productIconThemes.get(id);
    }

    protected readonly onDidChangeCurrentEmitter = new Emitter<string>();
    readonly onDidChangeCurrent = this.onDidChangeCurrentEmitter.event;

    @inject(NoneProductIconTheme) protected readonly noneProductIconTheme: NoneProductIconTheme;
    protected readonly toDeactivate = new DisposableCollection();

    register(productIconTheme: ProductIconTheme): Disposable {
        if (this.productIconThemes.has(productIconTheme.id)) {
            console.warn(new Error(`Product Icon theme '${productIconTheme.id}' has already been registered, skipping.`));
            return Disposable.NULL;
        }
        this.productIconThemes.set(productIconTheme.id, productIconTheme);
        this.onDidChangeEmitter.fire(undefined);
        if (this.toDeactivate.disposed
            && window.localStorage.getItem('productIconTheme') === productIconTheme.id) {
            this.setCurrent(productIconTheme);
        }
        return Disposable.create(() => this.unregister(productIconTheme.id));
    }

    unregister(id: string): ProductIconTheme | undefined {
        const productIconTheme = this.productIconThemes.get(id);
        if (!productIconTheme) {
            return undefined;
        }
        this.productIconThemes.delete(id);
        if (window.localStorage.getItem('productIconTheme') === id) {
            window.localStorage.removeItem('productIconTheme');
            this.onDidChangeCurrentEmitter.fire(this.default.id);
        }
        this.onDidChangeEmitter.fire(undefined);
        return productIconTheme;
    }

    get current(): string {
        return this.getCurrent().id;
    }

    set current(id: string) {
        const newCurrent = this.productIconThemes.get(id) || this.default;
        if (this.getCurrent().id !== newCurrent.id) {
            this.setCurrent(newCurrent);
        }
    }

    protected getCurrent(): ProductIconTheme {
        const id = window.localStorage.getItem('productIconTheme');
        return id && this.productIconThemes.get(id) || this.default;
    }

    protected setCurrent(current: ProductIconTheme): void {
        window.localStorage.setItem('productIconTheme', current.id);
        this.toDeactivate.dispose();
        this.toDeactivate.push(current.activate());
        this.onDidChangeCurrentEmitter.fire(current.id);
    }

    get default(): ProductIconTheme {
        return this.productIconThemes.get(FrontendApplicationConfigProvider.get().defaultProductIconTheme) || this.noneProductIconTheme;
    }
    protected load(): string | undefined {
        return window.localStorage.getItem('productIconTheme') || undefined;
    }
}
