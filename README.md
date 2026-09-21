# Les Terres de Caldera

Storefront Next.js / PostgreSQL pour une boutique de collection Pokémon TCG. **Phase 11 : espace client, commandes, paiement Stripe TEST et réservations atomiques**, alimenté par un seed de développement explicitement fictif. La direction artistique SCSS de la phase 2 est conservée.

Le [compte rendu de phase 8](docs/phase-8.md) détaille les commandes, paiements et tests ; le [plan Stripe](docs/stripe-integration-plan.md) couvre Payments, Tax et Invoicing. Le [compte rendu de phase 7](docs/phase-7.md) détaille le checkout et ses validations. Le [compte rendu de phase 6](docs/phase-6.md) détaille le panier et ses tests. Le [compte rendu de phase 5](docs/phase-5.md) détaille les fichiers et les validations. Le [document de phase 4](docs/phase-4.md) décrit la navigation du catalogue. Le [document de phase 3](docs/phase-3.md) décrit la mise en place du modèle de données. Le [document de phase 2](docs/phase-2.md) reste un historique de cette étape.

## Installation et démarrage

Prérequis : Node.js **24 LTS** (`.nvmrc`), npm **11+**, Docker avec Compose démarré. Utiliser uniquement npm.

```bash
npm install
# Seulement si .env n’existe pas encore :
cp .env.example .env
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Prisma 7 ne lance automatiquement ni la génération ni le seed après une migration. Redémarrer le serveur Next.js après une modification du schéma / régénération du client : le singleton de développement peut garder l’ancien client en mémoire.

- Homepage : <http://localhost:3000>
- Catalogue : <http://localhost:3000/catalogue>
- Panier : <http://localhost:3000/panier>
- Checkout : <http://localhost:3000/checkout> (nécessite un panier valide)
- Exemple produit : <http://localhost:3000/produit/dev-etb-terres-de-braise>
- Santé Next.js / PostgreSQL : <http://localhost:3000/api/health>

Le seed est local, idempotent et interdit lorsque `NODE_ENV=production`. Il préserve les enregistrements existants et les modifications faites dans Studio ; il ne sert pas à remettre la base à zéro.

## Environnement et PostgreSQL

`.env.example` fournit des identifiants **de développement uniquement** :

```dotenv
POSTGRES_PORT=5432
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/caldera?schema=public"
```

Si 5432 est occupé, choisir le même port libre dans **les deux valeurs**, par exemple 55432. La configuration locale actuelle peut déjà utiliser ce port : ne pas écraser un `.env` existant. Redémarrer Compose et Next.js après un changement de connexion. Aucun secret dans `NEXT_PUBLIC_*` ; les fichiers `.env*` sont ignorés, sauf `.env.example`.

Compose lance uniquement PostgreSQL 18.6, publié sur `127.0.0.1`, avec volume persistant `postgres_data` monté sur `/var/lib/postgresql`.

```bash
docker compose ps
docker compose stop
docker compose start
```

`docker compose down` conserve le volume. **`docker compose down -v` détruit les données locales.**

Le health check effectue un `SELECT 1` sans cache : HTTP 200 avec `{"status":"ok","database":"connected"}`, ou HTTP 503 avec `{"status":"error","database":"disconnected"}`. Les pages catalogue nécessitent maintenant PostgreSQL : une panne réelle remonte comme erreur serveur et n’est pas remplacée par des mocks.

## Commandes Prisma

| Commande                                         | Usage                                              |
| ------------------------------------------------ | -------------------------------------------------- |
| `npm run db:generate`                            | Générer `src/generated/prisma/` (non versionné)    |
| `npm run db:migrate`                             | Appliquer / créer les migrations en développement  |
| `npm run db:migrate -- --name nom_du_changement` | Nommer une nouvelle migration                      |
| `npm run db:deploy`                              | Appliquer les migrations existantes en déploiement |
| `npm run db:status`                              | Vérifier l’historique                              |
| `npm run db:seed`                                | Ajouter le catalogue fictif sans doublons          |
| `npm run db:studio`                              | Ouvrir Prisma Studio                               |

La migration initiale du schéma public est conservée. `20260919214618_create_catalog` ajoute le catalogue, ses index, clés étrangères et contraintes SQL. Versionner le schéma et les migrations ensemble. Ne pas employer `db push` à la place des migrations : les contraintes `CHECK` sont définies dans leur SQL.

Prisma Studio utilise le port 5555 par défaut. Pour le lancer sans ouvrir automatiquement un navigateur :

```bash
npm run db:studio -- --browser none --port 5555
```

Ouvrir <http://localhost:5555>, puis la table `ProductVariant`. Modifier `price` ou `stockQuantity`, enregistrer, et rafraîchir le site. Aucun redémarrage n’est nécessaire pour une modification de données. L’ETB possède deux variantes actives : son prix « À partir de » est le minimum FR/EN. Pour un essai simple, modifier le booster `DEV-BST-BRAISE-FR` (prix initial 5,90 €, stock 25).

## Architecture du catalogue

```text
PostgreSQL → Prisma → src/lib/catalog/queries.ts → Server Components → UI

prisma/
  schema.prisma
  seed.ts
  migrations/20260919214618_create_catalog/migration.sql
src/
  lib/
    db/prisma.ts
    catalog/{queries,getAvailability,getPricing,createSlug}.ts
  types/product.ts
  utils/formatPrice.ts
  app/
    page.tsx
    catalogue/page.tsx
    produit/[slug]/{page.tsx,product.module.scss}
  components/
    home/
    product/ProductCard/
