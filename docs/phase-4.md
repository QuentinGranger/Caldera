# Phase 4 — Navigation du catalogue

Le catalogue est consultable par catégorie, extension, nouveauté et précommande, avec filtres URL, recherche, tri et pagination PostgreSQL. ProductCard, ProductBadge, le modèle Product / ProductVariant et la direction artistique sont conservés.

## Fichiers créés

- `src/lib/catalog/params.ts` : types, parsing, normalisation et construction des URL, pagination compacte.
- `src/lib/catalog/categoryTree.ts` : descendants de catégories, résistant aux cycles.
- `src/lib/catalog/getCatalogProducts.ts` : moteur commun, construction des where/orderBy et pagination.
- `src/lib/catalog/facets.ts` : options issues de la base, par périmètre de route.
- `src/lib/catalog/taxonomy.ts` : catégories, ancêtres, enfants et extensions.
- `src/lib/catalog/metadata.ts` : metadata, noindex et canonical facultatif.
- `src/components/catalog/CatalogPage.tsx`
- `src/components/catalog/CatalogHeader.tsx`
- `src/components/catalog/CatalogGrid.tsx`
- `src/components/catalog/CatalogFilters.tsx`
- `src/components/catalog/CatalogToolbar.tsx`
- `src/components/catalog/CatalogPagination.tsx`
- `src/components/catalog/ActiveFilters.tsx`
- `src/components/catalog/EmptyCatalog.tsx`
- `src/components/catalog/Catalog.module.scss` : styles partagés par les composants du catalogue.
- `src/components/ui/Breadcrumb/Breadcrumb.tsx`
- `src/components/ui/Breadcrumb/Breadcrumb.module.scss`
- `src/components/layout/HeaderSearch/HeaderSearch.tsx`
- `src/components/layout/HeaderSearch/HeaderSearch.module.scss`
- `src/app/categorie/[slug]/page.tsx`
- `src/app/extensions/page.tsx`
- `src/app/extensions/[slug]/page.tsx`
- `src/app/nouveautes/page.tsx`
- `src/app/precommandes/page.tsx`
- `src/app/error.tsx` : état d’erreur avec le `retry` de Next.js 16.3.
- `tests/catalog-filters.test.ts`
- `tests/catalog-navigation-db.test.ts`
- `tests/catalog-navigation-http.test.ts`
- `docs/phase-4.md`

## Fichiers modifiés

- `src/app/catalogue/page.tsx`
- `src/lib/catalog/queries.ts` : sélection / conversion partagées, hiérarchie commune, liens de collections.
- `src/components/layout/Header/Header.tsx`
- `src/components/layout/Footer/Footer.tsx`
- `src/components/home/CategoryCard/CategoryCard.tsx`
- `src/components/home/FeaturedProducts/FeaturedProducts.tsx`
- `src/components/home/Hero/Hero.tsx`
- `src/data/navigation.ts`
- `src/styles/base/_global.scss` : blocage du défilement derrière les modales natives.
- `prisma/seed.ts`
- `tests/catalog-db.test.ts`
- `tests/catalog-http.test.ts`
- `package.json` : scripts de tests complétés, aucune dépendance ajoutée.
- `.env.example` : `SITE_URL` facultative pour les canonical.
- `README.md`

Supprimé : `src/app/catalogue/catalogue.module.scss`, remplacé par les styles communs du catalogue et devenu inutilisé. Aucun changement de schéma Prisma, Docker, singleton, assets de marque ou fiche produit.

## Routes et filtres

| Route                | Périmètre                                          |
| -------------------- | -------------------------------------------------- |
| `/catalogue`         | Produits publics                                   |
| `/categorie/[slug]`  | Catégorie active et descendants accessibles        |
| `/extensions`        | Extensions actives contenant des produits visibles |
| `/extensions/[slug]` | Produits d’une extension active                    |
| `/nouveautes`        | `newArrival = true`                                |
| `/precommandes`      | `preorder = true`                                  |

Toutes les listes utilisent `CatalogPage` et `getCatalogProducts()`. Les catégories affichent leur fil d’Ariane et leurs sous-catégories sous forme de liens. Les liens de la navigation principale utilisent les slugs stables présents dans le seed (`scelles`, `cartes`, `accessoires`), vérifiés en base. Le contenu des pages et les options de filtre restent dynamiques.

