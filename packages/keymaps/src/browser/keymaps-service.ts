/********************************************************************************
 * Copyright (C) 2017 Ericsson and others.
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

import { inject, injectable, postConstruct } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { ResourceProvider, Resource, ResourceError } from '@theia/core/lib/common/resource';
import { OpenerService, open, WidgetOpenerOptions, Widget } from '@theia/core/lib/browser';
import { KeybindingRegistry, KeybindingScope } from '@theia/core/lib/browser/keybinding';
import { Keybinding } from '@theia/core/lib/common/keybinding';
import { UserStorageUri } from '@theia/userstorage/lib/browser';
import * as jsoncparser from 'jsonc-parser';
import { Emitter } from '@theia/core/lib/common/event';

@injectable()
export class KeymapsService {

    @inject(ResourceProvider)
    protected readonly resourceProvider: ResourceProvider;

    @inject(KeybindingRegistry)
    protected readonly keyBindingRegistry: KeybindingRegistry;

    @inject(OpenerService)
    protected readonly opener: OpenerService;

    protected readonly changeKeymapEmitter = new Emitter<void>();
    readonly onDidChangeKeymaps = this.changeKeymapEmitter.event;

    protected resource: Resource;

    /**
     * Initialize the keybinding service.
     */
    @postConstruct()
    protected async init(): Promise<void> {
        this.resource = await this.resourceProvider(new URI().withScheme(UserStorageUri.SCHEME).withPath('/keymaps.json'));
        this.reconcile();
        if (this.resource.onDidChangeContents) {
            this.resource.onDidChangeContents(() => this.reconcile());
        }
        this.keyBindingRegistry.onKeybindingsChanged(() => this.changeKeymapEmitter.fire(undefined));
    }

    /**
     * Reconcile all the keybindings, registering them to the registry.
     */
    protected async reconcile(): Promise<void> {
        const keybindings = await this.parseKeybindings();
        this.keyBindingRegistry.setKeymap(KeybindingScope.USER, keybindings);
        this.changeKeymapEmitter.fire(undefined);
    }

    /**
     * Parsed the read keybindings.
     */
    protected async parseKeybindings(): Promise<Keybinding[]> {
        const content = await this.readContents();
        const keybindings: Keybinding[] = [];
        const json = jsoncparser.parse(content, undefined, { disallowComments: false });
        if (Array.isArray(json)) {
            for (const value of json) {
                if (Keybinding.is(value)) {
                    keybindings.push(value);
                }
            }
        }
        return keybindings;
    }

    protected async readContents(): Promise<string> {
        try {
            return await this.resource.readContents();
        } catch (e) {
            if (ResourceError.NotFound.is(e)) {
                return '';
            }
            throw e;
        }
    }

    /**
     * Open the keybindings widget.
     * @param ref the optional reference for opening the widget.
     */
    open(ref?: Widget): void {
        const options: WidgetOpenerOptions = {
            widgetOptions: ref ? { area: 'main', mode: 'split-right', ref } : { area: 'main' },
            mode: 'activate'
        };
        open(this.opener, this.resource.uri, options);
    }

    /**
     * Set the keybinding in the JSON.
     * @param newKeybinding the JSON keybindings.
     */
    async setKeybinding(newKeybinding: Keybinding, oldKeybinding: Keybinding | string | undefined): Promise<void> {
        if (!this.resource.saveContents) {
            return;
        }
        const keybindings = await this.parseKeybindings();
        let newAdded = false;
        let oldRemoved = false;
        for (const keybinding of keybindings) {
            if (keybinding.command === newKeybinding.command &&
                (keybinding.context || '') === (newKeybinding.context || '') &&
                (keybinding.when || '') === (newKeybinding.when || '')) {
                newAdded = true;
                keybinding.keybinding = newKeybinding.keybinding;
            }
            if (oldKeybinding && keybinding.keybinding === oldKeybinding &&
                keybinding.command === '-' + newKeybinding.command &&
                (keybinding.context || '') === (newKeybinding.context || '') &&
                (keybinding.when || '') === (newKeybinding.when || '')) {
                oldRemoved = true;
            }
        }
        if (!newAdded) {
            keybindings.push({
                command: newKeybinding.command,
                keybinding: newKeybinding.keybinding,
                context: newKeybinding.context,
                when: newKeybinding.when,
                args: newKeybinding.args
            });
        }
        if (!oldRemoved && oldKeybinding) {
            keybindings.push({
                command: '-' + newKeybinding.command,
                // TODO key: oldKeybinding, see https://github.com/eclipse-theia/theia/issues/6879
                keybinding: typeof oldKeybinding === 'string' ? oldKeybinding : oldKeybinding.keybinding,
                context: typeof oldKeybinding === 'string' ? newKeybinding.context : oldKeybinding.context,
                when: typeof oldKeybinding === 'string' ? newKeybinding.when : oldKeybinding.when,
                args: typeof oldKeybinding === 'string' ? newKeybinding.args : oldKeybinding.args,
            });
        }
        // TODO use preference values to get proper json settings
        // TODO handle dirty models properly
        // TODO handle race conditions properly
        // TODO only apply minimal edits
        await this.resource.saveContents(JSON.stringify(keybindings, undefined, 4));
    }

    /**
     * Remove the given keybinding with the given command id from the JSON.
     * @param commandId the keybinding command id.
     */
    async removeKeybinding(commandId: string): Promise<void> {
        if (!this.resource.saveContents) {
            return;
        }
        const keybindings = await this.parseKeybindings();
        const removedCommand = '-' + commandId;
        const filtered = keybindings.filter(a => a.command !== commandId && a.command !== removedCommand);
        // TODO use preference values to get proper json settings
        // TODO handle dirty models properly
        // TODO handle race conditions properly
        // TODO only apply minimal edits
        await this.resource.saveContents(JSON.stringify(filtered, undefined, 4));
    }

}
