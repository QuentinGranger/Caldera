# Phase 10 — Emails, préparation, expédition et suivi

Projet existant : `/Users/quentin/Downloads/Les terres de Caldera`. Next.js **16.3.5**, React **19.3.0**, Prisma **7.10.0** conservés. Livraison du 20 septembre 2026. Resend retenu par l’utilisateur ; envois réels désactivés, sans destinataire de recette actuellement.

## 1. Fichiers créés

Chemins relatifs à la racine ci-dessus :

- `prisma/migrations/20260920142700_add_fulfillment_shipments_transactional_emails/migration.sql`
- `src/lib/fulfillment/actions.ts`
- `src/lib/fulfillment/carriers.ts`
- `src/lib/fulfillment/service.ts`
- `src/lib/email/outbox.ts`
- `src/lib/email/processor.ts`
- `src/lib/email/provider.ts`
- `src/lib/orders/access.ts`
- `src/lib/admin/dates.ts`
- `src/emails/templates.ts`
- `src/components/admin/FulfillmentPanel.tsx`
- `src/components/admin/PrintButton.tsx`
- `src/components/admin/PackingSlip.module.scss`
- `src/components/fulfillment/OrderFulfillment.tsx`
- `src/components/fulfillment/OrderFulfillment.module.scss`
- `src/app/admin/emails/[id]/preview/route.ts`
- `src/app/admin/(dashboard)/commandes/[id]/bon-preparation/page.tsx`
- `scripts/process-emails.ts`
- `tests/fulfillment-db.test.ts`
- `docs/phase-10.md`

## 2. Fichiers modifiés

- `prisma/schema.prisma`
- `package.json`
- `.env.example`
- `.env` local uniquement, ignoré : secret de consultation généré et envois désactivés
- `README.md`
- `src/lib/admin/queries.ts`
- `src/lib/admin/format.ts`
- `src/lib/orders/common.ts`
- `src/lib/orders/queries.ts`
- `src/lib/payments/events.ts`
- `src/app/api/stripe/webhook/route.ts`
- `src/app/commande/[publicId]/page.tsx`
- `src/app/admin/(dashboard)/page.tsx`
- `src/app/admin/(dashboard)/commandes/page.tsx`
- `src/app/admin/(dashboard)/commandes/[id]/page.tsx`
- `src/components/admin/Admin.module.scss`
- `tests/payments-db.test.ts`
- `tests/payments-http.test.ts`
- `tests/admin-http.test.ts`
- `scripts/test-stripe-sandbox.ts`

Client Prisma régénéré dans `src/generated/prisma` (fichiers générés ignorés). Aucun asset de marque remplacé.

## 3. Dépendances email

**Aucune ajoutée.** Adaptateur Resend via `fetch` natif, templates HTML/texte simples. Pas de SDK email, Redis, queue externe ni bibliothèque UI.

## 4. Environnement

Ajouts : `EMAILS_ENABLED`, `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_TEST_RECIPIENT`, `ORDER_ACCESS_SECRET`. Réutilisation de `APP_URL` pour les URL absolues. Seul le secret local de consultation est généré ; aucune clé Resend, adresse réelle ou vérification de domaine inventée. `EMAILS_ENABLED=false` conservé.

## 5. Modèles Prisma

`Order` : `fulfillmentStatus`, dates de préparation/prêt/expédition/livraison, relations `shipments` et `emails`. Nouveaux modèles `Shipment` et `EmailDelivery`. Enums distincts `FulfillmentStatus`, `ShipmentStatus`, `EmailType`, `EmailStatus`. Statuts financiers existants conservés.

## 6. Migration

`20260920142700_add_fulfillment_shipments_transactional_emails` : additive, appliquée sans reset. Index de recherche et de file d’attente, unicité `(orderId, type)`, une expédition principale par commande via index partiel, contrôles de dates et de tentatives non négatives.

## 7. FulfillmentStatus

`UNFULFILLED → PREPARING → READY_TO_SHIP → SHIPPED → DELIVERED`. Initialisation au paiement réel, sans commencer automatiquement la préparation. Paiement et logistique restent indépendants.

## 8. Shipment

