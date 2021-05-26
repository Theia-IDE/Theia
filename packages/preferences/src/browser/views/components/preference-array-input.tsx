
/********************************************************************************
 * Copyright (C) 2020 Ericsson and others.
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

import * as React from '@theia/core/shared/react';
import { Preference } from '../../util/preference-types';

interface PreferenceArrayInputProps {
    preferenceDisplayNode: Preference.NodeWithValueInSingleScope;
    setPreference(preferenceName: string, preferenceValue: string[]): Promise<void>;
}

export const PreferenceArrayInput: React.FC<PreferenceArrayInputProps> = ({ preferenceDisplayNode, setPreference }) => {
    const values: string[] = [];
    if (Array.isArray(preferenceDisplayNode.preference.value)) {
        for (const preferenceValue of preferenceDisplayNode.preference.value) {
            if (typeof preferenceValue === 'string') {
                values.push(preferenceValue);
            }
        }
    }
    const { id: preferenceID } = preferenceDisplayNode;
    const [value, setValue] = React.useState('');

    const doSubmit = React.useCallback((): void => {
        if (value) {
            setPreference(preferenceID, [...values, value]);
            setValue('');
        }
    }, [values, value]);

    const handleEnter = React.useCallback((e: React.KeyboardEvent): void => {
        if (e.key === 'Enter') {
            e.preventDefault();
            doSubmit();
        }
    }, []);

    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
        setValue(e.target.value);
    }, []);

    const handleRemove = React.useCallback((e: React.MouseEvent | React.KeyboardEvent): void => {
        const target = e.currentTarget as HTMLSpanElement;
        const key = (e as React.KeyboardEvent).key;
        if (key && key !== 'Enter') {
            return;
        }

        const indexAttribute = target.getAttribute('data-index');
        const removalIndex = Number(indexAttribute);
        if (indexAttribute) {
            const newValues = [...values.slice(0, removalIndex), ...values.slice(removalIndex + 1)];
            setPreference(preferenceID, newValues);
        }
    }, []);

    return (
        <ul className="preference-array">
            {
                values.map((val: string, i: number): JSX.Element => (
                    <li className="preference-array-element" key={`${preferenceID}-li-${i}`}>
                        <span className="preference-array-element-val">{val}</span>
                        <span
                            className="preference-array-element-btn remove-btn"
                            onClick={handleRemove}
                            onKeyDown={handleRemove}
                            role="button"
                            tabIndex={0}
                            data-index={i}
                        >
                            <i className="preference-array-clear-item" />
                        </span>
                    </li>
                ))
            }
            <li>
                <input
                    className="preference-array-input theia-input"
                    type="text"
                    placeholder="Add Value..."
                    onKeyPress={handleEnter}
                    onChange={handleChange}
                    value={value}
                    aria-label="Preference String Input"
                />
                <span
                    className="preference-array-element-btn add-btn"
                    onClick={doSubmit}
                    onKeyDown={doSubmit}
                    role="button"
                    tabIndex={0}
                    aria-label="Submit Preference Input"
                >
                    <i className="fa fa-plus" />
                </span>
            </li>
        </ul>
    );
};
