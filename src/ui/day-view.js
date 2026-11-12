import { t } from "../i18n/index.js";
import { createOrganizationControls } from "./organization-controls.js";
import { orderedHabits, groupedHabits, moveHabit } from "../organization.js";
import { getLocale } from "../i18n/index.js";
import { unitText } from "./units.js";
import { completionControls } from "./completion-controls.js";
import { progressPanel, recordText } from "./progress-view.js";
import * as D from "../domain.js";
import {
  dateText,
  resultLabel,
  resultClass,
  ruleText,
  usageText,
  habitName,
  goalText,
  checkInRule,
  streakLabels,
  countText
} from "./format.js";

export function createDayView({
  dom,
  store,
  now,
  commit,
  render,
  flash,
  openEditor,
  openCountEditor,
  confirm,
  newId
}) {
  const { byId, node, button, fragment, on, activeElement, restoreFocus } = dom;
  const organization = createOrganizationControls({ dom, commit, render, confirm, newId });
  const filters = ["active", "hidden", "archived"];
  let selected = "",
    lastToday = "",
    filter = "active",
    arranging = false;
  function weekHeadings(className = "week") {
    const days = node("div", undefined, className);
    days.setAttribute("aria-hidden", "true");
    for (let offset = -6; offset <= 0; offset++) {
      const heading = node("div", undefined, "day-heading");
      try {
        const date = D.addDays(selected, offset);
        heading.append(
          node("small", dateText(date, { weekday: "short", day: undefined, month: undefined })),
          node("small", date.slice(8))
        );
      } catch {
        // Keep the grid aligned at the lower date boundary.
      }
      days.append(heading);
    }
    return days;
  }
  function go(date) {
    const state = store.snapshot().state;
    if (!state || !D.validDate(date) || date > now(state)) return;
    selected = date;
    flash("");
    render();
  }
  function renderDay(s, today) {
    const locked = s.blocked || s.busyRead || !s.state;
    byId("arrange").disabled = locked || s.pending > 0;
    byId("arrange").setAttribute("aria-pressed", String(arranging));
    byId("arrange-hint").hidden = !arranging;
    for (const key of filters) byId(key).setAttribute("aria-pressed", String(filter === key));
    if (!s.state) {
      byId("cards").replaceChildren();
      byId("summary").textContent = s.error ? t("Unable to load") : t("Loading…");
      for (const id of ["date", "prev", "next", "today"]) byId(id).disabled = true;
      return;
    }
    const state = s.state;
    byId("date").value = selected;
    byId("date").max = today;
    byId("date").disabled = false;
    byId("prev").disabled = selected <= "1900-01-01";
    byId("next").disabled = selected >= today;
    byId("today").disabled = selected === today;
    byId("zone").textContent =
      t("Time zone: ") + state.timeZone + t(" · Day: 00:00–24:00 · Stored in Super Productivity");
    const visible = groupedHabits(
      state,
      orderedHabits(state).filter((h) => D.habitMatchesFilter(h, filter))
    );
    const hiddenCount = state.habits.filter((h) => D.habitMatchesFilter(h, "hidden")).length;
    byId("hidden").textContent = t("Hidden") + (hiddenCount ? " (" + hiddenCount + ")" : "");
    const tracked = visible
      .map((h) => D.dayResult(h, selected, today))
      .filter((r) => r.editable && r.kind !== "rest");
    const good = tracked.filter((r) => ["success", "today-good"].includes(r.kind)).length;
    byId("summary").textContent =
      selected === today
        ? t("Goals met so far: ") + good + t(" of ") + tracked.length
        : t("Successful: ") + good + t(" of ") + tracked.length;
    const focusKey = activeElement()?.dataset.focusKey;
    organization.management(state, locked || s.pending > 0, arranging);
    const content = fragment();
    if (!visible.length) {
      const el = node("div", undefined, "empty");
      el.append(
        node(
          "h2",
          filter === "archived"
            ? t("Archive is empty")
            : filter === "hidden"
              ? t("No hidden habits")
              : t("No active habits")
        )
      );
      el.append(
        node(
          "p",
          filter === "archived"
            ? t("Completed tracking history is kept here.")
            : filter === "hidden"
              ? t("Hidden habits will appear here.")
              : hiddenCount
                ? t("Restore habits from the Hidden tab.")
                : t("Click + Add to create a habit.")
        )
      );
      content.append(el);
    }
    if (visible.length) {
      const header = node("div", undefined, "habit-header");
      header.setAttribute("aria-hidden", "true");
      header.append(node("span"));
      header.append(weekHeadings());
      content.append(header);
    }
    let lastGroup = null;
    for (const habit of visible) {
      if (state.groups?.length && lastGroup !== (habit.groupId ?? "")) {
        content.append(
          node(
            "h2",
            state.groups.find((group) => group.id === habit.groupId)?.name ?? t("Ungrouped"),
            "habit-group-title"
          )
        );
        lastGroup = habit.groupId ?? "";
      }
      const result = D.calendarResult(habit, selected, today);
      const unit = unitText(D.unitOf(habit)),
        increment = D.stepOf(habit);
      const card = node("article", undefined, "habit-row");
      card.dataset.habitId = habit.id;
      const top = node("div", undefined, "habit-info"),
        title = node("div");
      const edit = button(
        habitName(habit),
        () => openEditor(habit),
        t("Habit settings: ") + habit.name,
        "habit-title"
      );
      edit.title = t("Settings · ") + habitName(habit);
      edit.disabled = locked || s.pending > 0;
      edit.dataset.focusKey = habit.id + "-edit";
      const heading = node("h2");
      heading.append(edit);
      if (habit.endDate === null) {
        const visibility = button(
          "",
          async () => {
            if (await commit((state) => D.setHabitHidden(state, habit.id, !habit.hidden)))
              byId(filter).focus();
          },
          (habit.hidden ? t("Show habit: ") : t("Hide habit: ")) + habit.name,
          "habit-visibility"
        );
        visibility.innerHTML = habit.hidden
          ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>'
          : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
        visibility.title = visibility.getAttribute("aria-label");
        visibility.setAttribute("aria-pressed", String(!!habit.hidden));
        visibility.disabled = edit.disabled;
        heading.append(visibility);
      }
      title.append(heading, node("p", resultLabel(result), "sr-only"));
      if (arranging) {
        const controls = node("div", undefined, "habit-order");
        const peers = visible.filter((entry) => entry.groupId === habit.groupId);
        const position = peers.indexOf(habit);
        for (const [offset, label, suffix] of [
          [-1, t("Move up"), "up"],
          [1, t("Move down"), "down"]
        ]) {
          const neighbor = peers[position + offset];
          const move = button(
            label,
            () => {
              void commit((latest) => moveHabit(latest, habit.id, neighbor.id));
            },
            label + ": " + habit.name
          );
          move.disabled = edit.disabled || !neighbor;
          move.dataset.focusKey = habit.id + "-move-" + suffix;
          controls.append(move);
        }
        controls.append(organization.membership(habit, state, edit.disabled));
        title.append(controls);
      }
      const rule =
        result.tracking === "check-in"
          ? checkInRule(result)
          : goalText(result.goal) +
            ruleText(result.limit ?? "—", result.periodDays, unit, result.goal);
      const description = node(
        "small",
        result.tracking === "check-in"
          ? checkInRule(result)
          : (result.goal === "at-least" ? "≥ " : "≤ ") +
              ruleText(result.limit ?? "—", result.periodDays, unit, result.goal),
        "habit-rule"
      );
      description.title = rule + (result.periodDays > 1 ? " · " + usageText(result, unit) : "");
      title.append(description);
      const schedule = D.scheduleForDate(habit, selected);
      description.hidden = !!schedule?.repeatId;
      if (schedule?.repeatId)
        title.append(
          node(
            "small",
            t("Task: ") +
              schedule.title +
              " · " +
              schedule.every +
              t(" days") +
              (schedule.time ? " · " + schedule.time : ""),
            "habit-rule"
          )
        );
      const streak = D.habitProgress(habit, selected, today),
        streakText = streakLabels(streak),
        badges = node("div", undefined, "habit-streaks");
      badges.title = t(
        "Completed days only. Ideal days are counted within the current streak. Today is provisional; rest days are skipped."
      );
      badges.append(
        node(
          "span",
          (streak.days ? "🔥 " : "♨ ") + streakText.days,
          "streak-badge" + (streak.days ? " burning" : "")
        )
      );
      if (streak.kind !== "empty")
        badges.append(
          node("span", "✦ " + streakText.ideal, "streak-badge" + (streak.idealDays ? " ideal" : ""))
        );
      title.append(
        badges,
        node(
          "small",
          "🏆 " + recordText(streak),
          "habit-record" + (streak.isRecord ? " new-record" : "")
        )
      );
      top.append(title);
      let counter;
      if (result.tracking === "check-in") {
        counter = completionControls(dom, {
          habit,
          date: selected,
          result,
          disabled: locked || s.pending > 0 || !result.editable || result.readOnly,
          commit,
          now,
          focusPrefix: habit.id
        });
      } else {
        counter = node("div", undefined, "counter");
        const count = button(
          countText(result) + " ",
          () => openCountEditor(habit, selected, habit.id + "-count"),
          t("Edit quantity: ") + habit.name,
          "count"
        );
        if (result.readOnly) count.classList.add("task-derived");
        count.append(node("small", unit));
        count.title =
          t("Quantity for ") +
          dateText(selected) +
          ": " +
          (result.count + " " + unit) +
          t(". Click to edit.");
        count.disabled = locked || s.pending > 0 || !result.editable || result.readOnly;
        count.dataset.focusKey = habit.id + "-count";
        counter.append(count);
        for (const [delta, text, suffix] of [
          [-1, "−", "minus"],
          [1, "+", "plus"]
        ]) {
          const step = button(
            text,
            () => {
              const date = selected;
              void commit((state) => D.changeCount(state, habit.id, date, delta, now(state)), {
                increment: { id: habit.id, date, delta }
              });
            },
            (delta === 1 ? t("Add ") : t("Subtract ")) + increment + " " + unit + ": " + habit.name,
            "step " + suffix
          );
          step.title = (delta === 1 ? "+" : "−") + increment + " " + unit;
          step.disabled =
            locked ||
            s.pending > 0 ||
            !result.editable ||
            result.readOnly ||
            (delta === -1 && result.count === 0) ||
            (delta === 1 && result.count > D.MAX_VALUE - increment);
          step.dataset.focusKey = habit.id + "-" + suffix;
          counter.append(step);
        }
      }
      const week = node("div", undefined, "week");
      week.setAttribute("aria-label", t("Last seven days: ") + habit.name);
      for (let offset = -6; offset <= 0; offset++) {
        let date;
        try {
          date = D.addDays(selected, offset);
        } catch {
          week.append(node("span"));
          continue;
        }
        const r = D.calendarResult(habit, date, today);
        const mark =
          r.tracking === "check-in"
            ? r.recorded
              ? ["success", "today-good"].includes(r.kind)
                ? "✓"
                : "×"
              : "—"
            : r.count > 0 && r.editable
              ? new Intl.NumberFormat(getLocale(), {
                  notation: "compact",
                  maximumFractionDigits: 1
                }).format(r.count)
              : r.kind === "success"
                ? "✓"
                : r.kind === "failure"
                  ? "×"
                  : r.kind.startsWith("today")
                    ? String(r.count)
                    : "—";
        const day = button(
          "",
          () => openCountEditor(habit, date, habit.id + "-" + date),
          habitName(habit) +
            " · " +
            dateText(date, { year: "numeric" }) +
            ": " +
            resultLabel(r) +
            (r.editable
              ? (r.tracking === "check-in"
                  ? " · "
                  : t(", daily quantity ") + r.count + " " + unit + ", ") + usageText(r, unit)
              : ""),
          "day " +
            resultClass(r) +
            (date === selected ? " selected" : "") +
            (date === today ? " today" : "")
        );
        if (r.readOnly) day.classList.add("task-derived");
        day.append(node("strong", mark));
        day.title = date + " · " + resultLabel(r) + (r.editable ? " · " + usageText(r, unit) : "");
        day.disabled = locked || s.pending > 0 || !r.editable || r.readOnly;
        day.dataset.focusKey = habit.id + "-" + date;
        week.append(day);
      }
      top.append(counter);
      const history = node("div", undefined, "habit-history");
      history.append(
        weekHeadings("week habit-week-headings"),
        week,
        progressPanel(dom, habit, streak)
      );
      card.append(top, history);
      content.append(card);
    }
    byId("cards").replaceChildren(content);
    restoreFocus(focusKey);
  }
  on("arrange", "click", () => {
    arranging = !arranging;
    render();
  });
  on("date", "change", (event) => {
    if (event.target.checkValidity()) go(event.target.value);
    else render();
  });
  on("prev", "click", () => go(D.addDays(selected, -1)));
  on("next", "click", () => go(D.addDays(selected, 1)));
  on("today", "click", () => go(now()));
  for (const key of filters)
    on(key, "click", () => {
      filter = key;
      render();
    });

  function prepare(today) {
    if (!selected || (lastToday && selected === lastToday && lastToday !== today)) selected = today;
    lastToday = today;
  }
  function reset() {
    selected = "";
    filter = "active";
  }
  return {
    render: renderDay,
    prepare,
    reset,
    select: go,
    selectedDate: () => selected,
    lastToday: () => lastToday
  };
}
