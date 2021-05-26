
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

interface PreferenceNumberInputProps {
    preferenceDisplayNode: Preference.NodeWithValueInSingleScope;
    setPreference(preferenceName: string, preferenceValue: number): Promise<void>;
}

export const PreferenceNumberInput: React.FC<PreferenceNumberInputProps> = ({ preferenceDisplayNode, setPreference }) => {
    const { id } = preferenceDisplayNode;
    const { data, value } = preferenceDisplayNode.preference;

    const externalValue = (value !== undefined ? value : data.defaultValue) ?? '';

    const [currentTimeout, setCurrentTimetout] = React.useState<number>(0);
    const [currentValue, setCurrentValue] = React.useState<string>(externalValue);
    const [validationMessage, setValidationMessage] = React.useState<string>('');

    React.useEffect(() => {
        setCurrentValue(externalValue);
    }, [externalValue]);

    const onBlur = React.useCallback(() => {
        setCurrentValue(externalValue);
        setValidationMessage('');
    }, [externalValue]);

    const onChange = React.useCallback(e => {
        clearTimeout(currentTimeout);
        const { value: newValue } = e.target;
        setCurrentValue(newValue);
        const { value: inputValue, message } = getInputValidation(newValue);
        setValidationMessage(message);
        if (!isNaN(inputValue)) {
            const newTimeout = setTimeout(() => setPreference(id, inputValue), 750);
            setCurrentTimetout(Number(newTimeout));
        }
    }, [currentTimeout]);

    /**
     * Validate the input value.
     * @param input the input value.
     */
    const getInputValidation = (input: string): {
        value: number, // the numeric value of the input. `NaN` if there is an error.
        message: string // the error message to display.
    } => {
        const inputValue = Number(input);
        const errorMessages: string[] = [];

        if (input === '' || isNaN(inputValue)) {
            return { value: NaN, message: 'Value must be a number.' };
        }
        if (data.minimum && inputValue < data.minimum) {
            errorMessages.push(`Value must be greater than or equal to ${data.minimum}.`);
        };
        if (data.maximum && inputValue > data.maximum) {
            errorMessages.push(`Value must be less than or equal to ${data.maximum}.`);
        };
        if (data.type === 'integer' && inputValue % 1 !== 0) {
            errorMessages.push('Value must be an integer.');
        }

        return {
            value: errorMessages.length ? NaN : inputValue,
            message: errorMessages.join(' ')
        };
    };

    return (
        <div className='pref-input-container'>
            <input
                type="number"
                className="theia-input"
                pattern="[0-9]*"
                value={currentValue}
                onChange={onChange}
                onBlur={onBlur}
                data-preference-id={id}
            />
            {!!validationMessage.length ? <div className='pref-error-notification'>{validationMessage}</div> : undefined}
        </div>
    );
};
