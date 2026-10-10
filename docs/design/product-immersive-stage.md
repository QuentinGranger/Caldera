# Fiche produit immersive

La fiche produit reprend le paysage forestier, le vert profond, l’or et la typographie de la home et des pages Pokémon. Le panneau d’achat crème conserve les variantes, prix, quantités, alertes et caractéristiques existants. Le mode démonstration conserve son interdiction d’achat.

## Three.js

`ProductStage` charge dynamiquement `mountProductStage` près du viewport. La scène WebGL représente un socle minéral et deux anneaux dorés éclairés, avec une caméra liée doucement au pointeur et au scroll natif. La photographie HTML reste la source réelle du produit : aucun modèle 360° ni côté absent des images n’est inventé.

Le rendu est à la demande, arrêté hors écran et dans un onglet masqué. Le DPR est plafonné à 1,5 ; les ressources, observateurs et événements sont libérés à la désactivation ou au démontage. Le bouton « Vue immersive » permet de revenir au décor statique.

Sans WebGL, en cas de perte de contexte, avec `prefers-reduced-motion`, sous 360 px de large ou 500 px de haut, la photographie, le socle CSS, les miniatures et le zoom restent utilisables. La scène décorative est exclue de l’arbre d’accessibilité.

## Vérifications

- TypeScript, ESLint et les 10 tests unitaires produit : réussis.
- Navigation des miniatures, zoom, flèches clavier, fermeture Échap et retour de focus : contrôlés dans Chromium.
- Désactivation/réactivation de la scène : contrôlée ; premier rendu WebGL confirmé par `data-product-stage="ready"`.
- Variante anglaise : prix, SKU, stock et caractéristiques actualisés.
- Largeurs 390 et 320 px : aucun débordement horizontal ; secours statique à 320 px.
- Tests HTTP, base de données, build et SEO : contrôlés par la CI avant fusion.

Les produits et visuels de QA sont fictifs et restent explicitement désignés comme tels.
