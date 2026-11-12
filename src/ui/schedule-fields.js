import { t } from "../i18n/index.js";
import { manualScheduleForDate } from "../scheduling.js";

export const weekdayNames = () => [
  t("Mon"),
  t("Tue"),
  t("Wed"),
  t("Thu"),
  t("Fri"),
  t("Sat"),
  t("Sun")
];

export function scheduleDescription(habit, date) {
  const schedule = manualScheduleForDate(habit, date);
  return schedule.type === "daily"
    ? t("Daily")
    : schedule.type === "weekdays"
      ? schedule.days.map((day) => weekdayNames()[day]).join(", ")
      : t("Every ") + schedule.every + t(" days from ") + schedule.anchor;
}

export function linkedScheduleDescription(schedule) {
  return schedule.cycle === "weekly"
    ? schedule.days.map((day) => weekdayNames()[day]).join(", ") +
        t(" · every ") +
        schedule.every +
        t(" weeks")
    : schedule.every + t(" days");
}

export function createScheduleFields(dom) {
  const { byId, node } = dom;
  const root = byId("manual-schedule-fields");
  const field = (text, input) => {
    const label = node("label", text);
    label.append(input);
    return label;
  };
  const select = node("select");
  select.id = "manual-schedule";
  for (const [value, text] of [
    ["daily", t("Daily")],
    ["weekdays", t("Selected weekdays")],
    ["interval", t("Every N days")]
  ]) {
    const option = node("option", text);
    option.value = value;
    select.append(option);
  }
  const weekdays = node("fieldset");
  weekdays.append(node("legend", t("Scheduled weekdays")));
  const checks = weekdayNames().map((text, index) => {
    const input = node("input");
    input.type = "checkbox";
    input.value = index;
    const label = field(text, input);
    label.className = "check-label";
    weekdays.append(label);
    return input;
  });
  const interval = node("div", undefined, "form-row");
  const every = node("input");
  Object.assign(every, {
    id: "manual-every",
    type: "number",
    min: "1",
    max: "366",
    step: "1",
    value: "2"
  });
  const anchor = node("input");
  Object.assign(anchor, { id: "manual-anchor", type: "date", min: "1900-01-01" });
  interval.append(field(t("Interval in days"), every), field(t("Schedule anchor"), anchor));
  root.append(
    field(t("Due days"), select),
    weekdays,
    interval,
    node(
      "p",
      t(
        "Schedule changes apply from the selected rule date. Rest-day recordings are kept in totals but are not assessed."
      ),
      "hint"
    )
  );
  function update(linked = false) {
    select.setCustomValidity("");
    root.hidden = linked;
    select.disabled = linked;
    weekdays.hidden = select.value !== "weekdays";
    interval.hidden = select.value !== "interval";
    for (const input of checks) input.disabled = linked || weekdays.hidden;
    every.disabled = anchor.disabled = linked || interval.hidden;
    every.required = anchor.required = !linked && !interval.hidden;
  }
  select.addEventListener("change", () => update());
  for (const input of checks) input.addEventListener("change", () => select.setCustomValidity(""));
  return {
    update,
    checkValidity() {
      select.setCustomValidity(
        !select.disabled && select.value === "weekdays" && !checks.some((input) => input.checked)
          ? t("Select at least one weekday.")
          : ""
      );
      return select.reportValidity();
    },
    open(habit, date) {
      const schedule = manualScheduleForDate(habit ?? {}, date);
      select.value = schedule.type;
      for (const input of checks)
        input.checked = (schedule.days ?? [0, 1, 2, 3, 4]).includes(Number(input.value));
      every.value = schedule.every ?? 2;
      anchor.value = schedule.anchor ?? date;
      update();
    },
    value() {
      if (select.disabled) return undefined;
      if (select.value === "weekdays")
        return {
          type: "weekdays",
          days: checks.filter((input) => input.checked).map((input) => Number(input.value))
        };
      return select.value === "daily"
        ? { type: "daily" }
        : { type: "interval", every: Number(every.value), anchor: anchor.value };
    }
  };
}
