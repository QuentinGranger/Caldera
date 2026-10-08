# Navigation cinématique Caldera

Audit et réalisation du 8 octobre 2026.

Révision à la demande de l’utilisateur : cadence ralentie et mouvement plus visible.
L’Univers passe de 620 à 1 400 ms (1 100 ms sur écran étroit), sans délai
ajouté à la navigation. La limite initiale d’une seconde est remplacée par
cette nouvelle demande explicite.

## Architecture vérifiée

- Next.js **16.3.8**, React / React DOM **19.3.0**, App Router.
- Layout racine serveur : polices locales, header, footer, panier et favoris
  persistants. Layouts séparés pour l’administration, le compte, le checkout,
  les alertes et la newsletter. Aucun changement de framework ou de dépendance.
- Les familles sont décrites dans `src/lib/transitions/routes.ts`. Les cinq
  chroniques suivent `src/data/universe.ts` : origines, archives, territoires,
  route-des-cinq, horizons. La matrice existante est conservée.
- L’instrumentation Next appelle `beginNavigation` dans sa transition React.
  Aucun remplacement de `Link`, aucun `preventDefault`, aucun délai avant la
  navigation et aucun chargement artificiel.
- Les paysages proviennent des images existantes : Hero d’accueil, visuels
  administrés de l’Univers, images de `PageHero`, cartes et galerie produit.
- L’ancien moteur cumulait des animations de 850–950 ms et des apparitions CSS
  pouvant dépasser une seconde. Les Heroes pouvaient être capturés alors que
  leur texte était encore transparent. Ces animations d’entrée sont supprimées.

## Moteur et couches

`TransitionStage` porte uniquement un voile décoratif. React `<ViewTransition>`
capture séparément les paysages, les textes et, lorsque possible, l’image produit.
`ArrivalLayers` est un composant serveur sans wrapper HTML ni bundle client ajouté.
Les liens, boutons, formulaires, breadcrumbs, header et footer restent hors des
captures nommées : ils demeurent utilisables pendant le mouvement.

La présentation est libérée par le cleanup natif de React, avec un numéro de
génération pour qu’une ancienne transition ne nettoie pas la suivante. Un garde-fou
de 10 secondes nettoie les attributs décoratifs d’une navigation abandonnée ; il
ne retarde jamais l’affichage. Changement de préférence et `pagehide` nettoient
également la présentation.

Les tokens de durée, profondeur, distances et easing sont regroupés dans
`src/styles/base/_transitions.scss`. Le mouvement anime uniquement `transform`
et `opacity`. Les gradients sont statiques à l’intérieur du voile animé.

## Correspondance des parcours

| Parcours                                                 | Langage                                                                   | Durée desktop / écran étroit |
| -------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------- |
| Accueil → catalogue, catégories, collections, compte     | `shop`, mouvement précis, sans voile                                      | 600 / 480 ms                 |
| Accueil ou boutique → Univers / chronique                | `enter-world`, poussée caméra et ombre traversante                        | 1 400 / 1 100 ms             |
| Univers → chronique                                      | `descend`, profondeur verticale                                           | 1 400 / 1 100 ms             |
| Chronique → Univers                                      | `ascend`, direction inverse                                               | 1 400 / 1 100 ms             |
| Chronique → suivante / précédente                        | `chapter-forward` / `chapter-back`, déplacement latéral de 4.5vw / 2.25vw | 1 400 / 1 100 ms             |
| Univers ou chronique → boutique                          | `leave-world`, paysage qui s’éloigne, brume qui se dissipe                | 1 400 / 1 100 ms             |
| Catalogue ou sélection → produit                         | `product`, image partagée si la paire existe                              | 850 / 650 ms                 |
| Produit → boutique, collection, accueil                  | `product-return`, retour partagé si la carte est visible                  | 850 / 650 ms                 |
| Guides, actualités, glossaire, questions                 | `archive`, texte et lecture                                               | 600 / 480 ms                 |
| Autres grands changements                                | `souffle`, ombre volcanique discrète                                      | 1 400 / 1 100 ms             |
| Pages utilitaires, paiement, administration              | `instant`                                                                 | aucun effet de page          |
| Filtres, recherche dans un catalogue, ancres, historique | navigation / interaction native                                           | aucun effet de page          |

Le numéro de chronique dispose d’une identité partagée distincte et d’un mouvement
typographique de 240 / 200 ms. Dans l’Univers, l’image arrive d’abord, puis les
textes démarrent progressivement à partir de 200 ms (140 ms sur écran étroit).
L’ombre est irrégulière et translucide, avec une faible lumière chaude ; aucun
écran noir, flou animé, particule, vidéo, son ou effet élastique n’est ajouté.

## Produits et chargements lents

