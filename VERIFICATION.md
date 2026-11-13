# Verification log

## 0.25.0 — 2026-11-13

### Checks and scope

- Full `npm run check` passed: ESLint, Prettier, 352 tests, version/changelog validation, bundled JavaScript syntax and ZIP integrity. Package, lockfile, manifest, interface and current README entry are 0.25.0.
- New regressions cover independently collapsed groups and Ungrouped, local persistence, malformed/oversized/unavailable preference storage, deleted group IDs, unique focus keys, unchanged row identity and history, displayed filter counts, unchanged day summaries, rename/reopen retention and removing the last group.
- Iframe: 26,933 / 102,400 bytes; headroom: 75,467 bytes. ZIP SHA-256: `5e6c3e4dcf8daebd3fb3f4210f2fae0a873216d4c4d9a5f0990288d82a39ad8b`.

### Isolated browser review

- Exercised eight English/Russian, light/dark and 320/1440 px combinations with synthetic grouped habits, the packaged bridge and host UI Kit. The applied theme was asserted and representative collapsed/focused layouts were visually reviewed.
- Collapsed two named groups independently, then Ungrouped. All headings, chevrons and filter-specific counts stayed available while habit rows left the layout and keyboard sequence. Focus remained on the group heading; Enter and Space activated its native button.
- Hidden inclusion updated group counts without reopening collapsed groups. Day summaries remained unchanged by collapsing. View navigation and a full preview reload retained every collapsed choice through local preference storage.
- Renaming a collapsed group with an emoji preserved its ID-based collapse choice across reload. Group display operations preserved exact synced JSON. A quantity increment/decrement in an expanded group restored exact JSON and did not shift its plus button or expand other groups. Habit histories remained unchanged by the separate synthetic rename.
- Unchanged habit rows stayed attached during collapse/expand. No horizontal overflow appeared; group controls provided at least 32 px desktop height and the stylesheet uses 44 px on narrow/coarse-pointer layouts. Evidence is under ignored `output/playwright/groups-0250/`.

### Limits

- Collapse choices are local display preferences, separate from synced data/backups. If browser preference storage is unavailable, collapsing still works in the current view and reports that it cannot persist the choice. No cross-device preference synchronization is claimed.
- Physical touch devices, native Safari and real cross-device synchronization were not rerun. Existing compatibility evidence is preserved below.


## 0.24.1 — 2026-11-13

### Checks and scope

- Full `npm run check` passed: ESLint, Prettier, 348 tests, version/changelog validation, bundled JavaScript syntax and ZIP integrity. Package, lockfile, manifest, interface and current README entry are 0.24.1.
- Day regressions now exercise Hidden itself as an independent include/exclude switch while Active stays selected, separate archives, displayed summaries, unchanged history and mixed-peer reordering. The extra Include hidden control is removed.
- Group-name regressions distinguish draft text from confirmed names, expose unsaved status, and preserve adjacent/spaced emoji, variation selectors and joined family sequences through save/reload/backup. Cancel restores the confirmed name; existing conflict, composition and failed-save regressions remain passing.
- Iframe: 26,933 / 102,400 bytes; headroom: 75,467 bytes. ZIP SHA-256: `e4b9f2789aa2fe2238f301178db06abbfa04ce3f84cf6f194c2ecec6497ea5c5`.

### Isolated browser review

- Checked eight English/Russian, light/dark and 320/1440 px combinations with synthetic grouped habits through the packaged bridge and host UI Kit. Asserted the actual applied theme and absence of the obsolete extra control.
- Hidden on showed all seven current habits, including the six ordinary habits; Hidden off showed six. Active remained selected, Archived remained separate, and filter actions preserved exact JSON.
- Editing a group to `Meals🍽️` showed the unsaved hint while confirmed storage and headings retained the previous name. Enter saved the exact name and cleared the hint. Saving `Meals 🍽️` with Save name updated the heading and membership option; a complete preview reload retained its emoji and spaces.
- Group renames preserved every habit field and history. No horizontal overflow appeared. Reviewed narrow unsaved-state and wide saved-state screenshots; evidence is under ignored `output/playwright/hidden-0241/`.

### Limits

- Group names still require explicit Save name or Enter; typing alone does not save, and inline group drafts are not promised to survive closing the view. The hint makes this distinction visible. Hidden remains a view-local switch.
- Physical touch devices, native Safari and cross-device synchronization were not rerun. Existing compatibility evidence remains below.


## 0.24.0 — 2026-11-13

### Checks and scope

