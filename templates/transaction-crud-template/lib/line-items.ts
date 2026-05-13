/**
 * Shared types and helpers for line-item-driven transactions.
 *
 * Independent of any specific entity — drop into lib/ unchanged and reuse
 * across invoices, sales receipts, pickup orders, etc.
 */

/** A line-item row in a draft form (string fields, with internal _id and lookup state). */
export interface LineItemDraft {
  _id: string;
  articleNumber: string;
  name: string;
  quantity: string;
  price: string;
  /** Original per-unit price (before any bundle deal). */
  regularPrice?: string;
  /** Bundle quantity for "X for Y" deals. */
  bundleQuantity?: string;
  /** Bundle price for "X for Y" deals. */
  bundlePrice?: string;
  lookingUp: boolean;
}

/** A line-item row as stored in the JSON column. */
export interface LineItem {
  articleNumber?: string;
  name?: string;
  quantity: number;
  price: number;
  bundleQuantity?: number;
  bundlePrice?: number;
}

/** Build an empty draft row. */
export function newLineItem(): LineItemDraft {
  return {
    _id: crypto.randomUUID(),
    articleNumber: "",
    name: "",
    quantity: "1",
    price: "",
    lookingUp: false,
  };
}

/** Parse a JSON column safely. Returns [] on any failure. */
export function parseLineItems(json?: string | null): LineItem[] {
  try {
    const p = JSON.parse(json ?? "[]");
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

/** Sum the line totals from draft rows. */
export function calculateDraftTotal(items: LineItemDraft[]): number {
  return items.reduce(
    (sum, v) => sum + parseFloat(v.quantity || "0") * parseFloat(v.price || "0"),
    0,
  );
}

/** Format a number as currency. Defaults to Swedish kronor. */
export function formatCurrency(
  amount: number,
  locale = "sv-SE",
  suffix = " kr",
): string {
  return amount.toLocaleString(locale) + suffix;
}
