# Architecture SEO — Les Terres de Caldera

Ce document est le contrat de l’architecture SEO : modèle de données, URL, indexation, métadonnées, données structurées, maillage, sitemaps. Toute page publique passe par ces règles ; aucune métadonnée n’est écrite à la main page par page.

## 1. Principes

- **Vérité des données.** Prix, stock, disponibilité, dates, langues et comptes affichés, écrits dans les titles/descriptions ou dans le JSON-LD viennent de la base. Aucune note, aucun avis, aucune promotion, aucune rareté inventés.
- **Une URL indexable = une intention + assez de produits.** Une route existe pour l’utilisateur ; elle n’est envoyée à Google (index + sitemap) que si `decideIndexation()` le décide.
- **URL propres, paramètres jamais indexés** sauf `?page=N` sur une page indexable.
- **Le JSON-LD décrit exactement le visible.**
- **Évolutif** : pensé pour plusieurs jeux, des milliers d’extensions et 50 000 produits ; aucun contenu écrit en dur par entité.

## 2. Modèle de données (migration additive)

```prisma
model Game {                       // jeu / licence : Pokémon, One Piece, Magic…
  id             String   @id @default(uuid()) @db.Uuid
  name           String            // « Pokémon »
  slug           String   @unique  // « pokemon » → /pokemon
  shortName      String?           // libellé court de menu
  description    String?           // accroche courte (≤ 300)
  intro          String?  @db.Text // texte éditorial (Markdown) du hub
  seoTitle       String?           // surcharge du title généré (≤ 70)
  seoDescription String?           // surcharge de la meta description (≤ 170)
  faq            Json?             // [{ "question": string, "answer": string }]
  logoUrl        String?
  sortOrder      Int      @default(0)
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  sets           TcgSet[]
  products       Product[]
}
```

Ajouts :

- `TcgSet.gameId String? @db.Uuid` (→ Game, onDelete Restrict, indexé) + `intro String? @db.Text`, `seoTitle String?`, `seoDescription String?`, `faq Json?`.
- `Category` + `intro String? @db.Text`, `seoTitle String?`, `seoDescription String?`, `faq Json?`.
- `Product.gameId String? @db.Uuid` (→ Game, onDelete Restrict, indexé) + `seoTitle String?`, `seoDescription String?`.
  Règle métier (admin) : si le produit a une extension rattachée à un jeu, `product.gameId = set.gameId` (rempli automatiquement, incohérence refusée). `gameId = null` = produit multi-jeux (accessoire générique).
- `SlugRedirect { id, entityType SlugEntity (PRODUCT|CATEGORY|SET|GAME), fromSlug, entityId Uuid, createdAt, @@unique([entityType, fromSlug]) }` : écrit dans la même transaction qu’un changement de slug ; les routes le consultent avant de répondre 404 et font un `permanentRedirect` (308) vers l’URL canonique actuelle.

La catégorie représente la **famille de produits** (Produits scellés › Boosters / ETB / Coffrets / Displays…, Cartes à l’unité, Accessoires), transversale aux jeux. Le jeu est un axe orthogonal. Il ne faut plus de catégorie racine « Pokémon ».

## 3. URL

| URL                                                                        | Page                                               | Source                                |
| -------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------- |
| `/{jeu}`                                                                   | hub jeu                                            | `src/app/[game]/page.tsx`             |
| `/{jeu}/{facette}`                                                         | landing 1 facette                                  | `src/app/[game]/[...facets]/page.tsx` |
| `/{jeu}/{facette}/{facette}`                                               | landing 2 facettes                                 | idem                                  |
| `/produit/{slug}`                                                          | fiche produit (URL canonique courte et stable)     | existante                             |
| `/categorie/{slug}`                                                        | hub famille multi-jeux                             | existante                             |
| `/extensions`                                                              | index des extensions par jeu                       | existante                             |
| `/extensions/{slug}`                                                       | 308 → `/{jeu}/{extension}` si l’extension a un jeu | existante                             |
| `/catalogue`, `/nouveautes`, `/precommandes`, `/en-stock`                  | hubs transverses                                   | existants + `/en-stock`               |
| `/guides`, `/guides/{slug}`                                                | guides, comparatifs, dossiers                      | contenu `content/guides/*.md`         |
| `/glossaire`, `/glossaire/{slug}`                                          | glossaire JCC                                      | contenu `content/glossaire/*.md`      |
| `/calendrier-des-sorties`                                                  | calendrier (TcgSet.releaseDate)                    | base                                  |
| `/calendrier-des-sorties/{annee}`, `/calendrier-des-sorties/{jeu}-{annee}` | sorties d’une année, tous jeux ou un jeu           | base                                  |
| `/questions`, `/questions/{slug}`                                          | réponses courtes (« combien de boosters… »)        | contenu `content/questions/*.md`      |
| `/actualites`, `/actualites/{slug}`                                        | actualités datées (masquées tant que vides)        | contenu `content/actualites/*.md`     |
| `/livraison`                                                               | modes, délais, tarifs réels                        | table ShippingMethod                  |