Relation 0..n par commande ; UI limitée à un colis principal. `DRAFT`, `SHIPPED`, `DELIVERED`, transporteur, suivi nullable, dates réelles. Pas d’expédition partielle ni intégration transporteur.

## 9. Transitions

Machine d’états explicite côté serveur, commande PAID, paiement SUCCEEDED, réservations CONSUMED. Aucune transition sautée ou rétrograde, aucun stock modifié par la logistique. Les doubles actions identiques sont idempotentes ; les modifications du brouillon utilisent sa version.

## 10. Préparation admin

Vues À traiter / En préparation / Prêtes / Expédiées / Toutes, filtres séparés, recherche tracking, tris dates commande/paiement/expédition. Dashboard opérationnel avec journée Europe/Paris, y compris changements d’heure. Le détail propose uniquement l’action suivante et expose le bon de préparation.

## 11. Tracking

Transporteurs centralisés : Colissimo, Mondial Relay, Chronopost, UPS, DHL, Autre. Numéro conservé comme chaîne, longueur/contrôles validés. URL réelle saisie, HTTP(S) sans identifiants. Autre permet un envoi sans suivi justifié par sa méthode ; aucun lien inventé. Correction explicite après expédition, motif obligatoire, audit et date initiale conservée, sans nouvel email.

## 12. Page client

`/commande/[publicId]` : paiement, statut logistique français, dates réelles, transporteur, numéro et lien. Le cookie propriétaire continue de fonctionner. Les emails ajoutent un jeton signé de consultation de 180 jours, valable uniquement pour une commande payée ; aucune autorisation de paiement n’en découle. Aucune ETA ou donnée transporteur fictive.

## 13. Fournisseur

