
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

interface PreferenceSelectInputProps {
    preferenceDisplayNode: Preference.NodeWithValueInSingleScope;
    setPreference: (preferenceName: string, preferenceValue: string | number | string[]) => Promise<void>;
}

export const PreferenceSelectInput: React.FC<PreferenceSelectInputProps> = ({ preferenceDisplayNode, setPreference }) => {
    const { id } = preferenceDisplayNode;
    const { value, data } = preferenceDisplayNode.preference;

    const externalValue = (value !== undefined ? value : data.defaultValue) || '';

    const [currentTimeout, setCurrentTimetout] = React.useState<number>(0);
    const [currentValue, setCurrentValue] = React.useState<string>(externalValue);

    React.useEffect(() => {
        setCurrentValue(externalValue);
    }, [externalValue]);

    const onChange = React.useCallback(e => {
        const { value: newValue } = e.target;
        clearTimeout(currentTimeout);
        const newTimeout = setTimeout(async () => {
            try {
                await setPreference(id, newValue);
            } catch {
                setCurrentValue(externalValue);
            }
        }, 250);
        setCurrentTimetout(Number(newTimeout));
        setCurrentValue(newValue);
    }, [currentTimeout, externalValue]);

    return (
        <select
            value={currentValue}
            className="theia-select"
            onChange={onChange}
            data-preference-id={id}
        >
            {preferenceDisplayNode.preference.data.enum!.map((option: string) => <option value={option} key={option}>{option}</option>)}
        </select>
    );
};
