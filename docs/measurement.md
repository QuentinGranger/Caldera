# Mesure e-commerce Caldera

## Services réels

- GA4 : propriété 558382032, flux web 16106085269, identifiant public G-RRTGBQ5CP1.
- Search Console : propriété de domaine `sc-domain:lesterresdecaldera.fr`, déjà vérifiée. Sitemap déclaré et lu avec succès.
- Stripe : paiements et remboursements confirmés par les webhooks existants ; les tableaux ne simulent ni chiffre d’affaires ni solde bancaire.
- Administration : `/admin/mesures` (acquisition, conversion, produits, emails) et `/admin/pilotage` (coûts, marge, charges, stock, trésorerie).

## Configuration

`NEXT_PUBLIC_GA4_MEASUREMENT_ID` configure le flux public, `MEASUREMENT_ENABLED=true` active la mesure interne après application de la migration `20261011150000_add_measurement`. La signature utilise le secret d’authentification existant avec séparation de domaine HMAC ; aucune nouvelle clé publique ne permet d’attribuer une commande.

## Consentement et sécurité

Aucun script GA4 ni cookie de mesure avant accord. Accepter et Refuser sont accessibles au même niveau. Le choix expire après 180 jours. Le retrait désactive la collecte, efface les cookies Google et la session interne courante. La session interne utilise un cookie signé HttpOnly/SameSite=Lax/Secure en production, renouvelé après 30 minutes d’activité. Dans GA4, données utilisateur et événements sont conservés deux mois, sans prolongation automatique à chaque activité. Les sessions et attributions internes sont supprimées après 90 jours par la maintenance existante.

Les espaces privés, liens de commande et paiement, recherches et fragments sont exclus des pages vues. Les UTM autorisés sont publics et ne contiennent pas d’identifiant de destinataire. Les mesures automatiques enrichies GA4 sont désactivées ; publicités et Google Signals sont désactivés dans la configuration du tag. Le serveur refuse les origines étrangères, les payloads invalides et impose une limite distincte des limites d’authentification.

## Lecture des chiffres

- Encaissements : TTC, livraison incluse, paiement réussi. Remboursements présentés séparément.
- Panier moyen : montant payé avant remboursements / commandes payées.
- Réachat : une précédente commande payée avec la même adresse email normalisée.
- Produits : quantités nettes de retours, recettes HT et coût historique lorsqu’il existe. Les coûts absents ne deviennent pas une marge fictive.
- Checkout abandonné : session d’au moins 24 heures sans commande payée ; une reprise tardive peut modifier ce taux.
- Acquisition : session consentie qui a préparé la commande, premier canal de cette session. Les commandes attribuées sont comptées depuis les paiements serveur, même sans retour sur la confirmation.
- Conversion : commandes de cette cohorte attribuées / visiteurs consentants distincts. Les visiteurs bloquant/refusant la mesure ne sont pas extrapolés.
- Les étapes internes sont des présences d’actions par session, pas une preuve de séquence stricte. GA4 reçoit les événements e-commerce pour construire une exploration d’entonnoir.
- Newsletter et scénarios automatiques : UTM de campagne ; Discord : UTM par type de publication. Aucun identifiant personnel dans ces liens.

## Limites à activer dans le compte fournisseur

La clé Resend existante est limitée à l’envoi (`restricted_api_key` lors de la lecture des métriques). Les taux d’ouverture et de clic bruts ne sont donc pas disponibles. Ne pas les présenter comme zéro. Leur activation nécessite l’accès au compte Resend, un choix de suivi adapté au consentement et une configuration qui ne réécrive pas les liens d’authentification des emails transactionnels. Les visites et revenus attribués aux campagnes restent disponibles après consentement sur le site.

GA4 commence à mesurer à son activation : aucun historique n’est reconstitué. Les achats GA4 dépendent du retour sur la confirmation ; la mesure interne et les totaux financiers serveur compensent cette limite sans envoyer de données personnelles à Google.

## Vérifications

Tests unitaires `tests/measurement.test.ts`, tests HTTP locaux `tests/measurement-http.test.ts` avec `MEASUREMENT_TEST_ORIGIN`, et contrôle des accès `/admin/mesures` dans les tests admin HTTP. Tests de rendu et sécurité des emails/campagnes et tests Discord existants. Migration testée sur PostgreSQL local avant Neon production.
