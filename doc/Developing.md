This file contains tips to help you take (and understand) your first steps in
the world of Theia development. Are you in a hurry? See the
[Quick Start](#quick-start).

# How to build Theia and the example applications
Theia is a framework to build IDEs, so you can't really "run" Theia itself.
However, you can run the example applications included in its repository. One
is a browser-based IDE and the other is the Electron-based equivalent.

The following instructions are for Linux and macOS.

For Windows instructions [click here](#building-on-windows).

 - [**Prerequisites**](#prerequisites)
 - [**Quick Start**](#quick-start)
    - [Run with SSL](#run-the-browser-example-with-ssl)
    - [Run with Gitpod](#run-the-browser-example-with-gitpod)
 - [**Clone the repository**](#clone-the-repository)
 - [**The repository structure**](#the-repository-structure)
 - [**Build core, extensions and examples packages**](#build-core-extensions-and-examples-packages)
 - [**Build extension packages individually**](#build-extension-packages-individually)
 - [**Run the browser-based example application**](#run-the-browser-based-example-application)
 - [**Run the Electron-based example application**](#run-the-electron-based-example-application)
 - [**Rebuilding**](#rebuilding)
 - [**Watching**](#watching)
     - [Watch the core and extension packages](#watch-the-core-and-extension-packages)
     - [Watch the examples](#watch-the-examples)
     - [Watch a specific package](#watch-a-specific-package)
     - [Watch a specific package and its local upstream dependencies](#watch-a-specific-package-and-its-local-upstream-dependencies)
 - [**Debugging**](#debugging)
     - [Debug the browser example's backend](#debug-the-browser-examples-backend)
     - [Debug the browser example's frontend](#debug-the-browser-examples-frontend)
     - [Debug the browser example's frontend and backend at the same time](#debug-the-browser-examples-frontend-and-backend-at-the-same-time)
     - [Debug the Electron example's backend](#debug-the-electron-examples-backend)
     - [Debug the Electron example's frontend](#debug-the-electron-examples-frontend)
     - [Debug the Electron example's frontend and backend at the same time](#debug-the-electron-examples-frontend-and-backend-at-the-same-time)
     - [Debug IPC servers](#debug-ipc-servers)
     - [Debug the plugin host](#debug-the-plugin-host)
 - [**Profiling**](#profiling)
     - [Profile the frontend process](#profile-the-frontend-process)
     - [Profile the backend process](#profile-the-backend-process)
     - [Profile IPC servers](#profile-ipc-servers)
     - [Profile the plugin host](#profile-the-plugin-host)
 - [**Testing**](#testing)
 - [**Code coverage**](#code-coverage)
 - [**Building on Windows**](#building-on-windows)
 - [**Troubleshooting**](#troubleshooting)
     - [Linux](#linux)
     - [Windows](#windows)
     - [macOS](#macos)
     - [node-keytar](#keytar)
     - [Root privileges errors](#root-privileges-errors)

## Prerequisites

 - Node.js `>= 12.14.1` **AND** `< 13`.
   - Preferably, **use** Node version [`12.14.1`](https://nodejs.org/download/release/v12.14.1/), as it is the recommended minimum version according to the framework's supported `electron` version.
 - [Yarn package manager](https://yarnpkg.com/en/docs/install)  `>= 1.7.0` **AND** `< 2.x.x`.
 - git (If you would like to use the Git-extension too, you will need to have git version 2.11.0 or higher.)

Some additional tools and libraries are needed depending on your platform:

- Linux
  - [make](https://www.gnu.org/software/make/)
  - [gcc](https://gcc.gnu.org/) (or another compiling toolchain)
  - [pkg-config](https://www.freedesktop.org/wiki/Software/pkg-config/)
  - build-essential: `sudo apt-get install build-essential`
  - Dependencies for node native extensions:
    - `native-keymap`:
      - Debian-based: `sudo apt-get install libx11-dev libxkbfile-dev`
      - Red Hat-based: `sudo yum install libX11-devel.x86_64 libxkbfile-devel.x86_64 # or .i686`
      - FreeBSD: `sudo pkg install libX11`
    - `node-keytar`:
      - Debian-based: `sudo apt-get install libsecret-1-dev`

- Linux/MacOS
  - [nvm](https://github.com/nvm-sh/nvm) is recommended to easily switch between Node.js versions.

- Windows
  - We recommend using [`scoop`](https://scoop.sh/). The detailed steps are [here](#building-on-windows).

- Alternative Linux Distributions (e.g. RHEL7)
  - [node-keytar](https://github.com/atom/node-keytar) uses [`prebuild-install`](https://github.com/prebuild/prebuild-install) to download prebuilt binaries.
    This can cause some issues on RHEL for instance where some shared libraries are missing from the system it was original built upon.
    To fix that issue, you can tell `prebuild-install` to build the native extension locally by setting the following environment variable before doing `yarn`:

    ```sh
    # either:
    export npm_config_build_from_source=true
    yarn

    # or:
    npm_config_build_from_source=true yarn
    ```
## Quick Start

To build and run the browser example:

    git clone https://github.com/eclipse-theia/theia \
    && cd theia \
    && yarn \
    && cd examples/browser \
    && yarn run start

Start your browser on http://localhost:3000.

To build and run the Electron example:

    git clone https://github.com/eclipse-theia/theia \
    && cd theia \
    && yarn \
    && yarn run rebuild:electron \
    && cd examples/electron \
    && yarn run start

### Run the browser example with SSL

To run the browser example using SSL use:

    git clone https://github.com/eclipse-theia/theia \
    && cd theia \
    && yarn \
    && cd examples/browser \
    && yarn run start --ssl --cert /path/to/cert.crt --certkey /path/to/certkey.key

Start your browser on https://localhost:3000.

### Run the browser example with Gitpod

[Gitpod](https://www.gitpod.io/) is a Theia-based IDE for GitHub.
You can start by prefixing any GitHub URL in the Theia repository with `gitpod.io/#`:
- Open https://gitpod.io/#https://github.com/eclipse-theia/theia to start development with the master branch.
- Gitpod will start a properly configured for Theia development workspace, clone and build the Theia repository.
- After the build is finished, run from the terminal in Gitpod:

        cd examples/browser \
        && yarn run start ../.. --hostname 0.0.0.0

## Clone the repository

    git clone https://github.com/eclipse-theia/theia

The directory containing the Theia repository will now be referred to as
`$THEIA`, so if you want to copy-paste the examples, you can set the `THEIA`
variable in your shell:

    THEIA=$PWD/theia

## The repository structure

Theia repository has multiple folders:

 - `packages` folder contains runtime packages, as the core package and extensions to it
 - `dev-packages` folder contains devtime packages
    - [@theia/cli](../dev-packages/cli/README.md) is a command line tool to manage Theia applications
    - [@theia/ext-scripts](../dev-packages/ext-scripts/README.md) is a command line tool to share scripts between Theia runtime packages
 - `examples` folder contains example applications, both Electron-based and browser-based
 - `doc` folder provides documentation about how Theia works
 - `scripts` folder contains JavaScript scripts used by npm scripts when
installing
- the root folder lists dev dependencies and wires everything together with [Lerna](https://lerna.js.org/)

## Build core, extensions and examples packages

You can download dependencies and build it using:

    cd $THEIA
    yarn

This command downloads dev dependencies, links and builds all packages.
To learn more and understand precisely what's going on, please look at scripts in [package.json](../package.json).

### Skip lint

Linter can be skipped by setting the `SKIP_LINT` environment variable to `true`.

example:
```
cd $THEIA
SKIP_LINT=true yarn
```

## Build extension packages individually

From the root:

 `npx run build @theia/package-name`

From the package:

`yarn --ignore-scripts && yarn build`

## Run the browser-based example application

We can start the application from the [examples/browser](../examples/browser) directory with:

    yarn run start

This command starts the backend application listening on port `3000`. The frontend application should be available on http://localhost:3000.

If you rebuild native Node.js packages for Electron then rollback these changes
before starting the browser example by running from the root directory:

    yarn run rebuild:browser

## Run the Electron-based example application

From the root directory run:

    yarn run rebuild:electron

This command rebuilds native Node.js packages against the version of Node.js
used by Electron.

It can also be started from the [examples/electron](../examples/electron) directory with:

    yarn run start

## Rebuilding

In the root directory run:

    yarn run build

## Watching

### Watch the core and extension packages

To rebuild each time a change is detected run:

    yarn run watch

### Watch the examples

To rebuild each time a change is detected in frontend or backend you can run:

    yarn run watch

### Watch a specific package

You can use `npx` to watch a single package:

    npx run watch @theia/the-package-name

### Watch a specific package and its local upstream dependencies

Let assume you have to work for instance in the `@theia/navigator` extension. But you might have to apply changes in any of its upstream dependencies such as `@theia/filesystem` or `@theia/core`, you can either do `yarn watch` which could be super expensive, as it watches all the packages. Or you can do `npx run watch @theia/navigator` and `npx run watch @theia/filesystem` and `npx run watch @theia/core` in three individual shells. Or you can do the following single-liner:

    npx run watch @theia/navigator --include-filtered-dependencies --parallel

## Debugging

### Debug the browser example's backend

 - Open the debug view and run the `Launch Browser Backend` configuration.

### Debug the browser example's frontend

 - Start the backend by using `yarn run start`.
 - In a browser: Open http://localhost:3000/ and use the dev tools for debugging.
 - Open the debug view and run the `Launch Browser Frontend` configuration.

### Debug the browser example's frontend and backend at the same time

 - Open the debug view and run the `Launch Browser Backend` configuration.
 - Then run the `Launch Browser Frontend` configuration.

### Debug the Electron example's backend

 - Open the debug view and run the `Launch Electron Backend` configuration.

### Debug the Electron example's frontend

 - Start the Electron backend
   - Either open the debug view and run the `Launch Electron Backend` configuration
   - Or use `yarn run start`.
 - Attach to the Electron Frontend
   - Either open the debug view and run the `Attach to Electron Frontend` configuration
   - Or in Electron: Help -> Toggle Electron Developer Tools.

### Debug the Electron example's frontend and backend at the same time

 - Open the debug view and run the `Launch Electron Backend & Frontend` configuration.

### Debug IPC servers

  - Pass `--${server-name}-inspect` arg to the backend server.
    - For example `--nfsw-watcher-inspect=0` to inspect nfsw watcher processes with dynamic port allocation.
    - All variations of `--inspect` flag are supported: https://nodejs.org/en/docs/inspector/#command-line-options.
  - Attach the debugger to the logged port.

In order to look up `server-name` run the backend server with `--log-level=debug` flag to enable logging of IPC servers instantiation.
You should be able to see message of `[${server-name}: ${server-PID}]: IPC started` format, like `[nsfw-watcher: 37557] IPC started`.

### Debug the plugin host

  - Pass `--hosted-plugin-inspect=9339` arg to the backend server from the command line.
    - Instead you can run `Launch Browser Backend` launch configuration which is already pre-configured.
  - Open the debug view and run the `Attach to Plugin Host` launch configuration.
    - It connects to the plugin host if at least one extension is detected, otherwise it timeouts after 60s.
    - If you want to debug the activation then enable `stopOnEntry` flag.
  - Open the browser page.

 ---
### Debugging Plugin Sources

[click for base article](https://github.com/eclipse-theia/theia/issues/3251#issuecomment-468166533)

The following launch configuration is meant to be used when the Theia project is opened as the main project in vscode, the following launch configuration is added inside .vscode/launch.json.
- The source repository of your plugin is expected under your `${workspaceFolder}/plugins` folder
- You can start the frontend from URL: http://localhost:3030
- It's suggested to update your frontend launch configuration URL to open your favorite target project in a second launch

Launch configuration template that will start the backend process, and then attempt to connect on port 9339 to debug the plugin-host sub-process:

```jsonc
{
    "name": "Launch VS Code extension as Theia plugin",
    "type": "node",
    "request": "launch",
    "port": 9339,
    "timeout": 100000,
    "args": [
        "${workspaceFolder}/examples/browser/src-gen/backend/main.js",
        "${workspaceFolder}",
        "--port=3030",
        "--hosted-plugin-inspect=9339", // spawn the plugin-host in debug mode
        "--plugins=local-dir:${workspaceFolder}/plugins"
    ],
    "stopOnEntry": false,
    "sourceMaps": true,
    "outFiles": [
        "${workspaceFolder}/**/*.js"
    ],
    "internalConsoleOptions": "openOnSessionStart",
    "outputCapture": "std"
}
```

#### Producing typescript maps for your plugin

Enable source maps in the plugin's `tsconfig.json`

```jsonc
{
    "compilerOptions": {
        "sourceMap": true
    }
}
```

If Webpack is used you should bundle in development mode in the `package.json` scripts to avoid minification:

```sh
webpack --mode development
```

As well as enabling source map output in the **webpack.config.js**

```js
module.exports = {
    devtool: 'source-map'
}
```

#### Compiling and blocking typescript from walking up parent directories [(see discussion)](https://github.com/Microsoft/TypeScript/issues/13992#issuecomment-386253983)

If you get errors while building like:

```
(parent folders)/index.d.ts: error TS2300: Duplicate identifier
```

You can fix it by modifying your `tsconfig.json`:

```jsonc
{
    "compilerOptions": {
       "typeRoots": ["./node_modules/@types"]
    }
}
```

## Profiling

 - Use Chrome devtools to profile both the frontend and backend (Node.js).
   - For Node.js: open chrome://inspect, click the configure button and ensure target host and port are listed.
 - Learn how to get and understand CPU measurements: https://developers.google.com/web/tools/chrome-devtools/evaluate-performance/
 - Learn how to get and understand Memory measurements: https://developers.google.com/web/tools/chrome-devtools/memory-problems/
 - Before taking the memory snapshot always collect garbage.
 - Make sure that Chrome extensions don't distort measurements by disabling them.
   - For frontend: React extension is leaking components.
 - Make measurements before and after improvements to provide them as evidence on a pull request.
   - Also document how to reproduce improved measurements in `How to test` section of a pull request description.
 - If objects don't have a proper class, i.e. plain JSON, then find one of them in the first snapshot
 and check that it is garbage collected in the diff between snapshots.

### Profile the frontend process

  - In Browser: open the devtools.
  - In Electron: Help -> Toggle Electron Developer Tools.

### Profile the backend process

  - Pass `--inspect` arg to the backend server: https://nodejs.org/en/docs/inspector/#command-line-options.

### Profile IPC servers

  - Pass `--${server-name}-inspect` arg to the backend server.
    - For example `--nfsw-watcher-inspect=0` to inspect nfsw watcher processes with dynamic port allocation.
    - All variations of `--inspect` flag are supported: https://nodejs.org/en/docs/inspector/#command-line-options.

### Profile the plugin host

 - Pass `--hosted-plugin-inspect` arg to the backend server.
   - All variations of `--inspect` flag are supported: https://nodejs.org/en/docs/inspector/#command-line-options.

## Testing

- See the [unit testing](Testing.md) documentation.
- See the [API integration testing](api-testing.md) documentation.

## Code coverage

    yarn run test

By default, this will generate the code coverage for the tests in an HTML
format, which can be easily viewed with your browser (Chrome/Firefox/Edge/Safari
etc.) by opening `packages/<package name>/coverage/index.html`.

## Building on Windows

 - Install [`scoop`](https://github.com/lukesampson/scoop#installation).
 - Install [`nvm`](https://github.com/coreybutler/nvm-windows) with scoop: `scoop install nvm`.
 - Install Node.js with `nvm`: `nvm install 12.14.1`, then use it: `nvm use 12.14.1`. You can list all available Node.js versions with `nvm list available` if you want to pick another version.
 - Install `yarn`: `scoop install yarn`.
 - Install [`windows-build-tools`](https://github.com/felixrieseberg/windows-build-tools). Run `PowerShell` as _Administrator_ and copy paste the following: `npm --add-python-to-path install --global --production windows-build-tools`

Clone, build and run Theia.
Using Git Bash as administrator:

    git clone https://github.com/eclipse-theia/theia.git && cd theia && yarn && yarn --cwd examples\browser start

If you do not have Git Bash installed on your system, [get one](https://gitforwindows.org/), or use `scoop`: `scoop install git`.

## Troubleshooting

> First make sure that you follow the steps given in the [docs](https://github.com/eclipse-theia/theia/blob/master/doc/Developing.md#run-the-browser-based-example-applicatio) correctly.

### Linux

The start command will start a watcher on many files in the theia directory.
To avoid ENOSPC errors, increase your default inotify watches.

It can be done like so:

    echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p

### Windows

If you see `LINK : fatal error LNK1104: cannot open file 'C:\\Users\\path\\to\\node.lib' [C:\path\to\theia\node_modules\drivelist\build\drivelist.vcxproj]`, then set the Visual Studio version manually with `npm config set msvs_version 2017 --global`. Note, if you have `2015` installed, use `2015` instead of `2017.`

If you are facing with `EPERM: operation not permitted` or `permission denied`
errors while building, testing or running the application then;

 - You don't have write access to the installation directory.
 - Try to run your command line (`PowerShell`, `GitBash`, `Cygwin` or whatever
 you are using) as an administrator.
 - The permissions in the NPM cache might get corrupted. Please try to run
 `npm cache clean` to fix them.
 - If you experience issues such as `Error: EBUSY: resource busy or locked, rename`,
 try to disable (or uninstall) your anti-malware software.
 See [here](https://github.com/npm/npm/issues/13461#issuecomment-282556281).
 - Still having issues on Windows? File a [bug]. We are working on Linux or OS X
 operating systems. Hence we are more than happy to receive any Windows-related
 feedbacks, [bug](https://github.com/eclipse-theia/theia/issues) reports.

If you're still struggling with the build but you use Windows 10, the you can enable the `Windows Subsystem for Linux` and you can get a Linux distro for free.

### macOS

You need to have the Xcode command line tools installed in order to build and run Theia. You can install the tools by running

    xcode-select --install

If you already have Xcode installed, but you see the `xcode-select: error: tool 'xcodebuild' requires Xcode, but active developer directory '/Library/Developer/CommandLineTools' is a command line tools instance` error, you need to run the following command to fix it: `sudo xcode-select --switch /Library/Developer/CommandLineTools`.

The solution is the same if you have updated to `10.14` (Mojave) and you can see the `gyp: No Xcode or CLT version detected!` error. More details [here](https://github.com/nodejs/node-gyp#on-macos).

### Keytar

See prerequisites for [`node-keytar`](#prerequisites)

On some distributions (e.g. RHEL7, CentOS7) the prebuilt binaries for `node-keytar` might crash at runtime because of some missing shared libraries (e.g. some glibc version).

To address that issue you can force `node-keytar` to build on install rather than pulling incompatible prebuilt binaries by setting the following environment variable:

```sh
export npm_config_build_from_source=true
```

And then running `yarn` to install dependencies and have them build themselves locally.

### Root privileges errors
When trying to install with root privileges, you might encounter errors such as
`cannot run in wd`.

Several options are available to you:

 - Install without root privileges
 - Use the `--unsafe-perm` flag: `yarn --unsafe-perm`
