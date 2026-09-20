import { availableQuantity } from '@/lib/inventory/availability';
import { MAX_CART_ITEM_QUANTITY } from './constants';
import type { CartIssue } from './types';
export class CartError extends Error {}
export function validateId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new CartError('Article introuvable.');
  return value;
}
export function validateQuantity(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_CART_ITEM_QUANTITY
  )
    throw new CartError(
      `Choisissez une quantité entière entre 1 et ${MAX_CART_ITEM_QUANTITY}. Pour retirer un article, utilisez « Supprimer ».`,
    );
  return value;
}
export type ValidatableVariant = {
  isActive: boolean;
  stockQuantity: number;
  reservedQuantity: number;
  product: {
    status: string;
    category: { isActive: boolean };
    tcgSet: { isActive: boolean } | null;
  };
};
export function itemIssue(
  variant: ValidatableVariant | null,
  quantity: number,
): CartIssue | null {
  if (
    !variant ||
    !variant.isActive ||
    variant.product.status !== 'ACTIVE' ||
    !variant.product.category.isActive ||
    variant.product.tcgSet?.isActive === false
  )
    return 'UNAVAILABLE';
  if (availableQuantity(variant) < 1) return 'OUT_OF_STOCK';
  if (quantity > Math.min(availableQuantity(variant), MAX_CART_ITEM_QUANTITY))
    return 'INSUFFICIENT_STOCK';
  return null;
}
export function assertPurchasable(
  variant: ValidatableVariant | null,
  quantity: number,
) {
  const issue = itemIssue(variant, quantity);
  if (issue === 'UNAVAILABLE')
    throw new CartError('Ce produit n’est plus disponible.');
  if (issue === 'OUT_OF_STOCK')
    throw new CartError(
      'Ce produit est en rupture de stock ou son quota de précommande est épuisé.',
    );
  if (issue === 'INSUFFICIENT_STOCK')
    throw new CartError(
      `Seulement ${Math.min(availableQuantity(variant!), MAX_CART_ITEM_QUANTITY)} exemplaire(s) peuvent être ajoutés au panier, quantité déjà présente comprise.`,
    );
}
export function validateCart(
  cart: {
    status: string;
    expiresAt: Date;
    items: {
      id: string;
      quantity: number;
      variant: ValidatableVariant | null;
    }[];
  },
  now = new Date(),
) {
  const expired = cart.expiresAt <= now;
  const inactive = cart.status !== 'ACTIVE';
  const issues = cart.items.flatMap((item) => {
    const issue = itemIssue(item.variant, item.quantity);
    return issue ? [{ itemId: item.id, issue }] : [];
  });
  return {
    valid: !expired && !inactive && issues.length === 0,
    expired,
    inactive,
    issues,
  };
}
