/********************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
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

import { UUID } from '@theia/core/shared/@phosphor/coreutils';
import { injectable, inject } from '@theia/core/shared/inversify';
import { MessagingService } from '@theia/core/lib/node/messaging/messaging-service';

import { DebugAdapterPath } from '../common/debug-service';
import { DebugConfiguration } from '../common/debug-configuration';
import { DebugAdapterSession, DebugAdapterSessionFactory, DebugAdapterFactory } from '../common/debug-model';
import { DebugAdapterContributionRegistry } from './debug-adapter-contribution-registry';

/**
 * Debug adapter session manager.
 */
@injectable()
export class DebugAdapterSessionManager implements MessagingService.Contribution {
    protected readonly sessions = new Map<string, DebugAdapterSession>();

    @inject(DebugAdapterSessionFactory)
    protected readonly debugAdapterSessionFactory: DebugAdapterSessionFactory;

    @inject(DebugAdapterFactory)
    protected readonly debugAdapterFactory: DebugAdapterFactory;

    configure(service: MessagingService): void {
        service.wsChannel(`${DebugAdapterPath}/:id`, ({ id }: { id: string }, channel) => {
            const session = this.find(id);
            if (!session) {
                channel.close();
                return;
            }
            channel.onClose(() => session.stop());
            session.start(channel);
        });
    }

    /**
     * Creates a new [debug adapter session](#DebugAdapterSession).
     * @param config The [DebugConfiguration](#DebugConfiguration)
     * @returns The debug adapter session
     */
    async create(config: DebugConfiguration, registry: DebugAdapterContributionRegistry): Promise<DebugAdapterSession> {
        const sessionId = UUID.uuid4();

        let communicationProvider;
        if ('debugServer' in config) {
            communicationProvider = this.debugAdapterFactory.connect(config.debugServer);
        } else {
            const executable = await registry.provideDebugAdapterExecutable(config);
            communicationProvider = this.debugAdapterFactory.start(executable);
        }

        const sessionFactory = registry.debugAdapterSessionFactory(config.type) || this.debugAdapterSessionFactory;
        const session = sessionFactory.get(sessionId, communicationProvider);
        this.sessions.set(sessionId, session);

        if (config.parentSession) {
            const parentSession = this.sessions.get(config.parentSession.id);
            if (parentSession) {
                session.parentSession = parentSession;
            }
        }

        return session;
    }

    /**
     * Removes [debug adapter session](#DebugAdapterSession) from the list of the instantiated sessions.
     * Is invoked when session is terminated and isn't needed anymore.
     * @param sessionId The session identifier
     */
    remove(sessionId: string): void {
        this.sessions.delete(sessionId);
    }

    /**
     * Finds the debug adapter session by its id.
     * Returning the value 'undefined' means the session isn't found.
     * @param sessionId The session identifier
     * @returns The debug adapter session
     */
    find(sessionId: string): DebugAdapterSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Returns all instantiated debug adapter sessions.
     * @returns An array of debug adapter sessions
     */
    getAll(): IterableIterator<DebugAdapterSession> {
        return this.sessions.values();
    }
}
