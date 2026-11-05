# Release guide

[Back to development](development.md)

Releases are published by [CI and Release](https://github.com/KingKord/sp-habits/actions/workflows/release.yml). Do not upload replacement assets or create release tags manually.

1. Update the version in `package.json`, both roots of `package-lock.json`, `src/manifest.json`, the interface footer and the current README entry. Add an English section to `CHANGELOG.md`.
2. Run `npm run check`. Verify changed user flows with isolated data and record results and limitations in `VERIFICATION.md`.
3. Commit and push to `main` through the agreed merge process. Pull requests check and build; only `main` publishes. Fork contributors do not need release credentials.
4. Wait for both jobs. The workflow builds once, creates a draft on the checked commit, uploads the ZIP and SHA-256, downloads and verifies both, then publishes the release and tag.
5. Verify the remote commit, tag, published release and both assets. Include the release and Actions links in the completion report.

Every push to `main` runs CI. A push that keeps an already-published version verifies that release and skips publication. Changed published builds need a new version. Retry failed jobs on their original commit. A tagged draft or a draft with assets retains its original commit; only an empty untagged draft can follow a corrected workflow. Never mix assets from different commits or replace an existing tag or asset.

Only the release job receives `contents: write` through GitHub's built-in token; no additional personal token is required. Official Actions are pinned by commit SHA. Build outputs stay ignored and are distributed as release assets.

## Archive contents and reproducibility

The ZIP contains the manifest, interface, icon, host script, project `LICENSE` and `THIRD_PARTY_LICENSES.txt`. Its timestamps, permissions and timezone are fixed so repeated builds from the same source produce the same ZIP.

The manifest ID stays `sp-habit-limits` for update compatibility, even though the product and archive are named Habits and `sp-habits.zip`. Changing this ID can separate an installation from its existing synced storage.

## Public repository operations

The repository is public, and GitHub private vulnerability reporting is enabled. The reporting route is documented in [SECURITY.md](../SECURITY.md).

### Publication checks

- Review tracked files and the complete Git history before publishing private work. Keep real habit exports, credentials, logs and personal screenshots outside the repository.
- Verify the private reporting route after repository ownership or security-setting changes.
- Consider reviewed pull requests and required CI checks for the default branch, using rules that fit the maintainer's release workflow. These settings are separate from private vulnerability reporting.

Public visibility, branch protection and private vulnerability reporting are repository settings, independent of the package's `private: true` flag. That package flag prevents accidental npm publication; users install the ZIP instead.

Preparation sources: [Open Source Guides](https://opensource.guide/starting-a-project/), [MIT License](https://opensource.org/license/mit), and GitHub's [issue form documentation](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms).