**Produit retiré définitivement** (`ARCHIVED`) : 308 vers sa landing la plus précise encore indexable (extension, famille, jeu). S’il n’en reste aucune, la fiche répond **410 Gone** (`src/lib/product/gone.ts`, appliqué par `src/proxy.ts` à partir de `/api/seo/gone`, liste relue toutes les 5 minutes sur l’origine configurée, jamais sur l’en-tête Host).

**Calendriers par année** : une page par année et par jeu+année dès `CALENDAR_YEAR_MIN_SETS` (2) extensions datées ; en dessous, page accessible mais `noindex`. Si un seul jeu sort des extensions une année, la page tous jeux est canonisée vers celle du jeu.

### Facettes (sous `/{jeu}`)

Dimensions et ordre canonique : **extension → famille → langue → statut**.

| Dimension | Slugs                                                                | Source                              |
| --------- | -------------------------------------------------------------------- | ----------------------------------- |
| extension | `TcgSet.slug` (extension du jeu)                                     | base                                |
| famille   | `Category.slug` (inclut les descendants)                             | base                                |
| langue    | `francais`, `anglais`, `japonais`, `allemand`, `espagnol`, `italien` | `ProductLanguage` (niveau variante) |
| statut    | `en-stock`, `precommandes`, `nouveautes`                             | stock / `preorder` / `newArrival`   |

Combinaisons autorisées (2 facettes maximum) : extension, famille, langue, statut, extension+famille, extension+langue, extension+statut, famille+langue, famille+statut. Toute autre combinaison ou un ordre non canonique : 308 vers l’ordre canonique si les facettes sont valides, sinon 404.

Espace de noms : un slug d’extension, de famille, de langue, de statut et les slugs réservés ne peuvent pas se chevaucher. Les slugs de jeu ne peuvent pas prendre un segment racine réservé (`RESERVED_ROOT_SLUGS` dans `src/lib/seo/facets.ts`). L’admin valide ces contraintes.

## 4. Indexation (`src/lib/seo/indexation.ts`)

`decideIndexation(kind, stats, parentStats?)` renvoie `{ index, reason, canonicalPath }`. Règles :

| Page                                  | Indexable si                                                          | Sinon                                                                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hub jeu                               | ≥ 1 produit visible                                                   | noindex, follow                                                                                                                                            |
| extension, famille (1 facette entité) | ≥ 2 produits                                                          | 0 produit : 200 noindex si l’entité existe (page « bientôt », dates) ; 1 produit : noindex                                                                 |
| langue, statut (1 facette filtre)     | ≥ 2 produits **et** strictement moins que le hub jeu                  | identique au parent : canonical vers le parent ; statut aux mêmes produits que `/{statut}` : canonical vers ce hub ; 0 produit : 404                       |
| extension+famille                     | ≥ 2 produits **et** strictement moins que l’extension seule           | identique : canonical vers l’extension ; 0 : 404                                                                                                           |
| combinaisons avec langue/statut       | ≥ 2 produits **et** strictement moins que le parent entité            | identique : canonical parent ; 0 : 404                                                                                                                     |
| `/categorie/{slug}`                   | ≥ 2 produits **et** (≥ 2 jeux distincts **ou** des produits sans jeu) | un seul jeu : canonical vers `/{jeu}/{famille}`                                                                                                            |
| hubs transverses                      | ≥ 2 produits (`/catalogue` : ≥ 1)                                     | noindex, follow                                                                                                                                            |
| produit                               | statut ACTIVE, catégorie/extension/jeu actifs, ≥ 1 variante active    | aucune variante active : 200 noindex sans JSON-LD Product ; ARCHIVED : 308 vers le meilleur parent indexable ; DRAFT/inexistant : 404 (après SlugRedirect) |
| `?page=N`                             | si la page de base est indexable : self-canonical `?page=N`           | noindex                                                                                                                                                    |
| filtres, tri, recherche, prix         | jamais                                                                | noindex, follow ; tri/recherche/prix aussi bloqués dans robots.txt                                                                                         |

