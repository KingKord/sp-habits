import { t } from "../i18n/index.js";
import * as D from "../domain.js";
import { dateText, ruleText, habitName, goalText } from "./format.js";
import { closeOnBackdrop } from "./dialog.js";
import { settingsVersion, assertSettingsVersion } from "../edit-session.js";

export function createPlanEditor({ dom, store, now, commit }) {
  const { byId, node, button, on } = dom;
  let planning = null,
    planSaving = false,
    lastFocusKey = null,
    openedVersion = null;
  const timeGoal = () =>
    planning &&
    D.goalForDate(
      store.snapshot().state.habits.find((h) => h.id === planning),
      now()
    ) === "before-time";
  function frequencyInputs() {
    return [...byId("frequency-stages").children].map((row) => ({
      from: row.querySelector("input[type=date]").value,
      value: Number(row.querySelector(".stage-value").value),
      periodDays: Number(row.querySelector(".stage-period").value)
    }));
  }
  function addFrequencyStage(stage = null) {
    if (byId("frequency-stages").children.length >= 120) return;
    const current = frequencyInputs(),
      previous = current.at(-1);
    if (!stage)
      stage = {
        from: D.addDays(previous?.from || now(), 7),
        value: previous?.value ?? 1,
        periodDays: Math.min(366, Math.max(7, (previous?.periodDays ?? 1) + 1))
      };
    const row = node("div", undefined, "frequency-stage");
    for (const [text, type, value, className, min, max] of [
      [t("From date"), "date", stage.from, "stage-date", D.addDays(now(), 1), "9999-12-31"],
      [t("At most"), "number", stage.value, "stage-value", 0, D.MAX_VALUE],
      [t("Per days"), "number", stage.periodDays, "stage-period", 1, 366]
    ]) {
      const label = node("label", text),
        input = node("input");
      input.type = type;
      input.value = value;
      input.className = className;
      input.min = min;
      input.max = max;
      input.required = true;
      if (type === "number") input.step = "1";
      input.addEventListener("input", () => {
        if (dom.isActive()) previewPlan();
      });
      label.append(input);
      row.append(label);
    }
    row.append(
      button(
        "×",
        () => {
          row.remove();
          previewPlan();
        },
        t("Remove stage"),
        "quiet"
      )
    );
    byId("frequency-stages").append(row);
  }
  function updatePlanMode() {
    const frequency = byId("plan-mode").value === "frequency";
    byId("amount-plan-fields").hidden = frequency;
    byId("frequency-plan-fields").hidden = !frequency;
    for (const input of byId("amount-plan-fields").querySelectorAll("input"))
      input.disabled = frequency;
    for (const input of byId("frequency-plan-fields").querySelectorAll("input"))
      input.disabled = !frequency;
    previewPlan();
  }
  on("plan-mode", "change", updatePlanMode);
  on("add-frequency-stage", "click", () => {
    try {
      addFrequencyStage();
      previewPlan();
    } catch (error) {
      byId("plan-error").textContent = error.message;
    }
  });
  const planInput = () => ({
    first: byId("plan-first").value,
    everyDays: Number(byId("plan-interval").value),
    decrease: Number(byId("plan-decrease").value),
    target: timeGoal()
      ? D.clockMinutes(byId("plan-target").value)
      : Number(byId("plan-target").value)
  });
  function previewPlan() {
    byId("plan-error").textContent = "";
    byId("plan-preview").replaceChildren();
    if (!planning) return;
    const state = store.snapshot().state,
      habit = state.habits.find((h) => h.id === planning);
    try {
      assertSettingsVersion(state, planning, openedVersion);
      const stages =
        byId("plan-mode").value === "frequency"
          ? D.frequencyPreview(habit, frequencyInputs(), now(state))
          : D.reductionPreview(habit, planInput(), now(state));
      const list = node("ul");
      byId("plan-preview").append(node("strong", t("New plan preview")));
      for (const stage of stages)
        list.append(
          node(
            "li",
            dateText(stage.from, { year: "numeric" }) +
              " — " +
              goalText(stage.goal) +
              ruleText(stage.value, stage.periodDays ?? 1, D.unitOf(habit), stage.goal)
          )
        );
      byId("plan-preview").append(list);
      return stages;
    } catch (e) {
      byId("plan-error").textContent = e.message;
      return null;
    }
  }
  function openPlan(habit) {
    const s = store.snapshot();
    if (
      !habit ||
      habit.endDate ||
      s.blocked ||
      s.pending ||
      s.busyRead ||
      D.goalForDate(habit, now()) === "at-least"
    )
      return;
    planning = habit.id;
    openedVersion = settingsVersion(s.state, habit.id);
    lastFocusKey = dom.activeElement()?.dataset.focusKey;
    const today = now();
    byId("plan-context").textContent =
      habitName(habit) +
      (timeGoal() ? t(" · current target ") : t(" · current limit ")) +
      ruleText(
        D.limitForDate(habit, today),
        D.periodDaysForDate(habit, today),
        D.unitOf(habit),
        D.goalForDate(habit, today)
      );
    const timed = timeGoal();
    byId("plan-title").textContent = timed ? t("Earlier time plan") : t("Gradual reduction");
    byId("plan-mode").disabled = timed;
    byId("plan-mode-label").hidden = timed;
    byId("plan-first-label").textContent = timed ? t("First change") : t("First reduction");
    byId("plan-hint").textContent = timed
      ? t(
          "The plan changes future deadlines only. Earlier rules and completion marks are kept. Maximum 120 steps."
        )
      : t(
          "The plan applies only to future days. Limits from the first reduction date will be replaced by the new schedule; past limits and quantities will be kept. Maximum 120 steps."
        );
    if (byId("plan-target").type !== (timed ? "time" : "number")) byId("plan-target").value = "";
    byId("plan-target").type = timed ? "time" : "number";
    byId("plan-target").min = timed ? "00:00" : "0";
    byId("plan-target").max = timed ? "23:59" : String(D.MAX_VALUE);
    byId("plan-target").step = timed ? "60" : "1";
    byId("plan-decrease-label").textContent = timed
      ? t("Move earlier by (minutes)")
      : t("Reduce by");
    byId("plan-target-label").textContent = timed ? t("Target time") : t("Target limit");
    byId("plan-first").min = D.addDays(today, 1);
    byId("plan-first").value = D.addDays(today, 7);
    byId("plan-interval").value = 7;
    byId("plan-decrease").value = timed ? 15 : D.stepOf(habit);
    byId("plan-target").value = timed
      ? D.clockText(Math.max(0, D.limitForDate(habit, today) - 15))
      : 0;
    const future = habit.limits.filter((limit) => limit.from > today);
    const list = node("ul");
    for (const limit of future)
      list.append(
        node(
          "li",
          dateText(limit.from, { year: "numeric" }) +
            " — " +
            goalText(limit.goal) +
            ruleText(limit.value, limit.periodDays ?? 1, D.unitOf(habit), limit.goal)
        )
      );
    byId("plan-context").append(
      node("strong", future.length ? t(" Already planned:") : t(" No future changes planned.")),
      list
    );
    byId("cancel-reduction").disabled = !future.some((limit) => limit.planned);
    const period = D.periodDaysForDate(habit, today),
      value = D.limitForDate(habit, today);
    const existing = future.filter((limit) => limit.planned && (limit.periodDays ?? 1) > 1);
    byId("frequency-stages").replaceChildren();
    if (existing.length) for (const stage of existing) addFrequencyStage(stage);
    else {
      addFrequencyStage({
        from: D.addDays(today, 7),
        value,
        periodDays: Math.min(366, period + 1)
      });
      addFrequencyStage();
    }
    byId("plan-mode").value =
      !timed && (existing.length || period > 1 || value === 1) ? "frequency" : "amount";
    updatePlanMode();
    byId("plan-editor").showModal();
  }
  function closePlan() {
    if (planSaving) return;
    byId("plan-editor").close();
    planning = null;
    if (lastFocusKey) dom.restoreFocus(lastFocusKey);
    else byId("view-calendar").focus();
  }
  on("close-plan", "click", closePlan);
  closeOnBackdrop(dom, "plan-editor", closePlan);
  on("plan-editor", "cancel", (event) => {
    event.preventDefault();
    closePlan();
  });
  for (const id of ["plan-first", "plan-interval", "plan-decrease", "plan-target"])
    on(id, "input", previewPlan);
  async function commitPlan(transform) {
    if (planSaving) return;
    planSaving = true;
    for (const id of ["save-plan", "cancel-reduction", "close-plan"]) byId(id).disabled = true;
    const ok = await commit((state) => {
      assertSettingsVersion(state, planning, openedVersion);
      return transform(state);
    });
    planSaving = false;
    if (!dom.isActive()) return;
    for (const id of ["save-plan", "cancel-reduction", "close-plan"]) byId(id).disabled = false;
    if (ok) closePlan();
    else byId("plan-error").textContent = store.snapshot().error;
  }
  on("plan-form", "submit", async (event) => {
    event.preventDefault();
    if (!planning || !byId("plan-form").reportValidity() || !previewPlan()) return;
    const id = planning,
      input = planInput(),
      stages = frequencyInputs(),
      frequency = byId("plan-mode").value === "frequency";
    await commitPlan((state) =>
      frequency
        ? D.scheduleFrequency(state, id, stages, now(state))
        : D.scheduleReduction(state, id, input, now(state))
    );
  });
  on("cancel-reduction", "click", async () => {
    if (!planning) return;
    const id = planning;
    await commitPlan((state) => D.cancelReduction(state, id, now(state)));
  });
  return { open: openPlan };
}
