# Project rules

## Language policy

Use English for source messages, identifiers, comments, authored HTML, project metadata, documentation, changelogs, release titles/descriptions and test descriptions. English is the UI source and fallback language.

Russian belongs only to translation resources: `src/i18n/ru.json`, legacy localized unit aliases in `src/i18n/unit-aliases.json`, the translated names/search data in the bilingual emoji resource, and translation fixtures under `tests/fixtures/i18n/`. Do not use Russian text as a message key, storage default, code branch condition or documentation-version marker. Locale codes and locale/plural selection belong to the localization layer. Keep the language-policy tests passing.

Preserve user-entered names, custom units, existing stored aliases and history in any language. Changing the source language must not rewrite user data or silently relabel legacy stored units.

## Publish versions through GitHub Actions

A version update is complete only after publication in `KingKord/sp-habits`. A local ZIP or push alone is insufficient.

1. Increase the version in `package.json`, `package-lock.json`, `src/manifest.json`, the interface and the current README entry. Add English release notes to `CHANGELOG.md`. Preserve historical version facts.
2. Run `npm run check`, verify changed user flows on isolated data and record results/limits in `VERIFICATION.md`.
3. Commit and push. Normal releases use `main`; follow the agreed merge process when using a separate branch.
4. Wait for `.github/workflows/release.yml` (CI and Release). A push to `main` checks and builds, then creates the version tag, GitHub Release, ZIP and SHA-256. Do not duplicate publication manually. Pull requests only check and build.
5. Verify the remote commit, tag, published release and both assets. Include the release link, and the Actions run when useful, in the final response.

Every push to `main` runs CI. A new release needs a new version; a published version is verified and skipped without replacement. Publication creates a draft and verifies both downloaded assets before publishing. Retry failed jobs on the original commit. An empty untagged draft may follow a corrected workflow; a draft with assets or a tag must retain its original commit. Never mix assets from different commits. Keep `dist/` ignored and publish builds as release assets.

This is standing user authorization for normal pushes and automated releases; do not ask again. Report failed pushes, checks or publication and remaining actions honestly. Do not replace existing tags or assets or force-push without a separate user instruction. Published builds require a new version for changes. The user's explicit request to translate existing release descriptions authorizes updating their text while preserving tags and assets.
