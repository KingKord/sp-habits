# Verification log

## 0.19.1 — 2026-11-12

### Integrated checks

- Full npm run check passed: lint, formatting, 219 tests, version validation, JavaScript syntax and ZIP integrity.
- New regressions exercise persisted-data invalidation, bursts during reads/writes, disposal, stale editor conflicts, dirty dismissal, Unicode/capacity backup boundaries, statistics coverage and non-color calendar outcomes.
- Build budget reporting preserves the strict 100 KiB host boundary and reports actual bytes, baseline delta, headroom and source contributors. The runtime is 97,467 bytes; styles travel through the existing host resource bridge.

### Isolated real-host review

- Installed the integrated build in a separate Chromium Super Productivity 20.0.0 web instance (host revision 4db0e11236bc784d3184a9e252930b4bd53df823). The everyday desktop app was not opened or modified.
- Created a synthetic reading habit, changed its quantity with +, and verified confirmed storage.
- Changed plugin storage through the isolated iframe PluginAPI while settings were open. The visible habit updated through the host persistence hook; a stale form could not overwrite the changed name, retained its entered text and displayed the conflict explanation.
- Verified that cancelling the discard confirmation kept the changed habit form available, and accepting dismissal did not save its input.
- Imported six synthetic habits, including a check-in with one successful mark and five unknown completed days. Statistics showed 1 / 1 successful assessed outcomes and 1 / 6 marked-day coverage beside 100%.
- Reviewed compact calendar symbols with more than four habits at 320 and 390 px in the real host: no horizontal iframe overflow; the overflow count and distinct outcomes remained visible. Also inspected dark-mode Statistics and corrected the host heading-color variable when the plugin theme differs from the host.
- Downloaded the real-host JSON export: 1,389-byte compact backup with six habits. Reimported it through the file control and confirmed all six habits remained after a complete host reload.

### Limits

- Large ASCII/Unicode round trips are automated through the actual bundled export bridge and import validation; the multi-megabyte fixture was not rendered in the live host.
- This verifies host-side persistence notifications, not actual delivery from another device. Minimum-host 19.3.1, physical iOS/Safari and concurrent-device editing remain unverified; issue #21 tracks the compatibility matrix.
- No lossless distributed merge or cross-device locking is claimed.

## 0.18.2 — 2026-11-07

### Current candidate

- Habit direction remains Good/Bad. The unified Tracking field offers Done/Missed alongside quantity units; there is no separate tracking-method selector. An optional No later than condition belongs to manual check-ins; clicking after that time does not infer a failure or record an actual completion time.
- Positive check-ins use Done/Missed; negative check-ins use No slip/Slipped. Repeating a selected action restores an unmarked day. Unmarked check-ins are neutral, do not earn success and interrupt the confirmed streak. New check-in statistics distinguish unmarked days from explicit failures.
- The earlier `before-time` test format remains readable. Explicitly saving its settings upgrades dated deadlines and preserves daily marks. Existing quantity histories retain their meaning. Changing a saved habit's tracking method requires a separate habit in this iteration.
- Return in a single-line habit field blurs without submitting or closing the form.

### Automated checks

- Final 0.18.2 `npm run check` passed: ESLint, Prettier, **192 tests**, version/changelog validation, bundled JavaScript syntax and ZIP integrity.
- New regressions cover both habit directions, optional and dated conditions, undo, unknown-day statistics, malformed imports, quantity/task-link guards and upgrade of the earlier time prototype.
- Final source build `index.html`: **92,315 bytes**, below the 100 KiB host limit. ZIP SHA-256: `cce10044c6d706f9b11a5f10cfd1e9f431105b917b850d185f869eec6e049696`.
- Release candidate version is **0.18.2** in the package, lockfile, manifest, interface and README. Interactive approval used the ignored **0.18.2-test.4** ZIP. Publication follows the main-branch GitHub Actions workflow.

### Real-host browser review

- Updated the plugin only in the separate Super Productivity **20.0.0** web instance in the in-app browser. Personal sync was not connected; the desktop app was not changed during this iteration.
- Confirmed the previously entered test habit survived the update.
- Created a positive check-in with an 08:00 condition and a negative check-in without a time condition. Verified the two-option habit type, conditional fields, both result actions and undo. On test.3, verified the unified Tracking selector switches between check-ins, ml and custom units; hidden quantity fields are disabled for check-ins and the optional time condition remains available.
- A negative mark survived a full host-page reload. Verified switching it to adherence and undo, plus Calendar and Statistics rendering.
- On test.4, real-host geometry checks passed at browser widths 1440, 1008, 768, 390 and 320 px. All history markers had equal width and height (32, 44 or approximately 40.57 px), with no horizontal iframe overflow. The temporary viewport override was reset.
- The review screen is left open for interactive user feedback. This is a test candidate, not acceptance of the design.

### Limits

- This candidate has not been verified on the minimum 19.3.1 host, physical iOS/Safari, cross-device sync or concurrent editing.
- Quantity tests pass, but a complete browser theme/viewport matrix was not rerun for this iteration.
- Automated time-condition plans and switching the tracking method of an existing habit are outside this first review iteration. Conditions can be edited with a historical effective date.

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

## 0.19.0

- `npm run check` (lint, format, 194 unit tests, build) passed, including new tests for habit deletion and the hidden filters.
- Limits: the new calendar, statistics and editor controls were reviewed in code and covered by domain tests; they were not exercised in a browser, on physical devices or in Safari.
