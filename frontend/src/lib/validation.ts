/** "12.50" -> 1250. Returns null if invalid (negative, letters, >2 decimals, empty). */
export function parsePriceToCents(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100); // round avoids 19.99 * 100 = 1998.99...
}

/** "10" -> 10. Returns null unless it's a whole number >= 0. */
export function parseInventory(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return null;
  return Number(s);
}

export const PRICE_ERROR = "Enter a price of 0 or more (e.g. 12.50)";
export const INVENTORY_ERROR = "Enter a whole number of 0 or more";

/** Reads the backend's { error, fields } body, tolerating non-JSON failures. */
export async function readApiError(
  res: Response
): Promise<{ message: string; fields: Record<string, string> }> {
  const body = await res.json().catch(() => null);
  return {
    message: body?.error ?? `Request failed (${res.status})`,
    fields: body?.fields ?? {},
  };
}