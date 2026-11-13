# Changelog

## 0.23.1

- Keep unchanged Day rows attached while saving and refreshing, updating only habits whose displayed data changed.
- Preserve scroll position when restoring action focus, reserve toolbar status space, and show saved feedback without changing row height.
- Keep compact check-in controls locked after a failed write until confirmed data is reloaded.

## 0.23.0

- Combine navigation and Add habit into one compact toolbar, keeping the page heading accessible without duplicating the host title (#44).
- Align date/month fields and navigation controls; keep calendar numerals centered when daily notes are present (#46, #47).
- Reuse the configured app-wide Add task shortcut inside the focused Habits view, with editable-field/modal guards and no change to native task controls (#45).
- Explain days without assessable goals and empty calendar filters; retain invalid month drafts with visible validation and applied-month context (#48–#50).
- Keep persistence status available in every view without displaying idle status as toolbar clutter (#51).
- Reveal desktop date details when requested and keep non-editable future entries readable (#52, #53).

## 0.22.0

- Protect unsaved quantities and reduction plans on every dismissal path; lock complete forms while saving (#24–#26).
- Keep custom statistics ranges, group-name caret/selection, backdated pause dates and inactive goal-mode drafts intact (#27, #28, #32, #43).
- Reload confirmed data inside failed-save dialogs while retaining input and original conflict checks (#36).
- Keep unsaved habit, quantity, note and plan drafts in tab-local session storage, with explicit resume/discard after host navigation and recoverable text for unavailable contexts (#39).
- Remember an explicit theme separately from habit history; Follow app removes the override and observes supported host theme changes (#33).
- Follow responsive emoji columns with arrow keys, dismiss reorder menus with Escape/outside interaction, and hide the forced-compact mobile toggle while preserving its desktop preference (#29, #34, #35).
- Bring selected mobile calendar details into view with a return action, expose saved notes in collapsed rows/calendar marks, and explain horizontally scrollable history tables with sticky dates (#37, #38, #42).
- Improve primary-button contrast and touch settings targets; add restrained expansion and confirmed-action feedback with a static reduced-motion alternative (#30, #31, #40).
- Clarify quantity zero-defaults, unknown check-ins and Undo in the in-app help and user guide (#41).

## 0.21.0

- Replace tall day cards with compact habit rows and quick quantity/check-in actions. Expand a row for recent history, streaks, badges, notes and additional actions.
- Reorder habits by dragging their handles, with insertion indicators, edge scrolling, keyboard arrows and a compact move menu. Moves stay within the selected list and group, preserving other positions and all history.
- Separate group management from reordering, and cancel unfinished drags safely when data changes or the view closes.

## 0.20.0

- Arrange habits with accessible persisted ordering and optional named groups (#13, #14).
- Add independent daily notes without changing quantities, outcomes or archived journals (#15).
- Schedule manual habits on selected weekdays or anchored intervals, with dated pause intervals and exceptions (#17, #19).
- Add positive calendar-week quantity and distinct-successful-day goals, preserving daily marks and treating partial weeks as progress only (#18).
- Support fixed weekly host task links with verified anchored recurrence semantics (#20).
- Add read-only habit details with paginated history, dated rules and custom ranges (#16).
- Load bundled application code through the existing verified offline resource bridge, keeping the iframe below the host size limit.
- Preserve stale-edit conflict checks and unsaved pause/group drafts across background changes.
- Verify the supported host API matrix and real serial WebDAV delivery into open views; correct episode review creation to use the host Inbox project (#21).

## 0.19.1

- Refresh open views when persisted data changes, including histories without task links (#8).
- Protect stale settings, totals and reduction plans from overwriting changed data; confirm before discarding habit form edits (#10).
- Keep normal JSON backups compact and accept compatible formatted Unicode backups within a bounded 12 MB import envelope; validate storage capacity before writing (#9).
- Explain check-in rate denominators and recorded-day coverage without treating unknown days as failures (#11).
- Distinguish calendar outcomes with visible symbols in compact layouts (#12).
- Keep host UI Kit heading colors readable when a temporary plugin theme differs from the app theme.
- Report iframe build capacity and bundle contributors in CI, and correct obsolete deletion documentation (#22, #23).

## 0.19.0

- Add a Delete button next to Archive in the habit editor; deleting asks for confirmation and permanently removes the habit and its history (#7).
- Add a Compact view switch to the calendar that shows only each habit's status mark and emoji; the choice is remembered (#6).
- Add a Hidden habits toggle to the calendar and to Statistics to include or exclude hidden habits (#5).
- Replace the hidden-habit icon with a standard eye / crossed-eye pair and centre calendar date numbers in their cells (#4).

## 0.18.2

- Add manual daily check-ins for both good and bad habits, selected alongside quantity units in one Tracking field.
- Support optional No later than conditions and dated changes without recording actual completion times or reinterpreting past marks.
- Distinguish unmarked days from explicit missed/slipped outcomes in the calendar and check-in statistics; allow result correction and undo.
- Preserve existing quantity histories and the earlier test-only time-goal format.
- Dismiss the keyboard on Return in single-line habit fields while preserving the form and pending edits.
- Keep seven-day history markers circular across narrow and wide layouts, including when the host UI Kit imposes a button minimum height.

## 0.18.1

Initial public release of Habits for Super Productivity.

- Track positive habit goals and maximum allowances with daily or rolling periods.
- Record whole-number quantities with standard or custom units, dated rules and gradual reduction plans.
- Browse calendar history, statistics, streaks, personal bests and achievements.
- Link supported recurring tasks and optionally create brief review tasks for recorded episodes.
- Export and import JSON backups through Super Productivity.
- Include English and Russian, light and dark themes, and responsive layouts.
- Distribute a self-contained plugin ZIP under the MIT license, with applicable Unicode notices.
