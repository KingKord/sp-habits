import { t } from "../i18n/index.js";
import { dayResult, setNote, validDate } from "../domain.js";
import { noteForDate } from "../notes.js";
import { EditConflictError } from "../edit-session.js";
import { dateText, habitName } from "./format.js";
import { closeOnBackdrop } from "./dialog.js";
import {
  validFieldDraft,
  captureFields,
  restoreFields,
  createFormLock,
  createEditorRecovery
} from "./form-session.js";

export function createNoteEditor({ dom, store, now, commit, confirm }) {
  const { byId, on } = dom;
  let editing = null,
    saving = false,
    opener = null,
    restoredFocusKey = null;
  const lock = createFormLock(byId("note-form"));
  const recovery = createEditorRecovery({
    dom,
    store,
    formId: "note-form",
    saveIds: ["save-note", "remove-note"],
    errorId: "note-error",
    busy: () => saving
  });
  function open(habit, date) {
    const snapshot = store.snapshot();
    if (saving || snapshot.blocked || snapshot.pending || snapshot.busyRead || !snapshot.state)
      return;
    const current = snapshot.state.habits.find((entry) => entry.id === habit.id);
    if (!current || !dayResult(current, date, now(snapshot.state)).editable) return;
    editing = {
      id: current.id,
      date,
      initial: noteForDate(current, date),
      timeZone: snapshot.state.timeZone
    };
    opener = dom.activeElement();
    restoredFocusKey = null;
    byId("note-context").textContent =
      habitName(current) + " · " + dateText(date, { year: "numeric" });
    byId("note-text").value = editing.initial;
    editing.input = byId("note-text").value;
    byId("remove-note").hidden = !editing.initial;
    byId("note-error").textContent = "";
    recovery.refresh();
    byId("note-editor").showModal();
    byId("note-text").focus();
  }
  function close(confirmed = false) {
    if (saving || !editing) return;
    if (
      !confirmed &&
      byId("note-text").value !== editing.input &&
      !confirm(t("Discard unsaved note changes? Choose Cancel to keep editing."))
    )
      return;
    byId("note-editor").close();
    editing = null;
    const visible = (element) =>
      element?.isConnected &&
      !element.disabled &&
      (!element.getClientRects || element.getClientRects().length > 0);
    if (visible(opener)) opener.focus();
    else {
      dom.restoreFocus(restoredFocusKey || opener?.dataset.focusKey);
      const active = dom.activeElement();
      if (!visible(active) || active.tagName === "BODY") byId("view-day").focus();
    }
  }
  async function save(text) {
    if (!editing || saving) return;
    const snapshot = store.snapshot();
    if (snapshot.blocked || snapshot.pending || snapshot.busyRead || !snapshot.state) return;
    const { id, date, initial, timeZone } = editing;
    try {
      setNote(snapshot.state, id, date, text, now(snapshot.state));
    } catch (error) {
      byId("note-error").textContent = error.message;
      return;
    }
    saving = true;
    lock(true);
    const ok = await commit((state) => {
      const current = state.habits.find((habit) => habit.id === id);
      if (!current || state.timeZone !== timeZone || noteForDate(current, date) !== initial)
        throw new EditConflictError();
      return setNote(state, id, date, text, now(state));
    });
    saving = false;
    if (!dom.isActive()) return;
    lock(false);
    recovery.refresh();
    if (ok) close(true);
    else byId("note-error").textContent = store.snapshot().error;
  }
  on("note-form", "submit", async (event) => {
    event.preventDefault();
    if (byId("note-form").reportValidity()) await save(byId("note-text").value);
  });
  on("remove-note", "click", () => save(""));
  for (const id of ["close-note", "cancel-note"]) on(id, "click", () => close());
  on("note-editor", "cancel", (event) => {
    event.preventDefault();
    close();
  });
  closeOnBackdrop(dom, "note-editor", () => close());
  function captureDraft() {
    if (!editing || !byId("note-editor").open || byId("note-text").value === editing.input)
      return null;
    return {
      kind: "note",
      context: { ...editing },
      fields: captureFields(byId("note-form")),
      focusKey: opener?.dataset.focusKey,
      scrollTop: byId("note-editor").scrollTop
    };
  }
  function restoreDraft(saved) {
    const state = store.snapshot().state;
    if (saved?.kind !== "note" || !saved.context || !state || !validFieldDraft(saved.fields))
      return false;
    if (
      typeof saved.context.id !== "string" ||
      typeof saved.context.initial !== "string" ||
      typeof saved.context.input !== "string" ||
      typeof saved.context.timeZone !== "string"
    )
      return false;
    const habit = state.habits.find((entry) => entry.id === saved.context.id);
    if (!habit || !validDate(saved.context.date)) return false;
    open(habit, saved.context.date);
    if (!byId("note-editor").open || !editing) return false;
    editing = { ...saved.context };
    restoredFocusKey = typeof saved.focusKey === "string" ? saved.focusKey : null;
    restoreFields(byId("note-form"), saved.fields);
    byId("note-editor").scrollTop = saved.scrollTop || 0;
    return true;
  }
  return { open, captureDraft, restoreDraft, refresh: recovery.refresh };
}
