# Phase 2 — Storefront Caldera

## Résultat

Homepage éditoriale complète à <http://localhost:3000> : annonce, header et navigation mobile, hero, quatre territoires, nouveautés, sélection Caldera, univers, collections, réassorts, newsletter et footer. Architecture Next.js, Prisma et Docker existante conservée. Aucun changement du schéma de données ni des migrations.

## Composants

- Layout : AnnouncementBar, Header, Navigation, MobileNavigation, Footer.
- Homepage : Hero, CategoryGrid, CategoryCard, FeaturedProducts (standard et éditorial), EditorialSection, Collections, RestockSection, Newsletter, NewsletterForm.
- Produits : ProductCard (grille et compact), ProductBadge (Nouveau, Précommande, Rupture, Dernières pièces).
- UI : Button (lien ou bouton natif), Container, SectionTitle, IconButton.

Chaque composant visuel dispose d’un SCSS Module ; NewsletterForm partage celui de Newsletter.

## Décisions techniques

- Cormorant Garamond et Manrope en WOFF2 local via `next/font/local` (~62 Ko), licences incluses.
- SCSS écrit manuellement, variables sémantiques communes, aucun framework CSS.
- Breakpoints structurels : mobile <768 px, tablette 768–1199 px, desktop ≥1200 px ; ajustements complémentaires à 480 et 1440 px.
- Server Components par défaut ; seuls MobileNavigation et NewsletterForm portent `use client`.
- Menu mobile non modal : ouverture/fermeture, Échap avec retour au déclencheur, clic extérieur, fermeture après navigation et au passage desktop.
- Navigation via ancres réelles. Pas de fausse page produit, catalogue ou mentions légales.
- Images locales avec `next/image`, dimensions ou ratio réservé, `sizes`, chargement différé sauf le hero et le logo d’en-tête.
- Hero photographique temporaire remplaçable dans `public/assets/images/editorial/mountains.jpg`. Aucune génération d’illustration.
- Icônes importées nominativement depuis Lucide ; aucune dépendance d’animation.
- Formats de prix centralisés avec Intl.NumberFormat. Type Product indépendant de Prisma.
- Webpack existant conservé pour les scripts dev/build.

## Démonstration uniquement

Les produits, prix, nouveautés, précommandes, ruptures et réassorts sont fictifs. Les catégories sont locales. La séparation UI/données passe par les props de ProductCard et les fichiers `src/data/`.

Les boutons recherche, compte, favoris et panier sont désactivés avec un intitulé explicite. Les futures pages d’aide et légales sont des textes marqués indisponibles, sans lien cassé.

La newsletter utilise la validation e-mail native et un retour local annoncé par `role="status"`. Aucun appel réseau, stockage, email ou inscription. Le champ n’a pas de `name` pour éviter la transmission de sa valeur lors d’un éventuel submit natif avant hydratation.

## Package ajouté

`lucide-react@1.47.0`. Aucun autre package ajouté au projet.

## Vérifications

- ESLint, TypeScript strict, Prettier et build Next.js.
- Réponse HTTP de la homepage, titre SEO, H1 unique, IDs uniques et ancres valides.
- Images servies par l’optimiseur Next.js.
- Health check existant : HTTP 200, PostgreSQL connecté.
- Relecture des styles pour 320 px, 768 px et 1200 px ; **contrôle visuel et interactions dans un navigateur non effectués**, aucun navigateur disponible dans cet environnement.

## Fichiers créés

- `docs/asset-sources.md`
- `docs/phase-2.md`
- `public/assets/images/editorial/forest.jpg`
- `public/assets/images/editorial/mountains.jpg`
- `public/assets/images/products/charizard.png`
- `public/assets/images/products/pikachu-v.png`
- `public/assets/images/products/prismatic.png`
- `public/assets/images/products/sleeves.png`
- `public/assets/images/products/sparks.png`
- `src/app/fonts/cormorant-garamond-OFL.txt`
- `src/app/fonts/cormorant-garamond.woff2`
- `src/app/fonts/manrope-OFL.txt`
- `src/app/fonts/manrope.woff2`
- `src/components/home/CategoryCard/CategoryCard.module.scss`
- `src/components/home/CategoryCard/CategoryCard.tsx`
- `src/components/home/CategoryGrid/CategoryGrid.module.scss`
- `src/components/home/CategoryGrid/CategoryGrid.tsx`
- `src/components/home/Collections/Collections.module.scss`
- `src/components/home/Collections/Collections.tsx`
- `src/components/home/EditorialSection/EditorialSection.module.scss`
- `src/components/home/EditorialSection/EditorialSection.tsx`
- `src/components/home/FeaturedProducts/FeaturedProducts.module.scss`
- `src/components/home/FeaturedProducts/FeaturedProducts.tsx`
- `src/components/home/Hero/Hero.module.scss`
- `src/components/home/Hero/Hero.tsx`
- `src/components/home/Newsletter/Newsletter.module.scss`
- `src/components/home/Newsletter/Newsletter.tsx`
- `src/components/home/Newsletter/NewsletterForm.tsx`
- `src/components/home/RestockSection/RestockSection.module.scss`
- `src/components/home/RestockSection/RestockSection.tsx`
- `src/components/layout/AnnouncementBar/AnnouncementBar.module.scss`
- `src/components/layout/AnnouncementBar/AnnouncementBar.tsx`
- `src/components/layout/MobileNavigation/MobileNavigation.module.scss`
- `src/components/layout/MobileNavigation/MobileNavigation.tsx`
- `src/components/layout/Navigation/Navigation.module.scss`
- `src/components/layout/Navigation/Navigation.tsx`
- `src/components/product/ProductBadge/ProductBadge.module.scss`
- `src/components/product/ProductBadge/ProductBadge.tsx`
- `src/components/product/ProductCard/ProductCard.module.scss`
- `src/components/product/ProductCard/ProductCard.tsx`
- `src/components/ui/Button/Button.module.scss`
- `src/components/ui/Button/Button.tsx`
- `src/components/ui/Container/Container.module.scss`
- `src/components/ui/Container/Container.tsx`
- `src/components/ui/IconButton/IconButton.module.scss`
- `src/components/ui/IconButton/IconButton.tsx`
- `src/components/ui/SectionTitle/SectionTitle.module.scss`
- `src/components/ui/SectionTitle/SectionTitle.tsx`
- `src/data/mockCategories.ts`
- `src/data/mockProducts.ts`
- `src/data/navigation.ts`
- `src/types/product.ts`
- `src/utils/formatPrice.ts`

## Fichiers modifiés

- `package.json`
- `package-lock.json`
- `README.md`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/page.module.scss`
- `src/components/layout/Header/Header.tsx`
- `src/components/layout/Header/Header.module.scss`
- `src/components/layout/Footer/Footer.tsx`
- `src/components/layout/Footer/Footer.module.scss`
- `src/styles/abstracts/_variables.scss`
- `src/styles/abstracts/_mixins.scss`
- `src/styles/base/_global.scss`
- `src/styles/base/_typography.scss`

## Sources

Voir [les sources des assets](asset-sources.md). Les photos, visuels produits et contenus de démonstration sont à remplacer ou confirmer lors de la préparation de la vraie boutique.
