/** Quantité vendable. PostgreSQL expose aussi cette expression en colonne générée. */
export function availableQuantity(variant: {
  stockQuantity: number;
  reservedQuantity: number;
}): number {
  return Math.max(0, variant.stockQuantity - variant.reservedQuantity);
}
