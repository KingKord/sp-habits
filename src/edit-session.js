import { t } from "./i18n/index.js";

export class EditConflictError extends Error {
  constructor() {
    super(
      t(
        "This habit changed while the form was open. Your input is kept. Reopen the form to review the latest data before saving."
      )
    );
    this.name = "EditConflictError";
  }
}

// Quantities and task completions may change without invalidating a settings edit.
export function settingsVersion(state, id) {
  const habit = state.habits.find((entry) => entry.id === id);
  if (!habit) return null;
  return JSON.stringify([
    state.timeZone,
    ...[
      "name",
      "emoji",
      "unit",
      "step",
      "reflectionTask",
      "startDate",
      "endDate",
      "limits",
      "zones",
      "taskSchedules"
    ].map((field) => habit[field])
  ]);
}

export function assertSettingsVersion(state, id, expected) {
  if (settingsVersion(state, id) !== expected || expected === null) throw new EditConflictError();
}
