/**
 * Pure pricing math for proposal line items.
 *
 * Margin is an *input device*, not a stored field: the stored truth is always
 * `unitCost` + `unitPrice` per item. A margin % is a two-way convenience:
 *   - typing a margin recomputes the price (`priceFromMargin`)
 *   - editing the price re-derives the displayed margin (`marginFromCostPrice`)
 *
 * These helpers are intentionally string-in / number-out where they front the
 * DB (numeric columns arrive as strings) and are unit-tested in isolation so the
 * conversion never drifts between the row editor, the apply-to-all action, and
 * the totals recompute.
 */

/** Round to 2 decimal places (money precision). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Parse a numeric-column string (or user input) to a finite number, else 0. */
export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Sell price for a given net cost and margin %.
 * `unitPrice = round2(unitCost × (1 + margin/100))`.
 */
export function priceFromMargin(unitCost: number, marginPercent: number): number {
  return round2(unitCost * (1 + marginPercent / 100));
}

/**
 * Derived margin % from a cost/price pair: `(price / cost − 1) × 100`.
 * Returns `null` when cost is 0 (margin is undefined — callers show "—").
 */
export function marginFromCostPrice(
  unitCost: number,
  unitPrice: number
): number | null {
  if (unitCost === 0) return null;
  return (unitPrice / unitCost - 1) * 100;
}

/** Line extension: unit value × quantity. */
export function lineTotal(unit: number, quantity: number): number {
  return unit * quantity;
}
