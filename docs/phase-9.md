# Phase 9 — Administration Caldera

Livraison du 20 septembre 2026, dans le projet existant. Next.js 16.3.5, React 19.3.0, Prisma 7.10.0 conservés. SCSS Modules, aucune bibliothèque UI ajoutée.

## 1. Fichiers créés

- `src/app/admin/(dashboard)/categories/page.tsx`
- `src/app/admin/(dashboard)/commandes/[id]/page.tsx`
- `src/app/admin/(dashboard)/commandes/page.tsx`
- `src/app/admin/(dashboard)/extensions/page.tsx`
- `src/app/admin/(dashboard)/layout.tsx`
- `src/app/admin/(dashboard)/page.tsx`
- `src/app/admin/(dashboard)/produits/[id]/page.tsx`
- `src/app/admin/(dashboard)/produits/nouveau/page.tsx`
- `src/app/admin/(dashboard)/produits/page.tsx`
- `src/app/admin/(dashboard)/stocks/page.tsx`
- `src/app/admin/error.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/login/page.tsx`
- `src/app/media/[filename]/route.ts`
- `src/components/admin/Admin.module.scss`
- `src/components/admin/AdminFields.tsx`
- `src/components/admin/AdminForm.tsx`
- `src/components/admin/AdminNavigation.tsx`
- `src/components/admin/AdminUI.tsx`
- `src/components/admin/CopyButton.tsx`
- `src/components/admin/ImageManager.tsx`
- `src/components/admin/ProductInformationForm.tsx`
- `src/components/admin/SlugFields.tsx`
- `src/components/admin/StockAdjustmentForms.tsx`
- `src/components/admin/VariantEditor.tsx`
- `src/lib/admin/action-types.ts`
- `src/lib/admin/actions.ts`
- `src/lib/admin/auth.ts`
- `src/lib/admin/common.ts`
- `src/lib/admin/format.ts`
- `src/lib/admin/images.ts`
- `src/lib/admin/inventory.ts`
- `src/lib/admin/login.ts`
- `src/lib/admin/orders.ts`
- `src/lib/admin/products.ts`
- `src/lib/admin/queries.ts`
- `src/lib/admin/taxonomy.ts`
- `src/lib/admin/validation.ts`
- `src/lib/storage/images.ts`
- `scripts/create-admin.ts`
- `tests/admin-db.test.ts`
- `tests/admin-http.test.ts`
- `prisma/migrations/20260920134124_admin_back_office/migration.sql`
- `docs/phase-9.md`

## 2. Fichiers modifiés

- `package.json`, `package-lock.json` : dépendances et scripts admin.
- `prisma/schema.prisma` : modèles admin, relations d’historique, note interne.
- `next.config.ts` : enveloppe Server Actions limitée à 6 Mo pour l’upload de 5 Mo.
- `.env.example` : secret Better Auth et stockage persistant documentés.
- `.gitignore` : exclusion `.data/`.
- `src/proxy.ts` : noindex et cache privé sur l’administration.
- `src/components/layout/StorefrontOnly/StorefrontOnly.tsx` : masquage du header/footer boutique dans l’espace dédié.
- `src/components/cart/CartProvider.tsx` : aucun drawer/rafraîchissement automatique du panier dans l’administration.
- `src/lib/orders/common.ts` : reprise bornée des conflits SQL bruts `P2010` / `TransactionWriteConflict`, en complément des `P2034` déjà gérés ; règles de commande inchangées.
- `README.md` : installation, exploitation, sécurité, stockage, tests.
- `.env` local ignoré : ajout d’un secret admin aléatoire, sans lecture/affichage des clés Stripe existantes.

## 3. Dépendances

`better-auth@1.7.5` : bibliothèque d’authentification et adaptateur Prisma inclus. `sharp@0.35.4` : décodage et réencodage d’images. Versions épinglées ; npm uniquement. Installation : audit npm sans vulnérabilité signalée.

## 4. Modèles Prisma

Ajoutés : `AdminUser`, `AdminAccount`, `AdminSession`, `AdminVerification`, `AdminLoginAttempt`, `InventoryAdjustment`, `AdminAuditLog`. `AdminVerification` appartient au schéma standard Better Auth ; aucun parcours public de vérification ou d’inscription n’est exposé.

Enums `AdminRole` (ADMIN) et `InventoryAdjustmentType`. `ProductVariant.adjustments` relie les ajustements. `Order.internalNote` est nullable et interne. Le hash scrypt est stocké dans `AdminAccount.password`, conformément à Better Auth, jamais dans un champ de mot de passe en clair.

## 5. Migration

`20260920134124_admin_back_office`, additive, appliquée sans reset. Index uniques partiels : une variante par défaut et une image principale par produit. CHECK des quantités d’ajustement et cohérence du delta. Relations d’historique Restrict. Les index uniques refusent des données préexistantes incohérentes plutôt que de les corriger arbitrairement ; les données locales étaient compatibles.

