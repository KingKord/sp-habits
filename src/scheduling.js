import { t } from "./i18n/index.js";

const dayIndex = (date) => Date.parse(date + "T12:00:00Z") / 86400000 - 0.5;
export const weekday = (index) => (((index + 3) % 7) + 7) % 7;
export const manualScheduleForDate = (habit, date) =>
  habit.manualSchedules?.findLast((entry) => entry.from <= date) ?? { type: "daily" };

export function validateManualSchedules(habit, validDate) {
  const history = habit.manualSchedules;
  let previous = "";
  if (
    history !== undefined &&
    (!Array.isArray(history) ||
      history.length > 10000 ||
      history.some((entry) => {
        const valid =
          entry &&
          validDate(entry.from) &&
          entry.from >= habit.startDate &&
          (!habit.endDate || entry.from <= habit.endDate) &&
          entry.from > previous &&
          (entry.type === "daily" ||
            (entry.type === "weekdays" &&
              Array.isArray(entry.days) &&
              entry.days.length > 0 &&
              entry.days.length <= 7 &&
              entry.days.every(
                (day, index) =>
                  Number.isInteger(day) &&
                  day >= 0 &&
                  day < 7 &&
                  (index === 0 || day > entry.days[index - 1])
              )) ||
            (entry.type === "interval" &&
              Number.isInteger(entry.every) &&
              entry.every >= 1 &&
              entry.every <= 366 &&
              validDate(entry.anchor)));
        previous = entry?.from;
        return !valid;
      }))
  )
    throw new Error(t("Invalid manual schedule history."));
}

export function putManualSchedule(habit, schedule, from) {
  const previous = manualScheduleForDate(habit, from);
  const shape = (entry) => JSON.stringify({ ...entry, from: undefined });
  if (shape(previous) === shape(schedule)) return;
  habit.manualSchedules = [
    ...(habit.manualSchedules ?? []).filter((entry) => entry.from !== from),
    { ...schedule, from }
  ].sort((a, b) => a.from.localeCompare(b.from));
}

function countPattern(schedule, lo, hi) {
  if (schedule.type === "daily") return hi - lo + 1;
  if (schedule.type === "weekdays")
    return schedule.days.reduce((count, day) => {
      const first = lo + ((day - weekday(lo) + 7) % 7);
      return count + (first <= hi ? Math.floor((hi - first) / 7) + 1 : 0);
    }, 0);
  const anchor = dayIndex(schedule.anchor),
    start = Math.max(lo, anchor);
  const first = anchor + Math.ceil((start - anchor) / schedule.every) * schedule.every;
  return first <= hi ? Math.floor((hi - first) / schedule.every) + 1 : 0;
}

export function manualAssessedDays(habit, from, to) {
  const history = [{ from: habit.startDate, type: "daily" }, ...(habit.manualSchedules ?? [])];
  let count = 0;
  for (let index = 0; index < history.length; index++) {
    const entry = history[index];
    const lo = Math.max(dayIndex(from), dayIndex(entry.from));
    const hi = Math.min(
      dayIndex(to),
      index + 1 < history.length ? dayIndex(history[index + 1].from) - 1 : dayIndex(to)
    );
    if (lo <= hi) count += countPattern(entry, lo, hi);
  }
  return count;
}
