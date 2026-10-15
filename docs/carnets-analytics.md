# Mesurer les Carnets

## Accès et lecture des résultats

Carnets → « Mesures de lecture », ou édition → même action. Route protégée par l’authentification admin et MFA : `/admin/carnets/[id]/analytics`.

Fenêtre mobile de 90 jours. Les tableaux complètent les indicateurs de newsletter existants ; ils ne modifient ni l’envoi, ni les produits, ni les commandes.

- **Lecteur** : identifiant anonyme de navigateur ayant passé au moins 10 secondes visibles sur le récit. Déduplication entre sessions du même navigateur. Aucun rapprochement avec le compte client ou l’abonné email.
- **Fin estimée** (`carnet_complete`) : au moins 30 secondes de présence et marqueur de fin visible. Au serveur : lecture préalable depuis au moins 20 secondes. Ce n’est pas une preuve de compréhension.
- **CTA récit** : clic email `continuer_expedition` (clé interne historique `story_continue`), distinct du clic unique global de la livraison.
- **Comptoir** : `comptoir_produit_1`, `comptoir_produit_2`, `comptoir_produit_3`, selon les références figées dans la campagne. Image et bouton partagent la même clé. Une observation par livraison/lien ; regroupement admin par produit, même s’il change de position entre campagnes. Les noms/types affichés viennent de Product ; un produit supprimé reste une référence historique sans recopier de catalogue.
- **Produit après lecture** (`product_view_after_carnet`, dérivé côté serveur) : une fiche produit active, non démonstrative, avec variante active, ouverte dans les 24 heures suivant la lecture la plus récente du même navigateur. Une seule attribution, au dernier Carnet consulté. Ce compteur est un nombre de lecteurs ayant consulté au moins un produit, et non un volume de pages vues ou de ventes. Les réservations/ruptures n’empêchent pas de mesurer une consultation de fiche visible.
- **Rétention** : cohorte des lecteurs du Carnet de départ dans les 90 derniers jours. Pour chaque épisode de numéro supérieur non archivé : nombre d’identifiants de la cohorte ayant une lecture ultérieure à leur première lecture du Carnet de départ, divisé par la taille de la cohorte. Exemple : #01 → #06, et non #05 → #06. Sans cohorte ou pour un épisode encore indisponible : « — ». Les avant-premières sont signalées comme observations partielles.

Les résultats ne sont pas rétroactifs. Un ancien email sans identifiant de contenu conserve son clic global, sans attribution par lien inventée. Les cohortes récentes ont une durée d’observation plus courte. Les robots de sécurité email peuvent cliquer : un clic n’est jamais transformé en lecture. Le nombre de clics par lien ne s’additionne pas en nombre de personnes uniques. Ces statistiques décrivent des comportements, sans établir une causalité entre récit et achats.

## Consentement et minimisation

Site : `analyticsAllowed()`, choix existant Accepter/Refuser, aucune observation avant accord. `carnet_view` et `carnet_complete` exigent une session de mesure signée déjà établie. Origine, payload et limite de débit de `/api/measurement` restent vérifiés. Le serveur revérifie l’accès public ou le lien d’avant-première avant toute observation. Le jeton d’accès sert uniquement à cette vérification ; il n’est pas enregistré dans les mesures, ni envoyé à GA4.

Email : webhook Resend signé, `trackingEnabled`, consentement courant et date de consentement compatible avec celle de l’envoi. Un renouvellement d’accord ne réactive pas les anciens envois. La clé UTM de campagne est publique, sans identifiant de destinataire. Pas de redirection de suivi supplémentaire ni de fusion email/navigateur.

