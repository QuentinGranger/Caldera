# LTC — Détecteur d'anomalies financières

## Pipeline

À **08:20 Europe/Paris**, après le rapport financier (08:00) et le prévisionnel (08:10) :

`Make Data Store (échéances) → POST /api/finance/anomalies → Data Store historique → Discord privé STAFF`

L'API `https://lesterresdecaldera.fr/api/finance/anomalies` est accessible uniquement via la connexion Make HTTP avec le même `FINANCE_REPORT_SECRET` que `/api/finance/daily`. On envoie `{"movements":[...]}` avec les échéances issues du registre **LTC — Prévisions de trésorerie — Échéances**. La requête est limitée à 40 Ko et 250 mouvements.

Aucune donnée client, commande détaillée, clé d'API ou adresse n'est retransmise à Discord. L'API n'écrit ni paiement ni stock ; elle ne publie qu'une analyse.

## Règles

1. **Marge sous le seuil** : comparer la marge brute produits HT de la veille au `minimumMarginRate` déjà défini dans le pilotage LTC. Si le coût historique des produits ou la répartition des remboursements est incomplet, signaler une marge non vérifiable plutôt qu'un faux pourcentage. Aucune alerte sans ventes.
2. **Frais de paiement théoriques excessifs** : uniquement si au moins trois commandes payées, comparer les frais **estimés**, `collected_orders_ttc * paymentFeeRate + paid_orders * paymentFixedFee`, à la somme encaissée. Seuil de vigilance : > max(5 % ; taux configuré + 2 points), et estimation >= 2 €. Aucune lecture des frais Stripe réels (le schéma Payment ne possède pas ce montant) : ce signal est **une estimation**, pas une variation vérifiée des frais du prestataire.
3. **Sortie ponctuelle importante** : au moins 100 € TTC et >= 75 % du budget mensuel de charges. Seules les dépenses `other_expense` au statut `committed` ou `proposed` à échéance J+30 sont contrôlées. Aucun signal sans budget mensuel de référence ; ne pas compter à nouveau les charges déjà comprises dans ce budget.
4. **Trésorerie à risque** : réutiliser la même projection TTC 30/60/90 jours, scénario prudent (engagements + achats envisagés, sans encaissements spéculatifs). Privilégier une alerte critique au premier horizon négatif ; sinon avertir au premier horizon sous la réserve cible. Les calculs reposent sur le **solde manuel** de `/admin/pilotage`, pas un compte bancaire synchronisé. Sans base ou budget, ne pas produire de faux 0 €.
5. **Pas de faux positifs avant lancement** : sans ventes ni solde saisi, statut `NOT_READY`, zéro alerte Discord, mais historique Make conservé avec les limites.

Le signal de marge peut remonter une anomalie sur une seule vente à perte ; les autres seuils sont conservateurs pour réduire le bruit.

## Sécurité et historique

- L'API renvoie `status`, `alert_count`, `critical_count`, `checked_signals`, `data_gaps`, `discord_message`, `as_of`, `sales_day`, `checked_at`.
- Make archive **chaque jour** le résultat, même si aucune alerte n'est émise.
- Le module Discord est filtré par `alert_count > 0`. Il ne publie pas de messages « RAS » ou « sources manquantes » chaque matin.
- Aucune action automatique sur les prix, commandes fournisseurs, banque, paiements ni remboursements.
- La configuration et les seuils sont transparents dans le code et cette documentation ; les seuils de marge et les budgets proviennent du back-office LTC.

## Couverture à améliorer lorsque les intégrations seront disponibles

Les **frais réellement facturés par Stripe**, les **dépenses bancaires réelles** et le **solde bancaire disponible** ne sont pas stockés actuellement. Pour détecter leurs écarts historiques, il faudra connecter la comptabilité/banque ou importer des écritures réconciliées. Tant que cela n'est pas fait, les alertes portent exclusivement sur les signaux disponibles, correctement étiquetés.
