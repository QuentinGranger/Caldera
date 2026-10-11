# Articles vers produits

Les guides et actualités utilisent leurs métadonnées `games`, `categories` et `sets` pour sélectionner leurs produits et construire le CTA. Les catégories comprennent leurs descendants. Une extension spécifique ne doit pas être remplacée par une recherche textuelle ou par une autre extension : renseigner son slug dans `sets`.

En mode commercial, seuls les produits publiés, non démonstratifs et hors précommande avec une variante active, un prix positif et du stock disponible sont proposés. Les prix et langues de l’aperçu proviennent de ces variantes disponibles. Le CTA « Voir les produits disponibles » reprend les mêmes catégories/extensions dans les filtres du catalogue, avec le filtre de disponibilité et une arrivée directe sur les résultats. Le filtre en stock exclut aussi les exemples et les variantes sans prix achetable. Il apparaît près de l’introduction et au-dessus des produits après l’article.

En mode démonstration, seuls les exemples pertinents sont montrés et le bouton dit « Voir les produits d’exemple », sans promesse de disponibilité. Sans correspondance, aucun CTA commercial, rayon vide ou remplacement par des produits sans rapport. Les FAQ, glossaire et liens de lecture existants restent inchangés.

Pour un article sur une ETB : `categories: [etb]`. Pour un comparatif ETB/display/booster : les trois catégories. Pour les protections tous jeux : `games: []`, `categories: [accessoires]`. Pour une extension : `games: [pokemon]`, `sets: [slug-reel-extension]`. Ne pas inventer de slug ou de stock.
