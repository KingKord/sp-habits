import { t } from "../i18n/index.js";

export function createWeeklyFields(dom, changed) {
  const { node, byId } = dom,
    root = byId("weekly-goal-fields");
  const select = node("select"),
    target = node("input"),
    label = node("label", t("Goal period"));
  select.id = "week-goal";
  label.append(select);
  for (const [value, text] of [
    ["daily", t("Daily or rolling period")],
    ["quantity", t("Calendar-week quantity")],
    ["days", t("Successful days per calendar week")]
  ]) {
    const option = node("option", text);
    option.value = value;
    select.append(option);
  }
  Object.assign(target, { id: "week-target", type: "number", min: "1", step: "1", value: "3" });
  const amount = node("label", t("Weekly target"));
  amount.append(target);
  const note = node(
    "p",
    t(
      "Weeks start on Monday. Partial first, last and changed-rule weeks show progress but do not count toward rates or streaks."
    ),
    "hint"
  );
  root.append(label, amount, note);
  select.addEventListener("change", changed);
  return {
    open(habit, date) {
      const goal = habit?.limits.findLast((rule) => rule.from <= date)?.weekGoal;
      select.value = goal?.type ?? "daily";
      target.value = goal?.target ?? 3;
    },
    update(linked, binary, positive) {
      if (linked || !positive) select.value = "daily";
      if (binary && select.value === "quantity") select.value = "days";
      select.options[1].disabled = binary;
      select.disabled = linked || !positive;
      root.hidden = linked || !positive;
      const active = select.value !== "daily";
      amount.hidden = note.hidden = !active;
      target.disabled = !active;
      target.required = active;
      target.max = select.value === "days" ? "7" : "1000000000";
      return active;
    },
    value() {
      return select.value === "daily"
        ? null
        : { type: select.value, target: Number(target.value), weekStart: 0 };
    }
  };
}
