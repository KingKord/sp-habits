import { t } from "./i18n/index.js";

function requireValue(value, message) {
  if (!value) throw new Error(t(message));
}

export function validateOrganization(state) {
  if (state.habitOrder !== undefined) {
    const ids = new Set(state.habits.map((habit) => habit?.id));
    requireValue(
      Array.isArray(state.habitOrder) &&
        state.habitOrder.length <= state.habits.length &&
        new Set(state.habitOrder).size === state.habitOrder.length &&
        state.habitOrder.every((id) => typeof id === "string" && ids.has(id)),
      "Invalid habit order."
    );
  }
  if (state.groups !== undefined) {
    requireValue(
      Array.isArray(state.groups) && state.groups.length <= 100,
      "Invalid habit groups."
    );
    const ids = new Set(),
      names = new Set();
    for (const group of state.groups) {
      requireValue(
        group &&
          typeof group.id === "string" &&
          /^[a-zA-Z0-9_-]{1,100}$/.test(group.id) &&
          !ids.has(group.id) &&
          validGroupName(group.name) &&
          !names.has(group.name),
        "Invalid habit groups."
      );
      ids.add(group.id);
      names.add(group.name);
    }
  }
  const groupIds = new Set((state.groups ?? []).map((group) => group.id));
  requireValue(
    state.habits.every(
      (habit) =>
        habit?.groupId === undefined ||
        (typeof habit.groupId === "string" && groupIds.has(habit.groupId))
    ),
    "Invalid habit group membership."
  );
  return state;
}

export function orderedHabits(state) {
  const ranks = new Map((state.habitOrder ?? []).map((id, index) => [id, index]));
  return state.habits
    .map((habit, index) => ({ habit, rank: ranks.get(habit.id) ?? ranks.size + index }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ habit }) => habit);
}

export function moveHabit(state, id, neighborId) {
  const order = orderedHabits(state).map((habit) => habit.id);
  const from = order.indexOf(id),
    to = order.indexOf(neighborId);
  requireValue(from >= 0 && to >= 0 && from !== to, "Choose two different habits to reorder.");
  [order[from], order[to]] = [order[to], order[from]];
  return validateOrganization({ ...structuredClone(state), habitOrder: order });
}

export function removeHabitOrganization(state, id) {
  if (state.habitOrder !== undefined)
    state.habitOrder = state.habitOrder.filter((entry) => entry !== id);
}

export function validGroupName(name) {
  return (
    typeof name === "string" && name.trim().length > 0 && name.length <= 80 && !/\p{Cc}/u.test(name)
  );
}

function groupChange(state, action) {
  const next = structuredClone(state);
  action(next);
  return validateOrganization(next);
}

export function createGroup(state, id, name) {
  return groupChange(state, (next) => {
    next.groups ??= [];
    next.groups.push({ id, name: name.trim() });
  });
}

export function renameGroup(state, id, name) {
  return groupChange(state, (next) => {
    const group = next.groups?.find((entry) => entry.id === id);
    requireValue(group, "This group no longer exists.");
    group.name = name.trim();
  });
}

export function removeGroup(state, id) {
  return groupChange(state, (next) => {
    requireValue(
      next.groups?.some((group) => group.id === id),
      "This group no longer exists."
    );
    next.groups = next.groups.filter((group) => group.id !== id);
    for (const habit of next.habits) if (habit.groupId === id) delete habit.groupId;
  });
}

export function moveGroup(state, id, offset) {
  return groupChange(state, (next) => {
    const index = next.groups?.findIndex((group) => group.id === id) ?? -1;
    requireValue(
      index >= 0 && [-1, 1].includes(offset) && next.groups[index + offset],
      "Choose a neighboring group."
    );
    [next.groups[index], next.groups[index + offset]] = [
      next.groups[index + offset],
      next.groups[index]
    ];
  });
}

export function setHabitGroup(state, id, groupId) {
  return groupChange(state, (next) => {
    const habit = next.habits.find((entry) => entry.id === id);
    requireValue(habit, "This habit no longer exists. Refresh the view.");
    if (groupId === null) delete habit.groupId;
    else habit.groupId = groupId;
  });
}

export function groupedHabits(state, habits = orderedHabits(state)) {
  const ranks = new Map((state.groups ?? []).map((group, index) => [group.id, index]));
  return [...habits].sort(
    (a, b) => (ranks.get(a.groupId) ?? ranks.size) - (ranks.get(b.groupId) ?? ranks.size)
  );
}
