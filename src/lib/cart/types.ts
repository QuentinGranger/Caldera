import type { ProductLanguage } from '@/generated/prisma/client';
import type { Availability } from '@/types/product';
export type CartIssue = 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';
export type CartItemView = {
  id: string;
  variantId: string;
  quantity: number;
  name: string;
  href: string;
  image: string;
  imageAlt: string;
  language: ProductLanguage;
  price: string;
  lineTotal: string;
  availability: Availability;
  preorder: boolean;
  maxQuantity: number;
  issue: CartIssue | null;
};
export type CartView = {
  readError?: string;
  items: CartItemView[];
  itemCount: number;
  subtotal: string;
  hasUnavailableItems: boolean;
};
export type CartActionResult = { success: boolean; message: string };
export const emptyCart = (): CartView => ({
  items: [],
  itemCount: 0,
  subtotal: '0.00',
  hasUnavailableItems: false,
});
