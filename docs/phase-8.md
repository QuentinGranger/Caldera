# Phase 8 — Commandes, Stripe TEST et stock

## 1. Fichiers créés

Chemins relatifs à `/Users/quentin/Downloads/Les terres de Caldera` :

```text
prisma/migrations/20260920125644_add_orders_payments_stock_reservations/migration.sql
src/lib/inventory/availability.ts
src/lib/inventory/reservations.ts
src/lib/orders/common.ts
src/lib/orders/prepare.ts
src/lib/orders/queries.ts
src/lib/stripe/amount.ts
src/lib/stripe/stripe.ts
src/lib/stripe/webhook.ts
src/lib/payments/actions.ts
src/lib/payments/cancel.ts
src/lib/payments/events.ts
src/lib/payments/intents.ts
src/lib/payments/validation.ts
src/components/payment/OrderStatusRefresh.tsx
src/components/payment/OrderSummary.tsx
src/components/payment/Payment.module.scss
src/components/payment/PaymentForm.tsx
src/components/payment/StartPaymentButton.tsx
src/app/checkout/paiement/[publicId]/page.tsx
src/app/commande/[publicId]/page.tsx
src/app/api/commande/[publicId]/route.ts
src/app/api/stripe/webhook/route.ts
src/proxy.ts
scripts/expire-reservations.ts
scripts/stripe-listen.mjs
scripts/test-stripe-sandbox.ts
tests/payments.test.ts
tests/payments-db.test.ts
tests/payments-http.test.ts
docs/stripe-integration-plan.md
docs/phase-8.md
skills-lock.json
```

Le repli Stripe explicitement demandé installe également les compétences officielles dans `.agents/skills/` : connect-recommend, connect-required-verification-information, metronome, stripe-apps, stripe-best-practices, stripe-directory, stripe-docs, stripe-pay, stripe-projects, upgrade-stripe, avec leurs fichiers de référence. Seule `stripe-best-practices` est appliquée à cette intégration. Aucun plugin Stripe connecté ni planificateur disponible ; aucune installation d’app n’est prétendue.

## 2. Fichiers modifiés

```text
package.json
package-lock.json
.env.example
.prettierignore
prisma/schema.prisma
src/lib/cart/queries.ts
src/lib/cart/service.ts
src/lib/cart/validation.ts
src/lib/catalog/getAvailability.ts
src/lib/catalog/getCatalogProducts.ts
src/lib/catalog/queries.ts
src/lib/checkout/service.ts
src/app/checkout/page.tsx
src/components/checkout/CheckoutReview.tsx
src/components/checkout/CheckoutProgress.tsx
src/components/layout/StorefrontOnly/StorefrontOnly.tsx
src/components/cart/CartProvider.tsx
tests/catalog.test.ts
tests/checkout-http.test.ts
README.md
```

Le client `src/generated/prisma/` est régénéré et reste ignoré. Pas de remplacement d’architecture, de reset, de seed de commandes ou de framework CSS ajouté.

## 3–6. Dépendances, configuration et base

- SDK vérifiés et épinglés : `stripe@22.6.2`, `@stripe/stripe-js@9.16.0`, `@stripe/react-stripe-js@6.10.0`. API par défaut du SDK : `2026-08-26.dahlia`. Installation npm sans vulnérabilité signalée.
- Variables documentées : STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, APP_URL (repli SITE_URL). Aucune clé dans le dépôt. Les clés TEST ont été ajoutées par l’utilisateur dans `.env`, puis vérifiées auprès de Stripe ; le secret de l’écoute webhook locale a été ajouté sans l’afficher.
- Modèles : Order, OrderItem, OrderAddress, Payment, StockReservation, StripeWebhookEvent. Énumérations séparées OrderStatus, PaymentStatus, PaymentProvider, ReservationStatus ; rôle d’adresse existant réutilisé.
- Migration additive `20260920125644_add_orders_payments_stock_reservations` appliquée ; contraintes UNIQUE/FK/CHECK, zéro réservé initialement et colonne PostgreSQL `availableQuantity` générée en lecture seule. Une seconde exécution de `prisma migrate dev` confirme l’absence de drift / migration restante.

## 7–12. Commande et inventaire

Order est créée au passage au paiement après revalidation serveur de READY_FOR_PAYMENT et de son empreinte. Une Order par CheckoutSession, numéro aléatoire avec UNIQUE, publicId 256 bits. Les OrderItem figent nom, slug, SKU, langue, quantité, prix, total et image. Les OrderAddress figent livraison et facturation indépendamment des adresses temporaires. Livraison, contact, devise et montants sont aussi des snapshots.