Un noindex n’est jamais combiné à un canonical vers une autre URL. Les pages non indexables ne sont ni dans les sitemaps ni ciblées par le moteur de maillage.

## 5. Métadonnées (`src/lib/seo/metadata.ts`)

- Layout : `title.template = '%s | Caldera'`, `default`, `openGraph` (siteName, locale fr_FR, type website, image par défaut), `twitter.card = summary_large_image`.
- `buildMetadata({ title, description, path, index, image?, type? })` produit `title`, `description`, `alternates.canonical` absolu (`siteOrigin()`), `robots`, `openGraph`, `twitter`.
- Générateurs par intention, tous fondés sur des données réelles :
  - hub jeu : « {Jeu} : boosters, ETB et coffrets en stock » (familles réellement présentes) ;
  - extension : « {Extension} ({Jeu}) : {familles présentes} – prix et stock » ;
  - famille : « {Famille} {Jeu} : prix et disponibilité » ;
  - extension+famille : « {Famille} {Jeu} {Extension} – prix et stock » ;
  - langue : « {Famille?} {Jeu} en {langue} » ; statut : « Précommandes {Jeu} » / « {Famille} {Jeu} en stock » / « Nouveautés {Jeu} » ;
  - produit : « {Nom} – {Famille} {Extension} {(langue)} » sans répéter ce que le nom contient déjà.
- Descriptions : faits concrets (nombre de produits, fourchette de prix réelle, en stock / précommande, date de sortie, langues), coupées au mot, ≤ 160 caractères. Surcharges `seoTitle`/`seoDescription` en base prioritaires.

## 6. Données structurées (`src/lib/seo/jsonld.ts`, `src/components/seo/JsonLd.tsx`)

Deux blocs au plus par page : le `BreadcrumbList`, émis par le composant `Breadcrumb` à partir des items visibles (ils ne peuvent donc pas diverger), et un `@graph` pour le reste de la page :

- layout (accueil) : `Organization` (nom, URL, logo, email de contact s’il est public ; ni adresse ni SIREN tant que la société n’est pas immatriculée) + `WebSite` (+ `SearchAction` vers `/catalogue?search=`) ;
- listes : `CollectionPage` + `ItemList` (URLs des produits affichés) ;
- produit : `Product` (name, description, image hors placeholders, sku, gtin13/gtin selon `barcode`, brand = jeu, category, offers : une `Offer` par variante active avec price, priceCurrency EUR, availability réelle, `availabilityStarts` = date de sortie en précommande, itemCondition, url, seller = Organization, `shippingDetails` depuis ShippingMethod, `hasMerchantReturnPolicy` depuis les CGV) ;
- guides : `Article` ; glossaire : `DefinedTerm` (+ `DefinedTermSet` sur l’index) ;
- FAQ : `FAQPage` uniquement quand la FAQ est affichée sur la page.

## 7. Maillage interne (`src/lib/seo/links.ts`)

Liens calculés depuis la base, **uniquement vers des cibles indexables** :

- hub jeu → prochaine sortie et extensions récentes (trois au plus, toutes via `/extensions`), familles, langues, disponibilité (la page du jeu, sinon la liste transverse `/{statut}`), trois guides du jeu, calendrier ;
- extension → familles de l’extension, extensions voisines (même série, précédente/suivante par date de sortie), langues disponibles, guides liés ;
- famille → sous-familles, extensions proposant cette famille, langues ;
- produit → hub jeu, extension, extension+famille, famille du jeu, terme du glossaire lié à son type, guides liés, produits similaires (mix même extension / même famille, priorité au stock) ;
- guide / terme → produits correspondant à ses facettes (front-matter), autres contenus du même cluster ;
- navigation (header/footer) générée depuis les jeux et familles actifs ayant des produits : plus aucun lien cassé.

Les ancres sont descriptives et varient selon le contexte (« Tous les ETB Flammes Obsidiennes », « Boosters Pokémon en japonais », « Voir l’extension Flammes Obsidiennes »).

## 8. Sitemaps et robots

