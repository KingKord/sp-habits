# User guide

[Back to the README](../README.md)

Use this reference for detailed rules, settings and limitations. For a first installation, start with the [README](../README.md#install).

## Episode review tasks

For a bad habit, enable **Create a brief review task when pressing +** in its settings. It is off by default. Each quick + press adds the configured quantity and creates one three-minute task in Inbox with the selected episode date, time zone, quantity and three reflection questions. This also works when recording a past episode. Manual quantity forms, minus, initial amounts, imports and reconciliation do not create tasks. Completing the review does not remove the episode.

The episode is saved before task creation. If creation is not confirmed, check Inbox and create the task manually if missing; do not press + again for the same episode. There is no automatic retry, reminder or recurring review task.

## Install or update

1. Download `sp-habits.zip` and its SHA-256 file from [GitHub Releases](https://github.com/KingKord/sp-habits/releases).
2. Open **Settings → Plugins** in Super Productivity.
3. Select **Choose Plugin File**, choose the complete ZIP without extracting it, and confirm installation.
4. Enable **Habits** and open it from the sidebar.

The internal plugin ID is `sp-habit-limits`. Uploading a compatible ZIP with the same ID updates the existing installation and retains access to its saved data. Export a JSON backup before updating.

Uninstalling and reinstalling has not been tested as a data-preserving update path. See [verification records](../VERIFICATION.md) for checked behavior and platform limits.

The release contains no personal habits or sample history. Test data is used only in isolated browser profiles.

## Features

- Positive goals: meet a minimum over the last N calendar days.
- Event limits: stay at or below a maximum over the last N calendar days, including zero limits.
- Arbitrary habit names, emoji, units and positive integer counter steps.
- Quick ± controls and a daily-total editor independent of the configured step.
- Historical rules, past-date corrections and a seven-day history strip.
- Fixed recurring-task integration with automatic completions and rest days.
- Current streaks, ideal days within a streak, personal bests and 7/14/30-day achievements.
- A shared monthly calendar, adjustable colour zones and future reduction plans.
- Statistics with rolling, calendar and custom periods.
- Hide/unhide, archiving, JSON backup/import, visible storage errors and recovery export.
- English source text, optional Russian translation, and light/dark/automatic themes.
- Responsive layouts that use the full available plugin width.

## Interface and responsive layouts

Day, Calendar and Statistics share one content inset: the existing 12 px through 480 px and 16 px through 700 px, then 32 px from 701 to 1023 px and 48 px from 1024 px of plugin viewport width. These outer margins separate the content from app navigation while keeping headings, tabs and content on a common vertical line. The remaining width stays fluid without a maximum-width cap.

**Day** uses compact rows showing the habit name, rule, current streak and quick entry actions. Select a name to edit settings, an amount to edit that day's total, or the chevron to expand recent history, full streaks, best results, badges, notes and other actions. Select a day in the expanded history to correct it. The ± buttons use the configured step. **Hide habit** in the expanded actions moves a habit to **Hidden**; **Show habit** restores it.

Rows stay collapsed until expanded. At 600 px and below, quick entry actions wrap below the name; expanded streak information and history stack vertically. Wider expanded rows use two columns with date labels above their own history. Long names and narrow-screen rules wrap. Quick action buttons are 32×32 px on wide fine-pointer layouts and 44×44 px on narrow or coarse-pointer layouts. History markers preserve their square aspect ratio.

**Calendar** uses the full available width. At 900 px and below, the month becomes a compact date grid with up to four status symbols and a count of remaining habits. Select a date to move to the full habit names and amounts below the month; **Back to selected date** returns to the selected grid cell. A note marker identifies dates with saved notes. Future dates can be inspected but their amounts cannot be edited. An empty filter keeps the grid and shows an explanation. On month changes, the selected Day date is preferred if it belongs to that month, then today, then the first of the month.

Use **Reorder** in Day to reveal drag handles and compact **⋯** menus. Drag a handle to insert a habit before or after another habit in the same group, use Up/Down arrow keys on a focused handle, or select **Move up / Move down** from its menu. A line indicates the drop position. Escape, pointer cancellation, a data refresh or leaving Day cancels an unfinished drag. Moves affect only the selected Active, Hidden or Archived list; habits outside that filter retain their positions. Escape closes an open reorder menu and returns focus to its trigger; outside interaction also dismisses it. Opening another menu closes the previous one. Select **Done reordering** to finish. The existing expanded history closes when entering reordering. The saved order survives hiding, archiving and backups. New habits appear after existing habits in Ungrouped, and old backups retain their original array order without being rewritten on read.

**Manage groups** in Day separately manages optional single-level groups. Add or rename a group with a name of 1–80 characters, and use the group row’s Move buttons to change group order. Each habit’s Group selector in its expanded actions moves it to a group or Ungrouped. Within a group, habits retain their manual relative order. Removing a group leaves its habits and history in Ungrouped. Hidden and archived habits retain membership; empty groups can be managed in Manage groups even when the selected list has no members. Group changes affect Day organization only and do not change counts, rules or statistics.

On wider screens, the calendar's **Compact view** switch shows only each habit's status mark and emoji (habits without an emoji keep their name); the choice is remembered. At 900 px and below, compact presentation is automatic and the desktop switch is hidden. Resizing back to a wide view restores the remembered desktop choice.

**Statistics** uses a full-width table on larger screens and labelled habit cards at 700 px and below. The same data and table semantics serve both layouts. Summary metrics stack vertically on small screens. Custom-period date inputs retain unapplied edits when changing filters or receiving unrelated data updates. Use **Show** to apply the range; selecting a named preset deliberately replaces the range draft.

Dialogs fit the available width and dynamic viewport height. Long forms scroll; mobile form actions stay near the bottom edge. Inputs use 16 px text on narrow screens, and touch controls have larger hit areas. Focus returns to the original control after saving, including after a background refresh. New pointer or keyboard input cancels a delayed focus request.

**More** contains export, import, theme and information controls. Editors close with their close button, Escape or a backdrop click. Closing a changed habit, quantity, note or reduction-plan form asks before discarding unsaved edits; choose Cancel to keep editing. Unchanged forms close immediately. Incoming data updates keep open form inputs intact. If the habit settings or the daily amount being edited changed elsewhere, saving pauses that edit with an explanation; reopen the form to review the latest data. Updates to unrelated quantities do not block settings edits. In single-line habit fields, Return dismisses the keyboard and keeps the form and pending edits open; use **Create** or **Save** to submit. Text composition and keyboard activation of buttons retain their normal behavior. Closing the nested emoji picker leaves the habit editor open; dragging from a field onto the backdrop does not dismiss a form. An explicit Light or Dark theme choice is remembered on this device; **Follow app** removes the override and follows the host theme. If preference storage is unavailable, the selection still applies to the current view and a message explains that it could not be remembered.

History expansion and confirmed row changes use short, restrained visual feedback. A save indicator appears only after storage confirms a change. Reduced-motion preferences disable animation and transitions while keeping static confirmation and textual feedback.

When tab storage is available, unsaved editor drafts are kept temporarily in the current browser tab. After leaving Habits through host navigation and returning, choose **Resume saved drafts** to review them or **Discard saved drafts** to remove them. This recovery dialog waits for an explicit choice. If draft storage is unavailable, keep the view open or save before leaving; the warning explains this limit. Drafts are not confirmed habit history: they are not synchronized or included in JSON exports, and closing the browser tab can remove them. Restoring a draft preserves its original conflict checks, so it cannot silently overwrite newer confirmed data. If a habit or date is no longer editable, the recovery view keeps its text available for copying before **Discard unavailable drafts**, instead of pretending it was restored.

The UI follows the host's [UI Kit and theme variables](https://github.com/super-productivity/super-productivity/blob/v19.3.1/docs/plugin-development.md#theme-variables--ui-kit). Ordinary controls are styled by Super Productivity; custom styles use the same colours, typography and corner radii.

## Daily notes

A small note button next to a collapsed habit name indicates an existing note for the selected date and opens it directly. Calendar dates and habit marks also indicate saved notes. Select **Add note** or **Edit note** on an expanded habit in Day, or **Daily note** in a daily quantity/check-in form. Notes belong to the selected date and are independent of its outcome: saving a note never records a quantity, marks a check-in or creates a review task. Notes are also available on rest days and task-linked days; changing a task-derived quantity still requires the linked task.

Each note accepts up to 500 characters of plain text. Save an empty note or select **Remove note** to remove it. Unsaved note changes require confirmation before dismissal. After a failed save, **Reload data and keep editing** reloads confirmed data without clearing the open draft. Review any conflict explanation before retrying; a draft cannot silently overwrite a note changed elsewhere. If the same note changed elsewhere, your input stays in the form and cannot overwrite the newer note; reopen it to review the latest text.

Notes can be edited for past and current dates within a habit's tracking dates, including archived history. They survive hiding, archiving and JSON export/import. Old event journals remain compatibility archives and are not changed by note edits.

## Goals, frequency and units

Create a **Good** habit to build a behavior, or a **Bad** habit to limit or avoid one. In the single **Tracking** field, choose **Done / missed** for a daily check-in or select a quantity unit. Quantity habits use a minimum for Good and a maximum for Bad. Counts and limits are integers from 0 to 1,000,000,000. Goal periods span 1–366 calendar days.

For example, reading can require at least 20 min per day with a +5 step. A frequency goal can require at least three workouts over the last seven days. Exploring a calendar-week goal and then returning to the daily/rolling mode retains the prior period draft. A maximum of one event over seven days means a rolling window; an event on Sunday followed by another on Monday exceeds that limit.

A period includes the selected date and the previous N−1 calendar days in the plugin timezone. It is neither a calendar week nor an exact interval measured in hours. Assessment begins on the habit's first tracking day without waiting for a full window. Events before tracking are excluded. A date with a zero daily count can still exceed a rolling maximum because of earlier events in its window.

The daily counter changes one date's total. Statuses and calendar colours compare the **period total** with the rule that applied on that date. Changing a rule can use earlier counts within its new window; it does not change assessments before the rule's effective date. Old rules without `periodDays` remain daily rules.

Standard unit IDs are `times`, `items`, `ml`, `g` and `min`. **Other…** accepts a custom label of up to 16 characters. New defaults use `times` with step 1. The UI translates standard labels; it never translates user-defined labels or habit names. Legacy localized unit values remain readable, and saving metadata preserves the original stored value. Missing unit/step fields are read without rewriting old backups.

Changing a unit changes the label for that habit's history; it does **not** convert stored numbers. Use a separate habit if you want to switch from cups to millilitres while keeping the old tracking system intact.

For a 300 ml allowance and a +100 step, three presses reach 300 and remain acceptable; a fourth reaches 400 and exceeds the allowance. The daily-total form can set an independent value such as 150. Save or Enter applies it. Cancel and Escape write nothing; changed values require an explicit discard confirmation. Subtraction cannot produce a negative total.

Statistics keep different units separate. Standard aliases are combined for display, but amounts in millilitres and items are never added into one total.

## Calendar-week goals

Positive habits can choose a **Goal period** of a rolling/daily rule, **Calendar-week quantity**, or **Successful days per calendar week**. Calendar weeks explicitly use a saved Monday boundary. Quantity mode totals recorded amounts in that week. Successful-day mode counts each scheduled date at most once, using the daily minimum or a successful check-in; three increments on one date cannot earn three days. Weekly check-ins support successful-day mode.

For quantity goals that count successful days, the daily minimum must be at least 1. Existing daily and rolling zero-minimum goals keep their behavior. A weekly check-in's daily marks and colours always show its explicit Done/Missed/unknown result; the weekly target and progress remain separate. Meeting a weekly target never changes a Missed mark into Done, and missing a weekly target never changes an individual Done mark into Missed. Weekly check-in descriptions retain any time condition.

Weekly progress is provisional until the week ends. Partial first/last weeks, weeks containing rule/schedule changes or pauses, and weeks cut by the selected statistics range show progress but do not count toward rates or streaks. A closed check-in week below its target with unmarked scheduled days remains unknown. Weekly streaks count weeks, and daily/weekly assessment units are not combined into one percentage. Existing seven-day rolling rules retain their original meaning. Changes to weekly mode or its target use the selected effective date and preserve earlier rules.

## Manual schedules

Manual habits can use **Due days → Daily**, **Selected weekdays**, or **Every N days** with a saved schedule anchor. Changes use the selected rule effective date; earlier schedules remain in history. Days before an interval anchor are rest days. Rest days neither earn nor break streaks and are excluded from completion denominators. You can correct or record a rest-day amount/mark: it is preserved in totals but is not assessed. A linked task owns its schedule instead of these manual fields.

## Daily check-ins and optional time conditions

Choose **Done / missed** in **Tracking**. Good habits use **Mark done** and **Missed**; bad habits use **No slip** and **Slipped**. The buttons describe whether the goal was met. A slip is not rewarded as a completion. Repeating the selected action clears it back to **Not marked**, and selecting the other outcome replaces it. Past days can be corrected from the history or calendar; future days cannot be marked.

A check-in has no quantity, step, rolling period or yellow zone. Without a mark, the day stays neutral and unknown, earns no success, and interrupts the confirmed streak. Explicit success is green and failure is red. Today is provisional. Check-in totals count successful marks; their completion percentages exclude unmarked completed days, which are shown separately. The successful fraction uses the same assessed-day denominator as the percentage; marked-day coverage separately shows all scheduled completed days.

Optionally enable **Add a time condition** and set **No later than**, such as 08:00. This is the condition you assess, not a reminder or a clock-based check. No actual wake-up/completion time is requested or inferred: you can confirm the result later in the day. Times use 24-hour local wall-clock values from 00:00 through 23:59, and the stated boundary is inclusive.

Edit the condition with **Rule applies from** to change it from a chosen date while preserving earlier conditions and marks. Removing the time condition keeps the check-in and its history. Automatic time-condition plans are not exposed in this version.

Create a separate habit to change between quantity tracking and check-ins, so existing quantities retain their meaning. Manual check-ins cannot link to recurring tasks or create episode-review tasks. The earlier test-only `before-time` format remains readable; explicitly saving its settings upgrades its dated conditions while keeping marks. Exported check-in histories require this version or newer; do not open them in 0.18.1.

## Day assessment and historical rules

For quantity habits, a completed tracked day is successful when its period count is at or below a maximum, or at or above a minimum. Equality is successful. Missing daily amounts count as zero after tracking begins: zero satisfies a zero maximum, but fails a positive minimum. A zero minimum remains valid for daily and rolling quantity goals. Distinct-successful-day weekly quantity goals require a minimum of at least one.

Today is provisional and does not contribute to the final success percentage. Dates before tracking, after the archive boundary, or in the future do not get fabricated successes. A successful status describes the saved totals; it is not evidence of real-world activity.

Rules store their effective dates, goals, amounts and periods. A changed rule applies from its selected date until the next stored rule. You can backdate a rule before the current start date; tracking then expands to that date and missing amounts are treated as zero. Existing counts and later rule boundaries are preserved.

Archiving ends tracking after the current day, including that final day in history. Hiding only changes visibility: it preserves tracking, rules, task updates, streaks and statistics. Hidden habits are excluded by the Calendar **Active** filter unless the **Hidden habits** toggle is on, and always included by **All**. In Statistics the **Hidden habits** toggle is on by default; turn it off to leave hidden habits out. Use **Delete** in the habit editor to remove a habit and its history permanently (a linked Super Productivity task keeps running but is no longer tracked). An archive remains separately accessible regardless of its hidden flag.

In narrow habit-detail dialogs, scroll the history and dated-rule tables sideways to see every column. A visible hint identifies this gesture, keyboard focus can move into each table region, and the date column remains visible while inspecting amounts, outcomes or notes.

## Streaks, personal bests and achievements

The current streak uses completed days up to the selected date; today is considered only through yesterday. Successful green and acceptable yellow days extend the streak. Ideal days count only within that current successful streak. A failed day resets both current counters. Rest days, pauses and dates outside the schedule neither extend nor break a streak. Archived habits use the last tracked completed date.

The personal best survives a later failure. If the current streak exceeds the previous completed best, the label becomes **New best**. Achievements at 7, 14 and 30 days depend on the historical best and survive a broken current streak. Select a badge to see its condition, remaining progress or confirmation. After those thresholds, the next target advances in 30-day steps.

The record and achievements are derived from stored history with an interval calculation. There is no separate saved reward balance or migration. Past counts, rules and task corrections recompute them honestly. Viewing the past does not reveal achievements from later dates. Disabling colours does not change success, but neutral days do not count as ideal.

## Emoji and language

English is the source and fallback language. On every opening, the plugin reads `PluginAPI.getCurrentLanguage()` and falls back to `cfg.lang.code` for older hosts. Russian language codes, including regional variants, select the Russian translation; other languages fall back to English. The operating-system/browser language does not override the host. Reopen the plugin after changing the host language.

English source messages and authored HTML do not depend on Russian strings. Russian messages are in `src/i18n/ru.json`; locale-specific plural forms and legacy unit aliases belong to localization resources. `src/i18n/en.json` records the English source catalogue. CI rejects Cyrillic text outside localized resources and translation fixtures. Repository documentation, metadata, code comments, release notes and test descriptions use English. User data is preserved in any language.

The emoji picker contains 1,906 Unicode 16.0 emoji in nine categories with CLDR 46.1 English names and Russian translations. Search supports both languages without selecting a Russian-only normalization rule. Repeated skin-tone variants are omitted from the grid; custom composite emoji can be pasted into **Custom emoji**. The catalogue is bundled and needs no network access.

On macOS and Windows desktop builds, **Open system emoji** uses the same `window.ea.showEmojiPanel()` bridge as the host's built-in habits, focusing the custom field first. Select **Use**, then save the habit. macOS also supports Control-Command-Space. The system button is hidden in browsers and on Linux. Windows support was checked in the Super Productivity/Electron source, not manually on Windows. No additional permissions or Node execution are required.

**No emoji** clears the pending selection. Cancelling the picker leaves the form unchanged; cancelling the form leaves the stored habit unchanged. Emoji apply to the whole habit and its history, and are included in JSON backups.

## Recurring-task integration

Select **Linked recurring task** when creating or editing a habit. Supported schedules are active, fixed `DAILY` repeats every 1–366 calendar days and `WEEKLY` repeats every 1–366 weeks with selected weekdays and an explicit start date. Set repetition, time and reminders in Super Productivity. Linking reads tasks and repeat configurations; it does not edit the linked series. Optional episode review tasks are a separate opt-in feature described above.

Linking configures a positive habit with a minimum of one completion per day. The link takes effect today without backfilling earlier history. One repeat series can belong to only one active habit. Instances are identified by the repeat-series ID rather than the title or one instance's task ID.

- Completion adds one to the actual `doneOn` date in the plugin timezone. Repeated notifications, reloads and task archiving do not duplicate it.
- Undoing completion or skipping a task removes its automatic contribution. A task missing from the accessible query is not treated as an undo.
- Dates between scheduled occurrences are **Rest day** and excluded from the success percentage. Future rest dates do not show a fictional daily goal.
- A late completion is recorded on the actual completion date, including a rest day. The earlier missed occurrence stays missed. A rest-day amount is included in quantity totals but does not alter the success rate.
- Changed, paused, deleted or unsupported schedules affect tracking from the day the plugin observes them. Earlier rules and saved completions remain. Paused or unavailable series produce rest days from that boundary.
- Linked periods are edited through the task. Manual totals remain separately stored. Unlinking stops future automatic updates and preserves previous records; archiving the habit freezes its history.

The background integration works while Super Productivity is open and the plugin is enabled, including with the Habits view closed. It reconciles on readiness, task/data hooks and every 30 seconds, reads live and archived tasks, and notifies an open view. Errors are visible and never replace history with empty data. Writes share one queue and compare the previous raw value; use **Reload data** after a conflict.

After-completion, wait-for-completion, monthly and yearly schedules are unsupported. Integration counts completions rather than reading minutes. Weekly links respect the host's `deletedInstanceDates`; existing daily-link behavior continues to ignore those exceptions. The plugin and host schedule timezones must agree.

Weekly host recurrence counts seven-day blocks from the task's saved start date, independently of Monday-based habit goal weeks. For example, a Wednesday anchor with a two-week repeat on Monday and Friday schedules the following Friday and Monday in that first block. The arithmetic and weekday fields were checked against the official [19.3.1 recurrence source](https://github.com/super-productivity/super-productivity/blob/v19.3.1/src/app/features/task-repeat-cfg/store/get-newest-possible-due-date.util.ts), [20.0.0 recurrence source](https://github.com/super-productivity/super-productivity/blob/v20.0.0/src/app/features/task-repeat-cfg/store/get-newest-possible-due-date.util.ts) and [week-difference helper](https://github.com/super-productivity/super-productivity/blob/v20.0.0/src/app/util/get-diff-in-weeks.ts), with independent date-oracle tests. This uses existing configuration fields and needs no new permission or minimum-host increase; source and fixture checks do not replace real-host integration testing.

`taskSchedules` and `taskCompletions` are included in backups. Use a supported compatible build after enabling task links so automatic amounts and rest days remain understood. Concurrent editing from multiple devices remains unsupported.

## Calendar colours and reduction plans

Calendar weeks begin on Monday. Each habit entry has a status marker, name and daily amount; its accessible label includes the period usage. Today has a dashed outline. Future entries are read-only and can expose the planned rule in their label. **Habit settings and reduction plans** below the calendar opens settings or a reduction plan for a maximum goal.

For a maximum of 300 ml and an ideal target of 0 ml, zero is ideal green, 1–300 is acceptable yellow, and above 300 is red. Green and yellow days are successful. Yellow can never extend past the main allowance. For a positive minimum of 20 min and ideal target of 30, below 20 is red, 20–29 is yellow and 30 or more is green.

Colour switches affect presentation rather than limits or statistics. Turning off yellow makes acceptable non-ideal results neutral. The ideal threshold is clamped to the effective rule when necessary. Colour settings apply across history without rewriting rule history. Legacy `yellowMax` means yellow is enabled; it cannot authorize an excess. Saving settings writes explicit `yellowEnabled` and clears `yellowMax`. Habits without zone settings keep the original rule-based assessment.

A reduction plan can lower the amount while preserving its period, or reduce frequency through editable **From / At most / Over days** stages. For example, one event over 2 days can become one over 7, then one over 14. Dates must increase, each stage must reduce the average frequency, and a preview is shown before saving.

For amount reduction, choose the first future date, a 1–366-day interval, a decrease and a target below the original amount. Reducing 300 by 100 every seven days to zero produces 200 → 100 → 0. Plans allow at most 120 changes and replace future rules from the selected date, preserving past rules, today's amount and stored totals. Dates activate the rules; no background timer is required. **Cancel future plan** removes only pending planned changes, leaving completed stages and separate manual rules. Archiving removes future rules.

## Pauses and exceptions

**Pauses and exceptions** in a manual habit's settings accepts inclusive date ranges; equal dates make a single-day exception. **Until resumed** creates an open-ended pause, and **Resume today** ends it yesterday. Add/remove/resume actions are drafts until the habit is saved. Overlapping ranges are merged. Paused dates show ⏸, remain distinct from unknown or rest days, and neither earn nor break streaks. Existing quantities and marks remain in backups and totals, including their contribution to rolling windows. Linked-task pauses belong to the host and cannot overlap a local manual pause. Archiving closes pauses on the final tracked day.

## Daily totals and old journals

Storage records a total per date; new events do not create a time/comment journal. Quick controls and the amount editor only change that total.

Old journals are read unchanged. On the first amount mutation, an existing journal is moved intact to optional `legacyJournal` and remains in backups. New detail entries are not added, shown or used in calculations. Opening, exporting or changing a name/emoji alone does not rewrite a journal.

## Statistics

Choose **7 days**, **30 days**, **This week**, **Current month**, **Year**, **Current year** or **Custom period**. Rolling 7/30-day periods include today. A calendar week starts on Monday; current month/year start on their first date and end today. **Year** means the last 12 calendar months, from the day after the corresponding date last year; February 29 is clamped to February 28 in the earlier year.

Custom dates are inclusive and cannot extend into the future. Date fields and **Show** are displayed only for a custom period; the range is not duplicated in a caption. Filters select all, active or archived habits; all history is included by default.

Each habit shows its total in its own unit, successful outcomes out of assessed outcomes, and a matching percentage with a small progress bar. Daily check-ins show marked-day coverage separately; unknown weeks and partial weeks are explicitly labelled. Failed days and average daily amount are in the row hint. Quantity totals and averages include today when in range, but the final percentage does not. Start/archive boundaries and historical rules are respected.

The overall percentage weights habit-days, rather than averaging habit percentages: two habits on one date contribute two assessments. No completed tracking days yields “—”, not a fabricated zero or 100%. Statistics are read-only and operate on rule segments and recorded intervals instead of visiting every date. Rolling assessments can need records before the requested range; amount totals include only dates inside it.

## Habit details

Expand a Day row and select **Details** to inspect one habit without changing its settings. The view starts with up to 30 days ending on the selected Day date (or the habit's archive boundary). Choose an inclusive From/To range ending no later than today. Daily history and overlapping dated rules are separately paginated, with at most 31 rows per page and newest dates first.

The read-only table separates daily quantities/check-ins, the outcome assessed using that date's rule, goal-period usage and daily notes. Quantity bars compare only the dates on the current page; the same values remain available as text. Unknown marks, rest days, linked-task results and provisional today use the same rules as the other views. Range quantity may include today; success rates and streaks exclude it. Streak and best values are evaluated through the selected range end, with their history before the range retained. Rule dates show their original boundaries, including the rule already active when the range starts. Changing ranges or pages does not write history.

## Storage and limitations

Data is stored through the plugin's own synced API storage. Built-in habits are not modified, and task links use the official read APIs. Optional episode reviews create tasks through PluginAPI.addTask using the host's Inbox project ID. There are no runtime HTTP/CDN requests, separate accounts, Node execution or server hosting.

Schema version 1 remains readable without a read-time migration. `goal` is optional and defaults to `at-most`; `at-least` represents a minimum. Rules with `tracking: "check-in"` use explicit outcome marks (1 for success, 0 for failure, no entry for unknown), independently of the habit direction. Their optional `deadline` is a wall-clock minute condition, separate from the mark. Emoji, zones, unit, step and legacy fields are optional. Do not downgrade new schedules, pauses or calendar-week goals to pre-0.20.0 builds: older code can ignore this metadata and assess the history incorrectly. The same applies to positive goals, frequency and task links in older formats.

Writes are serialized, including rapid clicks. Wait for **Ready** before closing. A failed write stops the queue; **Reload data** restores confirmed storage. Invalid JSON is surfaced rather than replaced with an empty history. Import validates the structure and replaces the entire plugin history after confirmation.

Normal JSON exports use compact formatting so adding indentation cannot make a backup exceed its import limit. Import accepts files up to 12,000,000 UTF-8 bytes, including older indented exports, provided their compact JSON fits the existing storage capacity of 4,000,000 UTF-16 code units. This byte allowance preserves the full capacity for Unicode names, units and legacy notes. Formatting is not stored; history, unknown fields and user-entered text are preserved. Oversized imports and edits are rejected before writing. **Download original data** exports the original stored string unchanged for recovery.

Sync depends on Super Productivity settings. Serial delivery was verified between two isolated clients using local WebDAV, including updates to the same open iframe. Metadata required a second quiescent upload/download in one case; instant or single-cycle delivery is not guaranteed. Concurrent multi-device edits remain unsupported because one JSON value cannot merge parallel changes. Other providers, automatic-sync timing, encryption and reconnect recovery were not verified.

The timezone is captured from the system when the first state is saved and is then retained. Days run 00:00–24:00; a custom host start-of-day setting is not supported. Closed applications need no scheduled task: results are derived when opened.

Other current limitations: no fractional counts, exact-hour frequency windows, progressive increases for positive goals, restore-from-archive.

