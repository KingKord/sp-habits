import { t } from "./i18n/index.js";
import { emptyState, parseState, encodeState } from "./domain.js";
import { EditConflictError } from "./edit-session.js";

export function createStore(api, notify = () => {}) {
  let state = null,
    raw = null,
    error = "",
    effectMessage = "",
    pending = 0,
    blocked = true,
    tail = Promise.resolve();
  let busyRead = false,
    reloadRequested = false,
    disposed = false;
  const snapshot = () => ({ state, raw, error, effectMessage, pending, blocked, busyRead });
  const emit = () => {
    if (!disposed) notify(snapshot());
  };
  function flushReload() {
    if (disposed || !reloadRequested || pending || busyRead || blocked) return;
    reloadRequested = false;
    void reload();
  }
  function invalidate() {
    if (disposed) return;
    reloadRequested = true;
    flushReload();
  }
  function ensureAPI() {
    if (
      !api ||
      typeof api.loadSyncedData !== "function" ||
      typeof api.persistDataSynced !== "function"
    )
      throw new Error(t("Open this plugin inside Super Productivity 19.3.1 or newer."));
  }
  async function read() {
    ensureAPI();
    raw = await api.loadSyncedData();
    return raw === null ? emptyState() : parseState(raw);
  }
  async function reload() {
    if (disposed || pending || busyRead) return false;
    busyRead = true;
    emit();
    try {
      const latest = await read();
      if (disposed) return false;
      state = latest;
      blocked = false;
      error = "";
      return true;
    } catch (e) {
      blocked = true;
      error = e.message || String(e);
      return false;
    } finally {
      busyRead = false;
      emit();
      flushReload();
    }
  }
  function mutate(transform, metadata) {
    if (disposed) return Promise.reject(new Error(t("The plugin view is closed.")));
    if (blocked || busyRead)
      return Promise.reject(new Error(error || t("Wait for the data to load.")));
    pending++;
    emit();
    const operation = tail
      .then(async () => {
        if (disposed) throw new Error(t("The plugin view is closed."));
        if (blocked) throw new Error(t("The queue stopped after an error. Reload the data first."));
        let latest;
        try {
          // Read fresh data before each serialized mutation; this is not a cross-device lock.
          latest = await read();
          if (disposed) throw new Error(t("The plugin view is closed."));
          const encoded = encodeState(transform(latest));
          const confirmed = await api.persistDataSynced(encoded, metadata);
          raw = typeof confirmed === "string" ? confirmed : (confirmed?.raw ?? encoded);
          state = parseState(raw);
          effectMessage = confirmed?.effectMessage || "";
          error = "";
        } catch (e) {
          blocked = !(e instanceof EditConflictError);
          if (!blocked) state = latest;
          error =
            (e.message || String(e)) +
            (blocked ? t(" Changes paused; reload the data before continuing.") : "");
          throw e;
        }
      })
      .finally(() => {
        pending--;
        emit();
        flushReload();
      });
    tail = operation.catch(() => {});
    return operation;
  }
  return {
    snapshot,
    reload,
    mutate,
    invalidate,
    dispose: () => {
      disposed = true;
    }
  };
}
