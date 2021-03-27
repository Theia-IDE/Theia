/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
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

import { AbstractViewContribution, ApplicationShell, KeybindingRegistry, Widget, CompositeTreeNode, LabelProvider } from '@theia/core/lib/browser';
import { injectable, inject } from 'inversify';
import { MenuModelRegistry, CommandRegistry, MAIN_MENU_BAR, Command, Emitter, Mutable } from '@theia/core/lib/common';
import { DebugViewLocation } from '../common/debug-configuration';
import { EditorKeybindingContexts, EditorManager } from '@theia/editor/lib/browser';
import { DebugSessionManager } from './debug-session-manager';
import { DebugWidget } from './view/debug-widget';
import { FunctionBreakpoint } from './breakpoint/breakpoint-marker';
import { BreakpointManager } from './breakpoint/breakpoint-manager';
import { DebugConfigurationManager } from './debug-configuration-manager';
import { DebugState, DebugSession } from './debug-session';
import { DebugBreakpointsWidget } from './view/debug-breakpoints-widget';
import { DebugSourceBreakpoint } from './model/debug-source-breakpoint';
import { DebugThreadsWidget } from './view/debug-threads-widget';
import { DebugThread } from './model/debug-thread';
import { DebugStackFramesWidget } from './view/debug-stack-frames-widget';
import { DebugStackFrame } from './model/debug-stack-frame';
import { DebugVariablesWidget } from './view/debug-variables-widget';
import { DebugVariable } from './console/debug-console-items';
import { DebugSessionWidget, DebugSessionWidgetFactory } from './view/debug-session-widget';
import { DebugKeybindingContexts } from './debug-keybinding-contexts';
import { DebugEditorModel } from './editor/debug-editor-model';
import { DebugEditorService } from './editor/debug-editor-service';
import { DebugConsoleContribution } from './console/debug-console-contribution';
import { DebugService } from '../common/debug-service';
import { DebugSchemaUpdater } from './debug-schema-updater';
import { DebugPreferences } from './debug-preferences';
import { TabBarToolbarContribution, TabBarToolbarRegistry, TabBarToolbarItem } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { DebugWatchWidget } from './view/debug-watch-widget';
import { DebugWatchExpression } from './view/debug-watch-expression';
import { DebugWatchManager } from './debug-watch-manager';
import { DebugSessionOptions } from './debug-session-options';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';
import { ColorRegistry } from '@theia/core/lib/browser/color-registry';
import { DebugFunctionBreakpoint } from './model/debug-function-breakpoint';
import { DebugBreakpoint } from './model/debug-breakpoint';

export namespace DebugMenus {
    export const DEBUG = [...MAIN_MENU_BAR, '6_debug'];
    export const DEBUG_CONTROLS = [...DEBUG, 'a_controls'];
    export const DEBUG_CONFIGURATION = [...DEBUG, 'b_configuration'];
    export const DEBUG_THREADS = [...DEBUG, 'c_threads'];
    export const DEBUG_SESSIONS = [...DEBUG, 'd_sessions'];
    export const DEBUG_BREAKPOINT = [...DEBUG, 'e_breakpoint'];
    export const DEBUG_NEW_BREAKPOINT = [...DEBUG_BREAKPOINT, 'a_new_breakpoint'];
    export const DEBUG_BREAKPOINTS = [...DEBUG, 'f_breakpoints'];
}

export namespace DebugCommands {

    const DEBUG_CATEGORY = 'Debug';

    export const START: Command = {
        id: 'workbench.action.debug.start',
        category: DEBUG_CATEGORY,
        label: 'Start Debugging',
        iconClass: 'fa fa-play'
    };
    export const START_NO_DEBUG: Command = {
        id: 'workbench.action.debug.run',
        label: 'Debug: Start Without Debugging'
    };
    export const STOP: Command = {
        id: 'workbench.action.debug.stop',
        category: DEBUG_CATEGORY,
        label: 'Stop Debugging',
        iconClass: 'fa fa-stop'
    };
    export const RESTART: Command = {
        id: 'workbench.action.debug.restart',
        category: DEBUG_CATEGORY,
        label: 'Restart Debugging',
    };

    export const OPEN_CONFIGURATIONS = {
        id: 'debug.configurations.open',
        label: 'Debug: Open Configurations'
    };
    export const ADD_CONFIGURATION = {
        id: 'debug.configurations.add',
        label: 'Debug: Add Configuration...'
    };

    export const STEP_OVER: Command = {
        id: 'workbench.action.debug.stepOver',
        category: DEBUG_CATEGORY,
        label: 'Step Over',
        iconClass: 'fa fa-arrow-right'
    };
    export const STEP_INTO: Command = {
        id: 'workbench.action.debug.stepInto',
        category: DEBUG_CATEGORY,
        label: 'Step Into',
        iconClass: 'fa fa-arrow-down'
    };
    export const STEP_OUT: Command = {
        id: 'workbench.action.debug.stepOut',
        category: DEBUG_CATEGORY,
        label: 'Step Out',
        iconClass: 'fa fa-arrow-up'
    };
    export const CONTINUE: Command = {
        id: 'workbench.action.debug.continue',
        category: DEBUG_CATEGORY,
        label: 'Continue',
        iconClass: 'fa fa-play-circle'
    };
    export const PAUSE: Command = {
        id: 'workbench.action.debug.pause',
        category: DEBUG_CATEGORY,
        label: 'Pause',
        iconClass: 'fa fa-pause'
    };
    export const CONTINUE_ALL: Command = {
        id: 'debug.thread.continue.all',
        category: DEBUG_CATEGORY,
        label: 'Continue All',
        iconClass: 'fa fa-play-circle'
    };
    export const PAUSE_ALL: Command = {
        id: 'debug.thread.pause.all',
        category: DEBUG_CATEGORY,
        label: 'Pause All',
        iconClass: 'fa fa-pause'
    };

    export const TOGGLE_BREAKPOINT: Command = {
        id: 'editor.debug.action.toggleBreakpoint',
        category: DEBUG_CATEGORY,
        label: 'Toggle Breakpoint',
    };
    export const INLINE_BREAKPOINT: Command = {
        id: 'editor.debug.action.inlineBreakpoint',
        category: DEBUG_CATEGORY,
        label: 'Inline Breakpoint',
    };
    export const ADD_CONDITIONAL_BREAKPOINT: Command = {
        id: 'debug.breakpoint.add.conditional',
        category: DEBUG_CATEGORY,
        label: 'Add Conditional Breakpoint...',
    };
    export const ADD_LOGPOINT: Command = {
        id: 'debug.breakpoint.add.logpoint',
        category: DEBUG_CATEGORY,
        label: 'Add Logpoint...',
    };
    export const ADD_FUNCTION_BREAKPOINT: Command = {
        id: 'debug.breakpoint.add.function',
        category: DEBUG_CATEGORY,
        label: 'Add Function Breakpoint...',
    };
    export const ENABLE_ALL_BREAKPOINTS: Command = {
        id: 'debug.breakpoint.enableAll',
        category: DEBUG_CATEGORY,
        label: 'Enable All Breakpoints',
    };
    export const DISABLE_ALL_BREAKPOINTS: Command = {
        id: 'debug.breakpoint.disableAll',
        category: DEBUG_CATEGORY,
        label: 'Disable All Breakpoints',
    };
    export const EDIT_BREAKPOINT: Command = {
        id: 'debug.breakpoint.edit',
        category: DEBUG_CATEGORY,
        label: 'Edit Breakpoint...',
    };
    export const EDIT_LOGPOINT: Command = {
        id: 'debug.logpoint.edit',
        category: DEBUG_CATEGORY,
        label: 'Edit Logpoint...',
    };
    export const REMOVE_BREAKPOINT: Command = {
        id: 'debug.breakpoint.remove',
        category: DEBUG_CATEGORY,
        label: 'Remove Breakpoint',
    };
    export const REMOVE_LOGPOINT: Command = {
        id: 'debug.logpoint.remove',
        category: DEBUG_CATEGORY,
        label: 'Remove Logpoint',
    };
    export const REMOVE_ALL_BREAKPOINTS: Command = {
        id: 'debug.breakpoint.removeAll',
        category: DEBUG_CATEGORY,
        label: 'Remove All Breakpoints',
    };
    export const TOGGLE_BREAKPOINTS_ENABLED: Command = {
        id: 'debug.breakpoint.toggleEnabled'
    };
    export const SHOW_HOVER = {
        id: 'editor.debug.action.showDebugHover',
        label: 'Debug: Show Hover'
    };

