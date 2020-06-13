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

import * as assert from 'assert';
import * as Converter from './type-converters';
import * as theia from '@theia/plugin';
import * as types from './types-impl';
import * as model from '../common/plugin-api-rpc-model';
import { MarkdownString, isMarkdownString } from './markdown-string';
import { TaskDto } from '../common/plugin-api-rpc';

describe('Type converters:', () => {

    describe('convert ranges:', () => {
        // given
        const modelRange: model.Range = {
            startLineNumber: 5,
            startColumn: 5,
            endLineNumber: 10,
            endColumn: 20
        };

        const pluginRange: theia.Range = new types.Range(4, 4, 9, 19);

        it('should convert to theia range', () => {
            // when
            const result: types.Range = Converter.toRange(modelRange);

            // then
            assert.deepEqual(result, pluginRange);
        });

        it('should convert to model range', () => {
            // when
            const result: model.Range | undefined = Converter.fromRange(pluginRange);

            // then
            assert.notEqual(result, undefined);
            assert.deepEqual(result, modelRange);
        });
    });

    describe('markdown:', () => {

        describe('type guard:', () => {

            it('should recognize markdown string', () => {
                // given
                const markdownString = new MarkdownString('**test**');

                // when
                const result = isMarkdownString(markdownString);

                // then
                assert.deepEqual(result !== false, true);
            });

            it('should recognize markdown object', () => {
                // given
                const markdownObject = { value: '*test*' };

                // when
                const result = isMarkdownString(markdownObject);

                // then
                assert.deepEqual(result !== false, true);
            });

            it('should recognize markdown object with redundant fields', () => {
                // given
                const markdownObject = { field1: 5, value: '*test*', field2: 'test' };

                // when
                const result = isMarkdownString(markdownObject);

                // then
                assert.deepEqual(result !== false, true);
            });

            it('should reject non markdown object', () => {
                // given
                const nonMarkdownObject = { field1: 5, field2: 'test' };

                // when
                const result = isMarkdownString(nonMarkdownObject);

                // then
                assert.deepEqual(result === false, true);
            });

            it('should reject non markdown object if it contains isTrusted field', () => {
                // given
                const nonMarkdownObject = { isTrusted: true, field1: 5, field2: 'test' };

                // when
                const result = isMarkdownString(nonMarkdownObject);

                // then
                assert.deepEqual(result === false, true);
            });
        });

        describe('converter: ', () => {
            const aStringWithMarkdown: string = '**test**';
            const pluginMarkdown: theia.MarkdownString = new MarkdownString(aStringWithMarkdown);
            const aLanguage = 'typescript';
            const aValue = 'const x=5;';
            const codeblock = { language: aLanguage, value: aValue };
            const modelMarkdownWithCode = { value: '```' + aLanguage + '\n' + aValue + '\n```\n' };
            const modelMarkdown: model.MarkdownString = { value: aStringWithMarkdown };

            it('should convert plugin markdown to model markdown', () => {
                // when
                const result = Converter.fromMarkdown(pluginMarkdown);

                // then
                assert.deepEqual(result, modelMarkdown);
            });

            it('should convert string to model markdown', () => {
                // when
                const result = Converter.fromMarkdown(aStringWithMarkdown);

                // then
                assert.deepEqual(result, modelMarkdown);
            });

            it('should convert codeblock to model markdown', () => {
                // when
                const result = Converter.fromMarkdown(codeblock);

                // then
                assert.deepEqual(result, modelMarkdownWithCode);
            });

            it('should convert array of markups to model markdown', () => {
                // given
                const markups: (theia.MarkdownString | theia.MarkedString)[] = [
                    pluginMarkdown,
                    aStringWithMarkdown,
                    codeblock
                ];

                // when
                const result = Converter.fromManyMarkdown(markups);

                // then
                assert.deepEqual(Array.isArray(result), true);
                assert.deepEqual(result.length, 3);
                assert.deepEqual(result[0], modelMarkdown);
                assert.deepEqual(result[1], modelMarkdown);
                assert.deepEqual(result[2], modelMarkdownWithCode);
            });
        });

    });

    describe('convert tasks:', () => {
        const customType = 'custom';
        const shellType = 'shell';
        const label = 'yarn build';
        const source = 'source';
        const command = 'yarn';
        const commandLine = 'yarn run build';
        const args = ['run', 'build'];
        const cwd = '/projects/theia';
        const additionalProperty = 'some property';
        const id = 'id';

        const shellTaskDto: TaskDto = {
            id,
            definition: {
                id,
                type: shellType,
                additionalProperty
            },
            type: shellType,
            label,
            source,
            scope: 1,
            command,
            args,
            options: { cwd },
            additionalProperty
        };

        const shellTaskDtoWithCommandLine: TaskDto = {
            id,
            definition: {
                type: shellType,
                id,
                additionalProperty
            },
            type: shellType,
            label,
            source,
            scope: 2,
            command: commandLine,
            options: { cwd },
            additionalProperty
        };

        const shellPluginTask: theia.Task = {
            name: label,
            source,
            scope: 1,
            definition: {
                type: shellType,
                id,
                additionalProperty
            },
            execution: {
                command,
                args,
                options: {
                    cwd
                }
            }
        };

        const pluginTaskWithCommandLine: theia.Task = {
            name: label,
            source,
            scope: 2,
            definition: {
                id,
                type: shellType,
                additionalProperty
            },
            execution: {
                commandLine,
                options: {
                    cwd
                }
            }
        };

        const customTaskDto: TaskDto = {
            ...shellTaskDto,
            type: customType,
            definition: {
                type: customType,
                id,
                additionalProperty
            }
        };

        const customTaskDtoWithCommandLine: TaskDto = {
            ...shellTaskDtoWithCommandLine,
            type: customType,
            definition: {
                type: customType,
                id,
                additionalProperty
            }
        };

        const customPluginTask: theia.Task = {
            ...shellPluginTask, definition: {
                id,
                type: customType,
                additionalProperty
            }
        };

        const customPluginTaskWithCommandLine: theia.Task = {
            name: label,
            source,
            scope: 2,
            definition: {
                id,
                type: customType,
                additionalProperty
            },
            execution: {
                commandLine,
                options: {
                    cwd
                }
            }
        };

        it('should convert to task dto', () => {
            // when
            const result: TaskDto | undefined = Converter.fromTask(shellPluginTask);

            // then
            assert.notEqual(result, undefined);
            assert.deepEqual(result, shellTaskDto);
        });

        it('should convert from task dto', () => {
            // when
            const result: theia.Task = Converter.toTask(shellTaskDto);

            assert.strictEqual(result.execution instanceof types.ShellExecution, true);

            if (result.execution instanceof types.ShellExecution) {
                assert.strictEqual(result.execution.commandLine, undefined);

                result.execution = {
                    args: result.execution.args,
                    options: result.execution.options,
                    command: result.execution.command
                };
            }

            // then
            assert.notEqual(result, undefined);
            assert.deepEqual(result, shellPluginTask);
        });

        it('should convert to task dto from task with commandline', () => {
            // when
            const result: TaskDto | undefined = Converter.fromTask(pluginTaskWithCommandLine);

            // then
            assert.notEqual(result, undefined);
            assert.deepEqual(result, shellTaskDtoWithCommandLine);
        });

        it('should convert task with custom type to dto', () => {
            // when
            const result: TaskDto | undefined = Converter.fromTask(customPluginTask);

            // then
            assert.notEqual(result, undefined);
            assert.deepEqual(result, customTaskDto);
        });

        it('should convert task with custom type from dto', () => {
            // when
            const result: theia.Task = Converter.toTask(customTaskDto);

            assert.strictEqual(result.execution instanceof types.ShellExecution, true);

            if (result.execution instanceof types.ShellExecution) {
                assert.strictEqual(result.execution.commandLine, undefined);

                result.execution = {
                    args: result.execution.args,
                    options: result.execution.options,
                    command: result.execution.command
                };
            }

            // then
            assert.deepEqual(result, customPluginTask);
        });

        it('should convert to task dto from custom task with commandline', () => {
            // when
            const result: TaskDto | undefined = Converter.fromTask(customPluginTaskWithCommandLine);

            // then
            assert.notEqual(result, undefined);
            assert.deepEqual(result, customTaskDtoWithCommandLine);
        });
    });

    describe('Webview Panel Show Options:', () => {
        it('should create options from view column ', () => {
            const viewColumn = types.ViewColumn.Five;

            const showOptions: theia.WebviewPanelShowOptions = {
                area: types.WebviewPanelTargetArea.Main,
                viewColumn: types.ViewColumn.Four,
                preserveFocus: false
            };

            // when
            const result: theia.WebviewPanelShowOptions = Converter.toWebviewPanelShowOptions(viewColumn);

            // then
            assert.notEqual(result, undefined);
            assert.deepEqual(result, showOptions);
        });

        it('should create options from given "WebviewPanelShowOptions" object ', () => {
            const incomingObject: theia.WebviewPanelShowOptions = {
                area: types.WebviewPanelTargetArea.Main,
                viewColumn: types.ViewColumn.Five,
                preserveFocus: true
            };

            const showOptions: theia.WebviewPanelShowOptions = {
                area: types.WebviewPanelTargetArea.Main,
                viewColumn: types.ViewColumn.Four,
                preserveFocus: true
            };

            // when
            const result: theia.WebviewPanelShowOptions = Converter.toWebviewPanelShowOptions(incomingObject);

            // then
            assert.notEqual(result, undefined);
            assert.deepEqual(result, showOptions);
        });

        it('should set default "main" area', () => {
            const incomingObject: theia.WebviewPanelShowOptions = {
                viewColumn: types.ViewColumn.Five,
                preserveFocus: false
            };

            const showOptions: theia.WebviewPanelShowOptions = {
                area: types.WebviewPanelTargetArea.Main,
                viewColumn: types.ViewColumn.Four,
                preserveFocus: false
            };

            // when
            const result: theia.WebviewPanelShowOptions = Converter.toWebviewPanelShowOptions(incomingObject);

            // then
            assert.notEqual(result, undefined);
            assert.deepEqual(result, showOptions);
        });
    });
});
