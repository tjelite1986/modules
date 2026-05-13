/**
 * Compute the effective per-unit price when a bundle deal applies.
 *
 * Example: regular price 39, bundle "3 for 99". Buying 4 units:
 *   1 bundle (3 units * 99) + 1 leftover unit (39) = 138
 *   per-unit = 138 / 4 = 34.50
 *
 * Returns the per-unit price as a fixed-2 string. Empty string when
 * no regular price is set and no bundle is applicable.
 */
export function calculateEffectivePrice(
  quantity: number,
  regularPrice: number | null,
  bundleQuantity: number | null,
  bundlePrice: number | null,
): string {
  if (!bundleQuantity || !bundlePrice || quantity <= 0) {
    return regularPrice != null ? Number(regularPrice).toFixed(2) : "";
  }
  const sets = Math.floor(quantity / bundleQuantity);
  const remainder = quantity % bundleQuantity;
  const total = sets * bundlePrice + remainder * (regularPrice ?? 0);
  return (total / quantity).toFixed(2);
}

/**
 * Compute the line total (price * quantity) given the effective unit price
 * already accounting for bundle deals.
 */
export function calculateLineTotal(
  quantity: number,
  regularPrice: number | null,
  bundleQuantity: number | null,
  bundlePrice: number | null,
): number {
  if (!bundleQuantity || !bundlePrice || quantity <= 0) {
    return (regularPrice ?? 0) * quantity;
  }
  const sets = Math.floor(quantity / bundleQuantity);
  const remainder = quantity % bundleQuantity;
  return sets * bundlePrice + remainder * (regularPrice ?? 0);
}
