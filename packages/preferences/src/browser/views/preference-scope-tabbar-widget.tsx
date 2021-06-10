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

import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { TabBar, Widget, Title } from '@theia/core/shared/@phosphor/widgets';
import { PreferenceScope, Message, ContextMenuRenderer, LabelProvider, StatefulWidget } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import URI from '@theia/core/lib/common/uri';
import { FileStat } from '@theia/filesystem/lib/common/files';
import { PreferenceScopeCommandManager, FOLDER_SCOPE_MENU_PATH } from '../util/preference-scope-command-manager';
import { Preference } from '../util/preference-types';
import { Emitter } from '@theia/core';

const USER_TAB_LABEL = 'User';
const USER_TAB_INDEX = PreferenceScope[USER_TAB_LABEL].toString();
const WORKSPACE_TAB_LABEL = 'Workspace';
const WORKSPACE_TAB_INDEX = PreferenceScope[WORKSPACE_TAB_LABEL].toString();
const FOLDER_TAB_LABEL = 'Folder';
const FOLDER_TAB_INDEX = PreferenceScope[FOLDER_TAB_LABEL].toString();

const PREFERENCE_TAB_CLASSNAME = 'preferences-scope-tab';
const GENERAL_FOLDER_TAB_CLASSNAME = 'preference-folder';
const LABELED_FOLDER_TAB_CLASSNAME = 'preferences-folder-tab';
const FOLDER_DROPDOWN_CLASSNAME = 'preferences-folder-dropdown';
const FOLDER_DROPDOWN_ICON_CLASSNAME = 'preferences-folder-dropdown-icon';
const TABBAR_UNDERLINE_CLASSNAME = 'tabbar-underline';
const SINGLE_FOLDER_TAB_CLASSNAME = `${PREFERENCE_TAB_CLASSNAME} ${GENERAL_FOLDER_TAB_CLASSNAME} ${LABELED_FOLDER_TAB_CLASSNAME}`;
const UNSELECTED_FOLDER_DROPDOWN_CLASSNAME = `${PREFERENCE_TAB_CLASSNAME} ${GENERAL_FOLDER_TAB_CLASSNAME} ${FOLDER_DROPDOWN_CLASSNAME}`;
const SELECTED_FOLDER_DROPDOWN_CLASSNAME = `${PREFERENCE_TAB_CLASSNAME} ${GENERAL_FOLDER_TAB_CLASSNAME} ${LABELED_FOLDER_TAB_CLASSNAME} ${FOLDER_DROPDOWN_CLASSNAME}`;

export interface PreferencesScopeTabBarState {
    scopeDetails: Preference.SelectedScopeDetails;
}

@injectable()
export class PreferencesScopeTabBar extends TabBar<Widget> implements StatefulWidget {

    static ID = 'preferences-scope-tab-bar';
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(PreferenceScopeCommandManager) protected readonly preferencesMenuFactory: PreferenceScopeCommandManager;
    @inject(ContextMenuRenderer) protected readonly contextMenuRenderer: ContextMenuRenderer;
    @inject(LabelProvider) protected readonly labelProvider: LabelProvider;

    protected readonly onScopeChangedEmitter = new Emitter<Preference.SelectedScopeDetails>();
    readonly onScopeChanged = this.onScopeChangedEmitter.event;

    protected folderTitle: Title<Widget>;
    protected currentWorkspaceRoots: FileStat[] = [];
    protected currentSelection: Preference.SelectedScopeDetails = Preference.DEFAULT_SCOPE;
    protected editorScrollAtTop = true;

    get currentScope(): Preference.SelectedScopeDetails {
        return this.currentSelection;
    }

    get availableTitles(): Title.Dataset[] {
        const availableTitles: Title.Dataset[] = [];
        for (const title of this.titles) {
            availableTitles.push(title.dataset);
        }
        return availableTitles;
    }

    setNewScopeSelection(newSelection: Preference.SelectedScopeDetails): void {
        const newIndex = this.titles.findIndex(title => title.dataset.scope === newSelection.scope);
        if (newIndex !== -1) {
            this.currentSelection = newSelection;
            this.currentIndex = newIndex;
            if (newSelection.scope === PreferenceScope.Folder.toString()) {
                this.addOrUpdateFolderTab();
            }
            this.emitNewScope();
        }
    }

