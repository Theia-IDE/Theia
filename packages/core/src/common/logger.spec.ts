/*
 * Copyright (C) 2018 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import 'reflect-metadata';

import { MockLogger } from './test/mock-logger';
import { setRootLogger, unsetRootLogger } from './logger';

// tslint:disable:no-unused-expression

describe('logger', () => {

    test('window is not defined', () => {
        expect(() => { window; }).toThrow(/window is not defined/);
    });

    test('window is not defined when converting to boolean', () => {
        expect(() => { !!window; }).toThrow(/window is not defined/);
    });

    test('window is not defined safe', () => {
        expect(() => { typeof window !== 'undefined'; }).not.toThrow(ReferenceError);
    });

    test(
        'setting the root logger should not throw an error when the window is not defined',
        () => {
            expect(() => {
                try {
                    setRootLogger(new MockLogger());
                } finally {
                    unsetRootLogger();
                }
            }
            ).not.toThrow(ReferenceError);
        }
    );

});
