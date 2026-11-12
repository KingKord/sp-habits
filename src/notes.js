import { t } from "./i18n/index.js";

export const MAX_NOTE_LENGTH = 500;
export const noteForDate = (habit, date) => habit?.notes?.[date] ?? "";

export function validateNotes(habit, validDate) {
  if (habit.notes === undefined) return;
  const notes = habit.notes;
  if (
    !notes ||
    typeof notes !== "object" ||
    Array.isArray(notes) ||
    Object.keys(notes).length > 100000
  )
    throw new Error(t("Invalid daily notes."));
  for (const [date, text] of Object.entries(notes)) {
    if (
      !validDate(date) ||
      date < habit.startDate ||
      (habit.endDate !== null && date > habit.endDate) ||
      typeof text !== "string" ||
      text.length > MAX_NOTE_LENGTH ||
      !text.trim()
    )
      throw new Error(t("Invalid daily note. Use a tracked date and up to 500 characters."));
  }
}

export function updatedNotes(habit, date, text, today, validDate) {
  if (
    !validDate(date) ||
    !validDate(today) ||
    date > today ||
    date < habit.startDate ||
    (habit.endDate !== null && date > habit.endDate)
  )
    throw new Error(t("Notes can only be edited for tracked dates up to today."));
  if (typeof text !== "string" || text.length > MAX_NOTE_LENGTH)
    throw new Error(t("A daily note can contain up to 500 characters."));
  const notes = { ...habit.notes };
  if (text.trim()) notes[date] = text;
  else delete notes[date];
  return notes;
}