- `/sitemap.xml` : index → `/sitemaps/pages.xml`, `/sitemaps/landings.xml`, `/sitemaps/products-{n}.xml` (10 000 URL par fichier), `/sitemaps/content.xml`.
- Uniquement des URL indexables, `lastmod` = vraie date de modification (produit, variante, contenu), jamais `new Date()`.
- Réponses avec `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
- `robots.txt` : Disallow `/admin`, `/api/`, `/checkout`, `/panier`, `/commande/`, `/compte` (espace client, noindex et `no-store`), `/*?*sort=`, `/*?*search=`, `/*?*minPrice=`, `/*?*maxPrice=`. Ressources `/_next/` et images non bloquées. Hôtes non canoniques : tout bloqué ; `www` redirige en 308 vers l’apex.

## 9. Contenu éditorial

Markdown avec front-matter dans `content/` (versionné, relu), chargé par `src/lib/content/`. Front-matter :

```yaml
title: …
description: … # meta description
kind: guide | comparatif | dossier | glossaire | question | actualite
updated: 2026-09-26
published: 2026-09-26 # obligatoire pour une actualité ; sinon = updated
games: [pokemon] # slugs Game (facultatif)
categories: [etb] # slugs Category (facultatif)
sets: [] # slugs TcgSet (facultatif)
related: [autre-slug] # contenus du même cluster
faq: # facultatif, affiché et balisé FAQPage
  - question: …
    answer: …
```

Où va chaque type :

- `content/guides/` : `guide`, `comparatif`, `dossier`.
- `content/glossaire/` : `glossaire` (le premier paragraphe est la définition).
- `content/questions/` : `question` — le titre est la question, le premier paragraphe la réponse directe (affichée « En bref » et balisée FAQPage).
- `content/actualites/` : `actualite` — `published` obligatoire, balisée BlogPosting. La rubrique, son lien de menu et son sitemap n’apparaissent qu’avec le premier article : aucune actualité n’est inventée.

**Dossier d’extension** : un `dossier` avec `sets: [slug-extension]` s’affiche sur la landing de l’extension (`/{jeu}/{extension}`) et la renforce. À écrire quand l’extension existe en base (slug réel), avec des faits vérifiés : date de sortie, produits, contenu des boosters.

**Autres jeux** : les guides et termes One Piece, Magic et Yu-Gi-Oh! ciblent les slugs `one-piece`, `magic` et `yugioh`. Leurs liens vers la boutique n’apparaissent qu’une fois le jeu créé dans l’admin avec exactement ce slug (et des produits).

Les pages de contenu affichent automatiquement les produits correspondant à leurs facettes (si indexables) : l’éditorial et le commerce se renforcent. Ton concret, pas de formules génériques (« Découvrez notre large sélection… »), aucun chiffre non vérifiable.

## 10. Performance, cache et images

- **CSP stricte à nonce conservée** : toutes les pages HTML sont rendues à la demande. Next 16.3 insère le flux RSC en scripts inline : sans nonce, une CSP statique sans `'unsafe-inline'` bloque l’hydratation, même avec `experimental.sri` (vérifié). Le cache CDN du HTML n’est donc pas activé.
- **Cache partagé des données publiques** (`src/lib/cache/catalogCache.ts`, tag `catalog`) : agrégats, landings, navigation, sélections de l’accueil, liste 410. Jamais de panier, de commande ni de donnée liée à un visiteur. Expiration ≤ 5 minutes pour les prix et stocks, et `invalidateCatalogCache()` après chaque écriture de prix, de stock ou de réservation (admin, création/annulation/expiration de commande, webhook Stripe). Le tunnel de commande relit prix et stock en base.
- **Images** : `npm run images:optimize` recompresse `public/` sur place (PNG palette ou sans perte, JPEG mozjpeg), uniquement si le résultat est plus léger et visuellement identique (PSNR ≥ 40 dB). À lancer après l’ajout d’une image lourde, par exemple les visuels d’univers (`public/assets/images/*.png`).
- **Région** : fonctions Vercel et base dans la même région ; migration vers Francfort décrite dans `docs/migration-europe.md`.

## 11. Observabilité

`npm run seo` : contrôles base (produits sans image/description/jeu, extensions sans jeu ou sans date, catégories vides, slugs en collision) et crawl d’un serveur (`SEO_BASE_URL`, défaut `http://localhost:3000`) à partir du sitemap : title/description présents, uniques et de bonne longueur, canonical absolu, un seul h1, JSON-LD valide, cohérence noindex/sitemap, liens internes cassés, pages orphelines (indexables mais jamais liées).
