# Raccords de la home au scroll

## Principe

Les vrais contenus portent les transitions. Aucun écran intermédiaire, titre ajouté, objet abstrait ni hauteur de scroll supplémentaire. L’ordre commercial, les textes existants, les trois cartes Pokémon et les destinations des boutons sont conservés. Les sections conditionnelles absentes ne laissent aucun raccord vide.

Le paysage du Hero se prolonge en arrière-plan des familles. Les panneaux des familles, les produits et les extensions entrent en perspective avant de se stabiliser dans la zone de lecture. Les guides s’ouvrent comme des pages. Les paysages des origines et de la communauté changent doucement de cadrage. Les couleurs se rejoignent dans les espacements existants.

## Mouvement

`HomeJourney` reste rendu côté serveur. `observeHomeJourney` mesure les enveloppes stables des chapitres et des éléments, puis anime leurs enfants. Les titres principaux et la géométrie du document ne sont jamais transformés. L’animation est réversible et dépend de la position de scroll, sans détour imposé ni interception du défilement natif.

La scène Three.js existante arrive progressivement depuis les familles et se retire vers la sélection. Ses poses pendant le chapitre épinglé restent identiques. Aucune bibliothèque, texture ou contexte WebGL supplémentaire.

Les lectures de géométrie précèdent les écritures CSS. IntersectionObserver limite les mises à jour aux éléments proches du viewport ; requestAnimationFrame regroupe les événements. Les observateurs et événements sont nettoyés à la sortie et lors d’un changement de préférence d’animation.

## Accessibilité et dégradation

Les contenus sont visibles par défaut, sans opacité masquant les produits. Sans JavaScript, IntersectionObserver ou avec `prefers-reduced-motion`, le parcours reste statique et complet. Les titres, liens et boutons conservent leur ordre HTML. Le focus clavier et les ancres rétablissent la géométrie normale des éléments concernés. Les transformations sont réduites sur petit écran et la projection horizontale est contenue sans modifier les ancêtres des scènes sticky.

## Vérifications

- Types et ESLint ; compilation réelle de la page locale.
- Tests de continuité, limites, réversibilité, stabilité pendant le chapitre Three.js épinglé ; tests existants du parcours et des scènes.
- Contrôle visuel des raccords et des contenus réels dans le navigateur ; largeurs responsive et ancres clavier.
- Contrôles CI : build de production, tests unitaires/PostgreSQL, tests HTTP et audit SEO.

Les contrôles responsive ne constituent pas un test sur téléphone physique (dispense donnée par l’utilisateur).