Payment reste unique par commande ; identifiant PaymentIntent unique, montant/devise et statut internes, aucune donnée bancaire. StockReservation associe une variante et une quantité à une commande, avec état et expiration. `reservedQuantity` représente les unités engagées ; physique moins réservé détermine disponibilité, contrôles panier/checkout, filtres SQL et quantités de la fiche produit.

## 13. Protection contre la survente

Mise à jour conditionnelle PostgreSQL paramétrée et vérification d’une seule ligne modifiée : `stockQuantity - reservedQuantity >= quantité`. Réservation, commande et snapshots dans la même transaction Serializable avec reprises bornées des conflits. Les transactions concurrentes prennent les verrous dans le même ordre : Cart, Order, variantes triées. Contraintes SQL `0 <= réservé <= physique`. Aucun appel Stripe dans la transaction DB.

## 14–16. PaymentIntent, idempotence et interface

Un intent par commande avec clé `caldera:order:<uuid>:v1`, montants Decimal convertis exactement en centimes EUR côté serveur, metadata limitées aux identifiants de commande. Avant l’appel API, la tentative est marquée en DB. Les réponses perdues sont récupérées avec la même clé et les mêmes paramètres. Le double clic et le refresh réutilisent la commande et l’intent ; un paiement PAID ne peut plus être confirmé.

Payment Element est isolé dans un composant client, avec thème Caldera, erreurs accessibles, bouton montant serveur, préflight et arrêt à l’échéance. `confirmPayment` gère SCA/3DS et redirection. Stripe.js est chargé à la demande via le module `pure`. Une CSP à nonce autorise Stripe/Link ; aucun formulaire carte manuel. Panier/checkout sont temporairement verrouillés pendant une tentative active, avec annulation explicite pour les modifier.

## 17–19. Webhook et finalisation

POST `/api/stripe/webhook` lit le corps brut et vérifie la signature cryptographique. Événements : succeeded, processing, payment_failed, canceled, requires_action. L’adaptateur relit Stripe avant traitement pour ne pas se fier à un ancien payload. Montant, montant reçu en cas de succès, devise, mode test et metadata sont contrôlés.

Transaction finale : réservations actives cohérentes → physique et réservé décrémentés → réservations CONSUMED → Payment SUCCEEDED → Order PAID → Checkout COMPLETED → Cart CONVERTED. Sans réservations cohérentes : PAYMENT_REVIEW, paiement reçu conservé, aucun stock décrémenté aveuglément et aucun remboursement automatique.

## 20–22. Libération, expiration et doublons

Annulation confirmée Stripe avant libération. Sans appel Stripe commencé, annulation DB sous verrou suffisante. Un refus de carte conserve la réservation pour réessai. PROCESSING/SUCCEEDED ne libèrent jamais le stock par expiration ; le webhook reste nécessaire.

TTL centralisé 20 minutes. `npm run stock:expire` traite au plus 100 tentatives par exécution ; aucun cron installé. Programmer la commande périodiquement dans l’environnement cible. Erreur réseau : nouvelle tentative ultérieure. Création ambiguë depuis plus de 23 h : PAYMENT_REVIEW pour ne pas réutiliser une clé potentiellement purgée chez Stripe. Une intervention humaine est alors requise, avec les identifiants des logs structurés, sans données personnelles.

StripeWebhookEvent unique, verrous et contrôle des états garantissent la consommation/libération une seule fois, y compris deux événements distincts de succès. Un ancien échec ne dégrade pas PAID. Les logs contiennent seulement identifiants d’ordre/intent/événement, action et statut.

## 23. Confirmation privée

`/commande/[publicId]` exige le cookie propriétaire et affiche uniquement le statut DB et les snapshots. Aucun paramètre de retour Stripe ne fait foi. Page dynamique, noindex, absence de cache, Referrer-Policy no-referrer. Le statut est relu toutes les 3 secondes pendant une minute puis actualisable manuellement. Après paiement, panier vide ; un nouvel ajout crée un nouveau Cart. La suppression ou le remplacement du cookie retire l’accès à l’ancienne commande : aucun historique client ni lien d’accès durable créé dans cette phase.

## 24. Vérifications

Suites nouvelles :

