/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
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

import { ViewContainer, WidgetFactory, WidgetManager } from '@theia/core/lib/browser';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { CommandContribution, CommandRegistry, Emitter } from '@theia/core/lib/common';
import { inject, injectable, interfaces, postConstruct } from '@theia/core/shared/inversify';
import { EXPLORER_VIEW_CONTAINER_ID } from '@theia/navigator/lib/browser';
import { SampleViewContainerPart } from './sample-view-container-part';

const CHANGE_TO_MINUS_COMMAND = {
    id: 'sample-view-container-part-to-minus',
    label: 'Change the command displayed in the Sample View Container Part toolbar to a minus sign.',
    iconClass: 'fa fa-plus'
};

const CHANGE_TO_PLUS_COMMAND = {
    id: 'sample-view-container-part-to-plus',
    label: 'Change the command displayed in the Sample View Container Part toolbar to a plus sign.',
    iconClass: 'fa fa-minus'
};

@injectable()
export class SampleViewContainerPartContribution implements CommandContribution, TabBarToolbarContribution {
    protected readonly onChangeEmitter = new Emitter<void>();
    readonly onChange = this.onChangeEmitter.event;

    @inject(WidgetManager) protected readonly widgetManager: WidgetManager;

    @postConstruct()
    protected async init(): Promise<void> {
        const widget = await this.widgetManager.getOrCreateWidget<SampleViewContainerPart>(SampleViewContainerPart.ID);
        widget.onIconDisplayChanged(() => this.onChangeEmitter.fire());
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(CHANGE_TO_PLUS_COMMAND,
            {
                isVisible: widget => widget instanceof SampleViewContainerPart && !widget.shouldShowPlus,
                isEnabled: widget => widget instanceof SampleViewContainerPart && !widget.shouldShowPlus,
                execute: (widget: SampleViewContainerPart) => {
                    widget.changeDisplay();
                }
            });
        registry.registerCommand(CHANGE_TO_MINUS_COMMAND,
            {
                isVisible: widget => widget instanceof SampleViewContainerPart && widget.shouldShowPlus,
                isEnabled: widget => widget instanceof SampleViewContainerPart && widget.shouldShowPlus,
                execute: (widget: SampleViewContainerPart) => {
                    widget.changeDisplay();
                }
            });
    }

    registerToolbarItems(registry: TabBarToolbarRegistry): void {
        registry.registerItem({
            command: CHANGE_TO_PLUS_COMMAND.id,
            id: CHANGE_TO_PLUS_COMMAND.id,
            tooltip: CHANGE_TO_PLUS_COMMAND.label,
            onDidChange: this.onChange,
        });
        registry.registerItem({
            command: CHANGE_TO_MINUS_COMMAND.id,
            id: CHANGE_TO_MINUS_COMMAND.id,
            tooltip: CHANGE_TO_MINUS_COMMAND.label,
            onDidChange: this.onChange,
        });
    }
}

export const bindSampleViewContainerPart = (bind: interfaces.Bind): void => {
    bind(SampleViewContainerPart).toSelf().inSingletonScope();
    bind(SampleViewContainerPartContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(SampleViewContainerPartContribution);
    bind(TabBarToolbarContribution).toService(SampleViewContainerPartContribution);
    bind(WidgetFactory).toDynamicValue(({ container }) => ({
        id: SampleViewContainerPart.ID,
        createWidget: async () => {
            const widgetManager = container.get(WidgetManager);
            const viewContainer = await widgetManager.getOrCreateWidget<ViewContainer>(EXPLORER_VIEW_CONTAINER_ID);
            const viewContainerPart = container.get(SampleViewContainerPart);
            viewContainer.addWidget(viewContainerPart);
            return viewContainerPart;
        }
    })).inSingletonScope();
};

