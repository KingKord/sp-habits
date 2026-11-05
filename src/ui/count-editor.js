import { t } from "../i18n/index.js";
import { unitText } from "./units.js";
import * as D from "../domain.js";
import { dateText, usageText, habitName } from "./format.js";
import { closeOnBackdrop } from "./dialog.js";

export function createCountEditor({ dom, store, now, commit }) {
  const { byId, on, restoreFocus } = dom;
  let countEditing = null,
    countSaving = false;
  function openCountEditor(habit, date, focusKey) {
    const s = store.snapshot();
    if (s.blocked || s.pending || s.busyRead || !s.state) return;
    const result = D.dayResult(habit, date, now());
    if (!result.editable || result.readOnly) return;
    countEditing = { id: habit.id, date, focusKey };
    byId("count-context").textContent =
      habitName(habit) +
      " · " +
      dateText(date, { year: "numeric" }) +
      t(" · quantity for the selected day ") +
      result.count +
      " " +
      unitText(D.unitOf(habit)) +
      (result.periodDays > 1 ? " · " + usageText(result, D.unitOf(habit)) : "");
    byId("count-amount").value = result.count;
    byId("count-amount-label").textContent = t("Quantity (") + unitText(D.unitOf(habit)) + ")";
    byId("count-error").textContent = "";
    byId("count-editor").showModal();
    byId("count-amount").focus();
    byId("count-amount").select();
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
  on("count-form", "submit", async (event) => {
    event.preventDefault();
    if (!countEditing || countSaving || !byId("count-form").reportValidity()) return;
    const { id, date } = countEditing,
      value = Number(byId("count-amount").value);
    const snapshot = store.snapshot();
    if (snapshot.blocked || snapshot.pending || snapshot.busyRead || !snapshot.state) return;
    try {
      D.setCount(snapshot.state, id, date, value, now(snapshot.state));
    } catch (error) {
      byId("count-error").textContent = error.message;
      return;
    }
    countSaving = true;
    for (const key of ["save-count", "close-count", "cancel-count", "count-amount"])
      byId(key).disabled = true;
    const ok = await commit((state) => D.setCount(state, id, date, value, now(state)));
    countSaving = false;
    if (!dom.isActive()) return;
    for (const key of ["save-count", "close-count", "cancel-count", "count-amount"])
      byId(key).disabled = false;
    if (ok) closeCountEditor();
    else byId("count-error").textContent = store.snapshot().error;
  });
  return { open: openCountEditor };
}
