# Pages Pokémon : continuité avec la home

## Périmètre

`/pokemon` et `/pokemon/scelles` seulement. Les autres familles, extensions et jeux conservent leur présentation. Même palette forêt, crème et or, mêmes paysages locaux et mise en relief des objets. Le hub montre un éventail éditorial Pokémon explicitement hors catalogue ; la famille scellée montre l’image d’un produit réellement fourni par la requête catalogue, avec repli éditorial si elle est vide. Aucune disponibilité inventée.

Le catalogue vient directement après le hero : navigation des rayons, recherche, filtres, tri, produits et pagination. Les guides, raccourcis, sorties, FAQ et newsletter suivent dans la même palette. Les FAQ et les données structurées restent alimentées par les données administrées existantes.

## Mouvement et repli

`PokemonHero` est rendu côté serveur. `PokemonMotion` réutilise l’observateur de profondeur de la home, limité à son propre `main` et réinitialisé quand la requête catalogue change. Perspective CSS sur les images uniquement ; titres, liens, boutons, filtres et barre sticky restent dans leur géométrie native. Aucun canvas supplémentaire, dépendance, API, verrouillage du scroll ou longue séquence imposée.

Travail à la demande sur les objets proches du viewport, événements passifs, aucun rendu continu au repos. Les observateurs et événements sont libérés au démontage. `prefers-reduced-motion` coupe les mouvements ; sans JavaScript ou sans IntersectionObserver, les images et toutes les fonctions de navigation restent accessibles. Le pointeur tactile ne pilote pas l’inclinaison ; les mouvements des images de grille sont réduits sur petit écran.

## Contrôles

- Chromium desktop ; largeurs 390 et 320 px sans débordement horizontal.
- Safari desktop (hub) et Firefox desktop (famille scellée).
- Filtres de disponibilité, tri par prix, ouverture des FAQ, navigation vers le catalogue.
- Tests existants de catalogue, filtres, landing, FAQ et cycle de vie de la profondeur ; types, lint et CI complète avant publication.
- Aucun test sur téléphone physique, conformément à la demande précédente.
