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

import { postConstruct, injectable, inject } from '@theia/core/shared/inversify';
import { Panel, Widget, Message, StatefulWidget, Title } from '@theia/core/lib/browser';
import { PreferencesEditorState, PreferencesEditorWidget } from './preference-editor-widget';
import { PreferencesTreeWidget } from './preference-tree-widget';
import { PreferencesSearchbarState, PreferencesSearchbarWidget } from './preference-searchbar-widget';
import { PreferencesScopeTabBar, PreferencesScopeTabBarState } from './preference-scope-tabbar-widget';
import { Preference } from '../util/preference-types';

const SHADOW_CLASSNAME = 'with-shadow';

interface PreferencesWidgetState {
    scopeTabBarState: PreferencesScopeTabBarState,
    editorState: PreferencesEditorState,
    searchbarWidgetState: PreferencesSearchbarState,
}

@injectable()
export class PreferencesWidget extends Panel implements StatefulWidget {
    /**
     * The widget `id`.
     */
    static readonly ID = 'settings_widget';
    /**
     * The widget `label` which is used for display purposes.
     */
    static readonly LABEL = 'Preferences';

    @inject(PreferencesEditorWidget) protected readonly editorWidget: PreferencesEditorWidget;
    @inject(PreferencesTreeWidget) protected readonly treeWidget: PreferencesTreeWidget;
    @inject(PreferencesSearchbarWidget) protected readonly searchbarWidget: PreferencesSearchbarWidget;
    @inject(PreferencesScopeTabBar) protected readonly tabBarWidget: PreferencesScopeTabBar;

    get currentScope(): Preference.SelectedScopeDetails {
        return this.tabBarWidget.currentScope;
    }

    get availableTitles(): Title.Dataset[] {
        return this.tabBarWidget.availableTitles;
    }

    setScopeSelection(selection: Preference.SelectedScopeDetails): void {
        this.tabBarWidget.setNewScopeSelection(selection);
    }

    updateSearchTerm(term: string): void {
        this.searchbarWidget.updateSearchTerm(term);
    }

    protected onResize(msg: Widget.ResizeMessage): void {
        super.onResize(msg);
        if (msg.width < 600 && this.treeWidget && !this.treeWidget.isHidden) {
            this.treeWidget.hide();
            this.editorWidget.addClass('full-pane');
        } else if (msg.width >= 600 && this.treeWidget && this.treeWidget.isHidden) {
            this.treeWidget.show();
            this.editorWidget.removeClass('full-pane');
        }
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.searchbarWidget.focus();
    }

    @postConstruct()
    protected init(): void {
        this.id = PreferencesWidget.ID;
        this.title.label = PreferencesWidget.LABEL;
        this.title.closable = true;
        this.addClass('theia-settings-container');
        this.title.iconClass = 'fa fa-sliders';

        this.searchbarWidget.addClass('preferences-searchbar-widget');
        this.addWidget(this.searchbarWidget);

        this.tabBarWidget.addClass('preferences-tabbar-widget');
        this.addWidget(this.tabBarWidget);

        this.treeWidget.addClass('preferences-tree-widget');
        this.addWidget(this.treeWidget);

        this.editorWidget.addClass('preferences-editor-widget');
        this.addWidget(this.editorWidget);
        this.editorWidget.onEditorDidScroll(editorIsAtTop => {
            if (editorIsAtTop) {
                this.tabBarWidget.removeClass(SHADOW_CLASSNAME);
            } else {
                this.tabBarWidget.addClass(SHADOW_CLASSNAME);
            }
        });

        this.update();
    }

    storeState(): PreferencesWidgetState {
        return {
            scopeTabBarState: this.tabBarWidget.storeState(),
            editorState: this.editorWidget.storeState(),
            searchbarWidgetState: this.searchbarWidget.storeState(),
        };
    }

    restoreState(state: PreferencesWidgetState): void {
        this.tabBarWidget.restoreState(state.scopeTabBarState);
        this.editorWidget.restoreState(state.editorState);
        this.searchbarWidget.restoreState(state.searchbarWidgetState);
    }
}
