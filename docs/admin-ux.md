# Back-office — Caldera Control Room

Refonte visuelle et UX indépendante de la boutique. Les services métier, permissions, paiements et schéma PostgreSQL sont conservés.

## Direction graphique

Inspiration console 16-bit : surfaces crème, violet, cyan et accents pastel ; cadres francs, ombres décalées, trame discrète et typographie monospace pour le branding, les titres et les compteurs. Le texte et les formulaires gardent une police lisible. Pas de clignotement, son, scanlines sur le contenu ou animation permanente.

La palette est définie dans `src/components/admin/_tokens.scss`. `Admin.module.scss` assemble les partials de `src/components/admin/styles/` : base, shell, composants, dashboard et utilitaires. Les classes restent des SCSS Modules, chargées dans l’administration. Aucune dépendance ajoutée.

## Améliorations UX

- Navigation organisée en Pilotage et Catalogue ; rubrique active visible, fil d’Ariane sur desktop et navigation mobile en dialogue natif avec retour du focus au bouton d’ouverture.
- Dashboard : quatre indicateurs logistiques prioritaires, accès direct aux commandes à traiter, raccourcis création produit / stocks / expéditions, dernières commandes et alertes basées sur PostgreSQL. Aucun chiffre, graphique ou indicateur de santé fictif.
- Catalogue et commandes : recherche immédiatement accessible ; filtres et tri regroupés dans un panneau repliable, ouvert lorsque des critères sont actifs. Réinitialisation visible et paramètres conservés dans les URL.
- Vues commandes : onglet actif identifié ; paiement et préparation affichés séparément avec libellés et couleurs cohérentes.
- Badges : succès, attente, traitement en cours, erreurs et états neutres différenciés. La couleur complète toujours un texte.
- Formulaires : actions principales/secondaires distinctes, copie discrète, état occupé annoncé, retours succès/erreur accompagnés d’une icône. Confirmations et contrôles serveur existants maintenus.
- Pagination : précédent/suivant toujours visibles, non interactifs quand indisponibles ; tableaux défilants au clavier, focus visible et adaptation mobile.
- Connexion et écran d’erreur intégrés au même univers graphique. Bon de préparation conservé pour une impression sobre.

## Fichiers concernés

Nouveaux :

- `src/components/admin/_tokens.scss`
- `src/components/admin/styles/_base.scss`
- `src/components/admin/styles/_shell.scss`
- `src/components/admin/styles/_components.scss`
- `src/components/admin/styles/_dashboard.scss`
- `src/components/admin/styles/_utilities.scss`
- `src/components/admin/AdminBreadcrumbs.tsx`
- `src/components/admin/FilterPanel.tsx`
- `docs/admin-ux.md`

Modifiés :

- `src/components/admin/Admin.module.scss`
- `src/components/admin/AdminNavigation.tsx`
- `src/components/admin/AdminUI.tsx`
- `src/components/admin/AdminForm.tsx`
- `src/components/admin/CopyButton.tsx`
- `src/app/admin/(dashboard)/layout.tsx`
- `src/app/admin/(dashboard)/page.tsx`
- `src/app/admin/(dashboard)/produits/page.tsx`
- `src/app/admin/(dashboard)/commandes/page.tsx`
- `src/app/admin/(dashboard)/stocks/page.tsx`
- `src/app/admin/login/page.tsx`
- `src/app/admin/error.tsx`
- `src/lib/admin/format.ts` (libellés de statuts logistiques)

## Vérification

- `npm run lint` : réussi.
- `npx tsc --noEmit` : réussi.
- `npm run build` : réussi, y compris la nouvelle 404.
- `npm run test:admin:http` : 11 scénarios réussis, plus le test parent (12 résultats Node). Authentification, protections, recherches, formulaires, upload, workflow logistique, suivi signé, révocation et déconnexion. Données temporaires nettoyées.
- Prettier : conforme.
- Pas de navigateur connecté : le rendu visuel et les interactions au clavier sont à contrôler dans le navigateur, notamment à 390, 768 et 1440 px. Les vérifications HTTP ne valent pas une recette visuelle.

Accès : http://localhost:3000/admin. Aucun compte de démonstration permanent créé ; utiliser son compte admin existant ou `npm run admin:create` si nécessaire.
