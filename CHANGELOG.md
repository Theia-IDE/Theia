# Change Log

## v1.16.0 - 7/29/2021

[1.16.0 Milestone](https://github.com/eclipse-theia/theia/milestone/22)

 - [workspace] added support for multiple selections in 'Add folder to workspace' dialog. [#9684](https://github.com/eclipse-theia/theia/pull/9684)
 - [debug] added support for managing debug sessions for extensions from debug panel (previously only possible using `Hosted Plugin` commands) [#8706](https://github.com/eclipse-theia/theia/pull/8706)

<a name="breaking_changes_1.16.0">[Breaking Changes:](#breaking_changes_1.16.0)</a>

- [core] moved from ES5 to ES2017 [#9436](https://github.com/eclipse-theia/theia/pull/9436) - Contributed on behalf of STMicroelectronics
- [monaco] upgraded to monaco 0.23.0 including replacement of `quickOpen` API (0.20.x) with `quickInput` API (0.23.x) [#9154](https://github.com/eclipse-theia/theia/pull/9154)
- [call-hierarchy] `CurrentEditorAccess` is deprecated. Use the version implemented in the `editor` package instead. The services in `call-hierarchy` that previously used the local `CurrentEditorAccess` no longer do. [#9681](https://github.com/eclipse-theia/theia/pull/9681)
- [workspace] `WorkspaceCommandContribution.addFolderToWorkspace` no longer accepts `undefined`. `WorkspaceService.addRoot` now accepts a URI or a URI[]. [#9684](https://github.com/eclipse-theia/theia/pull/9684)

## v1.15.0 - 6/30/2021

[1.15.0 Milestone](https://github.com/eclipse-theia/theia/milestone/21)

- [application-package] refined the configuration typings allowing for partial `ApplicationConfig` updates [#9568](https://github.com/eclipse-theia/theia/pull/9568)
- [core] added API to filter contributions at runtime [#9317](https://github.com/eclipse-theia/theia/pull/9317) - Contributed on behalf of STMicroelectronics
- [core] added `BackendApplicationServer` which controls how to serve frontend files [#9461](https://github.com/eclipse-theia/theia/pull/9461)
- [core] added `dompurify` as a shared dependency [#9571](https://github.com/eclipse-theia/theia/pull/9571)
- [core] added handling to gracefully kill process trees on exit [#8947](https://github.com/eclipse-theia/theia/pull/8947)
- [core] added handling to make IPC debug tracing configurable [#9602](https://github.com/eclipse-theia/theia/pull/9602)
- [core] added handling to normalize environment variables before merging [#9631](https://github.com/eclipse-theia/theia/pull/9631)
- [core] added support for `expandOnlyOnExpansionToggleClick` in `TreeProps` [#9583](https://github.com/eclipse-theia/theia/pull/9583)
- [core] added support for `resourceDirName` and `resourcePath` context keys [#9499](https://github.com/eclipse-theia/theia/pull/9499)
- [core] added support for a unique id for non-command toolbar items [#9586](https://github.com/eclipse-theia/theia/pull/9586)
- [core] fixed incorrectly wrapped disposable [#9376](https://github.com/eclipse-theia/theia/pull/9376)
- [debug] fixed handling when `supportSetVariable` is disabled [#9616](https://github.com/eclipse-theia/theia/pull/9616)
- [editor-preview] refactored `editor-preview` resolving outstanding bugs [#9518](https://github.com/eclipse-theia/theia/pull/9518)
  - rewrote `editor-preview`-package classes as extensions of `editor`-package classes
- [editor] updated logic to open last seen editor and not last created [#9542](https://github.com/eclipse-theia/theia/pull/9542)
- [file-search] added handling to preserve editor state when re-opening a closed editor [#9557](https://github.com/eclipse-theia/theia/pull/9557)
- [file-search] fixed issue with potential infinite recursion [#9635](https://github.com/eclipse-theia/theia/pull/9635)
- [file-search] updated default goto line and column `range` to `undefined` [#9529](https://github.com/eclipse-theia/theia/pull/9629)
- [filesystem] added logic to use a supplied filter by default [#9659](https://github.com/eclipse-theia/theia/pull/9659)
- [mini-browser] added handling to warn if deployed in an insecure context [#9563](https://github.com/eclipse-theia/theia/pull/9563)
- [monaco] fixed resizing of editor inputs [#9527](https://github.com/eclipse-theia/theia/pull/9527)
- [monaco] updated fetching of `onigasm wasm` to use `fetch` instead of old `AJAX` [#9620](https://github.com/eclipse-theia/theia/pull/9620)
- [outline] aligned expansion behavior of the `outline-view` with vscode [#9583](https://github.com/eclipse-theia/theia/pull/9583)
- [plugin] added `toJSON` implementation for `Range` and `Position` [#9652](https://github.com/eclipse-theia/theia/pull/9652)
- [plugin] added support for `secrets` plugin API [#9463](https://github.com/eclipse-theia/theia/pull/9463)
- [plugin] added support for prefix arguments when executing `workbench.action.quickOpen` [#9566](https://github.com/eclipse-theia/theia/pull/9566)
- [plugin] fixed `ELECTRON_RUN_AS_NODE` environment variable [#9283](https://github.com/eclipse-theia/theia/pull/9283)
- [plugin] fixed issue where tree-views would re-open after reload despite being explicitly closed [#9539](https://github.com/eclipse-theia/theia/pull/9539)
- [plugin] fixed tree-view selection [#9673](https://github.com/eclipse-theia/theia/pull/9673)
- [plugin] updated logic to transform `iconPath` to `url` [#9608](https://github.com/eclipse-theia/theia/pull/9608)
- [preferences] added handling to ensure that `WorkspacePreferenceProvider` waits for the `WorkspaceService` to be ready [#9531](https://github.com/eclipse-theia/theia/pull/9531)
- [preferences] fixed tab tracking when scrolling the preferences tree [#9549](https://github.com/eclipse-theia/theia/pull/9549)
- [preferences] refactored the `preferences-view` with major improvements to useability and performance [#9439](https://github.com/eclipse-theia/theia/pull/9439)
- [property-view] added unit-tests [#9630](https://github.com/eclipse-theia/theia/pull/9630)
- [repo] fixed `compile-references` script error message [#9667](https://github.com/eclipse-theia/theia/pull/9667)
- [repo] upgraded repository `yarn.lock` [#9536](https://github.com/eclipse-theia/theia/pull/9536)
- [search-in-workspace] fixed search debounce issue [#9579](https://github.com/eclipse-theia/theia/pull/9579)
- [vsx-registry] added support for `@builtin` and `@installed` search queries [#9572](https://github.com/eclipse-theia/theia/pull/9572)
- [vsx-registry] added support for `extensionPack` handling at buildtime [#9425](https://github.com/eclipse-theia/theia/pull/9425)
- [vsx-registry] added support for `extensions.json` functionality [#9043](https://github.com/eclipse-theia/theia/pull/9043)
- [vsx-registry] upgraded `sanitize-html` dependency [#9525](https://github.com/eclipse-theia/theia/pull/9525)
- [workspace] improved extensibility of `workspace-service` private members and methods [#9597](https://github.com/eclipse-theia/theia/pull/9597)

<a name="breaking_changes_1.15.0">[Breaking Changes:](#breaking_changes_1.15.0)</a>

- [core] `outline-view-tree.ts` has been renamed to `outline-view-tree-model.ts` to match class name. [#9583](https://github.com/eclipse-theia/theia/pull/9583)
- [editor-preview] `EditorPreviewWidget` now extends `EditorWidget` and `EditorPreviewManager` extends and overrides `EditorManager`. `instanceof` checks can no longer distinguish between preview and non-preview editors; use `.isPreview` field instead. [#9518](https://github.com/eclipse-theia/theia/pull/9517)
- [process] `@theia/process/lib/node/shell-process` no longer exports `mergeProcessEnv` as a raw function. Use `@theia/core/lib/node/environment-utils` and the injectable `EnvironmentUtils` class instead.
- [process] `ShellProcess` constructor takes a new `environmentUtils` parameter to handle environment operations.
- [vsx-registry] removed support for `VSXApiVersionProvider` [#9425](https://github.com/eclipse-theia/theia/pull/9425)

## v1.14.0 - 5/27/2021

[1.14.0 Milestone](https://github.com/eclipse-theia/theia/milestone/20)

- [api-samples] fixed dynamic label example [#9517](https://github.com/eclipse-theia/theia/pull/9517)
- [application-manager] upgraded to `webpack v5` [#9451](https://github.com/eclipse-theia/theia/pull/9451)
- [core] added events to notify about websocket upgrades [#9459](https://github.com/eclipse-theia/theia/pull/9459)
- [core] added support for language-specific preferences in the frontend configuration object [#9358](https://github.com/eclipse-theia/theia/pull/9358)
- [debug] fixed `Add Configurations` command behavior when an empty `launch.json` present [#9467](https://github.com/eclipse-theia/theia/pull/9467)
- [debug] fixed issue when setting non-code breakpoints [#9479](https://github.com/eclipse-theia/theia/pull/9479)
- [file-search] added support for `goto line and column` in the file search [#9478](https://github.com/eclipse-theia/theia/pull/9478)
- [filesystem] added ability to perform a `~` substitution in the browser file dialog [#9416](https://github.com/eclipse-theia/theia/pull/9416)
- [messages] added explicit handling to sanitize notification messages before rendering [#9520](https://github.com/eclipse-theia/theia/pull/9520)
- [monaco] improved styling of the `rename` input [#9419](https://github.com/eclipse-theia/theia/pull/9419)
- [output] fixed styling issue where `errors` and `warnings` were not colored [#9496](https://github.com/eclipse-theia/theia/pull/9496)
- [plugin] added support for `extensionsUri` [#9428](https://github.com/eclipse-theia/theia/pull/9428)
- [plugin] added support for `vscode.URI` APIs [#9422](https://github.com/eclipse-theia/theia/pull/9422)
- [plugin] added support for the `hosted-plugin.launchOutFiles` preference [#9176](https://github.com/eclipse-theia/theia/pull/9176)
- [plugin] aligned `FileDecoration` API with the latest version [#8911](https://github.com/eclipse-theia/theia/pull/8911)
- [plugin] improved extensibility of `replacer` and `reviver` [#9422](https://github.com/eclipse-theia/theia/pull/9422)
- [plugin] improved support for additional submenu contributions [#9371](https://github.com/eclipse-theia/theia/pull/9371)
- [preferences] updated initial reading of preference files to before the `ready` promise resolves [#9362](https://github.com/eclipse-theia/theia/pull/9362)
- [process][terminal] fixed issue where the output of short-lived tasks are not displayed [#9409](https://github.com/eclipse-theia/theia/pull/9409)
- [quality] removed duplicate implementations of `InMemoryTextResource` [#9504](https://github.com/eclipse-theia/theia/pull/9504)
- [search-in-workspace] added ability to perform searches outside workspace by specifying `include` path [#9307](https://github.com/eclipse-theia/theia/pull/9307)
- [search-in-workspace] added support for the `search.smartCase` preference to control searching behavior [#9408](https://github.com/eclipse-theia/theia/pull/9408)
- [search-in-workspace] fixed issue when revealing a result [#9504](https://github.com/eclipse-theia/theia/pull/9504)
- [search-in-workspace] improved search behavior for additional `include`/`exclude` patterns [#9307](https://github.com/eclipse-theia/theia/pull/9307)
- [search-in-workspace] updated `search and replace` to only display diff if a replace term is present [#9516](https://github.com/eclipse-theia/theia/pull/9516)
- [terminal] fixed merging of environment variables [#9437](https://github.com/eclipse-theia/theia/pull/9437)
- [terminal] removed incorrect `process.env` from the browser environment [#9452](https://github.com/eclipse-theia/theia/pull/9452)
- [vsx-registry] added handling to sanitize readme before rendering [#9424](https://github.com/eclipse-theia/theia/pull/9424)
- [vsx-registry] updated compatibility check for vscode builtins to verify compatible version rather than engine [#9486](https://github.com/eclipse-theia/theia/pull/9486)

<a name="breaking_changes_1.14.0">[Breaking Changes:](#breaking_changes_1.14.0)</a>

- [debug] `DebugConfigurationManager` no longer `@injects()` the `FileService` and now uses `MonacoTextModelService` instead. [#9467](https://github.com/eclipse-theia/theia/pull/9467)
- [filesystem] `ReactRenderer`, `LocationListRenderer`, and `FileDialogTreeFiltersRenderer` have been made injectable/factoritized [#9416](https://github.com/eclipse-theia/theia/pull/9416)
  - `FileDialog` and its children have been updated to use property injection where appropriate and initialization inside constructor has been moved to `postConstruct`
- [vsx-registry] `VSXRegistryAPI.getLatestCompatibleVersion` now accepts `VSXSearchEntry` as a parameter [#9486](https://github.com/eclipse-theia/theia/pull/9486)

## v1.13.0 - 4/29/2021

[1.13.0 Milestone](https://github.com/eclipse-theia/theia/milestone/19)

- [console] sanitized HTML content the `ansi-console` [#9339](https://github.com/eclipse-theia/theia/pull/9339)
- [core] added `isEqual` method for `URI` [#8925](https://github.com/eclipse-theia/theia/pull/8925)
- [core] added handling to automatically reconnect websocket on offline event [#9299](https://github.com/eclipse-theia/theia/pull/9299)
- [core] added missing `useCapture` argument to `removeEventListener` [#9273](https://github.com/eclipse-theia/theia/pull/9273)
- [core] added re-export of common packages strategy [#9124](https://github.com/eclipse-theia/theia/pull/9124)
- [core] improved handling of `saveAll` by checking if a widget is dirty before saving [#9393](https://github.com/eclipse-theia/theia/pull/9393)
- [core] updated `nsfw` dependency to `^2.1.2` [#9267](https://github.com/eclipse-theia/theia/pull/9267)
- [debug] fixed hover issues for the `currentFrame` editor [#9256](https://github.com/eclipse-theia/theia/pull/9256)
- [debug] improved error messages [#9386](https://github.com/eclipse-theia/theia/pull/9386)
- [documentation] added roadmap information to the readme [#9308](https://github.com/eclipse-theia/theia/pull/9308)
- [documentation] updated pre-publishing steps [#9257](https://github.com/eclipse-theia/theia/pull/9257)
- [editor-preview] updated logic to activate editor-preview editors only if already active [#9346](https://github.com/eclipse-theia/theia/pull/9346)
- [editor] added support for `reopen closed editor` [#8925](https://github.com/eclipse-theia/theia/pull/8925)
- [editor] added support to open multiple editors for the same file [#9369](https://github.com/eclipse-theia/theia/pull/9369)
  - added `split editor` command.
  - added `split editor up` command.
  - added `split editor down` command.
  - added `split editor right` command.
  - added `split editor left` command.
  - added `split editor orthogonal` command.
- [electron] added command and keybinding for `toggle full screen` [#9399](https://github.com/eclipse-theia/theia/pull/9399)
- [getting-started] fixed the opening of external links in `electron` [#9390](https://github.com/eclipse-theia/theia/pull/9390)
- [getting-started] updated links to be keyboard operable [#9318](https://github.com/eclipse-theia/theia/pull/9318)
- [getting-started] updated links to not modify the URL hash [#9318](https://github.com/eclipse-theia/theia/pull/9318)
- [git] added handling to group context-menu by category [#9324](https://github.com/eclipse-theia/theia/pull/9324)
- [monaco] fixed regression which did not respect `setContext` [#9343](https://github.com/eclipse-theia/theia/pull/9343)
- [monaco] improved handling of themes on startup by using `indexedDB` if available [#9303](https://github.com/eclipse-theia/theia/pull/9303)
- [plugin] added `CodeActionTriggerKind` enum [#9368](https://github.com/eclipse-theia/theia/pull/94039368)
- [plugin] added handling for empty command `id` with available arguments [#9223](https://github.com/eclipse-theia/theia/pull/9223)
- [plugin] added support for the `CustomExecution` API [#9189](https://github.com/eclipse-theia/theia/pull/9189)
- [plugin] added support for the `PluginContext` API [#9276](https://github.com/eclipse-theia/theia/pull/9276)
- [plugin] added support to read `args` from `keybindings` [#9372](https://github.com/eclipse-theia/theia/pull/9372)
- [plugin] fixed dialog `canSelectMany` implementation [#9278](https://github.com/eclipse-theia/theia/pull/9278)
- [plugin] fixed handling for `.focus` view commands [#9364](https://github.com/eclipse-theia/theia/pull/9364)
- [plugin] refactored the `RPCProtocol` for quality [#8972](https://github.com/eclipse-theia/theia/pull/8972)
- [plugin] removed unnecessary coupling to `editor-preview` [#9302](https://github.com/eclipse-theia/theia/pull/9302)
- [plugin] updated `safeStringify` output error [#9223](https://github.com/eclipse-theia/theia/pull/9223)
- [preferences] added handling to properly re-render view when extensions which provide preferences are uninstalled [#9313](https://github.com/eclipse-theia/theia/pull/9313)
- [preferences] fixed `preference-array.css` styling due to typos [#9270](https://github.com/eclipse-theia/theia/pull/9270)
- [preferences] fixed regression for the preferences-view without plugin support [#9403](https://github.com/eclipse-theia/theia/pull/9403)
- [preferences] updated handling to activate the preferences-view when opened through the `OPEN_PREFERENCES` command [#9355](https://github.com/eclipse-theia/theia/pull/9355)
- [preferences] updated the formatting of preferences [#9381](https://github.com/eclipse-theia/theia/pull/9381)
- [task] added handling to update workspace model on workspace location change [#9331](https://github.com/eclipse-theia/theia/pull/9331)
- [task] added support for task presentation options [#9248](https://github.com/eclipse-theia/theia/pull/9248)
  - added support for `presentationOptions.clear`.
  - added support for `presentationOptions.echo`.
  - added support for `presentationOptions.focus`.
  - added support for `presentationOptions.panel`.
  - added support for `presentationOptions.reveal`.
  - added support for `presentationOptions.showReuseMessage`.
- [timeline] addef missing `@theia/navigator` dependency [#9267](https://github.com/eclipse-theia/theia/pull/9267)
- [vsx-registry] added `copy extension id` and `copy` commands to the extension context-menu [#9292](https://github.com/eclipse-theia/theia/pull/9292)
- [vsx-registry] added handling to preserve recently uninstalled extensions from the extensions-view until reload [#9236](https://github.com/eclipse-theia/theia/pull/9236)
- [vsx-registry] updated api compatibility handling to improve performance, and check for compatibility when installing builtins from the extensions-view [#9280](https://github.com/eclipse-theia/theia/pull/9280)
- [workspace] improved `save as...` command behavior [#9022](https://github.com/eclipse-theia/theia/pull/9022)

<a name="breaking_changes_1.13.0">[Breaking Changes:](#breaking_changes_1.13.0)</a>

- [workspace] `WorkspaceCommands.SAVE_AS` command no longer accepts an `URI` argument. It now uses the currently selected editor to determine the file to be saved [#9022](https://github.com/eclipse-theia/theia/pull/9022)

## v1.12.1 - 3/29/2021

- [core][filesystem] Use `nsfw@^2.1.2` to fix an issue on Windows where file watching did not work at all.

## v1.12.0 - 3/25/2021

[1.12.0 Milestone](https://github.com/eclipse-theia/theia/milestone/17)

- [core] added API to remove toolbar items [#9044](https://github.com/eclipse-theia/theia/pull/9044)
- [core] added `onDidChangeActiveEmitter` when a quick-pick is accepted [#9175](https://github.com/eclipse-theia/theia/pull/9175)
- [core] added support for creating lazy preference proxies [#9169](https://github.com/eclipse-theia/theia/pull/9169)
- [core] fixed `when` clause for commands registered to the command-palette [#9188](https://github.com/eclipse-theia/theia/pull/9188)
- [core] updated connection status service to prevent false positive alerts about offline mode [#9068](https://github.com/eclipse-theia/theia/pull/9068)
- [editor] fixed issue with revealing selection when opening editors [#9004](https://github.com/eclipse-theia/theia/pull/9004)
- [electron] added `folder` dialog fallback when setting `canSelectFiles` and `canSelectFolders` dialog props simultaneously on non-OSX machines [#9179](https://github.com/eclipse-theia/theia/pull/9179)
- [electron] added support for the `window.zoomLevel` preference [#9121](https://github.com/eclipse-theia/theia/pull/9121)
- [external-terminal] added new extension to spawn external terminals in electron applications [#9186](https://github.com/eclipse-theia/theia/pull/9186)
- [filesystem] added file dialog enhancements including text input and a navigate up icon [#8748](https://github.com/eclipse-theia/theia/pull/8748)
- [filesystem] added ability for downstream applications to control file-watching [#9163](https://github.com/eclipse-theia/theia/pull/9163)
- [filesystem] fixed `electron` dialogs to set the proper `defaultPath` (cwd) [#9135](https://github.com/eclipse-theia/theia/pull/9135)
- [filesystem] fixed logic when performing copy and paste in a duplicate file/folder [#9037](https://github.com/eclipse-theia/theia/pull/9037)
- [markers] added fallback `owner` sort when sorting markers for an individual resource [#9211](https://github.com/eclipse-theia/theia/pull/9211)
- [markers] fixed the marker `copy` command to correctly set the `owner` [#9160](https://github.com/eclipse-theia/theia/pull/9160)
- [mini-browser] fixed host pattern logic for `HOST_PATTERN_ENV` [#9201](https://github.com/eclipse-theia/theia/pull/9201)
- [mini-browser] fixed virtual host env logic [#9209](https://github.com/eclipse-theia/theia/pull/9209)
- [mini-browser] removed dead/unused electron-specific code for quality [#9209](https://github.com/eclipse-theia/theia/pull/9209)
- [monaco] exposed `_preview` editor from the references widget [#9245](https://github.com/eclipse-theia/theia/pull/9245)
- [monaco] fixed editor gutter size by updating `lineNumberMinChars` [#9168](https://github.com/eclipse-theia/theia/pull/9168)
- [monaco] update fallback `font-family` for the editor [#9147](https://github.com/eclipse-theia/theia/pull/9147)
- [output] fixed `registerToolbarItems` to allow async registration [#9044](https://github.com/eclipse-theia/theia/pull/9044)
- [plugin] added support for `CustomEditor` APIs [#8910](https://github.com/eclipse-theia/theia/pull/8910)
- [plugin] added support for `TaskScope.Workspace` [#9032](https://github.com/eclipse-theia/theia/pull/9032)
- [plugin] added support for `onStartupFinished` activation event [#9212](https://github.com/eclipse-theia/theia/pull/9212)
- [plugin] added support for `workbench.files.openFileFolder` command [#9213](https://github.com/eclipse-theia/theia/pull/9213)
- [plugin] added support for the `workspace.workspaceFile` API [#9132](https://github.com/eclipse-theia/theia/pull/9132)
- [plugin] fixed `when` clause for views [#9156](https://github.com/eclipse-theia/theia/pull/9156)
- [plugin] fixed custom debug request handling to pass the `body` instead of `response` object [#9131](https://github.com/eclipse-theia/theia/pull/9131)
- [plugin] fixed dialog implementation to open appropriate dialogs on browser or electron [#9179](https://github.com/eclipse-theia/theia/pull/9179)
- [plugin] fixed issue where `onDidExpandViewEmitter` was not properly fired [#9229](https://github.com/eclipse-theia/theia/pull/9229)
- [plugin] update error handling when setting storage without a workspace [#9137](https://github.com/eclipse-theia/theia/pull/9137)
- [plugin] updated `SCM` API to latest version [#9045](https://github.com/eclipse-theia/theia/pull/9045)
- [plugin] updated `vscode.window.createTerminal` to accept URI current working directories [#9140](https://github.com/eclipse-theia/theia/pull/9140)
- [preferences] added `updateValue` API for the `PreferenceService` [#9178](https://github.com/eclipse-theia/theia/pull/9178)
- [preferences] added functionality to restore the preference state including search term, preference scope, and editor location [#9166](https://github.com/eclipse-theia/theia/pull/9166)
- [property-view] added initial version of a selection-based property-view [#8655](https://github.com/eclipse-theia/theia/pull/8655)
  - A default implementation is available for file selections (via file navigator and default editors).
- [repo] enabled eslint checks for `theia.d.ts` [#9200](https://github.com/eclipse-theia/theia/pull/9200)
- [repo] updated readme 'new issue' link to point to issue templates [#9180](https://github.com/eclipse-theia/theia/pull/9180)
- [search-in-workspace] added ability to perform search when glob fields (include and exclude) are updated [#9183](https://github.com/eclipse-theia/theia/pull/9183)
- [search-in-workspace] added logic to remove search results for deleted files [#9218](https://github.com/eclipse-theia/theia/pull/9218)
- [search-in-workspace] fixed the comparison of editors when working with dirty files [#9192](https://github.com/eclipse-theia/theia/pull/9192)
- [search-in-workspace] removed usage of the deprecated `keyCode` API [#9183](https://github.com/eclipse-theia/theia/pull/9183)
- [tasks] added support for workspace-scoped task configurations. [#8917](https://github.com/eclipse-theia/theia/pull/8917)
- [terminal] fixed `xterm` addon versions which broke searching [#9167](https://github.com/eclipse-theia/theia/pull/9167)
- [variable-resolver] added support for `pathSeparator` variable substitution [#9054](https://github.com/eclipse-theia/theia/pull/9054)
- [vsx-registry] added `Install from VSIX...` command to install a local extension [#9184](https://github.com/eclipse-theia/theia/pull/9184)
- [vsx-registry] added toolbar menu support for the extensions-view [#9184](https://github.com/eclipse-theia/theia/pull/9184)
- [workspace] add support for configurations outside the `settings` object and add `WorkspaceSchemaUpdater` to allow configurations sections to be contributed by extensions [#8917](https://github.com/eclipse-theia/theia/pull/8917)

<a name="breaking_changes_1.12.0">[Breaking Changes:](#breaking_changes_1.12.0)</a>

- [core] `PreferenceService` and `PreferenceProvider` `getConfigUri` and `getContainingConfigUri` methods accept `sectionName` argument to retrieve URI's for non-settings configurations [#8917](https://github.com/eclipse-theia/theia/pull/8917)
- [filesystem] `FileDialog` and `LocationListRenderer` now require `FileService` to be passed into constructor for text-based file dialog navigation in browser [#8748](https://github.com/eclipse-theia/theia/pull/8748)
- [mini-browser] Removed `@theia/mini-browser/lib/electron-main/` and its bindings in the `electron-main` context [#9209](https://github.com/eclipse-theia/theia/pull/9209)
- [tasks] `TaskConfigurationModel.scope` field now protected. `TaskConfigurationManager` setup changed to accommodate workspace-scoped tasks [#8917](https://github.com/eclipse-theia/theia/pull/8917)
- [workspace] `WorkspaceData` interface modified and workspace file schema updated to allow for `tasks` outside of `settings` object. `WorkspaceData.buildWorkspaceData` `settings` argument now accepts an object with any of the keys of the workspace schema [#8917](https://github.com/eclipse-theia/theia/pull/8917)

## v1.11.0 - 2/25/2021

[1.11.0 Milestone](https://github.com/eclipse-theia/theia/milestone/16)

- [api-samples] added example to echo the currently supported vscode API version [#8191](https://github.com/eclipse-theia/theia/pull/8191)
- [bulk-edit] added support for previewing refactorings [#8589](https://github.com/eclipse-theia/theia/pull/8589)
- [core] fixed context-menu position when the electron application is scaled (zoom in/zoom out) [#9082](https://github.com/eclipse-theia/theia/pull/9082)
- [core] fixed keyboard shortcuts when working with devTools in the electron application [#8943](https://github.com/eclipse-theia/theia/pull/8943)
- [core] fixed tabbar-toolbar mouse event handler [#9125](https://github.com/eclipse-theia/theia/pull/9125)
- [core] fixed theming issue for secondary buttons when using light themes [#9008](https://github.com/eclipse-theia/theia/pull/9008)
- [core] updated `ProgressMessageOptions.cancelable` documentation to reflect updated default [#9033](https://github.com/eclipse-theia/theia/pull/9033)
- [core] updated the tree search-box to align with vscode [#9005](https://github.com/eclipse-theia/theia/pull/9005)
- [core] updated tree-view parts header styling [#9128](https://github.com/eclipse-theia/theia/pull/9128)
- [documentation] added documentation on how to debug plugin sources in 'developing.md' [#9018](https://github.com/eclipse-theia/theia/pull/9018)
- [documentation] fixed typo in 'developing.md' [#9092](https://github.com/eclipse-theia/theia/pull/9092)
- [editor] added `onFocusChanged` event in order to update the active editor when switching editors [#9013](https://github.com/eclipse-theia/theia/pull/9013)
- [file-search] added support for performing file searches with whitespaces [#8989](https://github.com/eclipse-theia/theia/pull/8989)
- [git] added handling to remove extraneous entries in the `scm` for nested git repositories [#7629](https://github.com/eclipse-theia/theia/pull/7629)
- [keymaps] fixed keybinding disablement and remapping [#9088](https://github.com/eclipse-theia/theia/pull/9088)
- [keymaps] fixed serialization for the `keymaps.json` file [#9088](https://github.com/eclipse-theia/theia/pull/9088)
- [markers] fixed issue when enabling/disabling problem marker tabbar decorations [#9059](https://github.com/eclipse-theia/theia/pull/9059)
- [monaco] fixed theming issue when using third-party themes [#8964](https://github.com/eclipse-theia/theia/pull/8964)
- [monaco] fixed theming issues when registering themes with null or undefined properties [#9097](https://github.com/eclipse-theia/theia/pull/9097)
- [navigator] fixed issue when dragging-and-dropping files into the main area [#8927](https://github.com/eclipse-theia/theia/pull/8927)
- [navigator] fixed issue when performing a drag-and-drop without the proper selection [#9093](https://github.com/eclipse-theia/theia/pull/9093)
- [output] generalized the `output` APIs for extensibility [#9060](https://github.com/eclipse-theia/theia/pull/9060)
- [plugin] added API stub for terminal links [#9048](https://github.com/eclipse-theia/theia/pull/9048)
- [plugin] added missing `group` property to the `TaskDTO` interface [#8971](https://github.com/eclipse-theia/theia/pull/8971)
- [plugin] added support for submenu contributions [#8996](https://github.com/eclipse-theia/theia/pull/8996)
- [plugin] extracted plugin URI generation into an injectable class [#9027](https://github.com/eclipse-theia/theia/pull/9027)
- [plugin] fixed issue where `problemMatchers` were not properly set when configuring tasks [#8971](https://github.com/eclipse-theia/theia/pull/89771)
- [plugin] fixed welcome-view empty condition [#9047](https://github.com/eclipse-theia/theia/pull/9047)
- [preferences] added a `clear-all` button in the preferences-view input for clearing search results [#9113](https://github.com/eclipse-theia/theia/pull/9133)
- [preferences] added a result count badge in the preferences-view input when performing a search [#9113](https://github.com/eclipse-theia/theia/pull/9133)
- [preferences] fixed issue when attempting to validate numeric values from the preferences-view [#9089](https://github.com/eclipse-theia/theia/pull/9089)
- [preferences] fixed the `PreferenceChangeEvent<T>` typing [#9057](https://github.com/eclipse-theia/theia/pull/9057)
- [preferences] improved overall performance of the preferences-view, including filtering and switching scopes [#8263](https://github.com/eclipse-theia/theia/pull/8263)
- [repo] updated list of builtin extensions when using the example applications [#9017](https://github.com/eclipse-theia/theia/pull/9017)
- [repo] uplifted CI/CD to use Python3 exclusively [#9085](https://github.com/eclipse-theia/theia/pull/9085)
- [search-in-workspace] fixed styling of the replace item border [#9090](https://github.com/eclipse-theia/theia/pull/9090)
- [task] updated logic to activate corresponding terminal when using the `show running tasks` action [#9016](https://github.com/eclipse-theia/theia/pull/9016)
- [vsx-registry] added API compatibility handling when installing extensions through the 'extensions-view' [#8191](https://github.com/eclipse-theia/theia/pull/8191)

<a name="breaking_changes_1.11.0">[Breaking Changes:](#breaking_changes_1.11.0)</a>

- [core] updated `SearchBox.input` field type from `HTMLInputElement` to `HTMLSpanElement` [#9005](https://github.com/eclipse-theia/theia/pull/9005)

<a name="1.11.0_user-storage_scheme_updated"></a>
-   [[user-storage]](#1.11.0_user-storage_scheme_updated) `UserStorageUri` scheme was changed from 'user_storage' to 'user-storage' as '\_' is not a valid char in scheme (according to [RFC 3986](https://tools.ietf.org/html/rfc3986#page-17)) [#9049](https://github.com/eclipse-theia/theia/pull/9049)


## v1.10.0 - 1/28/2021

- [api-samples] added example on how to contribute toggleable toolbar items [#8968](https://github.com/eclipse-theia/theia/pull/8968)
- [api-tests] fixed the `Saveable#closeOnFileDelete` integration test [#8942](https://github.com/eclipse-theia/theia/pull/8942)
- [core] added support for vscode settings schemas [#8761](https://github.com/eclipse-theia/theia/pull/8761)
- [core] added unit tests for `uri.isEqualOrParent` [#8876](https://github.com/eclipse-theia/theia/pull/8876)
- [core] fixed display issue with horizontal scrollbars in tab areas [#8898](https://github.com/eclipse-theia/theia/pull/8898)
- [core] fixed error message when a command fails to execute [#8978](https://github.com/eclipse-theia/theia/pull/8978)
- [core] fixed issue to allow late client registration [#8586](https://github.com/eclipse-theia/theia/pull/8686)
- [core] fixed issue with `TreeWidget#applyFontStyles` [#8937](https://github.com/eclipse-theia/theia/pull/8937)
- [core] fixed minor typo `mounpoint` to `mountpoint` [#8928](https://github.com/eclipse-theia/theia/pull/8928)
- [core] removed the `save without formatting` menu entry under `file` [#8877](https://github.com/eclipse-theia/theia/pull/8877)
- [core] updated rendering of toggleable toolbar items to highlight them when toggled [#8968](https://github.com/eclipse-theia/theia/pull/8968)
- [dependencies] updated to use fixed versions when publishing, `"x.y.z"` instead of `"^x.y.z"` in dependencies [#8880](https://github.com/eclipse-theia/theia/pull/8880)
- [documentation] updated `NOTICE.md` [#8957](https://github.com/eclipse-theia/theia/pull/8957)
- [filesystem] added support for the `files.trimTrailingWhitespace` preference [#8742](https://github.com/eclipse-theia/theia/pull/8742)
- [filesystem] fixed the type guard for `FileStat.is` [#8986](https://github.com/eclipse-theia/theia/pull/8986)
- [navigator] update the navigator widget factory for extensibility [#8962](https://github.com/eclipse-theia/theia/pull/8962)
- [navigator] updated the menu order for `select for compare` and `compare with selected` [#8926](https://github.com/eclipse-theia/theia/pull/8926)
- [plugin] added `createDeployQuickOpenItem` method to create `DeployQuickOpenItem` in order to make extension deploy command extensible [#8919](https://github.com/eclipse-theia/theia/pull/8919)
- [plugin] added support for `viewsWelcome` in `TreeViews` [#8678](https://github.com/eclipse-theia/theia/pull/8678)
- [plugin] added support for the `CommentThread` Plugin API [#8870](https://github.com/eclipse-theia/theia/pull/8870)
- [plugin] added support for the `workbench.action.navigateBack` command [#8958](https://github.com/eclipse-theia/theia/pull/8958)
- [plugin] added support for the `workbench.action.navigateForward` command [#8958](https://github.com/eclipse-theia/theia/pull/8958)
- [plugin] added support for the `workbench.action.navigateToLastEditLocation` command [#8958](https://github.com/eclipse-theia/theia/pull/8958)
- [plugin] fixed tree-view reveal to not invalidate item command [#8922](https://github.com/eclipse-theia/theia/pull/8922)
- [plugin] updated the logging of embedded languages [#8938](https://github.com/eclipse-theia/theia/pull/8938)
- [preview] upgraded `highlight.js` from `^9.12.2` to `10.4.1` to resolve security vulnerability [#8881](https://github.com/eclipse-theia/theia/pull/8881)
- [scm] updated code required to highlight nodes on search in the `ScmTreeWidget` [#8929](https://github.com/eclipse-theia/theia/pull/8929)
- [task] fixed issue where tasks were not successfully executed without `cwd` explicitly set [#8949](https://github.com/eclipse-theia/theia/pull/8949)
- [terminal] reduced the severity of certain terminal logs [#8908](https://github.com/eclipse-theia/theia/pull/8908)

<a name="breaking_changes_1.10.0">[Breaking Changes:](#breaking_changes_1.10.0)</a>

- [scm] added the `caption` field to the `ScmTreeWidget.Props` interface. Removed `name` from `ScmResourceComponent.Props`, `groupLabel` from `ScmResourceGroupComponent.Props`, and `path` from `ScmResourceFolderElement.Props` interfaces. [#8929](https://github.com/eclipse-theia/theia/pull/8929)


## v1.9.0 - 16/12/2020

- [cli] updated error reporting for the `download-plugins` script [#8798](https://github.com/eclipse-theia/theia/pull/8798)
- [cli] updated the `download-plugins` script to report errors in case of unsupported file types [#8797](https://github.com/eclipse-theia/theia/pull/8797)
- [core] added support for the `workbench.editor.closeOnFileDelete` preference [#8731](https://github.com/eclipse-theia/theia/pull/8731)
- [core] fixed issue when attempting to kill the electron backend [#8809](https://github.com/eclipse-theia/theia/pull/8809)
- [core] updated tree expansion busy indicators [#8582](https://github.com/eclipse-theia/theia/pull/8582)
- [filesystem] fixed issue with pasting files/folders with the same name [#8778](https://github.com/eclipse-theia/theia/pull/8778)
- [filesystem] updated `upload` to return `FileUploadResult` [#8766](https://github.com/eclipse-theia/theia/pull/8766)
- [mini-browser] fixed issue when serving `{{hostname}}` as a pattern for `THEIA_MINI_BROWSER_HOST_PATTERN` [#8865](https://github.com/eclipse-theia/theia/pull/8865)
- [mini-browser] fixed missing resource response [#8866](https://github.com/eclipse-theia/theia/pull/8866)
- [plugin] added support for the command `workbench.extensions.installExtension` [#8745](https://github.com/eclipse-theia/theia/pull/8745)
- [plugin] corrected identification of uri schemes according to `rfc3986` [#8832](https://github.com/eclipse-theia/theia/pull/8832)
- [plugin] fixed the `reveal()` method for tree-views [#8783](https://github.com/eclipse-theia/theia/pull/8783)
- [plugin] removed unnecessary `plugin-ext` dependencies [#8831](https://github.com/eclipse-theia/theia/pull/8831)
- [plugin] updated `set html` to pass the object field instead of method argument [#8833](https://github.com/eclipse-theia/theia/pull/8833)
- [siw] added support for the `search.searchOnEditorModification` preference [#8765](https://github.com/eclipse-theia/theia/pull/8765)
- [siw] added support for the `search.searchOnType` preference [#8773](https://github.com/eclipse-theia/theia/pull/8773)

<a name="breaking_changes_1.9.0">[Breaking Changes:](#breaking_changes_1.9.0)</a>

- [core] `FrontendApplicationContribution.onWillStop` is now called for every contribution and will not bail early [#8863](https://github.com/eclipse-theia/theia/pull/8863)
  - It will also be called when `application.confirmExit` is set to `never`.
- [`download:plugins`] errors when downloading plugins now result in build failures, unless the `--ignore-errors` flag is passed [#8788](https://github.com/eclipse-theia/theia/pull/8788)
- [plugin] `LocalDirectoryPluginDeployerResolver` has moved from `packages/plugin-ext/src/main/node/resolvers/plugin-local-dir-resolver.ts` to `packages/plugin-ext/src/main/node/resolvers/local-file-plugin-deployer-resolver.ts` and now derives from `LocalPluginDeployerResolver` [#8745](https://github.com/eclipse-theia/theia/pull/8745)
- [plugin] updated the `TreeViewsMain.$reveal` second parameter from string element id to string array element parent chain [#8783](https://github.com/eclipse-theia/theia/pull/8783)
- [plugin] removed the unused `/plugin/:path(*)` endpoint [#8831](https://github.com/eclipse-theia/theia/pull/8831)
- [task] remove bash login shell when run from task to align with vscode [#8834](https://github.com/eclipse-theia/theia/pull/8834)

## v1.8.1 - 08/12/2020

- [core] added `THEIA_HOSTS` environment variable (browser applications only) [#8759](https://github.com/eclipse-theia/theia/pull/8759)
  - Used to filter incoming WebSocket connections: if `Origin` header does not match the list of hosts it will be refused.
  - Value is a comma-separated list of domain names including the port if not `80` nor `443`.
  - Example: `app.some.domain.com,app.other.domain:12345`.

<a name="breaking_changes_1.8.1">[Breaking Changes:](#breaking_changes_1.8.1)</a>

- [core] deprecated `ElectronMessagingContribution`, token validation is now done in `ElectronTokenValidator` as a `WsRequestValidatorContribution` [#8759](https://github.com/eclipse-theia/theia/pull/8759)
- [mini-browser] added new unique endpoint [#8759](https://github.com/eclipse-theia/theia/pull/8759)
  - `{{uuid}}.mini-browser.{{hostname}}` by default.
  - Can be configured via `THEIA_MINI_BROWSER_HOST_PATTERN` environment variable.
  - Clients must setup this new hostname in their DNS resolvers.

## v1.8.0 - 26/11/2020

- [api-tests] fixed issue with `saveable` test suite [#8736](https://github.com/eclipse-theia/theia/pull/8736)
- [application-manager] enabled `monaco-editor.*` sourcemaps when debugging [#8744](https://github.com/eclipse-theia/theia/pull/8744)
- [console] updated the `anser` import workaround [#8741](https://github.com/eclipse-theia/theia/pull/8741)
- [core] added ability to filter tree nodes [#8540](https://github.com/eclipse-theia/theia/pull/8540)
- [debug] fixed issue where the debug-view is not properly updated when hidden [#8645](https://github.com/eclipse-theia/theia/pull/8645)
- [documentation] improved documentation for `@theia/cli` electron configurations [#8699](https://github.com/eclipse-theia/theia/pull/8699)
- [documentation] improved documentation for `BackendApplicationContribution` [#8686](https://github.com/eclipse-theia/theia/pull/8686)
- [documentation] improved documentation for `MenuContribution` [#8715](https://github.com/eclipse-theia/theia/pull/8715)
- [documentation] improved documentation for `MessageService` [#8688](https://github.com/eclipse-theia/theia/pull/8688)
- [documentation] improved documentation for `PreferenceContribution` [#8677](https://github.com/eclipse-theia/theia/pull/8677)
- [documentation] improved documentation for `Task` API [#8695](https://github.com/eclipse-theia/theia/pull/8695)
- [documentation] improved documentation for `TreeDecorator` and `TreeDecoratorService` [#8698](https://github.com/eclipse-theia/theia/pull/8698)
- [documentation] updated publishing documentation for the repository [#8719](https://github.com/eclipse-theia/theia/pull/8719)
- [editor] enabled `editor.semanticHighlighting.enabled` by default [#8593](https://github.com/eclipse-theia/theia/pull/8593)
- [electron] fixed issue with `application.confirmExit` preventing the app from closing [#8732](https://github.com/eclipse-theia/theia/pull/8732)
- [file-search] fixed issue where file-search did not properly ignore the `.git` folder [#8721](https://github.com/eclipse-theia/theia/pull/8721)
- [monaco] added ability to compare quick-open entries [#8185](https://github.com/eclipse-theia/theia/pull/8185)
- [output] improved extensibility of output channel commands [#8733](https://github.com/eclipse-theia/theia/pull/8733)
- [plugin] added ability to use `viewId` as a progress location [#8700](https://github.com/eclipse-theia/theia/pull/8700)
- [plugin] added logic to only store webviews when they have a corresponding serializer [#8680](https://github.com/eclipse-theia/theia/pull/8680)
- [plugin] added support for `activeColorTheme` and `onDidChangeActiveColorTheme` API [#8710](https://github.com/eclipse-theia/theia/pull/8710)
- [plugin] added support for semantic highlighting [#8593](https://github.com/eclipse-theia/theia/pull/8593)
- [plugin] fixed issue where problem matchers specified by task providers are not respected [#8756](https://github.com/eclipse-theia/theia/pull/8756)
- [plugin] fixed issues with the `Authentication` API [#8725](https://github.com/eclipse-theia/theia/pull/8725)
- [plugin] fixed terminating hosted instance issue [#8674](https://github.com/eclipse-theia/theia/pull/8674)
- [preview] fixed issue where empty document content was not properly rendered [#8729](https://github.com/eclipse-theia/theia/pull/8729)
- [repo] updated `eslint` and peer-dependencies to latest versions [#8770](https://github.com/eclipse-theia/theia/pull/8770)
- [search-in-workspace] added ability to perform searches in dirty editors [#8579](https://github.com/eclipse-theia/theia/pull/8579)
- [search-in-workspace] added ability to search opened editors outside the workspace [#8646](https://github.com/eclipse-theia/theia/pull/8646)
- [security] updated `yargs` dependency [#8711](https://github.com/eclipse-theia/theia/pull/8711)
- [workspace] fixed missing binding of `WorkspaceFrontendContribution` [#8734](https://github.com/eclipse-theia/theia/pull/8734)

<a name="breaking_changes_1.8.0">[Breaking Changes:](#breaking_changes_1.8.0)</a>

- [electron] removed `attachWillPreventUnload` method from the Electron main application. The `confirmExit` logic is handled on the frontend [#8732](https://github.com/eclipse-theia/theia/pull/8732)
- [file-search] deprecated dependency on `@theia/process` and replaced its usage by node's `child_process` API [#8721](https://github.com/eclipse-theia/theia/pull/8721)


## v1.7.0 - 29/10/2020

<a name="release_milestone_1.7.0">[1.7.0 Release Milestone](https://github.com/eclipse-theia/theia/milestone/12?closed=1)</a>

- [core] added `Save without Formatting` command [#8543](https://github.com/eclipse-theia/theia/pull/8543)
- [core] added ability to customize `CommandQuickOpenItem` [#8648](https://github.com/eclipse-theia/theia/pull/8648)
- [core] added support for `isWeb` context when clause [#8530](https://github.com/eclipse-theia/theia/pull/8530)
- [core] added support for the `keyboard.dispatch` preference [#8609](https://github.com/eclipse-theia/theia/pull/8609)
- [core] fixed the `UriAwareCommandHandler` preventing the duplication of passed arguments [#8592](https://github.com/eclipse-theia/theia/pull/8592)
- [core] fixed transparent widget backgrounds breaking branding [#8448](https://github.com/eclipse-theia/theia/pull/8448)
- [core] improved extensibility of view containers for downstream extenders [#8619](https://github.com/eclipse-theia/theia/pull/8619)
- [core] updated `Save All` to only format dirty editors [#8554](https://github.com/eclipse-theia/theia/pull/8544)
- [debug] improved extensibility of debug event handlers [#8616](https://github.com/eclipse-theia/theia/pull/8616)
- [debug] renamed the `Debug` main menu item to `Run` [#8653](https://github.com/eclipse-theia/theia/pull/8653)
- [documentation] improved documentation for `FileService` and `FileSystemProvider` [#8596](https://github.com/eclipse-theia/theia/pull/8596)
- [documentation] improved documentation for `Keybinding` and `KeybindingContribution` [#8637](https://github.com/eclipse-theia/theia/pull/8637)
- [documentation] improved documentation for `LabelProvider` and `LabelProviderContribution` [#8569](https://github.com/eclipse-theia/theia/pull/8569)
- [documentation] improved documentation for `PreferenceService` [#8612](https://github.com/eclipse-theia/theia/pull/8612)
- [documentation] improved documentation for `WidgetManager` and `WidgetOpenHandler` [#8644](https://github.com/eclipse-theia/theia/pull/8644)
- [documentation] improved documentation for the `@theia/preview` extension [#8625](https://github.com/eclipse-theia/theia/pull/8625)
- [editor] fixed inconsistent `showTextDocument` behavior [#8588](https://github.com/eclipse-theia/theia/pull/8588)
- [electron] added handling for `SIGPIPE` errors [#8661](https://github.com/eclipse-theia/theia/pull/8661)
- [filesystem] refactored file watchers: [#8546](https://github.com/eclipse-theia/theia/pull/8546)
  - Added `FileSystemWatcherService` component that should be a singleton centralizing watch requests for all clients.
  - Added `FileSystemWatcherServiceDispatcher` to register yourself and listen to file change events.
- [git] updated `commit details` and `diff view` rendering to respect `list` and `tree` modes [#8084] (https://github.com/eclipse-theia/theia/pull/8084)
- [markers] updated and enhanced the 'problem-manager' tests [#8604](https://github.com/eclipse-theia/theia/pull/8604)
- [mini-browser] updated deprecated `scrElement` usage to `target` [#8663](https://github.com/eclipse-theia/theia/pull/8663)
- [monaco] fixed race condition on monaco editor initialization [#8563](https://github.com/eclipse-theia/theia/pull/8563)
- [monaco] updated `Save All` command to format all open editors [#8551](https://github.com/eclipse-theia/theia/pull/8551)
- [navigator] added additional handling for empty multi-root workspaces [#8608](https://github.com/eclipse-theia/theia/pull/8608)
- [navigator] fixed the `doOpenNode` implementation for hidden nodes [#8659](https://github.com/eclipse-theia/theia/pull/8659)
- [plugin] added `environmentVariableCollection` to `PluginContext` [#8523](https://github.com/eclipse-theia/theia/pull/8523)
- [plugin] added `onStartupFinished` plugin activation event [#8525](https://github.com/eclipse-theia/theia/pull/8525)
- [plugin] added logic to load plugin manifests on activation [#8485](https://github.com/eclipse-theia/theia/pull/8485)
- [plugin] added support for `deprecated` strikethrough for completion items [#8553](https://github.com/eclipse-theia/theia/pull/8553)
- [plugin] bumped the default supported VS Code version to `1.50.0` [#8617](https://github.com/eclipse-theia/theia/pull/8617)
- [plugin] fixed XSS sink by sanitizing dialog `innerHTML` [#8388](https://github.com/eclipse-theia/theia/pull/8388)
- [plugin] fixed constrain types of providers [#8617](https://github.com/eclipse-theia/theia/pull/8617)
- [plugin] fixed issue related to calling the activation of an extension through another extension [#8542](https://github.com/eclipse-theia/theia/pull/8542)
- [plugin] fixed prototype pollution vulnerability [#8675](https://github.com/eclipse-theia/theia/pull/8675)
- [plugin] fixed the dismissal of menus when clicking within webviews [#8633](https://github.com/eclipse-theia/theia/pull/8633)
- [plugin] improved extensibility of `CodeEditorWidget` [#8672](https://github.com/eclipse-theia/theia/pull/8672)
- [plugin] updated `Comments` API to align with VS Code [#8539](https://github.com/eclipse-theia/theia/pull/8539)
- [plugin] updated `workspaceFolders` API to return `undefined` when no folders are opened [#8641](https://github.com/eclipse-theia/theia/pull/8641)
- [repo] added `no-tabs` rule [#8630](https://github.com/eclipse-theia/theia/pull/8630)
- [repo] reduced verbosity during build [#8642](https://github.com/eclipse-theia/theia/pull/8642)
- [repo] reduced verbosity when building individual extensions [#8642](https://github.com/eclipse-theia/theia/pull/8642)
- [repo] updated use of deprecated APIs in unit tests [#8642](https://github.com/eclipse-theia/theia/pull/8642)
- [repo] upgraded to `@types/node@12` typings [#8556](https://github.com/eclipse-theia/theia/pull/8556)
- [scm] fixed 'circular structure to JSON' error for the accept input command [#8606](https://github.com/eclipse-theia/theia/pull/8606)
- [scm] updated the commit textarea placeholder to include the current branch name [#6156](https://github.com/eclipse-theia/theia/pull/6156)
- [vsx-registry] added support for the search parameter `includeAllVersions` [#8607](https://github.com/eclipse-theia/theia/pull/8607)
- [vsx-registry] added support for the search parameter `sortBy` [#8607](https://github.com/eclipse-theia/theia/pull/8607)
- [vsx-registry] added support for the search parameter `sortOrder` [#8607](https://github.com/eclipse-theia/theia/pull/8607)
- [vsx-registry] fixed the `search` query when multiple search parameters are used [#8607](https://github.com/eclipse-theia/theia/pull/8607)
- [vsx-registry] updated the `query` API endpoint [#8570](https://github.com/eclipse-theia/theia/pull/8570)

<a name="breaking_changes_1.7.0">[Breaking Changes:](#breaking_changes_1.7.0)</a>

- [core] change progress notification cancelable property default from `true` to `false` [#8479](https://github.com/eclipse-theia/theia/pull/8479)
- [filesystem] `NsfwFileSystemWatcherServer` is deprecated and no longer used [#8546](https://github.com/eclipse-theia/theia/pull/8546)
- [messages] updated handling of empty notifications and progress notifications so they will not be shown [#8479](https://github.com/eclipse-theia/theia/pull/8479)
- [plugin-metrics] renamed `AnalyticsFromRequests.succesfulResponses` to `AnalyticsFromRequests.successfulResponses` [#8560](https://github.com/eclipse-theia/theia/pull/8560)
- [plugin] `CodeEditorWidgetUti.getResourceUri` is no longer exportable [#8672](https://github.com/eclipse-theia/theia/pull/8672)


## v1.6.0 - 24/09/2020

- [core] added ability to un-register keybindings for a given command [#8269](https://github.com/eclipse-theia/theia/pull/8269)
- [core] added handling to only execute command via keybinding if it has an active handler [#8420](https://github.com/eclipse-theia/theia/pull/8420)
- [core] updated the triggering of `tab-bar` context-menus to open without the need to be activated beforehand [#6965](https://github.com/eclipse-theia/theia/pull/6965)
- [editor] added ability to set the default formatter [#8446](https://github.com/eclipse-theia/theia/pull/8446)
- [electron] fixed the `rebuild:electron` command for the `drivelist` native module [#8454](https://github.com/eclipse-theia/theia/pull/8454)
- [filesystem] added handling to warn Linux users when they have exhausted `Inotify` handles, along with instructions on how to fix it [#8458](https://github.com/eclipse-theia/theia/pull/8458)
- [filesystem] fixed the deprecated `FileSystem` binding to return an instantiated instance rather than the class [#8507](https://github.com/eclipse-theia/theia/pull/8507)
- [keymaps] added handling to prevent URL hash changes when editing keybindings [#8502](https://github.com/eclipse-theia/theia/pull/8502)
- [lint] added XSS sink detection eslint rules [#8481](https://github.com/eclipse-theia/theia/pull/8481)
- [output] renamed `output-widget.tsx` to `output-widget.ts` [#8499](https://github.com/eclipse-theia/theia/pull/8499)
- [output] updated logic to allow clients to customize channel creation [#8476](https://github.com/eclipse-theia/theia/pull/8476)
- [plugin] added `CompletionItemTag` enum [#8517](https://github.com/eclipse-theia/theia/pull/8517)
- [plugin] added `DebugConsoleMode` enum [#8513](https://github.com/eclipse-theia/theia/pull/8513)
- [plugin] added `authentication` plugin API [#8402](https://github.com/eclipse-theia/theia/pull/8402)
- [plugin] added `revealInExplorer` command [#8496](https://github.com/eclipse-theia/theia/pull/8496)
- [plugin] fixed issue related to getting the default value from `globalState`/`workspaceState` [#8424](https://github.com/eclipse-theia/theia/pull/8424)
- [plugin] removed superfluous channel caching for extensions [#8476](https://github.com/eclipse-theia/theia/pull/8476)
- [plugin] updated `vscode.findFiles` API to handle ignored files [#8452](https://github.com/eclipse-theia/theia/pull/8452)
- [plugin] updated plugin storage path to be FIPS-compliant [#8379](https://github.com/eclipse-theia/theia/pull/8379)
- [plugin] updated task ID generation logic [#8379](https://github.com/eclipse-theia/theia/pull/8379)
- [preferences] updated the rendering of preference category headers and leaves [#8512](https://github.com/eclipse-theia/theia/pull/8512)
- [scm] fixed activation request of the scm-widget [#8508](https://github.com/eclipse-theia/theia/pull/8508)
- [search-in-workspace] added handling to respect the `files.exclude` preference when searching [#8433](https://github.com/eclipse-theia/theia/pull/8433)
- [timeline] added the `@theia/timeline` extension [#7997](https://github.com/eclipse-theia/theia/pull/7997)

<a name="breaking_changes_1.6.0">[Breaking Changes:](#breaking_changes_1.6.0)</a>

- [core] context-menus for `tab-bars` now require an `Event` to be passed to execute commands without activating the shell `tab-bar` [#6965](https://github.com/eclipse-theia/theia/pull/6965)
  - Removed logic from `TabBarRenderer.handleContextMenuEvent()` to support triggering context-menus without the need to activate the widget.
  - When registering a command, `Event` should be passed, else commands will not work correctly as they do no longer rely on the activation of `tab-bars`.
- [core] refactored `findTitle()` and `findTabBar()` moving them from `common-frontend-contribution.ts` to `application-shell.ts` [#6965](https://github.com/eclipse-theia/theia/pull/6965)

## v1.5.0 - 27/08/2020

- [application-manager] fixed issue regarding reloading electron windows [#8345](https://github.com/eclipse-theia/theia/pull/8345)
- [application-package] fixed incorrect app config defaults [#8355](https://github.com/eclipse-theia/theia/pull/8355)
- [cli] updated `download:plugins` script to use `decompress` [#8315](https://github.com/eclipse-theia/theia/pull/8315)
- [core] added `badge` count for the `problems-view` [#8156](https://github.com/eclipse-theia/theia/pull/8156)
- [core] added setting menu items to the sidebar bottom menus [#8372](https://github.com/eclipse-theia/theia/pull/8372)
- [core] added support for `badge` count tab decorations [#8156](https://github.com/eclipse-theia/theia/pull/8156)
- [core] added support for registering custom menu nodes [#8404](https://github.com/eclipse-theia/theia/pull/8404)
- [core] added support for sidebar bottom menus [#8372](https://github.com/eclipse-theia/theia/pull/8372)
- [core] added support for tree indent guidelines [#8298](https://github.com/eclipse-theia/theia/pull/8298)
- [core] fixed submenu ordering [#8377](https://github.com/eclipse-theia/theia/pull/8377)
- [core] fixed the menu widget layout [#8419](https://github.com/eclipse-theia/theia/pull/8419)
- [core] updated extensibility of `DefaultUriLabelProviderContribution` [#8281](https://github.com/eclipse-theia/theia/pull/8281)
- [debug] added `badge` count for active debug sessions [#8342](https://github.com/eclipse-theia/theia/pull/8342)
- [debug] fixed debug exception height computation [#8382](https://github.com/eclipse-theia/theia/pull/8382)
- [dependencies] updated `node-gyp` to `7.0.0` [#8216](https://github.com/eclipse-theia/theia/pull/8216)
- [documentation] updated extension documentation [#8279](https://github.com/eclipse-theia/theia/pull/8279)
- [filesystem] added handling to prevent opening files which are too large [#8152](https://github.com/eclipse-theia/theia/pull/8152)
- [filesystem] added handling to prompt end-users before opening binary files [#8152](https://github.com/eclipse-theia/theia/pull/8152)
- [keymaps] updated keymaps to use monaco models [#8313](https://github.com/eclipse-theia/theia/pull/8313)
- [monaco] added handling to prevent opening dirty editors if `autoSave` is enabled [#8329](https://github.com/eclipse-theia/theia/pull/8329)
- [monaco] updated grammar collision logging [#8418](https://github.com/eclipse-theia/theia/pull/8418)
- [monaco] upgraded to monaco `0.20.0` [#8010](https://github.com/eclipse-theia/theia/pull/8010)
- [navigator] added `badge` count for dirty editors in the `explorer` [#8316](https://github.com/eclipse-theia/theia/pull/8316)
- [navigator] updated `open` command to only be enabled for files [#8228](https://github.com/eclipse-theia/theia/pull/8228)
- [navigator] updated duplicate keybinding for opening the preferences widget [#8256](https://github.com/eclipse-theia/theia/pull/8256)
- [output] exposed `preserveFocus` to `OutputChannel#show` to reveal but not activate the widget [#8243](https://github.com/eclipse-theia/theia/pull/8243)
- [output] fixed editor resizing issue [#8362](https://github.com/eclipse-theia/theia/pull/8362)
- [plugin] added handling to prevent activating plugins eagerly on unsupported events [#8396](https://github.com/eclipse-theia/theia/pull/8396)
- [plugin] added support for `ResourceLabelFormatter` API [#8187](https://github.com/eclipse-theia/theia/pull/8187)
- [plugin] added support for `vscode.workspace.fs` API [#7908](https://github.com/eclipse-theia/theia/pull/7908)
- [plugin] fixed `local-dir` path resolution [#8385](https://github.com/eclipse-theia/theia/pull/8385)
- [plugin] marked `onFileSystem` event as supported [#8320](https://github.com/eclipse-theia/theia/pull/8320)
- [preferences] added input field validation for numbers [#8264](https://github.com/eclipse-theia/theia/pull/8264)
- [preferences] removed hardcoded constants [#8313](https://github.com/eclipse-theia/theia/pull/8313)
- [scm] added `collapse-all` command and toolbar item [#8247](https://github.com/eclipse-theia/theia/pull/8247)
- [scm] added `badge` count for the `scm-view` [#8156](https://github.com/eclipse-theia/theia/pull/8156)
- [security] fixed usage of `stylesheet.innerHTML` [#8397](https://github.com/eclipse-theia/theia/pull/8397)
- [security] updated version range of `decompress` to fix the known [security vulnerability](https://snyk.io/vuln/SNYK-JS-DECOMPRESS-557358) [#8924](https://github.com/eclipse-theia/theia/pull/8294)
  - Note: the updated dependency may have a [performance impact](https://github.com/eclipse-theia/theia/pull/7715#issuecomment-667434288) on the deployment of plugins.
- [task] removed superfluous notifications when tasks are started / ended [#8331](https://github.com/eclipse-theia/theia/pull/8331)
- [tests] added api integration tests for `scm` [#8231](https://github.com/eclipse-theia/theia/pull/8231)
<a name="1_5_0_electron_main_extension"></a>
- [[electron]](#1_5_0_electron_main_extension) Electron applications can now be configured/extended through `inversify`. Added new `electronMain` extension points to provide inversify container modules. [#8076](https://github.com/eclipse-theia/theia/pull/8076)

<a name="breaking_changes_1.5.0">[Breaking Changes:](#breaking_changes_1.5.0)</a>

- [core] removed `KeybindingRegistry#getScopedKeybindingsForCommand` [#8283](https://github.com/eclipse-theia/theia/pull/8283)
- [application-package] removed `isOutdated` from `ExtensionPackage` [#8295](https://github.com/eclipse-theia/theia/pull/8295)
- [application-package] removed `getLatestVersion` from `ExtensionPackage` [#8295](https://github.com/eclipse-theia/theia/pull/8295)
- [application-package] removed `getVersionRange` from `ExtensionPackage` [#8295](https://github.com/eclipse-theia/theia/pull/8295)
- [application-package] removed `resolveVersionRange` from `ExtensionPackage` [#8295](https://github.com/eclipse-theia/theia/pull/8295)
- [output] `OutputWidget#setInput` has been removed. The _Output_ view automatically shows the channel when calling `OutputChannel#show`. Moved the `OutputCommands` namespace from the `output-contribution` to its dedicated `output-commands` module to overcome a DI cycle. [#8243](https://github.com/eclipse-theia/theia/pull/8243)
- [example-app] updated `yarn.lock` so that the latest version of `vscode-ripgrep` is used (`v1.8.0`). This way we can benefit from the recently added support for it using proxy settings when fetching the platform-specific `ripgrep` executable, after npm package install. This should make it a lot easier to build our example application in corporate settings, behind a firewall. [#8280](https://github.com/eclipse-theia/theia/pull/8280)
  - Note to downstream IDE designers: this change will not have an effect beyond the example application of the repository. If it's desirable for your product to have the latest `vscode-ripgrep`, you should do similarly in your own `yarn.lock`.
<a name="1.5.0_deprecate_file_system"></a>
- [[filesystem]](#1.5.0_deprecate_file_system) `FileSystem` and `FileSystemWatcher` services are deprecated [#7908](https://github.com/eclipse-theia/theia/pull/7908)
  - On the backend there is no more `FileSystem` implementation. One has to use Node.js APIs instead.
  - On the frontend, the `FileService` should be used instead. It was ported from VS Code for compatibility with VS Code extensions.
  - On the frontend, the `EnvVariableServer` should be used instead to access the current user home and available drives.
<a name="1.5.0_userstorage_as_fs_provider"></a>
- [[userstorage]](#1.5.0_userstorage_as_fs_provider) `UserStorageService` was replaced by the user data fs provider [#7908](https://github.com/eclipse-theia/theia/pull/7908)
<a name="1.5.0_webview_resource_streaming"></a>
- [[webview]](#1.5.0_webview_resource_streaming) webview resources are streamed instead of loading one by one the entire content and blocking the web socket [#8359](https://github.com/eclipse-theia/theia/pull/8359)
  - Consequently, `WebviewResourceLoader` is removed. One should change `DiskFileSystemProvider` to customize resource loading instead.
<a name="1.5.0_root_user_storage_uri"></a>
- [[user-storage]](#1.5.0_root_user_storage_uri) settings URI must start with `/user` root to satisfy expectations of `FileService` [#8313](https://github.com/eclipse-theia/theia/pull/8313)
  - If you implement a custom user storage make sure to check old relative locations, otherwise it can cause user data loss.
<a name="1_5_0_electron_window_options_ipc"></a>
- [[electron]](#1_5_0_electron_window_options_ipc) Removed the `set-window-options` and `get-persisted-window-options-additions` Electron IPC handlers from the Electron Main process.
<a name="1.5.0_non_blocking_bulk_edit"></a>
- [[monaco]](#1.5.0_non_blocking_bulk_edit) `MonacoWorkspace.applyBulkEdit` does not open any editors anymore to avoid blocking [#8329](https://github.com/eclipse-theia/theia/pull/8329)
  - Consequently, it does not accept editor opener options, and `MonacoWorkspace.openEditors` and `MonacoWorkspace.toTextEditWithEditor` are removed.
<a name="1.5.0_declarative_default_themes"></a>
- [[theming]](#1.5.0_declarative_default_themes) Default color and icon themes should be declared in the application `package.json`. [#8381](https://github.com/eclipse-theia/theia/pull/8381)

  ```json
  "theia": {
    "frontend": {
      "config": {
        "defaultTheme": "light",
        "defaultIconTheme": "vs-seti"
      }
    }
  },
  ```
  - Consequently, `ThemeService` and `IconThemeService` don't allow to change the default color or icon theme anymore.
<a name="1_5_0_drop_node_10_support"></a>
- [[repo]](#1_5_0_drop_node_10_support) support for `Node 10` is dropped. [#8290](https://github.com/eclipse-theia/theia/pull/8290)
  - From now on, Node.js `12.x` is required when building.\
   The recommended minimum version is aligned with `electron` (Node.js `12.14.1`).

## v1.4.0 - 30/07/2020

- [core] added support for Node.js `12.x` [#7968](https://github.com/eclipse-theia/theia/pull/7968)
  - From now on, you can use Node.js `12.x` to build Theia from sources. The recommended minimum version is aligned with `electron` (Node.js `12.14.1`).
  - Support for Node.js `10.x` will be dropped in one of the forthcoming releases.
- [core] fixed handling of environment variables on Windows [#7973](https://github.com/eclipse-theia/theia/pull/7973)
- [core] fixed issue when selecting a tree node after performing a manual scroll [#8154](https://github.com/eclipse-theia/theia/pull/8154)
- [debug] added a `select and run` debug statusbar item [#8134](https://github.com/eclipse-theia/theia/pull/8134)
- [debug] added handling to perform `save` when starting a debug session [#8115](https://github.com/eclipse-theia/theia/pull/8115)
- [debug] addressed an issue not awaiting the result of the debug handler [#8117](https://github.com/eclipse-theia/theia/pull/8117)
- [editor] added handling to perform a `save all` when turning `auto-save` on [#8163](https://github.com/eclipse-theia/theia/pull/8163)
- [editor] improved extensibility of menu and keybinding contributions [#8188](https://github.com/eclipse-theia/theia/pull/8188)
- [git] fixed the opening of deleted files [#8107](https://github.com/eclipse-theia/theia/pull/8107)
- [markers] added `problems.autoReveal` preference to control sync between editors and the problem-view [#8172](https://github.com/eclipse-theia/theia/pull/8172)
- [monaco] improved extensibility of menu and keybinding contributions [#8188](https://github.com/eclipse-theia/theia/pull/8188)
- [monaco] normalized base pattern path to support different operating systems [#8268](https://github.com/eclipse-theia/theia/pull/8268)
- [monaco] removed unused dependencies [#8109](https://github.com/eclipse-theia/theia/pull/8109)
- [navigator] added `copy relative path` to the explorer context-menu and command palette [#8092](https://github.com/eclipse-theia/theia/pull/8092)
- [output] added `copy all` context-menu item for the output-view [#8057](https://github.com/eclipse-theia/theia/pull/8057)
- [plugin] added command `copyRelativeFilePath` [#8092](https://github.com/eclipse-theia/theia/pull/8092)
- [plugin] added support for `resolveDebugConfigurationWithSubstitutedVariables` API [#8253](https://github.com/eclipse-theia/theia/pull/8253)
- [plugin] added support for `vscode.workspace.findTextInFiles` API [#7868](https://github.com/eclipse-theia/theia/pull/7868)
- [plugin] added support for theme icons [#8267](https://github.com/eclipse-theia/theia/pull/8267)
- [plugin] fixed focused handling of webviews when dismissing the quick-open widget [#8137](https://github.com/eclipse-theia/theia/pull/8137)
- [plugin] fixed the display of file-icons with a dot in the name [#7680](https://github.com/eclipse-theia/theia/pull/7680)
- [plugin] fixed the modal dialog max size and text-wrapping [#8080](https://github.com/eclipse-theia/theia/pull/8080)
- [plugin] improved handling of the plugin host activation exceptions [#8103](https://github.com/eclipse-theia/theia/pull/8103)
- [plugin] removed unnecessary slash at the end of the `pluginPath` [#8045](https://github.com/eclipse-theia/theia/pull/8045)
- [plugin] updated logic to allow `Command` type in statusbar items [#8253](https://github.com/eclipse-theia/theia/pull/8253)
- [plugin] updated logic to allow `vsix` without publishers to be loaded [#8196](https://github.com/eclipse-theia/theia/pull/8196)
- [repo] removed unused resolution for `vscode-json-languageserver` [#8132](https://github.com/eclipse-theia/theia/pull/8132)
- [search-in-workspace] improved search behavior to only trigger search on input change or <kbd>ENTER</kbd> [#8229](https://github.com/eclipse-theia/theia/pull/8229)
- [task] fixed an issue where `onDidEndTaskProcess` was not fired for plugins when task ended [#8141](https://github.com/eclipse-theia/theia/pull/8141)
- [task] introduced a token to scope contributed tasks [#7996](https://github.com/eclipse-theia/theia/pull/7996)
- [terminal] fixed xterm issue causing an extraneous 'cursor-like' overlay element [#8204](https://github.com/eclipse-theia/theia/pull/8204)
- [test] improved api-tests by increasing timeout so plugin views can be properly prepared [#8151](https://github.com/eclipse-theia/theia/pull/8151)
- [test] updated api-tests to use tmp directory for user data [#8151](https://github.com/eclipse-theia/theia/pull/8151)
- [vsx-registry] fixed the `licenseUrl` link for builtin and installed extensions [#8095](https://github.com/eclipse-theia/theia/pull/8095)
- [vsx-registry] improved styling of the detailed extension view [#8086](https://github.com/eclipse-theia/theia/pull/8086)
- [workspace] improved extensibility of menu and keybinding contributions [#8188](https://github.com/eclipse-theia/theia/pull/8188)

<a name="breaking_changes_1.4.0">[Breaking Changes:](#breaking_changes_1.4.0)</a>

- [core] fixed typo (`matchKeybiding` to `matchKeybinding`) in `KeybindingRegistry` [#8193](https://github.com/eclipse-theia/theia/pull/8193)
- [preferences] removed unused variable `PreferencesWidget.COMMAND_LABEL` [#8249](https://github.com/eclipse-theia/theia/pull/8249)
- [preferences] renamed file `preference-contribution.ts` to `preferences-contribution.ts` [#8237](https://github.com/eclipse-theia/theia/pull/8237)
- [terminal] fixed typo (`rezize` to `resize`) in `TerminalWidget` [#8193](https://github.com/eclipse-theia/theia/pull/8193)
<a name="1_4_0_replace_json"></a>
- [[json]](#1_4_0_replace_json) replaced `@theia/json` Theia extension with `vscode.json-language-features` VS Code extension [#8112](https://github.com/eclipse-theia/theia/pull/8112)
  - You can register JSON validations at application startup by implementing `JsonSchemaContribution` Theia contribution point.
  - Alternatively you can provide JSON validations using VS Code [contributes.jsonValidation](https://code.visualstudio.com/api/references/contribution-points#contributes.jsonValidation) contribution point.
<a name="1_4_0_absolute_user_storage_uri"></a>
- [[user-storage]](#1_4_0_absolute_user_storage_uri) settings URI must be an absolute to satisfy expectations of `vscode.json-language-features` [#8112](https://github.com/eclipse-theia/theia/pull/8112)
  - If you implement a custom user storage make sure to check old relative locations, otherwise it can cause user data loss.
<a name="1_4_0_deprecate_languages"></a>
- [[languages]](#1_4_0_deprecate_languages) `@theia/languages` extension is deprecated, use VS Code extensions to provide language smartness:
  https://code.visualstudio.com/api/language-extensions/language-server-extension-guide [#8112](https://github.com/eclipse-theia/theia/pull/8112)

## v1.3.0 - 25/06/2020

- [cli] updated the download script to warn about mandatory `theiaPlugins` field [#8058](https://github.com/eclipse-theia/theia/pull/8058)
- [core] added `copy path` command [#7934](https://github.com/eclipse-theia/theia/pull/7934)
- [core] added missing `vscode-languageserver-protocol` dependency [#8036](https://github.com/eclipse-theia/theia/pull/8036)
- [core] adds support for ordering submenus [#7963](https://github.com/eclipse-theia/theia/pull/7963)
- [core] implemented a context-menu for `input` and `textArea` fields [#7943](https://github.com/eclipse-theia/theia/pull/7943)
- [core] improved sub-classing of `messaging` [#8008](https://github.com/eclipse-theia/theia/pull/8008)
- [core] updated `react` and `react-dom` to v16.8 [#7883](https://github.com/eclipse-theia/theia/pull/7883)
- [debug] added support for inline variable values [#7921](https://github.com/eclipse-theia/theia/pull/7921)
- [editor] updated the default tokenization length [#8027](https://github.com/eclipse-theia/theia/pull/8027)
- [filesystem] exposed `nsfw` to downstream `NsfwFilesystemWatcher` [#7465](https://github.com/eclipse-theia/theia/pull/7465)
- [filesystem] fixed file filter issue in the `FileDialog` [#8073](https://github.com/eclipse-theia/theia/pull/8073)
- [filesystem] improved `isInSync` method [#8044](https://github.com/eclipse-theia/theia/pull/8044)
- [filesystem] updated minimatch when ignoring to include folders starting with a dot [#8074](https://github.com/eclipse-theia/theia/pull/8074)
- [markers] added the `clear-all` command for the problems-view [#8002](https://github.com/eclipse-theia/theia/pull/8002)
- [monaco] added support for `vscode-builtin-css-language-features` [#7972](https://github.com/eclipse-theia/theia/pull/7972)
- [monaco] added support for `vscode-builtin-html-language-features` [#7972](https://github.com/eclipse-theia/theia/pull/7972)
- [monaco] exposed `toOpenModel` method [#8024](https://github.com/eclipse-theia/theia/pull/8024)
- [output] added scroll-lock to the output view [#7570](https://github.com/eclipse-theia/theia/pull/7570)
- [output] added support for special output URI characters [#8046](https://github.com/eclipse-theia/theia/pull/8046)
- [plugin] added command `copyFilePath` [#7934](https://github.com/eclipse-theia/theia/pull/7934)
- [plugin] added support for `env.uiKind` API [#8038](https://github.com/eclipse-theia/theia/pull/8038)
- [plugin] added support for `workbench.view.explorer` command [#7965](https://github.com/eclipse-theia/theia/pull/7965)
- [plugin] added support for the `Task2` class [#8000](https://github.com/eclipse-theia/theia/pull/8000)
- [plugin] added the registration of view-containers in the `open view` menu [#8034](https://github.com/eclipse-theia/theia/pull/8034)
- [plugin] fixed handling to not fail if a command returns a non-serializable result or error [#7957](https://github.com/eclipse-theia/theia/pull/7957)
- [plugin] implemented the pseudo terminal plugin API [#7925](https://github.com/eclipse-theia/theia/pull/7925)
- [plugin] improved activation of views to ensure they are ready before activated [#7957](https://github.com/eclipse-theia/theia/pull/7957)
- [preferences] fixed modified scope label for updated preferences [#8025](https://github.com/eclipse-theia/theia/pull/8025)
- [preferences] improved the statefulness of the preferences when switching scopes [#7936](https://github.com/eclipse-theia/theia/pull/7936)
- [preview] added sanitization of the markdown text for security purposes [#7971](https://github.com/eclipse-theia/theia/pull/7971)
- [scm] added multi-select support for the 'source control manager' view [#7900](https://github.com/eclipse-theia/theia/pull/7900)
- [scm] fixed the `scm` tree to sort results correctly [#8048](https://github.com/eclipse-theia/theia/pull/8048)
- [search-in-workspace] fixed incorrect or duplicate search results [#7990](https://github.com/eclipse-theia/theia/pull/7990)
- [task] added `detail` property to the task configuration schema [#8000](https://github.com/eclipse-theia/theia/pull/8000)
- [task] added support to update user-level tasks [#7928](https://github.com/eclipse-theia/theia/pull/7928)
- [task] fixed error due to incorrect `RevealKind` and `PanelKind` enums [#7982](https://github.com/eclipse-theia/theia/pull/7982)
- [task] included global tasks in the 'configure tasks' menu [#7929](https://github.com/eclipse-theia/theia/pull/7929)
- [vsx-registry] adjusted the width of the search input [#7984](https://github.com/eclipse-theia/theia/pull/7984)
- [vsx-registry] included 'extensions-view' in the default layout [#7944](https://github.com/eclipse-theia/theia/pull/7944)
- [workspace] added logic preventing arbitrary files from being opened as a workspace [#7922](https://github.com/eclipse-theia/theia/pull/7922)

Breaking Changes:

- [task] Widened the scope of some methods in TaskManager and TaskConfigurations from string to TaskConfigurationScope. This is only breaking for extenders, not callers. [#7928](https://github.com/eclipse-theia/theia/pull/7928)
- [shell] updated `ApplicationShell.TrackableWidgetProvider.getTrackableWidgets` to be synchronous in order to register child widgets in the same tick [#7957](https://github.com/eclipse-theia/theia/pull/7957)
  - use `ApplicationShell.TrackableWidgetProvider.onDidChangeTrackableWidgets` if child widgets are added asynchronously

## v1.2.0 - 28/05/2020

- [application-manager] added ability for clients to add `windowOptions` using an IPC-Event [#7803](https://github.com/eclipse-theia/theia/pull/7803)
- [application-package] added ability for clients to change the default `windowOptions` [#7803](https://github.com/eclipse-theia/theia/pull/7803)
- [cli] improved the handling of the `download:plugins` script [#7747](https://github.com/eclipse-theia/theia/pull/7747)
- [cli] support proxy settings in the `download:plugins` script [#7747](https://github.com/eclipse-theia/theia/pull/7747)
- [cli] updated the `download:plugins` script to display errors at the end of the script [#7881](https://github.com/eclipse-theia/theia/pull/7881)
- [core] added handling of nested default values in preference proxies [#6921](https://github.com/eclipse-theia/theia/pull/6921)
- [core] added handling to properly cleanup `toDisposeOnActiveChanged` [#7894](https://github.com/eclipse-theia/theia/pull/7894)
- [core] added handling to respect the keybinding scope and registration order during evaluation [#7839](https://github.com/eclipse-theia/theia/pull/7839)
- [core] added support for `next/previous` tab group commands [#7707](https://github.com/eclipse-theia/theia/pull/7707)
- [core] added support for `next/previous` tab in group commands [#7707](https://github.com/eclipse-theia/theia/pull/7707)
- [core] fixed collapsed state when restoring view-container parts [#7893](https://github.com/eclipse-theia/theia/pull/7893)
- [dependency] fixed issue with `momentjs` dependency [#7727](https://github.com/eclipse-theia/theia/pull/7727)
- [dependency] upgraded `decompress` to `4.2.0` [#7715](https://github.com/eclipse-theia/theia/pull/7715)
- [dependency] upgraded `uuid` to `8.0.0` [#7749](https://github.com/eclipse-theia/theia/pull/7749)
- [dependency] upgraded to TypeScript `3.9.2` [#7807](https://github.com/eclipse-theia/theia/pull/7807)
- [editor-preview] improved the editor-preview height [#6921](https://github.com/eclipse-theia/theia/pull/6921)
- [editor] improved focus handling of editors to default to the last visible editor [#7707](https://github.com/eclipse-theia/theia/pull/7707)
- [electron] fixed rendering of the electron context-menu [#7735](https://github.com/eclipse-theia/theia/pull/7735)
- [electron] fixed resolution of hostname placeholder [#7823](https://github.com/eclipse-theia/theia/pull/7823)
- [electron] fixed the rendering of webviews on electron [#7847](https://github.com/eclipse-theia/theia/pull/7847)
- [electron] improved rendering of electron context-menus to hide disabled menu items [#7869](https://github.com/eclipse-theia/theia/pull/7869)
- [electron] removed global shortcuts if the electron window is not focused [#7817](https://github.com/eclipse-theia/theia/pull/7817)
- [file-search] improved the handling of the quick-file open [#7846](https://github.com/eclipse-theia/theia/pull/7846)
- [filesystem] fixed issue where file-icons were not properly aligned when the file name is truncated [#7730](https://github.com/eclipse-theia/theia/pull/7730)
- [getting-started] updated the documentation urls [#7855](https://github.com/eclipse-theia/theia/pull/7855)
- [git] added handling to set upstream remote branch when pushing [#7866](https://github.com/eclipse-theia/theia/pull/7866)
- [git] fixed issue causing no repositories to be found [#7870](https://github.com/eclipse-theia/theia/pull/7870)
- [monaco] added handling of internal open calls with the `OpenerService` [#6921](https://github.com/eclipse-theia/theia/pull/6921)
- [monaco] added handling to only focus the editor if it is revealed [#7903](https://github.com/eclipse-theia/theia/pull/7903)
- [monaco] fixed issue to detect languages on mime association changes [#7805](https://github.com/eclipse-theia/theia/pull/7805)
- [monaco] fixed the border color for the find widget [#7835](https://github.com/eclipse-theia/theia/pull/7835)
- [navigator] added handling to select newly created files/folders in the explorer [#7762](https://github.com/eclipse-theia/theia/pull/7762)
- [output] improved the output-view display [#7827](https://github.com/eclipse-theia/theia/pull/7827)
- [plugin] added handling of quick pick/input cancellations [#6921](https://github.com/eclipse-theia/theia/pull/6921)
- [plugin] added support for `CompletionItem.range` shape [#7820](https://github.com/eclipse-theia/theia/pull/7820)
- [plugin] added support for `explorer.newFolder` command [#7843](https://github.com/eclipse-theia/theia/pull/7843)
- [plugin] added support for `workbench.action.revertAndCloseActiveEditor` API [#7702](https://github.com/eclipse-theia/theia/pull/7702)
- [plugin] added support for the `vscode.workspace.fs` APIs for registered filesystem providers only (not yet real file system) [#7824](https://github.com/eclipse-theia/theia/pull/7824)
- [plugin] added support for the `workbench.action.openRecent` command [#7812](https://github.com/eclipse-theia/theia/pull/7812)
- [plugin] added support for the `workspace` API `onDidCreateFiles` [#7718](https://github.com/eclipse-theia/theia/pull/7718)
- [plugin] added support for the `workspace` API `onDidDeleteFiles` [#7718](https://github.com/eclipse-theia/theia/pull/7718)
- [plugin] added support for the `workspace` API `onDidRenameFiles` [#7718](https://github.com/eclipse-theia/theia/pull/7718)
- [plugin] added support for the `workspace` API `onWillCreateFiles` [#7718](https://github.com/eclipse-theia/theia/pull/7718)
- [plugin] added support for the `workspace` API `onWillDeleteFiles` [#7718](https://github.com/eclipse-theia/theia/pull/7718)
- [plugin] added support for the `workspace` API `onWillRenameFiles` [#7718](https://github.com/eclipse-theia/theia/pull/7718)
- [plugin] added support for the command `terminal.kill` [#7906](https://github.com/eclipse-theia/theia/pull/7906)
- [plugin] added support for the command `terminalSendSequence` [#7906](https://github.com/eclipse-theia/theia/pull/7906)
- [plugin] added support for when-closures for the quick-view palette [#6921](https://github.com/eclipse-theia/theia/pull/6921)
- [plugin] fixed `registerCommand` API incompatibilities [#7296](https://github.com/eclipse-theia/theia/pull/7296)
- [plugin] fixed issue where contributed views had blank square icons on reload [#7756](https://github.com/eclipse-theia/theia/pull/7756)
- [plugin] fixed leaking filesystem resource [#6921](https://github.com/eclipse-theia/theia/pull/6921)
- [plugin] fixed potential activation deadlock [#6921](https://github.com/eclipse-theia/theia/pull/6921)
- [plugin] fixed synching of visible and active editors [#6921](https://github.com/eclipse-theia/theia/pull/6921)
- [plugin] fixed the computing of external icon urls [#6921](https://github.com/eclipse-theia/theia/pull/6921)
- [plugin] fixed the tree-view reveal [#6921](https://github.com/eclipse-theia/theia/pull/6921)
- [plugin] fixed the update of quick-pick items [#6921](https://github.com/eclipse-theia/theia/pull/6921)
- [plugin] updated handling of plugin folder paths [#7799](https://github.com/eclipse-theia/theia/pull/7799)
- [plugin] updated handling to not require non-existing plugin main [#7852](https://github.com/eclipse-theia/theia/pull/7852)
- [preferences] improved the `preferences` widget user-interface [#7105](https://github.com/eclipse-theia/theia/pull/7105)
- [scm] added `scm.defaultViewMode` preference to control the display of the `scm` widget [#7717](https://github.com/eclipse-theia/theia/pull/7717)
- [scm] added handling to refresh widget on activation [#7880](https://github.com/eclipse-theia/theia/pull/7880)
- [scm] added support for displaying the `scm` view as a tree [#7505](https://github.com/eclipse-theia/theia/pull/7505)
- [scm] fixed missing commit and amend functionality when opening a new workspace [#7769](https://github.com/eclipse-theia/theia/pull/7769)
- [scm] fixed restoring last commit message [#7818](https://github.com/eclipse-theia/theia/pull/7818)
- [task] added support for user-level task configurations [#7620](https://github.com/eclipse-theia/theia/pull/7620)
- [task] fixed task execution on macOS with `zsh` [#7889](https://github.com/eclipse-theia/theia/pull/7889)
- [task] improved order of task configurations [#7696](https://github.com/eclipse-theia/theia/pull/7696)
- [task] updated the when-closure when executing `Run Last Task` [#7890](https://github.com/eclipse-theia/theia/pull/7890)
- [terminal] added handling to detach the `TerminalSearchWidget` before disposing the `TerminalWidget` [#7882](https://github.com/eclipse-theia/theia/pull/7882)
- [workspace] added the `workspaceState` when-closure context [#7846](https://github.com/eclipse-theia/theia/pull/7846)

Breaking changes:

- [application-package] moved `disallowReloadKeybinding` under the `electron` subsection [#7803](https://github.com/eclipse-theia/theia/pull/7803)
- [core] `KeybindingRegistry` registers a new keybinding with a higher priority than previously in the same scope [#7839](https://github.com/eclipse-theia/theia/pull/7839)
- [scm] added support for `tree view mode` in the `scm` view [#7505](https://github.com/eclipse-theia/theia/pull/7505)
  - classes that currently extend `ScmWidget` will likely require changes.
- [task] removed `taskId` from `TaskTerminalWidgetOpenerOptions` [#7765](https://github.com/eclipse-theia/theia/pull/7765)

## v1.1.0 - 30/04/2020

- [application-manager] added meta tag to enable fullscreen on iOS devices [#7663](https://github.com/eclipse-theia/theia/pull/7663)
- [application-package] added warning if an unknown target is provided [#7578](https://github.com/eclipse-theia/theia/pull/7578)
- [application-package] updated default application name from 'Theia' to 'Eclipse Theia' [#7656](https://github.com/eclipse-theia/theia/pull/7656)
- [cli] improved the `download:plugins` script including performance and error handling [#7677](https://github.com/eclipse-theia/theia/pull/7677)
- [cli] updated the `download:plugins` script to include colors for better visibility [#7648](https://github.com/eclipse-theia/theia/pull/7648)
- [core] added functionality to prevent pasting into the active editor when closing a tab with a middle mouse click [#7565](https://github.com/eclipse-theia/theia/pull/7565)
- [core] added support to allow providing a custom node for ReactWidget [#7422](https://github.com/eclipse-theia/theia/pull/7422)
- [core] aligned max listeners check with VS Code expectations [#7508](https://github.com/eclipse-theia/theia/pull/7508)
- [core] fixed 'recently used commands' to be only added when triggered by the quick-command palette [#7552](https://github.com/eclipse-theia/theia/pull/7552)
- [core] fixed 'recently used commands': [#7562](https://github.com/eclipse-theia/theia/pull/7562)
  - added sorting of commands based on their human-readable label
  - fixed issue where recently used commands where not correctly separated by a border and groupName
- [core] fixed issue where menu args where unnecessarily wrapped into another array [#7622](https://github.com/eclipse-theia/theia/pull/7622)
- [core] fixed leaking `DisposableCollection.onDispose` event [#7508](https://github.com/eclipse-theia/theia/pull/7508)
- [core] fixed release of leaking editor from quick-open and goto references [#7508](https://github.com/eclipse-theia/theia/pull/7508)
- [core] improved display for the 'Remove Folder from Workspace` dialog [#7449](https://github.com/eclipse-theia/theia/pull/7449)
- [core] upgraded `nsfw` to 1.2.9 [#7535](https://github.com/eclipse-theia/theia/pull/7535)
- [core] upgraded `vscode-uri` to version ^2.1.1 [#7506](https://github.com/eclipse-theia/theia/pull/7506)
- [core] upgraded to LSP 6.0.0 [#7149](https://github.com/eclipse-theia/theia/pull/7149)
- [documentation] updated developing documentation for Windows [#7640](https://github.com/eclipse-theia/theia/pull/7640)
- [editor] updated binding of `EditorCommandContribution` and `EditorMenuContribution` [#7569](https://github.com/eclipse-theia/theia/pull/7569)
- [electron] added functionality to fork the backend unless `--no-cluster` flag is specified [#7386](https://github.com/eclipse-theia/theia/pull/7386)
- [electron] added functionality to pass arguments to the backend process [#7386](https://github.com/eclipse-theia/theia/pull/7386)
- [electron] fixed setting `process.versions.electron` for sub-processes [#7386](https://github.com/eclipse-theia/theia/pull/7386)
- [git] disabled the 'Git Initialize Repository' action when no workspace is opened [#7492](https://github.com/eclipse-theia/theia/pull/7492)
- [git] updated `successExitCodes` and `expectedErrors` to arrays to fix serialization [#7627](https://github.com/eclipse-theia/theia/pull/7627)
- [keymaps] updated the keybindings-widget sorting, and added category as part of the label if applicable [#7532](https://github.com/eclipse-theia/theia/pull/7532)
- [monaco] added handling to respect `editor.maxTokenizationLineLength` preference [#7618](https://github.com/eclipse-theia/theia/pull/7618)
- [monaco] fixed incorrect `isChord` call [#7468](https://github.com/eclipse-theia/theia/pull/7468)
- [monaco] reworked Monaco commands to align with VS Code [#7539](https://github.com/eclipse-theia/theia/pull/7539)
- [monaco] upgraded `onigasm` to version ^2.2.0 fixing syntax-highlighting [#7610](https://github.com/eclipse-theia/theia/pull/7610)
- [monaco] upgraded to Monaco version 0.19.3 [#7149](https://github.com/eclipse-theia/theia/pull/7149)
- [outline-view] fixed keybinding collision between toggling the outline-view and performing 'format document' on Linux [#7694](https://github.com/eclipse-theia/theia/pull/7694)
- [output] added `Select All` in the output-view [#7523](https://github.com/eclipse-theia/theia/pull/7523)
- [output] added optional argument `severity` to `OutputChannel.appendLine` method for coloring [#7549](https://github.com/eclipse-theia/theia/pull/7549)
- [plugin-ext] fixed custom icon themes and icons for Electron [#7583](https://github.com/eclipse-theia/theia/pull/7583)
- [plugin] added ability to override built-in commands [#7592](https://github.com/eclipse-theia/theia/pull/7592)
- [plugin] added additional `vscode.execute...` commands [#7563](https://github.com/eclipse-theia/theia/pull/7563)
- [plugin] added functionality preventing <kbd>F1</kbd> and <kbd>ctrlcmd</kbd>+<kbd>p</kbd> hotkeys in a webview iframe [#7496](https://github.com/eclipse-theia/theia/pull/7496)
- [plugin] added functionality which makes `env.appName` reuse the value of `applicationName` (as defined in the `package.json`) [#7642](https://github.com/eclipse-theia/theia/pull/7642)
- [plugin] added sorting of plugin in the plugins-view [#7601](https://github.com/eclipse-theia/theia/pull/7601)
- [plugin] added support for `SelectionRange` and `SelectionRangeProvider` VS Code API [#7534](https://github.com/eclipse-theia/theia/pull/7534)
- [plugin] aligned message-service behavior with VS Code [#7500](https://github.com/eclipse-theia/theia/pull/7500)
- [plugin] fixed error handling when selecting an invalid node for hosted-plugins [#7636](https://github.com/eclipse-theia/theia/pull/7636)
- [plugin] fixed incompatibility issues with `SaveFileDialog` [#7461](https://github.com/eclipse-theia/theia/pull/7461)
- [plugin] fixed late textmate-grammar activation [#7544](https://github.com/eclipse-theia/theia/pull/7544)
- [plugin] fixed overriding of built-in Monaco commands [#7539](https://github.com/eclipse-theia/theia/pull/7539)
- [plugin] fixed parsing of DAP messages to match VS Code API [#7517](https://github.com/eclipse-theia/theia/pull/7517)
- [plugin] removed filtering of duplicate tasks [#7676](https://github.com/eclipse-theia/theia/pull/7676)
- [plugin] removed registration of commands provided by Monaco [#7592](https://github.com/eclipse-theia/theia/pull/7592)
- [plugin] removed unused injections of `ResourceProvider` [#7595](https://github.com/eclipse-theia/theia/pull/7595)
- [plugin] updated the VS Code API version to 1.44.0 [#7564](https://github.com/eclipse-theia/theia/pull/7564)
- [preferences] added functionality which defers change events in the same tick [#7676](https://github.com/eclipse-theia/theia/pull/7676)
- [scm] fixed `overviewRuler` and `minimap` theming for SCM decorations [#7330](https://github.com/eclipse-theia/theia/pull/7330)
- [task] added functionality which saves the scope as part of the `TaskService.lastTask` [#7553](https://github.com/eclipse-theia/theia/pull/7553)
- [task] added functionality which sets focus to the terminal that the attached task is running from [#7452](https://github.com/eclipse-theia/theia/pull/7452)
- [task] added support for `presentation.clear` in the task configuration schema [#7454](https://github.com/eclipse-theia/theia/pull/7454)
- [task] added support for `presentation.echo` in the task configuration schema [#7503](https://github.com/eclipse-theia/theia/pull/7503)
- [task] added support for `presentation.panel` in the task configuration schema [#7260](https://github.com/eclipse-theia/theia/pull/7260)
- [task] added support for `presentation.showReuseMessage` in the task configuration schema [#7454](https://github.com/eclipse-theia/theia/pull/7454)
- [task] added support for modifying existing problem matchers [#7455](https://github.com/eclipse-theia/theia/pull/7455)
- [task] added support for user-defined labels for detected tasks [#7574](https://github.com/eclipse-theia/theia/pull/7574)
- [task] fixed `presentation.reveal` and `presentation.focus` for detected tasks [#7548](https://github.com/eclipse-theia/theia/pull/7548)
- [task] fixed issue to only allow running selected texts in a user terminal [#7453](https://github.com/eclipse-theia/theia/pull/7453)
- [terminal] added new terminal preferences [#7660](https://github.com/eclipse-theia/theia/pull/7660)
  - `terminal.integrated.shell.linux`
  - `terminal.integrated.shell.osx`
  - `terminal.integrated.shell.windows`
  - `terminal.integrated.shellArgs.linux`
  - `terminal.integrated.shellArgs.osx`
  - `terminal.integrated.shellArgs.windows`
- [test] added API tests for the TypeScript language [#7265](https://github.com/eclipse-theia/theia/pull/7265)
- [test] fixed API tests on Windows [#7655](https://github.com/eclipse-theia/theia/pull/7655)
- [vsx-registry] fixed minor font-family inconsistency with the download count [#7380](https://github.com/eclipse-theia/theia/pull/7380)
- [vsx-registry] fixed rendering of rating and downloads if they have no value [#7380](https://github.com/eclipse-theia/theia/pull/7380)
- [vsx-registry] updated styling of extension information [#7439](https://github.com/eclipse-theia/theia/pull/7439)
- [workspace] added normalization of workspace root paths [#7598](https://github.com/eclipse-theia/theia/pull/7598)
- [workspace] fixed incorrect statusbar color when in a multi-root workspace without any root folders [#7688](https://github.com/eclipse-theia/theia/pull/7688)

Breaking changes:

- [core] `CommandRegistry.registerHandler` registers a new handler with a higher priority than previously [#7539](https://github.com/eclipse-theia/theia/pull/7539)
- [plugin] deprecated is now `PluginModel.packagePath` and `PluginModel.packageUri` should be used instead [#7583](https://github.com/eclipse-theia/theia/pull/7583)
- [plugin] removed `configStorage` argument from `PluginManager.registerPlugin` [#7265](https://github.com/eclipse-theia/theia/pull/7265)
  - use `PluginManager.configStorage` property instead. [#7265](https://github.com/eclipse-theia/theia/pull/7265)
- [process] `TerminalProcess` doesn't handle shell quoting, the shell process arguments must be prepared from the caller [#6836](https://github.com/eclipse-theia/theia/pull/6836)
  - Removed all methods related to shell escaping inside this class. You should use functions located in `@theia/process/lib/common/shell-quoting.ts`
  in order to process arguments for shells.
- [process/terminal] moved shell escaping utilities into `@theia/process/lib/common/shell-quoting` and `@theia/process/lib/common/shell-command-builder` for creating shell inputs [#6836](https://github.com/eclipse-theia/theia/pull/6836)

## v1.0.0 - 26/03/2020

- [core] added functionality to ensure that nodes are refreshed properly on tree expansion [#7400](https://github.com/eclipse-theia/theia/pull/7400)
- [core] added loading state for trees [#7249](https://github.com/eclipse-theia/theia/pull/7249)
- [core] added the ability to customize the layout of view-containers [#6655](https://github.com/eclipse-theia/theia/pull/6655)
- [core] added the ability to customize the stored state of view-containers [#6655](https://github.com/eclipse-theia/theia/pull/6655)
- [core] fixed keybindings for special numpad keys in editors [#7329](https://github.com/eclipse-theia/theia/pull/7329)
- [core] fixed missing progress events [#7314](https://github.com/eclipse-theia/theia/pull/7314)
- [core] updated 'close' commands to respect `widget.closable` property [#7278](https://github.com/eclipse-theia/theia/pull/7278)
- [core] updated `inputValidation` theming [#7351](https://github.com/eclipse-theia/theia/pull/7351)
- [core] updated command execution to always use `CommandService.execute` [#7326](https://github.com/eclipse-theia/theia/pull/7326)
- [debug] added functionality to lazily update of stack frames of all threads in all-stop mode [#7281](https://github.com/eclipse-theia/theia/pull/7281)
- [documentation] updated prerequisites to include `build-essential` [#7256](https://github.com/eclipse-theia/theia/pull/7256)
- [documentation] updated the readme of individual extensions to include additional information, and links to generated API docs [#7254](https://github.com/eclipse-theia/theia/pull/7254)
- [electron] updated token check to use `timingSafeEqual` [#7308](https://github.com/eclipse-theia/theia/pull/7308)
- [file-search] updated `ripgrep` to search files in hidden folders [#7333](https://github.com/eclipse-theia/theia/pull/7333)
- [git] fixed duplicate entries for 'Git History' on merge operations [#7188](https://github.com/eclipse-theia/theia/pull/7188)
- [markers] added foreground coloring of nodes in the `explorer` to reflect problem markers [#6863](https://github.com/eclipse-theia/theia/pull/6863)
- [markers] added sorting of diagnostic markers for a given resource [#7313](https://github.com/eclipse-theia/theia/pull/7313)
- [markers] updated format of diagnostic markers in the `problems-view` [#7344](https://github.com/eclipse-theia/theia/pull/7344)
- [messages] updated to disallow arbitrary HTML in message content [#7289](https://github.com/eclipse-theia/theia/pull/7289)
- [mini-browser] updated `MiniBrowserEndpoint.defaultHandler()` response for non mime-db files [#7356](https://github.com/eclipse-theia/theia/pull/7356)
- [navigator] added busy progress for the explorer [#7249](https://github.com/eclipse-theia/theia/pull/7249)
- [plugin] added `workbench.action.addRootFolder` command [#7350](https://github.com/eclipse-theia/theia/pull/7350)
- [plugin] added `workbench.action.openSettings` command [#7320](https://github.com/eclipse-theia/theia/pull/7320)
- [plugin] added frontend APIs to listen when plugins are initially loaded [#6655](https://github.com/eclipse-theia/theia/pull/6655)
- [plugin] added functionality to ensure that node-based debug adapters spawn the same node version as the framework [#7294](https://github.com/eclipse-theia/theia/pull/7294)
- [plugin] added support for User-defined plugins [#6655](https://github.com/eclipse-theia/theia/pull/6655)
- [plugin] added support for killing sub-threads run by shell scripts [#7391](https://github.com/eclipse-theia/theia/pull/7391)
- [plugin] added support for loading plugins from symbolic links [#7242](https://github.com/eclipse-theia/theia/pull/7242)
- [plugin] exposed frontend API to access loaded plugins metadata [#6655](https://github.com/eclipse-theia/theia/pull/6655)
- [plugin] fixed 'find all references' for the typescript built-in plugin [#7055](https://github.com/eclipse-theia/theia/pull/7055)
- [plugin] fixed `storagePath` to return `undefined` when necessary [#7394](https://github.com/eclipse-theia/theia/pull/7394)
- [plugin] fixed leaking plugins (codelens) [#7238](https://github.com/eclipse-theia/theia/pull/7238)
- [preferences] added a new preference to silence notifications [#7195](https://github.com/eclipse-theia/theia/pull/7195)
- [scm] fixed focus border for commit message textarea [#7340](https://github.com/eclipse-theia/theia/pull/7340)
- [terminal] added new `terminal.integrated.cursorBlinking` preference [#7284](https://github.com/eclipse-theia/theia/pull/7284)
- [terminal] added new `terminal.integrated.cursorStyle` preference [#7284](https://github.com/eclipse-theia/theia/pull/7284)
- [terminal] added new `terminal.integrated.cursorWidth` preference [#7284](https://github.com/eclipse-theia/theia/pull/7284)
- [terminal] added new `terminal.integrated.drawBoldTextInBrightColors` preference [#7284](https://github.com/eclipse-theia/theia/pull/7284)
- [terminal] added new `terminal.integrated.fastScrollSensitivity` preference [#7284](https://github.com/eclipse-theia/theia/pull/7284)
- [terminal] fixed `home`, `page-up`, `page-down` shortcuts [#7305](https://github.com/eclipse-theia/theia/pull/7305)
- [terminal] fixed color theming [#7325](https://github.com/eclipse-theia/theia/pull/7325)
- [terminal] upgraded `xterm` dependency [#7121](https://github.com/eclipse-theia/theia/pull/7121)
- [vsx-registry] added a new `vsx-registry` extension to manage plugins [#6655](https://github.com/eclipse-theia/theia/pull/6655)
- [workspace] fixed issue where `NEW_FILE` and `NEW_FOLDER` could not be triggered under certain conditions [#7302](https://github.com/eclipse-theia/theia/pull/7302)

Breaking changes:

- [debug] renamed `debuggingStaturBar` to `debuggingStatusBar` [#7409](https://github.com/eclipse-theia/theia/pull/7409)
- [plugin] renamed `CancelationTokenImpl` to `CancellationTokenImpl` [#7409](https://github.com/eclipse-theia/theia/pull/7409)
- [plugin] renamed `VIEW_ITEM_INLINE_MNUE` to `VIEW_ITEM_INLINE_MENU` [#7409](https://github.com/eclipse-theia/theia/pull/7409)
- [scm | git] moved the `GitHistoryWidget` (History View), and `GitNavigableListWidget` to a new packaged named `scm-extra` [#6381](https://github.com/eclipse-theia/theia/pull/6381)
  - Renamed `GitHistoryWidget` to `ScmHistoryWidget`
  - CSS classes have been also been moved, and renamed accordingly
- [task] removed `TaskAttachQuickOpenItem` [#7392](https://github.com/eclipse-theia/theia/pull/7392)
- [task] removed `TaskService.taskProviderRegistry` [#7418](https://github.com/eclipse-theia/theia/pull/7418)
- [task] renamed `TaskRestartRunningQuickOpenItem` to `RunningTaskQuickOpenItem` [#7392](https://github.com/eclipse-theia/theia/pull/7392)
- [terminal] renamed `handleWroleWordOptionClicked` to `handleWholeWordOptionClicked` [#7409](https://github.com/eclipse-theia/theia/pull/7409)
- [workspace] renamed `toDiposeOnUpdateCurrentWidget` to `toDisposeOnUpdateCurrentWidget` [#7409](https://github.com/eclipse-theia/theia/pull/7409)

## v0.16.0 - 27/02/2020

- [cli] added an additional flag to the `download:plugins` script [#7123](https://github.com/eclipse-theia/theia/pull/7123)
  - `p=true`: plugins should be preserved as they are (compressed).
  - `p=false` (default): plugins should be uncompressed.
- [cli] added API to create integration test pages [#7029](https://github.com/eclipse-theia/theia/pull/7029)
- [core] added a new React-based dialog type `ReactDialog` [#6855](https://github.com/eclipse-theia/theia/pull/6855)
- [core] added ability to make the application data folder configurable [#7214](https://github.com/eclipse-theia/theia/pull/7214)
- [core] added additional commands to close main area widgets [#7101](https://github.com/eclipse-theia/theia/pull/7101)
- [core] added handling to dismiss any active menu when the quick palette is opened [#7136](https://github.com/eclipse-theia/theia/pull/7136)
- [core] added handling to ensure that disabled keybindings do not shadow enabled ones [#7022](https://github.com/eclipse-theia/theia/pull/7022)
- [core] added support for icons in a submenu [#7091](https://github.com/eclipse-theia/theia/pull/7091)
- [core] fixed 'out of sync' error [#7139](https://github.com/eclipse-theia/theia/pull/7139)
- [core] fixed import in `lsp-types.ts` [#7075](https://github.com/eclipse-theia/theia/pull/7075)
- [core] fixed set selection on right-click [#7147](https://github.com/eclipse-theia/theia/pull/7147)
- [core] fixed the `TOGGLE_MAXIMIZED` command [#7012](https://github.com/eclipse-theia/theia/pull/7012)
- [core] fixed the search-box for trees [#7089](https://github.com/eclipse-theia/theia/pull/7089)
- [core] fixed tree highlighting foreground color [#7025](https://github.com/eclipse-theia/theia/pull/7025)
- [core] updated `RecursivePartial` to allow arrays [#7201](https://github.com/eclipse-theia/theia/pull/7201)
- [core] updated the `AboutDialog` to include the `applicationName` [#7135](https://github.com/eclipse-theia/theia/pull/7135)
- [core] updated the `DialogProps` to include: [#7080](https://github.com/eclipse-theia/theia/pull/7080)
  - `maxWidth`: control the maximum width allowed for a dialog.
  - `wordWrap`: control the word wrapping behavior for content in the dialog.
- [core] updated the `THEIA_ENV_REGEXP_EXCLUSION` [#7085](https://github.com/eclipse-theia/theia/pull/7085)
- [debug] added ability to lazily update frames of all threads in all-stop mode [#6869](https://github.com/eclipse-theia/theia/pull/6869)
- [debug] fixed issue where breakpoints were incorrectly rendered on column 1 [#7211](https://github.com/eclipse-theia/theia/pull/7211)
- [documentation] updated code of conduct [#7161](https://github.com/eclipse-theia/theia/pull/7161)
- [editor] updated the log level for the `NavigationLocationService` [#7042](https://github.com/eclipse-theia/theia/pull/7042)
- [electron] added default properties for `OpenDialog` [#7208](https://github.com/eclipse-theia/theia/pull/7208)
- [electron] added handling so only the `BrowserWindow` can access backend HTTP services [#7205](https://github.com/eclipse-theia/theia/pull/7205)
- [electron] updated stat check handling for the save dialog [#7197](https://github.com/eclipse-theia/theia/pull/7197)
- [filesystem] updated the handling of deletions triggered by a user [#7139](https://github.com/eclipse-theia/theia/pull/7139)
- [git] added additional handling when a user attempts to amend without a previous commit [#7033](https://github.com/eclipse-theia/theia/pull/7033)
- [keymaps] updated the keyboard shortcuts widget font-size [#7060](https://github.com/eclipse-theia/theia/pull/7060)
- [markers] improved marker node descriptions [#7209](https://github.com/eclipse-theia/theia/pull/7209)
- [markers] updated marker tooltips to display full path to resource [#7207](https://github.com/eclipse-theia/theia/pull/7207)
- [mini-browser] added additional `HtmlHandler` support [#6969](https://github.com/eclipse-theia/theia/pull/6969)
- [monaco] added handling to activate a grammar only for languages with a registered grammar [#7110](https://github.com/eclipse-theia/theia/pull/7110)
- [monaco] added support for array snippet prefixes [#7177](https://github.com/eclipse-theia/theia/pull/7177)
- [monaco] close an active menubar dropdown when the quick palette is launched [#7136](https://github.com/eclipse-theia/theia/pull/7136)
- [monaco] implemented support for multiple workspace folders in `MonacoWorkspace` [#7182](https://github.com/eclipse-theia/theia/pull/7182)
- [plugin] added ability to customize the plugin host process [#7181](https://github.com/eclipse-theia/theia/pull/7181)
- [plugin] added functionality to expose the metadata scanner to the API [#7134](https://github.com/eclipse-theia/theia/pull/7134)
- [plugin] added functionality to show progress on plugin activation [#7017](https://github.com/eclipse-theia/theia/pull/7017)
- [plugin] added handling to activate a language based on created mode [#7110](https://github.com/eclipse-theia/theia/pull/7110)
- [plugin] added handling to gracefully terminate plugin host processes without an rpc connection [#7192](https://github.com/eclipse-theia/theia/pull/7192)
- [plugin] added handling to prevent error on disabled performance API [#7175](https://github.com/eclipse-theia/theia/pull/7175)
- [plugin] fixed `window.showTextDocument` to allow opening resources with `untitled` schema [#6803](https://github.com/eclipse-theia/theia/pull/6803)
- [plugin] implemented `readFile` for workspace filesystem [#6980](https://github.com/eclipse-theia/theia/pull/6980)
- [plugin] implemented `writeFile` for workspace filesystem [#6980](https://github.com/eclipse-theia/theia/pull/6980)
- [preferences] added functionality to use text models to update content [#7110](https://github.com/eclipse-theia/theia/pull/7110)
- [preferences] fixed display of file icons [#7011](https://github.com/eclipse-theia/theia/pull/7011)
- [preview] added ability to render `.markdown` files [#7234](https://github.com/eclipse-theia/theia/pull/7234)
- [repo] added two new npm scripts: [#7096](https://github.com/eclipse-theia/theia/pull/7096)
  - `test:references`: fails if typescript references are out of sync.
  - `prepare:references`: updates typescript references, if required.
- [repo] the `prepare` script now updates typescript references.
- [repo] updated the `prepare` script so it now updates typescript references [#7096](https://github.com/eclipse-theia/theia/pull/7096)
- [scm] fixed alignment of file icons [#7041](https://github.com/eclipse-theia/theia/pull/7041)
- [scm] fixed incorrect icon colors on hover [#7044](https://github.com/eclipse-theia/theia/pull/7044)
- [terminal] added a search widget to terminals [#5471](https://github.com/eclipse-theia/theia/pull/5471)
- [core] from now on, downstream projects can refine where the configuration files (such as `settings.json`, `keymaps.json`, `recentworkspace.json`, etc.) will be stored by Theia. [#4488](https://github.com/eclipse-theia/theia/pull/4488)\
The default location remains the same: `~/.theia`, however it can be customized by overriding the `#getConfigDirUri` method of the `EnvVariablesServer` API. The easiest way is to subclass the `EnvVariablesServerImpl` and rebind it in your backend module:
  ```ts
  // your-env-variables-server.ts:

  import { injectable } from 'inversify';
  import { EnvVariablesServerImpl } from '@theia/core/lib/node/env-variables';

  @injectable()
  export class YourEnvVariableServer extends EnvVariablesServerImpl {

      async getConfigDirUri(): Promise<string> {
          return 'file:///path/to/your/desired/config/dir';
      }

  }

  // your-backend-application-module.ts:

  import { ContainerModule } from 'inversify';
  import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
  import { YourEnvVariableServer } from './your-env-variables-server';

  export default new ContainerModule((bind, unbind, isBound, rebind) => {
      rebind(EnvVariablesServer).to(YourEnvVariableServer).inSingletonScope();
  });
  ```

Breaking changes:

- [core] fixed typo (highligh -> highlight) in caption highlight fragment [#7050](https://github.com/eclipse-theia/theia/pull/7050)
- [terminal] added new abstract methods to the TerminalWidget[#7179]: `scrollLineUp`, `scrollLineDown`, `scrollToTop`, `scrollPageUp`, `scrollPageDown`
- The release includes the removal of language-specific Theia extensions and other Theia extensions that are or can be replaced by equivalent VS Code extensions.
  - Migration steps are available at the following wiki page [`Consuming Builtin and External VS Code Extensions`](https://github.com/eclipse-theia/theia/wiki/Consuming-Builtin-and-External-VS-Code-Extensions).
  - [debug-nodejs] removed the `@theia/debug-nodejs` extension [#6933](https://github.com/eclipse-theia/theia/pull/6933)
      - The extension will no longer be maintained by the project and remains in the Git history for anyone who would like to reference it or maintain it.
  - [editorconfig] removed the `@theia/editorconfig` extension [#6933](https://github.com/eclipse-theia/theia/pull/6933)
      - The extension will no longer be maintained by the project and remains in the Git history for anyone who would like to reference it or maintain it.
  - [java] removed the `@theia/java` extension [#6933](https://github.com/eclipse-theia/theia/pull/6933)
      - The extension will no longer be maintained by the project and remains in the Git history for anyone who would like to reference it or maintain it.
      - Please view the `theia-apps` [theia-java](https://github.com/theia-ide/theia-apps/tree/master/theia-java-docker) image for an example application which has been updated to
      use VS Code extensions instead of `@theia/java`.
  - [java-debug] removed the `@theia/java-debug` extension [#6933](https://github.com/eclipse-theia/theia/pull/6933)
      - The extension will no longer be maintained by the project and remains in the Git history for anyone who would like to reference it or maintain it.
      - Please view the `theia-apps` [theia-java](https://github.com/theia-ide/theia-apps/tree/master/theia-java-docker) image for an example application which has been updated to
      use VS Code extensions instead of `@theia/java-debug`.
  - [merge-conflicts] removed the `@theia/merge-conflicts` extension [#6933](https://github.com/eclipse-theia/theia/pull/6933)
      - The extension will no longer be maintained by the project and remains in the Git history for anyone who would like to reference it or maintain it.
  - [python] removed the `@theia/python` extension [#6933](https://github.com/eclipse-theia/theia/pull/6933)
      - The extension will no longer be maintained by the project and remains in the Git history for anyone who would like to reference it or maintain it.
      - Please view the `theia-apps` [theia-python](https://github.com/theia-ide/theia-apps/tree/master/theia-python-docker) image for an example application which has been updated to
      use VS Code extensions instead of `@theia/python`.
  - [textmate-grammars] removed the `@theia/textmate-grammars` extension [#6933](https://github.com/eclipse-theia/theia/pull/6933)
      - The extension will no longer be maintained by the project and remains in the Git history for anyone who would like to reference it or maintain it.
  - [tslint] removed the `@theia/tslint` extension [#6933](https://github.com/eclipse-theia/theia/pull/6933)
      - The extension will no longer be maintained by the project and remains in the Git history for anyone who would like to reference it or maintain it.
  - [typescript] removed the `@theia/typescript` extension [#6933](https://github.com/eclipse-theia/theia/pull/6933)
      - The extension will no longer be maintained by the project and remains in the Git history for anyone who would like to reference it or maintain it.
      - Please view the `theia-apps` [theia-typescript](https://github.com/theia-ide/theia-apps/tree/master/theia-docker) image for an example application which has been updated to
      use VS Code extensions instead of `@theia/typescript`.

## v0.15.0 - 30/01/2020

- [application-manager] added config to disable reloading windows [#6981](https://github.com/eclipse-theia/theia/pull/6981)
- [application-manager] added meta viewport tag [#6967](https://github.com/eclipse-theia/theia/pull/6967)
- [application-manager] fixed the circular dependency exclude path on Windows [#6893](https://github.com/eclipse-theia/theia/pull/6893)
- [console] fixed the debug console user input alignment [#6958](https://github.com/eclipse-theia/theia/pull/6958)
- [core] fixed XSS vulnerability in the browser sidebar [#6988](https://github.com/eclipse-theia/theia/pull/6988)
- [core] fixed issue to close the websocket channel when a language server connection is closed [#6854](https://github.com/eclipse-theia/theia/pull/6854)
- [core] fixed issue to exclude numpad keys from the keyboard mapping [#6881](https://github.com/eclipse-theia/theia/pull/6881)
- [core] improved formatting of performance values in the logs [#6858](https://github.com/eclipse-theia/theia/pull/6858)
- [core] updated handling of `ApplicationShell.getAreaFor` for tabbars [#6994](https://github.com/eclipse-theia/theia/pull/6994)
- [core] updated keybinding check in case full and partial bindings are registered [#6934](https://github.com/eclipse-theia/theia/pull/6934)
- [core] updated logic to collapse panels on toggle view [#6963](https://github.com/eclipse-theia/theia/pull/6963)
- [debug] added exception breakpoints support [#5774](https://github.com/eclipse-theia/theia/pull/5774)
- [debug] added function breakpoints support [#5774](https://github.com/eclipse-theia/theia/pull/5774)
- [debug] added inline breakpoints support [#5774](https://github.com/eclipse-theia/theia/pull/5774)
- [debug] added watch expression support [#5774](https://github.com/eclipse-theia/theia/pull/5774)
- [debug] fixed styling issues with the debug hover [#6887](https://github.com/eclipse-theia/theia/pull/6887)
- [documentation] updated developing documentation for Windows [#6893](https://github.com/eclipse-theia/theia/pull/6893)
- [editor] added `toggle minimap` command and menu item [#6843](https://github.com/eclipse-theia/theia/pull/6843)
- [editor] added `toggle render whitespace` command and menu item [#6843](https://github.com/eclipse-theia/theia/pull/6843)
- [editor] added `toggle word wrap` command and menu item [#6843](https://github.com/eclipse-theia/theia/pull/6843)
- [editor] added missing statusbar tooltip for `go to line` [#6770](https://github.com/eclipse-theia/theia/pull/6770)
- [editor] added missing statusbar tooltip for `select encoding` [#6770](https://github.com/eclipse-theia/theia/pull/6770)
- [editor] added missing statusbar tooltip for `select end of line sequence` [#6770](https://github.com/eclipse-theia/theia/pull/6770)
- [editor] added missing statusbar tooltip for `select indentation` [#6770](https://github.com/eclipse-theia/theia/pull/6770)
- [editor] added missing statusbar tooltip for `select language mode` [#6770](https://github.com/eclipse-theia/theia/pull/6770)
- [editor] updated the `go to line` statusbar item to trigger the `go to line` command directly [#6770](https://github.com/eclipse-theia/theia/pull/6770)
- [file-search] improved the results obtained when performing a file search [#6642](https://github.com/eclipse-theia/theia/pull/6642)
- [filesystem] fixed icon and file name alignment [#6973](https://github.com/eclipse-theia/theia/pull/6973)
- [filesystem] improved the 'file has changed' dialog [#6873](https://github.com/eclipse-theia/theia/pull/6873)
- [git] updated the `git checkout` statusbar tooltip similarly to VS Code [#6779](https://github.com/eclipse-theia/theia/pull/6779)
- [git] updated the version of `find-git-repositories` [#6850](https://github.com/eclipse-theia/theia/pull/6850)
- [keybindings] fixed an issue allowing users to change default keybindings [#6880](https://github.com/eclipse-theia/theia/pull/6880)
- [keymaps] fixed column spacing for the keybindings-widget [#6989](https://github.com/eclipse-theia/theia/pull/6989)
- [markers] added statusbar tooltip displaying the number of current problem markers by severity [#6771](https://github.com/eclipse-theia/theia/pull/6771)
- [merge-conflicts] fixed the typo present in the `merge-conflicts` command category [#6790](https://github.com/eclipse-theia/theia/pull/6790)
- [monaco] added normalization of textmate colors [#6966](https://github.com/eclipse-theia/theia/pull/6966)
- [monaco] fixed issue with the quick-pick when there are no items [#6870](https://github.com/eclipse-theia/theia/pull/6870)
- [monaco] fixed missing `await` on workspace edits file creation [#6851](https://github.com/eclipse-theia/theia/pull/6851)
- [monaco] fixed the `inspect developer token` command [#6966](https://github.com/eclipse-theia/theia/pull/6966)
- [navigator] fixed race condition on contribution initialization [#6817](https://github.com/eclipse-theia/theia/pull/6817)
- [plugin] added ability to handle `vscode.openFolder` command [#6928](https://github.com/eclipse-theia/theia/pull/6928)
- [plugin] added parallel resolution of plugin entries [#6972](https://github.com/eclipse-theia/theia/pull/6972)
- [plugin] added the automatic removal of old session logs [#6956](https://github.com/eclipse-theia/theia/pull/6956)
  - By default only the last 10 (configurable using `--plugin-max-session-logs-folders=N`) session folders are retained.
- [plugin] fixed `workbench.action.closeActiveEditor` command [#6978](https://github.com/eclipse-theia/theia/pull/6978)
- [plugin] fixed header container alignment in the plugins-view [#6983](https://github.com/eclipse-theia/theia/pull/6983)
- [plugin] fixed implementation of `showTextDocument` API [#6824](https://github.com/eclipse-theia/theia/pull/6824)
- [plugin] fixed issue where tree-views were not properly displayed [#6939](https://github.com/eclipse-theia/theia/pull/6939)
- [plugin] fixed issue with `DocumentsMainImpl.toEditorOpenerOptions` [#6824](https://github.com/eclipse-theia/theia/pull/6824)
- [plugin] fixed self-hosting on Windows [#6316](https://github.com/eclipse-theia/theia/pull/6316)
- [preferences] fixed an indentation issue when using the preferences tree widget to add new preferences [#6736](https://github.com/eclipse-theia/theia/pull/6736)
- [scripts] added the ability to perform parallel lerna execution on Windows [#6893](https://github.com/eclipse-theia/theia/pull/6893)
- [search-in-workspace] improved the overall search performance [#6789](https://github.com/eclipse-theia/theia/pull/6798)
- [task] added `processId` and `terminalId` to the `TaskExitedEvent` [#6825](https://github.com/eclipse-theia/theia/pull/6825)
- [task] added a new command to `restart running task` [#6811](https://github.com/eclipse-theia/theia/pull/6811)
- [task] added support for `presentation.reveal` and `presentation.focus` [#6814](https://github.com/eclipse-theia/theia/pull/6814)
- [task] updated private accessibility of `restartTask` so it can be called by others [#6811](https://github.com/eclipse-theia/theia/pull/6811)
- [task] updated private accessibility of `terminateTask` so it can be called by others [#6811](https://github.com/eclipse-theia/theia/pull/6811)
- [terminal] added handling to always open terminal links on touchevents (e.g. when tapping a link on iPad) [#6875](https://github.com/eclipse-theia/theia/pull/6875)
- [terminal] fixed an issue regarding the `onDidChangeCurrentTerminal` event [#6799](https://github.com/eclipse-theia/theia/pull/6799)
- [terminal] fixed an issue which prevents re-using integrated terminals which have child processes spawned [#6769](https://github.com/eclipse-theia/theia/pull/6769)
- [terminal] improved the display of `new terminal` in a multi-root workspace [#6876](https://github.com/eclipse-theia/theia/pull/6876)
- [testing] added `API Integration` testing framework [#6852](https://github.com/eclipse-theia/theia/pull/6852)
- [workspace] fixed XSS vulnerability in the `new file` dialog [#6977](https://github.com/eclipse-theia/theia/pull/6977)

Breaking changes:

- [application-manager] updated `ApplicationPackageManager.start*` to return an instance of a server child process instead of promise [#6852](https://github.com/eclipse-theia/theia/pull/6852).
- [callhierarchy] updated CallHierarchyService to align with VS Code API [#6924](https://github.com/eclipse-theia/theia/pull/6924):
  - Use LanguageSelector instead of language id.
  - Use position instead of range for lookup of root symbol.
  - Changed data structures to be like VS Code API.
- [cli] renamed generated webpack config to `gen-webpack.config.js` [#6852](https://github.com/eclipse-theia/theia/pull/6852).
  `webpack.config.js` is generated only once. It can be edited by users to customize bundling,
  but should be based on `gen-webpack.config.js` to pick any changes in the generated config.
  If it does not have a reference to `gen-webpack.config.js` then it will be regenerated.
- [core] removed `virtual-renderer`. `react-renderer` should be used instead [#6885](https://github.com/eclipse-theia/theia/pull/6885)
- [core] removed `virtual-widget`. `react-widget` should be used instead [#6885](https://github.com/eclipse-theia/theia/pull/6885)
- [core] renamed method `registerComositionEventListeners()` to `registerCompositionEventListeners()` [#6961](https://github.com/eclipse-theia/theia/pull/6961)
- [debug] removed `@theia/json` dependency. Applications should explicitly depend on `@theia/json` instead [#6647](https://github.com/eclipse-theia/theia/pull/6647)
- [plugin] renamed `gererateTimeFolderName` to `generateTimeFolderName` [#6956](https://github.com/eclipse-theia/theia/pull/6956)
- [preferences] removed `@theia/json` dependency. Applications should explicitly depend on `@theia/json` instead [#6647](https://github.com/eclipse-theia/theia/pull/6647)
- [task] renamed method `getStrigifiedTaskSchema()` has been renamed to `getStringifiedTaskSchema()` [#6780](https://github.com/eclipse-theia/theia/pull/6780)
- [task] renamed method `reorgnizeTasks()` has been renamed to `reorganizeTasks()` [#6780](https://github.com/eclipse-theia/theia/pull/6780)
- Support VS Code icon and color theming. [#6475](https://github.com/eclipse-theia/theia/pull/6475)
  - Theming: Before `input`, `textarea`, `select` and `button` elements were styled in an ad-hoc manner, i.e.
  some were styled globally for a tag, other per a component and third with a dedicated css class name.
  Now Theia does not style these elements by default, but an extension developer should decide.
  Theia comes though with predefined css class names: `theia-input`, `theia-select` and `theia-button`
  to style input/textarea, select and button elements correspondingly. Existing components were refactored to use them.
  - Theming: Theia css colors are replaced with [VS Code colors](https://code.visualstudio.com/api/references/theme-color).
    - One can reference VS Code color in css by prefixing them with `--theia` and replacing all dots with dashes.
    For example `widget.shadow` color can be referenced in css with `var(--theia-widget-shadow)`.
    - One can resolve a current color value programmatically with `ColorRegistry.getCurrentColor`.
    - One can load a new color theme:
      - in the frontend module to enable it on startup

        ```ts
            MonacoThemingService.register({
                id: 'myDarkTheme',
                label: 'My Dark Theme',
                uiTheme: 'vs-dark',
                json: require('./relative/path/to/my_theme.json'),
                includes: {
                    './included_theme.json': require('./relative/path/to/included_theme.json')
                }
            });
        ```

      - later from a file:

        ```ts
            @inject(MonacoThemingService)
            protected readonly monacoThemeService: MonacoThemingService;

            this.monacoThemeService.register({
                id: 'myDarkTheme',
                label: 'My Dark Theme',
                uiTheme: 'vs-dark',
                uri: 'file:///absolute/path/to/my_theme.json'
            });
        ```

      - or install from a VS Code extension.
    - One should not introduce css color variables anymore or hardcode colors in css.
    - One can contribute new colors by implementing `ColorContribution` contribution point and calling `ColorRegistry.register`.
    It's important that new colors are derived from existing VS Code colors if one plans to allow installation of VS Code extension contributing color themes.
    Otherwise, there is no guarantee that new colors don't look alien for a random VS Code color theme.
    One can derive from an existing color, just by plainly referencing it, e.g. `dark: 'widget.shadow'`,
    or applying transformations, e.g. `dark: Color.lighten('widget.shadow', 0.4)`.
    - One can though specify values, without deriving from VS Code colors, for new colors in their own theme.
    See for example, how [Light (Theia)](packages/monaco/data/monaco-themes/vscode/light_theia.json) theme overrides colors for the activity bar.
  - Labeling: `LabelProvider.getIcon` should be sync and fast to avoid blocking rendering and icon caching.
  One has to pass more specific elements to get a more specific icon. For example, one cannot answer precisely from a URI
  whether a folder or a file icon should be used. If a client wants to get a proper result then it should pass `FileStat` for example or
  provide own `LabelProviderContribution` which derives `FileStat` from a custom data structure and then calls  `LabelProvider.getIcon` again.
  - Labeling: `LabelProviderContribution` methods can return `undefined` meaning that the next contribution should be tried.
  - Tree: `TreeNode.name`, `TreeNode.description` and `TreeNode.icon` are deprecated and will be removed later.
  One has to provide `LabelProviderContribution` implementation for a custom tree node structure.
  Before these attributes have to be computed for all nodes and stored as a part of the layout.
  From now on they will be computed only on demand for visible nodes.
  It decreases requirements to the local storage and allows to invalidate node appearance by simply re-rendering a tree.
- Updated `example-browser` and `example-electron` applications to remove extensions which are instead contributed by VS Code builtin extensions [#6883](https://github.com/eclipse-theia/theia/pull/6883)
  - Extensions removed from the example applications are deprecated and will be removed in the future. If adopters/extenders would like to continue
  using the deprecated extensions, they must be self-maintained and can be accessed through the repository's Git history.
  - In order to fetch plugins remotely, the `@theia/cli` script `download:plugins` can be used:
    - In your `package.json` you can define:
      - `theiaPluginDir`: to specify the folder in which to download plugins, in respect to your `package.json`
      - `theiaPlugins`: to specify the list of plugins in the form of `"id": "url"`

## v0.14.0 - 19/12/2019

- [application-manager] removed unnecessary `bunyan` dependency [#6651](https://github.com/eclipse-theia/theia/pull/6651)
- [bunyan] removed [`@theia/bunyan`](https://github.com/eclipse-theia/theia/tree/b92a5673de1e9d1bdc85e6200486b92394200579/packages/bunyan) extension [#6651](https://github.com/eclipse-theia/theia/pull/6651)
- [core] added handling preventing scrolling when closing dialogs [#6674](https://github.com/eclipse-theia/theia/pull/6674)
- [core] fixed `noWrapInfo` classname in applications with a subset of extensions [#6593](https://github.com/eclipse-theia/theia/pull/6593)
- [core] fixed infinite recursion when the tree root is refreshed [#6679](https://github.com/eclipse-theia/theia/pull/6679)
- [core] fixed the dispatching of keybindings when editing composition texts [#6673](https://github.com/eclipse-theia/theia/pull/6673)
- [core] removed unnecessary `@types/bunyan` dependency [#6651](https://github.com/eclipse-theia/theia/pull/6651)
- [core] updated `Close Editor` keybinding [#6635](https://github.com/eclipse-theia/theia/pull/6635)
- [core] updated `Close Window` keybinding [#6635](https://github.com/eclipse-theia/theia/pull/6635)
- [core] updated `noopener` when opening windows to avoid sharing event loops [#6683](https://github.com/eclipse-theia/theia/pull/6683)
- [core] updated handling of parting keybindings based on current context [#6752](https://github.com/eclipse-theia/theia/pull/6752)
- [core] updated the `Close All` keychord when running in Electron [#6703](https://github.com/eclipse-theia/theia/pull/6703)
- [electron] added support to explicitly close the socket when calling `onStop` [#6681](https://github.com/eclipse-theia/theia/pull/6681)
- [electron] updated menu to explicitly use application name [#6726](https://github.com/eclipse-theia/theia/pull/6726)
- [filesystem] fixed external URIs of map editor icons [#6664](https://github.com/eclipse-theia/theia/pull/6664)
- [languages] updated keybinding for `Open File` [#6690](https://github.com/eclipse-theia/theia/pull/6690)
- [messages] added tooltip to notifications statusbar item [#6766](https://github.com/eclipse-theia/theia/pull/6766)
- [messages] fixed timeout issue for notifications without actions [#6708](https://github.com/eclipse-theia/theia/pull/7086)
- [navigator] fixed eagerly load of model root before the workspace service is ready [#6679](https://github.com/eclipse-theia/theia/pull/6679)
- [plugin] added implementation to get the default shell for hosted plugins [#6657](https://github.com/eclipse-theia/theia/pull/6657)
- [plugin] added miscellaneous updates to support VS Code emacs extension [#6625](https://github.com/eclipse-theia/theia/pull/6625)
- [plugin] added miscellaneous updates to support VS Code vim extension [#6687](https://github.com/eclipse-theia/theia/pull/6687)
- [plugin] added support for allow-forms [#6695](https://github.com/eclipse-theia/theia/pull/6695)
- [plugin] added support to install VS Code extension packs [#6682](https://github.com/eclipse-theia/theia/pull/6682)
- [plugin] fixed `TaskExecution` instantiation [#6533](https://github.com/eclipse-theia/theia/pull/6533)
- [task] added prompt asking users to terminate or restart active tasks [#6668](https://github.com/eclipse-theia/theia/pull/6668)
- [task] added support for `TaskIdentifier` [#6680](https://github.com/eclipse-theia/theia/pull/6680)
- [task] added support for background tasks [#6680](https://github.com/eclipse-theia/theia/pull/6680)
- [task] added support for compound tasks [#6680](https://github.com/eclipse-theia/theia/pull/6680)
- [task] added support for tasks of detected tasks which have the same label, and different scopes in a multi-root workspace [#6718](https://github.com/eclipse-theia/theia/pull/6718)
- [task] fixed bug where custom tasks schemas were not properly updated [#6643](https://github.com/eclipse-theia/theia/pull/6643)
- [task] fixed circular dependencies [#6756](https://github.com/eclipse-theia/theia/pull/6756)
- [terminal] added mapping of localhost links to proper external links [#6663](https://github.com/eclipse-theia/theia/pull/6663)
- [workspace] updated `New File` keybinding [#6635](https://github.com/eclipse-theia/theia/pull/6635)
- [workspace] updated keybinding for `Open Workspace` [#6690](https://github.com/eclipse-theia/theia/pull/6690)

Breaking changes:

- [core] updated browser windows spawned through the opener-service to have `noopener` set which ultimately preventing them from accessing `window.opener`. `openNewWindow` will no longer return a Window as a result [#6683](https://github.com/eclipse-theia/theia/pull/6683)
- [debug] renamed command `COPY_VARAIBLE_AS_EXPRESSION` to `COPY_VARIABLE_AS_EXPRESSION` [#6698](https://github.com/eclipse-theia/theia/pull/6698)
- [debug] renamed command `COPY_VARAIBLE_VALUE` to `COPY_VARIABLE_VALUE` [#6698](https://github.com/eclipse-theia/theia/pull/6698)
- [debug] renamed getter method `multiSesssion` to `multiSession` [#6698](https://github.com/eclipse-theia/theia/pull/6698)
- [task] added `taskDefinitionRegistry` and `taskSourceResolver` to the constructor of `TaskRunQuickOpenItem` and `ConfigureBuildOrTestTaskQuickOpenItem` [#6718](https://github.com/eclipse-theia/theia/pull/6718)
- [task] changed the data structure of `ProvidedTaskConfigurations.tasksMap` [#6718](https://github.com/eclipse-theia/theia/pull/6718)
- [terminal] renamed `TerminalCopyOnSelectionHander` to `TerminalCopyOnSelectionHandler` [#6692](https://github.com/eclipse-theia/theia/pull/6692)

## v0.13.0 - 28/11/2019

- [console] added filtering support based on severity [#6486](https://github.com/eclipse-theia/theia/pull/6486)
- [core] added functionality so that label providers can now notify that element labels and icons may have changed and should be refreshed [#5884](https://github.com/theia-ide/theia/pull/5884)
- [core] added functionality to expose all handlers for a given command [#6599](https://github.com/eclipse-theia/theia/pull/6599)
- [core] aligned `Open Preferences` and `Save As` keybindings with VS Code on Mac OS [#6620](https://github.com/eclipse-theia/theia/pull/6620)
- [core] fixed the display of toolbar item icons [#6514](https://github.com/eclipse-theia/theia/pull/6514)
- [core] switched the frontend application's shutdown hook from `window.unload` to `window.beforeunload`. [#6530](https://github.com/eclipse-theia/theia/issues/6530)
- [core] updated dependency injection cycle between `LabelProvider` and its contributions [#6608](https://github.com/eclipse-theia/theia/pull/6608)
- [core] updated handling when access is denied to the clipboard [#6516](https://github.com/eclipse-theia/theia/pull/6516)
- [core] updated scrolling of widgets when re-setting their focus [#6621](https://github.com/eclipse-theia/theia/pull/6621)
- [core] upgraded `reconnecting-websocket` to latest version [#6512](https://github.com/eclipse-theia/theia/pull/6512)
- [core] aligned `New File`, `Close Editor` and `Close Window` keybindings with VS Code across OSes [#6635](https://github.com/eclipse-theia/theia/pull/6635)
- [cpp] moved the `cpp` extension to the [`theia-cpp-extensions`](https://github.com/eclipse-theia/theia-cpp-extensions) repo [#6505](https://github.com/eclipse-theia/theia/pull/6505)
- [debug] added ability to re-use the terminal based on label and caption [#6619](https://github.com/eclipse-theia/theia/pull/6619)
- [debug] added reloading of child variable nodes on `setValue` call [#6555](https://github.com/eclipse-theia/theia/pull/6555)
- [debug] fixed breakpoint context menu behavior [#6480](https://github.com/eclipse-theia/theia/pull/6480)
- [debug] generalized the `allThreadStop` event [#6627](https://github.com/eclipse-theia/theia/pull/6627)
- [dockerfile] removed example dockerfile [#6586](https://github.com/eclipse-theia/theia/pull/6585)
- [documentation] updated 'outline-view' extension documentation [#6454](https://github.com/eclipse-theia/theia/pull/6454)
- [documentation] updated package name for libX11 for Red Hat based OS [#6632](https://github.com/eclipse-theia/theia/pull/6632)
- [editor-preview] removed unnecessary dependency to the `navigator` extension [#6648](https://github.com/eclipse-theia/theia/pull/6648)
- [editorconfig] updated trim whitespace to be respected during manual saving [#6417](https://github.com/eclipse-theia/theia/pull/6417)
- [electron] updated error logging of the rebuild [#6538](https://github.com/eclipse-theia/theia/pull/6538)
- [git] added support for `alwaysSignOff` [#6402](https://github.com/eclipse-theia/theia/pull/6402)
- [git] updated `dugite-extra` dependency [#6602](https://github.com/eclipse-theia/theia/pull/6602)
- [git] updated `find-git-exec` dependency [#6602](https://github.com/eclipse-theia/theia/pull/6602)
- [json] moved JSON grammar to the `textmate-grammars` extension [#6622](https://github.com/eclipse-theia/theia/pull/6622)
- [keymaps] removed the display of internal commands from the widget [#6594](https://github.com/eclipse-theia/theia/pull/6594)
- [monaco] added mappings from VS Code commands to internal commands [#5590](https://github.com/eclipse-theia/theia/pull/5590)
- [monaco] fixed incorrect command palette cursor position [#6435](https://github.com/eclipse-theia/theia/pull/6435)
- [monaco] fixed registration of `CodeActionProviders` [#6556](https://github.com/eclipse-theia/theia/pull/6556)
- [plugin-metrics] introduced the `plugin-metrics` extension [#6303](https://github.com/eclipse-theia/theia/pull/6303)
- [plugin] added ability to use upload services [#6554](https://github.com/eclipse-theia/theia/pull/6554)
- [plugin] added functionality to restart hosted instance if restart is called before start [#6521](https://github.com/eclipse-theia/theia/pull/6521)
- [plugin] fixed `executeCommand` argument passing [#6537](https://github.com/eclipse-theia/theia/pull/6537)
- [plugin] fixed bad type conversion with code actions [#6559](https://github.com/eclipse-theia/theia/pull/6559)
- [plugin] removed unnecessary dependency to the `mini-browser` extension [#6644](https://github.com/eclipse-theia/theia/pull/6644)
- [plugin]added ability to configure borders in the quick pick items list [#6487](https://github.com/eclipse-theia/theia/pull/6487)
- [preferences] added better handling for schema changed events [#6510](https://github.com/eclipse-theia/theia/pull/6510)
- [process] added handling for `onClose` event [#6595](https://github.com/eclipse-theia/theia/pull/6595)
- [process] updated process spawning to use defaults [#6561](https://github.com/eclipse-theia/theia/pull/6561)
- [scm] added handling when opening diff-editors to respect preference `workbench.list.openMode` [#6481](https://github.com/eclipse-theia/theia/pull/6481)
- [scm] added support to open `diff-editors` with a single-click [#6481](https://github.com/eclipse-theia/theia/pull/6481)
- [search-in-workspace] updated decorations when clearing search [#6511](https://github.com/eclipse-theia/theia/pull/6511)
- [search-in-workspace] updated resizing of results [#6576](https://github.com/eclipse-theia/theia/pull/6576)
- [task] added ability to add task sub-schemas [#6566](https://github.com/eclipse-theia/theia/pull/6566)
- [task] added ability to create `launch.json` automatically [#6490](https://github.com/eclipse-theia/theia/pull/6490)
- [task] added handling for invalid task configurations [#6515](https://github.com/eclipse-theia/theia/pull/6515)
- [task] added prompt to users to configure tasks [#6539](https://github.com/eclipse-theia/theia/pull/6539)
- [task] added support for `group` in the task config [#6522](https://github.com/eclipse-theia/theia/pull/6522)
- [task] added support for creating `tasks.json` from templates [#6391](https://github.com/eclipse-theia/theia/pull/6391)
- [task] added support for multiple user-defined problem matchers in the `tasks.json` [#6616](https://github.com/eclipse-theia/theia/pull/6616)
- [task] added support for task types in the tasks schema [#6483](https://github.com/eclipse-theia/theia/pull/6483)
- [task] updated task schemas for extensions and plugins [#6492](https://github.com/eclipse-theia/theia/pull/6492)
- [terminal] added implementation to copy text on selection [#6536](https://github.com/eclipse-theia/theia/pull/6536)
- [terminal] added support for integrated terminals [#6508](https://github.com/eclipse-theia/theia/pull/6508)
- [workspace] added path when creating a new file [#6545](https://github.com/eclipse-theia/theia/pull/6545)
- [workspace] added path when creating a new folder [#6545](https://github.com/eclipse-theia/theia/pull/6545)

Breaking changes:
- [core] renamed preference `list.openMode` to `workbench.list.openMode` [#6481](https://github.com/eclipse-theia/theia/pull/6481)
- [monaco] removed monaco prefix from commands [#5590](https://github.com/eclipse-theia/theia/pull/5590)
- [plugin] re-implemented webviews to align with [VS Code browser implementation](https://blog.mattbierner.com/vscode-webview-web-learnings/) [#6465](https://github.com/eclipse-theia/theia/pull/6465)
  - Security: `vscode.previewHTML` is removed, see https://code.visualstudio.com/updates/v1_33#_removing-the-vscodepreviewhtml-command
  - Security: Before all webviews were deployed on [the same origin](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)
  allowing them to break out and manipulate shared data as cookies, local storage or even start service workers
  for the main window as well as for each other. Now each webview will be deployed on own origin by default.
    - Webview origin pattern can be configured with `THEIA_WEBVIEW_EXTERNAL_ENDPOINT` env variable. The default value is `{{uuid}}.webview.{{hostname}}`.
  Here `{{uuid}}` and `{{hostname}}` are placeholders which get replaced at runtime with proper webview uuid
  and [hostname](https://developer.mozilla.org/en-US/docs/Web/API/HTMLHyperlinkElementUtils/hostname) correspondingly.
    - To switch to un-secure mode as before configure `THEIA_WEBVIEW_EXTERNAL_ENDPOINT` with `{{hostname}}` as a value.
    You can also drop `{{uuid}}.` prefix, in this case, webviews still will be able to access each other but not the main window.
  - Remote: Local URIs are resolved by default to the host serving Theia.
  If you want to resolve to another host or change how remote URIs are constructed then
  implement [ExternalUriService.resolve](./packages/core/src/browser/external-uri-service.ts) in a frontend module.
  - Content loading: Webview HTTP endpoint is removed. Content loaded via [WebviewResourceLoader](./packages/plugin-ext/src/main/common/webview-protocol.ts) JSON-RPC service
  with properly preserved resource URIs. Content is only loaded if it's allowed by WebviewOptions.localResourceRoots, otherwise, the service won't be called.
  If you want to customize content loading then implement [WebviewResourceLoaderImpl](packages/plugin-ext/src/main/node/webview-resource-loader-impl.ts) in a backend module.
  - Theming: Theia styles are not applied to webviews anymore
   instead [VS Code way of styling](https://code.visualstudio.com/api/extension-guides/webview#theming-webview-content) should be used.
   VS Code color variables also available with `--theia` prefix.
  - Testing: Webview can work only in secure context because they rely on service workers to load local content and redirect local to remote requests.
  Most browsers define a page as served from secure context if its url has `https` scheme. For local testing `localhost` is treated as a secure context as well.
  Unfortunately, it does not work nicely in FireFox, since it does not treat subdomains of localhost as secure as well, compare to Chrome.
  If you want to test with FireFox you can configure it as described [here](https://github.com/eclipse-theia/theia/pull/6465#issuecomment-556443218).
- [task] updated `TaskSchemaUpdater.update()` from asynchronous to synchronous [#6483](https://github.com/eclipse-theia/theia/pull/6483)

## v0.12.0 - 31/10/2019

- [cli] added explicit `yargs` dependency [#6443](https://github.com/eclipse-theia/theia/pull/6443)
- [cli] enabled static compression of build artifacts [#6266](https://github.com/eclipse-theia/theia/pull/6266)
  - to disable pass `--no-static-compression` to `theia build` or `theia watch`
- [core] fixed handling of URI#`getAllLocation` for paths without parents [#6378](https://github.com/eclipse-theia/theia/pull/6378)
- [core] fixed issue allowing valid properties to be registered despite schemas containing issues [#6341](https://github.com/eclipse-theia/theia/pull/6341)
- [core] updated quick-open menus to not perform validation when first opened [#6281](https://github.com/eclipse-theia/theia/pull/6281)
- [cpp] fixed task labels [#6419](https://github.com/eclipse-theia/theia/pull/6419)
- [cpp] fixed the execution of tasks [#6419](https://github.com/eclipse-theia/theia/pull/6419)
- [cpp] improved the installation documentation for `clangd` [#6271](https://github.com/eclipse-theia/theia/pull/6271)
- [cpp] updated overall documentation of the C/C++ extension [#6364](https://github.com/eclipse-theia/theia/pull/6364)
- [debug] added support for `preLaunchTask` and `postDebugTask` [#6247](https://github.com/eclipse-theia/theia/pull/6247)
- [electron] added option to only allow single instances of an Electron application [#6280](https://github.com/eclipse-theia/theia/pull/6280)
- [electron] fixed `confirmExit` for Electron applications [#6285](https://github.com/eclipse-theia/theia/pull/6285)
- [electron] fixed lossy storage in Electron [#6313](https://github.com/eclipse-theia/theia/pull/6313)
- [electron] upgraded Electron to version 4 [#6307](https://github.com/eclipse-theia/theia/pull/6307)
- [filesystem] fixed error handling of `nsfw` RENAMED events [#6283](https://github.com/eclipse-theia/theia/pull/6283)
- [git] added support for amending initial commits [#5451](https://github.com/eclipse-theia/theia/pull/5451)
- [git] improved git watchers to ensure they do not leak [#6352](https://github.com/eclipse-theia/theia/pull/6352)
- [json] provided empty `initializationOptions` for the JSON language server [#6398](https://github.com/eclipse-theia/theia/pull/6398)
- [keymaps] updated overall documentation of the keymaps extension [#6369](https://github.com/eclipse-theia/theia/pull/6369)
- [messages] added logic hiding the notification center when the last notification is removed [#6356](https://github.com/eclipse-theia/theia/pull/6356)
- [messages] aligned default message with VS Code [#6345](https://github.com/eclipse-theia/theia/pull/6345)
- [mini-browser] updated mini-browser to open without URL encoding [#6388](https://github.com/eclipse-theia/theia/pull/6388)
- [monaco] fixed command execution for inline editors [#6328](https://github.com/eclipse-theia/theia/pull/6328)
- [monaco] fixed incorrect preference initialization [#6450](https://github.com/eclipse-theia/theia/pull/6450)
- [monaco] rebinded keybinding for 'Go to Definition' [#6411](https://github.com/eclipse-theia/theia/pull/6411)
- [plugin] improved tree views: [#6342](https://github.com/eclipse-theia/theia/pull/6342)
    - added logic to not execute commands on selection change
    - added better handling of `undefined` 'treeItem.label'
    - added better styling support for item actions
    - added better support for descriptions
    - fixed styling issues
- [plugin-ext] added `OutputChannelRegistry` interface and add it into the rpc [#6413](https://github.com/eclipse-theia/theia/pull/6413)
- [plugin-ext] added configuration attribute to `DebugSession` [#6382](https://github.com/eclipse-theia/theia/pull/6382)
- [plugin-ext] added logic to pass `pluginInfo` through the output channel append method [#6312](https://github.com/eclipse-theia/theia/pull/6312)
- [plugin-ext] added support for `globalStoragePath` Plug-in API [#6354](https://github.com/eclipse-theia/theia/pull/6354)
- [plugin-ext] added support for `vscode.executeDocumentSymbol` Plug-in API [#6291](https://github.com/eclipse-theia/theia/pull/6291)
- [plugin-ext] added the ability to use HTTP resources for tab title icons [#6270](https://github.com/eclipse-theia/theia/pull6270)
- [plugin-ext] added the disposal of webviews by handle and not widget ID [#6326](https://github.com/eclipse-theia/theia/pull/6326)
- [plugin-ext] fixed `WorkspaceEdit` conversion [#6304](https://github.com/eclipse-theia/theia/pull/6304)
- [plugin-ext] fixed `cancellable` option for `withProgress` notifications [#6365](https://github.com/eclipse-theia/theia/pull/6365)
- [plugin-ext] fixed broken 'html base href' logic in webviews [#6279](https://github.com/eclipse-theia/theia/pull/6279)
- [plugin-ext] fixed incorrect type conversion for language server types [#6351](https://github.com/eclipse-theia/theia/pull/6351)
- [plugin-ext] fixed issue where document listening started before all clients were ready [#6321](https://github.com/eclipse-theia/theia/pull/6321)
- [plugin-ext] improved error message when a plugin node crashes [#6293](https://github.com/eclipse-theia/theia/pull/6293)
- [plugin-ext] improved plugins crash error to be dependent on error type [#6335](https://github.com/eclipse-theia/theia/pull/6335)
- [plugin-ext] initialized extension storage proxy earlier avoiding sending events to the plugin manager before it is ready [#6323](https://github.com/eclipse-theia/theia/pull/6323)
- [plugin] fixed unnecessary return type of the `$executeCommand` which wrapped a Promise in another Promise [#6290](https://github.com/eclipse-theia/theia/pull/6290)
- [preferences] updated preferences widget so it can be rebinded [#6397](https://github.com/eclipse-theia/theia/pull/6397)
- [preview] fixed the resolution of relative links in markdowns [#6403](https://github.com/eclipse-theia/theia/pull/6403)
- [scm] fixed default selected SCM nodes [#6426](https://github.com/eclipse-theia/theia/pull/6426)
- [task] added content assist for input variables in tasks [#6334](https://github.com/eclipse-theia/theia/pull/6334)
- [task] added registered problem matchers to the tasks schema [#6422](https://github.com/eclipse-theia/theia/pull/6422)
- [task] added support for input variables in tasks [#6331](https://github.com/eclipse-theia/theia/pull/6331)
- [task] added the ability to access task configurations as preferences [#6268](https://github.com/eclipse-theia/theia/pull/6268)
- [terminal] added preference to control default rendering option for terminals [#6471](https://github.com/eclipse-theia/theia/pull/6471)
- [terminal] fixed the hover tooltip to always be displayed above the canvas [#6318](https://github.com/eclipse-theia/theia/pull/6318)
- [textmate-grammars] added better language support for `js`, `ts` and `jsx` files [#5976](https://github.com/eclipse-theia/theia/pull/5976)
- [workspace] deprecated `getDefaultWorkspacePath` on the `WorkspaceService` as the method name was misleading. Use `getDefaultWorkspaceUri` instead [#6432](https://github.com/eclipse-theia/theia/issues/6432)

Breaking changes:

- [core | monaco | task] aligned `ActionProvider` related entities with VS Code [6302](https://github.com/eclipse-theia/theia/pull/6302)
- [plugin] added handling to not block web socket with many plugins [6252](https://github.com/eclipse-theia/theia/pull/6252)
  - `PluginModel` does not have anymore `contributes` and `dependencies` to avoid sending unnecessary data
    - use `PluginReader.readContribution` to load contributes
    - use `PluginReader.readDependencies` to load dependencies
  - `PluginMetadata` does not have anymore raw package.json model to avoid sending excessive data to the frontend
    - `theia.Plugin.packageJSON` throws an unsupported error for frontend plugins as a consequence. Please convert to a backend plugin if you need access to it
  - `PluginManagerExt.$init` does not start plugins anymore, but only initialize the manager RPC services to avoid sending excessive initialization data, as all preferences, on each deployment
    - please call `$start` to start plugins
  - `PluginDeployerHandler.getPluginMetadata` is replaced with `PluginDeployerHandler.getPluginDependencies` to access plugin dependencies
  - `HostedPluginServer.getDeployedMetadata` is replaced with `HostedPluginServer.getDeployedPluginIds` and `HostedPluginServer.getDeployedPlugins` to fetch first only ids of deployed plugins and then deployed metadata for only yet not loaded plugins
  - `HostedPluginDeployerHandler.getDeployedFrontendMetadata` and `HostedPluginDeployerHandler.getDeployedBackendMetadata` are replaced with `HostedPluginDeployerHandler.getDeployedFrontendPluginIds`, `HostedPluginDeployerHandlergetDeployedBackendPluginIds` and `HostedPluginDeployerHandler.getDeployedPlugin` to fetch first only ids and then deployed metadata fro only yet not loaded plugins
  - `PluginHost.init` can initialize plugins asynchronous, synchronous initialization is still supported
  - `HostedPluginReader.doGetPluginMetadata` is renamed to `HostedPluginReader.getPluginMetadata`
  - `PluginDebugAdapterContribution.languages`, `PluginDebugAdapterContribution.getSchemaAttributes` and `PluginDebugAdapterContribution.getConfigurationSnippets` are removed to prevent sending the contributions second time to the frontend. Debug contributions are loaded statically from the deployed plugin metadata instead. The same for corresponding methods in `DebugExtImpl`
- [task] removed `watchedConfigFileUris`, `watchersMap` `watcherServer`, `fileSystem`, `configFileUris`, `watchConfigurationFile()` and `unwatchConfigurationFile()` from `TaskConfigurations` class [6268](https://github.com/eclipse-theia/theia/pull/6268)
- [task] removed `configurationFileFound` from `TaskService` class. [6268](https://github.com/eclipse-theia/theia/pull/6268)

## v0.11.0 - 29/09/2019

- [core] added <kbd>ENTER</kbd> event handler to the open button in explorer [#6158](https://github.com/eclipse-theia/theia/pull/6158)
- [core] added firing of JSON schema changed events if an underlying in-memory resource is changed [#6035](https://github.com/eclipse-theia/theia/pull/6035)
- [core] added clipboard plugin API [#5994](https://github.com/eclipse-theia/theia/pull/5994)
- [core] added command and toolbar item to disable auto sync [#5986](https://github.com/eclipse-theia/theia/pull/5986)
- [core] added handling to only update the menu if the frontend is ready [#5140](https://github.com/eclipse-theia/theia/pull/5140)
- [core] added handling to reject invalid preference schemas [#6110](https://github.com/eclipse-theia/theia/pull/6110)
- [core] added schema check to statically typed APIs [#6090](https://github.com/eclipse-theia/theia/pull/6090)
- [core] added the passing of the current widget to react tabbar toolbar items [#6220](https://github.com/eclipse-theia/theia/pull/6220)
- [core] added visual feedback to clicked toolbar items [#6099](https://github.com/eclipse-theia/theia/pull/6099)
- [core] extracted the top-panel removal into it's own method for extensibility [#6261](https://github.com/eclipse-theia/theia/pull/6261)
- [core] fixed the command palette filter to accept leading whitespaces [#6225](https://github.com/eclipse-theia/theia/pull/6225)
- [core] fixed webview theme styles [#6155](https://github.com/eclipse-theia/theia/pull/6155)
- [core] improved application initialization performance [#6172](https://github.com/eclipse-theia/theia/pull/6172)
- [core] improved warning message for 'potential memory leak' [#6173](https://github.com/eclipse-theia/theia/pull/6173)
- [core] optimized tabbar decorations rendering [#6044](https://github.com/eclipse-theia/theia/pull/6044)
- [core] added handling to prevent the default browser drag-and-drop behavior when dragging a file from the filesystem into the application [#6188](https://github.com/eclipse-theia/theia/pull/6188)
- [core] updated inversify to 5.0.1 [#6184](https://github.com/eclipse-theia/theia/pull/6184)
- [core] updated the alignment of tabbar icons for consistency [#6199](https://github.com/eclipse-theia/theia/pull/6199)
- [core] updated the display of menus to better represent the availability of menu items [#6199](https://github.com/eclipse-theia/theia/pull/6199)
- [core] updated the main area to have a default background [#6196](https://github.com/eclipse-theia/theia/pull/6196)
- [core] upgraded LSP version to 5.3.0 [#5901](https://github.com/eclipse-theia/theia/pull/5901)
- [cpp] added handling to force language client contribution restart on reconnect [#6205](https://github.com/eclipse-theia/theia/pull/6205)
- [debug] added electron backend and composite electron launch configurations [#6226](https://github.com/eclipse-theia/theia/pull/6226)
- [debug] ignored additional breakpoints returned by `setBreakpoints` request [#6044](https://github.com/eclipse-theia/theia/pull/6044)
- [docs] updated documentation on how to profile [#6087](https://github.com/eclipse-theia/theia/pull/6087)
- [docs] updated documentation to include new debug launch configurations [#6241](https://github.com/eclipse-theia/theia/pull/6241)
- [docs] updated documentations on how to debug the plugin host [#6081](https://github.com/eclipse-theia/theia/pull/6081)
- [getting-started] added ability to <kbd>tab</kbd> links in the getting-started widget [#6162](https://github.com/eclipse-theia/theia/pull/6162)
- [git] added better handling for attempting to perform a sign-off without the proper git config settings [#6222](https://github.com/eclipse-theia/theia/pull/6222)
- [git] fixed a bug which prevented creating branches [#6071](https://github.com/eclipse-theia/theia/pull/6071)
- [git] fixed issue to only show the list of amended commits for the correct parent [#6242](https://github.com/eclipse-theia/theia/pull/6242)
- [git] updated the git diff list to use perfect scrollbar [#6085](https://github.com/eclipse-theia/theia/pull/6085)
- [languages] added handling to avoid activation on startup if there is no other activation events [#6164](https://github.com/eclipse-theia/theia/pull/6164)
- [languages] added registration of language features even if a language is not registered [#6145](https://github.com/eclipse-theia/theia/pull/6145)
- [markers] fixed false positive tabbar decorations [#6132](https://github.com/eclipse-theia/theia/pull/6132)
- [markers] optimized problem status rendering [#6044](https://github.com/eclipse-theia/theia/pull/6044)
- [monaco] added registration of Monaco keybindings in reverse order [#6170](https://github.com/eclipse-theia/theia/pull/6170)
- [monaco] updated semantic highlighting styles and tokenization [#5941](https://github.com/eclipse-theia/theia/pull/5941)
- [monaco] upgrade Monaco version to 0.17.0 [#5901](https://github.com/eclipse-theia/theia/pull/5901)
- [plugin-dev] fixed restart instance on debug restarts [#6131](https://github.com/eclipse-theia/theia/pull/6131)
- [plugin-ext] added `onURI` as a supported activation event [#6044](https://github.com/eclipse-theia/theia/pull/6044)
- [plugin-ext] added ability to set active editor on startup [#6152](https://github.com/eclipse-theia/theia/pull/6152)
- [plugin-ext] added better mapping of dependencies to VSCode built-ins [#6207](https://github.com/eclipse-theia/theia/pull/6207)
- [plugin-ext] added handling to wait for a workspace to be ready before computing the storage paths for plugins [#6248](https://github.com/eclipse-theia/theia/pull/6248)
- [plugin-ext] added plugin ID to register commands [#6214](https://github.com/eclipse-theia/theia/pull/6214)
- [plugin-ext] added support for `contribute.keybindings` to accept objects or arrays [#6243](https://github.com/eclipse-theia/theia/pull/6243)
- [plugin-ext] added support for `vscode.extension.contributes.configuration` to be an array [#6078](https://github.com/eclipse-theia/theia/pull/6078)
- [plugin-ext] ensured that command arguments are safely passed via jsonrpc [#6044](https://github.com/eclipse-theia/theia/pull/6044)
- [plugin-ext] extracted method in PluginReader to handle missing plugin resources [#6126](https://github.com/eclipse-theia/theia/pull/6126)
- [plugin-ext] fixed SCM statusbar commands [#6236](https://github.com/eclipse-theia/theia/pull/6236)
- [plugin-ext] fixed issue where document change `rangeOffset` was not properly passed [#6044](https://github.com/eclipse-theia/theia/pull/6044)
- [plugin-ext] fixed the disposal of deploy listeners on close [#6127](https://github.com/eclipse-theia/theia/pull/6127)
- [plugin-ext] implemented SCM repository selected event [#6150](https://github.com/eclipse-theia/theia/pull/6150)
- [plugin-ext] implemented `Plugin.isActive` check [#6044](https://github.com/eclipse-theia/theia/pull/6044)
- [plugin-ext] implemented `registerDeclarationProvider` API [#6173](https://github.com/eclipse-theia/theia/pull/6173)
- [plugin-ext] implemented `vscode.env.openExternal` API [#6044](https://github.com/eclipse-theia/theia/pull/6044)
- [plugin-ext] implemented selection and visible tree view APIs [#6044](https://github.com/eclipse-theia/theia/pull/6044)
- [plugin-ext] refactored languagesMain and outputChannelRegistry to use dependency injection [#6148](https://github.com/eclipse-theia/theia/pull/6148)
- [plugin-ext] updated hidden view containers to remain hidden on startup [#6141](https://github.com/eclipse-theia/theia/pull/6141)
- [plugin-ext] updated plugin host to not crash on activation errors [#6097](https://github.com/eclipse-theia/theia/pull/6097)
- [plugin-ext] updated plugin unzipping logs to be less verbose [#6149](https://github.com/eclipse-theia/theia/pull/6149)
- [plugin] fixed issue where `withProgress` would not start task immediately [#6123](https://github.com/eclipse-theia/theia/pull/6123)
- [preferences] added handling to prevent closing preference editors with the middle mouse click [#6198](https://github.com/eclipse-theia/theia/pull/6198)
- [preferences] fixed issue where workspace configurations contributed by VSCode extensions did not take effect [#6090](https://github.com/eclipse-theia/theia/pull/6090)
- [scm] removed hover background on scm inline action buttons [#6094](https://github.com/eclipse-theia/theia/pull/6094)
- [scm] updated `scm` widget styling [#6116](https://github.com/eclipse-theia/theia/pull/6116)
- [search-in-workspace] improved the display of the search-in-workspace widget [#6199](https://github.com/eclipse-theia/theia/pull/6199)
- [search-in-workspace] updated `search-in-workspace` widget styling [#6116](https://github.com/eclipse-theia/theia/pull/6116)
- [task] added `tasks.fetchTasks()` and `tasks.executeTask()` Plug-in APIs [#6058](https://github.com/eclipse-theia/theia/pull/6058)
- [task] added ability to prompt user to choose parser to parse task output [#5877](https://github.com/eclipse-theia/theia/pull/5877)
- [textmate] updated handling to not warn if the same grammar is registered multiple times [#6125](https://github.com/eclipse-theia/theia/pull/6125)
- [vscode] added parsing view contribution `when` contexts [#6068](https://github.com/eclipse-theia/theia/pull/6068)
- [vscode] added support for active/focus view or panel `when` clause context [#6062](https://github.com/eclipse-theia/theia/pull/6062)
- [vscode] updated default vscode API version to 1.38.0 [#6112](https://github.com/eclipse-theia/theia/pull/6112)

Breaking changes:

- [core][monaco][plugin] added handling to reload plugins on reconnection [#6159](https://github.com/eclipse-theia/theia/pull/6159)
  - Extenders should implement `Disposable` for plugin main services to handle reconnection properly
  - Many APIs are refactored to return `Disposable`
- [core][plugin] added support for alternative commands in context menus [#6069](https://github.com/eclipse-theia/theia/pull/6069)
- [monaco] added support for `monaco.languages.ResourceFileEdit` [#4723](https://github.com/eclipse-theia/theia/issues/4723)
- [workspace] enable the preference `workspace.supportMultiRootWorkspace` by default [#6089](https://github.com/eclipse-theia/theia/pull/6089)

Misc:

This repo was moved to the `eclipse-theia` organization. Though GitHub automatically redirects from the old repo to the new one, we'll use the new one from now on in this file.

## v0.10.0 - 29/08/2019

- [core] added ability to execute tasks via keybindings [#5913](https://github.com/theia-ide/theia/pull/5913)
- [core] added better handling for the `SingleTextInputDialog` `onEnter` [#5868](https://github.com/theia-ide/theia/pull/5868)
- [core] added handling for command handler errors [#5894](https://github.com/theia-ide/theia/pull/5894)
- [core] added propagation of phosphor events to view container widgets [#5817](https://github.com/theia-ide/theia/pull/5817)
- [core] added support for HTML titles for widgets in the sidebar [#5948](https://github.com/theia-ide/theia/pull/5948)
- [core] added support for path normalization [#5918](https://github.com/theia-ide/theia/pull/5918)
- [core] added the optional flag `runIfSingle` for `QuickPickOptions` [#6059](https://github.com/theia-ide/theia/pull/6059)
- [core] fixed issue where the last visible view container was not preserved [#5817](https://github.com/theia-ide/theia/pull/5817)
- [core] fixed menu bar color [#6014](https://github.com/theia-ide/theia/pull/6014)
- [core] improved `QuickInput` and `QuickInputBox` APIs [#5187](https://github.com/theia-ide/theia/pull/5187)
- [core] supported diagnostic marker in the tab bar [#5845](https://github.com/theia-ide/theia/pull/5845)
- [cpp] added support for multiple root cpp build configurations [#4603](https://github.com/theia-ide/theia/pull/4603)
- [cpp] enabled better semantic highlighting support [#5850](https://github.com/theia-ide/theia/pull/5850)
- [cpp] moved cpp grammars from the `@theia/cpp` extension to the `@theia/textmate-grammars` extension [#5803](https://github.com/theia-ide/theia/pull/5803)
- [debug] added progress indicator for the debug widget [#6009](https://github.com/theia-ide/theia/pull/6009)
- [debug] ensured that terminate flags are properly restarted [#5954](https://github.com/theia-ide/theia/pull/5954)
- [debug] fixed issue where the debug icons remain opaque after a debug session has terminated [#5933](https://github.com/theia-ide/theia/pull/5933)
- [debug] removed superfluous scrollbars [#5879](https://github.com/theia-ide/theia/pull/5879)
- [editor] added support for tab details to disambiguate identical tabs [#5775](https://github.com/theia-ide/theia/pull/5775)
- [editor] added support to re-open files with different encodings [#5371](https://github.com/theia-ide/theia/pull/5371)
- [editor] added support to set default file encoding [#5371](https://github.com/theia-ide/theia/pull/5371)
- [editor] updated editor tabbar captions for better multi-root support [#5924](https://github.com/theia-ide/theia/pull/5924)
- [file-search] improved Windows support [#6029](https://github.com/theia-ide/theia/pull/6029)
- [git] added progress indicators for scm/git operations [#5830](https://github.com/theia-ide/theia/pull/5830)
- [git] added support to initialize a workspace as a git repository [#6008](https://github.com/theia-ide/theia/pull/6008)
- [git] fixed the git-diff widget header details alignment [#5998](https://github.com/theia-ide/theia/pull/5998)
- [git] updated ls-files so it works with Git >= 2.16 [#5851](https://github.com/theia-ide/theia/pull/5851)
- [keymaps] fixed clumsy auto-suggestion dropdown [#5990](https://github.com/theia-ide/theia/pull/5990)
- [markers] added problem markers to editor tabs [#5845](https://github.com/theia-ide/theia/pull/5845)
- [markers] added the preference `problems.decorations.enabled` to control the display of problem markers in tree widgets [#6021](https://github.com/theia-ide/theia/pull/6021)
- [messages] reworked messages and added a notification center [#5830](https://github.com/theia-ide/theia/pull/5830)
- [mini-browser] added support for editor/title context menus for webviews [#6030](https://github.com/theia-ide/theia/pull/6030)
- [monaco] aligned snippet completion logic with VSCode [#5931](https://github.com/theia-ide/theia/pull/5931)
- [navigator] added support for multi-file copy [#5864](https://github.com/theia-ide/theia/pull/5864)
- [navigator] added the toolbar item `more actions...` for the explorer [#5953](https://github.com/theia-ide/theia/pull/5953)
- [navigator] added the toolbar item `refresh` to force a refresh of the explorer [#5940](https://github.com/theia-ide/theia/pull/5940)
- [outline] added `OutlineViewTreeModel` for the outline view tree widget [#5687](https://github.com/theia-ide/theia/pull/5687)
- [outline] added the toolbar item `collapse-all` for the outline widget [#5687](https://github.com/theia-ide/theia/pull/5687)
- [outline] updated the keybinding for `toggle outline view` to avoid conflict [#5707](https://github.com/theia-ide/theia/pull/5707)
- [plugin-ext] added `ignoreFocusOut` parameter support for the `QuickPick` [#5900](https://github.com/theia-ide/theia/pull/5900)
- [plugin-ext] added automatic downloading of `extensionDependencies` [#5379](https://github.com/theia-ide/theia/pull/5379)
- [plugin-ext] added support for theming webview content [#5981](https://github.com/theia-ide/theia/pull/5981)
- [plugin-ext] fixed leaking java debug process [#5281](https://github.com/theia-ide/theia/pull/5281)
- [plugin-ext] fixed plugin-ext file path error [#5929](https://github.com/theia-ide/theia/pull/5929)
- [plugin] added additional support for `QuickPick` API [#5766](https://github.com/theia-ide/theia/pull/5766)
- [plugin] added better error handling for plugins that cannot find files [#6002](https://github.com/theia-ide/theia/pull/6002)
- [plugin] added cache for command arguments to safely pass them over JSON-RPC [#5961](https://github.com/theia-ide/theia/pull/5961)
- [plugin] added view containers support [#5665](https://github.com/theia-ide/theia/pull/5665)
- [search-in-workspace] added display of leading and trailing whitespaces in the search-in-workspace results [#5989](https://github.com/theia-ide/theia/pull/5989)
- [search-in-workspace] added progress indicator for search-in-workspace [#5980](https://github.com/theia-ide/theia/pull/5980)
- [search-in-workspace] fixed clumsy auto-suggestion dropdown [#5990](https://github.com/theia-ide/theia/pull/5990)
- [search-in-workspace] fixed the alignment in the search-in-workspace result note [#5802](https://github.com/theia-ide/theia/pull/5802)
- [search-in-workspace] modified `replace-all` functionality to save changes to editors without opening them [#5600](https://github.com/theia-ide/theia/pull/5600)
- [task] added display of process tasks in the terminal [#5895](https://github.com/theia-ide/theia/pull/5895)
- [task] added multi-root support to "configure task" and customizing tasks in `tasks.json` [#5777](https://github.com/theia-ide/theia/pull/5777)
- [task] added support for VSCode task contribution points: `taskDefinitions`, `problemMatchers`, and `problemPatterns` [#5777](https://github.com/theia-ide/theia/pull/5777)
- [task] added the display of configured tasks when executing `configure tasks...` [#5472](https://github.com/theia-ide/theia/pull/5472)
- [task] allowed users to override any task properties other than the ones used in the task definition [#5777](https://github.com/theia-ide/theia/pull/5777)
- [task] changed the way that "configure task" copies the entire task config, to only writing properties that define the detected task plus [#5777](https://github.com/theia-ide/theia/pull/5777)`problemMatcher`, into `tasks.json`
- [task] displayed the customized tasks as "configured tasks" in the task quick open [#5777](https://github.com/theia-ide/theia/pull/5777)
- [task] fixed the problem where a detected task can be customized more than once [#5777](https://github.com/theia-ide/theia/pull/5777)
- [task] notified clients of TaskDefinitionRegistry on change [#5915](https://github.com/theia-ide/theia/pull/5915)
- [task] updated `isVisible` and `isEnabled` handling for `Run Selected Text` [#6018](https://github.com/theia-ide/theia/pull/6018)
- [task] added support for removing all data from tasks.json [#6033](https://github.com/theia-ide/theia/pull/6033)
- [task] updated compare task to use task definitions [#5975](https://github.com/theia-ide/theia/pull/5975)
- [terminal] added a preference `terminal.integrated.scrollback` to control the terminal scrollback [#5783](https://github.com/theia-ide/theia/pull/5783)
- [vscode] added support for `command` variable substitution [#5835](https://github.com/theia-ide/theia/pull/5835)
- [vscode] added support for `config` variable substitution [#5835](https://github.com/theia-ide/theia/pull/5835)
- [vscode] added support for `execPath` variable substitution [#5835](https://github.com/theia-ide/theia/pull/5835)
- [vscode] added support for `inputs` variable substitution for debug [#5835](https://github.com/theia-ide/theia/pull/5835)
- [vscode] added support for `selectedText` variable substitution [#5835](https://github.com/theia-ide/theia/pull/5835)
- [vscode] added support for `when` closure for views [#5855](https://github.com/theia-ide/theia/pull/5855)
- [vscode] added support for environment variable substitution [#5811](https://github.com/theia-ide/theia/pull/5811)
- [vscode] added support for workspace scoped variable substitution [#5835](https://github.com/theia-ide/theia/pull/5835)
- [vscode] fixed resolution of environment variables [#5835](https://github.com/theia-ide/theia/pull/5835)

Breaking changes:

- [core] refactored `TreeDecoration` to `WidgetDecoration` and moved it to shell, since it is a generic decoration that can be used by different types of widgets (currently by tree nodes and tabs) [#5845](https://github.com/theia-ide/theia/pull/5845)
- [plugin]refactored  files from 'plugin-ext/src/api' moved to 'plugin-ext/src/common', renamed 'model.ts' to 'plugin-api-rpc-model.ts', 'plugin-api.ts' to 'plugin-api-rpc.ts'
- [shell][plugin] integrated view containers and views [#5665](https://github.com/theia-ide/theia/pull/5665)
  - `Source Control` and `Explorer` are view containers now and previous layout data cannot be loaded for them. Because of it the layout is completely reset.
- [task] `TaskService.getConfiguredTasks()` returns `Promise<TaskConfiguration[]>` instead of `TaskConfiguration[]` [#5777](https://github.com/theia-ide/theia/pull/5777)
- [task] ensured that plugin tasks are registered before accessing them [5869](https://github.com/theia-ide/theia/pull/5869)
  - `TaskProviderRegistry` and `TaskResolverRegistry` are promisified
- [task] removed `filterDuplicates()` from `TaskConfigurations` class [#5915](https://github.com/theia-ide/theia/pull/5915)
- [vscode] completed support of variable substitution [#5835](https://github.com/theia-ide/theia/pull/5835)
  - inline `VariableQuickOpenItem`

## v0.9.0 - 25/07/2019

- [core] added `theia-widget-noInfo` css class to be used by widgets when displaying no information messages [#5717](https://github.com/theia-ide/theia/pull/5717)
- [core] added additional options to the tree search input [#5566](https://github.com/theia-ide/theia/pull/5566)
- [core] added fix to prevent the IDE from scrolling along with the text on mobile (e.g. on iPad) [#5742](https://github.com/theia-ide/theia/pull/5742)
- [core] added view container layout changes [#5536](https://github.com/theia-ide/theia/pull/5536)
- [core] fixed the alignment of the expansion icon [#5677](https://github.com/theia-ide/theia/pull/5677)
- [core] fixed the toolbar item comparator [#5624](https://github.com/theia-ide/theia/pull/5624)
- [core] updated quick-open UI [#5733](https://github.com/theia-ide/theia/pull/5733)
- [cpp] added the ability to run `clang-tidy` as a task [#5533](https://github.com/theia-ide/theia/pull/5533)
- [debug] fixed behavior of creating launch configurations always under the '.theia' folder [#5678](https://github.com/theia-ide/theia/pull/5678)
- [debug] updated to ensure that node-based debug adapters spawn the same node executable as Theia [#5508](https://github.com/theia-ide/theia/pull/5508)
- [doc] updated `node.js` prerequisites [#5643](https://github.com/theia-ide/theia/pull/5643)
- [editor] added `Toggle Minimap` command [#5633](https://github.com/theia-ide/theia/pull/5633)
- [filesystem] disposed the clipboard copy listener [#5709](https://github.com/theia-ide/theia/pull/5709)
- [filesystem] fixed file dialog opening folder [#4868](https://github.com/theia-ide/theia/pull/4868)
- [filesystem] fixed scaling issues of save and file dialogs in small viewports [#5688](https://github.com/theia-ide/theia/pull/5688)
- [filesystem] improved the download of large files [#5466](https://github.com/theia-ide/theia/pull/5466)
- [git] improved the support for empty Git repositories in the `Git` and `Git History` view [#5484](https://github.com/theia-ide/theia/pull/5484)
- [keymaps] added the `Reset` button directly when attempting to update a command's keybinding [#5603](https://github.com/theia-ide/theia/pull/5603)
- [keymaps] aligned the keybindings widget with VSCode [#5545](https://github.com/theia-ide/theia/pull/5545)
- [markers] added support for `Information` diagnostic severity [#5763](https://github.com/theia-ide/theia/pull/5763)
- [markers] enabled single-click and keyboard arrow selection to navigate problem markers [#5646](https://github.com/theia-ide/theia/pull/5646)
- [messages] fixed the button positioning when displaying messages with a multiple lines of text [#5657](https://github.com/theia-ide/theia/pull/5657)
- [monaco] added re-detect languages on new grammar [#5754](https://github.com/theia-ide/theia/pull/5754)
- [monaco] fixed textmate highlighting when changing themes [#5728](https://github.com/theia-ide/theia/pull/5728)
- [monaco] fixed the alignment of the file icon in the quick-open menus [#5725](https://github.com/theia-ide/theia/pull/5725)
- [plugin-dev] added the path in the PluginFolder notification [#5731](https://github.com/theia-ide/theia/pull/5731)
- [plugin-dev] fixed the run/debug flow on Windows [#5608](https://github.com/theia-ide/theia/pull/5608)
- [plugin-ext] fixed the display of webview icons in the sidepanel [#5723](https://github.com/theia-ide/theia/pull/5723)
- [plugin-ext] fixed workspace name getter when no folders are opened [#5588](https://github.com/theia-ide/theia/pull/5588)
- [plugin] added support of debug activation events [#5645](https://github.com/theia-ide/theia/pull/5645)
- [plugin] fixed `converting circular structure to JSON` error [#5661](https://github.com/theia-ide/theia/pull/5661)
- [plugin] fixed auto detection of new languages [#5753](https://github.com/theia-ide/theia/issues/5753)
- [plugin] fixed plugin loading to better support modules that have immutable exports [#5520](https://github.com/theia-ide/theia/pull/5520)
- [plugin] improved `node.js` error handling [#5695](https://github.com/theia-ide/theia/pull/5695)
- [scm] fixed the alignment of the status item [#5729](https://github.com/theia-ide/theia/pull/5729)
- [search-in-workspace] added 'title' to search result nodes [#5628](https://github.com/theia-ide/theia/pull/5628)
- [search-in-workspace] added the `search.collapseResults` preference to the search-in-workspace widget [#5686](https://github.com/theia-ide/theia/pull/5686)
- [search-in-workspace] fixed issue which displayed 'No results found' while a user types their search [#5701](https://github.com/theia-ide/theia/pull/5701)
- [search-in-workspace] improved the ordering of the search results [#5669](https://github.com/theia-ide/theia/pull/5669)
- [search-in-workspace] updated the `Replace All` disabled state [#5611](https://github.com/theia-ide/theia/pull/5611)
- [security] updated the version of `lodash.mergewith` from 4.6.1 to 4.6.2 [#5700](https://github.com/theia-ide/theia/pull/5700)
- [task] added support for Linux and OSX specific command properties [#5579](https://github.com/theia-ide/theia/pull/5579)
- [task] added support for VSCode task contribution points: `taskDefinitions`, `problemMatchers`, and `problemPatterns` [#5024](https://github.com/theia-ide/theia/pull/5024)
- [task] disposed task listeners and emitters when necessary [#5024](https://github.com/theia-ide/theia/pull/5024)
- [terminal] implemented `Show All Opened Terminals` quick-open menu [#5577](https://github.com/theia-ide/theia/pull/5577)
- [terminal] updated `processId` and `cwd` to return a rejected promise instead of throwing an error [#5553](https://github.com/theia-ide/theia/pull/5553)
- [vscode] added unzipping of node_modules for built-in extensions [#5756](https://github.com/theia-ide/theia/pull/5756)
- [workspace] added handling to not re-open a workspace that is currently opened [#5632](https://github.com/theia-ide/theia/pull/5632)
- [workspace] fixed path variables on Windows [#5741](https://github.com/theia-ide/theia/pull/5741)

Breaking changes:

- [plugin] activate dependencies before activating a plugin [#5661](https://github.com/theia-ide/theia/pull/5661)
- [plugin] added basic support of activation events [#5622](https://github.com/theia-ide/theia/pull/5622)
  - `HostedPluginSupport` is refactored to support multiple `PluginManagerExt` properly
  - Theia plugins should declare the `"activationEvents": ["*"]` entry in the root of the `package.json`. Otherwise, they won't start at app startup. See [#5743](https://github.com/theia-ide/theia/issues/5743) for more details.
- [plugin] added support of `workspaceContains` activation events [#5649](https://github.com/theia-ide/theia/pull/5649)
- [plugin] fixed typo in 'HostedInstanceState' enum from RUNNNING to RUNNING in `plugin-dev` extension [#5608](https://github.com/theia-ide/theia/pull/5608)
- [plugin] removed member `processOptions` from `AbstractHostedInstanceManager` as it is not initialized or used [#5608](https://github.com/theia-ide/theia/pull/5608)


## v0.8.0 - 27/06/2019

- [core] added bépo keyboard layout
- [core] added sorting to the extension names in the about dialog
- [core] added sorting to the prefixed quick-open commands
- [core] added support for octicon icons in the statusbar
- [core] allowed passing of command args to context menus
- [core] added the ability to rebind the `BrowserMenuBarContribution`
- [core] fixed issue with webview resizing
- [core] fixed label encoding for diff uris
- [cored] added `TextareaAutosize` for textarea resizing
- [debug] added throttling to the debug console output
- [debug] fixed breakpoint resizing error in the debug-widget
- [editor] added the ability to rebind the `EditorWidgetFactory`
- [editor] implemented `Show All Opened Editor` command and quick-open menu
- [editor] removed the 'dirty' state of an editor if changes are reverted
- [electron] fixed issue when exiting Electron based applications
- [electron] improved startup performance
- [filesystem] improved animation when dragging and dropping multiple files
- [keymaps] added a toolbar item to open the keymaps.json
- [keymaps] added command to `Open Keyboard Shortcuts (JSON)`
- [keymaps] added toolbar item to clear keybindings-widget search
- [keymaps] enhanced the keybindings-widget search to support different key orders
- [keymaps] fixed the display of key chords in the keybindings-widget
- [keymaps] updated the UI of the keybindings-widget when resizing
- [monaco] fixed overflow with editor hints
- [navigator] added VSCode-like compare for files
- [navigator] added ability to select for compare
- [plugin] added VSCode API to register `DebugAdapterTrackerFactory`
- [plugin] added `setTextDocumentLanguage` Plug-in API
- [preview] added scrolling synchronization between editor and preview
- [preview] fixed issue where preview images were broken
- [problems] added `copy` and `copy message` features to the problems-widget
- [problems] fixed the problem-widget markers from wrapping when resizing
- [task] added the ability to add comments in tasks.json
- [task] added the display of the source folder name for detected tasks in the quick-open
- [task] added the task label in the terminal title when executing tasks
- [task] implemented `Show Running Tasks...` command and quick-open menu
- [terminal] implemented `Terminate Task...` command and quick-open menu

Breaking changes:

- [core] `scheme` is mandatory for URI
  - `URI.withoutScheme` is removed, in order to get a path use `URI.path`
- [core] `SelectionCommandHandler.getMulitSelection()` is renamed into `SelectionCommandHandler.getMultiSelection()`
- [debug] align commands with VS Code [#5102](https://github.com/theia-ide/theia/issues/5102)
    - `debug.restart` renamed to `workbench.action.debug.restart`
- [plugin] 'Hosted mode' extracted in `plugin-dev` extension
- [preferences] removed constructor from the `FolderPreferenceProvider` class
- [preferences] renamed overridenPreferenceName to overriddenPreferenceName
- [task] `cwd`, which used to be defined directly under `Task`, is moved into `Task.options` object
- [workspace] `isMultiRootWorkspaceOpened()` is renamed into `isMultiRootWorkspaceEnabled()`
- [filesystem] Changed `FileDownloadService` API to support streaming download of huge files.

## v0.7.0 - 30/05/2019

- [console] added `Clear Console` command and toolbar item
- [console] fixed issue where the debug console auto-scrolls when is it located at the bottom
- [core] added command to manually choose a keyboard layout
- [core] added functionality for the toolbar to respond to mouse events
- [core] added launch preferences support
- [core] added preference to control the number of recently used items to display
- [core] added support for recently used commands
- [core] added support for several international keyboard layouts
- [core] added the command `Clear Command History`
- [core] fixed issue allowing the load of Theia in an iframe over a protected connection
- [core] implemented auto-detection of keyboard layout based on pressed keys
- [core] updated monaco configurations on default preference changes
- [cpp] added support for OpenCL file types
- [debug] added support for debug configuration prefixed quick-open menu
- [electron] added the command `Close Window`
- [file-upload] fixed reporting uploaded URIs
- [filesystem] added support for multiple files drag and drop
- [java] added new preference to add command line arguments when starting language server
- [markers] added `Collapse All` toolbar item to the problems-widget
- [mini-browser] fixed issue where the mini-browser resizes unnecessarily
- [monaco] removed overriding dark-plus theming
- [navigator] added the command `Collapse Folders in Explorer`
- [navigator] fixed the commands `Remove Folder` and `Add Folder`
- [outline] added informative tooltips to outline view items
- [plugin-ext] added `onDidEndTaskProcess` Plug-in API
- [plugin-ext] added `onDidStartTaskProcess` Plug-in API
- [plugin-ext] added ability to match browser displayed nodes with the plugin created node
- [plugin-ext] added additional command to install VSCode extensions
- [plugin-ext] added support for inline actions
- [plugin-ext] aligned views with Theia styles
- [plugin-ext] fixed he loading of icons
- [plugin-ext] fixed issue of overriding preferences
- [plugin-ext] fixed issue to support single source deployment state
- [plugin-ext] fixed issue where the hosted plugin instance did not properly stop
- [plugin-ext] fixed plugin folder path in Windows
- [plugin-ext] fixed the rendering of png icons
- [plugin-ext] implemented command `workbench.action.reloadWindow`
- [plugin] added file management vscode commands
- [plugin] fixed plugin export
- [preferences] added additional information to the preference tooltips
- [process] added link matcher for local files
- [process] normalized task types and processes
- [tabbar] fixed widget leaking via phosphor VDOM
- [terminal] added ability to activate links with `cmd + click`
- [terminal] added support for basic link matching
- [terminal] fixed random 1px white border in Firefox
- [typescript] fixed broken code actions
- [workspace] allowed `WorkspaceCommandContribution` to be re-bindable by extensions
- [xterm] upgraded xterm to fix terminal dragging between areas

Breaking changes:

- [filesystem] extracted `FileUploadService` and refactored `FileTreeWidget` to use it [#5086](https://github.com/theia-ide/theia/pull/5086)
  - moved `FileDownloadCommands.UPLOAD` to `FileSystemCommands.UPLOAD`
- [git] bind Git UI to SCM
- [output] moved the channel selection and clear icons to the toolbar.
  - The CLEAR_BUTTON and OVERLAY constants are no longer available. Furthermore OutputChannelManager API has changed.
- [preferences] refactored to integrate launch configurations as preferences
- [scm] added Source Control Model
- [core] renamed the `src/electron-main` folder to `src/electron-node` in `@theia/core`. Removed `preventStop` from the `FrontendApplication` API. Move the `DefaultWindowService` class into its own module.

## v0.6.0 - 30/04/2019

- Allowed the creation of sub-files and/or sub-folders if name has `/`
- [core] added `files.enableTrash` preference
- [core] added support for custom React toolbar widgets
- [core] added support for tail decorators
- [core] aligned the statusbar styles with VSCode
- [core] updated the prefix quick-open service to support `actionProviders`
- [cpp] added support for block comment auto-closing pairs
- [editor-preview] fixed error at application startup if no preview editors are opened
- [editor-preview] fixed the `goToDefinition` failure when in editor preview mode
- [electron] added the ability to run plugins by binding the components on the backend
- [electron] added the configure Plug-ins option to the start script
- [electron] updated Electron to include a `minWidth` and `minHeight`
- [electron] upgraded version of Electron used to version 3
- [filesystem] added the menu item `Upload Files...` to easily upload files into a workspace
- [filesystem] implemented `Save As` including a save dialog, and new command
- [filesystem] updated the handling when attempting to perform copying when the source and target are the same
- [git] added ability to toggle `Git History` widget
- [git] fixed `Discard All` alignment when the `Git` widget is too narrow
- [git] fixed `Git History` widget alignment and behavior issues
- [git] updated the ahead/behind icons on the statusbar
- [keyboard] aligned the file and event naming conventions
- [languages] updated error type for backwards compatibility
- [plugin-ext] fixed the Plug-in path selection dialog for the hosted instance
- [plugin] added `CodeActionKind` `intersects` Plug-in API
- [plugin] added necessary Webview Plug-in APIs
- [plugin] added propagation of `thisArg` on `registerCommand`
- [plugin] added support for Gulp, Jake, Grunt Plug-in extensions
- [plugin] added support for extensions without activation functions
- [plugin] added the ability to choose through the CLI which VSCode API version to use
- [plugin] aligned `window.setStatusBarMessage` with VSCode
- [plugin] fixed `vscode.open` command by adding checks on arguments
- [plugin] fixed implementation of `vscode.diff` command
- [plugin] fixed issue where webviews were not focused or revealed properly
- [plugin] fixed memory leak on Plug-ins reload
- [plugin] fixed serialization of `Range` object
- [plugin] fixed the registration of text decoration keys
- [plugin] updated Plug-in language services to hook in monaco cancellation tokens
- [preferences] added ability to override default application preference values
- [search-in-workspace] added the ability to pass the currently selected editor text when searching
- [security] fixed XSS vulnerability
- [task] added command to clear task history
- [task] added support to configure tasks
- [task] added the ability to configure tasks
- [task] added the ability to display recently used tasks
- [task] updated the tasks quick-open menu including alignment, category labels and borders
- [terminal] updated terminal preference's minimum value for `lineHeight` and `fontSize`
- [textmate-grammars] added php grammar
- [textmate-grammars] added rust grammar
- [textmate-grammars] fixed incorrect jsx scope
- [tree] added support for icons in node tail decorators
- [workspace] allowed the creation of files and folders using recursive paths
- [workspace] fixed incorrect file-icon when displaying recent workspaces

Breaking changes:

- [core] added support native keyboard layouts [#4724](https://github.com/theia-ide/theia/pull/4724)
- [dialog] updated `validate` and `accept` methods so they are now Promisified [#4764](https://github.com/theia-ide/theia/pull/4764)
- [editor] turned off autoSave by default to align with VSCode [#4777](https://github.com/theia-ide/theia/pull/4777)
  - default settings can be overridden in application package.json:
  ```json
  {
    "private": true,
    "name": "myapp",
    "theia": {
      "frontend": {
        "config": {
          "preferences": {
            "editor.autoSave": "on"
          }
        }
      }
    }
  }
  ```
- [electron] removed cluster mode and startup timeout setting
- [electron] updated Electron to make runtime dependencies optional [#4873](https://github.com/theia-ide/theia/pull/4873)
- [extension-manager] deprecated [#4876](https://github.com/theia-ide/theia/pull/4876)
- [node] moved to using Node.js version 10, dropping support for Node.js version 8

## v0.5.0 - 28/03/2019

- Added `scope` to task configurations to differentiate 3 things: task type, task source, and where to run tasks
- [core] added implementation for toolbar support for sidepanels and changed sidepanel tabs
- [core] added new keybinding <kbd>alt</kbd>+<kbd>shift</kbd>+<kbd>w</kbd> to close all main area tabs
- [core] added the ability to make sidebar widgets closable
- [core] fixed `ToolbarAwareTabBar` detachment errors
- [core] fixed broken wheel listener
- [core] improved scrollbar styling
- [core] updated tabbar toolbar to use VSCode icons
- [core] updated the UI with numerous improvements including sidepanel icons, better alignment, tabbar and menu size
- [cpp] added new `cpp.clangTidy `and `cpp.clangTidyChecks` preferences to lint cpp program when clangd v9+ is used
- [cpp] fixed properly restarting clangd language server when changing cpp build configurations
- [debug] added new debug preferences to control `view`, `console`, and `location` appearance
- [editorconfig] added support to apply properties to monaco editor when opening/switching editors
- [file-search] improved ordering and consistency of file search results
- [filesystem] added `files.associations` property
- [filesystem] improved the performance when deleting large directories
- [filesystem] upgraded `nsfw` file-watching dependency from `vscode-nsfw` to `Axosoft/nsfw` which fixes memory leaks as well as fixes issues where files are not being properly watched outside the main watched directory
- [git] fixed issue where Theia did not refresh the git view after deleting the only repository
- [git] improved the git diff navigation header to be static
- [java] improved handling of incomplete classpath commands
- [keybindings] improved the keybindings widget search and table header to be static
- [mini-browser] improved error handling of iframe errors
- [navigator] added `Collapse All` toolbar item
- [navigator] updated the navigator to handle multi-root workspaces better
- [plugin-ext] added `workspace.onDidRenameFile ` Plug-in API
- [plugin-ext] added `workspace.onWillRenameFile ` Plug-in API
- [plugin-ext] added `workspace.registerFileSystemProvider` Plug-in API
- [plugin-ext] added `workspace.saveAll` Plug-in API
- [plugin-ext] added `workspace.updateWorkspaceFolders` Plug-in API
- [plugin-ext] added ability to proceed `runInTerminal` requests in sidecar containers
- [plugin-ext] added the ability to get selection context after executing a command
- [plugin-ext] fixed VSCode Plug-in API incompatibilities for the `onDidChangeActiveTextEditor` event
- [plugin-ext] fixed firing the `onWillSaveTextDocument` event
- [plugin-ext] fixed issue of re-deploying already initialized plugins
- [plugin] `workspace.openTextDocument` API now respects the contributed `FileSystemProviders`
- [plugin] added support for multiple windows per backend
- [plugin] fixed progress creation
- [plugin] improved the view container to use the native toolbar
- [preferences] fixed content assist when editing `settings.json`
- [preferences] fixed parsing of settings from workspace files
- [preferences] improved overriding of default configurations
- [preview] fixed issue when opening images
- [search-in-workspace] added a new preference `search.lineNumbers` to control whether to show line numbers for search results
- [task] added ability to `Run Selected Text`
- [task] added new command to re-run the last task
- [task] added schema support for `tasks.json`
- [typehierarchy] added the new type hierarchy extension
- [typehierarchy] improved `typehierarchy` to use all levels the language server sends if available
- [workspace] added new `package.json` properties `newFIleName` and `newFileExtension` to specify default file name and extension when creating a new file
- [workspace] improved performance of the file rename action for large directories

Breaking changes:

- [editor] computation of resource context keys moved to core [#4531](https://github.com/theia-ide/theia/pull/4531)
- [plugin] support multiple windows per a backend [#4509](https://github.com/theia-ide/theia/issues/4509)
  - Some plugin bindings are scoped per a connection now. Clients, who contribute/rebind these bindings, will need to scope them per a connection as well.
- [quick-open] disable separate fuzzy matching by default [#4549](https://github.com/theia-ide/theia/pull/4549)
- [shell] support toolbars in side bars [#4600](https://github.com/theia-ide/theia/pull/4600)
  - In side bars a widget title is rendered as an icon.

## v0.4.0 - 28/02/2019

- [application-manager] added support for pre-load HTML templates
- [console] added support for console `when` contexts
- [core] added support for os `when` contexts
- [core] added support for shell `when` contexts
- [core] added support for vscode closure contexts
- [core] fixed bad vertical resizing behavior
- [core] improved scrollbar visibility for the command palette
- [core] improved tab-bar display (display 'X' (close) on dirty editors when hovering over dirty icon)
- [core] improved tab-bar display (display 'X' (close) only when current editor is active, or has hover)
- [cpp] fixed `CPP_CLANGD_COMMAND` and `CPP_CLANGD_ARGS` environment variables
- [cpp] fixed the update of the active build config statusbar when preferences are updated
- [cpp] implemented the command `Create New Build Configuration`
- [cpp] implemented the command `Reset Build Configuration`
- [cpp] removed duplicate json config entry generated by the command `New Build Config`
- [debug] added support for debug mode `when` contexts
- [editor] added `Clear Editor History` command
- [editor] added support for editor `when` contexts
- [editor] added support for resource `when` contexts
- [editor] registered editor to navigation location stack when `onCurrentEditorChange` event is fired
- [electron] improved opening markdown links by opening them in the OS' default browser
- [electron] stored the last state of window geometry
- [file-search] added separator between recently opened items, and file results when executing the quick file open
- [file-search] added support for ignored globs and limit in file search
- [file-search] improved quick open file sort order
- [file-search] removed git diff editors from displaying the quick file open
- [file-search] added support for `glob` file searches
- [file-search][plugin-ext] updated `exclude` of file search
- [git] added the following git commands: `Stash`, `Apply Stash`, `Apply Latest Stash`, `Pop Stash`, `Pop Latest Stash` and `Drop Stash`
- [git] enhanced `Git Remote` command to obtain complete data
- [git] fixed refreshing the `GitView` when git repo changes
- [git] fixed the command `Git Reset`
- [git] removed bundled git from `dugite`
- [languages] fixed clash in language server session ids
- [messages] added support for notification `when` contexts
- [mini-browser] added ability to pass argument for `openUrl` command
- [monaco] added support for quick open `when` contexts
- [monaco] added support for snipped mode `when` contexts
- [navigator] added support for explorer `when` contexts
- [navigator] fixed updating the navigator context menu on `supportMultiRootWorkspace` preference change
- [plugin-ext-vscode] added ability to handle `vscode.diff` and open diff editor commands
- [plugin-ext-vscode] added vscode `setContext` command
- [plugin-ext-vscode] fixed local resource loading in webviews
- [plugin-ext] fixed `TreeView` widget registration
- [plugin-ext] fixed `onDidSelectItem` behavior for the quick pick widget
- [plugin-ext] fixed command conversions for code lens
- [plugin-ext] fixed issue of `OutputChanel.show` not displaying
- [plugin-ext] fixed miscellaneous issues in golang plugin
- [plugin-ext] implemented `onWillSaveTextDocument` event handler
- [plugin-ext][markers] added support to use problem manager to handle plugin markers
- [plugin] added `tasks.onDidEndTask` Plug-in API
- [plugin] added `tasks.taskExecutions` Plug-in API
- [plugin] added ability to display webview panel in 'left', 'right' and 'bottom' area
- [plugin] added support for `menus.commandPalette` contribution point
- [plugin] added support for `vscode.previewHtml` command
- [plugin] added support for read-only configuration index access
- [plugin] fixed issue of ensuring statusbar entry uniqueness
- [plugin] implemented inspect configuration command
- [plugin] refactored the `Command` interface by splitting into two: `CommandDescription` and `Command`
- [plugin][debug] added ability to connect to a remote debug server
- [preferences] added support for language specific preferences
- [preferences] aligned preference default values by type with vscode
- [search-in-workspace] added support for search `when` contexts
- [search-in-workspace] fixed keybinding for `Search in Workspace` widget
- [terminal] added support for font preferences
- [terminal] added support for terminal `when` contexts
- [vscode] added support for OS specific keybindings
- [vscode] implemented `commands.getCommands`
- [vscode] implemented `commands.registerTextEditorCommand`
- [vscode] implemented `workspace.rootPath`
- [workspace] added support for easier overriding of the `DefaultWorkspaceServer`
- [workspace] added support for workspace `when` contexts
- [workspace] fixed displaying the `Open With...` context menu only when more than one open handler is present
- [mini-browser] improved handling of iframe errors and time-outs

Breaking changes:

- menus aligned with built-in VS Code menus [#4173](https://github.com/theia-ide/theia/pull/4173)
  - navigator context menu group changes:
    - `1_open` and `4_new` replaced by `navigation` group
    - `6_workspace` renamed to `2_workspace` group
    - `5_diff` renamed to `3_compare` group
    - `6_find` renamed to `4_search` group
    - `2_clipboard` renamed to `5_cutcopypaste` group
    - `3_move` and `7_actions` replaced by `navigation` group
  - editor context menu group changes:
    - `2_cut_copy_paste` renamed to `9_cutcopypaste` group
- [debug] align commands with VS Code [#4204](https://github.com/theia-ide/theia/issues/4204)
    - `debug.breakpoint.toggle` renamed to `editor.debug.action.toggleBreakpoint`
    - `debug.start` renamed to `workbench.action.debug.start`
    - `debug.thread.continue` renamed to `workbench.action.debug.continue`
    - `debug.start.noDebug` renamed to `workbench.action.debug.run`
    - `debug.thread.pause` renamed to `workbench.action.debug.pause`
    - `debug.thread.stepin` renamed to `workbench.action.debug.stepInto`
    - `debug.thread.stepout` renamed to `workbench.action.debug.stepOut`
    - `debug.thread.next` renamed to `workbench.action.debug.stepOver`
    - `debug.stop` renamed to `workbench.action.debug.stop`
    - `debug.editor.showHover` renamed to `editor.debug.action.showDebugHover`
- multi-root workspace support for preferences [#3247](https://github.com/theia-ide/theia/pull/3247)
  - `PreferenceProvider`
    - is changed from a regular class to an abstract class
    - the `fireOnDidPreferencesChanged` function is deprecated. `emitPreferencesChangedEvent` function should be used instead. `fireOnDidPreferencesChanged` will be removed with the next major release.
  - `PreferenceServiceImpl`
    - `preferences` is deprecated. `getPreferences` function should be used instead. `preferences` will be removed with the next major release
  - having `properties` property defined in the `PreferenceSchema` object is now mandatory
  - `PreferenceProperty` is renamed to `PreferenceDataProperty`
  - `PreferenceSchemaProvider`
    - the type of `combinedSchema` property is changed from `PreferenceSchema` to `PreferenceDataSchema`
    - the return type of `getCombinedSchema` function is changed from `PreferenceSchema` to `PreferenceDataSchema`
  - `affects` function is added to `PreferenceChangeEvent` and `PreferenceChange` interface
- `navigator.exclude` preference is renamed to `files.exclude` [#4274](https://github.com/theia-ide/theia/pull/4274)

## v0.3.19 - 22/01/2019

- [core] added `hostname` alias
- [core] added new `editor.formatOnSave` preference, to format documents on manual save
- [core] added support for setting end of line character
- [cpp] added new `cpp.clangdExecutable` and `cpp.clangdArgs` to customize language server start command
- [debug] added node debugger as a Plug-in
- [debug] added support for source breakpoints
- [git] added `discardAll` command
- [git] added `stageAll` command
- [git] added `unstageAll` command
- [git] added new `git pull` command, to pull from default configured remote
- [git] added new `git push` command, to push from default configured remote
- [git] added the ability to refresh git repositories when a change is detected within a workspace
- [java] allow the ability to rebind `JavaContribution`
- [languages] enabled INI syntax highlighting for `.properties` and `.toml` files
- [monaco] fixed cross editor navigation
- [monaco] fixed document-saving that took too long
- [monaco] improved `MonacoWorkspace.fireWillSave` performance
- [plugin] added `globalState` and `workspaceState` Plug-in API
- [plugin] added `registerColorProvider` Plug-in API
- [plugin] added `registerRenameProvider` Plug-in API
- [plugin] added `tasks.onDidStartTask` Plug-in API
- [plugin] added basic support of snippets
- [plugin] added common service to handle `when` expressions
- [plugin] added debug Plug-in API
- [plugin] added support for terminal APIs on window
- [plugin] added the ability to debug VS Code extensions
- [plugin] added the ability to get operating system connected to Plug-in
- [plugin] added the ability to provide a way to initialize workspace folders when Theia is started
- [plugin] added the ability to set the visibility of menu items through `when` expressions
- [plugin] added workspace symbols Plug-in API
- [plugin] fixed spreading of command arguments
- [preferences] added the ability to update settings schema resource on schema changes
- [search-in-workspace] fixed issue regarding child root in `search-in-workspace` when there is a multiple-root workspace
- [search-in-workspace] removed duplicates from `search-in-workspace` tree
- [security] updated xterm.js to 3.9.2
- [task] added support to run tasks from multiple-roots
- [task] fixed cwd path
- [workspace] added multiple-root support for `WorkspaceService.getWorkspaceRootUri()`

## v0.3.18 - 20/12/2018

- [core] added a preference to define how to handle application exit
- [core] added a way to prevent application exit from extensions
- [core] added functionality to prevent application exit if some editors are dirty
- [core] allowed the ability to scope bindings per connection
- [core] fixed `@theia/core/lib/node/debug#DEBUG_MODE` flag to correctly detect when the runtime is inspected/debugged
- [cpp] fixed clangd being prematurely started when a build config is active
- [electron] implemented HTTP-based authentication for Git
- [electron] updated Electron to `^2.0.14`
- [electron] updated Git for Electron to fall back to embedded Git if no Git is found on the `PATH`
- [file-search] added ability to search files from multiple-root workspaces
- [file-search] improved handling when attempting to open non-existent files from the `quick-open-file`
- [filesystem] added the ability to convert URIs to platform specific paths
- [git] updated Git view to display short hash when on detached state
- [java-debug] added major enhancements to `java-debug`
- [keybinding] normalized key sequences to US layout
- [languages] added a preference for every language contribution to be able to trace the communication client <-> server
- [languages] allowed the ability to provide Language Server start options
- [languages] fixed leaking language clients
- [languages][java] reuse `jdt.ls` workspace
- [monaco] fixed keybindings on OSX
- [plug-in] added Plug-in API for language server contributions
- [plug-in] added `storagePath` Plug-in API
- [plug-in] added `tasks.registerTaskProvider` Plug-in API
- [plug-in] added `window.withProgress` Plug-in API
- [plug-in] added ability to register keybindings from a Plug-in's `package.json`
- [plug-in] added open link command
- [plug-in] added support for context menus in contributed views
- [plug-in] implemented API to get workspace folder by a given file URI
- [plug-in][languages] added ability to register a document highlight provider
- [search-in-workspace] added ability to perform 'Find in Folder...' with multiple folders simultaneously
- [search-in-workspace] added match and file count to search-in-workspace
- [search-in-workspace] added support for multiple-root workspaces
- [search-in-workspace] fixed path issues by instead using URIs
- [terminal] added ability to choose terminal root location when a workspace contains multiple roots
- [workspace] fixed long label computations for multiple-root workspaces
- [xterm] updated Xterm to `3.9.1`

## v0.3.17 - 29/11/2018

- Added better widget error handling for different use cases (ex: no workspace present, no repository present, ...)
- Addressed multiple backend memory leaks
- Prefixed quick-open commands for easier categorization and searching
- Refactored `Task` menu items into the new `Terminal` menu
- [core] added `theia.applicationName` to application `package.json` and improved window title
- [core] added graceful handling of init and re-connection errors
- [core] added the keybinding `ctrl+alt+a` and `ctrl+alt+d` to switch tabs left/right
- [core] added the menu item `Find Command...` to easily trigger quick-open commands
- [core] added toolbar support for tab-bars
- [core] updated the status-bar display when offline
- [cpp] updated the keybinding for `Switch Header/Source` from `Option+o` to `Option+Command+o` when on macOS
- [debug] added the ability to fork a debug adapter
- [debug] added the ability to trace the debug adapter communication
- [debug] implemented major frontend and backend debug improvements
- [electron] miscellaneous stability and usability improvements on Electron
- [getting-started] added `Getting Started Widget` - used to view common commands, recent workspaces, and helpful links
- [lsp] added new symbol types and increased existing workspace symbol resilience
- [lsp] registered 'Restart' commands for each language server started for miscellaneous purposes
- [markers] added the context menu item `Collapse All` for problem markers
- [mini-browser] miscellaneous mini-browser improvements
- [plug-in] added Plug-in API to communicate between Theia and plugins
- [plug-in] added `languages.registerCodeLensProvider` Plug-in API
- [plug-in] added `languages.registerDocumentSymbolProvider` Plug-in API
- [plug-in] added `window.showTextDocument` Plug-in API
- [plug-in] added ability to provide custom namespaces for the Plug-in API
- [plug-in] registered a type definition provider
- [plug-in] added `tasks.registerTaskProvider` Plug-in API
- [preview-editor] added the ability to open editors in preview mode
- [process] added the ability to create new node processes through forking
- [search-in-workspace] prompted users when performing `Replace All...` to limit accidental triggering
- [search-in-workspace] fixed issue when selecting a file, the command `Find in Folder...` searches from the node's closest parent
- [terminal] added the menu item and command `Split Terminal`
- [workspace] added the ability to open multiple files simultaneously from the file navigator
- [workspace] added the context menu item `Collapse All` for the file navigator
- [workspace] included workspace path as part of the URL fragment

## v0.3.16 - 25/10/2018

- Reverted [cpp] Add debugging for C/C++ programs. This feature will come back in its own cpp-specific repo
- [callhierarchy][typescript] adapt to hierarchical document symbols
- [core] added methods to un-register menus, commands and keybindings
- [debug] decoupled debug model from UI + clean up
- [markers] added ability to remove markers
- [output] added a button to clear output view
- [plug-in] Terminal.sendText API adds a new line to the text being sent to the terminal if `addNewLine` parameter wasn't specified
- [plug-in] added `DocumentLinkProvider` Plug-in API
- [terminal] added 'open in terminal' to navigator
- [windows] implemented drives selector for the file dialog

## v0.3.15 - 27/09/2018

- [cpp] added debugging for C/C++ programs
- [debug] added debug toolbar
- [debug] resolved variables in configurations
- [debug] updated debug session views to act like panels
- [keymaps] added new `View Keybindings Widget` - used to view search and edit keybindings
- [languages] added TCL grammar file
- [plug-in] added `menus` contribution point
- [workspace] added multi-root workspace support with vscode compatibility

## v0.3.13 - 30/08/2018

- Re-implemented additional widgets using React
- Re-implemented miscellaneous components using React
- [cpp] added a status bar button to select an active cpp build configuration
- [cpp] implemented watch changes to compile_commands.json
- [git/blame] added support for convert to toggle command
- [markers] fixed #2315: fine grain marker tree computation
- [markers] improved performance by no longer storing markers in browser local storage by default
- [terminal] updated to xterm.js 3.5.0
- [textmate] added C/C++, Java, Python, CSS, html, less, markdown, shell, xml, yaml
- [tree] improved performance by not rendering collapsed nodes
- [ts] added support for one ls for all JavaScript related languages
- [workspace] added support for recently opened workspaces history

## v0.3.12 - 28/06/2018

- New Plugin system !
  - See [design](https://github.com/theia-ide/theia/issues/1482) and [documentation](https://github.com/theia-ide/theia/blob/master/packages/plugin/API.md) for more details.
- Introducing [Task API](https://github.com/theia-ide/theia/pull/2086).
  - Note, the format of tasks.json has been changed. For details, see the Task extension's [README.md](https://github.com/theia-ide/theia/blob/master/packages/task/README.md).
- Added an UI when developing plugins
- Migrated widgets to `react`
- Theia alerts you when the opening of a new tab is denied by the browser
- [core] added quick option to toggle the autosave feature
- [filesystem] added `File Download` feature
- [git] `git commit` now alerts the user if no files are staged
- [git] fixed `git` unstaging feature
- [languages] added textmate syntax coloring support (works on `.ts` files for now until more grammars are registered)
- [search-in-workspace] added new command `Search In Folder...`
- [search-in-workspace] added the missing `Search` menu item
- [workspace] fixed issue to prevent workspace root from being be deleted
- `.md` files that are edited in `diff` mode now correctly open with the editor
- `HTML` files now open in the editor by default

## v0.3.11 - 06/06/2018

- Added search and replace widget
- Added the ability to delete files on OSX with cmd+backspace
- Added the ability to set more finely grained logger levels
- Fixed several memory leaks.
- [editor] changed the font in the editor
- [editor] fixed the capital `R` key (<kbd>shift + r</kbd>) not working in the editor
- [file-search] added support for search in hidden files
- [git] added `git sync` and `git publish` actions
- [navigator] added the ability to toggle hidden files in the navigator
- `jdt.ls` download on postinstall
