import { t } from "../i18n/index.js";
import * as D from "../domain.js";
import { habitDetails } from "../habit-details.js";
import { noteForDate } from "../notes.js";
import { unitText } from "./units.js";
import {
  dateText,
  habitName,
  number,
  amount,
  percent,
  resultLabel,
  countText,
  usageText,
  goalText,
  ruleText,
  checkInRule
} from "./format.js";
import { closeOnBackdrop } from "./dialog.js";

export function detailRuleText(habit, rule) {
  const unit = D.unitOf(habit);
  if (rule.weekGoal) {
    const weekly =
      number(rule.weekGoal.target) +
      " " +
      (rule.weekGoal.type === "days" ? t("successful days") : unitText(unit)) +
      t(" per calendar week (Monday start)");
    return rule.weekGoal.type === "days"
      ? weekly +
          " · " +
          (rule.tracking === "check-in"
            ? checkInRule({ deadline: rule.deadline ?? null })
            : t("Daily minimum: ") + amount(rule.value, unit))
      : weekly;
  }
  if (rule.tracking === "check-in" || rule.goal === "before-time")
    return checkInRule({
      deadline: rule.goal === "before-time" ? rule.value : (rule.deadline ?? null)
    });
  return (
    goalText(rule.goal ?? "at-most") + ruleText(rule.value, rule.periodDays ?? 1, unit, rule.goal)
  );
}

