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

import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { Disposable } from '@theia/core/lib/common/disposable';
import { TaskConfiguration } from '../common/task-protocol';
import { WaitUntilEvent, Emitter } from '@theia/core/lib/common/event';

export const TaskContribution = Symbol('TaskContribution');

/**
 * A {@link TaskContribution} allows to contribute custom {@link TaskResolver}s and/or {@link TaskProvider}s.
 *
 *  ### Example usage
 * ```typescript
 * @injectable()
 * export class ProcessTaskContribution implements TaskContribution {
 *
 *     @inject(ProcessTaskResolver)
 *     protected readonly processTaskResolver: ProcessTaskResolver;
 *
 *     registerResolvers(resolvers: TaskResolverRegistry): void {
 *         resolvers.register('process', this.processTaskResolver);
 *         resolvers.register('shell', this.processTaskResolver);
 *     }
 * }
 * ```
 */
export interface TaskContribution {
    /**
     * Register task resolvers using the given `TaskResolverRegistry`.
     * @param resolvers the task resolver registry.
     */
    registerResolvers?(resolvers: TaskResolverRegistry): void;
    /**
     * Register task providers using the given `TaskProviderRegistry`.
     * @param resolvers the task provider registry.
     */
    registerProviders?(providers: TaskProviderRegistry): void;
}

/**
 * A {@link TaskResolver} is used to preprocess/resolve a task before sending
 * it to the Task Server. For instance, the resolver can be used to add missing information to the configuration
 * (e.g default values for optional parameters).
 */
export interface TaskResolver {
    /**
     * Resolves a `TaskConfiguration` before sending it for execution to the `TaskServer` (Backend).
     *
     * Note that a valid default implementation for the `resolveTask` method is to return `undefined`.
     *
     * @param taskConfig the configuration that should be resolved.
     *
     * @returns a promise of the resolved `TaskConfiguration` or `undefined`.
     */

    resolveTask(taskConfig: TaskConfiguration): Promise<TaskConfiguration | undefined>;
}

/**
 * A {@link TaskProvider} can be used to define the set of tasks that should
 * be provided to the system. i.e. that are available for the user to run.
 */
export interface TaskProvider {
    /**
     * Retrieves the task configurations which are provided programmatically to the system.
     *
     * @returns a promise of the provided tasks configurations.
     */
    provideTasks(): Promise<TaskConfiguration[]>;
}

/**
 * The {@link TaskResolverRegistry} is the common component for registration and provision of
 * {@link TaskResolver}s. Theia will collect all {@link TaskContribution}s and invoke {@link TaskContribution#registerResolvers}
 * for each contribution.
 */
@injectable()
export class TaskResolverRegistry {

    protected readonly onWillProvideTaskResolverEmitter = new Emitter<WaitUntilEvent>();
    /**
     * Emit when the registry provides a registered resolver. i.e. when the {@link TaskResolverRegistry#getResolver}
     * function is called.
     */
    readonly onWillProvideTaskResolver = this.onWillProvideTaskResolverEmitter.event;

    protected taskResolvers: Map<string, TaskResolver> = new Map();
    protected executionResolvers: Map<string, TaskResolver> = new Map();

    /**
     * Registers the given {@link TaskResolver} to resolve the `TaskConfiguration` of the specified type.
     * If there is already a `TaskResolver` registered for the specified type the registration will
     * be overwritten with the new value.
     *
     * @deprecated since 1.12.0 use `registerTaskResolver` instead.
     *
     * @param type the task configuration type for which the given resolver should be registered.
     * @param resolver the task resolver that should be registered.
     *
     * @returns a `Disposable` that can be invoked to unregister the given resolver
     */
    register(type: string, resolver: TaskResolver): Disposable {
        return this.registerTaskResolver(type, resolver);
    }

    /**
     * Registers the given {@link TaskResolver} to resolve the `TaskConfiguration` of the specified type.
     * If there is already a `TaskResolver` registered for the specified type the registration will
     * be overwritten with the new value.
     *
     * @param type the task configuration type for which the given resolver should be registered.
     * @param resolver the task resolver that should be registered.
     *
     * @returns a `Disposable` that can be invoked to unregister the given resolver
     */

    registerTaskResolver(type: string, resolver: TaskResolver): Disposable {
        if (this.taskResolvers.has(type)) {
            console.warn(`Overriding task resolver for ${type}`);
        }
        this.taskResolvers.set(type, resolver);
        return {
            dispose: () => this.taskResolvers.delete(type)
        };
    }

