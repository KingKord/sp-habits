# Development

[Back to the README](../README.md) · [Contribution guide](../CONTRIBUTING.md) · [Release guide](releasing.md)

## Build from a clean checkout

Use Node.js 24 LTS for the same major version as CI. The supported Node.js range is declared in `package.json`. Install `zip` and `unzip` as well; packaging calls both commands.

```sh
git clone https://github.com/KingKord/sp-habits.git
cd sp-habits
npm ci
npm run check
```

`npm run check` runs ESLint, formatting checks, Node.js tests and a release build. The build validates versions and release notes, checks JavaScript syntax and tests ZIP integrity. It writes `dist/sp-habits.zip`, `dist/sp-habits.zip.sha256` and unpacked files in `dist/plugin/`.

```sh
npm run lint
npm run format:check
npm test
npm run build
npm run format
```

On Windows, use an environment that provides Node.js, `zip` and `unzip`, such as WSL. Native Windows packaging has not been verified.

## Test without personal data

Unit tests use fixtures and mocked APIs. Interactive review uses a separate browser instance of the real Super Productivity web app, with synthetic habits and tasks and no personal sync connection. Keep development builds out of the everyday desktop app unless the user explicitly requests an installation.

The [official plugin starter](https://github.com/super-productivity/super-productivity/blob/master/packages/plugin-starter/README.md) recommends a separate browser profile or [test-app](https://test-app.super-productivity.com/). Check the host's displayed version against `minSupVersion` before installing. If test-app is too old, use the [official web app](https://app.super-productivity.com/) in a separate browser profile without connecting personal sync. A browser run on a newer host does not establish compatibility with the minimum supported host version.

For each review iteration:

1. Run the checks relevant to the change and build with `npm run build`.
2. Upload `dist/sp-habits.zip` in the test host through **Settings → Plugins → Choose Plugin File**. The same plugin ID replaces its previous build; enable it if the host leaves it disabled.
3. Open the changed screen for the user to try, gather feedback and repeat. Re-upload each new build; the installed ZIP does not automatically follow local source edits.
4. Verify save/reopen behavior, task hooks and other changed integrations in the real host. Before release, also check English and Russian, both themes, a narrow viewport and compatibility with the supported host version.

Do not test import, replacement or task-creation flows against everyday history. Desktop-only APIs require a separate desktop test profile.

The standalone HTML needs the host's PluginAPI and UI Kit; opening `src/index.html` directly is not a supported preview. A local browser harness with mocked APIs is useful for quick UI checks, but cannot verify the real host's storage, API permissions or task events. Local harnesses and screenshots belong in ignored `output/`. Shared documentation screenshots must contain synthetic data.

## Source and translations

Use English in source messages, comments, documentation and tests. Russian belongs in `src/i18n/ru.json`, compatibility aliases, bilingual emoji data and translation fixtures. User-entered names, units and existing history may use any language and must survive unchanged. See [AGENTS.md](../AGENTS.md) for the complete project rules.

## Build resources and architecture

esbuild resolves ES modules and embeds a small application loader in `index.html`. The full application JavaScript is bundled as a string in host-side `plugin.js` through the virtual `habits:application` module. The iframe requests that resource using the existing source/origin/request-checked bridge and installs the trusted response through a script element's `textContent`. It performs no network requests and does not rely on relative ZIP assets. Missing, malformed or timed-out resources leave a visible recovery message; closing the iframe cancels pending loader requests. The application retains its own readiness, localization and teardown guards after loading.

CSS, Russian translations and the offline emoji catalogue use the same host resource bridge. Styles are inserted as text before revealing the UI; missing styles stop startup with a visible error. The 100 KiB iframe limit remains enforced against the actual loader HTML. `dist/build-budget.json` reports loader, full application and host sizes and module contributors; packaging separately checks all JavaScript syntax and caps the host bundle at 10 MiB. This code-resource path must be tested in a real supported host: passing isolated protocol tests alone does not establish minimum-host, Electron or Safari compatibility.

The ZIP includes `THIRD_PARTY_LICENSES.txt` for Unicode data. To rebuild the catalogue, run `node scripts/build-emoji-data.mjs <emoji-test-16.0.txt> <annotations-ru-46.1.json> <annotations-en-46.1.json>`. Sources: [Unicode 16.0](https://unicode.org/Public/emoji/16.0/emoji-test.txt), [CLDR Russian](https://github.com/unicode-org/cldr-json/blob/46.1.0/cldr-json/cldr-annotations-full/annotations/ru/annotations.json), [CLDR English](https://github.com/unicode-org/cldr-json/blob/46.1.0/cldr-json/cldr-annotations-full/annotations/en/annotations.json).

The export bridge exists because host-side `downloadFile` is unavailable in the 19.3.1 iframe proxy, whose sandbox limits Blob downloads. Requests are accepted only from this plugin's iframe and origin; recovery export reads only its own storage. The bridge is removed on unload.

| Module | Responsibility |
| --- | --- |
| `src/domain.js` | Pure rules, validation, calendar, statistics and progress; no DOM or PluginAPI |
| `src/store.js` | Serialized mutations, reloads and stopping after errors |
| `src/host/` | Resource/export protocol, iframe client and host handler |
| `src/ui/*-view.js` | Day, Calendar and Statistics screens |
| `src/ui/*-editor.js` | Habit, amount and plan forms with local state |
| `src/ui/dom.js`, `format.js`, `scope.js` | DOM helpers, formatting and lifecycle cleanup |
| `src/i18n/` | English catalogue, Russian translation, compatibility aliases and bilingual emoji data |
| `src/application.js` | Composition and screen switching |
| `src/bootstrap.js`, `src/app.js` | One-time readiness and disposal |
| `scripts/version.mjs`, `release.mjs` | Release validation and immutable publication |

There is no jQuery dependency. UI modules receive dependencies through factory arguments; importing them installs no handlers. Domain mutations return new state, and the store validates before writing. ESLint prevents the domain/store from depending on UI or browser globals. Add meaningful domain tests for behaviour changes, connect new modules in `application.js`, run `npm run check` and verify user flows on isolated data.

## Verification and API references

Current release checks and limits are in [VERIFICATION.md](../VERIFICATION.md). Core design requirements are in [DRAFT.md](../DRAFT.md).

The initial host contract was checked against Super Productivity v19.3.1:

- [Plugin Development Guide](https://github.com/super-productivity/super-productivity/blob/v19.3.1/docs/plugin-development.md)
- [Plugin API types](https://github.com/super-productivity/super-productivity/blob/v19.3.1/packages/plugin-api/src/types.ts)
- [Iframe bridge and API restrictions](https://github.com/super-productivity/super-productivity/blob/v19.3.1/src/app/plugins/util/plugin-iframe.util.ts)

## Iframe capacity budget

Each build writes ignored `dist/build-budget.json` with exact iframe bytes, headroom against the strict 102,400-byte boundary, the delta from the 94,524-byte v0.19.0 baseline, and esbuild input contributions for the application and host bundles. CI attaches the report to its build artifact and summarizes it in the job. A warning begins at 95 KiB; the existing hard limit still rejects an iframe of 100 KiB or larger. Contributor byte counts exclude bundler glue and are diagnostic rather than an alternative total.

The iframe now contains the loader and authored markup; full application, style, translation and emoji resources travel through the verified offline host bridge. Reported application contributors are separate from actual iframe bytes, and the v0.19.0 delta spans this architecture change. Keep calculations shared rather than duplicating domain code in new views. Loader startup has been exercised in host 20.0.0 and the official 19.3.1 embedded web assets served locally; this does not certify native mobile, Electron or Safari behavior. Arbitrary relative ZIP files and runtime CDN requests are not a portable replacement.