export function createHabitDetails({ dom, store, now }) {
  const { byId, node, on } = dom;
  let id = null,
    from = "",
    to = "",
    page = 0,
    rulePage = 0,
    opener;
  function cell(row, text, tag = "td") {
    const element = node(tag, text);
    if (tag === "th") element.scope = "row";
    row.append(element);
    return element;
  }
  function render() {
    if (id === null || !byId("habit-details").open) return;
    const state = store.snapshot().state;
    if (!state) return;
    let data;
    try {
      data = habitDetails(state, id, from, to, now(state), page, rulePage);
    } catch (error) {
      byId("details-error").textContent = t(error.message);
      for (const key of ["details-summary", "details-rows", "details-rule-rows"])
        byId(key).replaceChildren();
      return;
    }
    byId("details-error").textContent = "";
    page = data.page;
    rulePage = data.rulePage;
    byId("details-title").textContent = habitName(data.habit);
    byId("details-range-caption").textContent =
      t("Displayed range: ") +
      dateText(from, { year: "numeric", month: "short" }) +
      " — " +
      dateText(to, { year: "numeric", month: "short" });
    byId("details-from").max = byId("details-to").max = now(state);
    const stats = data.statistics,
      progress = data.progress;
    const progressUnit = progress.unit === "weeks" ? t("weeks") : t("days");
    const summary = dom.fragment();
    summary.append(
      node("p", t("Quantity in this range: ") + amount(stats.events, D.unitOf(data.habit)))
    );
    summary.append(
      node(
        "p",
        t("Success rate: ") + percent(stats.assessmentUnit === "mixed" ? null : stats.successRate)
      )
    );
    if (stats.tracking === "check-in" && !stats.weekly)
      summary.append(node("p", t("Unmarked days: ") + number(stats.unmarkedDays)));
    if (stats.assessmentUnit === "mixed")
      summary.append(
        node("p", t("Mixed daily and weekly assessments have no combined success rate."))
      );
    if (stats.weekly)
      summary.append(
        node(
          "p",
          t("Completed weeks: ") +
            number(stats.weekly.completed) +
            " · " +
            t("Partial weeks: ") +
            number(stats.weekly.partial) +
            " · " +
            t("Unknown weeks: ") +
            number(stats.weekly.unknown)
        )
      );
    summary.append(
      node(
        "p",
        t("Streak at range end: ") +
          number(progress.days) +
          " " +
          progressUnit +
          " · " +
          t("Best through range end: ") +
          number(progress.bestDays) +
          " " +
          progressUnit
      )
    );
    byId("details-summary").replaceChildren(summary);
    const rows = dom.fragment();
    const max = Math.max(1, ...data.rows.map((result) => result.count));
    for (const result of data.rows) {
      const row = node("tr");
      cell(row, dateText(result.date, { year: "numeric", month: "short" }), "th");
      const quantity = cell(
        row,
        result.editable
          ? result.tracking === "check-in"
            ? countText(result)
            : amount(result.count, D.unitOf(data.habit))
          : "—"
      );
      if (result.tracking !== "check-in" && result.editable) {
        const bar = node("span", undefined, "detail-quantity-bar");
        bar.setAttribute("aria-hidden", "true");
        bar.style.width = (result.count / max) * 100 + "%";
        quantity.append(bar);
      }
      const outcome = cell(row, resultLabel(result));
      if (result.readOnly) outcome.append(node("small", t("Linked task")));
      cell(row, result.editable ? usageText(result, D.unitOf(data.habit)) : "—");
      cell(row, noteForDate(data.habit, result.date));
      rows.append(row);
    }
    byId("details-rows").replaceChildren(rows);
    byId("details-page").textContent =
      t("Page ") +
      number(page + 1) +
      " / " +
      number(data.pages) +
      " · " +
      dateText(data.rows.at(-1).date, { year: "numeric", month: "short" }) +
      " — " +
      dateText(data.rows[0].date, { year: "numeric", month: "short" });
    byId("details-older").disabled = page >= data.pages - 1;
    byId("details-newer").disabled = page === 0;
    const rules = dom.fragment();
    for (const rule of data.rules) {
      const row = node("tr"),
        index = data.habit.limits.indexOf(rule);
      const until = data.habit.limits[index + 1]
        ? D.addDays(data.habit.limits[index + 1].from, -1)
        : data.habit.endDate;
      cell(row, dateText(rule.from, { year: "numeric", month: "short" }), "th");
      cell(row, until ? dateText(until, { year: "numeric", month: "short" }) : "—");
      cell(row, detailRuleText(data.habit, rule));
      rules.append(row);
    }
    byId("details-rule-rows").replaceChildren(rules);
    byId("details-rule-page").textContent =
      t("Page ") + number(rulePage + 1) + " / " + number(data.rulePages);
    byId("details-rules-older").disabled = rulePage >= data.rulePages - 1;
    byId("details-rules-newer").disabled = rulePage === 0;
  }
  function open(habit, date) {
    const state = store.snapshot().state;
    const current = state?.habits.find((entry) => entry.id === habit.id);
    if (!current) return;
    opener = dom.activeElement();
    id = current.id;
    page = rulePage = 0;
    to = [date || now(state), now(state), current.endDate || now(state)].sort()[0];
    if (to < current.startDate) to = current.startDate;
    from = D.periodRange("30d", to).from;
    if (from < current.startDate) from = current.startDate;
    byId("details-from").value = from;
    byId("details-to").value = to;
    byId("details-to").setCustomValidity("");
    byId("habit-details").showModal();
    render();
    byId("close-details").focus();
  }
  function close() {
    byId("habit-details").close();
    id = null;
    if (opener?.isConnected) opener.focus();
    else dom.restoreFocus(opener?.dataset.focusKey);
  }
  on("close-details", "click", close);
  on("habit-details", "cancel", (event) => {
    event.preventDefault();
    close();
  });
  closeOnBackdrop(dom, "habit-details", close);
  on("details-range", "submit", (event) => {
    event.preventDefault();
    byId("details-to").setCustomValidity("");
    const first = byId("details-from").value,
      last = byId("details-to").value;
    if (first > last)
      byId("details-to").setCustomValidity(t("The end date must not be before the start date."));
    if (!byId("details-range").reportValidity()) return;
    from = first;
    to = last;
    page = rulePage = 0;
    render();
  });
  for (const key of ["details-from", "details-to"])
    on(key, "input", () => byId("details-to").setCustomValidity(""));
  for (const [key, offset, rules] of [
    ["older", 1, false],
    ["newer", -1, false],
    ["rules-older", 1, true],
    ["rules-newer", -1, true]
  ])
    on("details-" + key, "click", () => {
      if (rules) rulePage += offset;
      else page += offset;
      render();
    });
  return { open, render };
}
