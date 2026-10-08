# Navigation cinématique Caldera

Révision du 9 octobre 2026 après le signalement « aucune transition visible ».

## Problème et correction

Le précédent moteur pouvait recevoir un callback natif et supprimer le fallback
sans vérifier qu’une scène était effectivement peinte. Le voile était un élément
vide à `z-index: -1`, animé seulement dans une capture native. La durée CSS et le
callback ne prouvaient donc pas la visibilité de l’effet.

Le voile est maintenant composé de vrais éléments DOM : une brume directionnelle
et deux bandes de cadrage avec un filet doré. Il est affiché au-dessus de la page,
sous le header, avec `pointer-events: none` et `aria-hidden`. La caméra anime
le décor existant et les textes arrivent progressivement. Les snapshots natifs
sont réservés à l’image partagée produit ; aucun callback ne peut désactiver le
voile réel. Les captures du paysage et du texte sont exclues des types produit.
Le root n’est pas capturé, afin de conserver le contenu et ses contrôles vivants.

Aucun intercepteur de liens, délai de navigation ou dépendance supplémentaire.
La clé `pathname` recrée le voile à chaque destination, y compris deux chapitres
consécutifs de même type. Les filtres, ancres, historique, formulaires et pages
utilitaires conservent leur fonctionnement immédiat.

## Durées

| Parcours                                                                 | Desktop             | Écran étroit        |
| ------------------------------------------------------------------------ | ------------------- | ------------------- |
| Accueil / boutique → Univers, chroniques, retour depuis l’Univers        | 1 900 ms            | 1 600 ms            |
| Accueil → catalogue, catégories et navigation boutique                   | 1 600 ms            | 1 400 ms            |
| Guides, actualités et autres pages de lecture                            | 1 100 ms            | 900 ms              |
| Image produit partagée, avec voile léger d’arrivée                       | 850 ms              | 650 ms              |
| Paiement, administration, pages utilitaires, ancres, filtres, historique | Aucun effet de page | Aucun effet de page |

La caméra passe de 1,12 à 1, sans blur du texte. Entre chapitres, elle ajoute un
mouvement latéral orienté. Le cadrage reste en place pendant 35 % du parcours puis
s’ouvre lentement. Le voile se dissipe sans écran totalement noir. Les textes
s’animent sur 800 ms, avec 100 ms de départ et 60 ms entre couches.

## Dégradation et nettoyage

- Les animations ordinaires `transform` / `opacity` fonctionnent sans View
  Transitions API. Leur visibilité ne dépend plus des capacités natives.
- `prefers-reduced-motion: reduce` désactive voile, caméra, texte et morphs.
  Un changement de préférence en cours de navigation nettoie la présentation.
- Première visite, rechargement et HTML sans JavaScript : contenu visible sans
  animation ni voile. Aucune classe de masquage initial n’est rendue au serveur.
- Nettoyage à 2 200 ms ; garde-fou de 10 s pour une navigation abandonnée ;
  nettoyage également à `pagehide`. Une nouvelle navigation annule l’ancien timer.
- Aucun CTA, bouton, lien, formulaire, header ou footer n’est animé/capturé.

## Vérification de cette révision

- Les tests runtime contrôlent API partielle/complète, première visite, commit
  répété, chapitres consécutifs, mouvement réduit, filtres, historique et utilitaires.
- Le test CSS compile le SCSS avant de vérifier les sélecteurs de chaque parcours.
- Vérification visuelle locale dans Chromium : arrivée Accueil → Univers avec
  brume réellement peinte, bandes visibles et décor présent. Le mode DOM est
  `live` ; l’opacité mesurée de la brume pendant la capture est 0,664.
- Les tests physiques iPhone/Android restent dispensés par l’utilisateur. Aucune
  mesure de 60 FPS ou de Core Web Vitals sur appareil réel n’est revendiquée.

Les résultats complémentaires de CI et du contrôle public sont consignés dans
la PR de cette révision.

## Fichiers de cette révision

- `src/components/transitions/TransitionStage.tsx`
- `src/components/transitions/ArrivalLayers.tsx`
- `src/lib/transitions/runtime.ts`
- `src/lib/transitions/classes.ts`
- `src/styles/base/_transitions.scss`
- `tests/transitions.test.ts`
- `tests/helpers/transitions-runtime.client.ts`
- `docs/cinematic-navigation.md`
