import { t } from "../i18n/index.js";
import { unitText } from "./units.js";
import * as D from "../domain.js";
import { dateText, usageText, habitName } from "./format.js";
import { closeOnBackdrop } from "./dialog.js";

export function createCountEditor({ dom, store, now, commit }) {
  const { byId, on, restoreFocus } = dom;
  const timeGoal = () => countEditing?.timed;
  let countEditing = null,
    countSaving = false;
  function openCountEditor(habit, date, focusKey) {
    const s = store.snapshot();
    if (s.blocked || s.pending || s.busyRead || !s.state) return;
    const result = D.dayResult(habit, date, now());
    if (!result.editable || result.readOnly) return;
    countEditing = { id: habit.id, date, focusKey, timed: result.goal === "by-time" };
    byId("count-editor-title").textContent = timeGoal() ? t("Daily time") : t("Daily quantity");
    byId("clear-time").hidden = !timeGoal();
    byId("clear-time").disabled = !result.recorded;
    if (byId("count-amount").type !== (timeGoal() ? "time" : "number"))
      byId("count-amount").value = "";
    byId("count-amount").type = timeGoal() ? "time" : "number";
    byId("count-amount").min = timeGoal() ? "00:00" : "0";
    byId("count-amount").max = timeGoal() ? "23:59" : String(D.MAX_VALUE);
    byId("count-amount").step = timeGoal() ? "60" : "1";
    byId("count-amount").inputMode = timeGoal() ? "text" : "numeric";
    byId("count-context").textContent =
      habitName(habit) +
      " · " +
      dateText(date, { year: "numeric" }) +
      t(" · quantity for the selected day ") +
      result.count +
      " " +
      unitText(D.unitOf(habit)) +
      (result.periodDays > 1 ? " · " + usageText(result, D.unitOf(habit)) : "");
    if (timeGoal())
      byId("count-context").textContent =
        habitName(habit) +
        " · " +
        dateText(date, { year: "numeric" }) +
        " · " +
        usageText(result, D.unitOf(habit));
    byId("count-amount").value = timeGoal()
      ? result.recorded
        ? D.clockText(result.count)
        : ""
      : result.count;
    byId("count-amount-label").textContent = timeGoal()
      ? t("Actual time")
      : t("Quantity (") + unitText(D.unitOf(habit)) + ")";
    byId("count-error").textContent = "";
    byId("count-editor").showModal();
    byId("count-amount").focus();
    if (!timeGoal()) byId("count-amount").select();
  }
  function closeCountEditor() {
    if (countSaving) return;
    const focusKey = countEditing?.focusKey;
    byId("count-editor").close();
    countEditing = null;
    restoreFocus(focusKey);
  }
  on("close-count", "click", closeCountEditor);
  closeOnBackdrop(dom, "count-editor", closeCountEditor);
  on("cancel-count", "click", closeCountEditor);
  on("count-editor", "cancel", (event) => {
    event.preventDefault();
    closeCountEditor();
  });
  async function saveCount(clear = false) {
    if (!countEditing || countSaving || (!clear && !byId("count-form").reportValidity())) return;
    const { id, date } = countEditing,
      value = clear
        ? null
        : timeGoal()
          ? D.clockMinutes(byId("count-amount").value)
          : Number(byId("count-amount").value);
    const transform = (state) =>
      clear
        ? D.clearTimeRecord(state, id, date, now(state))
        : D.setCount(state, id, date, value, now(state));
    const snapshot = store.snapshot();
    if (snapshot.blocked || snapshot.pending || snapshot.busyRead || !snapshot.state) return;
    try {
      transform(snapshot.state);
    } catch (error) {
      byId("count-error").textContent = error.message;
      return;
    }
    countSaving = true;
    for (const key of ["save-count", "close-count", "cancel-count", "count-amount", "clear-time"])
      byId(key).disabled = true;
    const ok = await commit(transform);
    countSaving = false;
    if (!dom.isActive()) return;
    for (const key of ["save-count", "close-count", "cancel-count", "count-amount", "clear-time"])
      byId(key).disabled = false;
    if (ok) closeCountEditor();
    else byId("count-error").textContent = store.snapshot().error;
  }
  on("count-form", "submit", async (event) => {
    event.preventDefault();
    await saveCount();
  });
  on("clear-time", "click", () => {
    if (timeGoal()) void saveCount(true);
  });
  return { open: openCountEditor };
}
