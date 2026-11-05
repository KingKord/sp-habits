# Security policy

## Supported versions

Report vulnerabilities against the latest published release. Fixes are issued in a new release; there is no commitment to backport fixes to older versions. This is a community project without a guaranteed response time or bug bounty.

## Report a vulnerability privately

Use the repository's [private reporting form](https://github.com/KingKord/sp-habits/security/advisories/new). Private vulnerability reporting is enabled for this public repository. Submit security details through that form rather than a public issue.

If the form is unavailable, open an issue titled "Private security contact requested" with no vulnerability details and ask the maintainer for a private channel. Do not post exploit instructions, personal backups, credentials or private task data in a public issue.

A private report should include the affected versions, a minimal reproduction with invented data, expected impact and any suggested fix. Allow coordination before public disclosure.

## Scope and data handling

Habits runs inside Super Productivity. Uploaded plugins have access to host APIs, so install only trusted builds. The manifest requests no additional permissions, and Habits makes no runtime network requests. This does not sandbox the entire host-side plugin or prove that the host itself is offline.

The plugin stores data through Super Productivity and can create optional review tasks when explicitly enabled. Imports replace plugin history after confirmation. Keep a backup before testing data-changing behavior; use an isolated profile for reproduction.

Report host application issues to [Super Productivity](https://github.com/super-productivity/super-productivity/security/policy). Avoid sharing the same private report publicly in both projects.
