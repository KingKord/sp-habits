import { t } from "../i18n/index.js";
import { unitText } from "./units.js";
import * as D from "../domain.js";
import { dateText, usageText, habitName } from "./format.js";
import { completionControls } from "./completion-controls.js";
import { closeOnBackdrop } from "./dialog.js";
import {
  validFieldDraft,
  captureFields,
  restoreFields,
  createFormLock,
  createEditorRecovery
} from "./form-session.js";
import { settingsVersion, assertSettingsVersion, EditConflictError } from "../edit-session.js";

export function createCountEditor({
  dom,
  store,
  now,
  commit,
  openNoteEditor,
  confirm = () => false
}) {
  const { byId, on, restoreFocus } = dom;
  let countEditing = null,
    countSaving = false,
    initialInput = "";
  const lock = createFormLock(byId("count-form"));
  const recovery = createEditorRecovery({
    dom,
    store,
    formId: "count-form",
    saveIds: ["save-count"],
    errorId: "count-error",
    busy: () => countSaving
  });
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
            lock(true);
            const ok = await commit(transform);
            countSaving = false;
            if (dom.isActive()) {
              lock(false);
              recovery.refresh();
            }
            return ok;
          },
          onSaved: () => closeCountEditor(true),
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
    initialInput = byId("count-amount").value;
    byId("count-amount-label").textContent = t("Quantity (") + unitText(D.unitOf(habit)) + ")";
    byId("count-error").textContent = "";
    recovery.refresh();
    byId("count-editor").showModal();
    if (completion) controls.querySelector("button").focus();
    else {
      byId("count-amount").focus();
      byId("count-amount").select();
    }
  }
  function closeCountEditor(confirmed = false) {
    if (countSaving) return;
    if (
      !confirmed &&
      captureDraft() &&
      !confirm(t("Discard unsaved quantity changes? Choose Cancel to keep editing."))
    )
      return;
    const focusKey = countEditing?.focusKey;
    byId("count-editor").close();
    countEditing = null;
    restoreFocus(focusKey);
  }
  on("close-count", "click", () => closeCountEditor());
  on("count-note", "click", () => {
    if (!countEditing || countSaving) return;
    const habit = store.snapshot().state?.habits.find((entry) => entry.id === countEditing.id);
    if (habit) openNoteEditor(habit, countEditing.date);
  });
  closeOnBackdrop(dom, "count-editor", closeCountEditor);
  on("cancel-count", "click", () => closeCountEditor());
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
    lock(true);
    const ok = await commit((state) => {
      assertSettingsVersion(state, id, version);
      if (state.habits.find((habit) => habit.id === id).counts[date] !== amount)
        throw new EditConflictError();
      return D.setCount(state, id, date, value, now(state));
    });
    countSaving = false;
    if (!dom.isActive()) return;
    lock(false);
    recovery.refresh();
    if (ok) closeCountEditor(true);
    else byId("count-error").textContent = store.snapshot().error;
  });
  function captureDraft() {
    if (
      !countEditing ||
      !byId("count-editor").open ||
      byId("save-count").hidden ||
      byId("count-amount").value === initialInput
    )
      return null;
    return {
      kind: "count",
      context: { ...countEditing },
      initialInput,
      fields: captureFields(byId("count-form")),
      scrollTop: byId("count-editor").scrollTop
    };
  }
  function restoreDraft(saved) {
    const state = store.snapshot().state;
    if (saved?.kind !== "count" || !saved.context || !state || !validFieldDraft(saved.fields))
      return false;
    if (
      typeof saved.context.id !== "string" ||
      typeof saved.context.version !== "string" ||
      typeof saved.initialInput !== "string" ||
      (saved.context.amount !== undefined && !D.wholeNumber(saved.context.amount))
    )
      return false;
    const habit = state.habits.find((entry) => entry.id === saved.context.id);
    if (!habit || !D.validDate(saved.context.date)) return false;
    openCountEditor(habit, saved.context.date, saved.context.focusKey);
    if (!byId("count-editor").open || !countEditing) return false;
    countEditing = { ...saved.context };
    initialInput = saved.initialInput;
    restoreFields(byId("count-form"), saved.fields);
    byId("count-editor").scrollTop = saved.scrollTop || 0;
    return true;
  }
  return { open: openCountEditor, captureDraft, restoreDraft, refresh: recovery.refresh };
}