- Full `npm run check` passed: ESLint, Prettier, 347 tests, version/changelog validation, bundled JavaScript syntax and ZIP integrity. Package, lockfile, manifest, interface and current README entry are 0.24.0.
- Renderer regressions cover ordinary-only, combined, hidden-only and archived lists; displayed summary counts; retained ordinary row identity; view-only data preservation; combined-list keyboard reordering; hidden flags/history preservation; and filter/reset behavior.
- Iframe: 27,038 / 102,400 bytes; headroom: 75,362 bytes. ZIP SHA-256: `24d13ee90f69436ad84feaa1b251575c58812c47063b0af78f5f7313c93b9779`.

### Isolated browser review

- Exercised the packaged bridge, loader/application and host UI Kit with synthetic ordinary, hidden and archived habits. Checked eight English/Russian, light/dark and 320/1440 px combinations with the actual applied theme asserted.
- Active initially showed six ordinary habits. Include hidden showed seven, with a Hidden label, matching day summary and no archived rows. Hidden showed only the hidden habit, while Archived showed only the archived habit. The include switch was unavailable outside Active. Returning to Active and navigating Calendar/Day retained the combined choice within the open view.
- All filter/view operations preserved exact JSON and kept unchanged ordinary rows attached. No horizontal overflow appeared. Reviewed representative narrow and wide screenshots.
- Incremented/decremented a hidden habit in the combined list and restored exact starting JSON. Keyboard-reordered that hidden habit among ordinary peers; only order metadata changed, preserving all habit fields and history.
- Evidence is under ignored `output/playwright/hidden-0240/`. Tests use synthetic data only. The switch is local to the current Day instance and does not modify saved hidden flags or synchronize a visibility preference.

### Limits

- Browser checks used the isolated packaged harness. Physical touch devices, native Safari and cross-device synchronization were not rerun. Existing compatibility and synchronization evidence is preserved below.


## 0.23.1 — 2026-11-13

### Checks and scope

- Full `npm run check` passed: ESLint, Prettier, 346 tests, version/changelog validation, bundled JavaScript syntax and ZIP integrity. The package, lockfile, manifest, interface and current README entry are 0.23.1.
- Regressions cover retained row/control/group-heading identity during pending writes and identical parsed-data refreshes, per-control availability after unlocking, feedback expiry without rebuilding rows, failed compact check-in persistence/reload, and delayed focus restoration without scrolling.
- Iframe: 26,794 / 102,400 bytes; headroom: 75,606 bytes. ZIP SHA-256: `2a0c46bf4232bf4eaa8a98aef0879b839ed562c4734790732dd70e89d019ad83`.

### Isolated browser review

- Used the packaged host bridge, loader/application and host UI Kit with 36 synthetic habits in a separate Chromium session. No personal desktop data or synchronization settings were opened or changed.
- Measured English/Russian, light/dark and 320/390/1440 px layouts, asserting the applied theme. Recorded animation frames through delayed save, acknowledgement, identical host invalidation and feedback expiry. Maximum button x/y, scroll position, row height and toolbar height changes were 0 px in all twelve combinations.
- All 36 rows remained attached while saving; only the changed habit was replaced after acknowledgement, retaining the other 35 rows. Focus returned to the plus action. Quantity increment/decrement restored the exact starting JSON, including explicit starting zero, notes and legacy history.
- Exercised check-in/undo and expanded quantity/undo with exact history restoration. Expanded history remained open after saving. A synthetic failed check-in write left storage unchanged and controls locked; Reload data recovered them. Creating a habit retained all 36 existing row nodes and added exactly one new row.
- Reviewed representative narrow light/dark screenshots. Evidence and disposable harness scripts are under ignored `output/playwright/stability-0231/`. The preview uses a unique bundle URL and uncached seed data because deterministic build timestamps can otherwise retain an older HTTP-cached bundle.

### Limits

- This patch was verified in the isolated packaged browser harness; a fresh official-host installation, native Electron/Safari, physical touch devices and cross-device synchronization were not rerun. Existing host and synchronization evidence below is unchanged.


## 0.23.0 — 2026-11-12

### Checks and scope

- Full `npm run check` passed: ESLint, Prettier, 343 tests, version/changelog validation, bundled JavaScript syntax and ZIP integrity. All five version sources and the current README entry are 0.23.0.
- Fixes follow-up findings #44–#53: duplicate host/plugin title, shared create shortcut, date control alignment, note/date centering, zero-goal summary, visible empty Calendar, invalid month drafts, shared persistence status, desktop date details and future-entry readability.
- Shortcut regressions cover exact modifier matching, configured/disabled/malformed bindings, keyboard layouts and fallback, editable/composed targets, modal/repeat/IME/AltGraph exclusions, blocked/pending state, asynchronous refresh ordering and disposal. The validated bridge returns only the configured addNewTask string, not global configuration.
- Final iframe: 26,822 / 102,400 bytes; headroom: 75,578 bytes. ZIP SHA-256: `925d7c4c58fd99c03341f6b82a52e6347e5c36e5090216c7a32e65bd076f3700`.