    export const RESTART_FRAME: Command = {
        id: 'debug.frame.restart',
        category: DEBUG_CATEGORY,
        label: 'Restart Frame',
    };
    export const COPY_CALL_STACK: Command = {
        id: 'debug.callStack.copy',
        category: DEBUG_CATEGORY,
        label: 'Copy Call Stack',
    };

    export const SET_VARIABLE_VALUE: Command = {
        id: 'debug.variable.setValue',
        category: DEBUG_CATEGORY,
        label: 'Set Value',
    };
    export const COPY_VARIABLE_VALUE: Command = {
        id: 'debug.variable.copyValue',
        category: DEBUG_CATEGORY,
        label: 'Copy Value',
    };
    export const COPY_VARIABLE_AS_EXPRESSION: Command = {
        id: 'debug.variable.copyAsExpression',
        category: DEBUG_CATEGORY,
        label: 'Copy As Expression',
    };
    export const WATCH_VARIABLE: Command = {
        id: 'debug.variable.watch',
        category: DEBUG_CATEGORY,
        label: 'Add to Watch',
    };

    export const ADD_WATCH_EXPRESSION: Command = {
        id: 'debug.watch.addExpression',
        category: DEBUG_CATEGORY,
        label: 'Add Watch Expression'
    };
    export const EDIT_WATCH_EXPRESSION: Command = {
        id: 'debug.watch.editExpression',
        category: DEBUG_CATEGORY,
        label: 'Edit Watch Expression'
    };
    export const COPY_WATCH_EXPRESSION_VALUE: Command = {
        id: 'debug.watch.copyExpressionValue',
        category: DEBUG_CATEGORY,
        label: 'Copy Watch Expression Value'
    };
    export const REMOVE_WATCH_EXPRESSION: Command = {
        id: 'debug.watch.removeExpression',
        category: DEBUG_CATEGORY,
        label: 'Remove Watch Expression'
    };
    export const COLLAPSE_ALL_WATCH_EXPRESSIONS: Command = {
        id: 'debug.watch.collapseAllExpressions',
        category: DEBUG_CATEGORY,
        label: 'Collapse All Watch Expressions'
    };
    export const REMOVE_ALL_WATCH_EXPRESSIONS: Command = {
        id: 'debug.watch.removeAllExpressions',
        category: DEBUG_CATEGORY,
        label: 'Remove All Watch Expressions'
    };
}
export namespace DebugThreadContextCommands {
    export const STEP_OVER = {
        id: 'debug.thread.context.context.next'
    };
    export const STEP_INTO = {
        id: 'debug.thread.context.stepin'
    };
    export const STEP_OUT = {
        id: 'debug.thread.context.stepout'
    };
    export const CONTINUE = {
        id: 'debug.thread.context.continue'
    };
    export const PAUSE = {
        id: 'debug.thread.context.pause'
    };
    export const TERMINATE = {
        id: 'debug.thread.context.terminate'
    };
}
export namespace DebugSessionContextCommands {
    export const STOP = {
        id: 'debug.session.context.stop'
    };
    export const RESTART = {
        id: 'debug.session.context.restart'
    };
    export const PAUSE_ALL = {
        id: 'debug.session.context.pauseAll'
    };
    export const CONTINUE_ALL = {
        id: 'debug.session.context.continueAll'
    };
    export const REVEAL = {
        id: 'debug.session.context.reveal'
    };
    export const OPEN_LEFT = {
        id: 'debug.session.context.openLeft'
    };
    export const OPEN_RIGHT = {
        id: 'debug.session.context.openRight'
    };
    export const OPEN_BOTTOM = {
        id: 'debug.session.context.openBottom'
    };
}
export namespace DebugEditorContextCommands {
    export const ADD_BREAKPOINT = {
        id: 'debug.editor.context.addBreakpoint'
    };
    export const ADD_CONDITIONAL_BREAKPOINT = {
        id: 'debug.editor.context.addBreakpoint.conditional'
    };
    export const ADD_LOGPOINT = {
        id: 'debug.editor.context.add.logpoint'
    };
    export const REMOVE_BREAKPOINT = {
        id: 'debug.editor.context.removeBreakpoint'
    };
    export const EDIT_BREAKPOINT = {
        id: 'debug.editor.context.edit.breakpoint'
    };
    export const ENABLE_BREAKPOINT = {
        id: 'debug.editor.context.enableBreakpoint'
    };
    export const DISABLE_BREAKPOINT = {
        id: 'debug.editor.context.disableBreakpoint'
    };
    export const REMOVE_LOGPOINT = {
        id: 'debug.editor.context.logpoint.remove'
    };
    export const EDIT_LOGPOINT = {
        id: 'debug.editor.context.logpoint.edit'
    };
    export const ENABLE_LOGPOINT = {
        id: 'debug.editor.context.logpoint.enable'
    };
    export const DISABLE_LOGPOINT = {
        id: 'debug.editor.context.logpoint.disable'
    };
}
export namespace DebugBreakpointWidgetCommands {
    export const ACCEPT = {
        id: 'debug.breakpointWidget.accept'
    };
    export const CLOSE = {
        id: 'debug.breakpointWidget.close'
    };
}

@injectable()
export class DebugFrontendApplicationContribution extends AbstractViewContribution<DebugWidget> implements TabBarToolbarContribution, ColorContribution {

    @inject(DebugService)
    protected readonly debug: DebugService;

    @inject(DebugSessionManager)
    protected readonly manager: DebugSessionManager;

    @inject(DebugConfigurationManager)
    protected readonly configurations: DebugConfigurationManager;

    @inject(BreakpointManager)
    protected readonly breakpointManager: BreakpointManager;

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(DebugSessionWidgetFactory)
    protected readonly sessionWidgetFactory: DebugSessionWidgetFactory;

    @inject(DebugEditorService)
    protected readonly editors: DebugEditorService;

    @inject(DebugConsoleContribution)
    protected readonly console: DebugConsoleContribution;

    @inject(DebugSchemaUpdater)
    protected readonly schemaUpdater: DebugSchemaUpdater;

    @inject(DebugPreferences)
    protected readonly preference: DebugPreferences;