## 6. Authentification

Email normalisé + mot de passe, scrypt Better Auth, rôle ADMIN et utilisateur actif. Inscription désactivée. Aucun endpoint API auth générique. Connexion via Server Action ; contrôle anti-brute-force persisté et erreurs génériques. Premier compte via `npm run admin:create`, saisie masquée et confirmation, aucun compte par défaut. Script validé dans un pseudo-terminal avec suppression du compte temporaire.

Références : [intégration Next.js](https://better-auth.com/docs/integrations/next), [adaptateur Prisma](https://better-auth.com/docs/adapters/prisma), [authentification email/mot de passe](https://better-auth.com/docs/authentication/email-password).

## 7. Sessions

Session serveur PostgreSQL, cookie signé dédié, HttpOnly, SameSite=Lax, Secure en production, durée absolue 8 h. Aucun localStorage ou cache cookie servant de source d’autorisation. Relecture de l’admin actif à chaque requête ; logout révoque la session. Le panier invité n’accorde aucun droit admin.

## 8. Routes

`/admin/login`, `/admin`, `/admin/produits`, `/admin/produits/nouveau`, `/admin/produits/[id]`, `/admin/stocks`, `/admin/commandes`, `/admin/commandes/[id]`, `/admin/categories`, `/admin/extensions`. Layout dédié, nom/email/logout, navigation latérale et dialogue de navigation sur petit écran. `/media/[filename]` est une route publique d’images, sans accès arbitraire au système de fichiers.

## 9. Dashboard

Compteurs et agrégations réels : produits actifs, rupture, faible stock, commandes en attente, commandes payées sur 7 jours, réservations actives. Alertes PAYMENT_REVIEW et échecs récents, dernières commandes, total historique PAID, audit récent. Aucun graphique ou indicateur inventé.

## 10. Produits

Recherche nom/slug/SKU/EAN, filtres statut/type/catégorie/extension/langue/disponibilité, tri nom/création/modification/prix/stock. Pagination SQL 25 résultats. Liste limitée aux champs utiles et une image/SKU principal. Création DRAFT puis édition organisée en sections. Slug automatique éditable, tags intégrés, dates et flags. Publication validée, dépublication et archivage sans suppression. Placeholders conservés ; date de publication éditoriale sans programmation automatique.

## 11. Variantes

SKU et code-barres uniques, langue, état NEW, prix/ancien prix/coût Decimal, seuil, poids, actif et défaut. Ancien prix inférieur au prix refusé. Défaut unique transactionnel et garanti par index. Coût uniquement interne. Stock initial audité ; modifications de stock ultérieures dans le service d’inventaire. Désactivation conserve les commandes.

## 12. Images

Upload local abstrait, MIME/extension/taille contrôlés puis véritable décodage Sharp. 5 Mo, 20 mégapixels, image non animée, WebP maximum 2400 px, metadata retirées. UUID sans nom de fichier fourni par le navigateur. Alt, ordre et principale transactionnelle. Retrait de la galerie conserve les blobs pour les snapshots, y compris en cas de checkout concurrent. Pas de téléchargement d’images protégées ni de fournisseur cloud choisi.

Production : volume persistant `UPLOAD_DIR`, sauvegardé et partagé si plusieurs instances. Aucun garbage collector ajouté. Les assets de marque ne sont jamais supprimés.

## 13. Catégories

Créer/modifier nom, slug, description, parent, ordre, activité. Liste parent/compteur produits. Pas de hard delete. Auto-parent et cycles refusés ; écritures structurelles sérialisées et testées simultanément.

## 14. Extensions

Créer/modifier nom, slug, code, série, description, sortie, logo/symbole locaux, activité. Liste avec logo et nombre de produits. Désactivation conserve les associations. Les tags restent dans le formulaire produit.

## 15. Stocks

Vue physique/réservé/disponible/seuil, recherche produit/SKU, filtres rupture/faible/réservé. Réapprovisionnement delta ou correction absolue motivée. Correction périmée refusée. Verrou de variante, transaction Serializable et reprises bornées empêchent les mises à jour perdues. Deux ajouts simultanés testés.

## 16. InventoryAdjustment

Auteur, variante, type, avant, delta, après, motif, date. Écrit dans la même transaction que le stock et son audit. Derniers ajustements consultables par variante. Les commandes liées aux réservations actives sont accessibles depuis cette fiche.

## 17. Protection des réservations

Aucun input `reservedQuantity`. Liste blanche stricte côté serveur, quantité disponible générée par PostgreSQL. Stock physique inférieur au réservé refusé avec indication du nombre réservé. Les réservations ne peuvent être supprimées manuellement depuis l’admin.

## 18. Liste commandes

Pagination serveur 25, recherche numéro/email/publicId/SKU, filtres Order/Payment/dates/livraison et tris date/montant. La liste charge un compteur de lignes et le statut de paiement, pas tous les articles/adresses.

## 19. Détail commande

Snapshots des articles/prix/SKU/langues, montants figés, adresses, livraison, paiement et identifiant copiable, réservations, dates et chronologie simple. Liens vers les produits actuels sans remplacer les snapshots. Note interne, jamais affichée au client.

## 20. Transitions Order / Payment

Aucun select arbitraire pour Order.status ou Payment.status. Aucune édition des montants/articles/PaymentIntent. Annulation uniquement PENDING_PAYMENT/PAYMENT_FAILED par le service existant, avec contrôle Stripe avant libération. PAID, PROCESSING et REVIEW ne sont pas annulables ici ; aucun remboursement simulé. Un état évoluant pendant la demande peut empêcher l’annulation.

## 21. Audit

Produits, variantes/prix/activation, publication/archivage, stock, images, catégories/extensions et modifications autorisées de commandes. Metadata limitées aux champs techniques utiles ; jamais mot de passe, secret, carte ou contenu de note. Journal non éditable dans l’interface. Demande et résultat d’annulation sont distingués, les appels Stripe restant hors transaction.

## 22. Revalidation

Catalogue toujours lu depuis PostgreSQL, React cache limité à la requête. Invalidation ciblée des fiches (ancien/nouveau slug), listes catalogue/catégories/extensions/nouveautés/précommandes et pages admin. Homepage invalidée en tant que page pour ses sélections ; aucune invalidation globale du layout.

## 23. Sécurité

Authentification aux frontières de lecture et dans chaque action, contrôle admin actif dans les transactions, validation runtime et liste blanche. CSRF natif conservé. Erreurs techniques génériques, aucune stack UI. Noindex/no-follow, cache privé, CSP et autres headers conservés. Upload sécurisé, images statiques de marque protégées. Expiration, logout et désactivation vérifiés par HTTP. Dates Europe/Paris centralisées.

## 24. Tests

- `test:admin:db` : 15 scénarios (16 tests comptés avec le parent) : hash, publication, prix/coûts, SKU, defaults, images, stocks/réservations, audit, faux champs, annulation, snapshots, cycles concurrents, extensions, admin inactif, limitation et ajustements simultanés.
- `test:admin:http` : 10 scénarios réussis (11 tests avec le parent), sur build production local : routes, auth, CSRF, sessions, listes/recherches, détails, fausses mutations, upload/optimisation/suppression, révocation, expiration et logout.
- Régressions PostgreSQL : catalogue 8, fiche produit 3, panier 15, checkout 14, paiements 16 scénarios.
- Script de création admin : terminal réel simulé, compte créé puis supprimé, absence de mot de passe dans toute la sortie vérifiée.
- Aucun navigateur connecté : recette visuelle/tablette et interaction clavier/dialogues à faire manuellement. Les tests HTTP ne sont pas présentés comme des tests de rendu visuel.
- Avertissement préexistant du pilote `pg` sur des requêtes internes Prisma concurrentes observé dans certaines suites ; aucun échec associé, aucune migration vers pg 9 réalisée.

Total : **81 scénarios automatisés réussis** lors de cette phase (25 admin + 56 régressions PostgreSQL), en plus du test du script CLI. Prettier vérifié sur tous les fichiers de cette phase.

## 25. Volontairement hors périmètre

Expédition/transporteurs/tracking, emails, factures PDF, remboursements, retours, promos, fournisseurs/import CSV, BI/comptabilité, espace client, favoris, fidélité, multi-entrepôts. Pas de RBAC complet/invitations, cloud, bulk actions, preview privée ou publication programmée. Les données catalogue et livraisons de démonstration existantes sont conservées ; l’admin lit et écrit réellement PostgreSQL.

## 26. Prisma generate

Client 7.10.0 généré avec succès. Code généré ignoré par Git.

## 27. Migration

`prisma migrate dev` : appliquée sans reset, puis contrôle « Already in sync ». `prisma migrate status` : 6 migrations, schéma à jour. Aucune table existante supprimée.

## 28. Lint

`npm run lint` : ESLint sans erreur ni avertissement. TypeScript strict vérifié également par `tsc --noEmit` et le build.

## 29. Build et utilisation

`npm run build` : réussi, compilation de production Next.js avec génération Prisma. Les routes admin sont dynamiques.

```bash
npm run admin:create
npm run dev
```

Administration : http://localhost:3000/admin ; santé : http://localhost:3000/api/health. Le secret admin local est déjà configuré. Aucun compte temporaire de test n’est conservé ; le compte personnel reste à créer. En production seulement : définir `UPLOAD_DIR` et le secret/origine propres au déploiement. Aucune phase suivante engagée.
