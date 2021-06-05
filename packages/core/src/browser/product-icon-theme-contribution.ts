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

import { ContributionProvider, MaybePromise, Disposable } from '../common';
import { inject, injectable, named } from 'inversify';
import { FrontendApplicationContribution } from './frontend-application';
import { ProductIconTheme, ProductIconThemeService } from './product-icon-theme-service';

export const ProductIconThemeContribution = Symbol('ProductIconThemeContribution');

export interface ProductIconThemeContribution {
    registerProductIconThemes(productIconThemes: ProductIconThemeService): MaybePromise<void>;
}

@injectable()
export class ProductIconThemeApplicationContribution implements FrontendApplicationContribution {
    @inject(ProductIconThemeService) protected readonly productIconThemes: ProductIconThemeService;

    @inject(ContributionProvider) @named(ProductIconThemeContribution) protected readonly productIconThemeContributions: ContributionProvider<ProductIconThemeContribution>;

    async onStart(): Promise<void> {
        for (const contribution of this.productIconThemeContributions.getContributions()) {
            await contribution.registerProductIconThemes(this.productIconThemes);
        }
    }
}

@injectable()
export class DefaultProductIconThemeContribution implements ProductIconTheme, ProductIconThemeContribution {
    readonly id = 'theia-product-icons';
    readonly label = 'Product Icons (Theia)';

    registerProductIconThemes(productIconThemes: ProductIconThemeService): MaybePromise<void> {
        productIconThemes.register(this);
    }
    activate(): Disposable {
        return Disposable.NULL;
    }
}
