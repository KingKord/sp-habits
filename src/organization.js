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
