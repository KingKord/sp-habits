import { t } from "../i18n/index.js";
import { unitText } from "./units.js";
import { scheduleDescription } from "./schedule-fields.js";
import { weeklyRuleDescription } from "../weekly-goals.js";
import { noteForDate } from "../notes.js";
import * as D from "../domain.js";
import {
  dateText,
  ruleText,
  usageText,
  habitName,
  goalText,
  checkInRule,
  countText,
  checkInSymbol,
  resultLabel
} from "./format.js";

export function calendarSymbol(day) {
  if (day.zone === "paused") return "⏸";
  if (day.zone === "rest") return "–";
  if (day.kind === "future") return "›";
  if (day.kind === "inactive") return "·";
  if (day.tracking === "check-in" && day.weekly) return checkInSymbol(day, "?");
  if (day.tracking === "check-in" && !day.recorded) return "?";
  return { ideal: "✦", warning: "✓", red: "×", neutral: "○" }[day.zone] ?? "·";
}

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
  const view = byId("calendar-grid").ownerDocument.defaultView;
  const narrow = view.matchMedia("(max-width: 900px)");
  const monthField = byId("calendar-month");
  const monthFeedback = node("div", undefined, "calendar-month-feedback");
  const monthMessage = node("p", "", "form-error");
  monthMessage.id = "calendar-month-message";
  monthMessage.setAttribute("role", "alert");
  const appliedMonth = node("p", "", "hint");
  appliedMonth.id = "calendar-month-applied";
  appliedMonth.setAttribute("role", "status");
  monthFeedback.append(monthMessage, appliedMonth);
  const emptyMessage = node("p", t("No habits match this filter."), "empty hint");
  emptyMessage.id = "calendar-empty-state";
  emptyMessage.setAttribute("role", "status");
  byId("calendar-summary").after(emptyMessage);
  byId("calendar-summary").after(monthFeedback);
  monthField.setAttribute("aria-describedby", "calendar-month-message calendar-month-applied");
  const detailsTitle = byId("calendar-day-title");
  let detailsRevealed = false;
  detailsTitle.tabIndex = -1;
  const returnToDate = button(
    t("Back to selected date"),
    () => {
      const selected = [...byId("calendar-grid").querySelectorAll(".calendar-date-select")].find(
        (control) => control.dataset.focusKey === "cal-date-" + calendarDate
      );
      selected?.focus({ preventScroll: true });
      selected?.scrollIntoView({ block: "center", behavior: "auto" });
    },
    undefined,
    "quiet calendar-return"
  );
  detailsTitle.after(returnToDate);
  const updateCompactControl = () => {
    byId("calendar-compact").hidden = narrow.matches;
    returnToDate.hidden = !narrow.matches && !detailsRevealed;
  };
  narrow.addEventListener("change", updateCompactControl);
  updateCompactControl();
  let calendarMonth = "",
    monthDraft = null,
    monthError = "",
    calendarDate = "",
    filter = "active",
    showHidden = false,
    compact = false;
  try {
    compact = localStorage.getItem("habits-calendar-compact") === "1";
  } catch {
    // Storage is optional; the detailed view is the default.
  }
  const zoneNames = {
    ideal: t("Ideal"),
    warning: t("Acceptable"),
    red: t("Over limit"),
    neutral: t("No color"),
    inactive: t("Not tracked"),
    future: t("Future day"),
    rest: t("Rest day"),
    paused: t("Paused")
  };

  function updateMonthFeedback() {
    monthMessage.textContent = monthError;
    monthMessage.hidden = !monthError;
    appliedMonth.textContent = calendarMonth
      ? t("Displayed month: ") +
        dateText(calendarMonth + "-01", { month: "long", year: "numeric", day: undefined })
      : "";
    monthFeedback.hidden = !calendarMonth || (monthDraft === null && !monthError);
  }
  function applyMonth(month) {
    calendarMonth = month;
    monthDraft = null;
    monthError = "";
    monthField.setCustomValidity("");
    render();
  }
  function validateMonth() {
    const value = monthField.value;
    if (
      monthField.checkValidity() &&
      value >= "1900-01" &&
      value <= "9999-12" &&
      D.validDate(value + "-01")
    ) {
      if (monthDraft !== null || calendarMonth !== value) applyMonth(value);
      else updateMonthFeedback();
      return;
    }
    monthDraft = value;
    monthError = t("Choose a month from January 1900 through December 9999.");
    monthField.setCustomValidity(monthError);
    updateMonthFeedback();
  }
  function habitMark(habit, day, today, snapshot, prefix = "cal") {
    const unit = unitText(D.unitOf(habit));
    const hasNote = !!noteForDate(habit, day.date);
    const label =
      habitName(habit) +
      " · " +
      dateText(day.date, { year: "numeric" }) +
      ": " +
      (day.weekly || day.tracking === "check-in"
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
      (day.date === today ? t(" · provisional") : "") +
      (hasNote ? t(" · Daily note available") : "");
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
    const symbol = calendarSymbol(day);
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
    if (hasNote) {
      const indicator = node("span", "✎", "calendar-note-indicator");
      indicator.setAttribute("aria-hidden", "true");
      mark.append(indicator);
    }
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
    if (!D.scheduleForDate(habit, today)?.repeatId && habit.manualSchedules?.length)
      description.append(node("small", scheduleDescription(habit, habit.endDate || today)));
    if (reference.weekly)
      description.append(
        node(
          "small",
          weeklyRuleDescription(
            D.ruleForDate(habit, habit.endDate || today),
            unitText(D.unitOf(habit))
          )
        )
      );
    row.append(description, actions);
    return row;
  }

  function renderCalendar(state, today) {
    for (const id of [
      "calendar-month",
      "calendar-today",
      "calendar-active",
      "calendar-all",
      "calendar-archived",
      "calendar-hidden",
      "calendar-compact"
    ])
      byId(id).disabled = !state;
    if (!state) {
      emptyMessage.hidden = monthFeedback.hidden = true;
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
    if (monthDraft === null) monthField.value = calendarMonth;
    updateMonthFeedback();
    byId("calendar-prev").disabled = calendarMonth === "1900-01";
    byId("calendar-next").disabled = calendarMonth === "9999-12";
    for (const key of ["active", "all", "archived"])
      byId("calendar-" + key).setAttribute("aria-pressed", String(filter === key));
    byId("calendar-hidden").setAttribute("aria-pressed", String(showHidden));
    // Hidden habits are only a separate group within Active; All and Archived are unaffected.
    byId("calendar-hidden").disabled = filter !== "active";
    byId("calendar-compact").setAttribute("aria-pressed", String(compact));
    byId("calendar-grid").classList.toggle("compact", compact);
    const habits = state.habits.filter((habit) => D.habitMatchesFilter(habit, filter, showHidden));
    emptyMessage.hidden = habits.length > 0;
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
          detailsRevealed = true;
          detailsTitle.parentElement.classList.add("is-revealed");
          updateCompactControl();
          render();
          detailsTitle.focus({ preventScroll: true });
          detailsTitle.scrollIntoView({ block: "start", behavior: "auto" });
        },
        t("Show habits for ") + dateText(day.date, { year: "numeric" }),
        "calendar-date-select"
      );
      dateButton.dataset.focusKey = "cal-date-" + day.date;
      dateButton.setAttribute("aria-pressed", String(day.date === calendarDate));
      dateButton.setAttribute("aria-controls", "calendar-day-habits");
      if (day.date === today) dateButton.setAttribute("aria-current", "date");
      if (habits.some((habit) => noteForDate(habit, day.date))) {
        const indicator = node("span", "✎", "calendar-note-indicator");
        indicator.setAttribute("aria-hidden", "true");
        dateButton.append(indicator);
        dateButton.setAttribute(
          "aria-label",
          t("Show habits for ") +
            dateText(day.date, { year: "numeric" }) +
            t(" · Daily notes available")
        );
      }
      heading.append(dateButton);
      const marks = node("div", undefined, "calendar-marks");
      const overview = node("div", undefined, "calendar-day-overview");
      overview.setAttribute("aria-hidden", "true");
      for (const [habitIndex, habit] of habits.entries()) {
        const result = months[habitIndex].cells[index];
        marks.append(habitMark(habit, result, today, snapshot));
        if (habitIndex < 4)
          overview.append(
            node("span", calendarSymbol(result), "calendar-overview-dot zone-" + result.zone)
          );
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
  on("calendar-hidden", "click", () => {
    showHidden = !showHidden;
    render();
  });
  on("calendar-compact", "click", () => {
    if (narrow.matches) return;
    compact = !compact;
    try {
      localStorage.setItem("habits-calendar-compact", compact ? "1" : "0");
    } catch {
      // The choice still applies for this session.
    }
    render();
  });
  on("calendar-month", "input", () => {
    monthDraft = monthField.value;
    monthError = "";
    monthField.setCustomValidity("");
    updateMonthFeedback();
  });
  on("calendar-month", "change", validateMonth);
  on("calendar-month", "blur", validateMonth);
  on("calendar-prev", "click", () => {
    applyMonth(D.shiftMonth(calendarMonth, -1));
  });
  on("calendar-next", "click", () => {
    applyMonth(D.shiftMonth(calendarMonth, 1));
  });
  on("calendar-today", "click", () => {
    calendarDate = now();
    applyMonth(calendarDate.slice(0, 7));
  });
  return {
    render: renderCalendar,
    dispose: () => narrow.removeEventListener("change", updateCompactControl)
  };
}
