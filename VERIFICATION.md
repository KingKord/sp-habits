# Verification log

## 0.20.0 — 2026-11-12

### Build and regression checks

- Final integrated npm run check passed: lint, formatting, 286 tests, version/changelog validation, JavaScript syntax and ZIP integrity.
- The iframe contains 26,177 bytes, leaving 76,223 bytes below the unchanged strict 102,400-byte limit. The full application is delivered through the verified offline bridge; the host bundle is separately bounded at 10 MiB. No runtime network dependency was added.
- Regressions cover optional group/order/note metadata, old backups and legacy journals, save failures and stale drafts, dated manual schedules, pauses, calendar-week goals, distinct successful days, partial weeks, mixed assessment units, real renderer/editor handlers and host recurrence parity.
- Independent review found and fixed schedule/pause conflict signatures, pause-only dirty drafts, stale group renames, linked-to-weekly editor carry-over, daily check-in marks being confused with weekly outcomes, omitted time conditions and unknown-week labels.
- Weekly recurrence fixtures match the tagged 19.3.1 and 20.0.0 host algorithms, including anchored seven-day blocks, DST, leap days, year boundaries, exceptions, completion and undo.

### Isolated host matrix

| Scenario | 19.3.1WB | 20.0.0WB |
| --- | --- | --- |
| Install and initialize offline loader | Passed | Passed |
| Save/reopen and update existing plugin without losing synthetic history | Passed | Passed |
| Manual weekdays, daily notes and groups | Passed | Passed |
| Calendar-week check-in creation | Passed | Passed, including explicit missed/done marks in a met week |
| Fixed WEEKLY task link completion and undo | Passed through actual task UI, 0 to 1 to 0 | Tagged-source oracle and automated integration; not rerun through 20.0.0 task UI |
| Export/import | Synthetic update history retained; serial sync fixture used separate profiles | Exact JSON round trip with eight habits, group/order, notes, pauses and weekly rules |
| Narrow layouts | Details at 320 px, loader and forms exercised | 36 layout combinations: EN/RU, light/dark, 320/390/1440 px, Day/Calendar/Statistics |
| Physical iOS/Android, native Safari and Electron | Unverified | Unverified |

The minimum-host environment used the embedded web assets from the official v19.3.1 Android APK, served on localhost in Chromium; its UI reported 19.3.1WB, revision 1014df989d55497d6ec18b038de09aa25b6cd2bb. This is an application API test, not a physical Android test or certification of the official PWA package. Extracted assets emitted missing-service-worker 404/NG05604 startup messages. The current-host checks used app.super-productivity.com, 20.0.0WB revision 4db0e11236bc784d3184a9e252930b4bd53df823.

The everyday desktop app, personal accounts and personal synchronization settings were not opened or changed. Browser installations and generated tasks used synthetic data.

### User-flow review

- Preserved the existing six-habit fixture when updating the test host to 0.20.0. A later explicit disable/re-enable retained all eight habits, group metadata and notes.
- In 19.3.1, created a Monday/Wednesday/Friday habit and observed Thursday as a rest day; saved a plain-text Unicode note on that rest day, created/renamed a group and assigned membership without changing the note/history.
- In 20.0.0, moved a habit using keyboard Space on Move down. Only its visible neighbor changed position; group membership and unrelated history remained intact.
- Saved a note from the nested daily-total editor. The pending amount stayed in the parent editor, cancelling that parent left the quantity unchanged, and the note persisted.
- A pause added with unchanged default date inputs triggered discard protection. Cancelling dismissal kept the draft; saving displayed the pause symbol while preserving earlier amounts.
- A weekly check-in with an 08:00 condition and three successful days retained the separate Monday Missed mark. The strip showed a failure followed by three successes, with 3 / 3 weekly progress and the clock condition still visible.
- Detail history paged through a 73-day range, showed a validation message for reversed dates, recovered to a one-day range after correction, and caused no history writes.
- The 36 view/theme/language/width combinations had no horizontal iframe overflow or view-only storage changes. A Russian dark editor fit 320 px; detail tables scroll inside the dialog. Screenshots were visually inspected for clipped controls, wrapping and readability.
- The host-compatibility review found the old episode-review task used a nonexistent Inbox project ID. After correcting it to INBOX_PROJECT, pressing + created exactly one real review task in Inbox with a confirmed success message.
- A real-host compact export/import round trip preserved the exact JSON, including all eight habits and new metadata.

### Actual two-client serial WebDAV delivery

Two independent, clean Chromium 156.0.8078.80 profiles ran 19.3.1WB on separate localhost origins. Both installed the same pinned 0.20.0 review snapshot: ZIP SHA-256 c3c0441661b16c753bd57bb5aeed75f8c1d96df1b64ffa128f97714c03c49cfd, 164,559 bytes. This pin predates later presentation fixes and is explicitly not the final published 0.20.0 asset.

The official host WebDAV provider used an anonymous loopback-only fixture server with strong ETags and If-Match. The host-required login fields contained unused synthetic placeholders; no personal credentials or account were involved. All fixture mutations and synchronization used normal UI controls; PluginAPI was used only to read confirmed results.

1. A uploaded two habits with older quantity history, a Done check-in, unknown earlier days and a note.
2. B's initial clean-host conflict was resolved with Keep remote and its confirmation.
3. An A quantity change reached B inside the exact same iframe/contentDocument without reopening. A name/rule change needed a second quiescent upload/download cycle.
4. B then changed the quantity, check-in to Missed, and note. All three reached the same open A iframe.
5. Final parsed plugin JSON matched between clients; IDs, units, rules, older history and unknowns survived. A full B host reload retained the same JSON.
6. Both dedicated browser sessions and owned WebDAV/secondary static servers were stopped after recording evidence.

Local evidence is under ignored output/sync-verification-20261112, including verification.json, an English report, screenshots and method/path/status-only transport logs. It is not part of the repository or release.

### Reproduction and limits

Use separate browser profiles without personal sync. Obtain the official 19.3.1 APK from its GitHub release, extract only assets/public, serve that directory locally, and confirm the displayed host version. Install the built plugin through Settings/Plugins. Use the table and synthetic examples above for save/reopen, task completion/undo, backups and layouts. For serial sync, use two distinct origins/profiles with a disposable local WebDAV endpoint; upload from one, download into the other, and compare both confirmed JSON and visible state while preserving iframe identity.

These checks establish serial local WebDAV delivery, not concurrent-editing safety, distributed locking, instant or single-cycle metadata delivery, automatic-sync latency, other providers, encryption or reconnect recovery. Physical mobile devices, native Safari and Electron were unavailable for this iteration and remain explicitly unverified.

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
