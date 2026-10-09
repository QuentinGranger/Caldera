# Mise en scène Caldera

## Analyse préalable

L’accueil rend déjà côté serveur le Hero, les familles disponibles, la sélection
produit, les cinq territoires, les extensions, les nouveautés/réassorts, les
garanties, le journal et la newsletter. Les sections commerciales vides sont
omises et les produits sont dédupliqués. Ces règles restent la source de vérité.

Le routing Next utilise de vrais liens préchargés et un moteur de transitions
centralisé. Les images produit ont déjà une identité partagée, activée uniquement
pour la carte sélectionnée. Le voile décoratif fonctionne sans capture native.
Les anciennes durées de 1 600–1 900 ms dépassent le nouveau brief.

Les animations d’accueil sont surtout des reveals identiques et des mouvements
ambiants continus. Les timelines CSS n’offrent pas la même présentation dans tous
les moteurs. Le header adapte déjà sa matière au scroll ; ses contrôles doivent
rester stables. Les filtres, ancres, paniers et formulaires n’ont pas besoin d’une
transition cinématique. Les images existantes et leurs cadrages sont conservés.

## Direction retenue

1. Paysage plein écran, boutique Pokémon immédiatement identifiable et CTA.
2. Sur grand écran, courte séquence sticky : le paysage se rapproche et le titre
   cède la place à collectionner, jouer, découvrir et transmettre.
3. Les familles Pokémon suivent directement le Hero pour orienter les visiteurs.
4. Nouveautés et réassorts, sélection de l’équipe, puis extensions présentent
   l’offre avant tout long passage éditorial. La sélection conserve ses références
   réservées ; les nouveautés et réassorts les complètent sans doublon.
5. Garanties de commande et guides répondent ensuite aux questions d’achat.
6. Les cinq territoires, puis les origines construisent l’univers de marque après
   les produits. Leur scène sombre rejoint la newsletter et le footer.

Le parcours commercial utilise un fond papier continu, avec une variation douce
pour la sélection. La transition vers la nuit précède désormais les territoires,
qui ne séparent plus les familles des produits. Les sections vides restent omises.

Les seules scènes animées utilisent transform et opacity. Un contrôleur léger
mesure uniquement les scènes proches du viewport, groupe les lectures avant les
écritures et ne provoque aucun rendu React au scroll. Aucune dépendance ajoutée.
Le scroll natif n’est jamais intercepté. Les images non critiques restent lazy.

Sur mobile ou fenêtre basse, lecture verticale et séquences raccourcies, sans
longue immobilisation sticky. Sans JavaScript, sans IntersectionObserver ou avec
prefers-reduced-motion, tous les textes et liens restent présents et lisibles en
flux normal. Le changement de préférence en cours de visite est pris en compte.

## Signature de navigation

Réaction immédiate au départ, voile minéral montant, puis révélation de la
destination. Animation bornée à 900 ms, plus courte sur mobile ; aucun délai
artificiel avant le routing ni contrôle désactivé. Le masque ne reçoit aucun
événement. Les produits gardent leur morph facultatif ; l’historique natif garde
sa restauration du scroll sans seconde animation. Les navigations rapides
remplacent la présentation précédente ; un garde-fou libère tout voile abandonné.

## Vérifications

- TypeScript, ESLint et les 14 tests ciblés passent : progression bornée,
  fondu entre deux paysages voisins, calculs regroupés par frame, scènes hors
  écran ignorées, nettoyage et changement de préférence reduced-motion.
- Le test de navigation vérifie le départ immédiat, les clics consécutifs,
  l'historique, les filtres et un budget partagé de 900 ms entre départ/arrivée.
  Une destination trop lente arrive directement une fois ce budget écoulé.
- Contrôles visuels locaux dans Chromium, Safari et Firefox ; Hero au scroll,
  territoires, chapitre des origines et continuité avec la newsletter.
- Viewports 390 × 844, 844 × 390 et desktop : pas de débordement horizontal,
  menu mobile fonctionnel, scènes sticky désactivées sur fenêtres étroites/basses.
- Aucun appareil physique testé (dispense donnée par l'utilisateur). Ces
  contrôles ne constituent pas une mesure de 60 FPS ni des Core Web Vitals réels.
  Les fixtures locales de démonstration ne modifient pas les données de production.
