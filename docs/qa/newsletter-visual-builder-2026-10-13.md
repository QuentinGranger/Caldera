# Créateur newsletter visuel — 13 octobre 2026

## Évolution livrée

Le studio existant devient un éditeur de composition visuelle, inspiré des
blocs et styles du [créateur Mailchimp](https://mailchimp.com/help/design-an-email-new-builder/).
Il reste intégré à l’authentification MFA et à la file Caldera.

- Texte visuel avec Tiptap : gras, italique, H2/H3, listes, citations et liens.
  Le document enregistré reste du Markdown, traité par le moteur sûr existant.
  Le mode source reste accessible ; les contenus HTML/images/code/tableaux
  détectés sont conservés en mode source pour éviter une conversion silencieuse.
- Nouveaux blocs titre, image + texte (gauche/droite/haut), deux colonnes.
- Réglages par bloc : alignement, fond, marge intérieure et arrondi.
- Style du contenu : Arial/Georgia, 16/18 px, boutons forêt/bronze/prune.
  Palettes prédéfinies : aucun CSS libre ni couleur arbitraire illisible.
- Aperçu cliquable des blocs repliés, plan de navigation dans le message,
  insertion après le bloc sélectionné, flèches et glisser-déposer existants.
- Modèles de départ avec compositions distinctes ; les indications éditoriales
  restent à personnaliser et ne prétendent pas à une disponibilité commerciale.
- Export/import JSON de compositions réutilisables, validation stricte et
  confirmation avant remplacement ; identifiants de blocs renouvelés à l’import.
  Aucun destinataire, secret ou choix de programmation dans ces exports.
- Liste des destinations par bloc pour relire les liens avant envoi.
- Copie de secours automatique dans `sessionStorage`, propre à l’onglet,
  proposée à la restauration, expirée après 24 h. Distincte du brouillon serveur.
  Ne restaure que les champs éditoriaux validés ; jamais une programmation.
  Une composition avec URL provisoirement invalide conserve la dernière copie
  valide. Fermer l’onglet peut supprimer cette copie ; enregistrer reste requis.

## Architecture et compatibilité

Le format V1 s’enrichit de blocs et champs optionnels validés. Les documents
existants restent compatibles. Aucun changement Prisma, secret, fournisseur,
quota, audience, paiement ou envoi automatique.

Les nouveaux layouts utilisent des tables de présentation et des règles
mobiles d’empilement. Le HTML réellement envoyé et l’aperçu utilisent le même
moteur. La version texte inclut les titres, messages et destinations.

Tiptap est chargé à la demande dans l’administration ; seul le bloc actif monte
ses contrôles d’édition. Les versions des trois paquets directs sont fixées à
3.31.4 dans le lockfile. Aucun service SaaS supplémentaire.

## Vérifications

- `npm run test:newsletter` : 12 tests réussis, dont rendu des layouts, version
  texte, rejet du CSS injecté, colonnes malformées, liens et copies expirées.
- `tests/newsletter-db.test.ts` : 2 tests réussis.
- `tests/admin-http.test.ts` : 16 tests réussis, incluant MFA, Server Actions,
  sauvegarde multipart, images et programmation invalide.
- Build production, TypeScript et ESLint réussis.
- `npm audit --omit=dev` : aucune vulnérabilité signalée.
- Chromium local : texte visuel, sélection et gras, aller-retour Markdown,
  édition des deux colonnes, alignement/fond/marge/arrondi et style global,
  sauvegarde puis restitution, export JSON réel, réimport et confirmation.
- Bloc image + texte : saisie du contenu, alternative, lien et disposition à
  droite vérifiée dans l’aperçu.
- Largeurs 1280 px et 390 px : aucun débordement horizontal ; commandes de
  rédaction accessibles ; aucune erreur/alerte console sur la dernière recette.
- Aperçu e-mail mobile à 375 px : les deux cellules ont le même x/largeur et
  des positions verticales distinctes (`display:block`, largeur 277 px).

Recette sur PostgreSQL local, port 5435, serveur local 3099. Emails désactivés ;
aucun envoi aux abonnés, aucun changement de campagne de production.

## Limites de la recette

La restauration de la copie est couverte par la validation unitaire. Le test
complet quitter/revenir a été interrompu par une boîte native de confirmation
que l’outil de navigateur ne parvenait pas à piloter ; il n’est pas déclaré
validé de bout en bout. Le geste physique de glisser-déposer n’a pas été testé.
Les flèches restent disponibles.

Pas de réception réelle dans Gmail/Outlook/Apple Mail ni de téléphone physique.
Les clients qui ignorent les media queries gardent un layout en deux colonnes.
Les arrondis peuvent être simplifiés par certains clients e-mail.

Le studio ne prétend pas reproduire toute la plateforme Mailchimp : pas d’A/B
testing, de personnalisation par destinataire ou de synchronisation Mailchimp.
Les audiences, statistiques et programmations existantes restent disponibles.