- 3 scénarios unitaires : conversion EUR, disponibilité et signatures SDK valides/altérées/expirées.
- 16 scénarios PostgreSQL : dernière unité concurrente, 5 unités / réservation 3+3, double préparation et intent, accès tiers, prix/livraison modifiés, montant/devise/metadata/mode incorrects, snapshots, doubles événements, consommation, retry après refus, crash avant API, réponse perdue, processing, expiration/succès concurrents, succès après libération, contraintes SQL, filtres SQL du réservé, requires_action/annulation et ambiguïté de création ancienne.
- 6 scénarios HTTP : confidentialité, faux retour succeeded, étape paiement/résumé, Server Actions et Origin, signature webhook invalide, confirmation et panier après finalisation métier.

Au total, 102 scénarios passent (108 entrées du runner Node en incluant les tests parents). Les anciens scénarios catalogue/produit/panier/checkout sont conservés, avec adaptation de l’attente HTTP du bouton paiement désormais actif. Les données de test sont nettoyées. Les tests Stripe réseau utilisent un adaptateur de test ; les suites HTTP ne contactent pas Stripe. La recette réseau Stripe TEST complémentaire est désormais effectuée (voir ci-dessous). Le défi 3DS interactif n’est pas exécuté. Aucun navigateur de contrôle connecté : vérification visuelle et interactive encore nécessaire.

## 25. Périmètre reporté

Tax et Invoicing figurent dans le plan demandé mais ne sont pas activés. Aucun calcul fiscal ni facture fictive. Pas d’administration des commandes, transporteur, colis, emails transactionnels, PDF, remboursements automatiques, retours, comptes ou programme fidélité. Le seed reste fictif et les règles de livraison restent celles de démonstration.

## 26–29. Commandes de validation

`prisma generate` : réussi. Migration : appliquée sans reset, second `prisma migrate dev` déjà synchronisé. `npm run lint` et `npm run build` : réussis. TypeScript strict et Prettier : vérifiés. Les routes paiement, confirmation et webhook figurent bien dans le build. Une collision entre les types générés dev/build a été résolue en arrêtant les serveurs et supprimant uniquement `.next` et `tsconfig.tsbuildinfo`, puis le build final complet a réussi. Les résultats de validation ne constituent pas une recette réelle Stripe.

Voir le [README](../README.md#paiement-stripe-phase-8) pour l’installation des clés, la CLI, les tests et la commande d’expiration. Application locale : <http://localhost:3000> ; santé : <http://localhost:3000/api/health>.

## Recette avec les clés TEST fournies

Le 20 septembre 2026, la clé serveur et la clé publique ont été vérifiées contre le même PaymentIntent Stripe TEST. `npm run stripe:listen` démarre la CLI officielle, transmet la clé par variable d’environnement et écrit le secret webhook dans `.env` sans affichage. L’écoute locale a reçu cinq événements avec réponses HTTP 200 : succeeded, payment_failed, canceled, requires_action, canceled.

`npm run test:stripe:sandbox` exécute trois scénarios avec de vrais appels Stripe TEST et des fixtures PostgreSQL temporaires :

1. Succès avec `pm_card_visa` : vrai webhook signé, Order PAID, Payment SUCCEEDED, réservation CONSUMED, stock 3 → 2 et réservé → 0, panier CONVERTED.
2. Refus avec `pm_card_visa_chargeDeclined` : vrai webhook, PAYMENT_FAILED/FAILED, stock physique inchangé, annulation Stripe et libération vérifiées.
3. Authentification avec `pm_card_authenticationRequired` : PaymentIntent requires_action et Payment REQUIRES_ACTION reçu par webhook, puis annulation/libération de la tentative de recette.

Chaque préparation relit le même PaymentIntent pour vérifier sa réutilisation. Les articles, commandes, paniers et modes de livraison de recette locaux sont supprimés après contrôle de leur état terminal ; les événements et paiements Stripe TEST restent disponibles pour audit. Aucun débit réel. Lint et TypeScript ont été relancés avec succès après ajout des scripts. Aucun code de paiement applicatif n’a été modifié pour contourner les contrôles.

Ces trois essais réseau s’ajoutent aux 102 scénarios automatisés précédents. Le formulaire Payment Element, `confirmPayment` dans le navigateur, le défi 3DS complet et les moyens asynchrones restent à tester manuellement ; aucun navigateur de contrôle connecté. La recette ne configure ni Tax ni Invoicing.
