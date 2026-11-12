import * as D from "./domain.js";

export const DETAIL_PAGE_SIZE = 31;
const dayIndex = (date) => Date.parse(date + "T00:00:00Z") / 86400000;

export function habitDetails(state, id, from, to, today, page = 0, rulePage = 0) {
  const habit = state.habits.find((entry) => entry.id === id);
  if (!habit) throw new Error("This habit no longer exists. Refresh the view.");
  // Reuse the public assessment rules, including clipping, provisional today and unknowns.
  const statistics = D.statistics({ ...state, habits: [habit] }, from, to, today).rows[0];
  const days = dayIndex(to) - dayIndex(from) + 1;
  const pages = Math.ceil(days / DETAIL_PAGE_SIZE);
  const rules = habit.limits.filter(
    (rule, index) =>
      rule.from <= to && (!habit.limits[index + 1] || habit.limits[index + 1].from > from)
  );
  const rulePages = Math.max(1, Math.ceil(rules.length / DETAIL_PAGE_SIZE));
  if (![page, rulePage].every((value) => Number.isInteger(value) && value >= 0))
    throw new Error("Invalid history page.");
  page = Math.min(page, pages - 1);
  rulePage = Math.min(rulePage, rulePages - 1);
  const rows = Array.from(
    { length: Math.min(DETAIL_PAGE_SIZE, days - page * DETAIL_PAGE_SIZE) },
    (_, index) => {
      const date = D.addDays(to, -(page * DETAIL_PAGE_SIZE + index));
      return { date, ...D.calendarResult(habit, date, today) };
    }
  );
  return {
    habit,
    from,
    to,
    statistics,
    progress: D.habitProgress(habit, to, today),
    rows,
    page,
    pages,
    rules: [...rules]
      .reverse()
      .slice(rulePage * DETAIL_PAGE_SIZE, (rulePage + 1) * DETAIL_PAGE_SIZE),
    rulePage,
    rulePages
  };
}