public/assets/products/placeholder-{accessories,sealed,card}.png
tests/{catalog,catalog-db,catalog-http}.test.ts
```

Le client PostgreSQL est un singleton `server-only`, créé à la demande, avec pool limité et délais bornés. Les pages utilisent directement les fonctions serveur, sans API HTTP intermédiaire et sans Prisma dans le navigateur. Les requêtes sélectionnent explicitement les données nécessaires ; aucune boucle de requêtes par carte produit.

**Product ≠ ProductVariant** : Product décrit le produit commercial (texte, catégorie, extension, images, tags, publication). ProductVariant porte le SKU vendu (langue, prix, stock, code-barres). Un produit peut donc proposer plusieurs langues sans dupliquer sa fiche.

- `Product` → une `Category`, éventuellement un `TcgSet`, plusieurs variantes et images.
- `Category` → un parent facultatif et des enfants.
- `Product` ↔ `Tag` : relation plusieurs-à-plusieurs, table de liaison Prisma implicite.
- Identifiants UUID ; slugs et SKU uniques. Le code-barres est unique lorsqu’il est renseigné ; plusieurs `NULL` sont permis.
- Suppressions `Restrict` pour catégorie, extension, parent de catégorie et produit possédant des variantes. Seules les images dépendantes et les associations de tags sont supprimées en cascade. Un tag supprimé n’efface aucun produit.
- SQL protège stock / seuil / prix négatifs, poids non positif, SKU / code-barres vides et catégorie directement parente d’elle-même. Les cycles plus longs restent à valider dans la future administration.

## Règles de lecture et prix

Les listes publiques demandent un produit `ACTIVE`, une catégorie directe active, une extension active si présente et au moins une variante active. Une fiche ACTIVE sans variante active reste consultable avec un achat désactivé ; elle ne figure pas dans les listes. Les variantes inactives ne contribuent ni au prix ni à la disponibilité. L’état des ancêtres d’une catégorie n’est pas hérité automatiquement.

`getProductsByCategory(slug)` inclut les descendants actifs accessibles par la hiérarchie active. `getProductsBySet(slug)` filtre une extension. Une liste vide retourne `[]` ; une fiche absente ou masquée retourne `null`, puis `notFound()` dans la page. Les erreurs DB restent visibles en développement.

`featured` et `newArrival` sont des choix éditoriaux, ordonnés par `publishedAt` décroissant (dates absentes en dernier, slug pour départager). Les réassorts sont les produits disponibles portant le tag `reassort` : il ne s’agit pas d’un historique de mouvements.

Disponibilité calculée sur les variantes actives :

1. Aucune variante active : indisponible, produit masqué.
2. Produit marqué `preorder` : précommande.
3. Au moins une variante au-dessus de son seuil : en stock.
4. Sinon, au moins une variante avec stock positif : dernières pièces.
5. Sinon : rupture.

Les prix sont des **Decimal PostgreSQL (10,2)**. Les comparaisons utilisent Decimal côté serveur, puis les montants deviennent des chaînes à deux décimales dans les DTO publics. `formatPrice()` assure uniquement l’affichage français en EUR via `Intl.NumberFormat`.

Si les prix actifs diffèrent, afficher leur minimum avec « À partir de ». Le prix barré provient de la même variante et n’est affiché que s’il dépasse son prix. Les variantes en rupture restent listées : disponibilité et prix sont deux informations distinctes. En cas de prix égaux, la variante par défaut, puis le SKU, départagent les variantes.

Maintenir **une variante active par défaut par produit** dans Studio. Cette règle n’est pas imposée par un index SQL ; les lectures restent déterministes si elle n’est pas respectée. Les variantes de la fiche sont triées par défaut puis SKU. Les images sont triées par `isPrimary`, `sortOrder`, puis ID ; marquer une seule image principale est la convention d’édition.

`costPrice` n’est jamais sélectionné par les requêtes storefront. Seuils, code-barres et informations de connexion ne font pas partie des DTO publics. La fiche expose seulement la quantité maximale sélectionnable et le nombre restant lorsque le stock est faible ; le coût reste strictement interne. `CatalogProduct` décrit seulement les props de présentation ; les types du schéma sont ceux générés par Prisma.

`createSlug()` normalise accents, ligatures, ponctuation et collisions connues par suffixe. La contrainte UNIQUE PostgreSQL reste l’arbitre final, notamment pour des écritures concurrentes.

## Cache Next.js

Next.js **16.3.5** : les pages DB appellent `connection()` et sont rendues à la demande. Aucune mise en cache persistante du catalogue : les éditions Studio sont visibles au prochain rafraîchissement. Le build n’interroge pas PostgreSQL.

`React.cache` déduplique seulement la lecture de la fiche entre page et metadata au cours d’un rendu serveur. Il ne conserve pas les données entre les visites.

La frontière `src/lib/catalog/queries.ts` permettra ensuite d’ajouter le cache Next.js et un tag commun `catalog` : activer Cache Components, appliquer `use cache` / `cacheTag` aux lectures adaptées, puis invalider depuis les futures mutations serveur. Rien n’est activé prématurément, car Studio ne déclenche actuellement aucune invalidation.

## Seed et visuels

Le seed ajoute **20 produits, 23 variantes, 7 catégories, 3 extensions fictives, 2 tags et 22 images**. Dix-sept produits sont visibles : les autres couvrent brouillon, archive et variante inactive. Cas présents : stock normal, dernières pièces, rupture, précommande, prix barré, deux langues actives et une langue inactive à exclure.

Les noms portent `[Démo]`, les slugs produits/extensions `dev-`, les SKU `DEV-`. Ces données ne correspondent pas à des produits Pokémon officiels.

Les trois placeholders locaux fournis sont utilisés selon le type de produit : accessoires, scellés et cartes. La règle centralisée dans `src/lib/catalog/images.ts` reconnaît aussi l’ancien placeholder générique comme une absence de visuel. Remplacer ensuite les URL / alternatives de `ProductImage` par de vrais assets sous `public/`. Les illustrations de phase 2 sont réutilisées sur les quatre cartes de catégories de la homepage. `mockProducts.ts` et `mockCategories.ts` sont supprimés.

Le hero, le logo, la forêt, les polices locales et le design SCSS existants sont conservés. Les pages de navigation réutilisent ProductCard. Aucun framework CSS ni package supplémentaire ajouté en phase 4.

## Catalogue & filtres

Routes : `/catalogue`, `/categorie/[slug]`, `/extensions`, `/extensions/[slug]`, `/nouveautes`, `/precommandes`. La fiche `/produit/[slug]` contient maintenant une galerie et un panneau de sélection de variante. Les catégories et extensions viennent de PostgreSQL ; les pages inconnues ou inactives retournent 404. Une catégorie inclut ses descendants actifs. Le périmètre de la route reste appliqué lorsque l’on efface ses filtres.

### Paramètres URL

| Paramètre              | Valeurs                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `category`             | Slugs de catégories, descendants inclus                        |
| `type`                 | Valeurs ProductType, par exemple `ETB,DISPLAY`                 |
| `set`                  | Slugs d’extensions                                             |
| `language`             | `FR,EN,JP,DE,ES,IT,OTHER`                                      |
| `availability`         | `in-stock,low-stock,preorder`                                  |
| `minPrice`, `maxPrice` | Montants positifs ou nuls, deux décimales maximum              |
| `search`               | Texte, 120 caractères maximum                                  |
| `sort`                 | `recommended`, `newest`, `price-asc`, `price-desc`, `name-asc` |
| `page`                 | Entier positif, 1 par défaut                                   |

Plusieurs valeurs d’une même facette sont séparées par une virgule (**OU**). Des facettes différentes se combinent avec **ET**. Les paramètres répétés sont également acceptés, puis normalisés vers des valeurs uniques triées. Exemple partageable :

```text
/catalogue?type=DISPLAY,ETB&language=EN,FR&minPrice=20.00&maxPrice=100.00&sort=price-asc
/categorie/etb?language=FR&sort=price-asc
```

Les paramètres invalides sont ignorés, les bornes prix inversées sont permutées et une page trop élevée revient à la dernière page. Les paramètres vides, inconnus, `page=1` et le tri par défaut disparaissent par redirection vers l’URL normalisée. Un slug de filtre inconnu donne zéro résultat ; un slug de **route** inconnu donne 404.

Les cases et le tri sont alimentés par les paramètres serveur. Recherche et prix sont appliqués par formulaire ; les cases sont appliquées immédiatement. Toute modification de filtre, recherche ou tri revient à la page 1. « Tout effacer » réinitialise aussi la recherche et le tri dans le périmètre courant. Chaque filtre actif peut être retiré individuellement. La pagination conserve les paramètres et pointe vers le haut des résultats.

### Requêtes et variantes

`getCatalogProducts(filters, scope)` est le moteur commun ; il retourne `{ products, total, page, pageSize, pageCount }`. `buildCatalogWhere()` applique catégorie, type, extension et publication au Product, puis **un seul prédicat de variante active** pour langue, prix et disponibilité. Le DTO réutilise `getPricing()` et `getAvailability()` uniquement sur les variantes correspondantes. Un filtre FR affiche donc le prix FR, même si la variante EN est moins chère.

« En stock » inclut tout stock positif, y compris les dernières pièces, en excluant les précommandes. « Dernières pièces » retient les variantes positives au niveau ou sous leur propre seuil. « Précommande » utilise Product.preorder. Sans filtre de disponibilité, les ruptures restent visibles. Plusieurs critères de disponibilité sont combinés avec OU.

Le tri recommandé est `featured DESC`, `publishedAt DESC NULLS LAST`, `releaseDate DESC NULLS LAST`, puis ID. Nouveautés trie par publication puis sortie et ID ; A–Z utilise le nom selon la collation PostgreSQL, puis ID. Le tri par prix utilise le **minimum Decimal des variantes correspondantes**, dans les deux sens, avec productId pour départager.

`CATALOG_PAGE_SIZE = 12`. PostgreSQL effectue `skip/take` ; aucune tranche d’un catalogue complet n’est calculée en mémoire. Pour les prix, Prisma `groupBy(ProductVariant.productId)` agrège MIN(price), trie et pagine en base, puis charge uniquement les produits de cette page. Le compte et les résultats partagent une transaction de lecture Repeatable Read afin de borner la page sans incohérence concurrente. Pas de nouvelle migration ni d’index spéculatif.

`getCatalogFacets(scope)` propose catégories, types, extensions et langues présentes dans les produits visibles du périmètre de route. Les facettes ne sont pas recalculées pour chaque combinaison de filtres, et n’affichent pas de compteurs. Elles utilisent des agrégations groupées plutôt qu’une requête par option. La hiérarchie est parcourue avec un ensemble de nœuds visités pour résister aux cycles.

### Server / Client et responsive

Les pages, résultats et cartes restent des Server Components. `CatalogFilters`, `CatalogToolbar` et `HeaderSearch` assurent seulement les interactions via `router.push`. L’URL est la source des filtres appliqués ; aucun store global. Les champs de saisie conservent un brouillon jusqu’à validation. Les marqueurs de chargement sont locaux, avec `aria-busy` / `role=status`, sans skeleton qui retarderait les réponses 404.

À partir de 1200 px : sidebar de 250 px. En dessous : bouton Filtres et `<dialog>` modal natif, focus contenu dans le panneau, fermeture Échap / bouton / extérieur et retour au déclencheur. Grille : une colonne sous 360 px, deux sur mobile, trois dès 768 px, quatre à partir de 1440 px. Les prix, la recherche et les tris ont de vrais labels ; le défilement du fond est bloqué pendant une modale.

Les tests HTTP vérifient le HTML, les routes, les états et les liens. Ils ne remplacent pas une vérification dans un navigateur : le contrôle visuel à 320 / 390 / 768 / 1200 / 1440 px, Échap / Tab et précédent / suivant reste à effectuer lorsqu’un navigateur est connecté à l’outil de test.

### SEO

Les pages ont leurs metadata propres. Les URL contenant des paramètres de navigation portent `noindex, follow`. Un canonical vers le chemin de base est produit **uniquement si `SITE_URL` est configurée** avec l’origine réelle du site ; aucun domaine de production n’est inventé. Cette variable facultative est documentée dans `.env.example`. Aucune sitemap n’a été ajoutée à cette étape, faute de domaine de publication configuré.

## Fiche produit

`/produit/[slug]` reste un Server Component : `getProductBySlug()` sélectionne la galerie ordonnée, les tags, la catégorie, l’extension et les variantes actives, puis sérialise Decimal et dates. Les brouillons, archives et slugs inconnus donnent 404. Un stock nul n’efface pas la fiche ; un produit actif sans variante affiche un état indisponible contrôlé.

`ProductGallery` gère l’image active, les miniatures et une vue agrandie dans un `<dialog>` natif (fermeture Échap, focus contenu dans la modale, retour au déclencheur, flèches gauche/droite). Sans image, le placeholder Caldera correspondant au type est utilisé. Les images restent attachées au produit, pas à la variante.

`ProductPurchasePanel` lit `?variant=SKU` via `useSearchParams`. Le sélecteur utilise `history.pushState`, intégré au routeur Next.js 16, pour changer immédiatement la sélection sans recharger la page. Une URL partagée ou rafraîchie conserve la variante ; un SKU inconnu/inactif retombe sur la variante active par défaut, puis le premier SKU dans un ordre déterministe. Exemple :

```text
/produit/dev-etb-terres-de-braise?variant=DEV-ETB-BRAISE-EN
```

Prix, prix barré, langue, SKU, disponibilité, poids et quantité maximum suivent la sélection. La quantité revient à 1 à chaque changement de variante. `normalizeQuantity()` refuse les valeurs invalides et borne les entiers entre 1 et le stock. Rupture ou capacité nulle désactive la quantité et le CTA. Les précommandes sont **limitées à stockQuantity**, sans capacité illimitée implicite : une précommande à zéro reste présentée comme telle, avec son CTA désactivé. Une date affichée provient strictement de `releaseDate` ; elle n’est pas corrigée ni interprétée comme un statut de précommande.

Le stock faible affiche le nombre restant ; le stock normal n’est pas écrit en toutes lettres. Le coût d’achat n’entre jamais dans les props. L’absence de description, extension, poids ou date n’entraîne aucune information inventée. Le contenu du coffret reste dans la description : aucun nouveau champ ni migration.

`AddToCartButton` reçoit `variantId`, `quantity` et `disabled`. Il appelle désormais une Server Action qui revalide la variante et la quantité cumulée en base, puis ouvre le mini-panier. Le prix n’est jamais envoyé par le client. La fiche borne aussi la quantité à 99.

`getRelatedProducts()` remplit jusqu’à quatre places : même extension, puis même catégorie, puis même type. Trois lectures groupées et bornées, jamais une requête par carte ; groupes disjoints et exclusion du produit courant. Tri stable par mise en avant, publication et ID ; ruptures admises selon la stratégie catalogue. La section disparaît si elle est vide.

Metadata : nom, description courte (ou description / nom), Open Graph et canonical sans paramètre de variante. `SITE_URL` vaut `http://localhost:3000` dans l’exemple local ; le remplacer par l’origine réelle au déploiement. Sans origine valide, aucun canonical absolu ni image Open Graph n’est inventé. Le JSON-LD Product présente l’offre de la **variante par défaut**, son SKU, le prix EUR et InStock / OutOfStock / PreOrder, sans avis ni note. Son texte est échappé contre l’injection de balises script.

