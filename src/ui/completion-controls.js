import { t } from "../i18n/index.js";
import * as D from "../domain.js";
import { countText } from "./format.js";

// A completion mark is a report by the user, never inferred from the clock.
export function completionControls(
  dom,
  { habit, date, result, disabled, commit, now, focusPrefix, onSaved, onError, compact = false }
) {
  const group = dom.node("div", undefined, "completion-controls");
  const status = dom.node("small", countText(result), "completion-status");
  status.setAttribute("role", "status");
  group.append(status);
  const actions = dom.node("div", undefined, "completion-actions");
  let saving = false;
  const buttons = [];
  const negative = result.goal === "at-most";
  for (const [value, label, selectedLabel, actionLabel, suffix] of [
    [
      1,
      negative ? t("✓ No slip") : t("✓ Mark done"),
      negative ? t("✓ No slip · Undo") : t("✓ Done · Undo"),
      t("Mark done: "),
      "done"
    ],
    [
      0,
      negative ? t("Slipped") : t("Missed"),
      negative ? t("Slipped · Undo") : t("Missed · Undo"),
      t("Mark missed: "),
      "missed"
    ]
  ]) {
    const selected = result.recorded && result.count === value;
    const button = dom.button(
      compact ? (value === 1 ? "✓" : "×") : selected ? selectedLabel : label,
      async () => {
        if (saving) return;
        saving = true;
        for (const control of buttons) control.disabled = true;
        const ok = await commit((state) => {
          const current = state.habits.find((entry) => entry.id === habit.id);
          if (!current) throw new Error(t("This habit no longer exists. Refresh the view."));
          const day = D.dayResult(current, date, now(state));
          const done = day.recorded && day.count === value ? null : value === 1;
          return D.setCompletion(state, habit.id, date, done, now(state));
        });
        saving = false;
        if (!dom.isActive()) return;
        for (const control of buttons) control.disabled = disabled;
        if (ok) onSaved?.();
        else onError?.();
      },
      actionLabel + habit.name,
      "completion-check " + suffix
    );
    button.title = selected ? selectedLabel : label;
    button.disabled = disabled;
    button.setAttribute("aria-pressed", String(selected));
    button.dataset.focusKey = focusPrefix + "-" + suffix;
    buttons.push(button);
    actions.append(button);
  }
  group.append(actions);
  return group;
}
