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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { CompositeTreeNode, PreferenceSchemaProvider, OVERRIDE_PROPERTY_PATTERN, PreferenceDataProperty } from '@theia/core/lib/browser';
import { PreferenceConfigurations } from '@theia/core/lib/browser/preferences/preference-configurations';
import { Emitter } from '@theia/core';
import debounce = require('@theia/core/shared/lodash.debounce');
import { Preference } from './preference-types';

export const COMMONLY_USED_SECTION_PREFIX = 'commonly-used';
@injectable()
export class PreferenceTreeGenerator {

    @inject(PreferenceSchemaProvider) protected readonly schemaProvider: PreferenceSchemaProvider;
    @inject(PreferenceConfigurations) protected readonly preferenceConfigs: PreferenceConfigurations;

    protected _root: CompositeTreeNode;

    protected readonly onSchemaChangedEmitter = new Emitter<CompositeTreeNode>();
    readonly onSchemaChanged = this.onSchemaChangedEmitter.event;
    protected readonly commonlyUsedPreferences = [
        'editor.autoSave', 'editor.autoSaveDelay', 'editor.fontSize',
        'editor.fontFamily', 'editor.tabSize', 'editor.renderWhitespace',
        'editor.cursorStyle', 'editor.multiCursorModifier', 'editor.insertSpaces',
        'editor.wordWrap', 'files.exclude', 'files.associations'
    ];
    protected readonly topLevelCategories = new Map([
        [COMMONLY_USED_SECTION_PREFIX, 'Commonly Used'],
        ['editor', 'Text Editor'],
        ['workbench', 'Workbench'],
        ['window', 'Window'],
        ['features', 'Features'],
        ['application', 'Application'],
        ['extensions', 'Extensions']
    ]);
    protected readonly sectionAssignments = new Map([
        ['comments', 'features'],
        ['debug', 'features'],
        ['diffEditor', 'editor'],
        ['explorer', 'features'],
        ['extensions', 'features'],
        ['files', 'editor'],
        ['hosted-plugin', 'features'],
        ['keyboard', 'application'],
        ['output', 'features'],
        ['problems', 'features'],
        ['preview', 'features'],
        ['search', 'features'],
        ['task', 'features'],
        ['terminal', 'features'],
        ['webview', 'features'],
        ['workspace', 'application'],
    ]);
    protected readonly defaultTopLevelCategory = 'extensions';

    get root(): CompositeTreeNode {
        return this._root ?? this.generateTree();
    }

    @postConstruct()
    protected async init(): Promise<void> {
        await this.schemaProvider.ready;
        this.schemaProvider.onDidPreferenceSchemaChanged(() => this.handleChangedSchema());
        this.handleChangedSchema();
    }

    generateTree(): CompositeTreeNode {
        const preferencesSchema = this.schemaProvider.getCombinedSchema();
        const propertyNames = Object.keys(preferencesSchema.properties);
        const groups = new Map<string, Preference.CompositeTreeNode>();
        const root = this.createRootNode();

        for (const id of this.topLevelCategories.keys()) {
            this.getOrCreatePreferencesGroup(id, id, root, groups);
        }
        const commonlyUsed = this.getOrCreatePreferencesGroup(COMMONLY_USED_SECTION_PREFIX, COMMONLY_USED_SECTION_PREFIX, root, groups);
        for (const preference of this.commonlyUsedPreferences) {
            if (preference in preferencesSchema.properties) {
                this.createLeafNode(preference, commonlyUsed, preferencesSchema.properties[preference]);
            }
        }
        for (const propertyName of propertyNames) {
            if (!this.preferenceConfigs.isSectionName(propertyName) && !OVERRIDE_PROPERTY_PATTERN.test(propertyName)) {
                const labels = propertyName.split('.');
                const groupID = this.getGroupName(labels);
                const subgroupName = this.getSubgroupName(labels, groupID);
                const subgroupID = [groupID, subgroupName].join('.');
                const toplevelParent = this.getOrCreatePreferencesGroup(groupID, groupID, root, groups);
                const immediateParent = subgroupName && this.getOrCreatePreferencesGroup(subgroupID, groupID, toplevelParent, groups);
                this.createLeafNode(propertyName, immediateParent || toplevelParent, preferencesSchema.properties[propertyName]);
            }
        }

        for (const group of groups.values()) {
            if (group.id !== `${COMMONLY_USED_SECTION_PREFIX}@${COMMONLY_USED_SECTION_PREFIX}`) {
                (group.children as Preference.TreeNode[]).sort((a, b) => {
                    const aIsComposite = CompositeTreeNode.is(a);
                    const bIsComposite = CompositeTreeNode.is(b);
                    if (aIsComposite && !bIsComposite) {
                        return 1;
                    }
                    if (bIsComposite && !aIsComposite) {
                        return -1;
                    }
                    return a.id.localeCompare(b.id);
                });
            }
        }

        this._root = root;
        return root;
    };

    protected getGroupName(labels: string[]): string {
        const defaultGroup = labels[0];
        if (this.topLevelCategories.has(defaultGroup)) {
            return defaultGroup;
        }
        const assignedGroup = this.sectionAssignments.get(defaultGroup);
        if (assignedGroup) {
            return assignedGroup;
        }
        return this.defaultTopLevelCategory;
    }

    protected getSubgroupName(labels: string[], computedGroupName: string): string | undefined {
        if (computedGroupName !== labels[0]) {
            return labels[0];
        } else if (labels.length > 2) {
            return labels[1];
        }
    }

    doHandleChangedSchema(): void {
        const newTree = this.generateTree();
        this.onSchemaChangedEmitter.fire(newTree);
    }

    handleChangedSchema = debounce(this.doHandleChangedSchema, 200);

    protected createRootNode(): CompositeTreeNode {
        return {
            id: 'root-node-id',
            name: '',
            parent: undefined,
            visible: true,
            children: []
        };
    }

    protected createLeafNode(property: string, preferencesGroup: Preference.CompositeTreeNode, data: PreferenceDataProperty): Preference.LeafNode {
        const { group } = Preference.TreeNode.getGroupAndIdFromNodeId(preferencesGroup.id);
        const newNode = {
            id: `${group}@${property}`,
            preferenceId: property,
            parent: preferencesGroup,
            visible: true,
            preference: { data },
            depth: Preference.TreeNode.isTopLevel(preferencesGroup) ? 1 : 2,
        };
        CompositeTreeNode.addChild(preferencesGroup, newNode);
        return newNode;
    }

    protected createPreferencesGroup(id: string, group: string, root: CompositeTreeNode): Preference.CompositeTreeNode {
        const newNode = {
            id: `${group}@${id}`,
            visible: true,
            parent: root,
            children: [],
            expanded: false,
            selected: false,
            depth: 0,
        };
        const isTopLevel = Preference.TreeNode.isTopLevel(newNode);
        if (!isTopLevel) {
            delete (newNode as Partial<typeof newNode>).expanded;
        }
        newNode.depth = isTopLevel ? 0 : 1;
        CompositeTreeNode.addChild(root, newNode);
        return newNode;
    }

    getCustomLabelFor(id: string): string | undefined {
        return this.topLevelCategories.get(id);
    }

    protected getOrCreatePreferencesGroup(id: string, group: string, root: CompositeTreeNode, groups: Map<string, Preference.CompositeTreeNode>): Preference.CompositeTreeNode {
        const existingGroup = groups.get(id);
        if (existingGroup) { return existingGroup; }
        const newNode = this.createPreferencesGroup(id, group, root);
        groups.set(id, newNode);
        return newNode;
    };
}
