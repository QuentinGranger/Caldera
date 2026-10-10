# Fiche produit immersive

La fiche produit reprend le paysage forestier, le vert profond, l’or et la typographie de la home et des pages Pokémon. Le panneau d’achat crème conserve les variantes, prix, quantités, alertes et caractéristiques existants. Le mode démonstration conserve son interdiction d’achat.

## Three.js

`ProductStage` charge dynamiquement `mountProductStage` près du viewport. La scène WebGL représente un socle minéral avec son bord doré, sans filaments derrière le produit. La caméra suit doucement le pointeur et le scroll natif.

La photographie déjà chargée devient une texture dans la même scène que le socle. Ses marges transparentes sont retirées en mémoire, à une résolution maximale de 1 024 pixels, pour poser son pied au centre du plateau. La caméra déplace ainsi l’ensemble sans décalage indépendant de la photo. Ses couleurs restent inchangées ; aucun modèle 360° ni côté absent des images n’est inventé. L’image HTML conserve le texte alternatif, le zoom et le secours statique, sans requête d’image supplémentaire.

Le rendu est à la demande, arrêté hors écran et dans un onglet masqué. Le DPR est plafonné à 1,5 ; les ressources, observateurs et événements sont libérés à la désactivation ou au démontage. L’effet est automatique, sans bouton de mode ; les conditions de secours restent prioritaires.

Sans WebGL, en cas de perte de contexte, avec `prefers-reduced-motion`, sous 360 px de large ou 500 px de haut, la photographie, le socle CSS, les miniatures et le zoom restent utilisables. La scène décorative est exclue de l’arbre d’accessibilité.

## Vérifications

- TypeScript, ESLint et les 10 tests unitaires produit : réussis.
- Navigation des miniatures, zoom, flèches clavier, fermeture Échap et retour de focus : contrôlés dans Chromium.
- Premier rendu WebGL confirmé par `data-product-stage="ready"`.
- Alignement sur le plateau, absence de filaments, changement de photographie et zoom : contrôlés dans Chromium après correction du socle.
- La galerie devient sticky uniquement à partir du passage en deux colonnes (1 200 px), pour éviter de couvrir les informations sur les largeurs intermédiaires.
- Trois tests unitaires vérifient le détourage des marges transparentes, les photos opaques et le secours sur image vide.
- Variante anglaise : prix, SKU, stock et caractéristiques actualisés.
- Largeurs 390 et 320 px : aucun débordement horizontal ; secours statique à 320 px.
- Tests HTTP, base de données, build et SEO : contrôlés par la CI avant fusion.

Les produits et visuels de QA sont fictifs et restent explicitement désignés comme tels.
