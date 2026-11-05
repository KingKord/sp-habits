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

**Day** shows each habit's name, rule, streaks, best result, daily amount and seven days of history. Select a name to edit the habit, or an amount/day to edit that date's total. The ± buttons use the configured step. The eye button moves a habit to **Hidden**; select it again there to restore the habit.

Above 700 px, the habit details and history use two columns with one shared date header. At 700 px and below, each habit becomes a vertical card: its week, date labels, goal and achievements appear under its details. Long names and rules wrap. Counter buttons are 44×44 px. Days are 44 px high and about 41 px wide at the smallest checked width of 320 px.

**Calendar** uses the full available width. At 900 px and below, the month becomes a compact date grid with up to four status dots and a count of remaining habits. Select a date to see full habit names and amounts below the month. Future dates can be inspected but their amounts cannot be edited. An empty filter keeps the grid and shows an explanation. On month changes, the selected Day date is preferred if it belongs to that month, then today, then the first of the month.

**Statistics** uses a full-width table on larger screens and labelled habit cards at 700 px and below. The same data and table semantics serve both layouts. Summary metrics stack vertically on small screens.

Dialogs fit the available width and dynamic viewport height. Long forms scroll; mobile form actions stay near the bottom edge. Inputs use 16 px text on narrow screens, and touch controls have larger hit areas. Focus returns to the original control after saving, including after a background refresh. New pointer or keyboard input cancels a delayed focus request.

**More** contains export, import, theme and information controls. Dialogs close with their close button, Escape or a backdrop click. Closing discards unsaved edits. Closing the nested emoji picker leaves the habit editor open; dragging from a field onto the backdrop does not dismiss a form. The temporary theme selection lasts until the plugin view is closed.

The UI follows the host's [UI Kit and theme variables](https://github.com/super-productivity/super-productivity/blob/v19.3.1/docs/plugin-development.md#theme-variables--ui-kit). Ordinary controls are styled by Super Productivity; custom styles use the same colours, typography and corner radii.

## Goals, frequency and units

Create a **Positive** habit to meet a minimum, or a **Negative** habit to stay within an allowance. Counts and limits are integers from 0 to 1,000,000,000. Goal periods span 1–366 calendar days.

For example, reading can require at least 20 min per day with a +5 step. A frequency goal can require at least three workouts over the last seven days. A maximum of one event over seven days means a rolling window; an event on Sunday followed by another on Monday exceeds that limit.

A period includes the selected date and the previous N−1 calendar days in the plugin timezone. It is neither a calendar week nor an exact interval measured in hours. Assessment begins on the habit's first tracking day without waiting for a full window. Events before tracking are excluded. A date with a zero daily count can still exceed a rolling maximum because of earlier events in its window.

The daily counter changes one date's total. Statuses and calendar colours compare the **period total** with the rule that applied on that date. Changing a rule can use earlier counts within its new window; it does not change assessments before the rule's effective date. Old rules without `periodDays` remain daily rules.

Standard unit IDs are `times`, `items`, `ml`, `g` and `min`. **Other…** accepts a custom label of up to 16 characters. New defaults use `times` with step 1. The UI translates standard labels; it never translates user-defined labels or habit names. Legacy localized unit values remain readable, and saving metadata preserves the original stored value. Missing unit/step fields are read without rewriting old backups.

Changing a unit changes the label for that habit's history; it does **not** convert stored numbers. Use a separate habit if you want to switch from cups to millilitres while keeping the old tracking system intact.

For a 300 ml allowance and a +100 step, three presses reach 300 and remain acceptable; a fourth reaches 400 and exceeds the allowance. The daily-total form can set an independent value such as 150. Save or Enter applies it; Cancel and Escape write nothing. Subtraction cannot produce a negative total.

Statistics keep different units separate. Standard aliases are combined for display, but amounts in millilitres and items are never added into one total.

## Day assessment and historical rules

A completed tracked day is successful when its period count is at or below a maximum, or at or above a minimum. Equality is successful. Missing daily amounts count as zero after tracking begins: zero satisfies a zero maximum, but fails a positive minimum. A zero minimum is allowed and is met without entries.

Today is provisional and does not contribute to the final success percentage. Dates before tracking, after the archive boundary, or in the future do not get fabricated successes. A successful status describes the saved totals; it is not evidence of real-world activity.

Rules store their effective dates, goals, amounts and periods. A changed rule applies from its selected date until the next stored rule. You can backdate a rule before the current start date; tracking then expands to that date and missing amounts are treated as zero. Existing counts and later rule boundaries are preserved.

Archiving ends tracking after the current day, including that final day in history. Hiding only changes visibility: it preserves tracking, rules, task updates, streaks and statistics. Hidden habits are excluded by the Calendar **Active** filter and included by **All**. An archive remains separately accessible regardless of its hidden flag.

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

Select **Linked recurring task** when creating or editing a habit. Supported schedules are active, fixed `DAILY` repeats every 1–366 calendar days with a start date. Set repetition, time and reminders in Super Productivity. Linking reads tasks and repeat configurations; it does not edit the linked series. Optional episode review tasks are a separate opt-in feature described above.

Linking configures a positive habit with a minimum of one completion per day. The link takes effect today without backfilling earlier history. One repeat series can belong to only one active habit. Instances are identified by the repeat-series ID rather than the title or one instance's task ID.