Le payload officiel `email.clicked` fournit `data.click.link` ([schéma Resend](https://github.com/resend/resend-openapi/blob/main/resend.yaml)). Seul son chemin/identifiant de contenu est validé contre les références de la campagne ; URL brute, adresse IP et user-agent ne sont ni enregistrés ni journalisés dans ces tables.

Retrait site : suppression de toutes les sessions du même identifiant de navigateur et des lectures associées en cascade, y compris si le cookie de session a expiré. Retrait email : effacement des clics Carnets via `clearSubscriberEngagement`. Purges de maintenance existantes : sessions et observations email au-delà de 90 jours. Les commandes restent indépendantes.

## Données et déploiement

Migration additive `20261015090000_carnet_reading_analytics` à appliquer **avant** le déploiement :

- `CarnetReading` : chapitre/session, première présence, fin estimée facultative, première consultation produit attribuée facultative. Clé unique session/chapitre, index chapitre/date et date. Suppression en cascade depuis chapitre/session.
- `CarnetEmailClick` : livraison, clé de lien, référence produit facultative, première date. Clé unique livraison/lien ; suppression en cascade depuis livraison. Contraintes SQL sur les quatre clés et sur la chronologie/fenêtre 24 h.

Aucune nouvelle variable d’environnement ni aucun nouveau secret. Les drapeaux `MEASUREMENT_ENABLED`, `EMAIL_ENGAGEMENT_ENABLED`, `trackingEnabled` et les règles existantes s’appliquent. Vérifier les clics avec un futur email réellement envoyé à un destinataire consentant ; les tests automatiques utilisent des fixtures locales et des événements simulés, sans email de production.

## Tests

`tests/carnets-analytics.test.ts` : liens, jeton préservé, HTML/texte, newsletter générique.

`tests/carnets-analytics-db.test.ts` : accès privé/avant-première/public, déduplication, présence avant complétion, cohorte chronologique, multi-session, last touch et borne 24 h, variant valide, liens distincts après clic global, retrait, renouvellement, purge et absence de données privées.

`tests/carnets-analytics-http.test.ts` : consentement, cookie signé, origine et retrait de toutes les sessions, refus des événements tardifs après retrait. Complété par les tests existants measurement, email-engagement, Carnets/campagnes/release et contrôles visuels desktop/mobile sur fixtures locales.

## Paramètres marketing automatiques

`carnetLink` dans `src/lib/carnets/analytics-links.ts` centralise la génération pour les aperçus Carnet/Studio, tests et envois HTML/texte. Aucun champ UTM à renseigner.

| Paramètre      | Valeur dérivée                                                                       |
| -------------- | ------------------------------------------------------------------------------------ |
| `utm_source`   | `newsletter`                                                                         |
| `utm_medium`   | `email`                                                                              |
| `utm_campaign` | `carnet_` + numéro réel, au moins trois chiffres (`carnet_001`)                      |
| `utm_content`  | `continuer_expedition` ou `comptoir_produit_1/2/3` selon l’ordre du Comptoir figé    |
| `utm_id`       | `campaign_` + UUID public de la campagne enregistrée, jamais un identifiant d’abonné |

Sans campagne enregistrée, l’aperçu n’invente pas d’UUID : `utm_id` est absent. Plusieurs campagnes d’un même Carnet partagent le libellé lisible, mais `utm_id` les distingue. GA4 conserve ce libellé ; les mesures internes utilisent l’identifiant stable d’envoi pour maintenir l’attribution des sessions/achats/CA dans `/admin/mesures`. Le consentement site reste obligatoire pour cette attribution.

Le worker transmet la décision de suivi au rendu : avec `trackingEnabled=false`, aucun UTM n’est ajouté aux liens Carnet/Comptoir. Les aperçus et tests affichent le format marketing via le même helper, sans activer le suivi fournisseur. La génération ne crée aucun nouvel accès ni consentement.

Les paramètres UTM existants, y compris doublons et variantes de casse, sont remplacés sur les liens internes du Carnet. Les paramètres fonctionnels (accès anticipé signé, variante) et fragments sont conservés. Les autres destinations internes (confidentialité, compte…) ne reçoivent pas de tags Carnet ; les domaines externes restent inchangés. Les URL canoniques, le sitemap et les références produit enregistrées restent sans tracking.

Les emails déjà figés/envoyés gardent leurs liens : leur `campaign_UUID` et les anciennes clés anglaises restent reconnus, puis sont normalisés vers les mêmes compteurs en base. Aucune migration ni perte d’historique.
