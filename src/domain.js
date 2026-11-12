import { t } from "./i18n/index.js";
import { canonicalUnit } from "./i18n/units.js";
import { MAX_STORAGE_CHARACTERS, MAX_BACKUP_BYTES } from "./data-limits.js";
export const MAX_VALUE = 1000000000;
const VISIBILITY_ERROR = "Invalid habit visibility.";

function assert(value, message) {
  if (!value) throw new Error(message);
}

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return (
    Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === value && value >= "1900-01-01"
  );
}

export function validZone(value) {
  if (typeof value !== "string") return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function todayInZone(zone, instant = new Date()) {
  assert(validZone(zone), t("Invalid time zone."));
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(instant);
  const field = (type) => parts.find((p) => p.type === type).value;
  return field("year") + "-" + field("month") + "-" + field("day");
}

export function addDays(date, offset) {
  assert(validDate(date) && Number.isInteger(offset), t("Invalid date."));
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  const result = d.toISOString().slice(0, 10);
  assert(validDate(result), t("Date outside the supported range."));
  return result;
}

export function wholeNumber(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_VALUE;
}

export function unitOf(habit) {
  return habit.unit ?? "times";
}
export function stepOf(habit) {
  return habit.step ?? 1;
}
export function goalForDate(habit, date) {
  return ruleForDate(habit, date)?.goal ?? "at-most";
}
export function isCheckIn(habit) {
  const rule = habit.limits[0];
  return rule?.tracking === "check-in" || rule?.goal === "before-time";
}
export function deadlineForDate(habit, date) {
  const rule = ruleForDate(habit, date);
  return rule?.goal === "before-time" ? rule.value : (rule?.deadline ?? null);
}
export function validGoal(goal) {
  return goal === "at-most" || goal === "at-least" || goal === "before-time";
}
// Target times are wall-clock minutes; daily records are separate completion marks.
export function validClockMinutes(value) {
  return Number.isInteger(value) && value >= 0 && value < 1440;
}
export function clockMinutes(value) {
  assert(typeof value === "string" && validTime(value), t("Enter a time from 00:00 to 23:59."));
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
export function clockText(value) {
  return validClockMinutes(value)
    ? String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0")
    : "—";
}
const graphemes = new Intl.Segmenter("ru", { granularity: "grapheme" });
export function validEmoji(value) {
  return (
    typeof value === "string" &&
    (value === "" ||
      (value.length <= 64 &&
        [...graphemes.segment(value)].length === 1 &&
        /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u.test(value)))
  );
}
export function validUnit(unit) {
  return (
    typeof unit === "string" &&
    unit.trim().length > 0 &&
    unit.length <= 16 &&
    !/[\u0000-\u001f\u007f]/.test(unit)
  );
}
export function validStep(step) {
  return wholeNumber(step) && step > 0;
}

function checkName(name) {
  assert(
    typeof name === "string" && name.trim().length > 0 && name.length <= 120,
    t("The name must contain 1 to 120 characters.")
  );
}

export function emptyState(zone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  assert(validZone(zone), t("Invalid time zone."));
  return { schemaVersion: 1, timeZone: zone, habits: [] };
}

// Validation precedes every import and write. Invalid data must never become an empty history.
export function validateState(state) {
  assert(
    object(state) && state.schemaVersion === 1,
    t("Unsupported data version. Expected schemaVersion: 1.")
  );
  assert(validZone(state.timeZone), t("Invalid time zone."));
  assert(
    Array.isArray(state.habits) && state.habits.length <= 500,
    t("Invalid habit list (maximum 500).")
  );
  const ids = new Set();
  for (const habit of state.habits) {
    assert(
      object(habit) &&
        typeof habit.id === "string" &&
        /^[a-zA-Z0-9_-]{1,100}$/.test(habit.id) &&
        !ids.has(habit.id),
      t("Invalid or duplicate habit ID.")
    );
    ids.add(habit.id);
    checkName(habit.name);
    assert(
      habit.emoji === undefined || validEmoji(habit.emoji),
      t("Choose one emoji or leave the field empty.")
    );
    assert(
      habit.unit === undefined || validUnit(habit.unit),
      t("The unit must contain 1 to 16 characters without line breaks.")
    );
    assert(
      habit.step === undefined || validStep(habit.step),
      t("The step must be a positive whole number.")
    );
    assert(habit.hidden === undefined || typeof habit.hidden === "boolean", t(VISIBILITY_ERROR));
    assert(
      habit.reflectionTask === undefined || typeof habit.reflectionTask === "boolean",
      t("Invalid reflection task setting.")
    );
    validateTaskHistory(habit);
    const zones = habit.zones;
    assert(
      zones === undefined ||
        (object(zones) &&
          typeof zones.enabled === "boolean" &&
          (zones.yellowEnabled === undefined || typeof zones.yellowEnabled === "boolean") &&
          (zones.idealMax === null || wholeNumber(zones.idealMax)) &&
          (zones.yellowMax === null || wholeNumber(zones.yellowMax)) &&
          (!zones.enabled ||
            zones.idealMax === null ||
            zones.yellowMax === null ||
            zones.yellowMax >= zones.idealMax)),
      t("Check the color zone thresholds.")
    );
    assert(validDate(habit.startDate), t("Invalid start date."));
    assert(
      habit.endDate === null || (validDate(habit.endDate) && habit.endDate >= habit.startDate),
      t("Invalid archive date.")
    );
    assert(
      Array.isArray(habit.limits) && habit.limits.length > 0 && habit.limits.length <= 10000,
      t("Limit history is missing.")
    );
    const timeGoal = habit.limits[0]?.goal === "before-time";
    const checkIn = isCheckIn(habit);
    assert(
      !checkIn ||
        (!habit.taskSchedules?.length &&
          !Object.keys(habit.taskCompletions ?? {}).length &&
          canonicalUnit(unitOf(habit)) === "times" &&
          stepOf(habit) === 1),
      t("Time goals cannot be linked to recurring tasks.")
    );
    let previous = "";
    for (const limit of habit.limits) {
      assert(
        object(limit) &&
          validDate(limit.from) &&
          wholeNumber(limit.value) &&
          (limit.goal === undefined || validGoal(limit.goal)) &&
          (limit.tracking === undefined || limit.tracking === "check-in") &&
          (limit.tracking === "check-in") === (habit.limits[0].tracking === "check-in") &&
          (limit.deadline === undefined ||
            limit.deadline === null ||
            (limit.tracking === "check-in" && validClockMinutes(limit.deadline))) &&
          (limit.tracking !== "check-in" || (limit.value === 1 && (limit.periodDays ?? 1) === 1)) &&
          (limit.periodDays === undefined || validPeriod(limit.periodDays)) &&
          (timeGoal
            ? limit.goal === "before-time" &&
              validClockMinutes(limit.value) &&
              (limit.periodDays ?? 1) === 1
            : limit.goal !== "before-time"),
        t("Invalid limit.")
      );
      assert(
        limit.from >= habit.startDate &&
          limit.from > previous &&
          (habit.endDate === null || limit.from <= habit.endDate),
        t("Limit dates are not in order.")
      );
      previous = limit.from;
    }
    assert(
      habit.limits[0].from === habit.startDate,
      t("The first limit must apply from the start of tracking.")
    );
    assert(
      habit.limits.every((l) => l.planned === undefined || typeof l.planned === "boolean"),
      t("Invalid limit plan.")
    );
    assert(
      object(habit.counts) && Object.keys(habit.counts).length <= 100000,
      t("Invalid counter history.")
    );
    for (const [date, count] of Object.entries(habit.counts)) {
      assert(
        validDate(date) &&
          date >= habit.startDate &&
          (habit.endDate === null || date <= habit.endDate) &&
          wholeNumber(count) &&
          (!checkIn || count === 0 || count === 1),
        t("Invalid quantity or event date.")
      );
    }
    assert(
      !(habit.journal !== undefined && habit.legacyJournal !== undefined),
      t("Ambiguous journal archive.")
    );
    for (const field of ["journal", "legacyJournal"]) {
      const journal = habit[field];
      if (journal === undefined) continue;
      assert(object(journal) && Object.keys(journal).length <= 100000, t("Invalid journal."));
      let total = 0;
      for (const [date, day] of Object.entries(journal)) {
        assert(
          validDate(date) &&
            date >= habit.startDate &&
            (!habit.endDate || date <= habit.endDate) &&
            object(day) &&
            wholeNumber(day.baseline) &&
            Array.isArray(day.entries),
          t("Invalid journal date.")
        );
        let value = day.baseline;
        for (const entry of day.entries) {
          total++;
          assert(
            object(entry) &&
              Number.isInteger(entry.delta) &&
              entry.delta !== 0 &&
              Math.abs(entry.delta) <= MAX_VALUE &&
              ["set", "add", "subtract"].includes(entry.kind) &&
              validTime(entry.time) &&
              (entry.note === undefined ||
                (typeof entry.note === "string" && entry.note.length <= 500)) &&
              (entry.kind !== "add" || entry.delta > 0) &&
              (entry.kind !== "subtract" || entry.delta < 0) &&
              (entry.kind === "add" || entry.time === null),
            t("Invalid journal entry.")
          );
          value += entry.delta;
          assert(wholeNumber(value), t("The journal produces an invalid quantity."));
        }
        if (field === "journal")
          assert(
            value === (habit.counts[date] ?? 0),
            t("The journal does not match the daily quantity.")
          );
      }
      assert(total <= 20000, t("Too many journal entries (maximum 20,000 per habit)."));
    }
  }
  return state;
}

export function parseState(raw) {
  assert(typeof raw === "string", t("Stored data must be a JSON string."));
  assert(raw.length <= MAX_STORAGE_CHARACTERS, t("File too large (maximum 4 million characters)."));
  return validateState(JSON.parse(raw));
}

export function encodeState(state) {
  const raw = JSON.stringify(validateState(state));
  assert(raw.length <= MAX_STORAGE_CHARACTERS, t("File too large (maximum 4 million characters)."));
  return raw;
}

export function parseBackup(raw) {
  assert(typeof raw === "string", t("Stored data must be a JSON string."));
  assert(raw.length <= MAX_BACKUP_BYTES, t("Backup too large. Maximum: 12 MB."));
  const state = JSON.parse(raw);
  encodeState(state);
  return state;
}

export function validPeriod(days) {
  return Number.isInteger(days) && days >= 1 && days <= 366;
}
export function ruleForDate(habit, date) {
  let left = 0,
    right = habit.limits.length - 1;
  if (habit.limits[0].from > date) return null;
  while (left < right) {
    const middle = Math.ceil((left + right) / 2);
    if (habit.limits[middle].from <= date) left = middle;
    else right = middle - 1;
  }
  return habit.limits[left];
}
export function limitForDate(habit, date) {
  return ruleForDate(habit, date)?.value ?? null;
}
export function periodDaysForDate(habit, date) {
  return ruleForDate(habit, date)?.periodDays ?? 1;
}
function dayIndex(date) {
  return Date.parse(date + "T00:00:00Z") / 86400000;
}
export function dayResult(habit, date, today) {
  assert(validDate(date) && validDate(today), t("Invalid date."));
  const counts = countsOf(habit);
  const count = counts[date] ?? 0,
    limit = limitForDate(habit, date),
    goal = goalForDate(habit, date),
    periodDays = periodDaysForDate(habit, date);
  const fromIndex = Math.max(dayIndex(habit.startDate), dayIndex(date) - periodDays + 1);
  const periodFrom = new Date(fromIndex * 86400000).toISOString().slice(0, 10);
  const periodCount =
    periodDays === 1
      ? count
      : Object.entries(counts).reduce(
          (sum, [day, value]) => sum + (day >= periodFrom && day <= date ? value : 0),
          0
        );
  const scheduled = assessedDays(habit, date, date) > 0;
  const recorded = Object.hasOwn(counts, date);
  const values = {
    count,
    limit,
    goal,
    periodDays,
    periodCount,
    periodFrom,
    scheduled,
    ...(isCheckIn(habit)
      ? { recorded, tracking: "check-in", deadline: deadlineForDate(habit, date) }
      : {})
  };
  if (date > today) return { ...values, kind: "future", editable: false };
  if (date < habit.startDate || (habit.endDate !== null && date > habit.endDate))
    return { ...values, kind: "inactive", editable: false };
  if (!scheduled)
    return {
      ...values,
      kind: "rest",
      editable: true,
      readOnly: !!scheduleForDate(habit, date)?.repeatId
    };
  const within =
    (!isCheckIn(habit) || recorded) &&
    withinGoal(goal, periodCount, limit, ruleForDate(habit, date)?.tracking);
  return {
    ...values,
    kind: date === today ? (within ? "today-good" : "today-bad") : within ? "success" : "failure",
    editable: true,
    readOnly: !!scheduleForDate(habit, date)?.repeatId
  };
}
// Sweep the contribution interval of each recorded amount, rather than every calendar day.
function periodSpans(habit, from, to, visit) {
  if (from > to) return;
  const first = dayIndex(from),
    last = dayIndex(to);
  const events = Object.entries(countsOf(habit))
    .filter(([, value]) => value > 0)
    .map(([date, value]) => [dayIndex(date), value])
    .sort((a, b) => a[0] - b[0]);
  for (let index = 0; index < habit.limits.length; index++) {
    const rule = habit.limits[index],
      days = rule.periodDays ?? 1;
    const lo = Math.max(first, dayIndex(rule.from));
    const hi = Math.min(
      last,
      index + 1 < habit.limits.length ? dayIndex(habit.limits[index + 1].from) - 1 : last
    );
    if (lo > hi) continue;
    const changes = new Map();
    for (const [day, value] of events) {
      if (day > hi) break;
      if (day + days - 1 < lo) continue;
      const start = Math.max(lo, day),
        end = Math.min(hi, day + days - 1) + 1;
      changes.set(start, (changes.get(start) ?? 0) + value);
      changes.set(end, (changes.get(end) ?? 0) - value);
    }
    let total = 0,
      previous = lo;
    for (const [day, delta] of [...changes].sort((a, b) => a[0] - b[0])) {
      if (day > previous) visit(rule, total, indexDate(previous), indexDate(day - 1));
      total += delta;
      previous = day;
    }
    if (previous <= hi) visit(rule, total, indexDate(previous), indexDate(hi));
  }
}
function withinGoal(goal, value, limit, tracking) {
  if (tracking === "check-in" || goal === "before-time") return value === 1;
  return goal === "at-least" ? value >= limit : value <= limit;
}
function idealThreshold(goal, limit, zones) {
  if (goal === "before-time") return limit;
  return (goal === "at-least" ? Math.max : Math.min)(zones?.idealMax ?? limit, limit);
}
function failedDayCount(habit, from, to) {
  let exceeded = 0;
  periodSpans(habit, from, to, (rule, total, start, end) => {
    if (!withinGoal(rule.goal, total, rule.value, rule.tracking))
      exceeded += assessedDays(habit, start, end);
  });
  return exceeded;
}

// Rest days preserve the series; only completed, assessed days contribute.
// Sweep constant rolling totals so sparse, multi-year histories do not need a daily scan.
function streakMetrics(habit, date, today) {
  assert(validDate(date) && validDate(today), t("Invalid date."));
  const end = indexDate(
    Math.min(dayIndex(date), dayIndex(today) - 1, dayIndex(habit.endDate ?? date))
  );
  const result = { days: 0, idealDays: 0, kind: "empty", bestDays: 0, previousBest: 0 };
  periodSpans(habit, habit.startDate, end, (rule, total, start, finish) => {
    const days = assessedDays(habit, start, finish);
    if (!days) return;
    if (!withinGoal(rule.goal, total, rule.value, rule.tracking)) {
      result.previousBest = Math.max(result.previousBest, result.days);
      result.days = result.idealDays = 0;
      result.kind = "broken";
      return;
    }
    result.kind = "active";
    result.days += days;
    result.bestDays = Math.max(result.bestDays, result.days);
    if (
      habit.zones?.enabled !== false &&
      withinGoal(
        rule.goal,
        total,
        idealThreshold(rule.goal, rule.value, habit.zones),
        rule.tracking
      )
    )
      result.idealDays += days;
  });
  return result;
}

export function habitStreak(habit, date, today) {
  const { days, idealDays, kind } = streakMetrics(habit, date, today);
  return { days, idealDays, kind };
}

export function habitProgress(habit, date, today) {
  const { previousBest, ...progress } = streakMetrics(habit, date, today);
  const milestones = [7, 14, 30];
  const nextGoal =
    milestones.find((day) => day > progress.days) ?? (Math.floor(progress.days / 30) + 1) * 30;
  return {
    ...progress,
    isRecord: previousBest > 0 && progress.days > previousBest,
    nextGoal,
    remaining: nextGoal - progress.days,
    achievements: milestones.map((days) => ({ days, earned: progress.bestDays >= days }))
  };
}

function copy(state) {
  return JSON.parse(JSON.stringify(state));
}
function find(state, id) {
  const habit = state.habits.find((h) => h.id === id);
  assert(habit, t("This habit no longer exists. Refresh the view."));
  return habit;
}
function editable(habit, date, today) {
  assert(dayResult(habit, date, today).editable, t("This habit is not tracked on this date."));
}
function finish(state) {
  return validateState(state);
}

export function createHabit(state, input, today, id) {
  checkName(input.name);
  assert(
    input.tracking === undefined || ["quantity", "check-in"].includes(input.tracking),
    t("Choose a tracking method.")
  );
  assert(
    input.goal === undefined || validGoal(input.goal),
    t("Choose a goal type: at most, at least or by time.")
  );
  assert(
    validDate(input.startDate) && input.startDate <= today,
    t("The start date cannot be later than today.")
  );
  assert(
    wholeNumber(input.limit) && wholeNumber(input.initialCount),
    t("The limit and quantity must be whole numbers from 0 to ") + MAX_VALUE + "."
  );
  const next = copy(state);
  next.habits.push({
    id,
    name: input.name.trim(),
    unit: input.unit === undefined ? "times" : input.unit.trim(),
    step: input.step ?? 1,
    startDate: input.startDate,
    endDate: null,
    limits: [
      {
        from: input.startDate,
        value: input.limit,
        ...(input.goal === undefined ? {} : { goal: input.goal }),
        ...(input.tracking === "check-in"
          ? { tracking: "check-in", deadline: input.deadline ?? null }
          : {}),
        ...(input.periodDays === undefined || input.periodDays === 1
          ? {}
          : { periodDays: input.periodDays })
      }
    ],
    counts:
      input.initialCount || (input.goal === "before-time" && input.recorded === true)
        ? { [today]: input.initialCount }
        : {}
  });
  if (input.reflectionTask !== undefined) next.habits.at(-1).reflectionTask = input.reflectionTask;
  if (input.zones !== undefined) next.habits.at(-1).zones = input.zones;
  if (input.emoji !== undefined) next.habits.at(-1).emoji = input.emoji;
  return finish(next);
}

export function setCount(state, id, date, count, today) {
  assert(wholeNumber(count), t("The quantity must be a whole number from 0 to ") + MAX_VALUE + ".");
  const next = copy(state),
    habit = find(next, id);
  editable(habit, date, today);
  assert(
    !scheduleForDate(habit, date)?.repeatId,
    t("Complete or reopen the linked task to change this value.")
  );
  assert(
    !isCheckIn(habit) || count === 0 || count === 1,
    t("Choose Done or Missed for a time goal.")
  );
  const current = dayResult(habit, date, today).count;
  if (current !== count && habit.journal !== undefined) {
    // Preserve old details as a read-only backup; new changes only store daily totals.
    habit.legacyJournal = habit.journal;
    delete habit.journal;
  }
  const automatic = Object.values(habit.taskCompletions ?? {}).filter(
    (e) => e.date === date
  ).length;
  assert(count >= automatic, t("Change automatic entries in the linked task."));
  habit.counts[date] = count - automatic;
  return finish(next);
}

export function setCompletion(state, id, date, done, today) {
  assert(done === null || typeof done === "boolean", t("Choose Done or Missed for a time goal."));
  const habit = find(state, id);
  editable(habit, date, today);
  assert(isCheckIn(habit), t("Choose a check-in habit."));
  if (done !== null) return setCount(state, id, date, done ? 1 : 0, today);
  const next = copy(state);
  delete find(next, id).counts[date];
  return finish(next);
}

export function applyCountInput(state, id, date, value, mode, today) {
  assert(wholeNumber(value), t("Enter a whole number from 0 to ") + MAX_VALUE + ".");
  assert(["set", "add", "subtract"].includes(mode), t("Choose a quantity action."));
  const habit = find(state, id);
  editable(habit, date, today);
  assert(
    !isCheckIn(habit) || mode === "set",
    t("Mark Done or Missed instead of changing a quantity.")
  );
  const current = dayResult(habit, date, today).count;
  const next = mode === "set" ? value : mode === "add" ? current + value : current - value;
  assert(
    wholeNumber(next),
    mode === "subtract"
      ? t("You cannot subtract more than the daily quantity.")
      : t("The resulting quantity must not exceed ") + MAX_VALUE + "."
  );
  return setCount(state, id, date, next, today);
}

export function changeCount(state, id, date, delta, today) {
  assert(delta === 1 || delta === -1, t("The counter direction must be +1 or −1."));
  const habit = find(state, id);
  editable(habit, date, today);
  assert(!isCheckIn(habit), t("Mark Done or Missed instead of changing a quantity."));
  const count = dayResult(habit, date, today).count;
  return setCount(state, id, date, Math.max(0, count + delta * stepOf(habit)), today);
}

export function editHabit(state, id, input, today) {
  checkName(input.name);
  assert(
    input.goal === undefined || validGoal(input.goal),
    t("Choose a goal type: at most, at least or by time.")
  );
  assert(wholeNumber(input.limit), t("The limit must be a non-negative whole number."));
  const next = copy(state),
    habit = find(next, id);
  assert(
    validDate(input.from) &&
      input.from <= today &&
      (habit.endDate === null || input.from <= habit.endDate),
    t("The limit date cannot be later than the last tracked day.")
  );
  if (habit.limits[0].goal === "before-time" && input.tracking === "check-in") {
    habit.limits = habit.limits.map((rule) => ({
      ...rule,
      goal: "at-least",
      tracking: "check-in",
      deadline: rule.value,
      value: 1
    }));
  }
  // Extending tracking adds an earlier segment; existing limits and counts remain intact.
  if (input.from < habit.startDate) habit.startDate = input.from;
  habit.name = input.name.trim();
  if (input.reflectionTask !== undefined) habit.reflectionTask = input.reflectionTask;
  if (input.emoji !== undefined) habit.emoji = input.emoji;
  if (input.unit !== undefined) habit.unit = input.unit.trim();
  if (input.step !== undefined) habit.step = input.step;
  if (input.zones !== undefined) habit.zones = input.zones;
  const existingRule = ruleForDate(habit, input.from) ?? habit.limits[0];
  assert(
    input.tracking === undefined || ["quantity", "check-in"].includes(input.tracking),
    t("Choose a tracking method.")
  );
  assert(
    input.tracking === undefined || (input.tracking === "check-in") === isCheckIn(habit),
    t("Create a separate habit to change the tracking method.")
  );
  const tracking = existingRule.tracking;
  const deadline = input.deadline === undefined ? existingRule.deadline : input.deadline;
  const periodDays = input.periodDays ?? existingRule.periodDays ?? 1;
  const goal = input.goal ?? existingRule.goal ?? "at-most";
  assert(
    (goal === "before-time") === (habit.limits[0].goal === "before-time"),
    t("Create a separate habit to switch between quantities and time.")
  );
  assert(validGoal(goal), t("Choose a goal type: at most, at least or by time."));
  assert(validPeriod(periodDays), t("The limit period must be 1 to 366 days."));
  if (
    limitForDate(habit, input.from) !== input.limit ||
    periodDaysForDate(habit, input.from) !== periodDays ||
    goalForDate(habit, input.from) !== goal ||
    deadline !== existingRule.deadline
  ) {
    habit.limits = habit.limits.filter((l) => l.from !== input.from);
    habit.limits.push({
      from: input.from,
      value: input.limit,
      ...(goal === "at-most" ? {} : { goal }),
      ...(tracking === "check-in" ? { tracking, deadline: deadline ?? null } : {}),
      ...(periodDays === 1 ? {} : { periodDays })
    });
    habit.limits.sort((a, b) => a.from.localeCompare(b.from));
  }
  return finish(next);
}

export function setHabitHidden(state, id, hidden) {
  assert(typeof hidden === "boolean", t(VISIBILITY_ERROR));
  const next = copy(state),
    habit = find(next, id);
  if (hidden) habit.hidden = true;
  else delete habit.hidden;
  return finish(next);
}

export function habitMatchesFilter(habit, filter, includeHidden = false) {
  if (filter === "all") return true;
  if (filter === "archived") return habit.endDate !== null;
  if (filter === "active" && includeHidden) return habit.endDate === null;
  return habit.endDate === null && !!habit.hidden === (filter === "hidden");
}

export function deleteHabit(state, id) {
  const next = copy(state);
  find(next, id);
  next.habits = next.habits.filter((h) => h.id !== id);
  return finish(next);
}

export function archiveHabit(state, id, today) {
  const next = copy(state),
    habit = find(next, id);
  assert(habit.endDate === null, t("This habit is already archived."));
  assert(
    today >= habit.startDate && !Object.keys(habit.counts).some((d) => d > today),
    t("You cannot archive before the recorded history.")
  );
  habit.limits = habit.limits.filter((l) => l.from <= today);
  habit.endDate = today;
  return finish(next);
}

export function periodRange(preset, today) {
  assert(validDate(today), t("Invalid date."));
  const clamp = (date) => (date < "1900-01-01" ? "1900-01-01" : date);
  const shift = (days) => {
    const d = new Date(today + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return clamp(d.toISOString().slice(0, 10));
  };
  let from;
  switch (preset) {
    case "7d":
      from = shift(-6);
      break;
    case "30d":
      from = shift(-29);
      break;
    case "week":
      from = shift(-((new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7));
      break;
    case "month":
      from = today.slice(0, 8) + "01";
      break;
    case "year": {
      if (today.slice(0, 4) === "1900") {
        from = "1900-01-01";
        break;
      }
      let anniversary = String(Number(today.slice(0, 4)) - 1) + today.slice(4);
      if (!validDate(anniversary)) anniversary = anniversary.slice(0, 8) + "28";
      from = addDays(anniversary, 1);
      break;
    }
    case "current-year":
      from = today.slice(0, 4) + "-01-01";
      break;
    default:
      throw new Error(t("Unknown period."));
  }
  return { from, to: today };
}

export function statistics(state, from, to, today, filter = "all", includeHidden = true) {
  assert(validDate(from) && validDate(to) && validDate(today), t("Choose valid dates."));
  assert(from <= to, t("The start of the period cannot be after its end."));
  assert(to <= today, t("The end of the period cannot be later than today."));
  assert(["all", "active", "archived"].includes(filter), t("Unknown habit filter."));
  // Missing records are zero: a success for limits, a failure for positive targets.
  // Count calendar days arithmetically and visit only recorded events, even for a long custom range.
  const rows = state.habits
    .filter(
      (h) =>
        (includeHidden || !h.hidden || h.endDate !== null) &&
        (filter === "all" || (filter === "active" ? h.endDate === null : h.endDate !== null))
    )
    .map((habit) => {
      const start = habit.startDate > from ? habit.startDate : from;
      const end = habit.endDate && habit.endDate < to ? habit.endDate : to;
      const inRange = end >= start;
      const trackedDays = inRange ? assessedDays(habit, start, end) : 0;
      const includesToday =
        trackedDays > 0 && end === today && assessedDays(habit, today, today) > 0;
      const completedDays = trackedDays - (includesToday ? 1 : 0);
      let events = inRange ? 0 : null,
        exceededDays = 0;
      if (inRange)
        for (const [date, count] of Object.entries(countsOf(habit))) {
          if (date < start || date > end) continue;
          events += count;
        }
      if (completedDays)
        exceededDays = failedDayCount(habit, start, includesToday ? addDays(today, -1) : end);
      const manual = habit.limits[0].tracking === "check-in";
      const marks = manual
        ? Object.entries(habit.counts).filter(
            ([date]) =>
              date >= start && date <= end && date < today && assessedDays(habit, date, date) > 0
          )
        : [];
      const unmarkedDays = manual ? completedDays - marks.length : 0;
      if (manual) exceededDays = marks.filter(([, value]) => value === 0).length;
      const successDays = completedDays - exceededDays - unmarkedDays;
      const current = includesToday ? dayResult(habit, today, today) : null;
      return {
        id: habit.id,
        name: habit.name,
        ...(habit.emoji ? { emoji: habit.emoji } : {}),
        unit: unitOf(habit),
        ...(goalForDate(habit, habit.startDate) === "before-time" ? { goal: "before-time" } : {}),
        ...(manual ? { tracking: "check-in", unmarkedDays } : {}),
        archived: habit.endDate !== null,
        from: trackedDays ? start : null,
        to: trackedDays ? end : null,
        trackedDays,
        completedDays,
        events,
        exceededDays,
        successDays,
        successRate:
          completedDays - unmarkedDays ? successDays / (completedDays - unmarkedDays) : null,
        average: trackedDays ? events / trackedDays : null,
        today: current
          ? {
              count: current.count,
              limit: current.limit,
              within: current.kind === "today-good",
              ...(current.goal !== "at-most" ? { goal: current.goal } : {}),
              ...(current.periodDays > 1
                ? { periodDays: current.periodDays, periodCount: current.periodCount }
                : {})
            }
          : null
      };
    });
  const total = rows.reduce(
    (sum, row) => {
      sum.trackedDays += row.trackedDays;
      sum.completedDays += row.completedDays;
      sum.events += row.events ?? 0;
      sum.exceededDays += row.exceededDays;
      sum.successDays += row.successDays;
      return sum;
    },
    { trackedDays: 0, completedDays: 0, events: 0, exceededDays: 0, successDays: 0 }
  );
  const amounts = new Map();
  for (const row of rows)
    if (row.events !== null) amounts.set(row.unit, (amounts.get(row.unit) ?? 0) + row.events);
  return {
    from,
    to,
    rows,
    total: {
      ...total,
      events: amounts.size === 1 ? total.events : null,
      amounts: [...amounts].map(([unit, value]) => ({ unit, value })),
      successRate:
        total.completedDays - rows.reduce((sum, row) => sum + (row.unmarkedDays ?? 0), 0)
          ? total.successDays /
            (total.completedDays - rows.reduce((sum, row) => sum + (row.unmarkedDays ?? 0), 0))
          : null
    }
  };
}

export function validTime(value) {
  return value === null || (typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value));
}
export function calendarResult(habit, date, today) {
  const result = dayResult(habit, date, today),
    zones = habit.zones;
  // The allowance is always the recorded rule. Colour settings cannot permit an excess.
  const positive = result.goal === "at-least";
  const idealMax = idealThreshold(result.goal, result.limit, zones),
    yellowEnabled = zones?.yellowEnabled ?? zones?.yellowMax != null,
    yellowMax = yellowEnabled ? result.limit : null;
  let zone =
    result.kind === "rest" || (result.kind === "future" && !result.scheduled)
      ? "rest"
      : result.editable
        ? "neutral"
        : result.kind;
  if (result.editable && result.kind !== "rest" && zones?.enabled !== false) {
    zone =
      result.tracking === "check-in"
        ? !result.recorded
          ? "neutral"
          : result.count === 1
            ? "ideal"
            : "red"
        : (positive ? result.periodCount < result.limit : result.periodCount > result.limit)
          ? "red"
          : (positive ? result.periodCount >= idealMax : result.periodCount <= idealMax)
            ? "ideal"
            : yellowEnabled
              ? "warning"
              : "neutral";
  }
  return { ...result, zone, idealMax, yellowMax };
}
export function monthCalendar(habit, month, today) {
  assert(
    typeof month === "string" && /^\d{4}-\d{2}$/.test(month) && validDate(month + "-01"),
    t("Invalid month.")
  );
  const first = new Date(month + "-01T12:00:00Z");
  const offset = (first.getUTCDay() + 6) % 7;
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  const days = Array.from({ length: last.getUTCDate() }, (_, index) => {
    const date = month + "-" + String(index + 1).padStart(2, "0");
    return { date, ...calendarResult(habit, date, today) };
  });
  const cells = [...Array(offset).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  return { month, days, cells };
}
export function shiftMonth(month, delta) {
  assert(validDate(month + "-01") && Number.isInteger(delta), t("Invalid month."));
  const date = new Date(month + "-01T12:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + delta);
  const result = date.toISOString().slice(0, 7);
  assert(validDate(result + "-01"), t("Month outside the supported range."));
  return result;
}
export function reductionPreview(habit, input, today) {
  assert(
    habit.limits[0].tracking !== "check-in",
    t("Change the check-in condition in habit settings.")
  );
  assert(habit.endDate === null, t("You cannot plan a reduction for an archived habit."));
  assert(
    validDate(input.first) && input.first > today && input.first >= habit.startDate,
    t("The first reduction date must be after today.")
  );
  assert(
    ["at-most", "before-time"].includes(goalForDate(habit, addDays(input.first, -1))),
    t("Reduction plans are available for at-most limits.")
  );
  assert(
    Number.isInteger(input.everyDays) && input.everyDays >= 1 && input.everyDays <= 366,
    t("The interval must be 1 to 366 days.")
  );
  assert(
    validStep(input.decrease) && wholeNumber(input.target),
    t("Check the reduction step and target limit.")
  );
  const goal = goalForDate(habit, addDays(input.first, -1));
  assert(
    goal !== "before-time" || validClockMinutes(input.target),
    t("Enter a time from 00:00 to 23:59.")
  );
  let value = limitForDate(habit, addDays(input.first, -1));
  const periodDays = periodDaysForDate(habit, addDays(input.first, -1));
  assert(
    value !== null && input.target < value,
    t("The target limit must be lower than the starting limit.")
  );
  const count = Math.ceil((value - input.target) / input.decrease);
  assert(count <= 120, t("Plans are limited to 120 changes. Increase the reduction step."));
  return Array.from({ length: count }, (_, index) => {
    value = Math.max(input.target, value - input.decrease);
    return {
      from: addDays(input.first, index * input.everyDays),
      value,
      planned: true,
      ...(goal === "before-time" ? { goal } : {}),
      ...(periodDays === 1 ? {} : { periodDays })
    };
  });
}
export function scheduleReduction(state, id, input, today) {
  const next = copy(state),
    habit = find(next, id),
    stages = reductionPreview(habit, input, today);
  habit.limits = [...habit.limits.filter((limit) => limit.from < input.first), ...stages];
  return finish(next);
}
export function cancelReduction(state, id, today) {
  const next = copy(state),
    habit = find(next, id);
  habit.limits = habit.limits.filter((limit) => !limit.planned || limit.from <= today);
  return finish(next);
}

export function frequencyPreview(habit, stages, today) {
  assert(!isCheckIn(habit), t("Change the check-in condition in habit settings."));
  assert(habit.endDate === null, t("You cannot plan a reduction for an archived habit."));
  assert(
    Array.isArray(stages) && stages.length > 0 && stages.length <= 120,
    t("Add 1 to 120 stages.")
  );
  let previousDate = today,
    previous = null;
  return stages.map((stage) => {
    assert(
      validDate(stage.from) && stage.from > previousDate && stage.from >= habit.startDate,
      t("Stage dates must be in order and after today.")
    );
    assert(
      wholeNumber(stage.value) && validPeriod(stage.periodDays),
      t("Check the quantity and period of each stage (1–366 days).")
    );
    if (!previous) previous = ruleForDate(habit, addDays(stage.from, -1));
    assert(
      (previous?.goal ?? "at-most") === "at-most",
      t("Reduction plans are available for at-most limits.")
    );
    assert(
      previous && stage.value * (previous.periodDays ?? 1) < previous.value * stage.periodDays,
      t("Each stage must reduce the frequency, for example: 1 per 2 days → 1 per 7 days.")
    );
    previousDate = stage.from;
    previous = stage;
    return { from: stage.from, value: stage.value, periodDays: stage.periodDays, planned: true };
  });
}
export function scheduleFrequency(state, id, stages, today) {
  const next = copy(state),
    habit = find(next, id),
    plan = frequencyPreview(habit, stages, today);
  habit.limits = [...habit.limits.filter((limit) => limit.from < plan[0].from), ...plan];
  return finish(next);
}

// Task-derived quantities are separate from manual totals so undo never removes manual history.
export function countsOf(habit) {
  if (!habit.taskCompletions) return habit.counts;
  const counts = { ...habit.counts };
  for (const entry of Object.values(habit.taskCompletions))
    counts[entry.date] = (counts[entry.date] ?? 0) + 1;
  return counts;
}
export function scheduleForDate(habit, date) {
  return habit.taskSchedules?.findLast((s) => s.from <= date) ?? null;
}
function indexDate(index) {
  return new Date(index * 86400000).toISOString().slice(0, 10);
}
export function assessedDays(habit, from, to) {
  if (from > to) return 0;
  let total = 0;
  const history = [{ from: habit.startDate, repeatId: null }, ...(habit.taskSchedules ?? [])];
  for (let i = 0; i < history.length; i++) {
    const schedule = history[i];
    const lo = Math.max(dayIndex(from), dayIndex(schedule.from));
    const hi = Math.min(
      dayIndex(to),
      i + 1 < history.length ? dayIndex(history[i + 1].from) - 1 : dayIndex(to)
    );
    if (lo > hi) continue;
    if (!schedule.repeatId) {
      total += hi - lo + 1;
      continue;
    }
    if (schedule.paused) continue;
    const anchor = dayIndex(schedule.anchor);
    const start = Math.max(lo, anchor);
    const end = Math.min(hi, schedule.until ? dayIndex(schedule.until) : hi);
    const first = anchor + Math.ceil((start - anchor) / schedule.every) * schedule.every;
    if (first <= end) total += Math.floor((end - first) / schedule.every) + 1;
  }
  return total;
}
function validateTaskHistory(habit) {
  const history = habit.taskSchedules;
  const idOK = (id) => typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
  assert(
    history === undefined || (Array.isArray(history) && history.length <= 10000),
    t("Invalid task link.")
  );
  let previous = "";
  for (const s of history ?? []) {
    assert(
      object(s) &&
        validDate(s.from) &&
        s.from >= habit.startDate &&
        s.from > previous &&
        (!habit.endDate || s.from <= habit.endDate),
      t("Invalid task link.")
    );
    previous = s.from;
    assert(
      s.repeatId === null ||
        (idOK(s.repeatId) &&
          validDate(s.anchor) &&
          validPeriod(s.every) &&
          typeof s.paused === "boolean" &&
          typeof s.title === "string" &&
          s.title.length <= 500 &&
          validTime(s.time) &&
          (s.until === null || validDate(s.until))),
      t("Invalid task link.")
    );
  }
  assert(
    habit.taskCompletions === undefined ||
      (object(habit.taskCompletions) && Object.keys(habit.taskCompletions).length <= 100000),
    t("Invalid task completion history.")
  );
  for (const [id, entry] of Object.entries(habit.taskCompletions ?? {}))
    assert(
      idOK(id) &&
        object(entry) &&
        idOK(entry.repeatId) &&
        validDate(entry.date) &&
        entry.date >= habit.startDate &&
        (!habit.endDate || entry.date <= habit.endDate),
      t("Invalid task completion history.")
    );
  for (const value of Object.values(countsOf(habit)))
    assert(wholeNumber(value), t("Invalid quantity or event date."));
}
export function setTaskSchedule(state, id, schedule, today) {
  assert(!schedule || !isCheckIn(find(state, id)), t("Check-in habits use manual marks."));
  const next = copy(state),
    habit = find(next, id);
  assert(habit.endDate === null, t("Archived habits cannot be linked to tasks."));
  if (schedule) {
    assert(
      goalForDate(habit, today) === "at-least" &&
        limitForDate(habit, today) === 1 &&
        periodDaysForDate(habit, today) === 1 &&
        canonicalUnit(unitOf(habit)) === "times",
      t("Linking requires a positive habit with a minimum of 1 time per day.")
    );
    assert(
      !next.habits.some(
        (h) =>
          h.id !== id &&
          h.endDate === null &&
          scheduleForDate(h, today)?.repeatId === schedule.repeatId
      ),
      t("This series is already linked to another habit.")
    );
  }
  const entry = { ...(schedule ?? { repeatId: null }), from: today };
  habit.taskSchedules = [...(habit.taskSchedules ?? []).filter((s) => s.from < today), entry];
  return finish(next);
}
