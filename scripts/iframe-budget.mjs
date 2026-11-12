export const IFRAME_LIMIT = 100 * 1024;
export const IFRAME_WARNING = 95 * 1024;
export const IFRAME_BASELINE = { version: "0.19.0", bytes: 94524 };

export function iframeBudget(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error("Invalid iframe byte count");
  return {
    bytes,
    limit: IFRAME_LIMIT,
    remaining: IFRAME_LIMIT - bytes,
    warning: bytes >= IFRAME_WARNING,
    baseline: IFRAME_BASELINE,
    delta: bytes - IFRAME_BASELINE.bytes
  };
}

export function assertIframeBudget(report) {
  if (report.bytes >= report.limit)
    throw new Error(
      "index.html exceeds host's 100 KiB limit (" +
        report.bytes +
        " bytes). Inspect dist/build-budget.json and docs/development.md."
    );
}
