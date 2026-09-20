# Visuels et polices — phase 2

Visuels temporaires, conservés localement pour éviter les liens distants au runtime. Les noms, prix et badges du storefront sont des exemples indépendants des données des sites sources.

| Fichier                                       | Source                                                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `public/assets/images/products/prismatic.png` | [Visuel coffret, Kairyu](https://kairyu.fr/products/scelle-elite-trainer-box-ev08-5-evolutions-prismatiques-fr) |
| `public/assets/images/products/sparks.png`    | [Visuel coffret, Snooop](https://snooop.gg/products/etb-pokemon-ecarlate-et-violet-etincelles-deferlantes-ev08) |
| `public/assets/images/products/charizard.png` | [Image carte, Pokémon TCG API](https://images.pokemontcg.io/sv3pt5/199_hires.png)                               |
| `public/assets/images/products/pikachu-v.png` | [Image carte, Pokémon TCG API](https://images.pokemontcg.io/swsh11tg/TG16_hires.png)                            |
| `public/assets/images/products/sleeves.png`   | [Visuel fabricant Dragon Shield](https://www.dragonshield.com/products/emerald-matte-sleeves)                   |

Les images produit et paysages constituent la matière temporaire de la maquette ; les remplacer par les visuels définitifs de la boutique avant sa publication commerciale. Aucune illustration IA n’a été générée. Les logos fournis sont conservés sans déformation ni modification.

Polices variables WOFF2 Latin : [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) et [Manrope](https://fonts.google.com/specimen/Manrope), distribuées par Fontsource et issues du dépôt Google Fonts. Fichiers et licences SIL Open Font License présents dans `src/app/fonts/`. Chargement local par `next/font/local`, sans appel à Google lors du build ou de la navigation.

## Visuels fournis par le propriétaire

- `HeroBanner.png` → `public/assets/images/editorial/hero-banner.png` : bannière du hero.
- `LogoHeaderNoBG.png` → `public/assets/brand/logo-header-no-bg.png` : logo transparent du header et du footer, dimensions natives 1774 × 887.
- `foret.png` → `public/assets/images/editorial/foret.png` : visuel de la section « Au-delà de la collection ».

Les fichiers sont copiés sans modification ; Next.js optimise leur affichage. Les anciennes photographies restent disponibles dans les assets mais ne sont plus affichées.

## Visuels de remplacement produits

- `Accecories.png` → `public/assets/products/placeholder-accessories.png` : accessoires.
- `Sealed.png` → `public/assets/products/placeholder-sealed.png` : produits scellés et autres types.
- `Carte.png` → `public/assets/products/placeholder-card.png` : cartes à l’unité.

Fichiers fournis par le propriétaire, copiés sans modification. La règle centralisée dans `src/lib/catalog/images.ts` conserve les vrais visuels et remplace les images absentes, vides ou l’ancien placeholder générique. Elle s’applique au catalogue, à la homepage, aux fiches et aux collections. Le seed utilise les nouveaux fichiers pour les prochaines créations.

Les quatre territoires retrouvent les illustrations locales de la phase 2 : Pokémon / Dracaufeu, Scellés / coffret Évolutions Prismatiques, Cartes / Pikachu V, Accessoires / Dragon Shield. Une image spécifique renseignée en base reste prioritaire.
