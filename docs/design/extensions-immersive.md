# Atlas des extensions

`/extensions` reprend la forêt, le vert profond, la typographie et l’or des pages Pokémon.

- Hero avec trois photographies de cartes existantes en perspective CSS. Elles sont décoratives et explicitement présentées hors catalogue.
- Navigation par ancres natives : à venir, récentes, déjà sorties. Les compteurs désignent des extensions.
- Trois chapitres chronologiques conservant les données serveur, les dates, les liens canoniques et le composant `SetCard` partagé.
- Les états vides restent explicites ; aucune sortie ou disponibilité n’est ajoutée artificiellement.
- Apparition douce au scroll avec CSS `view()` lorsque disponible ; contenu statique autrement. Les mouvements suivent `prefers-reduced-motion`.
- Le motion observer existant anime seulement le décor et l’éventail. Aucun nouveau moteur de rendu ni dépendance ; aucun scroll intercepté.
- Le chargement utilise la même palette sombre.

## Vérifications

TypeScript, ESLint, compilation Sass. Contrôle Chromium du hero, de la navigation par ancres et de l’ouverture des extensions. Aucun débordement horizontal à 390 et 320 px. Les quatre extensions de développement servent uniquement aux contrôles locaux ; elles restent exclues de la production. CI HTTP et SEO requise avant fusion ; contrôle du rendu public après déploiement.
