# Verification log

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