Seed : l’ETB dispose de trois illustrations de démonstration ; le coffret Aurores possède désormais une variante EN de précommande avec capacité 3, en plus de sa FR à zéro. Les illustrations complémentaires ne décrivent pas le contenu réel d’un produit officiel. Toutes les éditions existantes restent préservées.

```bash
npm run test:product
npm run test:product:db
# Serveur connecté à la même base de développement :
npm run test:product:http
```

Les tests HTTP couvrent la sélection par URL, le HTML des contrôles, les capacités, les états de disponibilité, les metadata / JSON-LD et une fiche temporaire sans image / description / extension (supprimée après contrôle). Les tests ne remplacent pas une validation visuelle : miniatures, zoom, Tab / Échap, changement de variante à la souris, précédent/suivant et largeurs 320 / 390 / 768 / 1200 / 1440 px restent à vérifier lorsqu’un navigateur est connecté. Sous 1200 px la fiche est empilée ; au-dessus, galerie et informations occupent environ 55/45. Pas de barre sticky qui pourrait masquer le contenu.

## Vérifications

## Comptes clients

La phase 11 ajoute un espace client indépendant de l’administration :

Les migrations additives `20260920221159_customer_accounts`, `20260920223342_customer_login_rate_limit` et `20260920223918_customer_email_outbox` créent `Customer`, `CustomerSession`, `CustomerAuthToken`, `CustomerAddress`, la file `CustomerEmailDelivery` et le compteur de tentatives, puis ajoutent les relations nullable `Order.customerId` et `Cart.customerId`. Elles ne suppriment aucune donnée guest et ne cascade jamais la suppression d’un client vers les commandes.

- `/inscription`, `/connexion`, `/mot-de-passe-oublie` et `/reinitialiser-mot-de-passe` utilisent une session serveur `HttpOnly` (`caldera_customer_session`) et un mot de passe dérivé avec `scrypt` ; aucun secret n’est placé dans `localStorage`.
- Les emails de vérification, de changement d’adresse et de réinitialisation sont placés dans `CustomerEmailDelivery`, puis envoyés par le worker `npm run emails:process` via les clés Resend déjà documentées par `EMAILS_ENABLED`, `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM` et `EMAIL_TEST_RECIPIENT`. Les tokens sont aléatoires, hashés en base, à usage unique et expirent.
- `/compte`, `/compte/profil`, `/compte/adresses`, `/compte/commandes` et `/compte/securite` sont rendus à la demande, protégés par la session client et marqués `noindex`. Les autorisations sont toujours contrôlées côté serveur avec l’ID de la session ; les IDs transmis par le navigateur ne servent jamais d’autorisation.
- `CustomerAddress` est distinct d’`OrderAddress`. Une adresse peut être définie par défaut pour la livraison et/ou la facturation ; la mise à jour de ces marqueurs est transactionnelle. Les snapshots d’une commande passée ne changent jamais.
- Les connexions sont limitées par fenêtres persistées (globalement et par empreinte d’adresse email) afin de ralentir les tentatives répétées sans exposer l’existence d’un compte.
- `Order.customerId` et `Cart.customerId` sont nullable afin de préserver les commandes et paniers invités. Une commande invitée ne peut être rattachée qu’après vérification de l’email, avec une mise à jour limitée aux commandes sans client dont l’email correspond sans distinction de casse.
- À la connexion, le panier invité et le panier actif du client sont fusionnés dans une transaction. Les lignes identiques sont additionnées puis limitées à la disponibilité et à `MAX_CART_ITEM_QUANTITY`; un seul panier actif est conservé et le cookie reste HTTP-only. Le checkout invité reste disponible et les adresses par défaut d’un client sont proposées comme valeurs initiales, modifiables avant paiement.

Les fonctionnalités wishlist, fidélité, SAV, retours, factures et authentification sociale ne font pas partie de cette phase.

```bash
npm run lint
npm run typecheck
npm run format:check
npm run test:catalog
# Base locale avec le seed initial :
npm run test:catalog:db
# Next.js lancé, connecté à la même base :
npm run test:catalog:http
npm run build
npm run start
```

Les tests métier vérifient slugs, disponibilité multi-variantes, Decimal et normalisation des paramètres URL. Les tests DB vérifient le seed, les lectures publiques, UNIQUE, CHECK et les suppressions protégées, avec annulation des écritures de test. Ils vérifient aussi les filtres croisés sur une même variante, les périmètres, les facettes, le tri et la pagination réelle. Les tests HTTP vérifient les pages, les URL normalisées, la pagination, les filtres, les vraies 404, les SKU, les metadata et les assets, puis modifient temporairement le booster de démonstration et restaurent prix / stock dans un `finally`.

Exécuter les tests DB / HTTP uniquement sur la base de développement, après le seed et avant des éditions manuelles qui changeraient les résultats attendus. `TEST_BASE_URL` permet de tester un autre serveur local, par exemple `http://localhost:3001`.

`npm run format` applique Prettier. TypeScript est strict avec `noUncheckedIndexedAccess`. `build` et `typecheck` génèrent le client Prisma. Les scripts Next.js gardent Webpack, compatible avec cet environnement. Arrêter `npm run dev` avant le build de validation pour éviter des écritures concurrentes dans les types générés `.next`. Deux overrides ciblés de la CLI Prisma (`deepmerge-ts`, `mysql2`) sont conservés ; les réévaluer lors d’une mise à jour.

## Panier

Le panier invité est stocké dans PostgreSQL : `Cart` (état, expiration, empreinte du jeton) et `CartItem` (variante et quantité). La migration additive `20260920115557_add_cart` préserve le catalogue. `CartItem(cartId, variantId)` est unique, la quantité est contrainte entre 1 et 99. Supprimer un panier supprime ses lignes (`Cascade`) ; supprimer une variante référencée est interdit (`Restrict`). Désactiver une variante plutôt que la supprimer. Aucun modèle User ni prix figé ajouté.

Le cookie `caldera_cart` contient uniquement un jeton cryptographique aléatoire de 256 bits. Seule son empreinte SHA-256 est enregistrée en DB ; l’ID du panier n’est pas une autorisation. Cookie HTTP-only, SameSite=Lax, Path=/, Secure en production, durée 30 jours. Utiliser HTTPS en production. Aucun cookie ni panier n’est créé à la simple lecture. La première **mutation d’ajout réussie** crée panier, ligne et cookie. Chaque mutation réussie renouvelle les 30 jours côté DB et cookie. Vider un panier conserve son Cart actif. Pas de stockage navigateur des articles.

