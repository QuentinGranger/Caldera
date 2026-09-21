import { availableQuantity } from '@/lib/inventory/availability';
import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { getProductVisual } from '@/lib/catalog/images';
import { getAvailability } from '@/lib/catalog/getAvailability';
import { MAX_CART_ITEM_QUANTITY } from './constants';
import { cartTokenHash } from './identity';
import { emptyCart, type CartView } from './types';
import { validateCart } from './validation';

export const cartVariantSelect = {
  id: true,
  sku: true,
  language: true,
  price: true,
  isActive: true,
  stockQuantity: true,
  reservedQuantity: true,
  lowStockThreshold: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      productType: true,
      status: true,
      preorder: true,
      category: { select: { isActive: true } },
      tcgSet: { select: { isActive: true } },
      images: {
        take: 1,
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }],
        select: { url: true, alt: true },
      },
    },
  },
} satisfies Prisma.ProductVariantSelect;
export const cartSelect = {
  id: true,
  status: true,
  expiresAt: true,
  items: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      variantId: true,
      quantity: true,
      variant: { select: cartVariantSelect },
    },
  },
} satisfies Prisma.CartSelect;
type CartRecord = Prisma.CartGetPayload<{ select: typeof cartSelect }>;
export function serializeCart(cart: CartRecord | null): CartView {
  if (!cart) return emptyCart();
  const validation = validateCart(cart);
  if (validation.expired || validation.inactive) return emptyCart();
  let subtotal = new Prisma.Decimal(0);
  const items = cart.items.map((item) => {
    const variant = item.variant,
      product = variant.product;
    const visual = getProductVisual(
      product.productType,
      product.name,
      product.images[0],
    );
    const lineTotal = variant.price.mul(item.quantity);
    subtotal = subtotal.plus(lineTotal);
    const issue =
      validation.issues.find((entry) => entry.itemId === item.id)?.issue ??
      null;
    return {
      id: item.id,
      variantId: item.variantId,
      quantity: item.quantity,
      name: product.name,
      href: `/produit/${product.slug}?variant=${encodeURIComponent(variant.sku)}`,
      image: visual.url,
      imageAlt: visual.alt,
      language: variant.language,
      price: variant.price.toFixed(2),
      lineTotal: lineTotal.toFixed(2),
      availability: getAvailability(product.preorder, [variant]),
      preorder: product.preorder,
      maxQuantity:
        issue === 'UNAVAILABLE'
          ? 0
          : Math.min(availableQuantity(variant), MAX_CART_ITEM_QUANTITY),
      issue,
    };
  });
  return {
    items,
    subtotal: subtotal.toFixed(2),
    itemCount: items.reduce((n, item) => n + item.quantity, 0),
    hasUnavailableItems: !validation.valid,
  };
}
export async function getCartByToken(token?: string): Promise<CartView> {
  const tokenHash = cartTokenHash(token);
  if (!tokenHash) return emptyCart();
  const cart = await getPrisma().cart.findUnique({
    where: { tokenHash },
    select: cartSelect,
  });
  return serializeCart(cart);
}
