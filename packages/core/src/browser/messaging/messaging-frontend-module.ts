/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule } from "inversify";
import { WebSocketConnectionProvider } from './connection';
import { WebSocketFactory } from "./web-socket-factory";

export const messagingFrontendModule = new ContainerModule(bind => {
    bind(WebSocketFactory).toSelf().inSingletonScope();
    bind(WebSocketConnectionProvider).toSelf().inSingletonScope();
});
