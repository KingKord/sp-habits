import { t } from "../i18n/index.js";
import { createOrganizationControls } from "./organization-controls.js";
import { orderedHabits, groupedHabits, insertHabit } from "../organization.js";
import { getLocale } from "../i18n/index.js";
import { unitText } from "./units.js";
import { completionControls } from "./completion-controls.js";
import { scheduleDescription, linkedScheduleDescription } from "./schedule-fields.js";
import { weeklyRuleDescription } from "../weekly-goals.js";
import { progressPanel, recordText } from "./progress-view.js";
import { EditConflictError } from "../edit-session.js";
import { createHabitReordering } from "./habit-reordering.js";
import { noteForDate } from "../notes.js";
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
  countText,
  checkInSymbol
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
  newId,
  openNoteEditor,
  openDetails
}) {
  const { byId, node, button, on, activeElement, restoreFocus } = dom;
  const organization = createOrganizationControls({ dom, commit, render, confirm, newId });
  const filters = ["active", "hidden", "archived"];
  let selected = "",
    lastToday = "",
    filter = "active",
    showHidden = false,
    arranging = false,
    managingGroups = false,
    expanded = null,
    expanding = null;
  const reordering = createHabitReordering({ dom, move: reorder, flash });

  const feedback = new Map();
  const rows = new Map();
  const groupHeadings = new Map();
  const view = byId("cards").ownerDocument.defaultView;
  const feedbackNow = () => view.performance?.now?.() ?? Date.now();
  let feedbackTimer = null,
    feedbackGeneration = 0,
    disposed = false;
  function cancelFeedbackTimer() {
    if (feedbackTimer === null) return;
    if (view.clearTimeout) view.clearTimeout(feedbackTimer);
    else clearTimeout(feedbackTimer);
    feedbackTimer = null;
  }
  function removeFeedback(row) {
    row?.classList.remove("is-confirmed");
    row?.querySelector?.(".habit-feedback")?.remove?.();
  }
  function clearFeedback(id) {
    if (id === undefined) {
      feedbackGeneration++;
      feedback.clear();
      for (const row of byId("cards").children) removeFeedback(row);
    } else {
      feedback.delete(id);
      removeFeedback([...byId("cards").children].find((row) => row.dataset?.habitId === id));
    }
    scheduleFeedbackExpiry();
  }
  function scheduleFeedbackExpiry() {
    cancelFeedbackTimer();
    if (disposed || !feedback.size) return;
    const delay = Math.max(
      0,
      Math.min(...[...feedback.values()].map((item) => item.until)) - feedbackNow()
    );
    const expire = () => {
      feedbackTimer = null;
      if (disposed) return;
      for (const [id, item] of feedback) if (item.until <= feedbackNow()) feedback.delete(id);
      scheduleFeedbackExpiry();
      render();
    };
    feedbackTimer = view.setTimeout ? view.setTimeout(expire, delay) : setTimeout(expire, delay);
  }
  function decorateFeedback(row, id) {
    const item = feedback.get(id);
    if (!item || item.date !== selected || item.until <= feedbackNow()) {
      removeFeedback(row);
      return;
    }
    row.classList.add("is-confirmed");
    if (row.querySelector?.(".habit-feedback")) return;
    const message = node("small", t("Saved"), "habit-feedback");
    message.setAttribute("role", "status");
    row.querySelector?.(".habit-info")?.append(message);
  }
  function confirmed(id, date, generation) {
    if (
      disposed ||
      generation !== feedbackGeneration ||
      date !== selected ||
      byId("day-view").hidden
    )
      return;
    feedback.set(id, { date, until: feedbackNow() + 2000 });
    scheduleFeedbackExpiry();
    const row = [...byId("cards").children].find((entry) => entry.dataset?.habitId === id);
    if (row) decorateFeedback(row, id);
  }
  async function commitRow(id, transform, metadata) {
    const date = selected,
      generation = feedbackGeneration;
    clearFeedback(id);
    const ok = await commit(transform, metadata);
    if (ok) confirmed(id, date, generation);
    return ok;
  }
  async function reorder(id, targetId, placement, groupId, focusKey) {
    const currentFilter = filter,
      currentShowHidden = showHidden,
      date = selected,
      generation = feedbackGeneration;
    clearFeedback(id);
    const ok = await commit((latest) => {
      const peers = orderedHabits(latest).filter(
        (habit) =>
          D.habitMatchesFilter(habit, currentFilter, currentShowHidden) &&
          (habit.groupId ?? "") === groupId
      );
      if (![id, targetId].every((entry) => peers.some((habit) => habit.id === entry)))
        throw new EditConflictError(
          t("This list changed. Review the current order and try again.")
        );
      return insertHabit(
        latest,
        id,
        targetId,
        peers.map((habit) => habit.id),
        placement
      );
    });
    if (ok) {
      flash(t("Habit order saved."));
      confirmed(id, date, generation);
    }
    restoreFocus(focusKey);
  }
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
    if (selected !== date) clearFeedback();
    selected = date;
    flash("");
    render();
  }
  function renderDay(s, today) {
    reordering.cancel();
    const locked = s.blocked || s.busyRead || !s.state;
    byId("arrange").disabled = locked || s.pending > 0;
    byId("arrange").setAttribute("aria-pressed", String(arranging));
    byId("arrange").textContent = arranging ? t("Done reordering") : t("Reorder");
    byId("arrange-hint").hidden = !arranging;
    byId("manage-groups").disabled = locked || s.pending > 0;
    byId("manage-groups").setAttribute("aria-pressed", String(managingGroups));
    for (const key of filters) byId(key).setAttribute("aria-pressed", String(filter === key));
    byId("day-hidden").setAttribute("aria-pressed", String(showHidden));
    byId("day-hidden").disabled = !s.state || filter !== "active";
    if (!s.state) {
      byId("cards").replaceChildren();
      rows.clear();
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
      orderedHabits(state).filter((h) => D.habitMatchesFilter(h, filter, showHidden))
    );
    const hiddenCount = state.habits.filter((h) => D.habitMatchesFilter(h, "hidden")).length;
    byId("hidden").textContent = t("Hidden") + (hiddenCount ? " (" + hiddenCount + ")" : "");
    const tracked = visible
      .map((h) => D.dayResult(h, selected, today))
      .filter((r) => r.editable && r.kind !== "rest");
    const good = tracked.filter((r) => ["success", "today-good"].includes(r.kind)).length;
    byId("summary").textContent = !tracked.length
      ? t("No goals to assess for this day.")
      : selected === today
        ? t("Goals met so far: ") + good + t(" of ") + tracked.length
        : t("Successful: ") + good + t(" of ") + tracked.length;
    const focusKey = activeElement()?.dataset.focusKey;
    organization.management(state, locked || s.pending > 0, managingGroups);
    const content = [];
    const rowLocked = arranging && (locked || s.pending > 0);
    function appendRow(record) {
      for (const [control, disabled] of record.controls)
        control.disabled = disabled || locked || s.pending > 0;
      decorateFeedback(record.card, record.card.dataset.habitId);
      content.push(record.card);
    }
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
                : t("Select Add habit to create a habit.")
        )
      );
      content.push(el);
    }
    let lastGroup = null;
    for (const habit of visible) {
      if (state.groups?.length && lastGroup !== (habit.groupId ?? "")) {
        const groupId = habit.groupId ?? "";
        let heading = groupHeadings.get(groupId);
        if (!heading) {
          heading = node("h2", undefined, "habit-group-title");
          groupHeadings.set(groupId, heading);
        }
        const name = state.groups.find((group) => group.id === groupId)?.name ?? t("Ungrouped");
        if (heading.textContent !== name) heading.textContent = name;
        content.push(heading);
        lastGroup = habit.groupId ?? "";
      }
      const signature = JSON.stringify([
        habit,
        selected,
        today,
        getLocale(),
        state.groups,
        arranging,
        expanded === habit.id,
        expanding === habit.id,
        arranging ? [rowLocked, visible.map((entry) => entry.id)] : null
      ]);
      const previous = rows.get(habit.id);
      if (previous?.signature === signature) {
        appendRow(previous);
        continue;
      }
      const result = D.calendarResult(habit, selected, today);
      const unit = unitText(D.unitOf(habit)),
        increment = D.stepOf(habit);
      const card = node("article", undefined, "habit-row");
      card.dataset.habitId = habit.id;
      card.dataset.groupId = habit.groupId ?? "";
      card.classList.toggle("is-reordering", arranging);
      card.classList.toggle("is-expanding", expanding === habit.id && expanded === habit.id);
      const top = node("div", undefined, "habit-summary"),
        title = node("div", undefined, "habit-info");
      const edit = button(
        habitName(habit),
        () => openEditor(habit),
        t("Habit settings: ") + habit.name,
        "habit-title"
      );
      edit.title = t("Settings · ") + habitName(habit);
      edit.disabled = rowLocked;
      edit.dataset.focusKey = habit.id + "-edit";
      const heading = node("h2", undefined, "habit-title-heading");
      heading.append(edit);
      if (habit.hidden && habit.endDate === null)
        heading.append(node("small", t("Hidden"), "habit-hidden-label"));
      if (noteForDate(habit, selected)) {
        const indicator = button(
          "✎",
          () => openNoteEditor(habit, selected),
          t("Read daily note: ") + habit.name,
          "quiet habit-note-indicator"
        );
        indicator.title = t("Daily note");
        indicator.dataset.focusKey = habit.id + "-note-indicator";
        indicator.disabled = rowLocked || !result.editable;
        heading.append(indicator);
      }
      title.append(heading, node("p", resultLabel(result), "sr-only"));
      const extras = node("div", undefined, "habit-extra-actions");
      if (habit.endDate === null) {
        const visibility = button(
          habit.hidden ? t("Show habit") : t("Hide habit"),
          async () => {
            if (await commit((state) => D.setHabitHidden(state, habit.id, !habit.hidden)))
              byId(filter).focus();
          },
          (habit.hidden ? t("Show habit: ") : t("Hide habit: ")) + habit.name,
          "quiet"
        );
        visibility.disabled = edit.disabled;
        extras.append(visibility);
      }
      if (state.groups?.length) extras.append(organization.membership(habit, state, edit.disabled));
      let orderMenu;
      if (arranging) {
        const controls = reordering.controls(
          habit,
          visible.filter((entry) => entry.groupId === habit.groupId),
          edit.disabled
        );
        top.append(controls.handle);
        orderMenu = controls.menu;
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
      if (result.weekly) {
        description.textContent = weeklyRuleDescription(D.ruleForDate(habit, selected), unit);
        if (result.tracking === "check-in") description.textContent += " · " + checkInRule(result);
        else if (result.weekly.type === "days")
          description.textContent += " · " + t("Daily minimum") + ": " + result.limit + " " + unit;
      }
      if (!schedule?.repeatId && habit.manualSchedules?.length)
        description.textContent += " · " + scheduleDescription(habit, selected);
      if (result.weekly)
        description.title = description.textContent + " · " + usageText(result, unit);
      if (schedule?.repeatId)
        title.append(
          node(
            "small",
            t("Task: ") +
              schedule.title +
              " · " +
              linkedScheduleDescription(schedule) +
              (schedule.time ? " · " + schedule.time : ""),
            "habit-rule"
          )
        );
      if (result.tracking === "check-in")
        description.textContent = [description.textContent, countText(result)]
          .filter(Boolean)
          .join(" · ");
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
      const expandedStreak = node("div", undefined, "habit-expanded-streak");
      expandedStreak.append(
        badges,
        node(
          "small",
          "🏆 " + recordText(streak),
          "habit-record" + (streak.isRecord ? " new-record" : "")
        )
      );
      const compactStreak = node(
        "small",
        (streak.days ? "🔥 " : "") + streakText.days,
        "habit-streak-compact"
      );
      compactStreak.title = badges.title;
      expandedStreak.append(node("p", badges.title, "hint"));
      top.append(title, compactStreak);
      let counter;
      if (result.tracking === "check-in") {
        counter = completionControls(dom, {
          habit,
          date: selected,
          result,
          disabled: rowLocked || !result.editable || result.readOnly,
          commit: (transform) => commitRow(habit.id, transform),
          now,
          focusPrefix: habit.id,
          compact: true
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
        count.disabled = rowLocked || !result.editable || result.readOnly;
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
              void commitRow(
                habit.id,
                (state) => D.changeCount(state, habit.id, date, delta, now(state)),
                {
                  increment: { id: habit.id, date, delta }
                }
              );
            },
            (delta === 1 ? t("Add ") : t("Subtract ")) + increment + " " + unit + ": " + habit.name,
            "step " + suffix
          );
          step.title = (delta === 1 ? "+" : "−") + increment + " " + unit;
          step.disabled =
            rowLocked ||
            !result.editable ||
            result.readOnly ||
            (delta === -1 && result.count === 0) ||
            (delta === 1 && result.count > D.MAX_VALUE - increment);
          step.dataset.focusKey = habit.id + "-" + suffix;
          counter.append(step);
        }
      }
      const note = button(
        noteForDate(habit, selected) ? t("Edit note") : t("Add note"),
        () => openNoteEditor(habit, selected),
        t("Daily note: ") + habit.name,
        "quiet habit-note"
      );
      note.disabled = rowLocked || !result.editable;
      note.dataset.focusKey = habit.id + "-note";
      if (noteForDate(habit, selected)) note.title = noteForDate(habit, selected);
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
          r.paused && r.kind !== "inactive"
            ? "⏸"
            : r.tracking === "check-in"
              ? checkInSymbol(r)
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
        day.disabled = rowLocked || !r.editable || r.readOnly;
        day.dataset.focusKey = habit.id + "-" + date;
        week.append(day);
      }
      const details = button(
        t("Details"),
        () => openDetails(habit, selected),
        t("Habit details: ") + habit.name,
        "quiet habit-details-action"
      );
      details.disabled = rowLocked;
      details.dataset.focusKey = habit.id + "-details";
      extras.prepend(note, details);
      const toggle = button(
        expanded === habit.id ? "⌃" : "⌄",
        () => {
          expanded = expanded === habit.id ? null : habit.id;
          expanding = expanded;
          render();
          restoreFocus(habit.id + "-expand");
        },
        t("Show history and actions: ") + habit.name,
        "habit-expand"
      );
      toggle.dataset.focusKey = habit.id + "-expand";
      toggle.setAttribute("aria-expanded", String(expanded === habit.id));
      toggle.setAttribute("aria-controls", habit.id + "-expanded");
      top.append(counter, toggle);
      if (orderMenu) top.append(orderMenu);
      const history = node("div", undefined, "habit-history");
      history.id = habit.id + "-expanded";
      history.hidden = expanded !== habit.id;
      const progress =
        streak.unit === "weeks"
          ? node("p", usageText(result, unit), "hint")
          : progressPanel(dom, habit, streak);
      const recent = node("div", undefined, "habit-recent");
      recent.append(weekHeadings("week habit-week-headings"), week, progress);
      history.append(expandedStreak, recent, extras);
      card.append(top, history);
      const record = {
        signature,
        card,
        controls: [...card.querySelectorAll("button, select")].map((control) => [
          control,
          control.disabled
        ])
      };
      rows.set(habit.id, record);
      appendRow(record);
    }
    const root = byId("cards");
    // Keep unchanged rows attached through writes and identical host refreshes.
    for (const [index, row] of content.entries()) {
      const current = root.children[index];
      if (current === row) continue;
      if (current?.dataset.habitId && current.dataset.habitId === row.dataset.habitId)
        root.replaceChild(row, current);
      else root.insertBefore(row, current ?? null);
    }
    while (root.children.length > content.length) root.removeChild(root.lastElementChild);
    const visibleIds = new Set(visible.map((habit) => habit.id));
    for (const id of rows.keys()) if (!visibleIds.has(id)) rows.delete(id);
    expanding = null;
    restoreFocus(focusKey);
  }
  on("day-hidden", "click", () => {
    if (filter !== "active" || !store.snapshot().state) return;
    clearFeedback();
    showHidden = !showHidden;
    render();
  });
  on("arrange", "click", () => {
    arranging = !arranging;
    if (arranging) expanded = null;
    render();
  });
  on("manage-groups", "click", () => {
    managingGroups = !managingGroups;
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
      clearFeedback();
      filter = key;
      render();
    });

  function prepare(today) {
    if (!selected || (lastToday && selected === lastToday && lastToday !== today)) {
      clearFeedback();
      selected = today;
    }
    lastToday = today;
  }
  function reset() {
    clearFeedback();
    selected = "";
    filter = "active";
    showHidden = false;
    expanded = null;
    arranging = false;
    managingGroups = false;
    reordering.cancel();
  }
  return {
    cancelReordering: () => {
      reordering.cancel();
      clearFeedback();
    },
    dispose: () => {
      disposed = true;
      clearFeedback();
      rows.clear();
      reordering.cancel();
    },
    render: renderDay,
    prepare,
    reset,
    select: go,
    selectedDate: () => selected,
    lastToday: () => lastToday
  };
}