### Visual and interaction review

- Reviewed 36 packaged-build combinations: English/Russian, light/dark, 320/700/1440 px and Day/Calendar/Statistics, with real host spacing tokens. No horizontal page overflow or view-only history changes. Captured settled screenshots and visually inspected representative wide/narrow screens.
- Measured date/month input and arrow centers: maximum difference 0 px; label margins 0 px and paired control heights equal. Calendar numeral centers differ from their cell center by at most 0.015625 px, including a date with a saved note. The note badge is positioned separately from the numeral.
- The visible duplicate product title is removed while an accessible h1 remains. Navigation and Add habit share one toolbar. Calendar no longer adds a redundant heading band; native date/month picker controls remain available.
- Focused-iframe Shift+A opens exactly one new-habit form. Typing the combination in a Name field retains the draft and types its letter normally. A custom Ctrl+Alt+H binding replaces Shift+A, and a disabled binding leaves the button as the available entry point. Open forms are not replaced.
- Clearing Month retains the invalid draft across filter refreshes and visibly explains the still-applied month. A valid selection clears validation. Empty wide/narrow filters display an explanation; Day with no assessable goals avoids a zero-of-zero ratio.
- Explicit date selection reveals full details on desktop and mobile, focuses the heading, and returns focus to the selected date. Disabled future text remains fully opaque and non-editable. A delayed synthetic write keeps Saving visible in both Calendar and Statistics; after acknowledgement and quantity undo the exact original JSON is restored.
- Document scaling at 200% retained usable layout without horizontal overflow. This supplements the responsive viewport checks; it is not a physical-device or Safari zoom test.

### Actual host and limits

- Installed the candidate into a clean isolated official 19.3.1WB host (embedded web assets on localhost as documented below), enabled it and reloaded. The host provided the real configured binding, shown as New habit (Shift+A). Exercised actual keyboard events, editable-form protection, synthetic fixture import, wide date details and focus return; view-only actions preserved the exact plugin JSON.
- Inspected the combined host header and plugin toolbar together. The host's native Add task actions remain unchanged: the implementation installs no parent listener or duplicate plugin shortcut and does not change the system-wide desktop shortcut. Reuse applies only while focus is inside Habits.
- Evidence is under ignored `output/playwright/ux-polish-023/`: matrix/flow results, before/after screenshots, actual-host captures and issue records. The user's personal desktop installation and history were not modified during this follow-up.
- #54 remains an explicit keyboard-efficiency follow-up: the baseline six-habit wide Calendar exposed 121 enabled sequential tab stops. A roving date-grid design is not claimed in this release. Native Electron/Safari, physical touch devices, a fresh 20.0.0 installation and cross-device sync were not rerun.

## 0.22.0 — 2026-11-12

### Automated checks

- Final `npm run check` passed: ESLint, Prettier, 333 tests, version/changelog validation, bundled JavaScript syntax and ZIP integrity. All version sources and the current README entry are 0.22.0.
- Regressions cover dirty dismissal, complete pending-save locks, retained raw fields and original conflict baselines, backdated pauses, inactive goal drafts, tab-local recovery, storage failures, asynchronous restoration/disposal, acknowledged creation deduplication and safe late bridge replies.
- View regressions cover unapplied statistics ranges, responsive emoji navigation, immediate Escape/outside dismissal, mobile calendar details and desktop preferences, group input identity/selection, confirmed feedback expiry and reduced-motion behavior.
- The final iframe is 26,743 / 102,400 bytes, leaving 75,657 bytes of headroom. Local final ZIP SHA-256: `78f902e556e9d2259ab744f8f2b61a647c143415dead72e42896307cc4046688`.

### Isolated browser and minimum-host review

