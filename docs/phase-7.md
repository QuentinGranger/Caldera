# Phase 7 — Checkout, adresses et livraison

## 1. Fichiers créés

- `src/app/checkout/error.tsx`
- `src/app/checkout/layout.tsx`
- `src/app/checkout/page.tsx`
- `src/lib/checkout/actions.ts`
- `src/lib/checkout/getCheckout.ts`
- `src/lib/checkout/queries.ts`
- `src/lib/checkout/schemas.ts`
- `src/lib/checkout/service.ts`
- `src/lib/checkout/shipping.ts`
- `src/lib/checkout/types.ts`
- `src/lib/checkout/validation.ts`
- `src/components/checkout/AddressForm.tsx`
- `src/components/checkout/AddressSummary.tsx`
- `src/components/checkout/Checkout.module.scss`
- `src/components/checkout/CheckoutContactForm.tsx`
- `src/components/checkout/CheckoutFlow.tsx`
- `src/components/checkout/CheckoutProgress.tsx`
- `src/components/checkout/CheckoutReview.tsx`
- `src/components/checkout/CheckoutShipping.tsx`
- `src/components/checkout/CheckoutSummary.tsx`
- `src/components/checkout/CheckoutSync.tsx`
- `src/components/checkout/ShippingMethodCard.tsx`
- `src/components/checkout/StartCheckoutButton.tsx`
- `src/components/checkout/useCheckoutAction.ts`
- `src/components/layout/StorefrontOnly/StorefrontOnly.tsx`
- `prisma/migrations/20260920121659_add_checkout_and_shipping/migration.sql`
- `tests/checkout-db.test.ts`
- `tests/checkout-http.test.ts`
- `tests/checkout.test.ts`
- `docs/phase-7.md`

