import { t } from "../i18n/index.js";
import { dayResult, setNote } from "../domain.js";
import { noteForDate } from "../notes.js";
import { EditConflictError } from "../edit-session.js";
import { dateText, habitName } from "./format.js";
import { closeOnBackdrop } from "./dialog.js";

export function createNoteEditor({ dom, store, now, commit, confirm }) {
  const { byId, on } = dom;
  let editing = null,
    saving = false,
    opener = null;
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
    byId("note-context").textContent =
      habitName(current) + " · " + dateText(date, { year: "numeric" });
    byId("note-text").value = editing.initial;
    editing.input = byId("note-text").value;
    byId("remove-note").hidden = !editing.initial;
    byId("note-error").textContent = "";
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
    if (opener?.isConnected) opener.focus();
    else dom.restoreFocus(opener?.dataset.focusKey);
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
    for (const id of ["save-note", "remove-note", "cancel-note", "close-note", "note-text"])
      byId(id).disabled = true;
    const ok = await commit((state) => {
      const current = state.habits.find((habit) => habit.id === id);
      if (!current || state.timeZone !== timeZone || noteForDate(current, date) !== initial)
        throw new EditConflictError();
      return setNote(state, id, date, text, now(state));
    });
    saving = false;
    if (!dom.isActive()) return;
    for (const id of ["save-note", "remove-note", "cancel-note", "close-note", "note-text"])
      byId(id).disabled = false;
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
  return { open };
}
