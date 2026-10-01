# Pages catalogue : un seul système

Toutes les pages qui montrent des produits (`/catalogue`, `/nouveautes`, `/precommandes`, `/en-stock`, `/{jeu}`, `/{jeu}/{facettes}`, `/categorie/{famille}`, `/extensions/{slug}`) et `/extensions` partagent les mêmes composants. Une page n’apporte que ses mots et sa vue.

## Ordre d’une page

1. **Hero** (`PageHero`) : fil d’Ariane, surtitre, H1 serif, une phrase, éventuellement une note, le CTA. Même hauteur, mêmes marges, même échelle de titres partout.
2. **Rangée de chips** : les rayons de la boutique (`AisleNav`, liens vers les pages, rayon courant marqué) sur le hub du jeu, ses familles et les familles transverses ; les familles de la liste (`CatalogQuickNav`, filtres) ailleurs. La chip courante est ramenée au centre sur mobile (`ChipRow`). Un rayon peut ajouter une seconde rangée pour un filtre (`browse: 'set'` : les extensions sur Boosters) : le même composant, le même paramètre d’URL que le tiroir, « Toutes les extensions » en tête.
3. **Produits** (`CatalogResults`) : barre d’exploration (nombre, recherche, filtres, tri), grille de `ProductCard`, pagination, état vide (`EmptyState`). Un guide (`CatalogInterlude`) s’intercale après huit produits, ou suit une grille courte.
4. **Après les produits** : sorties (hub du jeu), « Continuer l’exploration » (`ExploreSection` : chips vers des pages indexables, présentation de l’admin repliée), trois guides au plus (`LandingGuides`), questions en accordéon (`LandingFaq`).
5. **Lettre** puis données structurées : `CatalogShell` les place toujours en dernier.

Jamais de statistiques en phrases, de longues listes de liens ni de Markdown avant la grille : les chiffres vivent dans l’interface (compteur, chips, badges, filtres) et dans la meta description.

## Compositions du hero

Sur mobile la vue remplit toujours le hero. Au-delà de 60rem :

- `backdrop` : la vue en fond (listes transverses, `/extensions`) ;
- `arch` : une arche à droite (hub du jeu) ;
- `window` : un paysage à droite (familles, extensions).

Les vues viennent du monde de Caldera, jamais d’une créature ni d’un visuel de licence (`VIEWS` dans `pageCopy.ts`). Le jeu garde une seule vue, chaque rayon en cadre une autre partie (`focus`).

## Rythme

`src/styles/abstracts/_variables.scss` : `$rhythm-after-hero` (hero → chips), `$rhythm-grid` (barre → grille), `$rhythm-section` et `$rhythm-section-inner` (entre les blocs qui suivent les produits, lettre comprise).

## Vocabulaire des CTA

| Formulation                                       | Usage                              |
| ------------------------------------------------- | ---------------------------------- |
| Explorer les produits                             | du hero vers la grille de la page  |
| Voir tous les produits (Pokémon)                  | vers une liste complète            |
| Découvrir l’extension                             | carte d’extension (`SetCard`)      |
| Lire le guide                                     | un article                         |
| Voir tous les guides / Voir toutes les extensions | les index `/guides`, `/extensions` |
| Voir le calendrier                                | `/calendrier-des-sorties`          |
| Lire la présentation                              | texte de l’admin replié            |
| Réinitialiser les filtres / la recherche          | état vide d’une exploration        |

## Ajouter un rayon

1. Créer la famille dans l’admin : la page, ses filtres, sa place dans les chips et les liens viennent des données (pages indexables seulement).
2. Pour lui donner sa voix, ajouter une entrée dans `shopAisleCopy` (famille du jeu) ou `categoryCopy` (famille transverse) de `src/components/catalog/pageCopy.ts` : surtitre, phrase, cadrage de la vue, guide éventuel, rangée d’extensions (`browse`), cartes « édition » (`card: 'edition'` : l’extension seule en surtitre et les langues réellement en vente à côté du stock, comme sur Displays), lien visible vers la famille parente dans le hero (`up`), derniers produits ajoutés au-dessus de la barre (`latest`, selon le tri « Nouveautés » du catalogue, quatre au moins et jamais tous, comme sur Coffrets). Sans entrée, la page prend la description de l’admin et un surtitre générique.
3. Rien d’autre : hero, chips, barre, grille, cartes, filtres, blocs éditoriaux et lettre sont ceux de toutes les autres pages.
