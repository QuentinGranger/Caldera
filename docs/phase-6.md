# Phase 6 — Panier invité persistant

## 1. Fichiers créés

- `src/app/panier/page.tsx`
- `src/lib/cart/actions.ts`
- `src/lib/cart/cartCookie.ts`
- `src/lib/cart/constants.ts`
- `src/lib/cart/getCart.ts`
- `src/lib/cart/identity.ts`
- `src/lib/cart/queries.ts`
- `src/lib/cart/service.ts`
- `src/lib/cart/types.ts`
- `src/lib/cart/validation.ts`
- `src/components/cart/CartButton.module.scss`
- `src/components/cart/CartButton.tsx`
- `src/components/cart/CartDrawer.module.scss`
- `src/components/cart/CartDrawer.tsx`
- `src/components/cart/CartEmpty.module.scss`
- `src/components/cart/CartEmpty.tsx`
- `src/components/cart/CartItem.module.scss`
- `src/components/cart/CartItem.tsx`
- `src/components/cart/CartPageContent.module.scss`
- `src/components/cart/CartPageContent.tsx`
- `src/components/cart/CartProvider.tsx`
- `src/components/cart/CartSummary.module.scss`
- `src/components/cart/CartSummary.tsx`
- `src/components/cart/CartUnavailable.tsx`
- `prisma/migrations/20260920115557_add_cart/migration.sql`
- `tests/cart-db.test.ts`
- `tests/cart-http.test.ts`
- `docs/phase-6.md`

## 2. Fichiers modifiés

- `prisma/schema.prisma`
- `src/app/layout.tsx`
- `src/components/layout/Header/Header.tsx`
- `src/components/product/AddToCartButton/AddToCartButton.tsx`
- `src/components/product/ProductPurchasePanel/ProductPurchasePanel.tsx`
- `src/components/product/QuantitySelector/QuantitySelector.tsx`
- `package.json`
- `README.md`

Aucun package ajouté. Pas de changement du seed, des variables d’environnement, de Docker ou de la configuration Next.js. Le client Prisma généré est régénéré mais reste ignoré par Git.

## 3. Modèles Prisma

`Cart` : UUID, tokenHash unique (SHA-256 du jeton), status, createdAt, updatedAt, expiresAt. `CartStatus` : ACTIVE / CONVERTED / ABANDONED. `CartItem` : UUID, cartId, variantId, quantité et timestamps. Contrainte unique cartId + variantId. Index status, expiresAt, variantId ; l’index unique couvre déjà cartId. Relation Cart en Cascade, ProductVariant en Restrict. Aucun prix copié ni utilisateur artificiel.

## 4. Migration

`20260920115557_add_cart` créée avec `prisma migrate dev --name add_cart --create-only`, complétée par un CHECK SQL quantité entre 1 et 99, puis appliquée avec `prisma migrate dev`. Aucun reset. Client généré avec `prisma generate`.

## 5. Guest Cart

PostgreSQL → Prisma → `src/lib/cart/` → Server Actions / RootLayout → composants. `mutateCart()` englobe la recherche/création conditionnelle et la mutation dans une transaction. Création uniquement au premier ajout réussi. Une requête sans cookie ne crée rien. L’ID du panier n’est jamais accepté par une action publique.

## 6. Cookie

`caldera_cart` : jeton aléatoire 256 bits, HTTP-only, SameSite=Lax, Secure en production, Path=/, Max-Age=2592000. Le cookie ne contient ni article, ni quantité, ni prix. Seule l’empreinte du jeton est stockée en base ; le jeton n’est pas transmis dans les props React. API `await cookies()` de Next.js 16.3.5. Production sur HTTPS.

## 7. Ajout

`addToCartAction(variantId, quantity)` retrouve la variante et valide son produit, sa publication, son activation, son stock/quota et la quantité cumulée. Une variante existante augmente sa ligne ; une autre langue crée une ligne distincte. L’interface empêche les doubles clics, affiche un résultat et ouvre le drawer après succès. Première requête sans identité dans deux onglets simultanés : deux paniers peuvent être créés ; aucune fusion implicite d’identités.

## 8. Modification

`updateCartItemAction(itemId, quantity)` vérifie l’appartenance au panier du cookie, valide le stock courant puis enregistre la quantité absolue. Entiers 1–99 uniquement ; zéro demande d’utiliser la suppression. Les +/- sont immédiats ; la saisie est confirmée au blur ou à Entrée. Transactions Serializable et quatre tentatives maximum sur conflit P2034 ; toutes les mutations écrivent d’abord la ligne Cart pour sérialiser les opérations concurrentes.

## 9. Suppression

`removeCartItemAction(itemId)` supprime seulement une ligne appartenant au panier courant. Elle reste utilisable en rupture ou pour un produit archivé/inactif. Aucune suppression silencieuse liée à une modification de produit.

## 10. Vidage

`clearCartAction()` supprime toutes les lignes du panier courant, après confirmation légère dans la page. Le Cart reste ACTIVE et vide ; son cookie reste utilisable.

## 11. Stock et montants