Un cookie malformé, inconnu, expiré ou rattaché à un panier inactif donne un état vide. Un ajout ultérieur crée un nouveau panier ; un panier expiré encore ACTIVE passe ABANDONED dans la même transaction. CONVERTED reste intouchable. Les lectures ne modifient pas la DB. Le nettoyage des paniers anciens pourra être programmé ultérieurement ; aucun cron ni suppression automatique ajouté.

`src/lib/cart/` centralise identité, cookie, DTO, lectures, validations et mutations. `mutateCart()` intègre la recherche/création conditionnelle pour garder l’ajout atomique. Les quatre actions publiques `addToCartAction`, `updateCartItemAction`, `removeCartItemAction`, `clearCartAction` obtiennent l’identité exclusivement du cookie serveur. Les IDs et quantités sont validés au runtime ; les lignes sont toujours recherchées dans le panier courant. Une quantité zéro est rejetée avec indication d’utiliser « Supprimer ». Les protections Origin/Host natives de Next.js restent actives.

Chaque ajout ou changement de quantité vérifie la publication du produit, sa catégorie/extension, l’activation de la variante et le stock courant. Les précommandes utilisent le même quota `stockQuantity`. L’ajout cumule les quantités existantes. Transactions Serializable, verrouillage par écriture du Cart et jusqu’à quatre tentatives en cas de conflit empêchent les mises à jour perdues. Maximum 99 unités par variante et 100 références par panier. La sélection ne réserve **et ne décrémente aucun stock**. Deux premières requêtes sans cookie provenant de navigateurs/onglets non encore identifiés peuvent créer deux paniers distincts ; le verrou UI empêche les doubles clics dans une même page. Une fusion entre appareils/identités n’est pas implémentée.

Les lectures chargent uniquement les champs d’affichage et une image par produit, sans coût ni descriptions complètes. Le header, le drawer et la page partagent cette projection bornée ; pas de requête par ligne. Prix actuel et totaux sont calculés avec Prisma Decimal, puis transmis comme chaînes à deux décimales. Le sous-total inclut toutes les lignes conservées, y compris celles signalées indisponibles ; ce n’est pas un montant payable. Le badge compte la **somme des unités**, sans badge à zéro. Une panne de lecture affiche un état indisponible avec réessai, pas un faux panier vide.

`validateCart()` détecte expiration, statut inactif, référence manquante, variante inactive, produit non publié, rupture et dépassement. Les articles invalides restent visibles et supprimables. Une baisse de stock propose explicitement « Mettre à jour à N ». La validation ne constitue pas une réservation : elle est reprise dans le checkout, puis est réexécutée atomiquement au passage au paiement.

Le Header reste serveur. `CartProvider` ne possède aucun état panier mutable : il expose la projection **reçue du serveur**, l’ouverture et les états de requête. Les Server Actions revalident le layout racine, ce qui resynchronise header, drawer et page dans la réponse RSC, sans rechargement complet. Le retour sur l’onglet, l’ouverture du drawer et la navigation relisent le panier. Aucun cache global personnalisé ; `React.cache` déduplique uniquement un rendu. `cookies()` est asynchrone et rend les routes du layout dynamiques, nécessaire au badge personnalisé dans cette configuration sans Cache Components/PPR ; aucune optimisation globale désactivée.

Le `<dialog>` natif latéral mesure au maximum 460 px, 96vw sur petit écran, avec contenu défilant, fermeture Échap/extérieur/bouton, focus contenu dans la modale et retour au bouton panier. Les lignes et contrôles sont communs au drawer et à `/panier`. Les boutons +/- enregistrent immédiatement ; la saisie numérique en panier est validée au blur ou à Entrée. Les opérations en cours désactivent les mutations concurrentes dans l’interface. La page affiche un récapitulatif et une confirmation légère avant vidage. Metadata `noindex, nofollow`. Le CTA « Passer à la commande » démarre maintenant la session de checkout, uniquement pour un panier valide.

Tests avec fixtures propres, créées puis supprimées :

```bash
npm run test:cart:db
# Dans un autre terminal, build de production connecté à la base locale :
npm run build
npm run start -- --port 3001
# Lit les identifiants d’actions du build local (aucun identifiant codé en dur) :
npm run test:cart:http
```

Le test HTTP utilise le protocole Server Actions de la version installée et le manifest local `.next/server/server-reference-manifest.json`. Il vérifie cookie, persistance, RSC actualisé, quantité, appartenance, refus d’Origin étrangère, disponibilité et metadata. Si la compilation change, redémarrer le serveur de test. `TEST_BASE_URL` permet de choisir une autre adresse ; `TEST_ACTION_MANIFEST` permet de viser le manifest d’un serveur de développement compilé.

Validation effectuée : 15 scénarios DB et 7 scénarios HTTP panier ; tests catalogue/produit existants, lint, TypeScript, formatage et build. Aucun navigateur connecté à l’outil de contrôle : vérifier encore visuellement les largeurs 320/390/768/1200/1440 px, Tab/Échap, focus de fermeture, overlay, saisie, ouverture automatique et persistance après fermeture/réouverture réelle du navigateur. Les tests HTTP vérifient la durée du cookie et les requêtes successives, pas la fermeture de l’application navigateur.

## Checkout

`Cart` contient les intentions d’achat ; `CheckoutSession` contient les informations **temporaires et modifiables** qui préparent la commande. Le passage au paiement crée désormais `Order` et `OrderItem` en snapshots. Le checkout reste invité : aucun compte requis, aucun nouveau cookie. Chaque action retrouve le Cart via le cookie HTTP-only puis vérifie que la session demandée appartient à ce Cart. Les actions n’acceptent aucun sous-total, frais ou total fourni comme vérité par le client.

La migration additive `20260920121659_add_checkout_and_shipping` ajoute :

- `CheckoutSession` : Cart, statut, contact, choix de facturation, livraison choisie, montant temporaire, empreinte de validation et expiration.
- `CheckoutAddress` : une adresse SHIPPING et éventuellement une BILLING par session, avec unicité `(checkoutId, role)`. Si la facturation est identique, une seule adresse est stockée et réutilisée. Les données sont copiées dans `OrderAddress` au passage au paiement.
- `ShippingMethod` : code unique, type HOME_DELIVERY/EXPRESS, prix Decimal, seuil de gratuité optionnel, délais configurés, activation, indicateur de démonstration et tri.
- `ShippingCountry` : code ISO alpha-2, nom, activation, relation plusieurs-à-plusieurs avec les modes. Pas de CSV de pays.

Supprimer un Cart supprime ses sessions puis leurs adresses (Cascade). Supprimer une méthode encore référencée est interdit (Restrict) : la désactiver. Les pays des adresses sont conservés comme codes de snapshot, indépendamment de la suppression d’une configuration pays. Une destination retirée devient invalide à la prochaine lecture. Contraintes SQL sur les montants non négatifs, codes pays et délais cohérents.

### Démarrage, étapes et persistance

Le bouton panier appelle `startCheckoutAction`, valide le Cart puis crée ou réutilise une session non expirée. Les créations concurrentes sont sérialisées par la même ligne Cart que les mutations du panier. Aucun checkout vide ni nouvelle session à chaque GET. `/checkout` sans panier utilisable redirige vers `/panier`. Un accès direct avec un panier valide mais sans session propose son démarrage explicite.

Étapes : `/checkout?step=contact`, `shipping`, `review`. L’URL ne donne pas d’autorisation : l’état serveur renvoie vers la première étape incomplète. Les liens permettent de revenir en arrière. Un header Caldera simplifié remplace la navigation complète via une petite enveloppe `StorefrontOnly`, sans déplacer les routes existantes ni convertir le Header serveur en Client Component.

L’étape Coordonnées regroupe email/téléphone, identité dans l’adresse de livraison, et adresse de facturation facultativement distincte. `saveContactAction` enregistre le contact et les deux adresses **atomiquement** après validation structurée. Cette action commune évite les états partiels de plusieurs sauvegardes distinctes. Les valeurs validées sont restaurées depuis PostgreSQL après refresh ; les champs encore en cours de saisie ne sont pas enregistrés automatiquement. Aucune adresse dans localStorage ou dans un cookie.

Validation runtime centralisée sans nouvelle dépendance : champs obligatoires, longueurs, email, téléphone facultatif, noms libres avec accents/apostrophes/tirets, pays configurés, code postal FR à cinq chiffres, BE à quatre, et règle internationale simple pour les autres configurations. Erreurs par champ, résumé avec liens et focus, labels/names/autocomplete, téléphone `type=tel`, régions facultatives. Aucun journal de données personnelles.

### Livraison de développement

Le seed ajoute **uniquement des exemples**, sans écraser les modifications existantes :

| Code         | Pays              | Prix de démonstration | Gratuité     | Délai de démonstration |
| ------------ | ----------------- | --------------------- | ------------ | ---------------------- |
| DEV-STANDARD | France / Belgique | 5,90 €                | dès 150,00 € | 2–4 jours ouvrés       |
| DEV-EXPRESS  | France            | 12,90 €               | aucun seuil  | 1–2 jours ouvrés       |

