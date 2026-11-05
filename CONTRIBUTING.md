# Contributing to Habits

Contributions can be code, clearer documentation, translations, bug reports or focused suggestions. The project is maintained by [@KingKord](https://github.com/KingKord); review and release timing depend on availability.

## Report a problem or suggest a change

Search existing [issues](https://github.com/KingKord/sp-habits/issues) first. For bugs, include the plugin and host versions, operating system, reproduction steps and expected versus actual behavior. A small invented example is more useful than a personal backup. Remove names, task details, credentials and other private information from screenshots and logs.

Use the feature-request form to explain the problem you want to solve and the behavior you expect. Discuss large changes before starting implementation. For vulnerabilities, follow [SECURITY.md](SECURITY.md).

## Set up and check a change

Fork the repository, create a branch and follow the [development guide](docs/development.md). The short path is Node.js 24 LTS, `zip`, `unzip`, then:

```sh
npm ci
npm run check
```

Keep a pull request focused on one change. Follow existing module boundaries and formatting. Add meaningful tests for changed behavior, especially date boundaries, historical rules, task reconciliation and failed writes. Documentation-only changes do not need artificial tests.

For UI changes, verify the changed flow in an isolated profile, English/Russian, light/dark and a narrow layout. Include a screenshot using synthetic data when it helps review. Record what you checked and what remains unverified.

## Preserve user data

Do not rewrite stored habit names, custom units, aliases or history as a side effect of opening the plugin or changing its language. Existing backups must remain readable. Keep the manifest ID `sp-habit-limits`; changing it can disconnect users from saved plugin data.

Use English for source text, identifiers, comments, documentation and test descriptions. Russian translations and legacy aliases belong in localization resources and fixtures. See [AGENTS.md](AGENTS.md) for complete language and release rules.

## Open a pull request

Explain the problem, the resulting behavior and how you verified it. Mention related issues and any compatibility implications. Use the pull request template; maintainers may ask for a smaller scope, tests or clarification.

CI checks and builds pull requests. Maintainers handle version bumps and [releases](docs/releasing.md); a pull request does not publish a release. Do not commit `node_modules/`, `dist/`, private exports or local test artifacts. Normal development needs no access token or production credentials.

Participation follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Contributions are submitted under the project's [MIT License](LICENSE); preserve applicable third-party notices.