Pas de réservation ni décrémentation. Précommande limitée au stockQuantity, jamais illimitée. Maximum 99 unités par variante et 100 lignes distinctes. `validateCart()` est centralisé et réutilisable. Les prix actuels viennent uniquement de ProductVariant.price. Multiplication et somme en Decimal serveur, chaînes à deux décimales côté client. Les lignes signalées invalides restent incluses dans le sous-total affiché ; ce montant n’est pas payable.

## 12. Drawer

`CartDrawer`, `<dialog>` natif, largeur max 460 px et 96vw sur mobile. Overlay, fermeture Échap/bouton/extérieur, focus dans la modale et restitution au bouton panier ; scroll du fond bloqué par la règle globale existante. Images next/image avec placeholders existants, nom/lien de variante, langue française, précommande, prix, quantité, suppression, sous-total, lien /panier, état vide et état d’erreur réessayable.

## 13. Page /panier

`CartPageContent`, `CartItem`, `CartSummary`, `CartEmpty`, `CartUnavailable` partagent les mêmes données et contrôles que le drawer. Répartition 70/30 au-delà de 1200 px, empilée en dessous. Navigation catalogue, contrôle de quantité, suppression, vidage, sous-total et mention livraison. Metadata noindex/nofollow. Aucun faux checkout.

## 14. Header et synchronisation

Badge = somme des unités ; masqué à zéro. `CartProvider` ne stocke pas de panier mutable : sa valeur cart vient des props serveur. Seulement ouverture, pending, message et verrou immédiat en état client. Les actions revalident le layout racine : header/drawer/page sont mis à jour dans la réponse RSC. Relecture à l’ouverture, à la navigation et au retour de focus sur l’onglet. Projection serveur commune bornée, une image par ligne, aucun coût ni description complète. React.cache limité au rendu courant ; aucun cache global personnalisé. Le cookie dans le layout implique un rendu dynamique des pages partagées, choix nécessaire au badge personnalisé avec la configuration actuelle sans PPR.

## 15. Indisponibilité

Les lignes restent présentes si stock nul, variante inactive ou produit/catégorie/extension masqué. Message précis, suppression possible et avertissement récapitulatif. Si le stock est devenu inférieur à la quantité, bouton explicite « Mettre à jour à N ». Une panne DB de lecture du panier donne un message indisponible et Réessayer, pas un faux panier vide.

## 16. Expiration

Trente jours glissants renouvelés à chaque mutation réussie dans la DB et le cookie. Une lecture ne renouvelle pas. Panier expiré ou inactif traité comme vide ; nouvel ajout = nouveau panier. Ancien ACTIVE expiré marqué ABANDONED lors du remplacement. CONVERTED intouchable. Pas de cron ajouté ; prévoir un nettoyage périodique ultérieur.

## 17. Préparation du checkout

Validation centrale, distinction ACTIVE/CONVERTED, références de variantes protégées et montants fiables. CTA présent mais désactivé, avec mention commandes non ouvertes. Une future commande devra refaire la validation et les opérations de stock dans sa propre transaction ; la validation actuelle ne garantit aucune réservation.

## 18. Hors périmètre

Aucun checkout, paiement, commande, compte, authentification, adresse, transporteur, code promo, email, facture ou réservation de stock. Les cartes catalogue mènent aux fiches pour choisir une variante. Aucun localStorage/sessionStorage/IndexedDB, Redux ou Zustand.

## 19. Lint et tests

`npm run lint` : réussi, zéro avertissement. `npm run typecheck` et `npm run format:check` : réussis.

- Panier PostgreSQL : 15 scénarios, 16 tests comptés par Node avec le parent. Quantités malveillantes, cumul, langues, propriété, prix, stock, précommande, concurrence, expiration, conversion, suppression, vidage, contraintes et FK. Fixtures propres supprimées en finally.
- Panier HTTP production : 7 scénarios, 8 tests avec le parent. Cookie sécurisé/persistant, absence de création au GET, actions et RSC actualisé, isolation, CSRF Origin natif, prix actualisé et rupture, suppression/vidage, metadata et absence de jeton dans les props.
- Régressions catalogue/produit : suites existantes exécutées, avec données de seed conservées.

Les tests HTTP appellent les actions de la version installée via leur manifest de build, sans API de test exposée. Ils ne remplacent pas un vrai navigateur. L’outil de navigateur ne disposait d’aucune session : contrôle visuel, clavier, focus, overlay, saisie rapide et fermeture/réouverture réelle du navigateur restent à effectuer. Le cookie persistant et les lectures HTTP successives sont vérifiés automatiquement. Le pilote PostgreSQL émet encore son avertissement de dépréciation préexistant lors de certaines lectures Prisma parallèles ; aucune erreur de test associée.

## 20. Build

`npm run build` : réussi (Next.js 16.3.5 / React 19.3.0 / Prisma 7.10.0), route /panier dynamique. Testé en production locale sur 3001 ; serveur de développement relancé sur 3000 après génération du client. La migration est déjà appliquée à la base locale. Aucun package à installer pour cette phase.