    /**
     * Retrieves the {@link TaskResolver} registered for the given type task configuration type.
     *
     * @deprecated since 1.12.0 use `getTaskResolver()` instead.
     *
     * @param type the task configuration type
     *
     * @returns a promise of the registered `TaskResolver` or `undefined` if no resolver is registered for the given type.
     */
    async getResolver(type: string): Promise<TaskResolver | undefined> {
        return this.getTaskResolver(type);
    }

    /**
     * Retrieves the {@link TaskResolver} registered for the given type task configuration type.
     * @param type the task configuration type
     *
     * @returns a promise of the registered `TaskResolver` or `undefined` if no resolver is registered for the given type.
     */
    async getTaskResolver(type: string): Promise<TaskResolver | undefined> {
        await WaitUntilEvent.fire(this.onWillProvideTaskResolverEmitter, {});
        return this.taskResolvers.get(type);
    }

    /**
     * Registers the given {@link TaskResolver} to resolve the `TaskConfiguration` for the
     * specified type of execution ('shell', 'process' or 'customExecution').
     * If there is already a `TaskResolver` registered for the specified type the registration will
     * be overwritten with the new value.
     *
     * @param type the task execution type for which the given resolver should be registered.
     * @param resolver the task resolver that should be registered.
     *
     * @returns a `Disposable` that can be invoked to unregister the given resolver
     */
    registerExecutionResolver(type: string, resolver: TaskResolver): Disposable {
        if (this.executionResolvers.has(type)) {
            console.warn(`Overriding execution resolver for ${type}`);
        }
        this.executionResolvers.set(type, resolver);
        return {
            dispose: () => this.executionResolvers.delete(type)
        };
    }

    /**
     * Retrieves the {@link TaskResolver} registered for the given type of execution ('shell', 'process' or 'customExecution')..
     * @param type the task configuration type
     *
     * @returns a promise of the registered `TaskResolver` or `undefined` if no resolver is registered for the given type.
     */
    getExecutionResolver(executionType: string): TaskResolver | undefined {
        return this.executionResolvers.get(executionType);
    }
}

/**
 * The {@link TaskProviderRegistry} is the common component for registration and provision of
 * {@link TaskProvider}s. Theia will collect all {@link TaskContribution}s and invoke {@link TaskContribution#registerProviders}
 * for each contribution.
 */
@injectable()
export class TaskProviderRegistry {

    protected readonly onWillProvideTaskProviderEmitter = new Emitter<WaitUntilEvent>();
    /**
     * Emit when the registry provides a registered task provider. i.e. when the {@link TaskProviderRegistry#getProvider}
     * function is called.
     */
    readonly onWillProvideTaskProvider = this.onWillProvideTaskProviderEmitter.event;

    protected providers: Map<string, TaskProvider>;

    @postConstruct()
    protected init(): void {
        this.providers = new Map();
    }

    /**
     * Registers the given {@link TaskProvider} for task configurations of the specified type
     * @param type the task configuration type for which the given provider should be registered.
     * @param provider the `TaskProvider` that should be registered.
     *
     * @returns a `Disposable` that can be invoked to unregister the given resolver.
     */
    register(type: string, provider: TaskProvider, handle?: number): Disposable {
        const key = handle === undefined ? type : `${type}::${handle}`;
        this.providers.set(key, provider);
        return {
            dispose: () => this.providers.delete(key)
        };
    }

    /**
     * Retrieves the {@link TaskProvider} registered for the given type task configuration type.
     * If there is already a `TaskProvider` registered for the specified type the registration will
     * be overwritten with the new value.
     * @param type the task configuration type.
     *
     * @returns a promise of the registered `TaskProvider`` or `undefined` if no provider is registered for the given type.
     */
    async getProvider(type: string): Promise<TaskProvider | undefined> {
        await WaitUntilEvent.fire(this.onWillProvideTaskProviderEmitter, {});
        return this.providers.get(type);
    }

    /**
     * Retrieve all registered {@link TaskProvider}s.
     *
     * @returns a promise of all registered {@link TaskProvider}s.
     */
    async getProviders(): Promise<TaskProvider[]> {
        await WaitUntilEvent.fire(this.onWillProvideTaskProviderEmitter, {});
        return [...this.providers.values()];
    }
}
