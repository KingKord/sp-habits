import { t } from "./i18n/index.js";
import { emptyState, parseState, validateState } from "./domain.js";

export function createStore(api, notify = () => {}) {
  let state = null,
    raw = null,
    error = "",
    effectMessage = "",
    pending = 0,
    blocked = true,
    tail = Promise.resolve();
  let busyRead = false;
  const snapshot = () => ({ state, raw, error, effectMessage, pending, blocked, busyRead });
  const emit = () => notify(snapshot());
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
    if (pending || busyRead) return false;
    busyRead = true;
    emit();
    try {
      state = await read();
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
    }
  }
  function mutate(transform, metadata) {
    if (blocked || busyRead)
      return Promise.reject(new Error(error || t("Wait for the data to load.")));
    pending++;
    emit();
    const operation = tail
      .then(async () => {
        if (blocked) throw new Error(t("The queue stopped after an error. Reload the data first."));
        try {
          // Read fresh data before each serialized mutation; this is not a cross-device lock.
          const latest = await read();
          const candidate = validateState(transform(latest));
          const encoded = JSON.stringify(candidate);
          const confirmed = await api.persistDataSynced(encoded, metadata);
          raw = typeof confirmed === "string" ? confirmed : (confirmed?.raw ?? encoded);
          state = parseState(raw);
          effectMessage = confirmed?.effectMessage || "";
          error = "";
        } catch (e) {
          blocked = true;
          error =
            (e.message || String(e)) + t(" Changes paused; reload the data before continuing.");
          throw e;
        }
      })
      .finally(() => {
        pending--;
        emit();
      });
    tail = operation.catch(() => {});
    return operation;
  }
  return { snapshot, reload, mutate };
}
