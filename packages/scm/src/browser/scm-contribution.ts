/********************************************************************************
 * Copyright (C) 2019 Red Hat, Inc. and others.
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
import { Emitter } from '@theia/core/lib/common/event';
import { find } from '@theia/core/shared/@phosphor/algorithm';
import {
    AbstractViewContribution,
    FrontendApplicationContribution, LabelProvider,
    QuickOpenService,
    StatusBar,
    StatusBarAlignment,
    StatusBarEntry,
    KeybindingRegistry,
    ViewContainerTitleOptions,
    ViewContainer
} from '@theia/core/lib/browser';
import { TabBarToolbarContribution, TabBarToolbarRegistry, TabBarToolbarItem } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { CommandRegistry, Command, Disposable, DisposableCollection, CommandService } from '@theia/core/lib/common';
import { ContextKeyService, ContextKey } from '@theia/core/lib/browser/context-key-service';
import { ScmService } from './scm-service';
import { ScmWidget } from '../browser/scm-widget';
import URI from '@theia/core/lib/common/uri';
import { ScmQuickOpenService } from './scm-quick-open-service';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';
import { ColorRegistry, Color } from '@theia/core/lib/browser/color-registry';
import { ScmCommand } from './scm-provider';
import { ScmDecorationsService } from '../browser/decorations/scm-decorations-service';

export const SCM_WIDGET_FACTORY_ID = ScmWidget.ID;
export const SCM_VIEW_CONTAINER_ID = 'scm-view-container';
export const SCM_VIEW_CONTAINER_TITLE_OPTIONS: ViewContainerTitleOptions = {
    label: 'Source Control',
    iconClass: 'codicon codicon-source-control',
    closeable: true
};

export namespace SCM_COMMANDS {
    export const CHANGE_REPOSITORY = {
        id: 'scm.change.repository',
        category: 'SCM',
        label: 'Change Repository...'
    };
    export const ACCEPT_INPUT = {
        id: 'scm.acceptInput'
    };
    export const TREE_VIEW_MODE = {
        id: 'scm.viewmode.tree',
        tooltip: 'Toggle to Tree View',
        iconClass: 'codicon codicon-list-tree',
        label: 'Toggle to Tree View',
    };
    export const LIST_VIEW_MODE = {
        id: 'scm.viewmode.list',
        tooltip: 'Toggle to List View',
        iconClass: 'codicon codicon-list-flat',
        label: 'Toggle to List View',
    };
    export const COLLAPSE_ALL = {
        id: 'scm.collapseAll',
        category: 'SCM',
        tooltip: 'Collapse All',
        iconClass: 'codicon codicon-collapse-all',
        label: 'Collapse All',
    };
}

export namespace ScmColors {
    export const editorGutterModifiedBackground = 'editorGutter.modifiedBackground';
    export const editorGutterAddedBackground = 'editorGutter.addedBackground';
    export const editorGutterDeletedBackground = 'editorGutter.deletedBackground';
}

@injectable()
export class ScmContribution extends AbstractViewContribution<ScmWidget> implements FrontendApplicationContribution, TabBarToolbarContribution, ColorContribution {

    @inject(StatusBar) protected readonly statusBar: StatusBar;
    @inject(ScmService) protected readonly scmService: ScmService;
    @inject(QuickOpenService) protected readonly quickOpenService: QuickOpenService;
    @inject(ScmQuickOpenService) protected readonly scmQuickOpenService: ScmQuickOpenService;
    @inject(LabelProvider) protected readonly labelProvider: LabelProvider;
    @inject(CommandService) protected readonly commands: CommandService;
    @inject(CommandRegistry) protected readonly commandRegistry: CommandRegistry;
    @inject(ContextKeyService) protected readonly contextKeys: ContextKeyService;
    @inject(ScmDecorationsService) protected readonly scmDecorationsService: ScmDecorationsService;

    protected scmFocus: ContextKey<boolean>;

    constructor() {
        super({
            viewContainerId: SCM_VIEW_CONTAINER_ID,
            widgetId: SCM_WIDGET_FACTORY_ID,
            widgetName: 'Source Control',
            defaultWidgetOptions: {
                area: 'left',
                rank: 300
            },
            toggleCommandId: 'scmView:toggle',
            toggleKeybinding: 'ctrlcmd+shift+g'
        });
    }

    @postConstruct()
    protected init(): void {
        this.scmFocus = this.contextKeys.createKey('scmFocus', false);
    }

    async initializeLayout(): Promise<void> {
        await this.openView();
    }

    onStart(): void {
        this.updateStatusBar();
        this.scmService.onDidAddRepository(() => this.updateStatusBar());
        this.scmService.onDidRemoveRepository(() => this.updateStatusBar());
        this.scmService.onDidChangeSelectedRepository(() => this.updateStatusBar());
        this.scmService.onDidChangeStatusBarCommands(() => this.updateStatusBar());
        this.labelProvider.onDidChange(() => this.updateStatusBar());

        this.updateContextKeys();
        this.shell.currentChanged.connect(() => this.updateContextKeys());
    }

    protected updateContextKeys(): void {
        this.scmFocus.set(this.shell.currentWidget instanceof ScmWidget);
    }

    registerCommands(commandRegistry: CommandRegistry): void {
        super.registerCommands(commandRegistry);
        commandRegistry.registerCommand(SCM_COMMANDS.CHANGE_REPOSITORY, {
            execute: () => this.scmQuickOpenService.changeRepository(),
            isEnabled: () => this.scmService.repositories.length > 1
        });
        commandRegistry.registerCommand(SCM_COMMANDS.ACCEPT_INPUT, {
            execute: () => this.acceptInput(),
            isEnabled: () => !!this.scmFocus.get() && !!this.acceptInputCommand()
        });
    }

    registerToolbarItems(registry: TabBarToolbarRegistry): void {
        const viewModeEmitter = new Emitter<void>();
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        const extractScmWidget = (widget: any) => {
            if (widget instanceof ViewContainer) {
                const layout = widget.containerLayout;
                const scmWidgetPart = find(layout.iter(), part => part.wrapped instanceof ScmWidget);
                if (scmWidgetPart && scmWidgetPart.wrapped instanceof ScmWidget) {
                    return scmWidgetPart.wrapped;
                }
            }
        };
        const registerToggleViewItem = (command: Command, mode: 'tree' | 'list') => {
            const id = command.id;
            const item: TabBarToolbarItem = {
                id,
                command: id,
                tooltip: command.label,
                onDidChange: viewModeEmitter.event
            };
            this.commandRegistry.registerCommand({ id, iconClass: command && command.iconClass }, {
                execute: widget => {
                    const scmWidget = extractScmWidget(widget);
                    if (scmWidget) {
                        scmWidget.viewMode = mode;
                        viewModeEmitter.fire();
                    }
                },
                isVisible: widget => {
                    const scmWidget = extractScmWidget(widget);
                    if (scmWidget) {
                        return !!this.scmService.selectedRepository
                            && scmWidget.viewMode !== mode;
                    }
                    return false;
                },
            });
            registry.registerItem(item);
        };
        registerToggleViewItem(SCM_COMMANDS.TREE_VIEW_MODE, 'tree');
        registerToggleViewItem(SCM_COMMANDS.LIST_VIEW_MODE, 'list');

        this.commandRegistry.registerCommand(SCM_COMMANDS.COLLAPSE_ALL, {
            execute: widget => {
                const scmWidget = extractScmWidget(widget);
                if (scmWidget && scmWidget.viewMode === 'tree') {
                    scmWidget.collapseScmTree();
                }
            },
            isVisible: widget => {
                const scmWidget = extractScmWidget(widget);
                if (scmWidget) {
                    return !!this.scmService.selectedRepository && scmWidget.viewMode === 'tree';
                }
                return false;
            }
        });

        registry.registerItem({
            ...SCM_COMMANDS.COLLAPSE_ALL,
            command: SCM_COMMANDS.COLLAPSE_ALL.id
        });
    }

    registerKeybindings(keybindings: KeybindingRegistry): void {
        super.registerKeybindings(keybindings);
        keybindings.registerKeybinding({
            command: SCM_COMMANDS.ACCEPT_INPUT.id,
            keybinding: 'ctrlcmd+enter',
            when: 'scmFocus'
        });
    }

    protected async acceptInput(): Promise<void> {
        const command = this.acceptInputCommand();
        if (command && command.command) {
            await this.commands.executeCommand(command.command, ...command.arguments ? command.arguments : []);
        }
    }
    protected acceptInputCommand(): ScmCommand | undefined {
        const repository = this.scmService.selectedRepository;
        if (!repository) {
            return undefined;
        }
        return repository.provider.acceptInputCommand;
    }

    protected readonly statusBarDisposable = new DisposableCollection();
    protected updateStatusBar(): void {
        this.statusBarDisposable.dispose();
        const repository = this.scmService.selectedRepository;
        if (!repository) {
            return;
        }
        const name = this.labelProvider.getName(new URI(repository.provider.rootUri));
        if (this.scmService.repositories.length > 1) {
            this.setStatusBarEntry(SCM_COMMANDS.CHANGE_REPOSITORY.id, {
                text: `$(database) ${name}`,
                tooltip: name.toString(),
                command: SCM_COMMANDS.CHANGE_REPOSITORY.id,
                alignment: StatusBarAlignment.LEFT,
                priority: 100
            });
        }
        const label = repository.provider.rootUri ? `${name} (${repository.provider.label})` : repository.provider.label;
        this.scmService.statusBarCommands.forEach((value, index) => this.setStatusBarEntry(`scm.status.${index}`, {
            text: value.title,
            tooltip: label + (value.tooltip ? ` - ${value.tooltip}` : ''),
            command: value.command,
            arguments: value.arguments,
            alignment: StatusBarAlignment.LEFT,
            priority: 100
        }));
    }
    protected setStatusBarEntry(id: string, entry: StatusBarEntry): void {
        this.statusBar.setElement(id, entry);
        this.statusBarDisposable.push(Disposable.create(() => this.statusBar.removeElement(id)));
    }

    /**
     * It should be aligned with https://github.com/microsoft/vscode/blob/0dfa355b3ad185a6289ba28a99c141ab9e72d2be/src/vs/workbench/contrib/scm/browser/dirtydiffDecorator.ts#L808
     */
    registerColors(colors: ColorRegistry): void {
        colors.register(
            {
                id: ScmColors.editorGutterModifiedBackground, defaults: {
                    dark: Color.rgba(12, 125, 157),
                    light: Color.rgba(102, 175, 224),
                    hc: Color.rgba(0, 155, 249)
                }, description: 'Editor gutter background color for lines that are modified.'
            },
            {
                id: ScmColors.editorGutterAddedBackground, defaults: {
                    dark: Color.rgba(88, 124, 12),
                    light: Color.rgba(129, 184, 139),
                    hc: Color.rgba(51, 171, 78)
                }, description: 'Editor gutter background color for lines that are added.'
            },
            {
                id: ScmColors.editorGutterDeletedBackground, defaults: {
                    dark: Color.rgba(148, 21, 27),
                    light: Color.rgba(202, 75, 81),
                    hc: Color.rgba(252, 93, 109)
                }, description: 'Editor gutter background color for lines that are deleted.'
            },
            {
                id: 'minimapGutter.modifiedBackground', defaults: {
                    dark: Color.rgba(12, 125, 157),
                    light: Color.rgba(102, 175, 224),
                    hc: Color.rgba(0, 155, 249)
                }, description: 'Minimap gutter background color for lines that are modified.'
            },
            {
                id: 'minimapGutter.addedBackground',
                defaults: {
                    dark: Color.rgba(88, 124, 12),
                    light: Color.rgba(129, 184, 139),
                    hc: Color.rgba(51, 171, 78)
                }, description: 'Minimap gutter background color for lines that are added.'
            },
            {
                id: 'minimapGutter.deletedBackground', defaults: {
                    dark: Color.rgba(148, 21, 27),
                    light: Color.rgba(202, 75, 81),
                    hc: Color.rgba(252, 93, 109)
                }, description: 'Minimap gutter background color for lines that are deleted.'
            },
            {
                id: 'editorOverviewRuler.modifiedForeground', defaults: {
                    dark: Color.transparent(ScmColors.editorGutterModifiedBackground, 0.6),
                    light: Color.transparent(ScmColors.editorGutterModifiedBackground, 0.6),
                    hc: Color.transparent(ScmColors.editorGutterModifiedBackground, 0.6)
                }, description: 'Overview ruler marker color for modified content.'
            },
            {
                id: 'editorOverviewRuler.addedForeground', defaults: {
                    dark: Color.transparent(ScmColors.editorGutterAddedBackground, 0.6),
                    light: Color.transparent(ScmColors.editorGutterAddedBackground, 0.6),
                    hc: Color.transparent(ScmColors.editorGutterAddedBackground, 0.6)
                }, description: 'Overview ruler marker color for added content.'
            },
            {
                id: 'editorOverviewRuler.deletedForeground', defaults: {
                    dark: Color.transparent(ScmColors.editorGutterDeletedBackground, 0.6),
                    light: Color.transparent(ScmColors.editorGutterDeletedBackground, 0.6),
                    hc: Color.transparent(ScmColors.editorGutterDeletedBackground, 0.6)
                }, description: 'Overview ruler marker color for deleted content.'
            }
        );
    }

}
