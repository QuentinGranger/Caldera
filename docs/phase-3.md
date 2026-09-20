# Phase 3 — Catalogue PostgreSQL

Le storefront lit PostgreSQL via une couche serveur dédiée. Les composants et l’identité visuelle existants sont réutilisés. Les produits sont des exemples de développement, signalés par `[Démo]`.

## Fichiers créés

- `prisma/migrations/20260919214618_create_catalog/migration.sql`
- `prisma/seed.ts`
- `src/lib/catalog/queries.ts`
- `src/lib/catalog/getAvailability.ts`
- `src/lib/catalog/getPricing.ts`
- `src/lib/catalog/createSlug.ts`
- `src/app/catalogue/page.tsx`
- `src/app/catalogue/catalogue.module.scss`
- `src/app/produit/[slug]/page.tsx`
- `src/app/produit/[slug]/product.module.scss`
- `public/assets/products/placeholder-product.png`
- `tests/catalog.test.ts`
- `tests/catalog-db.test.ts`
- `tests/catalog-http.test.ts`
- `docs/phase-3.md`

## Fichiers modifiés

- `prisma/schema.prisma`
- `prisma.config.ts`
- `package.json`
- `package-lock.json`
- `README.md`
- `src/app/page.tsx`
- `src/types/product.ts`
- `src/utils/formatPrice.ts`
- `src/data/navigation.ts`
- `src/components/product/ProductCard/ProductCard.tsx`
- `src/components/product/ProductCard/ProductCard.module.scss`
- `src/components/home/FeaturedProducts/FeaturedProducts.tsx`
- `src/components/home/RestockSection/RestockSection.tsx`
- `src/components/home/CategoryGrid/CategoryGrid.tsx`
- `src/components/home/CategoryCard/CategoryCard.tsx`
- `src/components/home/Collections/Collections.tsx`
- `src/components/home/Hero/Hero.tsx`
- `src/components/layout/Footer/Footer.tsx`

Supprimés après branchement des composants à la base : `src/data/mockProducts.ts`, `src/data/mockCategories.ts`. Les assets de phase 2 sont conservés. Pas de changement de Docker, de la connexion singleton ou du health check.

Seul package ajouté : `tsx` en dépendance de développement, pour le seed TypeScript et les tests avec le runner Node.js natif.

## Migration et relations

La migration `20260919214618_create_catalog` complète la migration initiale sans reset de base.

| Modèle         | Rôle et relations                                                                            |
| -------------- | -------------------------------------------------------------------------------------------- |
| Product        | Fiche éditoriale ; une catégorie, extension facultative, plusieurs variantes / images / tags |
| ProductVariant | Unité vendable : SKU, langue, prix Decimal, stock ; appartient à un produit                  |
| Category       | Hiérarchie simple parent / enfants ; produits associés                                       |
| TcgSet         | Extension facultative d’un produit ; plusieurs produits possibles                            |
| ProductImage   | Image principale / galerie ordonnée d’un produit                                             |
| Tag            | Étiquette libre, relation plusieurs-à-plusieurs avec Product                                 |

La table de liaison `_ProductToTag` est gérée par Prisma. `Restrict` empêche les suppressions de catégories, extensions et produits encore référencés par des variantes. Les cascades ne concernent que les images et les associations de tags, pas d’autres produits.

UUID, contraintes UNIQUE, clés étrangères et index utiles sont inclus. Les contraintes CHECK ajoutées en SQL protègent prix / stock / seuil, poids et identifiants commerciaux vides. Le README précise les conventions d’édition : une variante active par défaut et une image principale.

## Seed

12 produits, 14 variantes, 7 catégories, 3 extensions fictives, 2 tags, 12 images locales. Neuf produits apparaissent publiquement. Le seed couvre plusieurs langues, prix barré, stock faible, rupture, précommande, brouillon, archive et variante inactive. Les variantes inactives ne modifient ni le prix public ni la disponibilité.

Les upserts préservent les éditions existantes ; relancer le seed ne duplique pas les entrées. Il ne faut pas renommer ses slugs / SKU puis le relancer en attendant qu’il reconnaisse les anciennes identités. Il ne contient aucune donnée officielle inventée.

## Pages et accès aux données

- `/` : nouveautés, sélection, réassorts, catégories et collections viennent de PostgreSQL.
- `/catalogue` : tous les produits publiés et visibles.
- `/produit/[slug]` : fiche technique, variantes / SKU, image, prix, disponibilité, texte et metadata ; absence → 404.
- `/api/health` : route existante conservée.

`queries.ts` expose `getProducts`, `getProductBySlug`, `getFeaturedProducts`, `getNewProducts`, `getProductsByCategory`, `getProductsBySet`, `getRestockedProducts`, `getHomeCategories` et `getCollections`. Les requêtes sont `server-only` et les composants reçoivent des props. Aucun endpoint public supplémentaire.

Les montants publics sont des chaînes décimales ; aucun objet Decimal ne traverse une frontière client. `costPrice` n’est jamais sélectionné. `connection()` maintient les pages dynamiques ; les changements Studio sont visibles après rafraîchissement. `React.cache` déduplique la fiche au sein du rendu seulement. Le README décrit l’emplacement d’une future invalidation Next.js par tag.

## Validation

- PostgreSQL local opérationnel, migration appliquée et seconde vérification sans dérive.
- Client Prisma généré ; seed exécuté deux fois sans doublon.
- Tests métier : slugs, montants Decimal, disponibilité multi-variantes.
- Tests DB : filtres de publication, DTO sérialisables, absence de coût interne, UNIQUE, CHECK et suppressions protégées.
- Tests HTTP : homepage, catalogue, fiche, metadata, SKU, image locale et 404 réelles.
- Test de modification réelle du prix / stock du booster, répercutée dans les trois pages ; valeurs restaurées ensuite.
- Prisma Studio démarre sur le port 5555.
- ESLint et build Next.js validés ; contrôle TypeScript inclus dans le build.

Les tests sont reproductibles avec les scripts `test:catalog`, `test:catalog:db`, `test:catalog:http`, sur une base de développement contenant le seed initial. Les commandes de lancement et de migration sont dans le [README](../README.md).

## Hors périmètre

Pas de panier, commande, paiement, compte client, recherche, wishlist, e-mails, livraison ou back-office. Pas de moteur de promotions : `compareAtPrice` est uniquement un prix barré de présentation.

Filtres, tri, pagination, pages de catégorie / extension et design final de fiche restent pour la phase suivante. Les réassorts constituent une sélection éditoriale par tag, sans historique de stock. Les boutons d’achat restent désactivés.
