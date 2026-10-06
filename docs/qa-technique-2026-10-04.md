# QA technique des nouvelles pages — 4 octobre 2026

## Périmètre et méthode

Build de production Next.js 16.3.5 servi sur `http://localhost:3100`. La route de jeu `/pokemon` a été vérifiée sur `http://localhost:3101` avec une base de QA isolée, créée à partir des 20 migrations et du seed de développement. La base locale existante a un historique de migrations divergent et n’a pas été modifiée. Lighthouse 13.5.0 / Chrome 154, profil mobile en priorité puis desktop, catégories Performance / Accessibility / Best Practices / SEO. Les rapports JSON complets sont dans `/tmp/caldera-qa-2026-10-04/` sur ce Mac. Chaque ligne ci-dessous correspond au dernier audit enregistré ; les mesures de laboratoire varient selon la charge locale.

| Page | Mobile P/A/BP/SEO | LCP mobile | Desktop P/A/BP/SEO | LCP desktop |
| --- | ---: | ---: | ---: | ---: |
| Accueil `/` | 84/100/100/69 | 4,5 s | 99/100/100/69 | 1,0 s |
| Catalogue `/catalogue` | 87/100/100/69 | 4,1 s | 100/100/100/69 | 0,6 s |
| Catégorie `/categorie/accessoires` | 86/100/100/69 | 4,1 s | 92/100/100/69 | 1,9 s |
| Catégorie `/categorie/pokemon` | 87/100/100/69 | 3,9 s | 100/100/100/69 | 0,8 s |
| Extensions `/extensions` | 91/100/100/69 | 3,5 s | 100/100/100/69 | 0,7 s |
| Fiche extension `/extensions/dev-aurores-sauvages` | 89/100/100/69 | 3,7 s | 100/100/100/69 | 0,8 s |
| Calendrier `/calendrier-des-sorties` | 91/100/100/69 | 3,4 s | 100/100/100/69 | 0,5 s |
| Fiche produit `/produit/dev-carte-illustration` | 90/100/100/69 | 3,6 s | 100/100/100/69 | 0,8 s |
| Panier `/panier` | 92/100/100/66 | 3,4 s | 100/100/100/66 | 0,5 s |
| Hero immersif `/univers` | 95/100/100/69 | 2,9 s | 100/100/100/69 | 0,7 s |
| Hero immersif `/univers/territoires` | 87/100/100/69 | 4,0 s | 99/100/100/69 | 0,9 s |
| Arche dorée `/pokemon` (base QA) | 85/100/100/69 | 4,3 s | 71/100/100/69* | 1,0 s |

CLS mesuré à **0** sur les 22 audits initiaux et sur l’arche mobile ; l’arche desktop mesure 0,002. TBT mobile final de 30 à 70 ms. Le Hero de l’accueil est servi en AVIF d’environ 28 Ko dans le profil Lighthouse mobile, avec priorité réseau élevée. Les LCP mobiles simulés restent au-dessus de 2,5 s ; une mesure avec limitation réseau réelle de Chrome a donné **2,8 s** pour l’accueil, contre 4,5 s dans le modèle Lighthouse. Une mesure sur le site public et des appareils physiques reste nécessaire pour établir l’impact utilisateur. Une première mesure des territoires à 10,6 s provenait d’un TTFB local de 1,8 s ; la mesure à chaud a donné 4,0 s avec TTFB de 30 ms.

*La première mesure desktop de l’arche a eu un TBT de 470 ms et un Speed Index de 3,2 s. Deux répétitions ont échoué avec une fermeture de la session Chrome par l’outil Lighthouse ; ce score de performance n’est pas considéré comme stable. LCP, accessibilité, bonnes pratiques et CLS sont enregistrés dans le rapport JSON.*

Les scores SEO locaux de 69, et 66 pour le panier, ne signalent pas une erreur de métadonnées : `robots.txt` interdit volontairement l’indexation des hôtes hors domaine public. Le panier porte volontairement `noindex`. Les métadonnées et URL canoniques ont été inspectées. Le crawl du domaine public n’a pas été audité ici.