Ces modes portent `[Démo]`, `isDevelopment=true` et un avertissement dans l’interface. Ce ne sont ni des règles commerciales définitives ni des contrats transporteur. Configurer les pays, tarifs, seuils et délais réels avant toute ouverture commerciale ; aucun autre pays n’est implicitement desservi. Les pays proposés pour les adresses viennent de ShippingCountry actif ; une destination sans mode actif bloque la livraison. Aucun point relais fictif, API transporteur ou moteur de poids ajouté.

`calculateShipping()` utilise la destination, la méthode active et le sous-total Decimal actuel. Si `subtotal >= freeFromAmount`, montant zéro affiché « Offerte ». `getAvailableShippingMethods()` applique les pays actifs. Les délais ne sont affichés que si les deux bornes existent. Les radios enregistrent la sélection côté serveur ; les frais et le total sont relus après succès, sans supposition optimiste. Après sauvegarde des coordonnées, le choix livraison est effacé et doit être confirmé à nouveau.

### Totaux, validation finale et changements

Le récapitulatif reprend les lignes actuelles du panier : quantité × ProductVariant.price, puis somme en Decimal. `shippingAmount` conservé dans la session est indicatif : les lectures le recalculent avec les règles actuelles. Total provisoire = sous-total + livraison ; avant sélection, affichage explicite « sous-total + livraison », jamais des frais supposés gratuits. Aucun calcul fiscal HT/TVA/TTC inventé, code promo ou frais caché.

`prepareCheckoutAction` appelle `validateCheckout()` dans une transaction Serializable : Cart actif/non vide, produits/variantes actifs, quantités et stock, contact/adresses, pays, méthode et tarif actuels, session non expirée. Alors seulement le statut devient READY_FOR_PAYMENT. Depuis la livraison, « Vérifier mon récapitulatif » effectue cette validation avant d’ouvrir le récapitulatif. Celui-ci montre adresses, contact, livraison et articles, avec liens Modifier. Le bouton « Continuer vers le paiement » prépare la commande et réserve les articles.

L’empreinte serveur de validation couvre les coordonnées, lignes, prix, disponibilité et livraison courants. Si les prix/stock/règles changent extérieurement, le DTO cesse immédiatement de présenter le checkout comme prêt. À l’ouverture ou au retour sur l’onglet, une Server Action de synchronisation recalcule et remet le statut DB IN_PROGRESS si nécessaire ; aucun effet de bord dans le rendu GET. Une mutation du panier invalide les sessions en cours dans **la même transaction**. Une adresse ou méthode modifiée invalide aussi la préparation. À cette étape de validation, le stock n’est pas encore réservé. Le passage au paiement effectue une nouvelle validation atomique.

### Expiration, cache et interface

Expiration absolue après **24 heures**, non prolongée par les interactions. Le Cart conserve sa propre durée de 30 jours. Une session expirée est bloquée dès la lecture, puis marquée EXPIRED par la synchronisation ou l’action de redémarrage. Une reprise crée une nouvelle session vide, sans réutiliser silencieusement les anciennes adresses ; le panier reste présent. COMPLETED n’est jamais réutilisé. Prévoir ultérieurement un nettoyage des sessions expirées et de leurs adresses ; aucun cron ajouté.

Données personnalisées dynamiques, aucun cache global. Server Actions natives avec contrôle Origin/Host conservé ; erreurs techniques génériques, aucun log du formulaire. Lecture cohérente Repeatable Read, mutations Serializable avec reprises bornées des conflits ; aucun accès Prisma dans les composants. Les interfaces partagent des DTO de chaînes monétaires et de champs d’adresse utiles, sans timestamps ou empreintes internes.

Desktop ≥1200 px : formulaire 60 %, résumé 40 % sticky. Mobile/tablette : formulaire puis résumé, et rappel du montant en haut avec lien vers le détail ; champs empilés sous 768 px. Étapes compactes, cibles tactiles, retour de focus sur le titre après navigation, erreurs accessibles. Metadata `noindex, nofollow`.

### Vérifications checkout

```bash
npx prisma migrate dev
npx prisma generate
npm run db:seed
# Redémarrer Next.js après génération du nouveau client Prisma.
npm run test:checkout
npm run test:checkout:db
npm run build
# Dans un autre terminal :
npm run start -- --port 3001
npm run test:checkout:http
```

Tests : validation de champs et seuils Decimal ; 14 scénarios DB (persistance, deux adresses, concurrence, propriété, pays, livraison, gratuité, prix/stock modifiés, expiration, contraintes de suppression) ; 8 scénarios HTTP (routes, actions, redirections, formulaires restaurés, protection CSRF, récapitulatif READY et reprise). Les fixtures sont nettoyées en finally. Les tests HTTP lisent le manifest du build local ; redémarrer le serveur de test après une nouvelle compilation. Les autres suites catalogue/produit/panier vérifient les régressions.

Aucun navigateur connecté à l’outil lors de cette phase. Restent à vérifier manuellement : rendu à 320/390/768/1200/1440 px, Tab/Entrée, autofocus des erreurs, retours arrière/avant, saisie et sélection réelles, changement d’onglet. La persistance serveur, les réponses HTTP, contrôles et redirections sont testés automatiquement ; cela ne remplace pas une validation visuelle.

## Paiement Stripe (phase 8)

Les clés restent absentes du dépôt. L’application refuse les clés live. Dans le Dashboard Stripe, choisir un sandbox de développement ; utiliser des clés du **même environnement**, de préférence une clé restreinte `rk_test_` autorisant création, lecture et annulation des PaymentIntents. Une clé serveur `sk_test_` fonctionne également. Ne jamais transmettre cette clé au navigateur ni la coller dans une conversation. Stockage local dans `.env` ignoré ; coffre de secrets de l’hébergeur pour un déploiement.

Renseigner les valeurs dans `.env` sans écraser DATABASE_URL :

```dotenv
STRIPE_SECRET_KEY=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
STRIPE_WEBHOOK_SECRET=""
APP_URL="http://localhost:3000"
```

La clé publique commence par `pk_test_`. `APP_URL` est l’origine contrôlée du retour Stripe, avec repli sur `SITE_URL` ; HTTPS exigé sauf localhost. La clé publique est intégrée au build : **redémarrer en développement, reconstruire en production** après un changement. Les secrets serveur ne sont jamais renvoyés.

Pour le développement local, la commande suivante utilise la CLI Stripe officielle épinglée via npm, lit la clé TEST de `.env` et écrit automatiquement le secret de cette écoute dans le même fichier (valeurs masquées, permissions 0600). Elle remplace STRIPE_WEBHOOK_SECRET par le secret de l’écoute locale ; laisser le terminal ouvert :

```bash
npm run stripe:listen
```

