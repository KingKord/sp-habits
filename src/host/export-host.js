import { t } from "../i18n/index.js";
import {
  EXPORT_REQUEST,
  EXPORT_RESPONSE,
  SYSTEM_EMOJI_REQUEST,
  SYSTEM_EMOJI_RESPONSE,
  transportOrigin,
  targetOrigin,
  MAX_APPLICATION_CHARACTERS
} from "./protocol.js";
import { emojiData } from "../i18n/emoji-data.js";
import messages from "../i18n/ru.json" with { type: "json" };

// downloadFile exists on the host API. Only this plugin's own storage is read.
export function installExportBridge(api, window, document, tasks, styles, applicationSource) {
  const handleExport = async (event) => {
    const message = event.data;
    if (
      transportOrigin(event.origin) !== transportOrigin(window.location.origin) ||
      ![EXPORT_REQUEST, SYSTEM_EMOJI_REQUEST].includes(message?.type) ||
      typeof message.requestId !== "string" ||
      message.requestId.length > 100
    )
      return;
    const frame = [...document.querySelectorAll("iframe")].find(
      (element) => element.contentWindow === event.source
    );
    try {
      if (!frame || frame.contentDocument?.title !== "Habits") return;
    } catch {
      return;
    }
    const reply = (data) =>
      event.source.postMessage(
        {
          type: message.type === SYSTEM_EMOJI_REQUEST ? SYSTEM_EMOJI_RESPONSE : EXPORT_RESPONSE,
          requestId: message.requestId,
          ...data
        },
        targetOrigin(event.origin)
      );
    try {
      if (message.type === SYSTEM_EMOJI_REQUEST) {
        const available =
          typeof window.ea?.showEmojiPanel === "function" && !window.ea?.isLinux?.();
        if (message.open === true) {
          if (!available)
            throw new Error(
              t("The system picker is unavailable. Choose an emoji from the catalog.")
            );
          window.ea.showEmojiPanel();
        }
        reply({ ok: true, available });
        return;
      }
      if (message.asset === "tasks") {
        if (!tasks) throw new Error(t("Task integration is unavailable. Update the plugin."));
        reply({ ok: true, ...(await tasks.request(message)) });
        return;
      }
      if (message.asset === "application") {
        if (
          typeof applicationSource !== "string" ||
          !applicationSource.trim() ||
          applicationSource.length > MAX_APPLICATION_CHARACTERS
        )
          throw new Error("The bundled Habits application is unavailable. Reinstall the plugin.");
        reply({ ok: true, source: applicationSource });
        return;
      }
      if (message.asset === "translations") {
        reply({ ok: true, messages, styles });
        return;
      }
      if (message.asset === "emojis") {
        reply({ ok: true, catalog: emojiData });
        return;
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
      reply({ ok: true, filename });
    } catch (error) {
      reply({ ok: false, error: error.message || String(error) });
    }
  };
  window.addEventListener("message", handleExport);
  return () => window.removeEventListener("message", handleExport);
}
