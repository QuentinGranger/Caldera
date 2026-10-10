# Visibilité des pages au lancement

La visibilité publique suit les données administrées. Aucun produit, catégorie, extension ou réglage n’est supprimé.

## Pages et navigation

- Header, menu mobile et footer proposent les extensions uniquement lorsque l’index contient des extensions publiables : produits associés ou sortie annoncée avec une date réelle.
- Les rubriques chronologiques sans extension et leurs ancres disparaissent. Les données fictives de développement ne deviennent pas des annonces en production, y compris dans le calendrier et les pages Pokémon.
- Le calendrier est proposé lorsqu’il contient au moins une sortie dans sa fenêtre temporelle. Une actualité vide mène vers les guides existants.
- Une famille, une extension détaillée ou une sélection sans aucun produit visible redirige temporairement vers Pokémon, le catalogue ou l’accueil selon les données disponibles. Une combinaison de facettes inexistante garde sa 404.
- Une recherche ou combinaison de filtres sans résultat sur une page ayant des produits reste accessible, avec les moyens de réinitialiser les critères.
- Un catalogue entièrement vide mène à l’accueil ; les menus ne proposent alors ni catalogue ni recherche de produits.

## Filtres

Les comptes sont calculés dans le périmètre non filtré de la page. Les choix à zéro et ceux couvrant tout le périmètre sont masqués. Un choix déjà actif reste retirable, même s’il est devenu vide. Les prix sont proposés seulement lorsque leur intervalle permet d’affiner, ou lorsqu’une borne est active.

## Mode de démonstration

Avec `CATALOG_DEMO_MODE=1`, panier et accès au checkout sont masqués/redirigés, le tiroir panier et ses rafraîchissements automatiques sont désactivés. Les filtres de prix et disponibilité sont masqués. L’accueil décrit les fonctions réellement accessibles (catalogue d’exemples, favoris, compte/Discord, contact), sans annoncer un achat ou une expédition disponibles. Les protections backend existantes restent en place.

Une liaison Discord non configurée n’affiche plus de bloc « bientôt disponible ». Les comptes déjà liés gardent leurs contrôles.

## Réactivation

Publier les produits et renseigner les extensions depuis l’admin réactive les pages concernées. L’invalidation du cache catalogue rafraîchit également la navigation ; son état extensions/calendrier expire au plus tard après cinq minutes. La remise en vente suppose les produits, livraisons et paiements réels déjà configurés, puis la désactivation explicite du mode démonstration.

## Vérifications

- Tests unitaires des choix de filtre, bornes de prix et menus vides/remplis.
- Tests PostgreSQL des comptes de disponibilité comparés aux résultats réels.
- Tests HTTP des anciens liens vers familles/extensions vides, préservation des données admin et recherches sans résultat.
- Test HTTP supplémentaire avec `TEST_CATALOG_DEMO=1` contre un serveur démarré en mode démonstration pour vérifier les accès panier/checkout et les fonctions conservées.

## Précommandes : fermeture explicite au lancement

`NEXT_PUBLIC_PREORDERS_ENABLED` est désactivé par défaut, indépendamment de
`CATALOG_DEMO_MODE`. Seule la valeur exacte `true` active le système ; un nouveau
build est obligatoire pour synchroniser serveur et interface.

Tant que le système est fermé : les précommandes sont exclues du catalogue,
des fiches publiques, des statistiques, du maillage et du sitemap ; les anciens
liens de listings redirigent vers le catalogue ou le jeu. Le filtre est retiré
des anciennes URL sans perdre les autres critères. Les paniers antérieurs et
les requêtes directes ne peuvent pas acheter ces produits. Les données restent
en base, et l’admin préserve le statut existant sans pouvoir créer une nouvelle
précommande. Le guide et la définition dédiés restent hors publication, avec
leurs sources conservées. Les CGV conservent leur clause explicite d’absence de
précommandes au lancement.

Avant toute activation : vérifier les allocations fournisseur, quotas et
concurrence, paiement et remboursements, commandes mixtes, expédition à partir
de la date de sortie, notifications, puis mettre à jour et valider les CGV et
les contenus éditoriaux. L’ouverture des achats ordinaires ne réactive jamais
automatiquement les précommandes. La CI teste le moteur activé et, dans des
processus distincts, les protections du lancement avec le système désactivé.