- Une seule carte reçoit le nom de transition lors du clic. Son image doit être
  chargée et valide. Le nom encode chaque point Unicode du slug sans collision.
- Seule la grille principale peut recevoir un retour partagé : les carrousels
  secondaires ne nomment pas simultanément des exemplaires du même produit.
- La galerie ne partage que sa première image. Après sélection d’une autre photo,
  le retour utilise la présentation simple, sans morphing vers un visuel différent.
- Si la fiche suspend vers son skeleton avant de livrer son contenu, le navigateur
  ne peut pas former la paire dans le même commit : l’affichage progressif existant
  est conservé. Une fiche déjà disponible peut partager son image. On ne bloque
  pas la route pour attendre les données ou fabriquer artificiellement le morphing.
- Une carte hors écran ou absente n’est pas forcée dans le viewport. Le retour
  navigateur reste prioritaire et ne déclenche pas la chorégraphie de route.

## Accessibilité, compatibilité, SEO et performance

- Détection conjointe de l’API, de `view-transition-class` et des types de
  transition. Si une capacité manque, arrivée CSS des paysages et textes, sans morphing partagé.
  Deux frames après le commit, la même arrivée prend le relais si React n’a
  déclenché aucune capture native (notamment lors d’un rendu progressif).
  Elle ne bloque aucun lien ou bouton, se nettoie après 1 800 ms et ne se
  déclenche jamais sur un refresh, un filtre, une ancre ou un retour navigateur.
- `prefers-reduced-motion: reduce` désactive la chorégraphie dans le runtime et
  toutes les animations de snapshots et de fallback en CSS. Les parallaxes et mouvements ambiants
  existants des Heroes restent dans `no-preference` et leurs `@supports` respectifs.
- Sur écran étroit : déplacements divisés par deux, durées raccourcies, ombre
  parcourant deux fois moins de distance. Aucun blur ajouté.
- Header et footer persistants, aucune capture nommée de `html` ou `main`.
  Les paysages animés sont découpés sous le bord du header pour éviter de le recouvrir.
- Le HTML serveur reste immédiatement visible. URL, liens réels, metadata,
  canonical, JSON-LD, sitemap et permissions restent identiques.
- Le scroll reste géré par Next / le navigateur. Les ancres gardent leur smooth
  scroll ; aucun scroll manuel supplémentaire ni interception de l’historique.
- Aucun coût réseau d’asset ou de bibliothèque supplémentaire. Les anciennes
  animations de texte au premier rendu sont supprimées. Les captures n’entrent
  pas dans le flux de mise en page.

## Vérifications

- `typecheck`, lint sans avertissement et build de production : réussis.
- Tests ciblés transitions, SEO, registre et contenu éditorial : réussis.
- Cinq scénarios runtime supplémentaires : API partielle, absence de capture
  après streaming, priorité native, nettoyage obsolète, mouvement réduit /
  filtres / historique / utilitaires. Exécutés avec React client dans un
  sous-processus car le reste de la CI utilise `react-server`.
- Navigation réelle contrôlée sur Chrome **154.0.8037.99**, Safari **26.5**,
  Firefox **157.0.1** et Chromium du navigateur de test.
- Accueil → catalogue / Univers, Univers → Origines, les cinq chroniques dans
  l’ordre et un retour vers la précédente, sortie vers boutique, catalogue → produit, retour explicite,
  retour / avance navigateur, arrivée directe et rafraîchissement : contrôlés.
- Recherche et panier : ouverture / fermeture sans transition de page. Filtres
  de catalogue : mise à jour de query sans chorégraphie.
- Menu mobile et chroniques contrôlés aux dimensions **390×844** et **844×390**,
  sans débordement horizontal constaté. Tests sur téléphones physiques dispensés
  explicitement par l’utilisateur ; aucune validation sur matériel mobile revendiquée.
- Préférence réduite sélectionnée dans Chrome DevTools Rendering, puis navigation
  vers une autre chronique : fonctionnelle.
- Console du navigateur de test : aucune erreur. Chrome affiche un avertissement
  de preload CSS Next non utilisé immédiatement ; aucune erreur applicative observée.
- Instrumentation temporaire du callback React (retirée du code livré) : type
  `enter-world`, animation native du paysage de **1 400 ms** sur desktop,
  cleanup observé après **1 453 ms** ; `descend` nettoyée après **1 450 ms**.
  Capacités natives temporairement désactivées dans le code local de QA :
  fallback `chapter-forward` exécuté en **1 400 ms**. Tous ces réglages et
  logs temporaires sont retirés du code livré.
- Les 60 FPS et les Core Web Vitals sur smartphone moyen ne sont pas mesurés par
  ces contrôles. Les durées indiquées sont celles de la chorégraphie, hors latence réseau.

