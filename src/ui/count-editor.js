import { t } from "../i18n/index.js";
import { unitText } from "./units.js";
import * as D from "../domain.js";
import { dateText, usageText, habitName } from "./format.js";
import { completionControls } from "./completion-controls.js";
import { closeOnBackdrop } from "./dialog.js";
import { settingsVersion, assertSettingsVersion, EditConflictError } from "../edit-session.js";

export function createCountEditor({ dom, store, now, commit }) {
  const { byId, on, restoreFocus } = dom;
  let countEditing = null,
    countSaving = false;
  function openCountEditor(habit, date, focusKey) {
    const s = store.snapshot();
    if (s.blocked || s.pending || s.busyRead || !s.state) return;
    const result = D.dayResult(habit, date, now());
    if (!result.editable || result.readOnly) return;
    countEditing = {
      id: habit.id,
      date,
      focusKey,
      version: settingsVersion(s.state, habit.id),
      amount: habit.counts[date]
    };
    const completion = result.tracking === "check-in";
    byId("count-editor-title").textContent = completion ? t("Daily check-in") : t("Daily quantity");
    byId("count-amount-field").hidden = completion;
    byId("count-amount").disabled = completion;
    byId("save-count").hidden = completion;
    byId("cancel-count").textContent = completion ? t("Close") : t("Cancel");
    const controls = byId("completion-controls");
    controls.hidden = !completion;
    controls.replaceChildren();
    if (completion)
      controls.append(
        completionControls(dom, {
          habit,
          date,
          result,
          disabled: false,
          now,
          focusPrefix: "check-in-" + habit.id + "-" + date,
          commit: async (transform) => {
            if (countSaving) return false;
            countSaving = true;
            byId("close-count").disabled = byId("cancel-count").disabled = true;
            const ok = await commit(transform);
            countSaving = false;
            if (dom.isActive())
              byId("close-count").disabled = byId("cancel-count").disabled = false;
            return ok;
          },
          onSaved: closeCountEditor,
          onError: () => {
            byId("count-error").textContent = store.snapshot().error;
          }
        })
      );
    byId("count-context").textContent =
      habitName(habit) +
      " · " +
      dateText(date, { year: "numeric" }) +
      t(" · quantity for the selected day ") +
      result.count +
      " " +
      unitText(D.unitOf(habit)) +
      (result.periodDays > 1 ? " · " + usageText(result, D.unitOf(habit)) : "");
    if (completion)
      byId("count-context").textContent =
        habitName(habit) +
        " · " +
        dateText(date, { year: "numeric" }) +
        " · " +
        usageText(result, D.unitOf(habit));
    byId("count-amount").value = result.count;
    byId("count-amount-label").textContent = t("Quantity (") + unitText(D.unitOf(habit)) + ")";
    byId("count-error").textContent = "";
    byId("count-editor").showModal();
    if (completion) controls.querySelector("button").focus();
    else {
      byId("count-amount").focus();
      byId("count-amount").select();
    }
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
    if (byId("save-count").hidden) return;
    const { id, date, version, amount } = countEditing,
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
    const ok = await commit((state) => {
      assertSettingsVersion(state, id, version);
      if (state.habits.find((habit) => habit.id === id).counts[date] !== amount)
        throw new EditConflictError();
      return D.setCount(state, id, date, value, now(state));
    });
    countSaving = false;
    if (!dom.isActive()) return;
    for (const key of ["save-count", "close-count", "cancel-count", "count-amount"])
      byId(key).disabled = false;
    if (ok) closeCountEditor();
    else byId("count-error").textContent = store.snapshot().error;
  });
  return { open: openCountEditor };
}