## Anomalies corrigées

- Catalogue : l’animation d’entrée réduisait le contraste des textes pendant le scroll. L’opacité reste maintenant pleine ; accessibilité mobile **93 → 100**.
- Pagination : noms accessibles explicites pour les liens précédent/suivant lorsque leur texte est masqué sur mobile.
- Pages Univers et Territoires : deux libellés dorés sur fond parchemin avaient un contraste insuffisant. Couleur foncée appliquée ; accessibilité **100** aux deux tailles.
- Favoris produit : le nom accessible du bouton commence désormais par son libellé visible ; audit produit à **100**.
- Images d’accueil : valeurs `sizes` ajustées aux espaces réellement occupés ; l’image Hero est chargée immédiatement avec `fetchPriority="high"`.
- Script Vercel Speed Insights : rendu uniquement sous Vercel, ce qui retire la requête locale 404 et les erreurs console ; Best Practices **100**.
- Fallback de `:has()` : le premier paysage des territoires et son libellé restent visibles si le sélecteur n’est pas compris ; le header du menu mobile reste opaque sans `backdrop-filter`.
- Animation du header : désactivée sous `prefers-reduced-motion: reduce`. Les autres parallaxes sont déjà conditionnés à `prefers-reduced-motion: no-preference` et au support des scroll timelines. Les textes, CTA, images et fonds restent présents sans ces effets.
- Panier Safari en build local : un cookie `Secure` sur HTTP empêchait sa persistance. L’exception est bornée aux hôtes de prévisualisation locaux ou privés ; le domaine public conserve `Secure`. Ajout, quantité 1 → 2 et navigation vers la page panier ont été vérifiés sur Safari desktop après correction.
- Le test HTTP du panier attend maintenant un cookie utilisable sur `localhost` ; ses **8 cas passent** sur la base de QA isolée, dont quantité, persistance, stock et protection Origin.

## Compatibilité et interactions

- **Chrome 154** : Lighthouse mobile et desktop sur les 12 routes ci-dessus, dont l’arche dorée sur la base de QA isolée.
- **Safari 26.5 desktop** : chargement des nouvelles routes, inspection visuelle des Heroes, de l’arche dorée, des overlays, de la typographie, des images, du filtre et du header sticky ; parcours panier complet après correction.
- **Firefox 153.0.3 desktop** : chargement des nouvelles routes ; inspection visuelle du catalogue, de l’Univers et de l’arche dorée ; filtre « En stock », ajout et suppression d’un article, navigation panier.
- **Safari iOS 26.5 en simulateur iPhone 17e** : accueil, menu, catalogue, filtre, cartes, panier et orientations portrait/paysage inspectés. L’ajout au panier a révélé le défaut de cookie corrigé. Après redémarrage du build, l’outil de contrôle du simulateur n’acceptait plus les clics à coordonnées : la répétition du parcours tactile sur cette version finale n’a pas abouti. Safari desktop a confirmé la correction fonctionnelle dans WebKit.

## Points encore non validés

- **Téléphones physiques** : l’iPhone 12 détecté par Xcode reste `unavailable`; aucun Android n’est connecté. Aucun test sur appareil réel ne peut être attesté.
- **Edge** : navigateur absent de ce Mac.
- **LCP mobile public** : les mesures locales simulées sont au-dessus du seuil de 2,5 s. Les transferts des Heroes et le temps bloquant JavaScript sont faibles dans ces rapports ; l’observation sur le domaine public avec données terrain reste à faire.

Validation du code : `npm run build`, `npm run lint`, `npm run typecheck`, `git diff --check`, six cas de décision du drapeau `Secure` et huit tests HTTP du panier réussis. Les données de démonstration utilisées pour le panier ont été retirées de Safari et Firefox. La catégorie orpheline créée pendant le premier essai sur la base locale divergente a été supprimée.