    @postConstruct()
    protected init(): void {
        this.id = PreferencesScopeTabBar.ID;
        this.setupInitialDisplay();
        this.tabActivateRequested.connect((sender, args) => {
            if (!!args.title) {
                this.setNewScopeSelection(args.title.dataset as unknown as Preference.SelectedScopeDetails);
            }
        });
        this.workspaceService.onWorkspaceChanged(newRoots => {
            this.doUpdateDisplay(newRoots);
        });
        this.workspaceService.onWorkspaceLocationChanged(() => this.updateWorkspaceTab());
        const tabUnderline = document.createElement('div');
        tabUnderline.className = TABBAR_UNDERLINE_CLASSNAME;
        this.node.append(tabUnderline);
    }

    protected setupInitialDisplay(): void {
        this.addUserTab();
        if (this.workspaceService.workspace) {
            this.addWorkspaceTab(this.workspaceService.workspace);
        }
        this.addOrUpdateFolderTab();
    }

    protected onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.addTabIndexToTabs();
    }

    protected addTabIndexToTabs(): void {
        this.node.querySelectorAll('li').forEach((tab, index) => {
            tab.tabIndex = 0;
            tab.onkeypress = () => {
                if (tab.className.includes(GENERAL_FOLDER_TAB_CLASSNAME) && this.currentWorkspaceRoots.length > 1) {
                    const tabRect = tab.getBoundingClientRect();
                    this.openContextMenu(tabRect, tab, 'keypress');
                } else {
                    this.setNewScopeSelection(this.titles[index].dataset as unknown as Preference.SelectedScopeDetails);
                }
            };
        });
    }

    protected addUserTab(): void {
        this.addTab(new Title({
            dataset: { uri: '', scope: USER_TAB_INDEX },
            label: USER_TAB_LABEL,
            owner: this,
            className: PREFERENCE_TAB_CLASSNAME
        }));
    }

    protected addWorkspaceTab(currentWorkspace: FileStat): Title<Widget> {
        const workspaceTabTitle = new Title({
            dataset: this.getWorkspaceDataset(currentWorkspace),
            label: WORKSPACE_TAB_LABEL,
            owner: this,
            className: PREFERENCE_TAB_CLASSNAME,
        });
        this.addTab(workspaceTabTitle);
        return workspaceTabTitle;
    }

    protected getWorkspaceDataset(currentWorkspace: FileStat): Preference.SelectedScopeDetails {
        const { resource, isDirectory } = currentWorkspace;
        const scope = WORKSPACE_TAB_INDEX;
        const activeScopeIsFolder = isDirectory.toString();
        return { uri: resource.toString(), activeScopeIsFolder, scope };
    }

    protected addOrUpdateFolderTab(): void {
        if (!!this.workspaceService.workspace) {
            this.currentWorkspaceRoots = this.workspaceService.tryGetRoots();
            const multipleFolderRootsAreAvailable = this.currentWorkspaceRoots && this.currentWorkspaceRoots.length > 1;
            const noFolderRootsAreAvailable = this.currentWorkspaceRoots.length === 0;
            const shouldShowFoldersSeparately = this.workspaceService.saved;

            if (!noFolderRootsAreAvailable) {
                if (!this.folderTitle) {
                    this.folderTitle = new Title({
                        label: '',
                        caption: FOLDER_TAB_LABEL,
                        owner: this,
                    });
                }

                this.setFolderTitleProperties(multipleFolderRootsAreAvailable);
                this.getFolderContextMenu(this.currentWorkspaceRoots);
                if (multipleFolderRootsAreAvailable || shouldShowFoldersSeparately) {
                    this.addTab(this.folderTitle);
                }
            } else {
                const folderTabIndex = this.titles.findIndex(title => title.caption === FOLDER_TAB_LABEL);

                if (folderTabIndex > -1) {
                    this.removeTabAt(folderTabIndex);
                }
            }
        }
    }

    protected setFolderTitleProperties(multipleFolderRootsAreAvailable: boolean): void {
        this.folderTitle.iconClass = multipleFolderRootsAreAvailable ? FOLDER_DROPDOWN_ICON_CLASSNAME : '';
        if (this.currentSelection.scope === FOLDER_TAB_INDEX) {
            this.folderTitle.label = this.labelProvider.getName(new URI(this.currentSelection.uri));
            this.folderTitle.dataset = { ...this.currentSelection, folderTitle: 'true' };
            this.folderTitle.className = multipleFolderRootsAreAvailable ? SELECTED_FOLDER_DROPDOWN_CLASSNAME : SINGLE_FOLDER_TAB_CLASSNAME;
        } else {
            const singleFolderRoot = this.currentWorkspaceRoots[0].resource;
            const singleFolderLabel = this.labelProvider.getName(singleFolderRoot);
            const defaultURI = multipleFolderRootsAreAvailable ? '' : singleFolderRoot.toString();
            this.folderTitle.label = multipleFolderRootsAreAvailable ? FOLDER_TAB_LABEL : singleFolderLabel;
            this.folderTitle.className = multipleFolderRootsAreAvailable ? UNSELECTED_FOLDER_DROPDOWN_CLASSNAME : SINGLE_FOLDER_TAB_CLASSNAME;
            this.folderTitle.dataset = { folderTitle: 'true', scope: FOLDER_TAB_INDEX, uri: defaultURI };
        }
    }

    protected folderSelectionCallback = (newScope: Preference.SelectedScopeDetails): void => { this.setNewScopeSelection(newScope); };

    protected getFolderContextMenu(workspaceRoots = this.workspaceService.tryGetRoots()): void {
        this.preferencesMenuFactory.createFolderWorkspacesMenu(workspaceRoots, this.currentSelection.uri);
    }

    handleEvent(e: Event): void {
        const folderTab = this.contentNode.querySelector(`.${GENERAL_FOLDER_TAB_CLASSNAME}`);
        if (folderTab && folderTab.contains(e.target as HTMLElement) && this.currentWorkspaceRoots.length > 1) {
            const tabRect = folderTab.getBoundingClientRect();
            this.openContextMenu(tabRect, (folderTab as HTMLElement), 'click');
            return;
        }
        super.handleEvent(e);
    }

    protected openContextMenu(tabRect: DOMRect | ClientRect, folderTabNode: HTMLElement, source: 'click' | 'keypress'): void {
        this.contextMenuRenderer.render({
            menuPath: FOLDER_SCOPE_MENU_PATH,
            anchor: { x: tabRect.left, y: tabRect.bottom },
            args: [this.folderSelectionCallback, 'from-tabbar'],
            onHide: () => {
                if (source === 'click') { folderTabNode.blur(); }
            }
        });
    }

    protected doUpdateDisplay(newRoots: FileStat[]): void {
        const folderWasRemoved = newRoots.length < this.currentWorkspaceRoots.length;
        this.currentWorkspaceRoots = newRoots;
        if (folderWasRemoved) {
            const removedFolderWasSelectedScope = !this.currentWorkspaceRoots.some(root => root.resource.toString() === this.currentSelection.uri);
            if (removedFolderWasSelectedScope) {
                this.setNewScopeSelection(Preference.DEFAULT_SCOPE);
            }
        }
        this.updateWorkspaceTab();
        this.addOrUpdateFolderTab();
    }

    protected updateWorkspaceTab(): void {
        const currentWorkspace = this.workspaceService.workspace;
        if (currentWorkspace) {
            const workspaceTitle = this.titles.find(title => title.label === WORKSPACE_TAB_LABEL) ?? this.addWorkspaceTab(currentWorkspace);
            workspaceTitle.dataset = this.getWorkspaceDataset(currentWorkspace);
            if (this.currentSelection.scope === PreferenceScope.Workspace.toString()) {
                this.setNewScopeSelection(workspaceTitle.dataset as Preference.SelectedScopeDetails);
            }
        }
    }

    protected emitNewScope(): void {
        this.onScopeChangedEmitter.fire(this.currentSelection);
    }

    storeState(): PreferencesScopeTabBarState {
        return {
            scopeDetails: this.currentScope
        };
    }

    restoreState(oldState: PreferencesScopeTabBarState): void {
        this.setNewScopeSelection(oldState.scopeDetails);
    }
}
