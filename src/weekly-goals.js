import { t } from "./i18n/index.js";
import { weekday } from "./scheduling.js";

const indexOf = (date) => Date.parse(date + "T12:00:00Z") / 86400000 - 0.5;
const dateOf = (index) => new Date(index * 86400000).toISOString().slice(0, 10);
export const weekStart = (date) => indexOf(date) - weekday(indexOf(date));
export const hasWeeklyGoals = (habit) => habit.limits.some((rule) => rule.weekGoal);

export function validWeeklyRule(rule) {
  const goal = rule.weekGoal;
  return (
    goal === undefined ||
    (goal &&
      goal.weekStart === 0 &&
      ["quantity", "days"].includes(goal.type) &&
      rule.goal === "at-least" &&
      (rule.periodDays ?? 1) === 1 &&
      Number.isSafeInteger(goal.target) &&
      goal.target >= 1 &&
      goal.target <= (goal.type === "days" ? 7 : 1000000000) &&
      (rule.tracking !== "check-in" || goal.type === "days"))
  );
}

export function weeklyEvaluator(habit, counts, assessed) {
  const buckets = new Map();
  for (const [date, value] of Object.entries(counts)) {
    const key = weekStart(date);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push([date, value]);
  }
  const ruleAt = (date) => habit.limits.findLast((rule) => rule.from <= date);
  return (rule, start, today, from = "1900-01-01", to = "9999-12-31") => {
    const finish = start + 6,
      first = dateOf(start),
      last = finish <= indexOf("9999-12-31") ? dateOf(finish) : "9999-12-31";
    const partial =
      first < habit.startDate ||
      (habit.endDate !== null && last > habit.endDate) ||
      habit.limits.some((entry) => entry.from > first && entry.from <= last) ||
      (habit.manualSchedules ?? []).some((entry) => entry.from > first && entry.from <= last) ||
      (habit.pauses ?? []).some(
        (pause) => pause.from <= last && (!pause.to || pause.to >= first)
      ) ||
      first < from ||
      last > to ||
      finish > indexOf("9999-12-31");
    const through = today < last ? today : last;
    let progress = 0,
      known = 0,
      scheduled = 0;
    for (const [date, value] of buckets.get(start) ?? []) {
      if (
        date < habit.startDate ||
        date < rule.from ||
        date > through ||
        (habit.endDate && date > habit.endDate)
      )
        continue;
      if (rule.weekGoal.type === "quantity") progress += value;
      else if (assessed(habit, date, date) > 0) {
        known++;
        if (rule.tracking === "check-in" ? value === 1 : value >= rule.value) progress++;
      }
    }
    if (rule.tracking === "check-in")
      for (let day = start; day <= Math.min(finish, indexOf(through)); day++) {
        const date = dateOf(day);
        if (
          date >= habit.startDate &&
          date >= rule.from &&
          (!habit.endDate || date <= habit.endDate)
        )
          scheduled += assessed(habit, date, date);
      }
    const met = progress >= rule.weekGoal.target;
    const complete = last < today && !partial;
    return {
      from: first,
      to: last,
      progress,
      target: rule.weekGoal.target,
      type: rule.weekGoal.type,
      partial,
      complete,
      met,
      unknown: complete && !met && rule.tracking === "check-in" && known < scheduled,
      effective: ruleAt(first) === rule
    };
  };
}

export function weeklyPeriods(habit, from, to, today, evaluate) {
  const periods = [];
  for (let index = 0; index < habit.limits.length; index++) {
    const rule = habit.limits[index];
    if (!rule.weekGoal) continue;
    const lo = rule.from > from ? rule.from : from;
    const next = habit.limits[index + 1]?.from;
    const hi = next && next <= to ? dateOf(indexOf(next) - 1) : to;
    if (lo > hi) continue;
    for (let first = weekStart(lo); first <= indexOf(hi); first += 7)
      periods.push(evaluate(rule, first, today, from, to));
  }
  return [...new Map(periods.map((period) => [period.from, period])).values()];
}

export function weeklyStreak(habit, date, today, counts, assessed) {
  const current = habit.limits.findLast((rule) => rule.from <= date);
  const empty = {
    days: 0,
    idealDays: 0,
    kind: "empty",
    bestDays: 0,
    previousBest: 0,
    unit: "weeks"
  };
  if (!current?.weekGoal) return empty;
  let start = habit.startDate;
  for (let index = habit.limits.indexOf(current); index >= 0; index--)
    if (!habit.limits[index].weekGoal) {
      start = habit.limits[index + 1].from;
      break;
    }
  const evaluate = weeklyEvaluator(habit, counts, assessed);
  for (const period of weeklyPeriods(habit, start, date < today ? date : today, today, evaluate)) {
    if (!period.complete) continue;
    if (!period.met || period.unknown) {
      empty.previousBest = Math.max(empty.previousBest, empty.days);
      empty.days = empty.idealDays = 0;
      empty.kind = "broken";
    } else {
      empty.days++;
      empty.idealDays++;
      empty.kind = "active";
      empty.bestDays = Math.max(empty.bestDays, empty.days);
    }
  }
  return empty;
}

export const weeklyRuleDescription = (rule, unit) =>
  rule.weekGoal
    ? rule.weekGoal.target +
      " " +
      (rule.weekGoal.type === "days" ? t("successful days") : unit) +
      t(" per calendar week (Monday start)")
    : "";
