import * as D from "./domain.js";
import { t, normalizeLanguage } from "./i18n/index.js";
import russian from "./i18n/ru.json" with { type: "json" };
import { readAppLanguage } from "./i18n/setup.js";

export function reflectionTask(habit, date, zone, language) {
  const t = (source) =>
    normalizeLanguage(language) === "ru" ? (russian[source] ?? source) : source;
  return {
    title: t("Brief review: ") + habit.name,
    projectId: "INBOX",
    timeEstimate: 180000,
    notes: [
      t("Episode date: ") + date + " (" + zone + ")",
      t("Quantity added: ") + D.stepOf(habit) + " " + D.unitOf(habit),
      "",
      t("What was happening?"),
      t("What prompted the episode?"),
      t("What will I try next time?")
    ].join("\n")
  };
}

// DAILY ignores weekday flags. WEEKLY uses seven-day blocks from startDate.
// Sources: SP v19.3.1 and v20.0.0 store/get-newest-possible-due-date.util.ts,
// util/get-diff-in-weeks.ts (documented with parity fixtures in tests).
export function fixedSchedule(cfg) {
  if (
    !cfg ||
    !["DAILY", "WEEKLY"].includes(cfg.repeatCycle) ||
    cfg.repeatFromCompletionDate ||
    cfg.waitForCompletion ||
    !D.validDate(cfg.startDate) ||
    !D.validPeriod(cfg.repeatEvery)
  )
    return null;
  const rawTime = cfg.startTime ? String(cfg.startTime).padStart(5, "0") : null;
  if (!D.validTime(rawTime) || (cfg.repeatUntilDay && !D.validDate(cfg.repeatUntilDay)))
    return null;
  const schedule = {
    repeatId: cfg.id,
    title: String(cfg.title ?? "").slice(0, 500),
    anchor: cfg.startDate,
    every: cfg.repeatEvery,
    time: rawTime,
    until: cfg.repeatUntilDay || null,
    paused: !!cfg.isPaused
  };
  if (cfg.repeatCycle === "WEEKLY") {
    const keys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    if (keys.some((key) => cfg[key] !== undefined && typeof cfg[key] !== "boolean")) return null;
    const days = keys.flatMap((key, index) => (cfg[key] === true ? [index] : []));
    if (!days.length) return null;
    const excluded = cfg.deletedInstanceDates ?? [];
    if (!Array.isArray(excluded) || excluded.length > 10000 || !excluded.every(D.validDate))
      return null;
    return {
      ...schedule,
      cycle: "weekly",
      days,
      ...(excluded.length ? { excludedDates: [...new Set(excluded)].sort() } : {})
    };
  }
  return schedule;
}

export function reconcileTasks(state, tasks, configs, today) {
  const next = structuredClone(state);
  for (const habit of next.habits) {
    if (habit.endDate !== null) continue;
    const current = D.scheduleForDate(habit, today);
    if (!current?.repeatId) continue;
    const normalized = fixedSchedule(configs[current.repeatId]);
    const schedule = normalized ?? { ...current, paused: true };
    if (
      JSON.stringify({ ...current, from: undefined }) !==
      JSON.stringify({ ...schedule, from: undefined })
    ) {
      habit.taskSchedules = [
        ...habit.taskSchedules.filter((s) => s.from < today),
        { ...schedule, from: today }
      ];
    }
    habit.taskCompletions ??= {};
    for (const task of tasks) {
      if (!task || typeof task.id !== "string") continue;
      const previous = habit.taskCompletions[task.id];
      if (previous && (!task.isDone || task.wontDoOn)) delete habit.taskCompletions[task.id];
      if (
        task.repeatCfgId !== current.repeatId ||
        !task.isDone ||
        task.wontDoOn ||
        !Number.isFinite(task.doneOn) ||
        task.doneOn <= 0
      )
        continue;
      const date = D.todayInZone(state.timeZone, new Date(task.doneOn));
      const atCompletion = D.scheduleForDate(habit, date);
      if (date > today || date < habit.startDate || atCompletion?.repeatId !== task.repeatCfgId)
        continue;
      // Re-reading an archived task is an update of its provenance, never an increment.
      habit.taskCompletions[task.id] = { date, repeatId: task.repeatCfgId };
    }
  }
  return D.validateState(next);
}