## Fichiers créés

- `src/components/transitions/ArrivalLayers.tsx`
- `tests/transitions-runtime.test.ts`
- `tests/helpers/transitions-runtime.client.ts`
- `src/lib/transitions/navigation.ts`
- `docs/cinematic-navigation.md`

## Fichiers modifiés

- `src/lib/transitions/classes.ts`
- `src/lib/transitions/runtime.ts`
- `src/components/transitions/TransitionStage.tsx`
- `src/styles/base/_transitions.scss`
- `src/components/home/Hero/Hero.tsx`
- `src/components/home/Hero/Hero.module.scss`
- `src/components/catalog/PageHero.tsx`
- `src/components/catalog/PageHero.module.scss`
- `src/components/editorial/EditorialParts.tsx`
- `src/components/layout/Header/Header.module.scss`
- `src/app/univers/page.tsx`
- `src/app/univers/page.module.scss`
- `src/components/universe/UniverseChapterShell.tsx`
- `src/components/universe/UniverseChapter.module.scss`
- `src/app/produit/[slug]/page.tsx`
- `src/components/product/ProductGallery/ProductGallery.tsx`
- `tests/transitions.test.ts`

## Références

- Guide installé : `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`
- [React ViewTransition](https://react.dev/reference/react/ViewTransition)
- [API native et progressive enhancement](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)

## Inventaire des imports Next Link audités

132 fichiers utilisent Next Link. Les liens restent conservés ; la sélection
du voyage est centralisée dans l’instrumentation, sans remplacer ces composants.

<details>
<summary>Liste complète</summary>

- `src/app/admin/(dashboard)/categories/page.tsx`
- `src/app/admin/(dashboard)/clients/page.tsx`
- `src/app/admin/(dashboard)/commandes/[id]/bon-preparation/page.tsx`
- `src/app/admin/(dashboard)/commandes/[id]/page.tsx`
- `src/app/admin/(dashboard)/commandes/page.tsx`
- `src/app/admin/(dashboard)/extensions/page.tsx`
- `src/app/admin/(dashboard)/factures/page.tsx`
- `src/app/admin/(dashboard)/factures/reglages/page.tsx`
- `src/app/admin/(dashboard)/fiscalite/page.tsx`
- `src/app/admin/(dashboard)/fournisseurs/[id]/page.tsx`
- `src/app/admin/(dashboard)/fournisseurs/imports/[id]/page.tsx`
- `src/app/admin/(dashboard)/fournisseurs/imports/nouveau/page.tsx`
- `src/app/admin/(dashboard)/fournisseurs/page.tsx`
- `src/app/admin/(dashboard)/jeux/page.tsx`
- `src/app/admin/(dashboard)/layout.tsx`
- `src/app/admin/(dashboard)/livraison/page.tsx`
- `src/app/admin/(dashboard)/messages/page.tsx`
- `src/app/admin/(dashboard)/newsletter/campagnes/[id]/page.tsx`
- `src/app/admin/(dashboard)/newsletter/campagnes/nouvelle/page.tsx`
- `src/app/admin/(dashboard)/newsletter/page.tsx`
- `src/app/admin/(dashboard)/page.tsx`
- `src/app/admin/(dashboard)/pilotage/page.tsx`
- `src/app/admin/(dashboard)/produits/[id]/page.tsx`
- `src/app/admin/(dashboard)/produits/nouveau/page.tsx`
- `src/app/admin/(dashboard)/produits/page.tsx`
- `src/app/admin/(dashboard)/promotions/[id]/page.tsx`
- `src/app/admin/(dashboard)/promotions/nouvelle/page.tsx`
- `src/app/admin/(dashboard)/promotions/page.tsx`
- `src/app/admin/(dashboard)/retours/[id]/page.tsx`
- `src/app/admin/(dashboard)/retours/nouveau/page.tsx`
- `src/app/admin/(dashboard)/retours/page.tsx`
- `src/app/admin/(dashboard)/stocks/page.tsx`
- `src/app/admin/login/page.tsx`
- `src/app/admin/mot-de-passe-oublie/page.tsx`
- `src/app/admin/nouveau-mot-de-passe/page.tsx`
- `src/app/admin/second-facteur/page.tsx`
- `src/app/admin/securite/page.tsx`
- `src/app/cgv/page.tsx`
- `src/app/checkout/error.tsx`
- `src/app/checkout/layout.tsx`
- `src/app/checkout/page.tsx`
- `src/app/checkout/paiement/[publicId]/page.tsx`
- `src/app/commande/[publicId]/page.tsx`
- `src/app/commande/[publicId]/retour/page.tsx`
- `src/app/compte/(espace)/alertes/page.tsx`
- `src/app/compte/(espace)/commandes/page.tsx`
- `src/app/compte/(espace)/page.tsx`
- `src/app/compte/(espace)/profil/page.tsx`
- `src/app/compte/connexion/page.tsx`
- `src/app/compte/inscription/page.tsx`
- `src/app/compte/mot-de-passe-oublie/page.tsx`
- `src/app/compte/nouveau-mot-de-passe/page.tsx`
- `src/app/compte/verification/page.tsx`
- `src/app/confidentialite/page.tsx`
- `src/app/contact/page.tsx`
- `src/app/error.tsx`
- `src/app/favoris/page.tsx`
- `src/app/global-error.tsx`
- `src/app/glossaire/page.tsx`
- `src/app/guides/page.tsx`
- `src/app/livraison/page.tsx`
- `src/app/mentions-legales/page.tsx`
- `src/app/not-found.tsx`
- `src/app/produit/[slug]/page.tsx`
- `src/app/questions/page.tsx`
- `src/app/retractation/page.tsx`
- `src/app/univers/page.tsx`
- `src/components/account/AccountNav.tsx`
- `src/components/account/AccountOrders.tsx`
- `src/components/account/AccountShell.tsx`
- `src/components/admin/AdminBreadcrumbs.tsx`
- `src/components/admin/AdminNavigation.tsx`
- `src/components/admin/AdminQuickAccess.tsx`
- `src/components/admin/AdminUI.tsx`
- `src/components/admin/FilterPanel.tsx`
- `src/components/admin/FulfillmentPanel.tsx`
- `src/components/admin/StorefrontPanel.tsx`
- `src/components/admin/SupplierImportRows.tsx`
- `src/components/admin/SupplierTables.tsx`
- `src/components/admin/VariantEditor.tsx`
- `src/components/cart/CartDrawer.tsx`
- `src/components/cart/CartEmpty.tsx`
- `src/components/cart/CartItem.tsx`
- `src/components/cart/CartPageContent.tsx`
- `src/components/catalog/ActiveFilters.tsx`
- `src/components/catalog/AisleNav.tsx`
- `src/components/catalog/CatalogInterlude.tsx`
- `src/components/catalog/CatalogPagination.tsx`
- `src/components/catalog/CatalogQuickNav.tsx`
- `src/components/catalog/EmptyState.tsx`
- `src/components/catalog/ExploreSection.tsx`
- `src/components/catalog/PageHero.tsx`
- `src/components/catalog/PendingHint.tsx`
- `src/components/checkout/CheckoutContactForm.tsx`
- `src/components/checkout/CheckoutFlow.tsx`
- `src/components/checkout/CheckoutProgress.tsx`
- `src/components/checkout/CheckoutReview.tsx`
- `src/components/checkout/CheckoutShipping.tsx`
- `src/components/checkout/CheckoutSummary.tsx`
- `src/components/editorial/EditorialParts.tsx`
- `src/components/home/Assurances/Assurances.tsx`
- `src/components/home/Collections/Collections.tsx`
- `src/components/home/Families/Families.tsx`
- `src/components/home/FinalCall/FinalCall.tsx`
- `src/components/home/Hero/Hero.tsx`
- `src/components/home/Journal/Journal.tsx`
- `src/components/home/Newsletter/NewsletterForm.tsx`
- `src/components/home/ProductRail/ProductRail.tsx`
- `src/components/home/Showcase/Showcase.tsx`
- `src/components/home/Territories/Territories.tsx`
- `src/components/landing/HubReleases.tsx`
- `src/components/landing/LandingFacts.tsx`
- `src/components/landing/LandingGuides.tsx`
- `src/components/landing/ReleaseMonths.tsx`
- `src/components/landing/SetCard.tsx`
- `src/components/layout/Footer/Footer.tsx`
- `src/components/layout/Header/Header.tsx`
- `src/components/layout/MobileNavigation/MobileNavigation.tsx`
- `src/components/layout/Navigation/Navigation.tsx`
- `src/components/newsletter/NewsletterCta.tsx`
- `src/components/newsletter/NewsletterPage.tsx`
- `src/components/payment/PaymentForm.tsx`
- `src/components/product/ProductCard/ProductCard.tsx`
- `src/components/product/ProductExplore/ProductExplore.tsx`
- `src/components/product/ProductPurchasePanel/ProductPurchasePanel.tsx`
- `src/components/product/StockAlertForm/StockAlertForm.tsx`
- `src/components/stock-alerts/StockAlertPage.tsx`
- `src/components/ui/Breadcrumb/Breadcrumb.tsx`
- `src/components/ui/Button/Button.tsx`
- `src/components/ui/IconButton/IconButton.tsx`
- `src/components/ui/SectionTitle/SectionTitle.tsx`
- `src/components/universe/UniverseChapterShell.tsx`

</details>
