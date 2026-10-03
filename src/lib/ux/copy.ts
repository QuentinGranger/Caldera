/**
 * Shared storefront action language.
 *
 * Navigation menus may keep compact noun labels ("Catalogue", "Extensions").
 * These constants are for actions: identical actions should read identically
 * wherever the surrounding context does not require a more specific verb.
 */
export const ALL_PRODUCTS_LABEL = 'Voir tous les produits';
export const ADD_TO_CART_LABEL = 'Ajouter au panier';
export const VIEW_EXTENSION_LABEL = 'Voir l’extension';

/** Accessible action used when a product card opens its product page. */
export const viewProductLabel = (productName: string) =>
  `Voir ${productName}`;

/** Accessible quick-add action: same verb as the full product CTA, with context. */
export const addProductToCartLabel = (productName: string) =>
  `Ajouter ${productName} au panier`;
