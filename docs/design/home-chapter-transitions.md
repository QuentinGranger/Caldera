# Raccords de la home au scroll

## Principe

Les vrais contenus portent les transitions. Aucun écran intermédiaire, titre ajouté, objet abstrait ni hauteur de scroll supplémentaire. L’ordre commercial, les textes existants, les trois cartes Pokémon et les destinations des boutons sont conservés. Les sections conditionnelles absentes ne laissent aucun raccord vide.

Le paysage du Hero se prolonge en arrière-plan des familles. Les panneaux des familles, les produits et les extensions entrent en perspective avant de se stabiliser dans la zone de lecture. Les guides s’ouvrent comme des pages. Les paysages des origines et de la communauté changent doucement de cadrage. Les couleurs se rejoignent dans les espacements existants.

Les raccords de couleur s’étendent maintenant sur 18 svh. Un champ de lumière dorée traverse chaque frontière réelle entre deux chapitres : il apparaît lorsque la frontière entre dans le viewport, atteint son maximum à mi-parcours, puis s’éteint. Il est décoratif, sans interaction ni hauteur ajoutée. À la sortie du chapitre 3D, la surface claire suivante monte avec une courbe douce dans le raccord déjà réservé, sous le dernier CTA ; le fondu statique reste le repli sans mouvement.

L’entrée des visuels commence légèrement avant le viewport et reste stabilisée à son premier quart. Les angles et le changement d’échelle sont réduits pour une sensation de profondeur plus douce. Le raccourci de la scène 3D utilise une ancre HTML native, y compris si le fragment courant désigne déjà la destination.

## Mouvement

`HomeJourney` reste rendu côté serveur. `observeHomeJourney` mesure les enveloppes stables des chapitres et des éléments, puis anime leurs enfants. Les titres principaux et la géométrie du document ne sont jamais transformés. L’animation est réversible et dépend de la position de scroll, sans détour imposé ni interception du défilement natif.

La scène Three.js existante arrive progressivement depuis les familles et se retire vers la sélection. Ses poses pendant le chapitre épinglé restent identiques. Aucune bibliothèque, texture ou contexte WebGL supplémentaire.

Les lectures de géométrie précèdent les écritures CSS. IntersectionObserver limite les mises à jour aux éléments proches du viewport ; requestAnimationFrame regroupe les événements. Les observateurs et événements sont nettoyés à la sortie et lors d’un changement de préférence d’animation.

Les champs de lumière utilisent uniquement des gradients CSS et des transformations, sans filtre de flou, texture, nouvelle dépendance ou contexte WebGL. Leur opacité et leur position sont alimentées par le même observateur, réversibles et nettoyées avec lui. Les ancêtres des scènes sticky conservent leur géométrie.

## Accessibilité et dégradation

Les contenus sont visibles par défaut, sans opacité masquant les produits. Sans JavaScript, IntersectionObserver ou avec `prefers-reduced-motion`, le parcours reste statique et complet. Les titres, liens et boutons conservent leur ordre HTML. Le focus clavier et les ancres rétablissent la géométrie normale des éléments concernés. Les transformations sont réduites sur petit écran et la projection horizontale est contenue sans modifier les ancêtres des scènes sticky.

## Vérifications

- Types et ESLint ; compilation réelle de la page locale.
- Tests de continuité, limites, réversibilité, stabilité pendant le chapitre Three.js épinglé ; tests existants du parcours et des scènes.
- Contrôle visuel des raccords et des contenus réels dans le navigateur ; largeurs responsive et ancres clavier.
- Contrôles CI : build de production, tests unitaires/PostgreSQL, tests HTTP et audit SEO.

Les contrôles responsive ne constituent pas un test sur téléphone physique (dispense donnée par l’utilisateur).

## Profondeur et lumière

`observeHomeDepth` ajoute une perspective sur les images des familles et des produits mis en avant : légère orientation au pointeur, mouvement vertical au scroll, lumière chaude et sol elliptique. Les cadres, textes et boutons restent stables. Le Hero, les familles, les origines et la communauté disposent aussi d’un léger décalage du paysage ; les brumes du Hero forment un plan distinct.

La scène Three.js reçoit une surface de reflet indépendante de l’illustration imprimée. Son balayage suit le scroll et son orientation suit le pointeur, avec amortissement et arrêt du rendu une fois la position atteinte. Aucun nouvel asset, bibliothèque ou contexte WebGL. Les pointeurs tactiles ne déclenchent pas l’inclinaison, les petits écrans utilisent une amplitude réduite et le mode de mouvement réduit retire l’observateur et ses styles.

Vérifications supplémentaires : bornage des coordonnées, regroupement des événements, absence de boucle au repos, éléments hors champ ignorés, toucher ignoré, bascule dynamique de mouvement réduit et nettoyage complet. Rendu Chromium avec shader compilé sans erreur ; responsive 390 et 320 px sans débordement horizontal ; contrôle visuel Safari et Firefox.
