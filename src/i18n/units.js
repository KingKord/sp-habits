import aliases from "./unit-aliases.json" with { type: "json" };

// Legacy localized values remain valid storage data; new values use English IDs.
export function canonicalUnit(unit) {
  return (
    Object.entries(aliases).find(([id, legacy]) => id === unit || legacy.includes(unit))?.[0] ??
    null
  );
}
