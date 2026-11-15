import { t } from "../i18n/index.js";
import { EXPORT_REQUEST, MAX_APPLICATION_CHARACTERS } from "./protocol.js";
import { emojiData } from "../i18n/emoji-data.js";
import messages from "../i18n/ru.json" with { type: "json" };

// The host authenticates and routes iframe messages through its public onMessage API.
// It owns response delivery; plugin code never reads the host document or iframe tree.
export function installExportBridge(api, tasks, styles, applicationSource, revision = () => 0) {
  let disposed = false;
  api.onMessage(async (message) => {
    if (disposed) return { ok: false, error: t("The plugin view is closed.") };
    if (message?.type !== EXPORT_REQUEST) return { ok: false, error: "Unknown plugin request." };
    try {
      if (message.asset === "status") return { ok: true, revision: revision() };
      if (message.asset === "tasks") {
        if (!tasks) throw new Error(t("Task integration is unavailable. Update the plugin."));
        return { ok: true, ...(await tasks.request(message)) };
      }
      if (message.asset === "shortcuts") {
        const state = await api.getAppState?.();
        const configured = state?.globalConfig?.keyboard?.addNewTask;
        return {
          ok: true,
          addNewTask: typeof configured === "string" && configured.length <= 100 ? configured : null
        };
      }
      if (message.asset === "application") {
        if (
          typeof applicationSource !== "string" ||
          !applicationSource.trim() ||
          applicationSource.length > MAX_APPLICATION_CHARACTERS
        )
          throw new Error(
            "The bundled Habit Ledger application is unavailable. Reinstall the plugin."
          );
        return { ok: true, source: applicationSource };
      }
      if (message.asset === "translations") {
        return { ok: true, messages, styles };
      }
      if (message.asset === "emojis") {
        return { ok: true, catalog: emojiData };
      }
      let raw = await api.loadSyncedData();
      if (raw === null)
        raw = JSON.stringify({
          schemaVersion: 1,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          habits: []
        });
      let output = raw;
      if (!message.recovery) {
        try {
          output = JSON.stringify(JSON.parse(raw));
        } catch {
          /* Preserve raw data for recovery. */
        }
      }
      const filename = message.recovery ? "habits-recovery.json" : "habits-backup.json";
      await api.downloadFile(filename, output);
      return { ok: true, filename };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
  });
  return () => {
    disposed = true;
  };
}
