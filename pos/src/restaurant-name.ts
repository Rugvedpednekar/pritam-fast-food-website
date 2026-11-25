/** Keep the outlet's official business name consistent in stored POS data.
 * Historical bills, employee records, transfers and bonus rows may all contain
 * the obsolete neighborhood-suffixed display name. The physical address is not
 * changed; only an exact match of the old *business name* is normalized.
 */
export const OFFICIAL_RESTAURANT_NAME = "Pritam Fast Food";

const neighborhoodSuffix = /^\s*pritam\s+fast\s+food(?:\s*[·•|:,\-–—(]\s*|\s+)goregaon\s+east(?:\s*,\s*mumbai)?\s*\)?\s*$/i;
const properName = /^\s*pritam\s+fast\s+food\s*$/i;

export function canonicalRestaurantName(name: string): string {
  return neighborhoodSuffix.test(name) || properName.test(name)
    ? OFFICIAL_RESTAURANT_NAME
    : name;
}

/** Mutate an in-memory JSON-compatible snapshot without changing IDs or payroll. */
export function normalizeRestaurantNames(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  let modified = false;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      const normalized = canonicalRestaurantName(item);
      if (normalized !== item) {
        (value as Record<string, unknown>)[key] = normalized;
        modified = true;
      }
    } else if (item && typeof item === "object") {
      if (normalizeRestaurantNames(item)) modified = true;
    }
  }
  return modified;
}