// All local background writes and iframe saves share one queue. An expected-value
// check rejects stale UI writes instead of overwriting a task completion.
export function createTaskIntegration(api, notify = () => {}, instant = () => new Date()) {
  let tail = Promise.resolve(),
    disposed = false,
    error = "";
  const queue = (work) => {
    const result = tail.then(() => {
      if (disposed) throw new Error(t("The plugin view is closed."));
      return work();
    });
    tail = result.catch(() => {});
    return result;
  };
  const read = async () => {
    const raw = await api.loadSyncedData();
    return { raw, state: raw === null ? D.emptyState() : D.parseState(raw) };
  };
  async function snapshot() {
    const [app, archived] = await Promise.all([api.getAppState(), api.getArchivedTasks()]);
    if (!app?.tasks || !app.taskRepeatCfgs || !Array.isArray(archived))
      throw new Error(t("Unable to read Super Productivity tasks."));
    const tasks = new Map(archived.filter(Boolean).map((task) => [task.id, task]));
    for (const task of Object.values(app.tasks)) if (task) tasks.set(task.id, task);
    return { tasks: [...tasks.values()], configs: app.taskRepeatCfgs };
  }
  async function save(previous, state) {
    const raw = JSON.stringify(state);
    if (raw !== previous) {
      D.parseState(raw);
      if (disposed) throw new Error(t("The plugin view is closed."));
      await api.persistDataSynced(raw);
      notify();
    }
    return raw;
  }
  const reconcile = () =>
    queue(async () => {
      const { raw, state } = await read();
      const today = D.todayInZone(state.timeZone, instant());
      if (!state.habits.some((h) => h.endDate === null && D.scheduleForDate(h, today)?.repeatId))
        return;
      const { tasks, configs } = await snapshot();
      await save(raw, reconcileTasks(state, tasks, configs, today));
      const hadError = !!error;
      error = "";
      if (hadError) notify();
    });
  async function request(message) {
    return queue(async () => {
      const raw = await api.loadSyncedData();
      if (message.action === "read") return { raw, syncError: error };
      if (message.action === "write") {
        if (raw !== message.expected)
          throw new Error(t("Data changed after a task update. Reload the data and try again."));
        const candidate = D.parseState(message.raw);
        if (message.increment) {
          if (message.linkChange) throw new Error(t("Invalid counter request."));
          const state = raw === null ? D.emptyState() : D.parseState(raw);
          const today = D.todayInZone(state.timeZone, instant());
          const { id, date, delta } = message.increment;
          const next = D.changeCount(state, id, date, delta, today);
          if (JSON.stringify(next) !== JSON.stringify(candidate))
            throw new Error(t("Invalid counter request."));
          const habit = state.habits.find((h) => h.id === id);
          const review =
            delta === 1 &&
            habit.reflectionTask === true &&
            D.goalForDate(habit, date) === "at-most";
          await save(raw, next);
          let effectMessage = "";
          if (review) {
            try {
              const language = await readAppLanguage(api);
              await api.addTask(reflectionTask(habit, date, state.timeZone, language));
              effectMessage = t("Episode saved; review task created in Inbox.");
            } catch {
              effectMessage = t(
                "Episode saved, but the review task was not confirmed. Check Inbox and create it manually if missing. Do not press + again for this episode."
              );
            }
          }
          return { raw: await api.loadSyncedData(), syncError: error, effectMessage };
        }
        // UI writes cannot bypass task-link validation. Link edits are applied here
        // against the current repeat configuration, not a stale form option.
        if (message.linkChange) {
          const { id, repeatId } = message.linkChange;
          const today = D.todayInZone(candidate.timeZone, instant());
          const cfg = repeatId ? (await api.getAppState()).taskRepeatCfgs[repeatId] : null;
          const schedule = repeatId ? fixedSchedule(cfg) : null;
          if (repeatId && (!schedule || schedule.paused))
            throw new Error(t("Choose an active fixed daily or weekly repeat."));
          const linked = D.setTaskSchedule(candidate, id, schedule, today);
          const { tasks, configs } = await snapshot();
          await save(raw, reconcileTasks(linked, tasks, configs, today));
        } else {
          const today = D.todayInZone(candidate.timeZone, instant());
          for (const habit of candidate.habits) {
            if (habit.endDate === null && D.scheduleForDate(habit, today)?.repeatId)
              D.setTaskSchedule(candidate, habit.id, D.scheduleForDate(habit, today), today);
          }
          await save(raw, candidate);
        }
        return { raw: await api.loadSyncedData(), syncError: error };
      }
      if (message.action === "list") {
        const app = await api.getAppState();
        if (!app?.taskRepeatCfgs) throw new Error(t("Unable to read Super Productivity tasks."));
        return { schedules: Object.values(app.taskRepeatCfgs).map(fixedSchedule).filter(Boolean) };
      }
      throw new Error(t("Unknown task integration request."));
    });
  }
  let refreshing = null,
    requested = false;
  const refresh = () => {
    requested = true;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      do {
        requested = false;
        await reconcile();
      } while (requested && !disposed);
    })()
      .catch((e) => {
        if (disposed) return;
        const previous = error;
        error = e.message || String(e);
        notify();
        if (previous !== error)
          api.showSnack?.({ msg: t("Unable to update task entries: ") + error, type: "ERROR" });
      })
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  };
  return {
    request,
    refresh,
    dispose: () => {
      disposed = true;
    }
  };
}
