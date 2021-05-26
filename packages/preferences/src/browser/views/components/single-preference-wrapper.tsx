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
import { Menu, PreferenceScope, PreferenceItem, PreferenceService, ContextMenuRenderer } from '@theia/core/lib/browser';
import { PreferenceSelectInput, PreferenceBooleanInput, PreferenceStringInput, PreferenceNumberInput, PreferenceJSONInput, PreferenceArrayInput } from '.';
import { Preference, PreferenceMenus } from '../../util/preference-types';

interface SinglePreferenceWrapperProps {
    contextMenuRenderer: ContextMenuRenderer;
    preferenceDisplayNode: Preference.NodeWithValueInAllScopes;
    currentScope: number;
    currentScopeURI: string;
    preferencesService: PreferenceService;
    openJSON(preferenceNode: Preference.NodeWithValueInAllScopes): void;
}

interface SinglePreferenceWrapperState {
    showCog: boolean;
    menuOpen: boolean;
}

export class SinglePreferenceWrapper extends React.Component<SinglePreferenceWrapperProps, SinglePreferenceWrapperState> {
    protected contextMenu: Menu;
    protected value: PreferenceItem | undefined;

    state: SinglePreferenceWrapperState = {
        showCog: false,
        menuOpen: false
    };

    protected handleOnCogClick = (e: React.MouseEvent | React.KeyboardEvent): void => {
        if (this.value !== undefined) {
            const target = (e.target as HTMLElement);
            const domRect = target.getBoundingClientRect();
            this.props.contextMenuRenderer.render({
                menuPath: PreferenceMenus.PREFERENCE_EDITOR_CONTEXT_MENU,
                anchor: { x: domRect.left, y: domRect.bottom },
                args: [{ id: this.props.preferenceDisplayNode.id, value: this.value }],
                onHide: this.setMenuHidden
            });
            this.setMenuShown();
        }
    };

    protected setMenuShown = () => {
        this.setState({ menuOpen: true });
    };

    protected setMenuHidden = () => {
        this.setState({ menuOpen: false });
    };

    protected showCog = () => {
        this.setState({ showCog: true });
    };

    protected hideCog = () => {
        this.setState({ showCog: false });
    };

    render(): React.ReactNode {
        const { preferenceDisplayNode } = this.props;
        const { preference: { data, values } } = preferenceDisplayNode;

        this.value = Preference.getValueInScope(values, this.props.currentScope) ?? data.defaultValue;

        const currentValueIsDefaultValue = this.value === data.defaultValue;

        const singlePreferenceValueDisplayNode = { ...preferenceDisplayNode, preference: { data, value: this.value } };
        const description = data.markdownDescription || data.description;
        if (preferenceDisplayNode.visible) {
            return (<li
                className='single-pref'
                id={`${preferenceDisplayNode.id}-editor`}
                key={preferenceDisplayNode.id}
                data-id={preferenceDisplayNode.id}
            >
                <div className="pref-name">
                    {preferenceDisplayNode.name}
                    {this.renderOtherModifiedScopes(singlePreferenceValueDisplayNode.id, values, this.props.currentScope, this.props.preferencesService)}
                </div>
                <div className={`pref-context-gutter ${!currentValueIsDefaultValue ? 'theia-mod-item-modified' : ''}`}
                    onMouseOver={this.showCog}
                    onMouseOut={this.hideCog}
                >
                    <i
                        className={`codicon codicon-settings-gear settings-context-menu-btn ${(this.state.showCog || this.state.menuOpen) ? 'show-cog' : ''}`}
                        aria-label="Open Context Menu"
                        role="button"
                        onClick={this.handleOnCogClick}
                        onKeyDown={this.handleOnCogClick}
                        title="More actions..."
                    />
                </div>
                <div
                    className={`pref-content-container ${data.type || 'open-json'}`}
                    onFocus={this.showCog}
                    onBlur={this.hideCog}
                >
                    {description && <div className='pref-description'>{description}</div>}
                    <div className='pref-input' >{this.getInputType(singlePreferenceValueDisplayNode)}</div>
                </div>
            </li>);
        } else {
            return <></>;
        }
    }

    protected openJSONForCurrentPreference = () => {
        this.props.openJSON(this.props.preferenceDisplayNode);
    };

    protected renderOtherModifiedScopes(
        id: string,
        preferenceValuesInAllScopes: Preference.ValuesInAllScopes | undefined,
        currentScope: number,
        service: PreferenceService): React.ReactNode[] | undefined {
        if (preferenceValuesInAllScopes) {
            return ['User', 'Workspace'].map((scope: 'User' | 'Workspace') => {
                const otherScope = PreferenceScope[scope];
                if (currentScope !== otherScope) {
                    const info = service.inspect<PreferenceItem>(id);
                    if (!info) {
                        return;
                    }

                    const defaultValue = info.defaultValue;
                    const currentValue = Preference.getValueInScope(info, currentScope);
                    const otherValue = Preference.getValueInScope(info, otherScope);
                    if (otherValue !== undefined && otherValue !== defaultValue) {

                        const bothOverridden = (
                            (currentValue !== defaultValue && currentValue !== undefined) &&
                            (otherValue !== defaultValue && otherValue !== undefined)
                        );

                        const message = bothOverridden ? 'Also modified in:' : 'Modified in:';
                        return <i key={`modified-in-${scope}-alert`}><span> ({message} <span className='settings-scope-underlined'>{scope}</span>)</span></i>;
                    }

                }
            });
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected setPreference = async (preferenceName: string, preferenceValue: any): Promise<void> => {
        await this.props.preferencesService.set(preferenceName, preferenceValue, this.props.currentScope, this.props.currentScopeURI);
    };

    getInputType = (preferenceDisplayNode: Preference.NodeWithValueInSingleScope): React.ReactNode => {
        const { type, items } = preferenceDisplayNode.preference.data;
        if (preferenceDisplayNode.preference.data.enum) {
            return <PreferenceSelectInput
                preferenceDisplayNode={preferenceDisplayNode}
                setPreference={this.setPreference}
            />;
        } if (type === 'boolean') {
            return <PreferenceBooleanInput
                preferenceDisplayNode={preferenceDisplayNode}
                setPreference={this.setPreference}
            />;
        } if (type === 'string') {
            return <PreferenceStringInput
                preferenceDisplayNode={preferenceDisplayNode}
                setPreference={this.setPreference}
            />;
        } if (type === 'number' || type === 'integer') {
            return <PreferenceNumberInput
                preferenceDisplayNode={preferenceDisplayNode}
                setPreference={this.setPreference}
            />;
        } if (type === 'array') {
            if (items && items.type === 'string') {
                return <PreferenceArrayInput
                    preferenceDisplayNode={preferenceDisplayNode}
                    setPreference={this.setPreference}
                />;
            }
            return <PreferenceJSONInput
                preferenceDisplayNode={preferenceDisplayNode}
                onClick={this.openJSONForCurrentPreference}
            />;
        } if (type === 'object') {
            return <PreferenceJSONInput
                preferenceDisplayNode={preferenceDisplayNode}
                onClick={this.openJSONForCurrentPreference}
            />;
        }
        return <PreferenceJSONInput
            preferenceDisplayNode={preferenceDisplayNode}
            onClick={this.openJSONForCurrentPreference}
        />;
    };
}
