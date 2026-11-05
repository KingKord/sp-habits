import { t } from "../i18n/index.js";
import * as D from "../domain.js";
import { dateText } from "./format.js";
import { createEmojiPicker } from "./emoji-picker.js";
import { closeOnBackdrop } from "./dialog.js";
import { unitChoice, selectedUnit } from "./units.js";

export function createHabitEditor({
  dom,
  store,
  now,
  commit,
  confirm,
  newId,
  loadEmojis,
  systemEmoji,
  loadSchedules
}) {
  let editing = null,
    originalUnit = null,
    lastFocus = null,
    lastFocusKey = null,
    lastLimit = 0,
    saving = false,
    originalRepeatId = "",
    loadGeneration = 0;
  const { byId, on, activeElement } = dom;
  function updateTaskFields() {
    const linked = !!byId("task-series").value;
    for (const id of ["goal", "limit", "period-days", "unit-choice", "step"])
      byId(id).disabled = linked;
    byId("task-series-hint").textContent = linked
      ? t(
          "The task defines the schedule. Completing it adds 1 completion; rest days do not lower your rate. Linking starts today."
        )
      : t(
          "Fixed repeats every N days are supported. Set the repeat and time in Super Productivity."
        );
  }
  async function populateSchedules(habit, selected) {
    const generation = ++loadGeneration;
    const select = byId("task-series");
    select.replaceChildren(dom.node("option", t("Not linked")));
    select.firstElementChild.value = "";
    if (selected) {
      const option = dom.node("option", D.scheduleForDate(habit, now()).title || selected);
      option.value = selected;
      select.append(option);
    }
    select.value = selected;
    select.disabled = true;
    updateTaskFields();
    try {
      const schedules = await loadSchedules();
      if (generation !== loadGeneration || !dom.isActive()) return;
      for (const schedule of schedules) {
        if (schedule.repeatId === selected) continue;
        const option = dom.node(
          "option",
          schedule.title +
            " · " +
            schedule.every +
            t(" days") +
            (schedule.time ? " · " + schedule.time : "") +
            (schedule.paused ? t(" · paused") : "")
        );
        option.value = schedule.repeatId;
        option.disabled = schedule.paused;
        select.append(option);
      }
      select.disabled = !!habit?.endDate;
    } catch (error) {
      if (generation === loadGeneration && dom.isActive())
        byId("task-series-hint").textContent = t("Unable to load task series: ") + error.message;
    }
  }
  function setEmoji(emoji) {
    byId("emoji").value = emoji;
    byId("emoji-preview").textContent = emoji || "＋";
    byId("emoji-choice-label").textContent = emoji ? t("Change emoji") : t("Choose emoji");
    byId("clear-emoji").disabled = !emoji;
    byId("emoji-status").textContent = emoji ? t("Selected: ") + emoji : t("No emoji selected");
  }
  const emojiPicker = createEmojiPicker({
    dom,
    select: setEmoji,
    loadData: loadEmojis,
    systemEmoji,
    loadSchedules
  });
  function updateUnitChoice() {
    const custom = byId("unit-choice").value === "custom";
    byId("custom-unit-label").hidden = !custom;
    byId("unit").disabled = !custom;
    byId("unit").required = custom;
  }
  function updateEditorHint() {
    if (!editing) {
      byId("editor-hint").textContent =
        byId("goal").value === "at-least"
          ? t(
              "Record the quantity completed. A day is successful when the total for the period meets the minimum. No entries count as zero."
            )
          : t(
              "Zero is a valid limit. Days without recorded events count as within the limit. Include events that have already happened today."
            );
      return;
    }
    const habit = store.snapshot().state.habits.find((h) => h.id === editing);
    const from = byId("from").value;
    byId("editor-hint").textContent =
      D.validDate(from) && from < habit.startDate
        ? t("Tracking will start on ") +
          dateText(from) +
          t(
            ". Days without entries will count as zero. Recorded quantities and later limits will be kept."
          )
        : t(
            "The habit type and goal apply from the selected date. Earlier days keep their previous rules."
          );
  }
  function updateGoalFields() {
    const positive = byId("goal").value === "at-least";
    byId("reflection-settings").hidden = positive;
    byId("reflection-task").disabled = positive;
    byId("limit-label").textContent = positive ? t("Minimum per period") : t("Allowed per period");
    byId("ideal-label").textContent = t("Ideal goal: ") + (positive ? t("at least") : t("at most"));
    byId("zone-hint").textContent = positive
      ? t(
          "For example: minimum 20 minutes, ideal 30 minutes. Below the minimum is red; meeting the minimum is yellow; meeting the ideal is green. Colors do not change the success result."
        )
      : t(
          "For example: ideal 0 ml, allowed 300 ml. At or below the ideal is green; within the allowed limit is yellow; above the limit is red. Yellow days count as successful."
        );
    byId("from-label").textContent = editing ? t("Rule applies from") : t("Start tracking");
    updateEditorHint();
  }
  function updateZoneFields() {
    const enabled = byId("zones-enabled").checked;
    byId("zones-fields").hidden = !enabled;
    byId("zones-ideal").disabled = !enabled;
    byId("zones-ideal").required = enabled;
  }
  function editorZones() {
    return {
      enabled: byId("zones-enabled").checked,
      idealMax: Number(byId("zones-ideal").value),
      yellowMax: null,
      yellowEnabled: byId("zones-yellow-enabled").checked
    };
  }
  function openEditor(habit = null) {
    const s = store.snapshot();
    if (saving || s.blocked || s.pending || s.busyRead || !s.state) return;
    editing = habit ? habit.id : null;
    lastFocus = activeElement();
    lastFocusKey = lastFocus?.dataset.focusKey;
    const today = now(),
      from = habit ? habit.endDate || today : today;
    byId("editor-title").textContent = habit ? t("Habit settings") : t("New habit");
    byId("name").value = habit ? habit.name : "";
    setEmoji(habit?.emoji ?? "");
    byId("goal").value = habit ? D.goalForDate(habit, from) : "at-least";
    byId("reflection-task").checked = habit?.reflectionTask === true;
    byId("limit").value = habit ? D.limitForDate(habit, from) : 1;
    lastLimit = Number(byId("limit").value);
    byId("period-days").value = habit ? D.periodDaysForDate(habit, from) : 1;
    originalUnit = habit ? D.unitOf(habit) : null;
    const unit = originalUnit ?? t("times");
    byId("unit-choice").value = unitChoice(unit);
    byId("unit").value = unit;
    updateUnitChoice();
    byId("step").value = habit ? D.stepOf(habit) : 1;
    const zones = habit?.zones;
    byId("zones-enabled").checked = zones?.enabled !== false;
    byId("zones-yellow-enabled").checked = habit
      ? (zones?.yellowEnabled ?? zones?.yellowMax != null)
      : true;
    byId("zones-ideal").value = zones?.idealMax ?? byId("limit").value;
    updateZoneFields();
    byId("from").value = from;
    byId("from").min = "1900-01-01";
    byId("from").max = habit ? habit.endDate || today : today;
    byId("from-label").textContent = habit ? t("Rule applies from") : t("Start tracking");
    byId("initial-label").hidden = !!habit;
    byId("initial").value = 0;
    byId("archive-habit").hidden = !habit || habit.endDate !== null;
    byId("save-habit").textContent = habit ? t("Save") : t("Create");
    byId("editor-hint").textContent = habit
      ? t(
          "The limit applies from the selected date until the next change. Earlier days keep their previous limit."
        )
      : t(
          "Zero is a valid limit. Days without recorded events count as within the limit. Include events that have already happened today."
        );
    updateGoalFields();
    originalRepeatId = D.scheduleForDate(habit ?? {}, today)?.repeatId ?? "";
    void populateSchedules(habit, originalRepeatId);
    byId("editor-error").textContent = "";
    byId("editor").showModal();
    byId("name").focus();
  }
  function closeEditor() {
    if (saving) return;
    loadGeneration++;
    byId("editor").close();
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
    else if (lastFocusKey) dom.restoreFocus(lastFocusKey);
    else byId("add").focus();
  }

  for (const id of ["zones-enabled", "zones-yellow-enabled"]) on(id, "change", updateZoneFields);
  on("unit-choice", "change", updateUnitChoice);
  on("task-series", "change", () => {
    if (byId("task-series").value) {
      byId("goal").value = "at-least";
      byId("limit").value =
        byId("period-days").value =
        byId("step").value =
        byId("zones-ideal").value =
          1;
      byId("unit-choice").value = "times";
      originalUnit = null;
      updateUnitChoice();
      updateGoalFields();
    }
    updateTaskFields();
  });
  on("from", "input", updateEditorHint);
  on("goal", "change", () => {
    if (byId("goal").value === "at-least" && Number(byId("limit").value) === 0)
      byId("limit").value = 1;
    byId("zones-ideal").value = byId("limit").value;
    lastLimit = Number(byId("limit").value);
    updateGoalFields();
  });
  on("limit", "input", () => {
    const limit = Number(byId("limit").value);
    if (Number(byId("zones-ideal").value) === lastLimit) byId("zones-ideal").value = limit;
    lastLimit = limit;
  });
  on("choose-emoji", "click", () => {
    void emojiPicker.open(byId("emoji").value);
  });
  on("clear-emoji", "click", () => setEmoji(""));
  on("add", "click", () => openEditor());
  on("close-editor", "click", closeEditor);
  closeOnBackdrop(dom, "editor", closeEditor);
  on("editor", "cancel", (event) => {
    event.preventDefault();
    closeEditor();
  });
  on("habit-form", "submit", async (event) => {
    event.preventDefault();
    if (saving || store.snapshot().pending || store.snapshot().blocked) return;
    if (!byId("habit-form").reportValidity()) return;
    const name = byId("name").value.trim(),
      limit = Number(byId("limit").value),
      from = byId("from").value;
    const input = {
      name,
      emoji: byId("emoji").value.trim(),
      goal: byId("goal").value,
      reflectionTask: byId("goal").value === "at-most" && byId("reflection-task").checked,
      limit,
      from,
      startDate: from,
      initialCount: Number(byId("initial").value),
      unit: selectedUnit(byId("unit-choice").value, originalUnit, byId("unit").value),
      step: Number(byId("step").value),
      periodDays: Number(byId("period-days").value),
      zones: editorZones()
    };
    if (
      !name ||
      !D.wholeNumber(limit) ||
      !D.wholeNumber(input.initialCount) ||
      !D.validUnit(input.unit) ||
      !D.validStep(input.step) ||
      !D.validPeriod(input.periodDays)
    ) {
      byId("editor-error").textContent = t("Check the name, unit, step, limit and quantity.");
      return;
    }
    if (!D.validEmoji(input.emoji)) {
      byId("editor-error").textContent = t("Choose one emoji or leave the field empty.");
      return;
    }
    if (
      input.zones.enabled &&
      (input.goal === "at-least" ? input.zones.idealMax < limit : input.zones.idealMax > limit)
    ) {
      byId("editor-error").textContent =
        input.goal === "at-least"
          ? t("The ideal goal must not be below the required minimum.")
          : t("The ideal goal must not exceed the allowed limit.");
      return;
    }
    const isEditing = editing !== null;
    const id = editing || newId();
    saving = true;
    byId("save-habit").disabled = true;
    byId("close-editor").disabled = true;
    byId("archive-habit").disabled = true;
    const repeatId = byId("task-series").value;
    const ok = await commit(
      (state) =>
        isEditing
          ? D.editHabit(state, id, input, now(state))
          : D.createHabit(state, input, now(state), id),
      repeatId !== originalRepeatId ? { id, repeatId: repeatId || null } : undefined
    );
    saving = false;
    if (!dom.isActive()) return;
    byId("save-habit").disabled = false;
    byId("close-editor").disabled = false;
    byId("archive-habit").disabled = false;
    if (ok) closeEditor();
    else byId("editor-error").textContent = store.snapshot().error;
  });
  on("archive-habit", "click", async () => {
    const state = store.snapshot().state,
      habit = state.habits.find((h) => h.id === editing);
    if (
      !confirm(
        t("Stop tracking “") +
          habit.name +
          t("” after today? History will remain in the archive and the future plan will stop.")
      )
    )
      return;
    const id = editing;
    if ((await commit((state) => D.archiveHabit(state, id, now(state)))) && dom.isActive())
      closeEditor();
  });
  return { open: openEditor };
}
