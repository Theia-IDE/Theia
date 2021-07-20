/********************************************************************************
 * Copyright (C) 2021 TypeFox and others.
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

import { injectable } from '@theia/core/shared/inversify';
import { Emitter, Event, Disposable, DisposableCollection } from '@theia/core';
import { ConsoleSession } from './console-session';
import { Severity } from '@theia/core/lib/common/severity';

@injectable()
export class ConsoleSessionManager implements Disposable {

    protected readonly sessions = new Map<string, ConsoleSession>();
    protected _selectedSession: ConsoleSession | undefined;
    protected _severity: Severity | undefined;

    protected readonly sessionAddedEmitter = new Emitter<ConsoleSession>();
    protected readonly sessionDeletedEmitter = new Emitter<ConsoleSession>();
    protected readonly sessionWasShownEmitter = new Emitter<ConsoleSession>();
    protected readonly sessionWasHiddenEmitter = new Emitter<ConsoleSession>();
    protected readonly selectedSessionChangedEmitter = new Emitter<ConsoleSession | undefined>();
    protected readonly severityChangedEmitter = new Emitter<void>();

    get onDidAddSession(): Event<ConsoleSession> {
        return this.sessionAddedEmitter.event;
    }
    get onDidDeleteSession(): Event<ConsoleSession> {
        return this.sessionDeletedEmitter.event;
    }
    get onDidShowSession(): Event<ConsoleSession> {
        return this.sessionWasShownEmitter.event;
    }
    get onDidHideSession(): Event<ConsoleSession> {
        return this.sessionWasHiddenEmitter.event;
    }
    get onDidChangeSelectedSession(): Event<ConsoleSession | undefined> {
        return this.selectedSessionChangedEmitter.event;
    }
    get onDidChangeSeverity(): Event<void> {
        return this.severityChangedEmitter.event;
    }

    protected readonly toDispose = new DisposableCollection();
    protected readonly toDisposeOnSessionDeletion = new Map<string, Disposable>();

    dispose(): void {
        this.toDispose.dispose();
    }

    get severity(): Severity | undefined {
        return this._severity;
    }

    set severity(value: Severity | undefined) {
        value = value || Severity.Ignore;
        this._severity = value;
        for (const session of this.sessions.values()) {
            session.severity = value;
        }
        this.severityChangedEmitter.fire(undefined);
    }

    get all(): ConsoleSession[] {
        return Array.from(this.sessions.values());
    }

    get selectedSession(): ConsoleSession | undefined {
        return this._selectedSession;
    }

    set selectedSession(session: ConsoleSession | undefined) {
        const oldSession = this.selectedSession;
        this._selectedSession = session;
        this.selectedSessionChangedEmitter.fire(session);
        if (oldSession !== session) {
            if (oldSession) {
                this.sessionWasHiddenEmitter.fire(oldSession);
            }
            if (session) {
                this.sessionWasShownEmitter.fire(session);
            }
        }
    }

    get(id: string): ConsoleSession | undefined {
        return this.sessions.get(id);
    }

    add(session: ConsoleSession): void {
        this.sessions.set(session.id, session);
        this.sessionAddedEmitter.fire(session);
        if (this.sessions.size === 1) {
            this.selectedSession = session;
        }
    }

    delete(id: string): void {
        const session = this.sessions.get(id);
        if (this.sessions.delete(id) && session) {
            this.sessionDeletedEmitter.fire(session);
            if (this.sessions.size === 0) {
                this.selectedSessionChangedEmitter.fire(undefined);
            }
        }
    }

}
