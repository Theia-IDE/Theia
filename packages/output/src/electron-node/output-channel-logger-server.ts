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
import { LoggerWatcher } from '@theia/core/lib/common/logger-watcher';
import { LogLevelCliContribution } from '@theia/core/lib/node/logger-cli-contribution';
import { ILoggerClient, ConsoleLogger } from '@theia/core/lib/common/logger-protocol';
import { ConsoleLoggerServer } from '@theia/core/lib/node/console-logger-server';
import { OutputChannelBackendManager, LogOutputChannel } from '../node/output-channel-backend-manager';

@injectable()
export class OutputChannelLoggerServer extends ConsoleLoggerServer {

    protected client: ILoggerClient | undefined = undefined;

    @inject(LoggerWatcher)
    protected watcher: LoggerWatcher;

    @inject(LogLevelCliContribution)
    protected cli: LogLevelCliContribution;

    @inject(OutputChannelBackendManager)
    protected loggerService: OutputChannelBackendManager;

    @postConstruct()
    protected init(): void {
        super.init();
    }

    // tslint:disable:no-any
    async log(name: string, logLevel: number, message: any, params: any[]): Promise<void> {
        const configuredLogLevel = await this.getLogLevel(name);
        if (logLevel >= configuredLogLevel) {
            ConsoleLogger.log(name, logLevel, message, params);
            this.logToOutput(name, message, params);
        }
    }

    protected logToOutput(name: string, message: any, params: any[]): void {

        const outputChannel: LogOutputChannel = this.loggerService.getChannel(`Log (${name})`, 'log');

        if (typeof message === 'string') {
            outputChannel.appendLine(message);
        } else if (Array.isArray(message)) {
            // TODO pass in outputChannel so we don't look it up each time?
            message.forEach(line =>
                this.logToOutput(name, line, params)
            );
        } else {
            const line = JSON.stringify(message);
            outputChannel.appendLine(line);
        }
    }

}