- Exercised the packaged build with synthetic data and the host UI Kit in an isolated Chromium profile. Checked 60 combinations: English/Russian, light/dark, 320/390/700/1024/1440 px, and Day/Calendar/Statistics. No horizontal page overflow; settled screenshots were reviewed for wrapping, clipping and readability.
- At 320 px, Russian habit, emoji, quantity, note and reduction-plan dialogs fit their scroll containers. Emoji ArrowDown follows the six-column mobile grid. Primary button text contrast measured 5.99:1 in light and 7.18:1 in dark across default, hover, focus and active states. Mobile settings targets measure at least 44 px after layout settles.
- Quantity and plan Escape dismissal retained raw input when dismissal was cancelled; explicit discard restored confirmed values. Goal-mode switching retained inactive rolling fields, and a new backdated habit accepted a pause inside its selected dates.
- Full reload restored a new habit draft including a custom unit and Unicode input. Nested note/quantity drafts reopened together. Failed note saves retained text through Reload data and keep editing; stale restored settings refused to overwrite an external change.
- Delayed habit and plan saves locked every form control until acknowledgement. Replacing the iframe during a delayed creation produced exactly one confirmed habit, retained the acknowledged draft as copyable recovery text, and emitted no page errors. Leaving a view during asynchronous restoration is also covered by automated lifecycle regressions.
- Verified immediate menu Escape, mobile calendar focus/return with all habits visible, collapsed/calendar note access, keyboard horizontal table scrolling with sticky dates, and group-name node/caret/focus retention after synthetic external delivery.
- Confirmed action feedback survives the persistence refresh. Reduced motion disables animation while retaining Saved text and an inset accent; normal expansion uses the short history animation.
- Installed published 0.21.0, imported the eight-habit synthetic fixture, then upgraded to the final 0.22.0 candidate in the actual isolated 19.3.1WB host. Reloaded the host and verified installed application source against the final bundle. Exact plugin JSON, older history, notes and legacy journal remained unchanged. Navigating away and returning offered the retained draft and resumed its exact input.
- Explicit dark survived a complete host reload; Follow app resolved the host theme. Automated tests cover subsequent host theme changes and unavailable preference storage. Repeated same-name test uploads can retain a stale selected file or loaded code: final verification used a distinct ZIP filename, cleared the file input and reloaded the host before checking the installed bundle.

### Limits and evidence

- The actual host uses official 19.3.1 embedded web assets on localhost, as described in 0.20.0 below. No personal desktop profile, account or synchronization configuration was opened or changed. Evidence is under ignored `output/playwright/ux-fixes-022/` (screenshots, matrix, form/contrast results and final candidate).
- Draft recovery is bounded, tab-local session storage, requires an explicit resume/discard, and does not sync drafts between devices. Unavailable storage is reported visibly; original stale-edit conflict checks remain in force.
- Native Electron/Safari, physical touch devices, a fresh 20.0.0 host installation and real cross-device synchronization were not rerun for this release. Existing compatibility and serial-sync evidence below is preserved without extending those claims.

## 0.21.0 — 2026-11-12

### Automated checks

- Full `npm run check` passed: ESLint, Prettier, 295 tests, version/changelog validation, bundled JavaScript syntax and ZIP integrity.
- Added regressions for multi-position insertion, preserving invisible/other-group slots and exact habit histories, pointer and touch-handle events, keyboard/menu alternatives, cancellation, edge scrolling and disabled controls.
- The UI version, package, lockfile, manifest and current README entry are 0.21.0. The final iframe is 25,938 bytes, below the 100 KiB host boundary.

### Isolated packaged-build review

- Used a separate browser iframe harness with the built host plugin, built loader/application, host UI Kit and synthetic local storage. No personal data or desktop profile was loaded or modified.
- Six visible habits render as collapsed rows measuring approximately 59.4 px at the wide desktop size. The fixture also contains a hidden habit, an archived habit, daily notes and an archived legacy journal.
- Dragged Coffee across several rows with actual pointer input. It was inserted at the indicated destination, preserving intermediate relative order. Confirmed storage changed only order metadata; all habit fields and histories remained exactly equal to the fixture. The resulting order survived a complete preview reload.
- Verified keyboard arrow movement and the compact move menu. A grouped fixture retained group membership and other-group positions. Domain and controller tests also reject moves across groups and invalid drop destinations.
- Verified quick quantity increment/decrement and check-in/undo. After undo, all eight synthetic habit objects matched their original values, including notes and the legacy journal.
- Simulated a failed persistence call: confirmed order/history stayed unchanged, saving paused visibly, and Reload data recovered the confirmed state. No optimistic order was presented as saved.
- Expanded inline history and confirmed the seven daily markers, streak/best information, notes, visibility and full-details actions remain accessible. Entering Reorder closes the expanded panel.
- Checked English/dark and Russian/light layouts at wide, 780 px and 320 px plugin widths. At 320 px, both expanded history and reordering had matching client/scroll widths of 320 px; long names wrapped without horizontal overflow.

### Limits

- This iteration tests the packaged offline resource bridge and host styling in an isolated browser harness. A fresh real-host installation, native Electron/Safari, physical touch devices and cross-device sync were not rerun for this UI change. Touch behavior is covered by controller events and touch target CSS, rather than a physical device.
- Existing 0.20.0 host/API and serial-sync evidence remains below; no concurrent-device ordering merge is claimed. Background data refresh cancels an unfinished drag, and a committed move derives its peers from freshly read confirmed data.


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
