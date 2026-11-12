# Changelog

## 0.20.0

- Arrange habits with accessible persisted ordering and optional named groups (#13, #14).
- Add independent daily notes without changing quantities, outcomes or archived journals (#15).
- Schedule manual habits on selected weekdays or anchored intervals, with dated pause intervals and exceptions (#17, #19).
- Load bundled application code through the existing verified offline resource bridge, keeping the iframe below the host size limit.
- Preserve stale-edit conflict checks and unsaved pause/group drafts across background changes.

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
