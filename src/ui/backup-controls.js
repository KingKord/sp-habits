import { t } from "../i18n/index.js";
import * as D from "../domain.js";
import { MAX_BACKUP_BYTES } from "../data-limits.js";

export function mountBackupControls({
  dom,
  store,
  commit,
  render,
  flash,
  resetDay,
  exportClient,
  confirm
}) {
  const { byId, on } = dom;
  async function requestExport(recovery = false) {
    try {
      const result = await exportClient.request(recovery);
      flash(t("Export sent to the app: ") + result.filename);
    } catch (error) {
      flash(t("Unable to export: ") + error.message);
    }
  }
  on("reload", "click", () => {
    void store.reload();
  });
  on("raw", "click", () => requestExport(true));
  on("export", "click", () => requestExport());
  on("import", "click", () => {
    byId("import-file").value = "";
    byId("import-file").click();
  });
  on("import-file", "change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error(t("Backup too large. Maximum: 12 MB."));
      const candidate = D.parseBackup(await file.text());
      if (!dom.isActive()) return;
      if (
        !confirm(
          t("Replace all Habits history with this file? Habits in the file: ") +
            candidate.habits.length +
            t(". First save the current history using Export JSON.")
        )
      )
        return;
      if ((await commit(() => candidate)) && dom.isActive()) {
        resetDay();
        render();
        flash(t("History imported."));
      }
    } catch (e) {
      flash(t("Import cancelled: ") + e.message);
    }
  });
}
