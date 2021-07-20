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

import { ConsoleSessionManager } from '@theia/console/lib/browser/console-session-manager';
import { ConsoleOptions, ConsoleWidget } from '@theia/console/lib/browser/console-widget';
import { AbstractViewContribution, bindViewContribution, Widget, WidgetFactory } from '@theia/core/lib/browser';
import { ContextKey, ContextKeyService } from '@theia/core/lib/browser/context-key-service';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { Command, CommandRegistry } from '@theia/core/lib/common/command';
import { Severity } from '@theia/core/lib/common/severity';
import { inject, injectable, interfaces, postConstruct } from '@theia/core/shared/inversify';
import * as React from '@theia/core/shared/react';
import { DebugConsoleMode } from '../../common/debug-configuration';
import { DebugSession } from '../debug-session';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugConsoleSession, DebugConsoleSessionFactory } from './debug-console-session';

export type InDebugReplContextKey = ContextKey<boolean>;
export const InDebugReplContextKey = Symbol('inDebugReplContextKey');

export namespace DebugConsoleCommands {
    const DEBUG_CONSOLE_CATEGORY = 'Debug';
    export const CLEAR: Command = {
        id: 'debug.console.clear',
        category: DEBUG_CONSOLE_CATEGORY,
        label: 'Clear Console',
        iconClass: 'clear-all'
    };
}

@injectable()
export class DebugConsoleContribution extends AbstractViewContribution<ConsoleWidget> implements TabBarToolbarContribution {

    @inject(ConsoleSessionManager)
    protected consoleSessionManager: ConsoleSessionManager;

    @inject(DebugConsoleSessionFactory)
    protected debugConsoleSessionFactory: DebugConsoleSessionFactory;

    @inject(DebugSessionManager)
    protected debugSessionManager: DebugSessionManager;

    constructor() {
        super({
            widgetId: DebugConsoleContribution.options.id,
            widgetName: DebugConsoleContribution.options.title!.label!,
            defaultWidgetOptions: {
                area: 'bottom'
            },
            toggleCommandId: 'debug:console:toggle',
            toggleKeybinding: 'ctrlcmd+shift+y'
        });
    }

    @postConstruct()
    protected init(): void {
        this.debugSessionManager.onDidCreateDebugSession(session => {
            const topParent = this.findParentSession(session);
            if (topParent) {
                const parentConsoleSession = this.consoleSessionManager.get(topParent.id);
                if (parentConsoleSession instanceof DebugConsoleSession) {
                    session.on('output', event => parentConsoleSession.logOutput(parentConsoleSession.debugSession, event));
                }
            } else {
                const consoleSession = this.debugConsoleSessionFactory(session);
                this.consoleSessionManager.add(consoleSession);
                session.on('output', event => consoleSession.logOutput(session, event));
            }
        });
        this.debugSessionManager.onDidDestroyDebugSession(session => {
            this.consoleSessionManager.delete(session.id);
        });
    }

    protected findParentSession(session: DebugSession): DebugSession | undefined {
        if (session.configuration.consoleMode !== DebugConsoleMode.MergeWithParent) {
            return undefined;
        }
        let debugSession: DebugSession | undefined = session;
        do {
            debugSession = debugSession.parentSession;
        } while (debugSession?.parentSession && debugSession.configuration.consoleMode === DebugConsoleMode.MergeWithParent);
        return debugSession;
    }

    registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        commands.registerCommand(DebugConsoleCommands.CLEAR, {
            isEnabled: widget => this.withWidget(widget, () => true),
            isVisible: widget => this.withWidget(widget, () => true),
            execute: widget => this.withWidget(widget, () => {
                this.clearConsole();
            }),
        });
    }

    async registerToolbarItems(toolbarRegistry: TabBarToolbarRegistry): Promise<void> {
        toolbarRegistry.registerItem({
            id: 'debug-console-severity',
            render: widget => this.renderSeveritySelector(widget),
            isVisible: widget => this.withWidget(widget, () => true),
            onDidChange: this.consoleSessionManager.onDidChangeSeverity
        });

        toolbarRegistry.registerItem({
            id: 'debug-console-session-selector',
            render: widget => this.renderDebugConsoleSelector(widget),
            isVisible: widget => this.withWidget(widget, () => this.consoleSessionManager.all.length > 1)
        });

        toolbarRegistry.registerItem({
            id: DebugConsoleCommands.CLEAR.id,
            command: DebugConsoleCommands.CLEAR.id,
            tooltip: 'Clear Console',
            priority: 0,
        });
    }

    static options: ConsoleOptions = {
        id: 'debug-console',
        title: {
            label: 'Debug Console',
            iconClass: 'theia-debug-console-icon'
        },
        input: {
            uri: DebugConsoleSession.uri,
            options: {
                autoSizing: true,
                minHeight: 1,
                maxHeight: 10
            }
        }
    };

    static create(parent: interfaces.Container): ConsoleWidget {
        const inputFocusContextKey = parent.get<InDebugReplContextKey>(InDebugReplContextKey);
        const child = ConsoleWidget.createContainer(parent, {
            ...DebugConsoleContribution.options,
            inputFocusContextKey
        });
        const widget = child.get(ConsoleWidget);
        return widget;
    }

    static bindContribution(bind: interfaces.Bind): void {
        bind(InDebugReplContextKey).toDynamicValue(({ container }) =>
            container.get(ContextKeyService).createKey('inDebugRepl', false)
        ).inSingletonScope();
        bind(DebugConsoleSession).toSelf().inRequestScope();
        bind(DebugConsoleSessionFactory).toFactory(context => (session: DebugSession) => {
            const consoleSession = context.container.get(DebugConsoleSession);
            consoleSession.debugSession = session;
            return consoleSession;
        });
        bind(ConsoleSessionManager).toSelf().inSingletonScope();
        bindViewContribution(bind, DebugConsoleContribution);
        bind(TabBarToolbarContribution).toService(DebugConsoleContribution);
        bind(WidgetFactory).toDynamicValue(({ container }) => ({
            id: DebugConsoleContribution.options.id,
            createWidget: () => DebugConsoleContribution.create(container)
        }));
    }

    protected renderSeveritySelector(widget: Widget | undefined): React.ReactNode {
        const severityElements: React.ReactNode[] = [];
        Severity.toArray().forEach(s => severityElements.push(<option value={s} key={s}>{s}</option>));
        const selectedValue = Severity.toString(this.consoleSessionManager.severity || Severity.Ignore);

        return <select
            className='theia-select'
            id={'debugConsoleSeverity'}
            key={'debugConsoleSeverity'}
            value={selectedValue}
            onChange={this.changeSeverity}
        >
            {severityElements}
        </select>;
    }

    protected renderDebugConsoleSelector(widget: Widget | undefined): React.ReactNode {
        const availableConsoles: React.ReactNode[] = [];
        this.consoleSessionManager.all.forEach(e => {
            if (e instanceof DebugConsoleSession) {
                availableConsoles.push(<option value={e.id} key={e.id}>{e.debugSession.label}</option>);
            }
        });
        return <select
            className='theia-select'
            id='debugConsoleSelector'
            key='debugConsoleSelector'
            value={undefined}
            onChange={this.changeDebugConsole}
        >
            {availableConsoles}
        </select>;
    }

    protected changeDebugConsole = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const id = event.target.value;
        const session = this.consoleSessionManager.get(id);
        this.consoleSessionManager.selectedSession = session;
    };

    protected changeSeverity = (event: React.ChangeEvent<HTMLSelectElement>) => {
        this.consoleSessionManager.severity = Severity.fromValue(event.target.value);
    };

    protected withWidget<T>(widget: Widget | undefined = this.tryGetWidget(), fn: (widget: ConsoleWidget) => T): T | false {
        if (widget instanceof ConsoleWidget && widget.id === DebugConsoleContribution.options.id) {
            return fn(widget);
        }
        return false;
    }

    /**
     * Clear the console widget.
     */
    protected async clearConsole(): Promise<void> {
        const widget = await this.widget;
        widget.clear();
    }

}
