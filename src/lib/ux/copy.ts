/**
 * Shared storefront action language.
 *
 * Navigation menus may keep compact noun labels ("Catalogue", "Extensions").
 * These constants are for actions: identical actions should read identically
 * wherever the surrounding context does not require a more specific verb.
 */
export const ALL_PRODUCTS_LABEL = 'Voir tous les produits';

/** Accessible action used when a product card opens its product page. */
export const viewProductLabel = (productName: string) =>
  `Voir ${productName}`;
