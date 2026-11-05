import { t } from "../i18n/index.js";
import { canonicalUnit } from "../i18n/units.js";

export const unitChoice = (unit) => canonicalUnit(unit) ?? "custom";
export function unitText(unit) {
  const choice = unitChoice(unit);
  return choice === "custom" ? unit : t(choice);
}
export function localizedAmounts(items) {
  const totals = new Map();
  for (const { unit, value } of items) {
    const label = unitText(unit);
    totals.set(label, (totals.get(label) ?? 0) + value);
  }
  return [...totals].map(([unit, value]) => ({ unit, value }));
}
export function selectedUnit(choice, originalUnit, custom) {
  if (choice === "custom") return custom.trim();
  // A locale switch or metadata edit must preserve the original stored unit.
  if (unitChoice(originalUnit) === choice) return originalUnit;
  return choice;
}
