import 'server-only';
import { sharedCache } from '@/lib/cache/catalogCache';
import { shippingOptionViews } from '@/lib/product/services';
import { getShippingFacts } from '@/lib/seo/shipping';

/**
 * The delivery methods the shop really offers (active, not for development,
 * serving an open country), as the cart and the product pages show them. Read
 * by every page through the root layout: shared between visitors, dropped by
 * the admin when a method changes (invalidateCatalogCache).
 */
export const getShippingOptions = sharedCache(
  async () => shippingOptionViews(await getShippingFacts()),
  ['shipping-options'],
  300,
);
