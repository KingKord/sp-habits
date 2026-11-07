# Verification log

## Unreleased — 2026-11-07

### Issues #1 and #2

- Added daily `by-time` goals with actual clock-time records and dated deadlines. Missing records fail; explicit 00:00 and exact-deadline entries succeed. Time goals cannot reinterpret existing quantity histories or link to recurring tasks.
- Added earlier-time plans, including 08:00 → 07:45, with future stages, previews and preservation of earlier rules and records. Calendar, statistics, streaks, backup parsing and translations understand the new goal.
- Return in a single-line habit field blurs that field without submitting or closing the form. Button activation and IME composition keep their normal behavior.

### Automated checks

- `npm run check` passed on Node.js 25.8.2: ESLint, Prettier, **186 tests**, version/changelog validation, JavaScript syntax and ZIP integrity.
- Added regressions for midnight, exact and late times, missing entries, historical deadlines, backdating, sparse statistics and streaks, earlier-time plans/cancellation, invalid imports, quantity-conversion guards, storage reloads, visibility/archive and Return/IME behavior.
- The bundled `index.html` is **88,371 bytes**, below the host's 100 KiB limit.
- Version remains 0.18.1, with changes recorded under Unreleased. This branch is prepared for pull-request review; it does not publish or replace a release. Release versioning and publication remain a separate step after review.

### Isolated browser checks

- Used the bundled host and iframe scripts in Chromium with a mocked PluginAPI, separate localStorage keys and synthetic habits. The normal Super Productivity profile was not opened or changed.
- Passed **8 combinations**: English/Russian × light/dark × 390/1440 px width. Verified creation, editing, Return blur, empty deadline/actual-time rejection, actual-time saving, earlier-plan validation and persistence, Day/Calendar/Statistics, reload and a quantity-counter smoke check after time editing.
- The final matrix had no JavaScript errors or browser warnings. Day and Statistics had no horizontal overflow at either width. Reviewed screenshots of the time form, time entry, Day and plan; narrow dialogs kept their actions accessible.
- Separately checked late/exact/midnight records, clearing a record, switching a new habit between quantity and time types, and zero view-only writes after reload.
- A simulated failed clear left the stored midnight record intact and the editor open with an error; reload restored normal operation. Host export and confirmed import preserved the complete time goal, explicit 00:00 record and future plan.
- Review screenshots use synthetic data: [time-goal form](docs/images/time-goal-form.png) and [earlier-time plan](docs/images/time-goal-plan.png). Local harnesses and other screenshots remain in ignored `output/playwright/`.

### Limits

- Physical iPhone/iOS keyboard dismissal and Safari/WebKit were not tested. Chromium checks prove Enter handling, focus loss and form preservation; they do not prove a physical iOS keyboard interaction.
- Installation in the live Super Productivity app, cross-device sync and concurrent editing were not tested for this branch.
- Existing quantity backups remain readable without migration. Backups containing `by-time` require this feature; 0.18.1 cannot import them.

## 0.18.1 — 2026-11-05

### Build and release

- The release uses the manifest ID `sp-habit-limits`, version 0.18.1 and minimum Super Productivity version 19.3.1.
- The release ZIP contains manifest.json, index.html, icon.svg, plugin.js, LICENSE and THIRD_PARTY_LICENSES.txt.
- Published ZIP: **140,175 bytes**. SHA-256: `74d9774ff0afd733006af6be3651afb9b800d160f9a24c7966e2170409da46bf`.
- The ZIP and checksum were downloaded from the published release and verified against their GitHub digests.
- Fresh `npm run check` passed: ESLint, Prettier, **175 tests**, version/changelog validation, JavaScript syntax and ZIP integrity. Built index.html: **81,560 bytes**.
- The rebuilt ZIP and checksum are byte-identical to the published assets. Documentation updates do not change the plugin's runtime files.

### Isolated UI verification

- The release was tested with synthetic data in isolated Chromium across **12 combinations**: English/Russian, Day/Calendar/Statistics and 390/1440 px widths.
- Verified export content, compatible backup import, counter persistence and reload. No view-only writes or JavaScript errors occurred.
- The preview emitted an initial missing-favicon request and the expected iframe sandbox warning.
- The documentation screenshot uses synthetic data. Personal exports and local browser artifacts are not part of the repository or release.

### Community catalog

- Submitted [Super Productivity PR #11513](https://github.com/super-productivity/super-productivity/pull/11513) on 2026-11-05, referencing this release's ZIP size, manifest ID, version and SHA-256.
- The upstream catalog validator passed all **31 entries**. The upstream community-plugin verification tests passed all **12 tests**.
- The upstream release verifier downloaded the published ZIP and verified size, checksum, manifest ID and version. An incorrect checksum was rejected.
- The catalog change adds one entry and does not change application code or dependencies. The full upstream application test suite was not run locally.

### Limits

- Physical mobile devices, Safari, cross-device delivery and concurrent editing were not checked.
- Plugin data is stored by Super Productivity. A source review found no separate runtime network requests or embedded user history.
- This record does not constitute a complete security audit.