    @inject(DebugWatchManager)
    protected readonly watchManager: DebugWatchManager;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    constructor() {
        super({
            widgetId: DebugWidget.ID,
            widgetName: DebugWidget.LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 400
            },
            toggleCommandId: 'debug:toggle',
            toggleKeybinding: 'ctrlcmd+shift+d'
        });
    }

    async initializeLayout(): Promise<void> {
        await this.openView();
    }

    protected firstSessionStart = true;
    async onStart(): Promise<void> {
        this.manager.onDidCreateDebugSession(session => this.openSession(session, { reveal: false }));
        this.manager.onDidStartDebugSession(session => {
            const { noDebug } = session.configuration;
            const openDebug = session.configuration.openDebug || this.preference['debug.openDebug'];
            const internalConsoleOptions = session.configuration.internalConsoleOptions || this.preference['debug.internalConsoleOptions'];
            if (internalConsoleOptions === 'openOnSessionStart' ||
                (internalConsoleOptions === 'openOnFirstSessionStart' && this.firstSessionStart)) {
                this.console.openView({
                    reveal: true,
                    activate: false,
                });
            }
            if (!noDebug && (openDebug === 'openOnSessionStart' || (openDebug === 'openOnFirstSessionStart' && this.firstSessionStart))) {
                this.openSession(session);
            }
            this.firstSessionStart = false;
        });
        this.manager.onDidStopDebugSession(session => {
            const { openDebug } = session.configuration;
            if (openDebug === 'openOnDebugBreak') {
                this.openSession(session);
            }
        });

        this.updateStatusBar();
        this.manager.onDidChange(() => this.updateStatusBar());

        this.schemaUpdater.update();
        this.configurations.load();
        await this.breakpointManager.load();
        await this.watchManager.load();
    }

    onStop(): void {
        this.configurations.save();
        this.breakpointManager.save();
        this.watchManager.save();
    }

    registerMenus(menus: MenuModelRegistry): void {
        super.registerMenus(menus);
        const registerMenuActions = (menuPath: string[], ...commands: Command[]) => {
            for (const [index, command] of commands.entries()) {
                menus.registerMenuAction(menuPath, {
                    commandId: command.id,
                    label: command.label && command.label.startsWith('Debug: ') && command.label.slice('Debug: '.length) || command.label,
                    icon: command.iconClass,
                    order: String.fromCharCode('a'.charCodeAt(0) + index)
                });
            }
        };

        menus.registerSubmenu(DebugMenus.DEBUG, 'Run');
        registerMenuActions(DebugMenus.DEBUG_CONTROLS,
            DebugCommands.START,
            DebugCommands.START_NO_DEBUG,
            DebugCommands.STOP,
            DebugCommands.RESTART
        );
        registerMenuActions(DebugMenus.DEBUG_CONFIGURATION,
            DebugCommands.OPEN_CONFIGURATIONS,
            DebugCommands.ADD_CONFIGURATION
        );
        registerMenuActions(DebugMenus.DEBUG_THREADS,
            DebugCommands.CONTINUE,
            DebugCommands.STEP_OVER,
            DebugCommands.STEP_INTO,
            DebugCommands.STEP_OUT,
            DebugCommands.PAUSE
        );
        registerMenuActions(DebugMenus.DEBUG_SESSIONS,
            DebugCommands.CONTINUE_ALL,
            DebugCommands.PAUSE_ALL
        );
        registerMenuActions(DebugMenus.DEBUG_BREAKPOINT,
            DebugCommands.TOGGLE_BREAKPOINT
        );
        menus.registerSubmenu(DebugMenus.DEBUG_NEW_BREAKPOINT, 'New Breakpoint');
        registerMenuActions(DebugMenus.DEBUG_NEW_BREAKPOINT,
            DebugCommands.ADD_CONDITIONAL_BREAKPOINT,
            DebugCommands.INLINE_BREAKPOINT,
            DebugCommands.ADD_FUNCTION_BREAKPOINT,
            DebugCommands.ADD_LOGPOINT,
        );
        registerMenuActions(DebugMenus.DEBUG_BREAKPOINTS,
            DebugCommands.ENABLE_ALL_BREAKPOINTS,
            DebugCommands.DISABLE_ALL_BREAKPOINTS,
            DebugCommands.REMOVE_ALL_BREAKPOINTS
        );

        registerMenuActions(DebugThreadsWidget.CONTROL_MENU,
            { ...DebugCommands.PAUSE, ...DebugThreadContextCommands.PAUSE },
            { ...DebugCommands.CONTINUE, ...DebugThreadContextCommands.CONTINUE },
            { ...DebugCommands.STEP_OVER, ...DebugThreadContextCommands.STEP_OVER },
            { ...DebugCommands.STEP_INTO, ...DebugThreadContextCommands.STEP_INTO },
            { ...DebugCommands.STEP_OUT, ...DebugThreadContextCommands.STEP_OUT },
            { ...DebugCommands.PAUSE_ALL, ...DebugSessionContextCommands.PAUSE_ALL },
            { ...DebugCommands.CONTINUE_ALL, ...DebugSessionContextCommands.CONTINUE_ALL }
        );
        registerMenuActions(DebugThreadsWidget.TERMINATE_MENU,
            { ...DebugCommands.RESTART, ...DebugSessionContextCommands.RESTART, label: 'Restart' },
            { ...DebugCommands.STOP, ...DebugSessionContextCommands.STOP, label: 'Stop' },
            { ...DebugThreadContextCommands.TERMINATE, label: 'Terminate Thread' }
        );
        registerMenuActions(DebugThreadsWidget.OPEN_MENU,
            { ...DebugSessionContextCommands.REVEAL, label: 'Reveal' },
            { ...DebugSessionContextCommands.OPEN_LEFT, label: 'Open Left' },
            { ...DebugSessionContextCommands.OPEN_RIGHT, label: 'Open Right' },
            { ...DebugSessionContextCommands.OPEN_BOTTOM, label: 'Open Bottom' }
        );

        registerMenuActions(DebugStackFramesWidget.CONTEXT_MENU,
            DebugCommands.RESTART_FRAME,
            DebugCommands.COPY_CALL_STACK
        );

        registerMenuActions(DebugVariablesWidget.EDIT_MENU,
            DebugCommands.SET_VARIABLE_VALUE,
            DebugCommands.COPY_VARIABLE_VALUE,
            DebugCommands.COPY_VARIABLE_AS_EXPRESSION
        );
        registerMenuActions(DebugVariablesWidget.WATCH_MENU,
            DebugCommands.WATCH_VARIABLE
        );

        registerMenuActions(DebugWatchWidget.EDIT_MENU,
            { ...DebugCommands.EDIT_WATCH_EXPRESSION, label: 'Edit Expression' },
            { ...DebugCommands.COPY_WATCH_EXPRESSION_VALUE, label: 'Copy Value' }
        );
        registerMenuActions(DebugWatchWidget.REMOVE_MENU,
            { ...DebugCommands.REMOVE_WATCH_EXPRESSION, label: 'Remove Expression' },
            { ...DebugCommands.REMOVE_ALL_WATCH_EXPRESSIONS, label: 'Remove All Expressions' }
        );

        registerMenuActions(DebugBreakpointsWidget.EDIT_MENU,
            DebugCommands.EDIT_BREAKPOINT,
            DebugCommands.EDIT_LOGPOINT
        );
        registerMenuActions(DebugBreakpointsWidget.REMOVE_MENU,
            DebugCommands.REMOVE_BREAKPOINT,
            DebugCommands.REMOVE_LOGPOINT,
            DebugCommands.REMOVE_ALL_BREAKPOINTS
        );
        registerMenuActions(DebugBreakpointsWidget.ENABLE_MENU,
            DebugCommands.ENABLE_ALL_BREAKPOINTS,
            DebugCommands.DISABLE_ALL_BREAKPOINTS
        );

        registerMenuActions(DebugEditorModel.CONTEXT_MENU,
            { ...DebugEditorContextCommands.ADD_BREAKPOINT, label: 'Add Breakpoint' },
            { ...DebugEditorContextCommands.ADD_CONDITIONAL_BREAKPOINT, label: DebugCommands.ADD_CONDITIONAL_BREAKPOINT.label },
            { ...DebugEditorContextCommands.ADD_LOGPOINT, label: DebugCommands.ADD_LOGPOINT.label },
            { ...DebugEditorContextCommands.REMOVE_BREAKPOINT, label: DebugCommands.REMOVE_BREAKPOINT.label },
            { ...DebugEditorContextCommands.EDIT_BREAKPOINT, label: DebugCommands.EDIT_BREAKPOINT.label },
            { ...DebugEditorContextCommands.ENABLE_BREAKPOINT, label: 'Enable Breakpoint' },
            { ...DebugEditorContextCommands.DISABLE_BREAKPOINT, label: 'Disable Breakpoint' },
            { ...DebugEditorContextCommands.REMOVE_LOGPOINT, label: DebugCommands.REMOVE_LOGPOINT.label },
            { ...DebugEditorContextCommands.EDIT_LOGPOINT, label: DebugCommands.EDIT_LOGPOINT.label },
            { ...DebugEditorContextCommands.ENABLE_LOGPOINT, label: 'Enable Logpoint' },
            { ...DebugEditorContextCommands.DISABLE_LOGPOINT, label: 'Disable Logpoint' }
        );
    }

    registerCommands(registry: CommandRegistry): void {
        super.registerCommands(registry);
        registry.registerCommand(DebugCommands.START, {
            execute: (config?: DebugSessionOptions) => this.start(false, config)
        });
        registry.registerCommand(DebugCommands.START_NO_DEBUG, {
            execute: (config?: DebugSessionOptions) => this.start(true, config)
        });
        registry.registerCommand(DebugCommands.STOP, {
            execute: () => this.manager.currentSession && this.manager.currentSession.terminate(),
            isEnabled: () => this.manager.state !== DebugState.Inactive
        });
        registry.registerCommand(DebugCommands.RESTART, {
            execute: () => this.manager.restart(),
            isEnabled: () => this.manager.state !== DebugState.Inactive
        });

        registry.registerCommand(DebugCommands.OPEN_CONFIGURATIONS, {
            execute: () => this.configurations.openConfiguration()
        });
        registry.registerCommand(DebugCommands.ADD_CONFIGURATION, {
            execute: () => this.configurations.addConfiguration()
        });

        registry.registerCommand(DebugCommands.STEP_OVER, {
            execute: () => this.manager.currentThread && this.manager.currentThread.stepOver(),
            isEnabled: () => this.manager.state === DebugState.Stopped
        });
        registry.registerCommand(DebugCommands.STEP_INTO, {
            execute: () => this.manager.currentThread && this.manager.currentThread.stepIn(),
            isEnabled: () => this.manager.state === DebugState.Stopped
        });
        registry.registerCommand(DebugCommands.STEP_OUT, {
            execute: () => this.manager.currentThread && this.manager.currentThread.stepOut(),
            isEnabled: () => this.manager.state === DebugState.Stopped
        });
        registry.registerCommand(DebugCommands.CONTINUE, {
            execute: () => this.manager.currentThread && this.manager.currentThread.continue(),
            isEnabled: () => this.manager.state === DebugState.Stopped
        });
        registry.registerCommand(DebugCommands.PAUSE, {
            execute: () => this.manager.currentThread && this.manager.currentThread.pause(),
            isEnabled: () => this.manager.state === DebugState.Running
        });
        registry.registerCommand(DebugCommands.PAUSE_ALL, {
            execute: () => this.manager.currentSession && this.manager.currentSession.pauseAll(),
            isEnabled: () => !!this.manager.currentSession && !!this.manager.currentSession.runningThreads.next().value
        });
        registry.registerCommand(DebugCommands.CONTINUE_ALL, {
            execute: () => this.manager.currentSession && this.manager.currentSession.continueAll(),
            isEnabled: () => !!this.manager.currentSession && !!this.manager.currentSession.stoppedThreads.next().value
        });

        registry.registerCommand(DebugThreadContextCommands.STEP_OVER, {
            execute: () => this.selectedThread && this.selectedThread.stepOver(),
            isEnabled: () => !!this.selectedThread && this.selectedThread.stopped,
            isVisible: () => !!this.selectedThread
        });
        registry.registerCommand(DebugThreadContextCommands.STEP_INTO, {
            execute: () => this.selectedThread && this.selectedThread.stepIn(),
            isEnabled: () => !!this.selectedThread && this.selectedThread.stopped,
            isVisible: () => !!this.selectedThread
        });
        registry.registerCommand(DebugThreadContextCommands.STEP_OUT, {
            execute: () => this.selectedThread && this.selectedThread.stepOut(),
            isEnabled: () => !!this.selectedThread && this.selectedThread.stopped,
            isVisible: () => !!this.selectedThread
        });
        registry.registerCommand(DebugThreadContextCommands.CONTINUE, {
            execute: () => this.selectedThread && this.selectedThread.continue(),
            isEnabled: () => !!this.selectedThread && this.selectedThread.stopped,
            isVisible: () => !!this.selectedThread && this.selectedThread.stopped,
        });
        registry.registerCommand(DebugThreadContextCommands.PAUSE, {
            execute: () => this.selectedThread && this.selectedThread.pause(),
            isEnabled: () => !!this.selectedThread && !this.selectedThread.stopped,
            isVisible: () => !!this.selectedThread && !this.selectedThread.stopped,
        });
        registry.registerCommand(DebugThreadContextCommands.TERMINATE, {
            execute: () => this.selectedThread && this.selectedThread.terminate(),
            isEnabled: () => !!this.selectedThread && this.selectedThread.supportsTerminate,
            isVisible: () => !!this.selectedThread && this.selectedThread.supportsTerminate
        });

        registry.registerCommand(DebugSessionContextCommands.STOP, {
            execute: () => this.selectedSession && this.selectedSession.terminate(),
            isEnabled: () => !!this.selectedSession && this.selectedSession.state !== DebugState.Inactive,
            isVisible: () => !this.selectedThread
        });
        registry.registerCommand(DebugSessionContextCommands.RESTART, {
            execute: () => this.selectedSession && this.manager.restart(this.selectedSession),
            isEnabled: () => !!this.selectedSession && this.selectedSession.state !== DebugState.Inactive,
            isVisible: () => !this.selectedThread
        });
        registry.registerCommand(DebugSessionContextCommands.CONTINUE_ALL, {
            execute: () => this.selectedSession && this.selectedSession.continueAll(),
            isEnabled: () => !!this.selectedSession && !!this.selectedSession.stoppedThreads.next().value,
            isVisible: () => !this.selectedThread
        });
        registry.registerCommand(DebugSessionContextCommands.PAUSE_ALL, {
            execute: () => this.selectedSession && this.selectedSession.pauseAll(),
            isEnabled: () => !!this.selectedSession && !!this.selectedSession.runningThreads.next().value,
            isVisible: () => !this.selectedThread
        });
        registry.registerCommand(DebugSessionContextCommands.REVEAL, {
            execute: () => this.selectedSession && this.revealSession(this.selectedSession),
            isEnabled: () => this.hasSessionWidget,
            isVisible: () => !this.selectedThread && this.hasSessionWidget
        });
        registry.registerCommand(DebugSessionContextCommands.OPEN_LEFT, {
            execute: () => this.selectedSession && this.openSession(this.selectedSession, {
                debugViewLocation: 'left'
            }),
            isEnabled: () => !this.hasSessionWidget,
            isVisible: () => !this.selectedThread && !this.hasSessionWidget
        });
        registry.registerCommand(DebugSessionContextCommands.OPEN_RIGHT, {
            execute: () => this.selectedSession && this.openSession(this.selectedSession, {
                debugViewLocation: 'right'
            }),
            isEnabled: () => !this.hasSessionWidget,
            isVisible: () => !this.selectedThread && !this.hasSessionWidget
        });
        registry.registerCommand(DebugSessionContextCommands.OPEN_BOTTOM, {
            execute: () => this.selectedSession && this.openSession(this.selectedSession, {
                debugViewLocation: 'bottom'
            }),
            isEnabled: () => !this.hasSessionWidget,
            isVisible: () => !this.selectedThread && !this.hasSessionWidget
        });

        registry.registerCommand(DebugCommands.TOGGLE_BREAKPOINT, {
            execute: () => this.editors.toggleBreakpoint(),
            isEnabled: () => !!this.editors.model
        });
        registry.registerCommand(DebugCommands.INLINE_BREAKPOINT, {
            execute: () => this.editors.addInlineBreakpoint(),
            isEnabled: () => !!this.editors.model && !this.editors.getInlineBreakpoint()
        });
        registry.registerCommand(DebugCommands.ADD_CONDITIONAL_BREAKPOINT, {
            execute: () => this.editors.addBreakpoint('condition'),
            isEnabled: () => !!this.editors.model && !this.editors.anyBreakpoint()
        });
        registry.registerCommand(DebugCommands.ADD_LOGPOINT, {
            execute: () => this.editors.addBreakpoint('logMessage'),
            isEnabled: () => !!this.editors.model && !this.editors.anyBreakpoint()
        });
        registry.registerCommand(DebugCommands.ADD_FUNCTION_BREAKPOINT, {
            execute: async () => {
                const { labelProvider, breakpointManager, editorManager } = this;
                const options = { labelProvider, breakpoints: breakpointManager, editorManager };
                await new DebugFunctionBreakpoint(FunctionBreakpoint.create({ name: '' }), options).open();
            },
            isEnabled: widget => !(widget instanceof Widget) || widget instanceof DebugBreakpointsWidget,
            isVisible: widget => !(widget instanceof Widget) || widget instanceof DebugBreakpointsWidget
        });
        registry.registerCommand(DebugCommands.ENABLE_ALL_BREAKPOINTS, {
            execute: () => this.breakpointManager.enableAllBreakpoints(true),
            isEnabled: () => this.breakpointManager.hasBreakpoints()
        });
        registry.registerCommand(DebugCommands.DISABLE_ALL_BREAKPOINTS, {
            execute: () => this.breakpointManager.enableAllBreakpoints(false),
            isEnabled: () => this.breakpointManager.hasBreakpoints()
        });
        registry.registerCommand(DebugCommands.EDIT_BREAKPOINT, {
            execute: async () => {
                const { selectedBreakpoint, selectedFunctionBreakpoint } = this;
                if (selectedBreakpoint) {
                    await this.editors.editBreakpoint(selectedBreakpoint);
                } else if (selectedFunctionBreakpoint) {
                    await selectedFunctionBreakpoint.open();
                }
            },
            isEnabled: () => !!this.selectedBreakpoint || !!this.selectedFunctionBreakpoint,
            isVisible: () => !!this.selectedBreakpoint || !!this.selectedFunctionBreakpoint
        });
        registry.registerCommand(DebugCommands.EDIT_LOGPOINT, {
            execute: async () => {
                const { selectedLogpoint } = this;
                if (selectedLogpoint) {
                    await this.editors.editBreakpoint(selectedLogpoint);
                }
            },
            isEnabled: () => !!this.selectedLogpoint,
            isVisible: () => !!this.selectedLogpoint
        });
        registry.registerCommand(DebugCommands.REMOVE_BREAKPOINT, {
            execute: () => {
                const selectedBreakpoint = this.selectedBreakpoint || this.selectedFunctionBreakpoint;
                if (selectedBreakpoint) {
                    selectedBreakpoint.remove();
                }
            },
            isEnabled: () => !!this.selectedBreakpoint || !!this.selectedFunctionBreakpoint,
            isVisible: () => !!this.selectedBreakpoint || !!this.selectedFunctionBreakpoint,
        });
        registry.registerCommand(DebugCommands.REMOVE_LOGPOINT, {
            execute: () => {
                const { selectedLogpoint } = this;
                if (selectedLogpoint) {
                    selectedLogpoint.remove();
                }
            },
            isEnabled: () => !!this.selectedLogpoint,
            isVisible: () => !!this.selectedLogpoint
        });
        registry.registerCommand(DebugCommands.REMOVE_ALL_BREAKPOINTS, {
            execute: () => this.breakpointManager.removeBreakpoints(),
            isEnabled: () => this.breakpointManager.hasBreakpoints(),
            isVisible: widget => !(widget instanceof Widget) || (widget instanceof DebugBreakpointsWidget)
        });
        registry.registerCommand(DebugCommands.TOGGLE_BREAKPOINTS_ENABLED, {
            execute: () => this.breakpointManager.breakpointsEnabled = !this.breakpointManager.breakpointsEnabled,
            isVisible: arg => arg instanceof DebugBreakpointsWidget
        });
        registry.registerCommand(DebugCommands.SHOW_HOVER, {
            execute: () => this.editors.showHover(),
            isEnabled: () => this.editors.canShowHover()
        });

        registry.registerCommand(DebugCommands.RESTART_FRAME, {
            execute: () => this.selectedFrame && this.selectedFrame.restart(),
            isEnabled: () => !!this.selectedFrame
        });
        registry.registerCommand(DebugCommands.COPY_CALL_STACK, {
            execute: () => {
                const { frames } = this;
                const selection = document.getSelection();
                if (frames && selection) {
                    selection.selectAllChildren(frames.node);
                    document.execCommand('copy');
                }
            },
            isEnabled: () => document.queryCommandSupported('copy'),
            isVisible: () => document.queryCommandSupported('copy')
        });

        registry.registerCommand(DebugCommands.SET_VARIABLE_VALUE, {
            execute: () => this.selectedVariable && this.selectedVariable.open(),
            isEnabled: () => !!this.selectedVariable && this.selectedVariable.supportSetVariable,
            isVisible: () => !!this.selectedVariable && this.selectedVariable.supportSetVariable
        });
        registry.registerCommand(DebugCommands.COPY_VARIABLE_VALUE, {
            execute: () => this.selectedVariable && this.selectedVariable.copyValue(),
            isEnabled: () => !!this.selectedVariable && this.selectedVariable.supportCopyValue,
            isVisible: () => !!this.selectedVariable && this.selectedVariable.supportCopyValue
        });
        registry.registerCommand(DebugCommands.COPY_VARIABLE_AS_EXPRESSION, {
            execute: () => this.selectedVariable && this.selectedVariable.copyAsExpression(),
            isEnabled: () => !!this.selectedVariable && this.selectedVariable.supportCopyAsExpression,
            isVisible: () => !!this.selectedVariable && this.selectedVariable.supportCopyAsExpression
        });
        registry.registerCommand(DebugCommands.WATCH_VARIABLE, {
            execute: () => {
                const { selectedVariable, watch } = this;
                if (selectedVariable && watch) {
                    watch.viewModel.addWatchExpression(selectedVariable.name);
                }
            },
            isEnabled: () => !!this.selectedVariable && !!this.watch,
            isVisible: () => !!this.selectedVariable && !!this.watch,
        });

        // Debug context menu commands
        registry.registerCommand(DebugEditorContextCommands.ADD_BREAKPOINT, {
            execute: position => this.isPosition(position) && this.editors.toggleBreakpoint(position),
            isEnabled: position => this.isPosition(position) && !this.editors.anyBreakpoint(position),
            isVisible: position => this.isPosition(position) && !this.editors.anyBreakpoint(position)
        });
        registry.registerCommand(DebugEditorContextCommands.ADD_CONDITIONAL_BREAKPOINT, {
            execute: position => this.isPosition(position) && this.editors.addBreakpoint('condition', position),
            isEnabled: position => this.isPosition(position) && !this.editors.anyBreakpoint(position),
            isVisible: position => this.isPosition(position) && !this.editors.anyBreakpoint(position)
        });
        registry.registerCommand(DebugEditorContextCommands.ADD_LOGPOINT, {
            execute: position => this.isPosition(position) && this.editors.addBreakpoint('logMessage', position),
            isEnabled: position => this.isPosition(position) && !this.editors.anyBreakpoint(position),
            isVisible: position => this.isPosition(position) && !this.editors.anyBreakpoint(position)
        });
        registry.registerCommand(DebugEditorContextCommands.REMOVE_BREAKPOINT, {
            execute: position => this.isPosition(position) && this.editors.toggleBreakpoint(position),
            isEnabled: position => this.isPosition(position) && !!this.editors.getBreakpoint(position),
            isVisible: position => this.isPosition(position) && !!this.editors.getBreakpoint(position)
        });
        registry.registerCommand(DebugEditorContextCommands.EDIT_BREAKPOINT, {
            execute: position => this.isPosition(position) && this.editors.editBreakpoint(position),
            isEnabled: position => this.isPosition(position) && !!this.editors.getBreakpoint(position),
            isVisible: position => this.isPosition(position) && !!this.editors.getBreakpoint(position)
        });
        registry.registerCommand(DebugEditorContextCommands.ENABLE_BREAKPOINT, {
            execute: position => this.isPosition(position) && this.editors.setBreakpointEnabled(position, true),
            isEnabled: position => this.isPosition(position) && this.editors.getBreakpointEnabled(position) === false,
            isVisible: position => this.isPosition(position) && this.editors.getBreakpointEnabled(position) === false
        });
        registry.registerCommand(DebugEditorContextCommands.DISABLE_BREAKPOINT, {
            execute: position => this.isPosition(position) && this.editors.setBreakpointEnabled(position, false),
            isEnabled: position => this.isPosition(position) && !!this.editors.getBreakpointEnabled(position),
            isVisible: position => this.isPosition(position) && !!this.editors.getBreakpointEnabled(position)
        });
        registry.registerCommand(DebugEditorContextCommands.REMOVE_LOGPOINT, {
            execute: position => this.isPosition(position) && this.editors.toggleBreakpoint(position),
            isEnabled: position => this.isPosition(position) && !!this.editors.getLogpoint(position),
            isVisible: position => this.isPosition(position) && !!this.editors.getLogpoint(position)
        });
        registry.registerCommand(DebugEditorContextCommands.EDIT_LOGPOINT, {
            execute: position => this.isPosition(position) && this.editors.editBreakpoint(position),
            isEnabled: position => this.isPosition(position) && !!this.editors.getLogpoint(position),
            isVisible: position => this.isPosition(position) && !!this.editors.getLogpoint(position)
        });
        registry.registerCommand(DebugEditorContextCommands.ENABLE_LOGPOINT, {
            execute: position => this.isPosition(position) && this.editors.setBreakpointEnabled(position, true),
            isEnabled: position => this.isPosition(position) && this.editors.getLogpointEnabled(position) === false,
            isVisible: position => this.isPosition(position) && this.editors.getLogpointEnabled(position) === false
        });
        registry.registerCommand(DebugEditorContextCommands.DISABLE_LOGPOINT, {
            execute: position => this.isPosition(position) && this.editors.setBreakpointEnabled(position, false),
            isEnabled: position => this.isPosition(position) && !!this.editors.getLogpointEnabled(position),
            isVisible: position => this.isPosition(position) && !!this.editors.getLogpointEnabled(position)
        });

        registry.registerCommand(DebugBreakpointWidgetCommands.ACCEPT, {
            execute: () => this.editors.acceptBreakpoint()
        });
        registry.registerCommand(DebugBreakpointWidgetCommands.CLOSE, {
            execute: () => this.editors.closeBreakpoint()
        });

        registry.registerCommand(DebugCommands.ADD_WATCH_EXPRESSION, {
            execute: widget => {
                if (widget instanceof Widget) {
                    if (widget instanceof DebugWatchWidget) {
                        widget.viewModel.addWatchExpression();
                    }
                } else if (this.watch) {
                    this.watch.viewModel.addWatchExpression();
                }
            },
            isEnabled: widget => widget instanceof Widget ? widget instanceof DebugWatchWidget : !!this.watch,
            isVisible: widget => widget instanceof Widget ? widget instanceof DebugWatchWidget : !!this.watch
        });
        registry.registerCommand(DebugCommands.EDIT_WATCH_EXPRESSION, {
            execute: () => {
                const { watchExpression } = this;
                if (watchExpression) {
                    watchExpression.open();
                }
            },
            isEnabled: () => !!this.watchExpression,
            isVisible: () => !!this.watchExpression
        });
        registry.registerCommand(DebugCommands.COPY_WATCH_EXPRESSION_VALUE, {
            execute: () => this.watchExpression && this.watchExpression.copyValue(),
            isEnabled: () => !!this.watchExpression && this.watchExpression.supportCopyValue,
            isVisible: () => !!this.watchExpression && this.watchExpression.supportCopyValue
        });
        registry.registerCommand(DebugCommands.COLLAPSE_ALL_WATCH_EXPRESSIONS, {
            execute: widget => {
                if (widget instanceof DebugWatchWidget) {
                    const root = widget.model.root;
                    widget.model.collapseAll(CompositeTreeNode.is(root) ? root : undefined);
                }
            },
            isEnabled: widget => widget instanceof DebugWatchWidget,
            isVisible: widget => widget instanceof DebugWatchWidget
        });
        registry.registerCommand(DebugCommands.REMOVE_WATCH_EXPRESSION, {
            execute: () => {
                const { watch, watchExpression } = this;
                if (watch && watchExpression) {
                    watch.viewModel.removeWatchExpression(watchExpression);
                }
            },
            isEnabled: () => !!this.watchExpression,
            isVisible: () => !!this.watchExpression
        });
        registry.registerCommand(DebugCommands.REMOVE_ALL_WATCH_EXPRESSIONS, {
            execute: widget => {
                if (widget instanceof Widget) {
                    if (widget instanceof DebugWatchWidget) {
                        widget.viewModel.removeWatchExpressions();
                    }
                } else if (this.watch) {
                    this.watch.viewModel.removeWatchExpressions();
                }
            },
            isEnabled: widget => widget instanceof Widget ? widget instanceof DebugWatchWidget : !!this.watch,
            isVisible: widget => widget instanceof Widget ? widget instanceof DebugWatchWidget : !!this.watch
        });
    }

    registerKeybindings(keybindings: KeybindingRegistry): void {
        super.registerKeybindings(keybindings);
        keybindings.registerKeybinding({
            command: DebugCommands.START.id,
            keybinding: 'f5'
        });
        keybindings.registerKeybinding({
            command: DebugCommands.START_NO_DEBUG.id,
            keybinding: 'ctrl+f5'
        });
        keybindings.registerKeybinding({
            command: DebugCommands.STOP.id,
            keybinding: 'shift+f5',
            context: DebugKeybindingContexts.inDebugMode
        });

        keybindings.registerKeybinding({
            command: DebugCommands.RESTART.id,
            keybinding: 'shift+ctrlcmd+f5',
            context: DebugKeybindingContexts.inDebugMode
        });
        keybindings.registerKeybinding({
            command: DebugCommands.STEP_OVER.id,
            keybinding: 'f10',
            context: DebugKeybindingContexts.inDebugMode
        });
        keybindings.registerKeybinding({
            command: DebugCommands.STEP_INTO.id,
            keybinding: 'f11',
            context: DebugKeybindingContexts.inDebugMode
        });
        keybindings.registerKeybinding({
            command: DebugCommands.STEP_OUT.id,
            keybinding: 'shift+f11',
            context: DebugKeybindingContexts.inDebugMode
        });
        keybindings.registerKeybinding({
            command: DebugCommands.CONTINUE.id,
            keybinding: 'f5',
            context: DebugKeybindingContexts.inDebugMode
        });
        keybindings.registerKeybinding({
            command: DebugCommands.PAUSE.id,
            keybinding: 'f6',
            context: DebugKeybindingContexts.inDebugMode
        });

        keybindings.registerKeybinding({
            command: DebugCommands.TOGGLE_BREAKPOINT.id,
            keybinding: 'f9',
            context: EditorKeybindingContexts.editorTextFocus
        });
        keybindings.registerKeybinding({
            command: DebugCommands.INLINE_BREAKPOINT.id,
            keybinding: 'shift+f9',
            context: EditorKeybindingContexts.editorTextFocus
        });

        keybindings.registerKeybinding({
            command: DebugBreakpointWidgetCommands.ACCEPT.id,
            keybinding: 'enter',
            context: DebugKeybindingContexts.breakpointWidgetInputFocus
        });
        keybindings.registerKeybinding({
            command: DebugBreakpointWidgetCommands.CLOSE.id,
            keybinding: 'esc',
            context: DebugKeybindingContexts.breakpointWidgetInputStrictFocus
        });
    }

    registerToolbarItems(toolbar: TabBarToolbarRegistry): void {
        const onDidChangeToggleBreakpointsEnabled = new Emitter<void>();
        const toggleBreakpointsEnabled: Mutable<TabBarToolbarItem> = {
            id: DebugCommands.TOGGLE_BREAKPOINTS_ENABLED.id,
            command: DebugCommands.TOGGLE_BREAKPOINTS_ENABLED.id,
            icon: 'codicon codicon-activate-breakpoints',
            onDidChange: onDidChangeToggleBreakpointsEnabled.event,
            priority: 1
        };
        const updateToggleBreakpointsEnabled = () => {
            const tooltip = this.breakpointManager.breakpointsEnabled ? 'Deactivate Breakpoints' : 'Activate Breakpoints';
            if (toggleBreakpointsEnabled.tooltip !== tooltip) {
                toggleBreakpointsEnabled.tooltip = tooltip;
                onDidChangeToggleBreakpointsEnabled.fire(undefined);
            }
        };
        toolbar.registerItem({
            id: DebugCommands.ADD_FUNCTION_BREAKPOINT.id,
            command: DebugCommands.ADD_FUNCTION_BREAKPOINT.id,
            icon: 'theia-add-icon',
            tooltip: 'Add Function Breakpoint'
        });
        updateToggleBreakpointsEnabled();
        this.breakpointManager.onDidChangeBreakpoints(updateToggleBreakpointsEnabled);
        toolbar.registerItem(toggleBreakpointsEnabled);
        toolbar.registerItem({
            id: DebugCommands.REMOVE_ALL_BREAKPOINTS.id,
            command: DebugCommands.REMOVE_ALL_BREAKPOINTS.id,
            icon: 'theia-remove-all-icon',
            priority: 2
        });

        toolbar.registerItem({
            id: DebugCommands.ADD_WATCH_EXPRESSION.id,
            command: DebugCommands.ADD_WATCH_EXPRESSION.id,
            icon: 'theia-add-icon',
            tooltip: 'Add Expression'
        });
        toolbar.registerItem({
            id: DebugCommands.COLLAPSE_ALL_WATCH_EXPRESSIONS.id,
            command: DebugCommands.COLLAPSE_ALL_WATCH_EXPRESSIONS.id,
            icon: 'theia-collapse-all-icon',
            tooltip: 'Collapse All',
            priority: 1
        });
        toolbar.registerItem({
            id: DebugCommands.REMOVE_ALL_WATCH_EXPRESSIONS.id,
            command: DebugCommands.REMOVE_ALL_WATCH_EXPRESSIONS.id,
            icon: 'theia-remove-all-icon',
            tooltip: 'Remove All Expressions',
            priority: 2
        });
    }

    protected readonly sessionWidgets = new Map<string, DebugSessionWidget>();
    get hasSessionWidget(): boolean {
        return !!this.selectedSession && this.sessionWidgets.has(this.selectedSession.label);
    }
    protected async openSession(
        session: DebugSession,
        options?: {
            debugViewLocation?: DebugViewLocation
            reveal?: boolean
        }
    ): Promise<DebugWidget | DebugSessionWidget> {
        const { debugViewLocation, reveal } = {
            debugViewLocation: session.configuration.debugViewLocation || this.preference['debug.debugViewLocation'],
            reveal: true,
            ...options
        };
        const sessionWidget = this.revealSession(session);
        if (sessionWidget) {
            return sessionWidget;
        }
        const area = ApplicationShell.isSideArea(debugViewLocation) ? debugViewLocation : 'debug';
        if (area === 'debug') {
            return this.openView({ reveal });
        }
        const newSessionWidget = this.sessionWidgetFactory({ session });
        this.sessionWidgets.set(session.label, newSessionWidget);
        newSessionWidget.disposed.connect(() =>
            this.sessionWidgets.delete(session.label)
        );
        this.shell.addWidget(newSessionWidget, { area });
        if (reveal) {
            this.shell.revealWidget(newSessionWidget.id);
        }
        return newSessionWidget;
    }
    protected revealSession(session: DebugSession): DebugSessionWidget | undefined {
        const widget = this.sessionWidgets.get(session.label);
        if (widget) {
            this.shell.revealWidget(widget.id);
        }
        return widget;
    }

    async start(noDebug?: boolean, debugSessionOptions?: DebugSessionOptions): Promise<void> {
        let current = debugSessionOptions ? debugSessionOptions : this.configurations.current;
        // If no configurations are currently present, create the `launch.json` and prompt users to select the config.
        if (!current) {
            await this.configurations.addConfiguration();
            return;
        }
        if (current) {
            if (noDebug !== undefined) {
                current = {
                    ...current,
                    configuration: {
                        ...current.configuration,
                        noDebug
                    }
                };
            }
            await this.manager.start(current);
        }
    }

    get threads(): DebugThreadsWidget | undefined {
        const { currentWidget } = this.shell;
        return currentWidget instanceof DebugThreadsWidget && currentWidget || undefined;
    }
    get selectedSession(): DebugSession | undefined {
        const { threads } = this;
        return threads && threads.selectedElement instanceof DebugSession && threads.selectedElement || undefined;
    }
    get selectedThread(): DebugThread | undefined {
        const { threads } = this;
        return threads && threads.selectedElement instanceof DebugThread && threads.selectedElement || undefined;
    }

    get frames(): DebugStackFramesWidget | undefined {
        const { currentWidget } = this.shell;
        return currentWidget instanceof DebugStackFramesWidget && currentWidget || undefined;
    }
    get selectedFrame(): DebugStackFrame | undefined {
        const { frames } = this;
        return frames && frames.selectedElement instanceof DebugStackFrame && frames.selectedElement || undefined;
    }

    get breakpoints(): DebugBreakpointsWidget | undefined {
        const { currentWidget } = this.shell;
        return currentWidget instanceof DebugBreakpointsWidget && currentWidget || undefined;
    }
    get selectedAnyBreakpoint(): DebugBreakpoint | undefined {
        const { breakpoints } = this;
        const selectedElement = breakpoints && breakpoints.selectedElement;
        return selectedElement instanceof DebugBreakpoint ? selectedElement : undefined;
    }
    get selectedBreakpoint(): DebugSourceBreakpoint | undefined {
        const breakpoint = this.selectedAnyBreakpoint;
        return breakpoint && breakpoint instanceof DebugSourceBreakpoint && !breakpoint.logMessage ? breakpoint : undefined;
    }
    get selectedLogpoint(): DebugSourceBreakpoint | undefined {
        const breakpoint = this.selectedAnyBreakpoint;
        return breakpoint && breakpoint instanceof DebugSourceBreakpoint && !!breakpoint.logMessage ? breakpoint : undefined;
    }
    get selectedFunctionBreakpoint(): DebugFunctionBreakpoint | undefined {
        const breakpoint = this.selectedAnyBreakpoint;
        return breakpoint && breakpoint instanceof DebugFunctionBreakpoint ? breakpoint : undefined;
    }

    get variables(): DebugVariablesWidget | undefined {
        const { currentWidget } = this.shell;
        return currentWidget instanceof DebugVariablesWidget && currentWidget || undefined;
    }
    get selectedVariable(): DebugVariable | undefined {
        const { variables } = this;
        return variables && variables.selectedElement instanceof DebugVariable && variables.selectedElement || undefined;
    }

    get watch(): DebugWatchWidget | undefined {
        const { currentWidget } = this.shell;
        return currentWidget instanceof DebugWatchWidget && currentWidget || undefined;
    }
    get watchExpression(): DebugWatchExpression | undefined {
        const { watch } = this;
        return watch && watch.selectedElement instanceof DebugWatchExpression && watch.selectedElement || undefined;
    }

    protected isPosition(position: monaco.Position): boolean {
        return (position instanceof monaco.Position);
    }

    registerColors(colors: ColorRegistry): void {
        colors.register(
            // Debug colors should be aligned with https://code.visualstudio.com/api/references/theme-color#debug
            {
                id: 'editor.stackFrameHighlightBackground',
                defaults: { dark: '#ffff0033', light: '#ffff6673', hc: '#fff600' },
                description: 'Background color for the highlight of line at the top stack frame position.'
            }, {
            id: 'editor.focusedStackFrameHighlightBackground',
            defaults: { dark: '#7abd7a4d', light: '#cee7ce73', hc: '#cee7ce' },
            description: 'Background color for the highlight of line at focused stack frame position.'
        },
            // Status bar colors should be aligned with debugging colors from https://code.visualstudio.com/api/references/theme-color#status-bar-colors
            {
                id: 'statusBar.debuggingBackground', defaults: {
                    dark: '#CC6633',
                    light: '#CC6633',
                    hc: '#CC6633'
                }, description: 'Status bar background color when a program is being debugged. The status bar is shown in the bottom of the window'
            },
            {
                id: 'statusBar.debuggingForeground', defaults: {
                    dark: 'statusBar.foreground',
                    light: 'statusBar.foreground',
                    hc: 'statusBar.foreground'
                }, description: 'Status bar foreground color when a program is being debugged. The status bar is shown in the bottom of the window'
            },
            {
                id: 'statusBar.debuggingBorder', defaults: {
                    dark: 'statusBar.border',
                    light: 'statusBar.border',
                    hc: 'statusBar.border'
                }, description: 'Status bar border color separating to the sidebar and editor when a program is being debugged. The status bar is shown in the bottom of the window'
            },
            // Debug Exception Widget colors should be aligned with
            // https://github.com/microsoft/vscode/blob/ff5f581425da6230b6f9216ecf19abf6c9d285a6/src/vs/workbench/contrib/debug/browser/exceptionWidget.ts#L23
            {
                id: 'debugExceptionWidget.border', defaults: {
                    dark: '#a31515', light: '#a31515', hc: '#a31515'
                }, description: 'Exception widget border color.',
            }, {
            id: 'debugExceptionWidget.background', defaults: {
                dark: '#420b0d', light: '#f1dfde', hc: '#420b0d'
            }, description: 'Exception widget background color.'
        },
            // Debug Icon colors should be aligned with
            // https://code.visualstudio.com/api/references/theme-color#debug-icons-colors
            {
                id: 'debugIcon.breakpointForeground', defaults: {
                    dark: '#E51400', light: '#E51400', hc: '#E51400'
                },
                description: 'Icon color for breakpoints.'
            },
            {
                id: 'debugIcon.breakpointDisabledForeground', defaults: {
                    dark: '#848484', light: '#848484', hc: '#848484'
                },
                description: 'Icon color for disabled breakpoints.'
            },
            {
                id: 'debugIcon.breakpointUnverifiedForeground', defaults: {
                    dark: '#848484', light: '#848484', hc: '#848484'
                },
                description: 'Icon color for unverified breakpoints.'
            },
            {
                id: 'debugIcon.breakpointCurrentStackframeForeground', defaults: {
                    dark: '#FFCC00', light: '#FFCC00', hc: '#FFCC00'
                },
                description: 'Icon color for the current breakpoint stack frame.'
            },
            {
                id: 'debugIcon.breakpointStackframeForeground', defaults: {
                    dark: '#89D185', light: '#89D185', hc: '#89D185'
                },
                description: 'Icon color for all breakpoint stack frames.'
            },
            {
                id: 'debugIcon.startForeground', defaults: {
                    dark: '#89D185', light: '#388A34', hc: '#89D185'
                }, description: 'Debug toolbar icon for start debugging.'
            },
            {
                id: 'debugIcon.pauseForeground', defaults: {
                    dark: '#75BEFF', light: '#007ACC', hc: '#75BEFF'
                }, description: 'Debug toolbar icon for pause.'
            },
            {
                id: 'debugIcon.stopForeground', defaults: {
                    dark: '#F48771', light: '#A1260D', hc: '#F48771'
                }, description: 'Debug toolbar icon for stop.'
            },
            {
                id: 'debugIcon.disconnectForeground', defaults: {
                    dark: '#F48771', light: '#A1260D', hc: '#F48771'
                }, description: 'Debug toolbar icon for disconnect.'
            },
            {
                id: 'debugIcon.restartForeground', defaults: {
                    dark: '#89D185', light: '#388A34', hc: '#89D185'
                }, description: 'Debug toolbar icon for restart.'
            },
            {
                id: 'debugIcon.stepOverForeground', defaults: {
                    dark: '#75BEFF', light: '#007ACC', hc: '#75BEFF'
                }, description: 'Debug toolbar icon for step over.'
            },
            {
                id: 'debugIcon.stepIntoForeground', defaults: {
                    dark: '#75BEFF', light: '#007ACC', hc: '#75BEFF'
                }, description: 'Debug toolbar icon for step into.'
            },
            {
                id: 'debugIcon.stepOutForeground', defaults: {
                    dark: '#75BEFF', light: '#007ACC', hc: '#75BEFF'
                }, description: 'Debug toolbar icon for step over.'
            },
            {
                id: 'debugIcon.continueForeground', defaults: {
                    dark: '#75BEFF', light: '#007ACC', hc: '#75BEFF'
                }, description: 'Debug toolbar icon for continue.'
            },
            {
                id: 'debugIcon.stepBackForeground', defaults: {
                    dark: '#75BEFF', light: '#007ACC', hc: '#75BEFF'
                }, description: 'Debug toolbar icon for step back.'
            },
            {
                id: 'debugConsole.infoForeground', defaults: {
                    dark: 'editorInfo.foreground', light: 'editorInfo.foreground', hc: 'foreground'
                }, description: 'Foreground color for info messages in debug REPL console.'
            },
            {
                id: 'debugConsole.warningForeground', defaults: {
                    dark: 'editorWarning.foreground', light: 'editorWarning.foreground', hc: '#008000'
                },
                description: 'Foreground color for warning messages in debug REPL console.'
            },
            {
                id: 'debugConsole.errorForeground', defaults: {
                    dark: 'errorForeground', light: 'errorForeground', hc: 'errorForeground'
                },
                description: 'Foreground color for error messages in debug REPL console.',
            },
            {
                id: 'debugConsole.sourceForeground', defaults: {
                    dark: 'foreground', light: 'foreground', hc: 'foreground'
                },
                description: 'Foreground color for source filenames in debug REPL console.',
            },
            {
                id: 'debugConsoleInputIcon.foreground', defaults: {
                    dark: 'foreground', light: 'foreground', hc: 'foreground'
                },
                description: 'Foreground color for debug console input marker icon.'
            }
        );
    }

    protected updateStatusBar(): void {
        if (this.debuggingStatusBar === document.body.classList.contains('theia-mod-debugging')) {
            return;
        }
        document.body.classList.toggle('theia-mod-debugging');
    }

    protected get debuggingStatusBar(): boolean {
        if (this.manager.state < DebugState.Running) {
            return false;
        }

        const session = this.manager.currentSession;
        if (session && session.configuration.noDebug) {
            return false;
        }

        return true;
    }

}