La première exécution télécharge `@stripe/cli@1.51.0` dans le cache npm. Redémarrer Next.js si les nouvelles variables ne sont pas rechargées. Pour utiliser une CLI installée séparément, [installer Stripe CLI](https://docs.stripe.com/stripe-cli), puis :

```bash
stripe login
stripe listen --events payment_intent.succeeded,payment_intent.processing,payment_intent.payment_failed,payment_intent.canceled,payment_intent.requires_action --forward-to localhost:3000/api/stripe/webhook
```

Copier le secret `whsec_` affiché par cette commande dans `STRIPE_WEBHOOK_SECRET`, puis redémarrer Next.js. Le secret CLI est propre à cette écoute : ne pas le confondre avec celui d’un endpoint Dashboard. Le webhook est obligatoire. Le serveur vérifie la signature sur le corps brut, refuse le mode live et relit l’état du PaymentIntent avant traitement. Réponse 400 pour signature invalide, 500 pour traitement à réessayer, 200 pour succès ou doublon. Les appels réseau Stripe restent hors transaction SQL.

Parcours : ajouter un article disponible → `/checkout` → coordonnées → livraison → récapitulatif → « Continuer vers le paiement » → `/checkout/paiement/[publicId]` → Payment Element → `confirmPayment` → `/commande/[publicId]`. Les méthodes autorisées par Caldera sont la carte bancaire, PayPal et Klarna ; Apple Pay et Google Pay peuvent être proposés en tant que wallets de carte si le domaine, le navigateur et le client sont éligibles. Bancontact, Amazon Pay, MB WAY, Satispay, EPS et les autres moyens dynamiques sont exclus de chaque PaymentIntent. Aucun champ bancaire maison ni donnée carte enregistrée.

`Order.checkoutSessionId` unique empêche plusieurs commandes par session. Le numéro `CAL-année-20 caractères hexadécimaux` utilise 80 bits aléatoires et une contrainte UNIQUE, sans compteur concurrent. `publicId` utilise 256 bits aléatoires. L’accès exige également le cookie du panier propriétaire, y compris après conversion. **Après suppression/remplacement de ce cookie (notamment un nouvel ajout après achat), l’ancienne URL devient inaccessible dans ce navigateur** ; l’historique client / un lien d’accès durable sont hors périmètre.

Les données commerciales sont figées : articles, SKU, langues, prix Decimal, images, contact, adresses SHIPPING/BILLING et livraison. Une modification du catalogue n’altère pas les commandes. Les liens produit/variante des lignes sont SetNull, sans suppression des snapshots. Une réservation garde sa variante en Restrict pour audit. Les commandes empêchent la suppression accidentelle du checkout historique.

Le montant Stripe vient du snapshot serveur. Conversion EUR en centimes via Decimal, sans arrondi implicite (50 à 99 999 999 centimes dans ce flux). Un Payment par Order et un PaymentIntent par tentative, avec clé d’idempotence stable `caldera:order:<id>:v1`. Un refresh ou une réponse réseau perdue réutilise la même clé et les mêmes paramètres. Un échec de carte permet une nouvelle confirmation du même intent tant que la réservation est active. Les changements de tarifs avant réservation nécessitent une nouvelle validation du récapitulatif.

Le panier / checkout sont temporairement verrouillés aux mutations pendant une tentative ouverte. Le lien checkout reprend cette tentative. L’annulation explicite vérifie Stripe, libère le stock si annulé, expire le checkout et permet une nouvelle session avec le panier conservé. Un paiement en traitement n’est pas annulé automatiquement.

La confirmation ne lit jamais `redirect_status` comme preuve : seul le webhook peut produire PAID. Elle affiche les snapshots et le statut DB, sans cache, avec `noindex` et Referrer-Policy no-referrer. Une vérification toutes les 3 secondes est bornée à une minute, puis une actualisation manuelle est proposée. Le webhook de succès convertit Cart en CONVERTED ; son badge revient à zéro, et le prochain ajout crée un nouveau panier.

### Gestion du stock

- `stockQuantity` : quantité physique (ou quota de précommande).
- `reservedQuantity` : quantité actuellement engagée par des commandes ouvertes.
- `availableQuantity()` : physique moins réservé. Une **colonne PostgreSQL générée, en lecture seule**, expose la même expression pour les filtres SQL et la pagination. Ne jamais la saisir dans Studio ou Prisma.
- `StockReservation` : quantité, commande, variante, expiration, ACTIVE / CONSUMED / RELEASED / EXPIRED.

La migration `20260920125644_add_orders_payments_stock_reservations` est additive. Les variantes existantes commencent à zéro réservé. Contraintes DB : `0 <= reservedQuantity <= stockQuantity`, quantités positives, totaux cohérents. Les réservations utilisent une mise à jour SQL paramétrée conditionnelle `stockQuantity - reservedQuantity >= quantité`, puis vérifient qu’une ligne a été modifiée. Création de commande et réservation font partie de la même transaction Serializable, avec reprises bornées et verrous dans l’ordre Cart → Order → variantes triées.

```text
Cart → Checkout READY_FOR_PAYMENT
  → revalidation des prix / livraison / disponibilité
  → transaction : Order PENDING_PAYMENT + snapshots + réservation + Payment
  → PaymentIntent idempotent (hors transaction SQL)
  → Payment Element / confirmPayment
  → webhook signé : contrôle montant / devise / metadata / mode test
  → transaction : consommation + Order PAID + Payment SUCCEEDED
                + Checkout COMPLETED + Cart CONVERTED
```

Le succès consomme `stockQuantity` et `reservedQuantity` une seule fois, avec réservation CONSUMED. L’échec conserve temporairement la réservation. PROCESSING conserve le stock jusqu’à un résultat définitif. PAID est irréversible dans ces handlers ; un ancien échec ne le dégrade pas. `StripeWebhookEvent.stripeEventId` unique et l’état de la commande protègent aussi contre différents événements de succès.

TTL centralisé : **20 minutes**. La date seule ne libère rien : un paiement peut encore être en traitement. Le préflight serveur et le bouton empêchent les nouvelles confirmations après expiration ; l’annulation Stripe protège aussi contre une page périmée.

```bash
npm run stock:expire
```

Cette commande traite jusqu’à 100 commandes échues, les plus anciennement inspectées en premier. **Aucun cron n’est installé** : exécuter régulièrement en local et programmer cette commande chaque minute dans l’environnement de déploiement. Elle annule Stripe avant libération, conserve les réservations PROCESSING/SUCCEEDED en attendant le webhook, et réessaie les erreurs réseau au passage suivant. Si aucun appel Stripe n’a commencé, elle libère sous verrou sans réseau. Une création dont la réponse a été perdue est récupérée avec la même clé ; après 23 heures d’ambiguïté, PAYMENT_REVIEW évite de recréer un intent après expiration de l’idempotence Stripe. Cet incident nécessite une vérification humaine dans Stripe/DB, sans libération aveugle. Un succès sans réservations cohérentes produit également PAYMENT_REVIEW et Payment SUCCEEDED ; aucun remboursement automatique.

### Tests du paiement

```bash
npm run test:payments
npm run test:payments:db
npm run build
# Terminal séparé : secret fictif exclusivement pour tests HTTP sans compte Stripe
STRIPE_WEBHOOK_SECRET=whsec_local_http_test_only npm run start -- --port 3001
npm run test:payments:http
```

Les tests DB/HTTP créent et nettoient leurs fixtures sur la base de développement ; ils ne doivent pas être exécutés sur la production. Les tests DB remplacent uniquement la frontière réseau Stripe. Les tests HTTP simulent la finalisation métier en DB ; ils ne constituent pas un paiement réel. Les signatures sont testées avec les fonctions officielles du SDK et le rejet HTTP avec le serveur local.

Pour la recette réelle, utiliser uniquement les [moyens de test officiels Stripe](https://docs.stripe.com/testing) dans Payment Element : succès, refus, 3DS, puis vérifier le webhook et la commande dans PostgreSQL. Ne pas utiliser une vraie carte. Un `stripe trigger` générique ne correspond pas nécessairement aux metadata / montants d’une commande Caldera ; réaliser le parcours de la boutique.

Recette serveur Stripe TEST effectuée le 20 septembre 2026 : clés publique/serveur concordantes, succès et vrai webhook signé (Order PAID, Payment SUCCEEDED, stock consommé, panier CONVERTED), refus et webhook PAYMENT_FAILED sans consommation, annulation/libération, authentification REQUIRES_ACTION reçue par webhook. Tous les webhooks ont répondu HTTP 200. Aucun débit réel. Les données locales de recette ont été nettoyées ; les paiements TEST Stripe et traces d’événements restent disponibles pour audit.

Pour reproduire ces essais, avec Next.js et `npm run stripe:listen` actifs :

```bash
npm run test:stripe:sandbox
```

Cette commande est volontairement distincte des suites hors réseau : elle crée trois vrais PaymentIntents **TEST** avec des produits locaux temporaires et des données fictives. Elle refuse les clés live et une base distante. Elle vérifie aussi la réutilisation du même intent et la clé publique. Les essais utilisent les moyens de test officiels Stripe, sans données carte brutes. En cas de tentative non terminale, elle conserve les fixtures pour vérification au lieu de libérer aveuglément le stock.

**Restent à valider dans le navigateur** : Payment Element, parcours `confirmPayment`, défi 3DS complet, erreurs utilisateur, rendu mobile et navigation clavier. Aucun navigateur de contrôle n’était connecté lors de la recette. Les moyens asynchrones / wallets ne sont pas déclarés testés. Le contrôle serveur REQUIRES_ACTION ne vaut pas validation interactive de 3DS.

## Périmètre restant

Catalogue, panier, checkout, commandes et paiement Stripe TEST sont implémentés sur PostgreSQL. Les produits et tarifs de livraison restent des démonstrations. Stripe Tax et Invoicing sont planifiés dans `docs/stripe-integration-plan.md` mais non activés. L’administration interne est implémentée en phase 9. La préparation, le suivi manuel et les emails transactionnels Resend sont implémentés en phase 10 (envois désactivés). APIs transporteurs, étiquettes, factures, remboursements automatisés, retours, comptes clients, favoris et codes promo restent hors périmètre. Aucune phase suivante n’est commencée.

## Administration (phase 9)

L’espace interne est disponible sur **http://localhost:3000/admin**. Sans session valide, les pages et actions redirigent vers `/admin/login`. Aucun compte administrateur par défaut ni inscription publique. Le panier invité reste indépendant.

### Installation et premier administrateur

```bash
npm install
# Conserver votre .env existant : ne pas l’écraser.
# Ajouter BETTER_AUTH_SECRET avec une valeur générée par :
openssl rand -hex 32
# Coller uniquement dans .env : BETTER_AUTH_SECRET="valeur générée"
docker compose up -d
npx prisma generate
npx prisma migrate dev
npm run admin:create
npm run dev
```

Un secret admin aléatoire a déjà été ajouté au `.env` local pendant cette phase, sans afficher sa valeur. Il reste à créer **votre** administrateur avec `npm run admin:create` : email, nom, mot de passe de 12 à 128 caractères saisi deux fois sans écho. Le script ne remplace pas un compte existant et ne conserve aucun mot de passe en clair. La base doit être joignable. Aucun administrateur de test n’est conservé.

En déploiement, utiliser `npx prisma migrate deploy`, une origine `APP_URL` HTTPS correspondant au site et un `BETTER_AUTH_SECRET` propre à l’environnement. Ne pas réutiliser les secrets de développement. La rotation du secret invalide les cookies signés existants.

### Authentification et sessions

Better Auth **1.7.5**, adaptateur Prisma ; mots de passe **scrypt**, algorithme fourni par la bibliothèque. Le hash est dans `AdminAccount.password`, compte `credential` associé à `AdminUser` : ce choix respecte le schéma de Better Auth plutôt que de dupliquer un `passwordHash`. `AdminSession` conserve les sessions serveur ; cookie signé `caldera_admin.session_token` (préfixe Secure en production), HttpOnly, SameSite=Lax, Secure en production. Expiration absolue de **8 heures**, sans renouvellement automatique ni cache des sessions dans le cookie.

Chaque lecture admin et chaque mutation vérifie la session et relit `AdminUser.isActive` / rôle ADMIN. Les transactions de mutation recontrôlent aussi l’admin. Désactiver un admin bloque ses requêtes suivantes ; la déconnexion supprime la session en base et le cookie. Les pages sont dynamiques, privées, `noindex, nofollow`, absentes du sitemap. Les contrôles CSRF / Origin de Next.js et Better Auth sont conservés. Aucun endpoint générique `/api/auth` n’est monté : seules les actions explicites de connexion et déconnexion sont accessibles.

Limitation persistée dans PostgreSQL : 5 essais par email normalisé et haché sur 15 minutes, plus 60 essais globaux par minute. Les messages ne révèlent pas l’existence d’un compte. Les entrées de limitation de plus de 24 heures sont purgées lors des essais suivants. `lastLoginAt` est enregistré après connexion réussie.

### Utilisation

- `/admin` : compteurs PostgreSQL, alertes simples, dernières commandes et 20 dernières actions d’audit. Le montant cumulé inclut uniquement les commandes PAID, sans comptabilité ni gestion des remboursements.
- `/admin/produits` : recherche nom/slug/SKU/code-barres, filtres, tri et pagination serveur de 25 produits.
- `/admin/produits/nouveau` : création DRAFT. Puis fiche `/admin/produits/[id]` pour variantes, prix Decimal, images, tags et publication. Une publication exige une variante active, SKU et prix valides, catégorie et extension actives. Une image n’est pas obligatoire : les placeholders existants restent utilisés.
- `/admin/stocks` : stock physique, réservé et disponible ; réapprovisionnement par delta et correction absolue motivée. Historique récent et réservations associées dans la fiche produit.
- `/admin/categories`, `/admin/extensions` : création, modification et désactivation ; aucun hard delete. Les cycles de catégories sont refusés. Logos/symboles d’extension : chemins locaux `/assets/` ou `/media/`.
- `/admin/commandes` : recherche numéro/email/ID public/SKU, filtres de statuts, dates, livraison, tri et pagination. `/admin/commandes/[id]` affiche les snapshots, adresses, paiement, réservations, chronologie et note interne.

Dates affichées et filtres de commandes en **Europe/Paris**, format français. Les prix/coûts saisis acceptent virgule ou point, au plus deux décimales. Le coût d’achat reste interne. Les modifications concurrentes d’une fiche produit, d’une variante, d’une note ou du stock absolu sont détectées ; recharger avant de recommencer. La date de publication est éditoriale, pas un mécanisme de publication programmée.

### Stock, commandes et audit

```text
Admin authentifié
  → Server Actions : session, liste blanche, validation
  → Services admin / catalogue / inventaire
  → Transactions Prisma
  → PostgreSQL

Annulation d’une commande impayée
  → service d’annulation existant
  → vérification Stripe hors transaction SQL
  → libération des réservations seulement si autorisée
```

`InventoryAdjustment` conserve auteur, variante, type, quantité précédente, delta, nouvelle quantité et motif. Stock et historique sont écrits dans la même transaction Serializable avec reprises bornées. Le verrou de variante empêche les pertes de mises à jour concurrentes. Un nouveau stock inférieur au réservé est refusé. `reservedQuantity` n’a aucun champ de saisie ; `availableQuantity` reste la colonne PostgreSQL générée. Réapprovisionnement/retour ajoutent du stock ; dommage/perte en retirent. Aucune suppression manuelle de réservation.

Les snapshots `OrderItem`, les montants et les champs `Payment` ne sont jamais éditables. L’annulation n’est proposée que pour PENDING_PAYMENT / PAYMENT_FAILED et appelle le service existant, qui peut encore la refuser si Stripe a évolué. PAID, PROCESSING et PAYMENT_REVIEW ne sont pas annulables depuis cet écran. Aucun faux paiement réussi ni remboursement ajouté. Le workflow d’expédition est décrit dans la section Phase 10 ci-dessous.

`AdminAuditLog` est écrit lors des créations/modifications/publications, changements de prix/activation, ajustements, opérations d’images, catégories/extensions et actions autorisées sur les commandes. L’interface ne permet ni édition ni suppression du journal. Les metadata contiennent des identifiants et valeurs limitées, jamais secrets, mots de passe, données bancaires ou contenu des notes internes. Les relations d’historique sont Restrict.

### Stockage des images

Interface `ImageStorage` : upload / delete / getPublicUrl, implémentation locale sans fournisseur cloud. En développement : `.data/uploads`, ignoré par Git. Servies par `/media/[filename]`, avec nom UUID aléatoire, type WebP, `nosniff`, cache immutable. `next/image` optimise ces visuels.

Validation serveur : taille **5 Mo**, extensions et MIME JPEG/PNG/WebP concordants, décodage réel, maximum **20 millions de pixels**, rejet des images animées. Sharp **0.35.4** réoriente, limite le visuel à 2400 × 2400, réencode en WebP et retire les metadata. La limite Next.js des Server Actions est 6 Mo pour permettre l’enveloppe multipart ; la limite image reste 5 Mo.

La galerie gère alt, ordre et image principale, avec index unique partiel PostgreSQL pour une seule principale. Retirer une image supprime son entrée de galerie mais **conserve le fichier immuable**, afin de protéger aussi les snapshots créés par un checkout concurrent. Aucun nettoyage automatique de fichiers anciens dans cette phase. L’adaptateur `delete` sert notamment à compenser un échec d’enregistrement après upload. Les assets de marque dans `/public/assets` ne sont jamais supprimés.

En production, **configurer `UPLOAD_DIR` vers un volume persistant partagé entre les instances**, accessible au processus Node, et sauvegarder ce volume avec PostgreSQL. Sans cette variable, l’upload en production est refusé. Un disque éphémère/serverless n’est pas un stockage de production adapté. Aucun cloud n’a été provisionné.

### Cache et vérifications

Le catalogue conserve ses lectures PostgreSQL non persistées. Les actions invalident les pages concernées : fiche produit (ancien et nouveau slug), listes catalogue, catégories, extensions, nouveautés/précommandes et vues admin. Aucun `revalidatePath('/', 'layout')` dans l’admin ; la homepage seule est invalidée pour ses sélections.

```bash
npm run test:admin:db
npm run lint
npm run build
# Autre terminal, build de production local dédié à la recette :
APP_URL=http://localhost:3001 UPLOAD_DIR="$PWD/.data/uploads" npm run start -- -p 3001
# Puis :
npm run test:admin:http
```

Ne pas lancer `next dev` et `next build` simultanément dans le même répertoire `.next`. Les tests admin refusent une DB distante ou un environnement NODE_ENV=production ; ils ciblent le **serveur** de production local et nettoient leurs comptes et données métier temporaires. Les clés Stripe ne sont pas utilisées pour ces tests admin : l’annulation testée concerne une tentative sans appel Stripe commencé. Les suites de paiement existantes couvrent les courses entre annulation, webhook et réservation.

Les validations détaillées et l’inventaire des fichiers sont dans [docs/phase-9.md](docs/phase-9.md). Un navigateur de contrôle n’étant pas connecté, restent à valider manuellement à 768/1024/1440 px : grilles, tableaux défilants, focus clavier, tiroir de navigation, dialogues de confirmation et formulaires interactifs. Les réponses HTTP authentifiées et l’optimisation d’images sont vérifiées automatiquement.

## Emails transactionnels

Phase 10 : **Resend**, isolé derrière `EmailProvider` (`src/lib/email/provider.ts`), appelé avec `fetch` côté serveur. Aucune dépendance email supplémentaire. Les deux templates HTML / texte sont dans `src/emails/templates.ts`. Ils utilisent exclusivement les snapshots de commande, sans coûts, notes internes ni informations bancaires.

**Les envois réels restent désactivés**, conformément au choix actuel. Aucun destinataire de recette ni domaine expéditeur n’a été validé. Les emails sont enregistrés et consultables depuis la commande admin même sans clé Resend.

| Variable                 | Configuration                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `EMAILS_ENABLED`         | `false` par défaut ; activer explicitement après configuration                                                   |
| `EMAIL_PROVIDER_API_KEY` | Clé Resend serveur, uniquement dans `.env` local ou le gestionnaire de secrets du déploiement                    |
| `EMAIL_FROM`             | Expéditeur autorisé, par exemple `Les Terres de Caldera <commandes@votre-domaine.fr>`                            |
| `EMAIL_REPLY_TO`         | Facultatif, adresse de réponse valide                                                                            |
| `EMAIL_TEST_RECIPIENT`   | Obligatoire en développement et sur localhost, destinataire unique de tous les essais ; sujets préfixés `[TEST]` |
| `ORDER_ACCESS_SECRET`    | Secret aléatoire d’au moins 32 caractères pour les liens personnels de consultation                              |
| `APP_URL`                | Origine publique HTTPS en production ; `http://localhost:3000` pour le développement                             |

`ORDER_ACCESS_SECRET` a été généré dans le `.env` local sans afficher sa valeur. Pour un autre environnement, générer un secret distinct (`openssl rand -hex 32`) et le renseigner dans son gestionnaire de secrets. Conserver le `.env` existant ; ne pas l’écraser avec l’exemple.

Avant un envoi réel, valider le domaine et ses enregistrements SPF/DKIM dans Resend, configurer l’expéditeur et une adresse de test, puis activer `EMAILS_ENABLED`. L’origine et le logo doivent être accessibles publiquement pour un destinataire distant : les URL localhost ne sont utiles que sur la machine de développement. Aucun domaine n’est déclaré vérifié par ce projet.

```text
Webhook Stripe vérifié
  → transaction : Order PAID + EmailDelivery ORDER_CONFIRMATION PENDING
  → commit
  → processeur email
  → API Resend
  → SENT (accepté par le fournisseur)
```

La contrainte PostgreSQL unique `(orderId, type)` protège l’outbox contre les doubles webhooks / doubles actions. Aucun email ne part à la création d’un PaymentIntent, au retour navigateur ou à la création d’un brouillon d’expédition. Aucune confirmation rétroactive n’est créée pour les anciennes commandes déjà payées avant cette migration.

Le processeur prend possession du travail avec `FOR UPDATE SKIP LOCKED`, un bail de **5 minutes** et un jeton de possession. L’appel réseau se fait **hors transaction métier**, avec un délai maximum de 10 secondes. L’enveloppe complète (destinataire, texte, HTML, lien signé) est figée avant le premier appel, et chaque tentative réutilise la clé `caldera-email:<id>`. Un changement de destinataire de test ne réécrit jamais une enveloppe déjà figée : il bloque son envoi pour vérification.

Resend conserve ses [clés d’idempotence pendant 24 heures](https://resend.com/docs/dashboard/emails/idempotency-keys). Par prudence, toute reprise après **23 heures depuis la première tentative** est bloquée pour vérification chez le fournisseur, y compris après un crash ou un retry manuel retardé. Ce mécanisme évite de présenter une garantie illimitée d’envoi unique que le fournisseur ne propose pas. Un timeout peut signifier que Resend a accepté l’email : ne jamais effacer la ligne ou changer sa clé pour forcer un nouvel envoi.

Maximum **5 tentatives**. Les échecs passent à `FAILED`, avec code contrôlé et reprise différée (1, 2, 4, 8 minutes entre les cinq tentatives). Un `SENDING` abandonné peut être repris après expiration du bail, dans la même fenêtre d’idempotence. L’admin peut réessayer un `FAILED` éligible ; un `SENT` ne peut pas être renvoyé. Un problème Resend ne remet jamais en cause le paiement, le stock consommé ou l’expédition.

`SENT` signifie **accepté par le fournisseur**, pas réception effective. L’identifiant Resend est conservé ; les bounces / plaintes / webhooks de délivrabilité sont reportés. Un défaut de configuration globale laisse la file en attente ; consulter les logs contrôlés et la configuration. Aucun corps de réponse fournisseur brut ou secret n’est journalisé.

```bash
npm run emails:process
```

La commande traite au plus 50 emails par exécution et n’envoie rien avec `EMAILS_ENABLED=false`. Un traitement limité est aussi tenté avec `next/server.after` après le webhook et les actions logistiques/retry. **Aucun scheduler n’est installé** : en production, planifier cette commande côté hébergeur (par exemple chaque minute, avec accès aux mêmes secrets et à PostgreSQL) pour garantir la reprise des échecs sans attendre une autre commande. Aucune route cron publique ajoutée.

Les aperçus `/admin/emails/[id]/preview` exigent une session admin, sont privés/no-store/noindex et interdisent les scripts. Avant tentative, ils rendent le snapshot ; après tentative, ils montrent exactement le HTML figé. L’outbox contient des données personnelles de commande : appliquer les protections et sauvegardes de la base, et éviter sa copie vers un environnement de test avec envois activés.

## Préparation et expédition

Le statut financier `Order.status` et `Payment.status` reste indépendant de `Order.fulfillmentStatus`. Le webhook confirme uniquement le paiement et initialise `UNFULFILLED`.

```text
Order PAID + Payment SUCCEEDED + réservations CONSUMED
  → UNFULFILLED
  → PREPARING       (Commencer la préparation)
  → READY_TO_SHIP   (Commande prête à expédier)
  → Shipment DRAFT (transporteur et suivi saisis)
  → SHIPPED        (remise réelle au transporteur confirmée par l’admin)
  → EmailDelivery ORDER_SHIPPED PENDING
  → suivi client
  → DELIVERED      (confirmation manuelle uniquement)
```

Depuis `/admin/commandes` : vues À traiter, En préparation, Prêtes, Expédiées, Toutes ; filtres distincts paiement / fulfillment / échecs email ; recherche numéro, email, SKU, ID public et tracking ; tris date commande, paiement, expédition. Le dashboard affiche à préparer, en préparation, prêtes, expédiées aujourd’hui (journée de Paris) et alerte emails échoués.

Le détail `/admin/commandes/[id]` expose seulement l’action suivante autorisée. Les commandes impayées, paiements incohérents et réservations non consommées sont refusés côté serveur. Aucune régression de statut, annulation de commande payée, remise en stock ou remboursement simpliste. Les actions utilisent les transactions/verrous existants et créent des `AdminAuditLog` avec auteur et vraie date.

`Order` possède 0..n `Shipment`, mais l’interface traite un seul colis principal, protégé par un index unique partiel. Statuts : `DRAFT`, `SHIPPED`, `DELIVERED`. Les dates d’expédition et livraison sont écrites uniquement lors de leurs transitions ; celles de préparation sont conservées sur la commande. Il n’y a pas de moteur d’envois partiels.

Transporteurs centralisés : Colissimo, Mondial Relay, Chronopost, UPS, DHL, Autre. Mondial Relay dispose désormais d’une intégration dédiée pour le choix du point, la création de l’expédition, l’étiquette et le suivi. Les autres transporteurs restent manuels. Le numéro est une chaîne trimée, limitée à 100 caractères ; les zéros initiaux sont conservés.

Un brouillon reste modifiable avec détection de version concurrente. Après expédition, seule l’action explicite **Corriger le suivi**, avec motif obligatoire, modifie les données de suivi et produit un audit ; elle ne change pas `shippedAt`, ne crée aucun second email et ne réécrit pas le snapshot de l’email original. Le client voit les informations corrigées sur sa page de commande.

`/commande/[publicId]` conserve le cookie invité pour le parcours existant et ajoute des liens email signés HMAC, **lecture seule pendant 180 jours**, limités à une commande payée. Une URL sans cookie propriétaire ni signature valide n’expose aucune donnée personnelle. Le token ne permet pas d’accéder aux actions/API de paiement. Les pages restent noindex/nofollow et no-referrer ; ne pas partager ces liens personnels. Tourner `ORDER_ACCESS_SECRET` invalide globalement les liens existants. La timeline utilise uniquement les vraies dates enregistrées ; le lien transporteur s’ouvre avec `noopener noreferrer`. Aucun délai de livraison ni suivi temps réel inventé.

Le **bon de préparation**, `/admin/commandes/[id]/bon-preparation`, est réservé à l’admin et aux commandes payées : snapshots, images, SKU très visibles, langues, quantités, adresse et mode de livraison. Bouton d’impression et SCSS print retirant la navigation. Ce n’est ni une facture ni une étiquette transporteur ; aucun coût, note privée ou secret de paiement.

```bash
npx prisma generate
npx prisma migrate dev
npm run test:fulfillment:db
npm run test:payments:db
npm run test:admin:db
npm run lint
npm run build
# Serveur de recette séparé :
APP_URL=http://localhost:3001 UPLOAD_DIR="$PWD/.data/uploads" npm run start -- --port 3001
# Dans un autre terminal :
npm run test:admin:http
npm run test:payments:http
```

Recette et inventaire exact des fichiers : [docs/phase-10.md](docs/phase-10.md). Les tests email utilisent un fournisseur simulé : aucun email Resend réel n’a été envoyé. Restent la configuration du fournisseur, la réception sur une adresse choisie, la vérification visuelle desktop/mobile et l’aperçu d’impression dans un navigateur. Ne pas lancer `next dev` pendant `next build`.

Configuration, architecture et recette Mondial Relay : [docs/mondial-relay.md](docs/mondial-relay.md).