- Completion adds one to the actual `doneOn` date in the plugin timezone. Repeated notifications, reloads and task archiving do not duplicate it.
- Undoing completion or skipping a task removes its automatic contribution. A task missing from the accessible query is not treated as an undo.
- Dates between scheduled occurrences are **Rest day** and excluded from the success percentage. Future rest dates do not show a fictional daily goal.
- A late completion is recorded on the actual completion date, including a rest day. The earlier missed occurrence stays missed. A rest-day amount is included in quantity totals but does not alter the success rate.
- Changed, paused, deleted or unsupported schedules affect tracking from the day the plugin observes them. Earlier rules and saved completions remain. Paused or unavailable series produce rest days from that boundary.
- Linked periods are edited through the task. Manual totals remain separately stored. Unlinking stops future automatic updates and preserves previous records; archiving the habit freezes its history.

The background integration works while Super Productivity is open and the plugin is enabled, including with the Habits view closed. It reconciles on readiness, task/data hooks and every 30 seconds, reads live and archived tasks, and notifies an open view. Errors are visible and never replace history with empty data. Writes share one queue and compare the previous raw value; use **Reload data** after a conflict.

After-completion, wait-for-completion, weekly, monthly and yearly schedules are unsupported. Integration counts completions rather than reading minutes. `deletedInstanceDates` exceptions do not change the fixed habit assessment. The plugin and host schedule timezones must agree.

`taskSchedules` and `taskCompletions` are included in backups. Use a supported compatible build after enabling task links so automatic amounts and rest days remain understood. Concurrent editing from multiple devices remains unsupported.

## Calendar colours and reduction plans

Calendar weeks begin on Monday. Each habit entry has a status marker, name and daily amount; its accessible label includes the period usage. Today has a dashed outline. Future entries are read-only and can expose the planned rule in their label. **Habit settings and reduction plans** below the calendar opens settings or a reduction plan for a maximum goal.

For a maximum of 300 ml and an ideal target of 0 ml, zero is ideal green, 1–300 is acceptable yellow, and above 300 is red. Green and yellow days are successful. Yellow can never extend past the main allowance. For a positive minimum of 20 min and ideal target of 30, below 20 is red, 20–29 is yellow and 30 or more is green.

Colour switches affect presentation rather than limits or statistics. Turning off yellow makes acceptable non-ideal results neutral. The ideal threshold is clamped to the effective rule when necessary. Colour settings apply across history without rewriting rule history. Legacy `yellowMax` means yellow is enabled; it cannot authorize an excess. Saving settings writes explicit `yellowEnabled` and clears `yellowMax`. Habits without zone settings keep the original rule-based assessment.

A reduction plan can lower the amount while preserving its period, or reduce frequency through editable **From / At most / Over days** stages. For example, one event over 2 days can become one over 7, then one over 14. Dates must increase, each stage must reduce the average frequency, and a preview is shown before saving.

For amount reduction, choose the first future date, a 1–366-day interval, a decrease and a target below the original amount. Reducing 300 by 100 every seven days to zero produces 200 → 100 → 0. Plans allow at most 120 changes and replace future rules from the selected date, preserving past rules, today's amount and stored totals. Dates activate the rules; no background timer is required. **Cancel future plan** removes only pending planned changes, leaving completed stages and separate manual rules. Archiving removes future rules.

## Daily totals and old journals

Storage records a total per date; new events do not create a time/comment journal. Quick controls and the amount editor only change that total.

Old journals are read unchanged. On the first amount mutation, an existing journal is moved intact to optional `legacyJournal` and remains in backups. New detail entries are not added, shown or used in calculations. Opening, exporting or changing a name/emoji alone does not rewrite a journal.

## Statistics

Choose **7 days**, **30 days**, **This week**, **Current month**, **Year**, **Current year** or **Custom period**. Rolling 7/30-day periods include today. A calendar week starts on Monday; current month/year start on their first date and end today. **Year** means the last 12 calendar months, from the day after the corresponding date last year; February 29 is clamped to February 28 in the earlier year.

Custom dates are inclusive and cannot extend into the future. Date fields and **Show** are displayed only for a custom period; the range is not duplicated in a caption. Filters select all, active or archived habits; all history is included by default.

Each habit shows its total in its own unit, successful completed days out of tracked completed days, and a success percentage with a small progress bar. Failed days and average daily amount are in the row hint. Quantity totals and averages include today when in range, but the final percentage does not. Start/archive boundaries and historical rules are respected.

The overall percentage weights habit-days, rather than averaging habit percentages: two habits on one date contribute two assessments. No completed tracking days yields “—”, not a fabricated zero or 100%. Statistics are read-only and operate on rule segments and recorded intervals instead of visiting every date. Rolling assessments can need records before the requested range; amount totals include only dates inside it.

## Storage and limitations

Data is stored through the plugin's own synced API storage. Built-in habits are not modified, and task links use the official read APIs. Optional episode reviews create tasks through PluginAPI.addTask. There are no runtime HTTP/CDN requests, separate accounts, Node execution or server hosting.

Schema version 1 remains readable without a read-time migration. `goal` is optional and defaults to `at-most`; `at-least` represents a minimum. Emoji, zones, unit, step and legacy fields are optional. Do not downgrade to a version that does not understand positive goals, frequency or task links; older code can interpret a minimum as a maximum or ignore automatic counts.

Writes are serialized, including rapid clicks. Wait for **Ready** before closing. A failed write stops the queue; **Reload data** restores confirmed storage. Invalid JSON is surfaced rather than replaced with an empty history. Import validates the structure and replaces the entire plugin history after confirmation.

Sync depends on Super Productivity settings. Concurrent multi-device edits are unsupported because one JSON value cannot merge parallel changes. Delivery to a second client has not been verified.

The timezone is captured from the system when the first state is saved and is then retained. Days run 00:00–24:00; a custom host start-of-day setting is not supported. Closed applications need no scheduled task: results are derived when opened.

Other current limitations: no fractional counts, exact-hour frequency windows, progressive increases for positive goals, general manual pauses, restore-from-archive or permanent deletion.

