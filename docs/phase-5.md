# Phase 5 — Fiche produit

La fiche conserve `/produit/[slug]` et le rendu serveur. Galerie interactive, choix de langue / variante, quantité, CTA temporaire, caractéristiques, extension et produits associés composent la nouvelle page. Aucun panier réel.

## Fichiers créés

- `src/lib/product/purchase.ts` : vue publique des variantes, sélection déterministe, quantité, libellés et état d’achat préparatoire.
- `src/lib/product/seo.ts` : metadata, canonical, Open Graph, JSON-LD échappé.
- `src/lib/catalog/getRelatedProducts.ts`
- `src/utils/formatProduct.ts`
- `src/components/product/ProductGallery/ProductGallery.tsx`
- `src/components/product/ProductGallery/ProductGallery.module.scss`
- `src/components/product/ProductPurchasePanel/ProductPurchasePanel.tsx`
- `src/components/product/ProductPurchasePanel/ProductPurchasePanel.module.scss`
- `src/components/product/ProductVariantSelector/ProductVariantSelector.tsx`
- `src/components/product/ProductVariantSelector/ProductVariantSelector.module.scss`
- `src/components/product/QuantitySelector/QuantitySelector.tsx`
- `src/components/product/QuantitySelector/QuantitySelector.module.scss`
- `src/components/product/AddToCartButton/AddToCartButton.tsx`
- `src/components/product/AddToCartButton/AddToCartButton.module.scss`
- `src/components/product/ProductDetails/ProductDetails.tsx`
- `src/components/product/ProductDetails/ProductDetails.module.scss`
- `src/components/product/ProductSetSection/ProductSetSection.tsx`
- `src/components/product/ProductSetSection/ProductSetSection.module.scss`
- `src/components/product/RelatedProducts/RelatedProducts.tsx`
- `src/components/product/RelatedProducts/RelatedProducts.module.scss`
- `tests/product.test.ts`
- `tests/product-db.test.ts`
- `tests/product-http.test.ts`
- `docs/phase-5.md`

## Fichiers modifiés

- `src/app/produit/[slug]/page.tsx`
- `src/app/produit/[slug]/product.module.scss`
- `src/lib/catalog/queries.ts`
- `prisma/seed.ts`
- `tests/catalog-db.test.ts`
- `tests/catalog-http.test.ts`
- `package.json` : trois scripts de tests, aucun package ajouté.
- `.env.example` et `.env` local ignoré : origine locale `SITE_URL` pour canonical / Open Graph.
- `README.md`

Aucune migration, modification du schéma, du catalogue ou des assets de marque. ProductCard, ProductBadge, Breadcrumb, Container, Button, formatPrice et getAvailability sont réutilisés.

## Données et interactions

`getProductBySlug()` ne confond plus produit absent et produit actif sans variante. Il laisse passer ce dernier vers un état contrôlé avec CTA désactivé ; le catalogue continue de l’exclure. Les DRAFT / ARCHIVED restent masqués. Les variantes inactives ne sont jamais sélectionnées.

Le DTO contient les dates ISO, prix décimaux en chaînes, catégorie réelle, type, extension détaillée et galerie. Les variantes exposent une capacité de sélection et le stock faible éventuel, jamais costPrice ni les seuils internes. La galerie et le panneau sont les zones clientes ; texte, breadcrumbs, extension et produits associés sont rendus côté serveur.

`ProductVariantSelector` utilise des radios avec libellés français. `?variant=SKU` est synchronisé par l’API History native de Next.js ; défaut actif puis SKU déterministe en cas de paramètre absent / invalide. `ProductPurchasePanel` recalcule l’affichage depuis la variante, et réinitialise la quantité à 1 lors d’un changement. Le CTA ne fait qu’annoncer la future ouverture des achats.

Disponibilité : logique de phase 3 conservée, avec nombre exact pour les faibles stocks. Précommande pilotée uniquement par Product.preorder ; quantité bornée à stockQuantity, zéro bloque l’action. Les dates restent les données éditoriales du seed, sans correction silencieuse.

Galerie : principale d’abord, puis sortOrder et ID ; miniatures, alternative descriptive, agrandissement natif, navigation gauche/droite et fermeture Échap. Le placeholder par type est conservé sans photo. Aucune galerie par variante.

Related : même extension, catégorie puis type, groupes exclusifs limités à quatre lignes chacun, quatre cartes finales maximum. Ordre déterministe, produit courant exclu ; section vide non rendue. Ce ne sont pas des recommandations personnalisées.

## Seed et SEO

Seed idempotent : toujours 20 produits, désormais 23 variantes et 22 images. Deux illustrations sont ajoutées à l’ETB, et une variante EN en précommande limitée à 3 au coffret Aurores. Les valeurs modifiées manuellement ne sont pas écrasées.

Canonical sans query string, Open Graph avec image principale via SITE_URL. Origine locale configurée, domaine de production à renseigner avant publication. JSON-LD Product / Offer fondé sur la variante par défaut, avec prix EUR et disponibilité, sans marques supposées, avis ni note. Les caractères `<` sont échappés avant insertion dans le script.

## Validation

- Tests unitaires de sélection, quantités et formatage français.
- Tests PostgreSQL des variantes, galerie ordonnée, données publiques, précommande, recommandations et SEO.
- Tests HTTP des deep links FR / EN, SKU, quantités, rupture, précommande, absence de variante, 404 et données structurées.
- Une fiche temporaire sans image, description ou extension sert à vérifier les fallbacks, puis est supprimée.
- Tests de régression du catalogue et build Next.js.

Aucun navigateur n’est disponible dans l’outil de test : le rendu visuel, les clics galerie / variante, la navigation clavier, les transitions d’historique et les tailles d’écran restent à valider manuellement. Les tests HTTP ne sont pas présentés comme des tests navigateur.

## Responsive et phase 6

Galerie puis informations sur mobile/tablette, deux colonnes environ 55/45 dès 1200 px. Images sur fond chaud, focus visible, contrôles natifs et micro-interactions SCSS ; pas de sticky CTA, de librairie d’animation ou de dépendance ajoutée.

Les props productId / variantId / quantity / disabled du CTA constituent le point de branchement du futur panier. Ni persistance, cookie, localStorage, CartContext, réservation, checkout, Stripe, compte, wishlist, avis, alerte stock ou administration n’ont été ajoutés.
