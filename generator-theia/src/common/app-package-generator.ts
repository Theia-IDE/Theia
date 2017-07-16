/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import Base = require('yeoman-generator');
import { AbstractGenerator, sortByKey } from '../common';
import { NodePackage } from "./generator-model";

export class AppPackageGenerator extends AbstractGenerator {

    generate(fs: Base.MemFsEditor): void {
        fs.writeJSON('package.json', this.compilePackage());
        if (!fs.exists('webpack.config.js')) {
            fs.write('webpack.config.js', this.compileWebpackConfig());
            if (this.isWeb()) {
                fs.write('webpack_empty.js', '');
            }
        }
    }

    protected compilePackage(): NodePackage {
        const dependendencies = this.isWeb() ? {} : {
            "electron": "1.6.11",
        }
        const scripts = this.isWeb() ? {
            "start": "concurrently -n backend,frontend -c blue,green \"npm run start:backend\" \"npm run start:frontend\"",
            "start:backend": "npm run build:backend && node ./src-gen/backend/main.js | bunyan",
            "start:backend:debug": "npm run build:backend && node ./src-gen/backend/main.js --loglevel=debug | bunyan",
            "start:frontend": "webpack-dev-server --open",
        } : {
                "postinstall": "electron-rebuild",
                "start": "electron ./src-gen/frontend/electron-main.js | bunyan",
                "start:debug": "electron ./src-gen/frontend/electron-main.js --loglevel=debug | bunyan",
            }
        const devDependencies = this.isWeb() ? {
            "webpack-dev-server": "^2.5.0"
        } : {
                "electron-rebuild": "^1.5.11",
            }
        return {
            ...this.model.pck,
            "dependencies": sortByKey({
                ...dependendencies,
                ...this.model.pck.dependencies
            }),
            "scripts": {
                "clean": "rimraf lib",
                "cold:start": "npm run clean && npm start",
                "build": "npm run build:frontend && npm run build:backend",
                "build:frontend": "webpack",
                "build:backend": `cp ${this.srcGen()}/frontend/index.html lib`,
                "watch": "npm run build:frontend && webpack --watch",
                ...scripts,
                ...this.model.pck.scripts
            },
            "devDependencies": sortByKey({
                "rimraf": "^2.6.1",
                "concurrently": "^3.5.0",
                "bunyan": "^1.8.10",
                "webpack": "^2.2.1",
                "webpack-merge": "^4.1.0",
                "copy-webpack-plugin": "^4.0.1",
                "circular-dependency-plugin": "^2.0.0",
                "css-loader": "^0.28.1",
                "file-loader": "^0.11.1",
                "source-map-loader": "^0.2.1",
                "url-loader": "^0.5.8",
                "font-awesome-webpack": "0.0.5-beta.2",
                "less": "^2.7.2",
                ...devDependencies,
                ...this.model.pck.devDependencies
            })
        }
    }

    protected isWeb(): boolean {
        return this.model.target === 'web';
    }

    protected isElectron(): boolean {
        return this.model.target === 'electron';
    }

    protected ifWeb(value: string, defaultValue: string = '') {
        return this.isWeb() ? value : defaultValue;
    }

    protected ifElectron(value: string, defaultValue: string = '') {
        return this.isElectron() ? value : defaultValue;
    }

    protected compileWebpackConfig(): string {
        return `${this.compileCopyright()}
// @ts-check
const path = require('path');
const webpack = require('webpack');
const merge = require('webpack-merge');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const CircularDependencyPlugin = require('circular-dependency-plugin');

const outputPath = path.resolve(__dirname, 'lib');${this.ifWeb(`
const emptyPath = path.resolve(__dirname, 'webpack_empty.js');`)}

const monacoEditorPath = '../../node_modules/monaco-editor-core/min/vs';
const monacoLanguagesPath = '../../node_modules/monaco-languages/release';
const monacoCssLanguagePath = '../../node_modules/monaco-css/release/min';
const monacoTsLanguagePath = '../../node_modules/monaco-typescript/release';
const monacoJsonLanguagePath = '../../node_modules/monaco-json/release/min';
const monacoHtmlLanguagePath = '../../node_modules/monaco-html/release/min';${this.ifWeb(`
const requirePath = '../../node_modules/requirejs/require.js';

const host = '${this.model.config.host}';
const port = ${this.model.config.port};`)}

module.exports = {
    entry: path.resolve(__dirname, 'src-gen/frontend/index.js'),
    output: {
        filename: 'bundle.js',
        path: outputPath${this.ifElectron(`,
        libraryTarget: 'umd'
        `)}
    },
    target: '${this.model.target}',
    node: {${this.ifElectron(`
        __dirname: false,
        __filename: false`, `
        fs: 'empty',
        child_process: 'empty',
        net: 'empty',
        crypto: 'empty'`)}
    },
    module: {
        rules: [
            {
                test: /\\.css$/,
                loader: 'style-loader!css-loader'
            },
            {
                test: /\\.(ttf|eot|svg)(\\?v=\\d+\\.\\d+\\.\\d+)?$/,
                loader: 'url-loader?limit=10000&mimetype=image/svg+xml'
            },
            {
                test: /\\.js$/,
                enforce: 'pre',
                loader: 'source-map-loader'
            },
            {
                test: /\\.woff(2)?(\\?v=[0-9]\\.[0-9]\\.[0-9])?$/,
                loader: "url-loader?limit=10000&mimetype=application/font-woff"
            }
        ],
        noParse: /vscode-languageserver-types|vscode-uri/
    },
    resolve: {
        extensions: ['.js'],
        alias: {
            'vs': path.resolve(outputPath, monacoEditorPath)${this.ifWeb(`,
            'dtrace-provider': emptyPath,
            'safe-json-stringify': emptyPath,
            'mv': emptyPath,
            'source-map-support': emptyPath`)}
        }
    },
    devtool: 'source-map',
    plugins: [
        // @ts-ignore
        new webpack.HotModuleReplacementPlugin(),
        CopyWebpackPlugin([${this.ifWeb(`
            {
                from: requirePath,
                to: '.'
            },`)}
            {
                from: monacoEditorPath,
                to: 'vs'
            },
            {
                from: monacoLanguagesPath,
                to: 'vs/basic-languages'
            },
            {
                from: monacoCssLanguagePath,
                to: 'vs/language/css'
            },
            {
                from: monacoTsLanguagePath,
                to: 'vs/language/typescript'
            },
            {
                from: monacoJsonLanguagePath,
                to: 'vs/language/json'
            },
            {
                from: monacoHtmlLanguagePath,
                to: 'vs/language/html'
            }
        ]),
        new CircularDependencyPlugin({
            exclude: /(node_modules|examples)\\/./,
            failOnError: false // https://github.com/nodejs/readable-stream/issues/280#issuecomment-297076462
        })
    ],
    stats: {
        warnings: true
    }${this.ifWeb(`,
    devServer: {
        inline: true,
        hot: true,
        proxy: {
            '/services/*': {
                target: 'ws://' + host + ':' + port,
                ws: true
            },
            '*': 'http://' + host + ':' + port,
        },
        historyApiFallback: true,
        hot: true,
        inline: true,
        stats: {
            colors: true,
            warnings: false
        },
        host: process.env.HOST || host,
        port: process.env.PORT
    }`)}
};`
    }

}