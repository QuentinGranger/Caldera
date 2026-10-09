# Accueil : chapitre 3D Caldera

## Séquence

Entre les familles et les produits sélectionnés, `#experience` présente une **illustration décorative de l’univers Caldera**, sans prix ni promesse de produit. Une géométrie Three.js avec tranche dorée biseautée et deux faces parcourt quatre poses continues : recto, rapprochement, verso, éventail. Le scroll natif est la seule horloge ; le retour en arrière fonctionne aussi. Le lien « Voir la sélection » passe directement aux vrais produits.

## Chargement et repli

- HTML, textes, illustration et lien rendus par le serveur.
- Hauteur réservée à l’hydratation pour les écrans compatibles ; moteur importé uniquement à moins de 700 px du chapitre.
- Rendu à la demande, interrompu hors écran et dans un onglet masqué. DPR plafonné à 1,6, ressources partagées entre les trois cartes.
- Textures, géométries, matériaux, environnement, renderer et observateurs libérés au démontage ; chargement tardif annulé avant allocation GPU.
- `prefers-reduced-motion`, écran inférieur à 360 px ou moins de 600 px de haut, absence d’observateurs, WebGL indisponible ou perte de contexte : illustration statique et trois textes en flux normal. Aucun CTA dépend du canvas.
- Pas de bibliothèque d’animation, de modèle distant, de tracking ni de nouvelle API serveur.

## Illustration

Outil : `image_gen.imagegen`, génération originale, fond opaque. Source conservée hors dépôt dans le dossier d’images générées Codex ; copie optimisée utilisée par le site : `public/assets/images/experience/caldera-card-front.webp` (640 × 960, WebP qualité 78, environ 190 Ko). Le verso utilise le logo existant.

Prompt final :

> Use case: stylized-concept. Create one production-ready portrait illustration, aspect ratio 2:3, to be printed on the face of a premium fictional Caldera collectible card in a real-time 3D website scene. Full bleed flat artwork ONLY, viewed perfectly straight on: no card mockup, no perspective, no outer frame, no text, no lettering, no logos, no game symbols. Subject: a majestic dormant volcanic caldera rising above ancient dark evergreen forests, a winding luminous gold river crossing layered basalt ridges toward the foreground, atmospheric mist and a small radiant compass-like star in the sky. Style: exquisite fine engraved fantasy landscape, embossed gold foil details and dark emerald mineral surfaces, sophisticated collector object aesthetic with tangible etched texture, clean deliberate composition with a powerful central silhouette. Palette: very dark emerald #03140e and #003c2d, warm metallic gold #e8c261, subdued amber lava glow only at the distant summit, ivory highlights. Lighting: cinematic raking light, luminous fine gold lines and delicate contour patterns, rich contrast, readable landscape. Fill the rectangular portrait canvas edge to edge. Avoid characters, animals, real-world brands, Pokémon imagery, readable writing, UI, rounded corners, floating object, product photo, border, busy microdetail.

## Vérifications

Tests de géométrie du scroll, poses continues et réversibles, orientation recto/verso, zoom, déploiement. Contrôles visuels Chromium (1280 × 720, 390 × 844, 320 × 740), Safari et Firefox desktop. Le redimensionnement aller-retour entre les versions 3D et statique est également contrôlé. Les téléphones physiques n’ont pas été testés, conformément à la demande. Types, lint et CI complète du dépôt complètent ces contrôles.
