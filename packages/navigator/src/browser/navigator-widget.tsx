/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
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

import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/shared/@phosphor/messaging';
import URI from '@theia/core/lib/common/uri';
import { CommandService, notEmpty, SelectionService } from '@theia/core/lib/common';
import {
    CorePreferences, Key, TreeModel, SelectableTreeNode,
    TREE_NODE_SEGMENT_CLASS, TREE_NODE_TAIL_CLASS,
    TreeDecoration, NodeProps, CompositeTreeNode
} from '@theia/core/lib/browser';
import {
    ContextMenuRenderer, ExpandableTreeNode,
    TreeProps, TreeNode
} from '@theia/core/lib/browser';
import { FileTreeWidget, FileNode, DirNode } from '@theia/filesystem/lib/browser';
import { WorkspaceService, WorkspaceCommands } from '@theia/workspace/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { WorkspaceNode, WorkspaceRootNode } from './navigator-tree';
import { FileNavigatorModel } from './navigator-model';
import { isOSX, environment } from '@theia/core';
import * as React from '@theia/core/shared/react';
import { NavigatorContextKeyService } from './navigator-context-key-service';
import { FileNavigatorCommands } from './navigator-contribution';


export const FILE_NAVIGATOR_ID = 'files';
export const LABEL = 'No folder opened';
export const CLASS = 'theia-Files';

@injectable()
export class FileNavigatorWidget extends FileTreeWidget {

    @inject(CorePreferences) protected readonly corePreferences: CorePreferences;

    @inject(NavigatorContextKeyService)
    protected readonly contextKeyService: NavigatorContextKeyService;

    constructor(
        @inject(TreeProps) readonly props: TreeProps,
        @inject(FileNavigatorModel) readonly model: FileNavigatorModel,
        @inject(ContextMenuRenderer) contextMenuRenderer: ContextMenuRenderer,
        @inject(CommandService) protected readonly commandService: CommandService,
        @inject(SelectionService) protected readonly selectionService: SelectionService,
        @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService,
        @inject(ApplicationShell) protected readonly shell: ApplicationShell
    ) {
        super(props, model, contextMenuRenderer);
        this.id = FILE_NAVIGATOR_ID;
        this.addClass(CLASS);
    }

    @postConstruct()
    protected init(): void {
        super.init();
        this.updateSelectionContextKeys();
        this.toDispose.pushAll([
            this.model.onSelectionChanged(() =>
                this.updateSelectionContextKeys()
            ),
            this.model.onExpansionChanged(node => {
                if (node.expanded && node.children.length === 1) {
                    const child = node.children[0];
                    if (ExpandableTreeNode.is(child) && !child.expanded) {
                        this.model.expandNode(child);
                    }
                }

            })
        ]);
    }

    protected doUpdateRows(): void {
        super.doUpdateRows();
        this.title.label = LABEL;
        if (WorkspaceNode.is(this.model.root)) {
            if (this.model.root.name === WorkspaceNode.name) {
                const rootNode = this.model.root.children[0];
                if (WorkspaceRootNode.is(rootNode)) {
                    this.title.label = this.toNodeName(rootNode);
                    this.title.caption = this.labelProvider.getLongName(rootNode.uri);
                }
            } else {
                this.title.label = this.toNodeName(this.model.root);
                this.title.caption = this.title.label;
            }
        } else {
            this.title.caption = this.title.label;
        }
    }