## 2. Fichiers modifiés

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/lib/cart/service.ts`
- `src/components/cart/CartSummary.tsx`
- `src/components/cart/CartProvider.tsx`
- `src/app/layout.tsx`
- `package.json`
- `README.md`

Aucun package ajouté. Client Prisma régénéré, non versionné. Aucune réinitialisation Next.js, migration de CSS, modification Docker ou nouveau secret.

## 3. Modèles Prisma

`CheckoutSession`, `CheckoutAddress`, `ShippingMethod`, `ShippingCountry`. Enums `CheckoutStatus` (IN_PROGRESS, READY_FOR_PAYMENT, COMPLETED, EXPIRED), `CheckoutAddressRole` (SHIPPING, BILLING), `ShippingMethodType` (HOME_DELIVERY, EXPRESS).

Cart → sessions → adresses : Cascade. ShippingMethod référencée par une session : Restrict. Le code de pays de l’adresse constitue un snapshot temporaire indépendant de la configuration des destinations. Méthode.code unique, adresse unique par rôle/session, index des sessions par Cart/statut et expiration. CHECK SQL sur montants, pays alpha-2 et délais.

## 4. Migration

`20260920121659_add_checkout_and_shipping`, créée, complétée par les contraintes SQL puis appliquée avec `prisma migrate dev`, sans reset. `prisma generate` effectué. Seed local exécuté : catalogue préservé, deux pays et deux modes de livraison de démonstration ajoutés par upsert sans écraser les éditions existantes.

## 5. CheckoutSession

Créée par une Server Action après validation d’un panier actif non vide. Réutilisée tant qu’elle reste IN_PROGRESS/READY_FOR_PAYMENT et non expirée. Cookie Cart existant comme identité, aucun cookie checkout ni User. Chaque action vérifie la propriété même si un ID valide est envoyé par le client. Création et mutations sérialisées sur le Cart dans une transaction Serializable, reprise bornée des conflits ; lectures Repeatable Read. Aucun effet de bord dans le GET et aucun checkout créé par préchargement de lien.

Expiration absolue 24 h. Le panier garde sa durée indépendante. Une session expirée est immédiatement bloquée par le DTO puis marquée EXPIRED par la synchronisation ou le redémarrage. La reprise crée une session sans anciennes adresses, avec le même panier. COMPLETED n’est pas réutilisé. Aucun nettoyage périodique automatique ; prévoir ultérieurement une politique de suppression des sessions et données personnelles expirées.

## 6. Adresses

Adresse livraison obligatoire, facturation identique par défaut sans seconde saisie ni duplication DB. Si différente, second enregistrement BILLING. Recocher l’identité des adresses retire le snapshot de facturation séparé. Email et téléphone dans la session ; prénom/nom saisis une seule fois dans l’adresse de livraison, aussi utilisés pour le contact. Société, complément, région et téléphone facultatifs. Aucun lien vers une adresse de compte utilisateur. La future Order devra copier ces données en snapshots immuables.

## 7. Validation des formulaires

Validation runtime structurée dans `schemas.ts`, sans nouvelle dépendance. Email, limites de longueur, téléphone formaté facultatif, noms libres, champs requis, pays actif, format postal FR/BE et règle générique pour les autres pays. Accents/apostrophes/tirets conservés. Trim/espaces uniquement ; aucune conversion arbitraire de casse.

`saveContactAction` sauvegarde contact + livraison + facturation atomiquement, plutôt que trois mutations partielles. Erreurs par champ et résumé accessible avec liens/focus, label/name/autocomplete, type tel et clavier approprié. Pas de PII loggée. Les brouillons non validés sont locaux et perdus au refresh ; les données validées persistent.

## 8. ShippingMethod

Méthodes stockées en PostgreSQL, seules celles actives et disponibles pour le pays sont proposées. Radios accessibles, nom, description, délais uniquement configurés, tarif actuel. Deux types réellement gérés ; aucune interface relais ou retrait factice. Désactiver une méthode référencée plutôt que la supprimer.

## 9. Calcul livraison

`calculateShipping()` utilise méthode/destination/sous-total actuels. Calcul Decimal ; zéro dès le seuil configuré, affiché « Offerte ». Montant du navigateur ignoré. Le snapshot shippingAmount est temporaire : relu/recalculé systématiquement. Pas de poids, moteur de tranches, fiscalité ou transporteur inventé.

Seed **de développement uniquement** : standard FR/BE 5,90 €, offerte dès 150 €, délai 2–4 jours ; express FR 12,90 €, délai 1–2 jours. `[Démo]`, isDevelopment et descriptions/avertissement visibles. Ces valeurs ne constituent pas des engagements commerciaux.

## 10. Pays

ShippingCountry actif (code ISO alpha-2 et nom), relation plusieurs-à-plusieurs avec ShippingMethod. France par défaut si disponible, Belgique également configurée dans le seed. Pays supplémentaires à configurer en base, aucun périmètre européen implicite. La liste sert aux adresses actuelles de livraison et facturation. Si pays retiré, retour coordonnées ; si pays valide sans méthode, message dédié et progression bloquée.

## 11. Tunnel multi-étapes

`/checkout?step=contact`, `shipping`, `review`. Indicateur avec liens vers les étapes accessibles, paiement affiché mais inaccessible. Le serveur détermine la première étape incomplète et bloque les accès directs prématurés. `/checkout` sans panier utilisable renvoie vers /panier ; sans session mais avec panier valide, propose un bouton de démarrage.

Header logo/retour simplifié et footer minimal. `StorefrontOnly` choisit l’affichage du chrome classique via usePathname ; navigation existante passée comme enfant serveur, aucune route existante déplacée.

## 12. Persistance après refresh

Coordonnées validées et livraison enregistrées dans PostgreSQL, restaurées dans chaque rendu dynamique. Aucun localStorage ni stockage de PII en cookie. Étape conservée dans l’URL. Le choix de livraison est sauvegardé immédiatement au clic ; la sélection ne devient effective qu’après réponse serveur. Retour de focus sur l’onglet : synchronisation des données actuelles, y compris changement du panier ailleurs.

## 13. Récapitulatif

Images next/image avec fallback Caldera, produit, langue, quantité et montant de ligne. Contact, deux adresses, livraison et liens Modifier. Réutilisation de la projection du panier : prix × quantité en Decimal puis addition des frais serveur. Sous-total, livraison et total provisoire visibles ; avant choix livraison, « sous-total + livraison » explicite. Aucun faux total à livraison gratuite implicite, ni taxe/remise inventée.

## 14. READY_FOR_PAYMENT

`prepareCheckoutAction` exécute `validateCheckout()` avant changement de statut : Cart, session, contact, adresses, destination, méthode active et prix/stock courants. Depuis Livraison, « Vérifier mon récapitulatif » valide puis ouvre le récapitulatif READY. Une empreinte serveur des données validées détecte leur changement ultérieur. Paiement désactivé avec mention claire de la phase 8 ; aucun objet de paiement ou commande créé.

## 15. Changements panier/prix/stock

Mutation du Cart : checkout repasse IN_PROGRESS dans la même transaction. Sauvegarde coordonnées : remise IN_PROGRESS et nouvelle sélection de livraison demandée. Changement de méthode : IN_PROGRESS jusqu’à validation.

Prix produit/livraison et stock externes : chaque DTO recalcule les montants et cesse de présenter READY en cas d’empreinte différente. `CheckoutSync` fait enregistrer le nouveau statut et les montants par Server Action à l’ouverture/au retour de focus ; lecture GET sans écriture. Rupture ou quantité trop élevée bloque l’interface et les actions, avec retour au panier. Pays retiré/mode désactivé rendent l’étape incomplète. Aucun stock réservé ou décrémenté. Une future phase 8 devra relire et revalider, jamais se fier au seul statut stocké.

## 16. Responsive et accessibilité

≥1200 px : 60/40 avec résumé sticky. Mobile/tablette : empilé, rappel du total en haut et lien vers le résumé. Champs sur une colonne sous 768 px, étapes compactes sur mobile étroit, cibles tactiles, vrais labels et radios. Focus au titre lors du changement d’étape et au résumé d’erreurs après rejet. Metadata noindex/nofollow.

Aucun navigateur connecté à l’outil de contrôle. Les vérifications visuelles 320/390/768/1200/1440 px, saisie, Tab/Entrée, retours navigateur et changement d’onglet réels restent manuelles. Les tests HTTP inspectent le HTML et les redirections, sans prétendre valider l’hydratation ou le rendu visuel.

## 17. Préparation phase 8

Session distincte du Cart, adresses temporaires, validation centrale, calculs Decimal, statut/empreinte et frontière paiement. La future commande devra copier les snapshots et effectuer sa validation finale ainsi que la gestion transactionnelle du stock. Aucun début d’implémentation de cette chaîne dans cette phase.

## 18. Hors périmètre

Aucun Order, OrderItem, numéro de commande, Stripe/PaymentIntent/PayPal, formulaire bancaire, paiement, capture, remboursement, facture, email, authentification, API transporteur, point relais, code promo, calcul fiscal, réservation ou décrémentation définitive du stock.

## 19. Lint et tests

`npm run lint`, `npm run typecheck`, `npm run format:check` : réussis.

- 3 tests unitaires checkout : champs, adresses/pays, seuils Decimal.
- 14 scénarios PostgreSQL : création concurrente/réutilisation, blocages, persistance, deux adresses, autorisation, pays, tarifs, seuil gratuit, changements panier/prix/stock, expiration, absence de méthode, FK/Cascade.
- 8 scénarios HTTP : routes, header simplifié, étapes protégées, formulaires persistants, frais/review READY, autorisation/Origin, revalidation et expiration.
- Suites précédentes catalogue, fiches produit et panier exécutées pour les régressions.

Fixtures de test supprimées en finally. Les tests HTTP utilisent le manifest local des Server Actions, sans endpoint de test public. Avertissement pg préexistant de dépréciation lors de certaines lectures Prisma parallèles, sans échec associé.

## 20. Build

`npm run build` : réussi, Next.js 16.3.5, React 19.3.0, Prisma 7.10.0. Route /checkout dynamique ; prix Decimal correctement sérialisés. Migration et seed local appliqués. Aucune dépendance ajoutée. Serveur de test temporaire 3001 ; application locale sur 3000.