Filtres : catégorie, type, extension, langue, disponibilité, prix min/max et recherche. Une virgule sépare les sélections multiples (`language=EN,FR`). OR entre valeurs d’un filtre, AND entre filtres. Recherche insensible à la casse sur nom, description courte, slug et nom d’extension ; les jokers SQL sont échappés, sans recherche fuzzy ni service externe.

Tris : recommandé, nouveautés, prix croissant / décroissant et nom A–Z. Le recommandé ordonne par mise en avant, publication, sortie, puis ID. Les prix utilisent le minimum des variantes qui satisfont **tous** les critères de variante. La carte affiche exactement ce même ensemble de variantes.

Disponibilité : « En stock » comprend tout stock positif hors précommande ; « Dernières pièces » applique le seuil propre à chaque variante ; « Précommande » utilise le statut éditorial du produit. Les variantes inactives sont toujours exclues.

Les paramètres invalides sont normalisés, les prix inversés permutés, une page trop élevée bornée à la dernière page. Les paramètres par défaut et vides sont omis. Un filtre inconnu affiche l’état vide ; une catégorie / extension inconnue dans le chemin produit une 404. Les filtres actifs se retirent un à un. « Tout effacer » revient à la route courante sans paramètres.

## Pagination et accès aux données

12 produits par page, constante `CATALOG_PAGE_SIZE`. `skip/take` est appliqué dans PostgreSQL. Le tri par prix utilise `ProductVariant.groupBy()` et MIN(price), puis charge seulement les produits de la page. Le compte et les résultats sont lus dans une transaction Repeatable Read ; aucun catalogue complet chargé pour être découpé avec `slice()`.

Les projections de la grille n’incluent ni description longue, ni galerie, ni tags, ni coût d’achat. Les champs nécessaires des variantes sont transformés côté serveur en DTO publics. Les facettes utilisent des agrégations sur le périmètre de la route, sans N+1 ni compteurs par option. Aucune API HTTP intermédiaire n’est créée.

Aucune migration supplémentaire : les index actuels suffisent pour ce catalogue. Le seed ajoute huit exemples sans écraser les entrées existantes : 20 produits, 22 variantes, 17 produits visibles. FR / EN / JP actifs, plusieurs types et deux pages testables. L’extension japonaise et les autres produits portent explicitement la mention de démonstration. Le seed a été exécuté deux fois sans doublons.

## Responsive et accessibilité

Sidebar de 250 px à partir de 1200 px. Mobile / tablette : bouton Filtres et `<dialog>` natif ; navigation clavier, fermeture Échap, bouton fermer et retour du focus sont implémentés. Un changement de largeur vers le desktop ferme la modale. Le formulaire est partagé entre les deux présentations avec identifiants propres.

Grille : 1 colonne sous 360 px, 2 sur mobile, 3 dès 768 px, 4 dès 1440 px. Les cases possèdent des labels et fieldsets. Le tri et la recherche sont nommés. Les contrôles gardent le focus pendant les transitions ; l’état de chargement est annoncé. Les prix / recherches nécessitent une validation explicite, les cases et le tri naviguent immédiatement.

Les paramètres serveur pilotent les valeurs appliquées, sans store global. `router.push` conserve l’historique ; les liens de pagination conservent les filtres et ramènent au haut des résultats. Le comportement précédent / suivant et le rendu aux différentes largeurs **restent à vérifier dans un navigateur** : aucun navigateur n’était connecté à l’outil de test de cette session.

## SEO

Metadata par page ; les combinaisons de filtres portent `noindex, follow`. Canonical vers le chemin de base uniquement si l’origine réelle est fournie dans `SITE_URL`. Pas de domaine inventé ni de sitemap prématurée. Les lectures restent dynamiques, sans cache persistant bloquant les éditions Studio.

## Vérification et limites

- Tests unitaires : paramètres, collisions de slugs, sérialisation d’URL, pagination, Decimal et disponibilité.
- Tests PostgreSQL : contraintes existantes, filtres croisés, variantes pertinentes, facettes, recherche, tri, hiérarchie et pagination réelle.
- Tests HTTP : routes, URL nettoyées, filtres rendus, liens, pagination, états vides, metadata, assets et vraies réponses 404.
- ESLint, TypeScript et build Next.js passent.
- Les tests HTTP contrôlent les réponses serveur ; ils ne constituent pas une validation visuelle ou une simulation des interactions navigateur.

Aucun panier, compte, paiement, wishlist, commande, stock réservé, administration, avis ou promotion complexe ajouté. La fiche produit finale, les variantes interactives et la galerie avancée restent pour la phase 5.
