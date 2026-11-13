# Google Tag Manager — déploiement

Le conteneur Web est `GTM-W2T9CD27` (compte 6404904546, conteneur 286777994).
Le code utilise `NEXT_PUBLIC_GTM_CONTAINER_ID`. Tant que cette variable
n'est pas définie, l'intégration directe GA4 existante reste active. Ne définir la
variable en production qu'une fois le conteneur publié et vérifié.

## Conteneur

- Compte : Les Terres de Caldera, France.
- Conteneur Web : lesterresdecaldera.fr.
- Flux Analytics existant : G-RRTGBQ5CP1 (propriété 558382032).
- Partage anonyme facultatif désactivé.
- Version 2 « Caldera — GA4 avec consentement », publiée le 13 novembre 2026.
- `docs/gtm-container.json` contient les deux balises natives, le déclencheur et
  les dix variables. Les événements automatiques et toutes les options de
  collecte de données fournies par les utilisateurs y sont désactivés.

## Configuration native à publier

1. Balise Google pour G-RRTGBQ5CP1, déclenchement Initialisation — Toutes les pages.
   Configurer `send_page_view=false`, `cookie_expires=15552000`,
   `cookie_update=false`, `allow_google_signals=false`,
   `allow_ad_personalization_signals=false`, `page_location=https://lesterresdecaldera.fr/`,
   `page_title=Caldera`, `page_referrer` vide. Pas de déclencheur Historique ni de
   balise de page vue automatique : le routeur du site émet les pages vues.
2. Déclencheur Événement personnalisé : `caldera_measurement`.
3. Variables de couche de données v2 : `caldera_event_name`, puis
   `caldera_parameters.page_location`, `.page_title`, `.page_referrer`, `.items`,
   `.currency`, `.value`, `.transaction_id`, `.shipping`, `.tax`.
4. Balise Événement GA4 : flux G-RRTGBQ5CP1, nom provenant de `caldera_event_name`,
   paramètres ci-dessus depuis les variables correspondantes. Déclencher sur
   `caldera_measurement`. Exiger également `analytics_storage`.
5. Utiliser les modèles Google natifs, sans HTML personnalisé, variable JavaScript
   personnalisée, balise publicitaire ni suivi automatique de formulaire.

## Consentement et sécurité

Consent Mode v2 basique : aucun téléchargement GTM ou GA4 avant accord. Après
accord, les consentements publicitaires restent refusés. Un seul chargeur est
inséré ; GTM remplace le chargeur GA4 direct. Le retrait désactive GA4, envoie un
état refusé, arrête les événements applicatifs et conserve la suppression des
cookies existante. Une nouvelle acceptation ne recharge pas GTM.

Le nonce CSP est conservé. Aucun iframe `noscript` n'est injecté : il ne pourrait
pas recueillir le consentement nécessaire. Les événements nettoient l'ancien
payload avant chaque envoi pour ne pas reporter des articles ou commandes sur la
page suivante. Les URLs privées, recherches et jetons restent filtrés par le site.

## Validation avant activation

- `tests/google-measurement.test.ts` et `tests/measurement.test.ts`.
- Compilation production et ESLint des fichiers modifiés.
- Prévisualisation du conteneur publié : pas de requête avant accord/refus ; un
  `page_view` par navigation ; événements produit/panier sans doublons ; arrêt
  après retrait et reprise sans réinitialisation.
- Contrôle GA4 Temps réel après accord sur une page publique, sans achat fictif.

Contrôle du 13 novembre 2026 : huit tests réussis, build production réussi,
aucun chargeur Google avant accord ou après refus initial, un seul chargeur GTM
après acceptation et après retrait/réacceptation. Tag Assistant confirme les deux
balises déclenchées une fois et un hit de page vue vers G-RRTGBQ5CP1 sur la page
de test. Navigation catalogue/produit sans erreur de console.

Références : [Consentement basique](https://developers.google.com/tag-platform/security/guides/consent?consentmode=basic),
[couche de données](https://developers.google.com/tag-platform/tag-manager/datalayer),
[nonce CSP](https://developers.google.com/tag-platform/security/guides/csp).
