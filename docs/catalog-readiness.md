# Community catalog readiness

[Back to development](development.md)

The original [catalog PR #11513](https://github.com/super-productivity/super-productivity/pull/11513) proposed Habits v0.18.1. The maintainer requested concrete fixes and time for the young plugin to settle. The current display name is **Habit Ledger**, distinguishing the plugin from Super Productivity's built-in Habits feature. Historical release names and the original review are preserved as facts.

## Review concerns and evidence

| Concern | Required outcome | Evidence and status |
| --- | --- | --- |
| Review tasks used the rejected legacy `INBOX` project ID | Create optional review tasks in the host Inbox, preserving saved episodes on uncertain acknowledgement | [Issue #55](https://github.com/KingKord/sp-habits/issues/55): fixed in commit [`01ac2edb`](https://github.com/KingKord/sp-habits/commit/01ac2edb), first published in [v0.20.0](https://github.com/KingKord/sp-habits/releases/tag/v0.20.0). `tests/reflection.test.mjs` rejects unknown project IDs and covers creation, failures, stale/replayed requests and no automatic retries. |
| Private `window.ea` emoji picker and host iframe inspection | Use public PluginAPI capabilities; keep offline emoji selection and exports | [Issue #56](https://github.com/KingKord/sp-habits/issues/56): resources, exports and task requests use public `PluginAPI.onMessage`; iframe hooks and lightweight revision requests replace host DOM inspection. Native preload access is removed; the offline catalogue and paste input remain. Current checks and host limits are in the [verification log](../VERIFICATION.md). |
| Full archive reads on every task hook and 30-second poll | Bound archive loads while reconciling live task changes and retaining completion provenance | [Issue #57](https://github.com/KingKord/sp-habits/issues/57): archive reads are scoped to startup, day/timezone and active-link changes; live hooks/polls retain persisted completion provenance. A 50,001-entry synthetic archive required one read across a 100-request burst and 20 sequential polls. Archive-only changes wait until the next full refresh; see [verification log](../VERIFICATION.md). |
| Name collides with built-in Habits | Use the distinct Habit Ledger display name | [Issue #58](https://github.com/KingKord/sp-habits/issues/58): manifest, current interface, English/Russian presentation and current documentation use Habit Ledger. `sp-habit-limits`, existing storage keys, repository and release filenames remain stable. |
| Plugin was very young and had rapid releases | Allow the published fixes to settle before a new catalog PR | [Issue #59](https://github.com/KingKord/sp-habits/issues/59): remains a catalog reapplication/stabilization condition. Passing tests or publishing another release does not establish maintainer acceptance or substitute for time and real-world feedback. |

Sources: [technical review](https://github.com/super-productivity/super-productivity/pull/11513#issuecomment-6663318007) and [maintainer decision](https://github.com/super-productivity/super-productivity/pull/11513#issuecomment-6667199121).

## Before reapplying

1. Verify that every concrete review issue has a published fix and linked evidence. Use the latest stable release's exact commit and retain the platform limits recorded in `VERIFICATION.md`.
2. Allow a stabilization period with ordinary use and review incoming reports. The maintainer specified no fixed waiting interval; this checklist makes no invented deadline or claim of approval.
3. Open a **new** upstream PR when reapplication is authorized and the build has settled. Use the distinct display name and the exact published manifest version, release-asset URL and SHA-256. Download and validate the ZIP from that release.
4. Link the original review, local issues and verification evidence. State what was checked and which devices or runtimes remain unverified.

The initial PR's pinned v0.18.1 entry is historical. Fixes in this repository do not update that entry or imply that the plugin has been accepted into the community catalog. This work does not create a new upstream PR automatically.