**Resend**, choisi explicitement. Endpoint officiel `POST /emails`. Domaine expéditeur/SPF/DKIM et destinataire de recette restent à configurer ; aucun email réel envoyé. Documentation : [envoi d’emails Resend](https://resend.com/docs/api-reference/emails/send-email).

## 14. Abstraction email

Interface `EmailProvider`, adaptateur Resend, enveloppe typée et erreurs contrôlées. Le domaine enregistre l’intention d’envoi sans importer un SDK fournisseur. Les tests remplacent uniquement le fournisseur, avec PostgreSQL réel.

## 15. Outbox

Insertion PENDING dans la transaction qui confirme PAID ou SHIPPED ; appel réseau après commit. `next/server.after` tente un traitement après réponse ; `npm run emails:process` traite jusqu’à 50 entrées. Aucun scheduler installé : le déploiement devra planifier cette commande.

## 16. EmailDelivery

Destinataire issu d’Order, type, statut, snapshot métier, enveloppe figée, fournisseur/référence, compteur, bail/jeton de possession, échéance de reprise, blocage de retry, erreur contrôlée et date d’acceptation. Un `SENT` signifie accepté par Resend, pas reçu par le client.

## 17. Idempotence

Unicité DB par commande/type, claim `FOR UPDATE SKIP LOCKED`, bail de 5 minutes, écritures conditionnées au jeton de possession. Clé fournisseur stable `caldera-email:<id>` et corps figé avant l’appel. Resend garde ses [clés 24 heures](https://resend.com/docs/dashboard/emails/idempotency-keys) : blocage conservateur après 23 heures depuis la première tentative, nécessitant une vérification fournisseur. Pas de garantie trompeuse au-delà de cette fenêtre.

## 18. Confirmation

Uniquement lors de la transition réelle PAID du service webhook existant. Snapshots articles/variantes/SKU/quantités/prix, totaux, adresse/méthode de livraison, logo absolu et lien personnel. Rien au retour navigateur ou à la création d’intent. Pas de rattrapage automatique des commandes historiquement payées.

## 19. Expédition

Uniquement lors de READY_TO_SHIP → SHIPPED, dans la même transaction que Shipment, Order et audit. Transporteur, suivi et bouton si URL disponible ; le template sans suivi n’a aucun bouton cassé. La livraison manuelle n’envoie pas de troisième email dans cette phase.

## 20. Retry

5 tentatives maximum ; backoff 1, 2, 4, 8 minutes entre tentatives. Bail expiré récupérable dans la fenêtre d’idempotence. Retry admin sur FAILED éligible, sans modifier le destinataire ; SENT et limite atteinte refusés. Enveloppe déjà figée vers une autre adresse de test : envoi bloqué, aucune réécriture silencieuse.

## 21. Échecs fournisseur

Timeout réseau 10 secondes, codes limités sans réponse brute ni secret. PAID/SHIPPED et stock restent inchangés. Configuration globale manquante : file en attente et log contrôlé. Échec d’une tentative : FAILED et prochaine échéance. Les reprises ambiguës trop anciennes exigent une vérification dans Resend.

## 22. Historique

Réutilisation d’`AdminAuditLog`, sans table d’événements redondante : préparation, prêt, expédition, livraison manuelle, création/modification/correction du suivi et retry. Auteur et date conservés ; la timeline client n’expose pas les corrections internes.

## 23. Bon de préparation

`/admin/commandes/[id]/bon-preparation`, réservé aux admins et commandes payées. Snapshots, images, SKU, langue, quantité, adresse et mode de livraison. Impression navigateur, SCSS print, cases de contrôle papier. Aucun coût, note interne ou secret ; ce n’est pas une facture.

## 24. Sécurité

Session/rôle/admin actif vérifiés avant lectures et Server Actions, contrôles Origin existants, liste blanche des champs, verrous/transactions réutilisés. Templates échappés, URLs validées. Aperçus authentifiés no-store/noindex avec CSP sans scripts. Consultation client signée HMAC, timing-safe, limitée par commande et expiration, no-referrer. Rotation du secret révoquant les liens. Envoi dev bloqué sans destinataire test ; secrets côté serveur exclusivement.

## 25. Tests

- `test:fulfillment:db` : **14 scénarios**, PostgreSQL réel, fournisseur simulé : paiement requis, disabled, HTML/URLs/signature, échec/backoff/retry, concurrence workers, préparation, brouillon, double expédition, correction, reprise ambiguë, limite/fenêtre expirée, destinataire figé, absence de suivi/livraison manuelle, changements d’heure, admin révoqué (certains regroupés dans le même scénario).
- `test:payments:db` : **16 scénarios**, dont doubles webhooks avec exactement une confirmation PENDING et un seul stock consommé.
- `test:admin:db` : **15 scénarios** de non-régression.
- `test:admin:http` : **11 scénarios**, serveur de production local : authentification/actions, workflow logistique, filtres/recherche, aperçu privé, bon, lien signé en lecture seule, retry et livraison.
- `test:payments:http` : **6 scénarios**, protection du parcours paiement conservée.
- `test:stripe:sandbox` : **3 scénarios Stripe TEST réels** : succès, refus, authentification requise. Le vrai webhook signé de succès confirme PAID et crée exactement un email PENDING sans tentative d’envoi. Aucun débit réel ; fixtures locales nettoyées, traces Stripe TEST conservées.

Le runner Node compte aussi chaque test parent : 67 résultats pour les cinq suites DB/HTTP, soit 62 scénarios utiles. Aucun navigateur de contrôle connecté : rendu desktop/mobile, focus interactif, aperçu d’impression, Payment Element et défi 3DS interactif restent à vérifier visuellement. L’HTML et les routes ont été testés, pas la réception dans Gmail/Outlook ni la délivrabilité Resend.

## 26. Reporté volontairement

Configuration réelle Resend et domaine, premier destinataire de test/réception, scheduler de production, webhooks de délivrabilité, APIs transporteurs/étiquettes/point relais, expéditions partielles, factures, remboursements, retours, comptes clients. Aucune phase suivante commencée.

## 27. Prisma generate

Réussi avec Prisma 7.10.0 ; client généré correctement. Exécuté à nouveau par `npm run build`.

## 28. Migration

Appliquée sans reset ni suppression. `npx prisma migrate dev` confirme la synchronisation du schéma et l’absence de migration en attente.

## 29. Lint

`npm run lint` réussi, zéro erreur et zéro avertissement ESLint.

## 30. Build

`npm run build` réussi : compilation Next.js, TypeScript et génération des routes, incluant l’aperçu email et le bon de préparation. Application locale : [localhost:3000](http://localhost:3000), administration : [localhost:3000/admin](http://localhost:3000/admin), health check : [localhost:3000/api/health](http://localhost:3000/api/health).
