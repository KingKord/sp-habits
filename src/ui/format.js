import { t, getLocale, plural } from "../i18n/index.js";
import { clockText } from "../domain.js";
import { unitText } from "./units.js";

export const labels = {
  success: "✅ Within limit",
  failure: "❌ Over limit",
  "today-good": "Within limit · day in progress",
  "today-bad": "Over limit · day in progress",
  inactive: "Not tracked",
  future: "Future day",
  rest: "Rest day"
};

const formats = new Map();
function formatters() {
  const locale = getLocale();
  if (!formats.has(locale))
    formats.set(locale, {
      number: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
      percent: new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 })
    });
  return formats.get(locale);
}

export function dateText(date, options = {}) {
  return new Intl.DateTimeFormat(getLocale(), {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    ...options
  }).format(new Date(date + "T12:00:00Z"));
}

export function checkInRule(result) {
  return result.deadline === null
    ? t("Daily check-in")
    : t("No later than ") + clockText(result.deadline);
}

export function ruleText(value, days, unit, goal) {
  if (goal === "before-time") return clockText(value);
  return (
    value + " " + unitText(unit) + (days === 1 ? t(" per day") : t(" per ") + days + t(" days"))
  );
}
export function habitName(habit) {
  return (habit.emoji ? habit.emoji + " " : "") + habit.name;
}
export function goalText(goal) {
  return goal === "before-time"
    ? t("before ")
    : goal === "at-least"
      ? t("at least ")
      : t("at most ");
}

export function usageText(result, unit) {
  if (result.weekly)
    return (
      result.weekly.progress +
      " / " +
      result.weekly.target +
      " " +
      (result.weekly.type === "days" ? t("successful days") : unitText(unit)) +
      " · " +
      result.weekly.from +
      " — " +
      result.weekly.to
    );
  if (result.tracking === "check-in") return countText(result) + " · " + checkInRule(result);
  if (result.kind === "rest") return t("Daily total: ") + result.count + " " + unitText(unit);
  return (
    (result.periodDays === 1 ? t("Daily total: ") : t("Over ") + result.periodDays + t(" days: ")) +
    result.periodCount +
    " / " +
    (result.goal === "at-least" ? "≥ " : "") +
    result.limit +
    " " +
    unitText(unit)
  );
}

export function countText(result) {
  return result.tracking === "check-in"
    ? result.recorded
      ? result.count === 1
        ? result.goal === "at-most"
          ? t("No slip")
          : t("Done")
        : result.goal === "at-most"
          ? t("Slipped")
          : t("Missed")
      : t("Not marked")
    : String(result.count);
}

export function resultLabel(result) {
  if (result.paused && result.kind !== "inactive") return t("Paused");
  if (result.weekly && result.editable && result.kind !== "rest")
    return result.weekly.partial
      ? t("Partial week · progress only")
      : !result.weekly.complete
        ? t("Week in progress")
        : result.weekly.unknown
          ? t("Week has unmarked days")
          : result.weekly.met
            ? t("Weekly goal met")
            : t("Weekly goal not met");
  if (result.tracking === "check-in" && result.editable)
    return countText(result) + (result.kind.startsWith("today") ? t(" · day in progress") : "");
  if (result.kind === "rest") return t("Rest day");
  if (result.goal === "at-least" && result.editable) {
    if (result.kind === "today-bad") return t("Goal not met yet · day in progress");
    if (result.kind === "failure") return t("❌ Goal not met");
    const label = result.zone === "warning" ? t("Minimum met") : t("Goal met");
    return label + (result.kind === "today-good" ? t(" · day in progress") : "");
  }
  if (result.zone === "warning" || result.zone === "ideal") {
    const label = result.zone === "warning" ? t("Acceptable") : t("Ideal");
    return label + (result.kind.startsWith("today") ? t(" · day in progress") : "");
  }
  return t(labels[result.kind]);
}
export function resultClass(result) {
  if (result.weekly && (result.weekly.partial || result.weekly.unknown)) return "inactive";
  if (result.tracking === "check-in" && !result.recorded) return "inactive";
  if (result.zone === "warning") return "warning";
  return ["success", "today-good"].includes(result.kind)
    ? "good"
    : ["failure", "today-bad"].includes(result.kind)
      ? "bad"
      : "inactive";
}

export const number = (value) => (value === null ? "—" : formatters().number.format(value));
export const amount = (value, unit) =>
  value === null ? "—" : number(value) + " " + unitText(unit);
export const percent = (value) => (value === null ? "—" : formatters().percent.format(value));

export function streakLabels(streak) {
  if (streak.unit === "weeks")
    return {
      days:
        streak.kind === "empty"
          ? t("No completed weeks")
          : number(streak.days) + t(" weeks in a row"),
      ideal: t("Successful weeks in streak: ") + number(streak.idealDays)
    };
  const suffix = plural("day in a row", "days in a row", streak.days);
  return {
    days:
      streak.kind === "empty"
        ? t("No completed days")
        : streak.days
          ? number(streak.days) + " " + suffix
          : t("0 · streak ended"),
    ideal: t("Ideal days in streak: ") + number(streak.idealDays)
  };
}