    protected enableDndOnMainPanel(): void {
        const mainPanelNode = this.shell.mainPanel.node;
        this.addEventListener(mainPanelNode, 'drop', async ({ dataTransfer }) => {
            const treeNodes = dataTransfer && this.getSelectedTreeNodesFromData(dataTransfer) || [];
            treeNodes.filter(FileNode.is).forEach(treeNode => {
                if (!SelectableTreeNode.isSelected(treeNode)) {
                    this.model.toggleNode(treeNode);
                }
            });
            if (treeNodes.length > 0) {
                this.commandService.executeCommand(FileNavigatorCommands.OPEN.id);
            }
        });
        const handler = (e: DragEvent) => {
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'link';
                e.preventDefault();
            }
        };
        this.addEventListener(mainPanelNode, 'dragover', handler);
        this.addEventListener(mainPanelNode, 'dragenter', handler);
    }

    protected getContainerTreeNode(): TreeNode | undefined {
        const root = this.model.root;
        if (this.workspaceService.isMultiRootWorkspaceOpened) {
            return root;
        }
        if (WorkspaceNode.is(root)) {
            return root.children[0];
        }
        return undefined;
    }

    protected renderTree(model: TreeModel): React.ReactNode {
        if (this.model.root && this.isEmptyMultiRootWorkspace(model)) {
            return this.renderEmptyMultiRootWorkspace();
        }
        return super.renderTree(model);
    }

    protected renderTailDecorations(node: TreeNode, props: NodeProps): React.ReactNode {
        const tailDecorations = this.getDecorationData(node, 'tailDecorations').filter(notEmpty).reduce((acc, current) => acc.concat(current), []);

        if (tailDecorations.length === 0) {
            return;
        }

        if (CompositeTreeNode.is(node)) {
            return this.renderTailDecorationsForCompositeNode(node, props, tailDecorations);
        } else {
            return this.renderTailDecorationsForNode(node, props, tailDecorations);
        }
    }

    protected renderTailDecorationsForCompositeNode(node: TreeNode, props: NodeProps, tailDecorations:
        (TreeDecoration.TailDecoration | TreeDecoration.TailDecorationIcon | TreeDecoration.TailDecorationIconClass)[]): React.ReactNode {
        // If the node is a composite, we just want to use the decorationData with the highest priority (last element).
        const decoration = tailDecorations[tailDecorations.length - 1];
        const { tooltip } = decoration as TreeDecoration.TailDecoration;
        const { fontData } = decoration as TreeDecoration.TailDecoration;
        const color = (decoration as TreeDecoration.TailDecorationIcon).color;
        const className = [TREE_NODE_SEGMENT_CLASS, TREE_NODE_TAIL_CLASS].join(' ');
        const style = fontData ? this.applyFontStyles({}, fontData) : color ? { color } : undefined;
        const content = <span className={this.getIconClass('circle', [TreeDecoration.Styles.DECORATOR_SIZE_CLASS])}></span>;

        return <div className={className} style={style} title={tooltip}>
            {content}
        </div>;
    }

    protected renderTailDecorationsForNode(node: TreeNode, props: NodeProps, tailDecorations:
        (TreeDecoration.TailDecoration | TreeDecoration.TailDecorationIcon | TreeDecoration.TailDecorationIconClass)[]): React.ReactNode {

        return <React.Fragment>
            {tailDecorations.map((decoration, index) => {
                const { tooltip } = decoration;
                const { data, fontData } = decoration as TreeDecoration.TailDecoration;
                const color = (decoration as TreeDecoration.TailDecorationIcon).color;
                const className = [TREE_NODE_SEGMENT_CLASS, TREE_NODE_TAIL_CLASS].join(' ');
                const style = fontData ? this.applyFontStyles({}, fontData) : color ? { color } : undefined;
                const icon = (decoration as TreeDecoration.TailDecorationIcon).icon || (decoration as TreeDecoration.TailDecorationIconClass).iconClass;
                const content = data ? data : icon ? <span key={node.id + 'icon' + index} className={this.getIconClass(icon)}></span> : '';
                return <div key={node.id + className + index} className={className} style={style} title={tooltip}>
                    {content}
                </div>;
            })}
        </React.Fragment>;
    }

    protected shouldShowWelcomeView(): boolean {
        return this.model.root === undefined;
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.addClipboardListener(this.node, 'copy', e => this.handleCopy(e));
        this.addClipboardListener(this.node, 'paste', e => this.handlePaste(e));
        this.enableDndOnMainPanel();
    }

    protected handleCopy(event: ClipboardEvent): void {
        const uris = this.model.selectedFileStatNodes.map(node => node.uri.toString());
        if (uris.length > 0 && event.clipboardData) {
            event.clipboardData.setData('text/plain', uris.join('\n'));
            event.preventDefault();
        }
    }

    protected handlePaste(event: ClipboardEvent): void {
        if (event.clipboardData) {
            const raw = event.clipboardData.getData('text/plain');
            if (!raw) {
                return;
            }
            const target = this.model.selectedFileStatNodes[0];
            if (!target) {
                return;
            }
            for (const file of raw.split('\n')) {
                event.preventDefault();
                const source = new URI(file);
                this.model.copy(source, target);
            }
        }
    }

    protected canOpenWorkspaceFileAndFolder: boolean = isOSX || !environment.electron.is();

    protected readonly openWorkspace = () => this.doOpenWorkspace();
    protected doOpenWorkspace(): void {
        this.commandService.executeCommand(WorkspaceCommands.OPEN_WORKSPACE.id);
    }

    protected readonly openFolder = () => this.doOpenFolder();
    protected doOpenFolder(): void {
        this.commandService.executeCommand(WorkspaceCommands.OPEN_FOLDER.id);
    }

    protected readonly addFolder = () => this.doAddFolder();
    protected doAddFolder(): void {
        this.commandService.executeCommand(WorkspaceCommands.ADD_FOLDER.id);
    }

    protected readonly keyUpHandler = (e: React.KeyboardEvent) => {
        if (Key.ENTER.keyCode === e.keyCode) {
            (e.target as HTMLElement).click();
        }
    };

    /**
     * When a multi-root workspace is opened, a user can remove all the folders from it.
     * Instead of displaying an empty navigator tree, this will show a button to add more folders.
     */
    protected renderEmptyMultiRootWorkspace(): React.ReactNode {
        return <div className='theia-navigator-container'>
            <div className='center'>You have not yet added a folder to the workspace.</div>
            <div className='open-workspace-button-container'>
                <button className='theia-button open-workspace-button' title='Add a folder to your workspace'
                    onClick={this.addFolder}
                    onKeyUp={this.keyUpHandler}>
                    Add Folder
                </button>
            </div>
        </div>;
    }

    protected isEmptyMultiRootWorkspace(model: TreeModel): boolean {
        return WorkspaceNode.is(model.root) && model.root.children.length === 0;
    }

    protected handleClickEvent(node: TreeNode | undefined, event: React.MouseEvent<HTMLElement>): void {
        const modifierKeyCombined: boolean = isOSX ? (event.shiftKey || event.metaKey) : (event.shiftKey || event.ctrlKey);
        if (!modifierKeyCombined && node && this.corePreferences['workbench.list.openMode'] === 'singleClick') {
            this.model.previewNode(node);
        }
        super.handleClickEvent(node, event);
    }

    protected onAfterShow(msg: Message): void {
        super.onAfterShow(msg);
        this.contextKeyService.explorerViewletVisible.set(true);
    }

    protected onAfterHide(msg: Message): void {
        super.onAfterHide(msg);
        this.contextKeyService.explorerViewletVisible.set(false);
    }

    protected updateSelectionContextKeys(): void {
        this.contextKeyService.explorerResourceIsFolder.set(DirNode.is(this.model.selectedNodes[0]));
    }

}
