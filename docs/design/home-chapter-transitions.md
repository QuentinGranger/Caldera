# Raccords de la home au scroll

## Parcours

Chaque section effectivement affichée reçoit un raccord avec la précédente. Le catalogue vide ou partiel ne crée pas de chapitre vide. L’ordre commercial, les textes, les cartes Pokémon et les destinations des boutons sont conservés.

Le décor passe progressivement de la couleur finale du chapitre précédent à celle du suivant. Des objets en perspective évoquent le chapitre à venir : orbites pour la découverte, éventail de cartes pour les produits et extensions, pages pour les lectures, boussole pour les territoires et la communauté. Un court intertitre et un fil central accompagnent le passage.

## Mouvement

`HomeJourney` est rendu côté serveur. `observeHomeJourney` synchronise rotation, profondeur, déplacement, lumière et apparition avec la géométrie du scroll natif. Le mouvement est réversible et ne dépend pas du temps passé sur la page. Les sections libres entrent avec une légère perspective, puis retrouvent leur taille et leur opacité normales pendant la lecture. Les scènes déjà épinglées (Hero, cartes Three.js, territoires) ne sont pas transformées par ce système.

Les mesures sont lues sur les enveloppes non transformées, avant les écritures CSS. IntersectionObserver limite les calculs aux chapitres proches du viewport ; requestAnimationFrame regroupe les événements. Aucune boucle permanente, nouvelle texture, bibliothèque ni contexte WebGL n’est ajouté. La projection horizontale des sections longues est contenue sans changer les ancêtres sticky.

## Accessibilité et dégradation

Les raccords sont décoratifs (`aria-hidden`, sans interaction). Les contenus et liens restent dans l’ordre HTML. Le focus clavier remet immédiatement le contenu concerné à son état normal. `prefers-reduced-motion` désactive les transformations et réduit les raccords à huit rems ; le changement de préférence est pris en compte sans rechargement. Sans JavaScript ou IntersectionObserver, les sections sont lisibles et les raccords statiques. Les passages sont plus courts sur petit écran.

## Vérification

- Types, ESLint et formatage.
- Tests de continuité, limites, retour en arrière et caméra au repos, plus les tests existants du parcours et des scènes.
- Défilement local Chromium desktop, raccord sombre/clair et scène de cartes.
- Chrome responsive à 390 × 844 et 320 × 740 : largeur de document égale au viewport, sélection accessible au clavier.
- CI : tests unitaires/PostgreSQL, build de production, tests HTTP et audit SEO.

Aucun test sur téléphone physique pour cette modification (dispense donnée par l’utilisateur). Le CSS de réduction des animations constitue un fallback statique ; ne pas confondre les contrôles responsive avec un essai sur appareil physique.
