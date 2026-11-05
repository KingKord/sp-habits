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

Unit tests use fixtures and mocked APIs. For UI changes, install the built ZIP in a separate Super Productivity profile with synthetic habits and tasks. Verify the changed flow, save/reopen behavior, English and Russian, both themes and a narrow viewport. Do not test import, replacement or task-creation flows against your everyday history.

The standalone HTML needs the host's PluginAPI and UI Kit; opening `src/index.html` directly is not a supported preview. Local browser harnesses and screenshots belong in ignored `output/`. Shared documentation screenshots must contain synthetic data.

## Source and translations

Use English in source messages, comments, documentation and tests. Russian belongs in `src/i18n/ru.json`, compatibility aliases, bilingual emoji data and translation fixtures. User-entered names, units and existing history may use any language and must survive unchanged. See [AGENTS.md](../AGENTS.md) for the complete project rules.

## Build resources and architecture

esbuild resolves ES modules and embeds minified application JavaScript in `index.html`. The host serves that iframe without arbitrary relative ZIP assets. CSS, Russian translations and the offline emoji catalogue are bundled in host-side `plugin.js` and sent through a source/origin-checked resource bridge. CSS is inserted as text before revealing the UI; missing styles stop startup with a visible error. This keeps `index.html` below the host's 100 KiB limit without runtime requests or added permissions.

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
