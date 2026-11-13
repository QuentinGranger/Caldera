# Caldera — référencement et mesure

## Chaîne de mesure

- GTM `GTM-W2T9CD27` déploie les deux balises natives GA4 après consentement.
- GA4 `G-RRTGBQ5CP1`, propriété `558382032`, flux Web `16106085269`.
- Search Console `sc-domain:lesterresdecaldera.fr`, associé au flux Web le
  13 novembre 2026. Les rapports Search Console sont visibles dans GA4.
- L'administration `/admin/mesures` donne accès au rapport commun par page
  d'entrée, aux requêtes, aux sitemaps et au conteneur GTM.

## Rapports utiles

- [Trafic naturel Google](https://analytics.google.com/analytics/web/#/a411500978p558382032/reports/explorer?params=_u..nav%3Dmaui&ruid=search-traffic,search-console,search-console-topic&collectionId=search-console&r=search-traffic) : pages d'entrée,
  clics, impressions, CTR, position, engagement et événements clés.
- [Requêtes Google](https://analytics.google.com/analytics/web/#/a411500978p558382032/reports/explorer?params=_u..nav%3Dmaui&ruid=search-query,search-console,search-console-topic&collectionId=search-console&r=search-query) : requêtes et visibilité.
- [Indexation et sitemap](https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Alesterresdecaldera.fr) : découverte et exploration.

Le rapprochement se fait par page d'entrée, pays et appareil. Search Console
compte les clics Google ; Analytics mesure les visites consenties. Les fenêtres
de traitement et les définitions diffèrent. Les données Search Console peuvent
mettre environ 48 heures à apparaître dans Analytics.

## Indexation en mode démonstration

La règle commune `src/lib/seo/demo.ts` conserve l'accueil, les guides, le
glossaire, les questions, l'univers et les pages publiques de la marque.
Chaque page conserve sa propre décision de publication : un Carnet privé ou
un index vide peut rester en `noindex`.

Les produits d'exemple, catégories et listes commerciales restent exclus de
l'indexation et des sitemaps. Les chemins de compte, commande et newsletter
restent privés/non indexables. Les domaines de prévisualisation renvoient aussi
`noindex`. Le domaine canonique reste `https://lesterresdecaldera.fr`.

Le sitemap référence uniquement les pages proposées à l'indexation. Il ne publie
aucune date de modification inventée. À l'ouverture du vrai catalogue, le retrait
de `CATALOG_DEMO_MODE=1` rétablit les décisions de stock/visibilité existantes.

## Attribution des visites et événements

Les pages vues et les événements e-commerce transmettent l'URL publique réelle,
nettoyée des recherches, fragments et jetons. La première visite conserve
l'origine externe, y compris lorsque `view_item` précède `page_view`. Les
navigations suivantes conservent la page publique précédente comme référent.
Les événements suivants d'une même page réutilisent ce contexte.

Une mise à jour `update=true`, avec `send_page_view=false`, maintient aussi le
contexte des événements automatiques d'engagement sur la bonne page virtuelle.
Elle ne réinitialise pas GA4 et ne génère pas de page vue supplémentaire.

Les confirmations de commande utilisent une URL publique neutre. Aucun chemin
privé, lien d'accès personnel, terme de recherche Google ou donnée de formulaire
n'est utilisé comme référent. Le consentement et la suppression des cookies
restent gérés par le composant de mesure existant. GTM demeure le seul chargeur.

## Demandes d’inscription à la lettre

Le formulaire public, accessible depuis les guides et la page de liens, envoie
`generate_lead` via la balise GA4 de GTM lorsqu’il affiche un résultat de succès
et que la mesure d’audience est acceptée. Le payload contient le contexte public
de la page. L’adresse, les préférences et le jeton de confirmation restent dans
le parcours d’inscription. GA4 compte l’événement clé une fois par session,
sans valeur monétaire. Le total des inscriptions confirmées se consulte dans
l’administration Newsletter.

## Contrôles

L’audit compare aussi l’URL du sitemap avec la canonical, l’URL de partage et
celle du contenu principal déclaré en JSON-LD. Les Carnets utilisent leur date
de publication publique et la même date de modification dans les métadonnées,
le JSON-LD et le sitemap.

```sh
node --conditions=react-server --import tsx --test tests/seo-demo.test.ts tests/measurement.test.ts tests/google-measurement.test.ts tests/sitemap.test.ts tests/construction.test.ts tests/construction-security.test.ts
npm run test:seo
npm run build
npm run seo -- --crawl-only --base-url https://lesterresdecaldera.fr --links 10 --json
```

Après publication : contrôler l'accueil et un guide dans l'inspection Search
Console, actualiser le sitemap, puis suivre les impressions et les pages
d'entrée. Une demande d'indexation n'impose pas de délai à Google.

Lecture régulière : rechercher les pages avec impressions mais CTR faible,
améliorer leurs titres et leur réponse à la requête, puis mesurer l'évolution
sur des périodes comparables. L'engagement et les événements clés servent à
vérifier que le trafic obtenu est utile au projet.

Référence : [intégration officielle GA4/Search Console](https://support.google.com/analytics/answer/10737381?hl=fr).
Voir aussi la [configuration Google Analytics pour les applications monopages](https://developers.google.com/analytics/devguides/collection/ga4/reference/config).
