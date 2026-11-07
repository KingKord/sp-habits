import { t } from "../i18n/index.js";
import { unitText } from "./units.js";
import * as D from "../domain.js";
import {
  dateText,
  ruleText,
  usageText,
  habitName,
  goalText,
  checkInRule,
  countText,
  resultLabel
} from "./format.js";

export function createCalendarView({
  dom,
  store,
  now,
  render,
  selectedDate,
  selectDate,
  openEditor,
  openCountEditor,
  openPlan
}) {
  const { byId, node, button, fragment, on } = dom;
  let calendarMonth = "",
    calendarDate = "",
    filter = "active";
  const zoneNames = {
    ideal: t("Ideal"),
    warning: t("Acceptable"),
    red: t("Over limit"),
    neutral: t("No color"),
    inactive: t("Not tracked"),
    future: t("Future day"),
    rest: t("Rest day")
  };

  function habitMark(habit, day, today, snapshot, prefix = "cal") {
    const unit = unitText(D.unitOf(habit));
    const label =
      habitName(habit) +
      " · " +
      dateText(day.date, { year: "numeric" }) +
      ": " +
      (day.tracking === "check-in"
        ? resultLabel(day)
        : day.goal === "at-least" && day.editable && day.kind !== "rest"
          ? day.zone === "red"
            ? t("Goal not met")
            : day.zone === "ideal"
              ? t("Goal met")
              : day.zone === "warning"
                ? t("Minimum met")
                : t("No color")
          : day.kind === "future" && !day.scheduled
            ? t("Rest day")
            : zoneNames[day.zone]) +
      (day.editable
        ? (day.tracking === "check-in"
            ? " · "
            : t(", daily quantity ") + day.count + " " + unit + ", ") + usageText(day, unit)
        : "") +
      (day.zone === "future" &&
      day.scheduled &&
      day.limit !== null &&
      (!habit.endDate || day.date <= habit.endDate)
        ? t(", plan: ") + goalText(day.goal) + ruleText(day.limit, day.periodDays, unit, day.goal)
        : "") +
      (day.date === today ? t(" · provisional") : "");
    const mark = button(
      "",
      () => {
        calendarDate = day.date;
        selectDate(day.date);
        openCountEditor(habit, day.date, prefix + "-" + habit.id + "-" + day.date);
      },
      label,
      "calendar-mark" + (habit.emoji ? " has-emoji" : "")
    );
    if (day.readOnly) mark.classList.add("task-derived");
    mark.dataset.habitId = habit.id;
    mark.dataset.zone = day.zone;
    mark.dataset.focusKey = prefix + "-" + habit.id + "-" + day.date;
    mark.title = label;
    mark.disabled =
      !day.editable ||
      day.readOnly ||
      snapshot.blocked ||
      snapshot.pending > 0 ||
      snapshot.busyRead;
    const symbol = { ideal: "✓", warning: "✓", red: "×", rest: "–" }[day.zone] ?? "·";
    const dot = node("span", symbol, "calendar-mark-dot zone-" + day.zone);
    dot.setAttribute("aria-hidden", "true");
    const name = node("span", habit.name, "calendar-mark-name");
    const emoji = node("span", habit.emoji ?? "", "habit-emoji");
    emoji.setAttribute("aria-hidden", "true");
    emoji.hidden = !habit.emoji;
    mark.append(
      dot,
      emoji,
      name,
      node(
        "span",
        day.editable
          ? day.tracking === "check-in"
            ? countText(day)
            : day.count + " " + unit
          : "—",
        "calendar-mark-value"
      )
    );
    return mark;
  }

  function habitSettings(habit, today, snapshot) {
    const row = node("div", undefined, "calendar-habit-settings");
    const reference = D.calendarResult(habit, habit.endDate || today, today);
    const description = node("div");
    const settings = button(
      habitName(habit) + (habit.endDate ? t(" · archived") : ""),
      () => openEditor(habit),
      t("Habit settings: ") + habit.name,
      "habit-title"
    );
    settings.title = t("Settings · ") + habitName(habit);
    description.append(
      settings,
      node(
        "small",
        (reference.tracking === "check-in"
          ? checkInRule(reference)
          : goalText(reference.goal) +
            ruleText(reference.limit, reference.periodDays, D.unitOf(habit), reference.goal)) +
          (reference.tracking === "check-in"
            ? ""
            : habit.zones?.enabled === false
              ? t(" · colors disabled")
              : t(" · ideal ") +
                (reference.goal === "at-least" ? "≥ " : "≤ ") +
                reference.idealMax +
                " " +
                unitText(D.unitOf(habit)))
      )
    );
    const actions = node("div", undefined, "actions");
    settings.dataset.focusKey = "cal-settings-" + habit.id;
    settings.disabled = snapshot.blocked || snapshot.pending > 0 || snapshot.busyRead;
    const plan = button(
      reference.tracking === "check-in" ? t("Earlier time plan") : t("Reduction plan"),
      () => openPlan(habit),
      (reference.tracking === "check-in" ? t("Earlier time plan: ") : t("Reduction plan: ")) +
        habit.name
    );
    plan.dataset.focusKey = "cal-plan-" + habit.id;
    plan.disabled = settings.disabled || habit.endDate !== null;
    plan.hidden = reference.goal === "at-least" || reference.tracking === "check-in";
    actions.append(plan);
    row.append(description, actions);
    return row;
  }

  function renderCalendar(state, today) {
    for (const id of [
      "calendar-month",
      "calendar-today",
      "calendar-active",
      "calendar-all",
      "calendar-archived"
    ])
      byId(id).disabled = !state;
    if (!state) {
      byId("calendar-grid").replaceChildren();
      byId("calendar-day-habits").replaceChildren();
      byId("calendar-day-title").textContent = "";
      byId("calendar-habit-settings").replaceChildren();
      byId("calendar-summary").textContent = t("Wait for the history to load.");
      byId("calendar-prev").disabled = byId("calendar-next").disabled = true;
      return;
    }
    if (!calendarMonth) calendarMonth = today.slice(0, 7);
    if (!calendarDate.startsWith(calendarMonth + "-")) {
      calendarDate = selectedDate()?.startsWith(calendarMonth + "-")
        ? selectedDate()
        : today.startsWith(calendarMonth + "-")
          ? today
          : calendarMonth + "-01";
    }
    byId("calendar-month").value = calendarMonth;
    byId("calendar-prev").disabled = calendarMonth === "1900-01";
    byId("calendar-next").disabled = calendarMonth === "9999-12";
    for (const key of ["active", "all", "archived"])
      byId("calendar-" + key).setAttribute("aria-pressed", String(filter === key));
    const habits = state.habits.filter((habit) => D.habitMatchesFilter(habit, filter));
    byId("calendar-summary").textContent = habits.length
      ? t("Daily habit markers: ") + habits.map(habitName).join(" · ")
      : t("No habits match this filter.");
    const content = fragment(),
      settings = fragment(),
      snapshot = store.snapshot();
    const focusKey = dom.activeElement()?.dataset.focusKey;
    const months = habits.map((habit) => D.monthCalendar(habit, calendarMonth, today));
    // Build date cells even when the current filter has no habits.
    const dates = Array.from(
      { length: 31 },
      (_, i) => calendarMonth + "-" + String(i + 1).padStart(2, "0")
    )
      .filter(D.validDate)
      .map((date) => ({ date }));
    const offset = (new Date(calendarMonth + "-01T12:00:00Z").getUTCDay() + 6) % 7;
    const cells = months[0]?.cells ?? [...Array(offset).fill(null), ...dates];
    while (cells.length % 7) cells.push(null);
    for (const [index, day] of cells.entries()) {
      if (!day) {
        content.append(node("div"));
        continue;
      }
      const cell = node(
        "section",
        undefined,
        "unified-calendar-cell" +
          (day.date === today ? " today" : "") +
          (day.date === calendarDate ? " selected" : "")
      );
      cell.dataset.date = day.date;
      cell.setAttribute("aria-label", dateText(day.date, { year: "numeric" }));
      const heading = node("div", undefined, "unified-calendar-date");
      const dateButton = button(
        String(Number(day.date.slice(8))),
        () => {
          calendarDate = day.date;
          render();
        },
        t("Show habits for ") + dateText(day.date, { year: "numeric" }),
        "calendar-date-select"
      );
      dateButton.dataset.focusKey = "cal-date-" + day.date;
      dateButton.setAttribute("aria-pressed", String(day.date === calendarDate));
      dateButton.setAttribute("aria-controls", "calendar-day-habits");
      if (day.date === today) dateButton.setAttribute("aria-current", "date");
      heading.append(dateButton);
      if (day.date === today) heading.append(node("small", t("today")));
      const marks = node("div", undefined, "calendar-marks");
      const overview = node("div", undefined, "calendar-day-overview");
      overview.setAttribute("aria-hidden", "true");
      for (const [habitIndex, habit] of habits.entries()) {
        const result = months[habitIndex].cells[index];
        marks.append(habitMark(habit, result, today, snapshot));
        if (habitIndex < 4)
          overview.append(node("span", "", "calendar-overview-dot zone-" + result.zone));
      }
      if (habits.length > 4) overview.append(node("small", "+" + (habits.length - 4)));
      cell.append(heading, overview, marks);
      content.append(cell);
    }
    for (const habit of habits) settings.append(habitSettings(habit, today, snapshot));
    byId("calendar-grid").replaceChildren(content);
    byId("calendar-habit-settings").replaceChildren(settings);
    byId("calendar-day-title").textContent = dateText(calendarDate, {
      year: "numeric",
      weekday: "long"
    });
    const details = fragment();
    for (const habit of habits) {
      const day = { date: calendarDate, ...D.calendarResult(habit, calendarDate, today) };
      details.append(habitMark(habit, day, today, snapshot, "cal-detail"));
    }
    if (!habits.length) details.append(node("p", t("No habits match this filter."), "hint"));
    byId("calendar-day-habits").replaceChildren(details);
    dom.restoreFocus(focusKey);
  }
  for (const key of ["active", "all", "archived"])
    on("calendar-" + key, "click", () => {
      filter = key;
      render();
    });
  on("calendar-month", "change", (event) => {
    if (event.target.checkValidity()) {
      calendarMonth = event.target.value;
      render();
    }
  });
  on("calendar-prev", "click", () => {
    calendarMonth = D.shiftMonth(calendarMonth, -1);
    render();
  });
  on("calendar-next", "click", () => {
    calendarMonth = D.shiftMonth(calendarMonth, 1);
    render();
  });
  on("calendar-today", "click", () => {
    calendarDate = now();
    calendarMonth = calendarDate.slice(0, 7);
    render();
  });
  return { render: renderCalendar };
}
