# Design notes

Habits tracks user-defined goals and limits inside Super Productivity without a separate account or server. See [README.md](README.md) for installation, [the user guide](docs/user-guide.md) for behavior and [development](docs/development.md) for architecture.

## Data and rules

Store dates as YYYY-MM-DD in the plugin's saved timezone. Keep dated rules and quantities separate so later goal changes preserve earlier assessments. Derive calendar results, streaks and statistics from stored history rather than saving duplicate result flags.

Preserve user-entered names, custom units, existing aliases and history. Opening the plugin or switching languages must not rewrite stored values.

## Host integration

The interface runs in a plugin iframe. Host-side code provides the storage, export, resources and task integration needed by the view. Validate message origin, source and shape at the bridge.

Use Super Productivity's plugin storage APIs. Keep the manifest ID stable for compatible updates. Imports replace plugin history only after confirmation; exports provide a recovery path before data-changing experiments.

## Reliability and verification

Serialize writes and show success only after the host confirms storage. Surface malformed data and failed writes without silently replacing history. Concurrent editing on multiple devices is unsupported.

Test with synthetic habits and tasks in an isolated profile. Verify date boundaries, historical corrections, persistence, backup compatibility, cancellation, failed operations and responsive layouts. Record verified behavior and remaining limits in [VERIFICATION.md](VERIFICATION.md).
