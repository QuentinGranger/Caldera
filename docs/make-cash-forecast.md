# LTC — Prévision de trésorerie 30 / 60 / 90 jours

## Architecture

Scénario Make **10162843** (prévu à **08:10 Europe/Paris**), après le rapport financier quotidien à 08:00 :

1. Lit les échéances dans **LTC — Prévisions de trésorerie — Échéances** (Data Store Make, id 209835).
2. Regroupe toutes les lignes dans une liste JSON (sans clé secrète exposée dans le scénario).
3. Envoie `POST https://lesterresdecaldera.fr/api/finance/forecast`, via la connexion HTTP Make existante, `Authorization: Bearer <FINANCE_REPORT_SECRET>` gérée dans le coffre Make.
4. Archive le résultat dans **LTC — Historique des prévisions de trésorerie** (Data Store id 209836), clé = date à Paris.
5. Publie le résumé dans Discord privé STAFF **#brief-quotidien**.

Le scénario reste inactif jusqu'à déploiement et test réussi de la nouvelle API.

## Données disponibles et limites

- **Solde de départ** : `BusinessPilotageSettings.cashBalance`, valeur **manuelle** du back-office `/admin/pilotage`. Ce n'est pas une banque synchronisée ; aucune conversion automatique de CA encaissé en trésorerie bancaire.
- **Charges courantes** : cinq budgets mensuels existants (fixes, emballages, expéditions, marketing, autres), proratisés par jour sur 365,25 / 12 jours/mois. **Budget estimatif**, pas les virements réellement exécutés.
- **Factures clients** : actuellement créées par la boutique après une commande payée ; elles ne constituent donc pas une créance future à ajouter automatiquement. Les futures créances non encaissées et factures fournisseurs doivent être **saisies manuellement** dans le registre d'échéances.
- **Stock existant** : les quantités et la valeur d'achat (coûts rendus, quand connus) sont suivies ; cela représente de l'argent **déjà immobilisé**, pas une sortie future.
- **Achats futurs** : seuls les achats saisis dans le registre avec `kind=stock_purchase` sont comptabilisés. Aucun montant déduit du budget maximum de stock n'est automatiquement dépensé.
- **Recettes futures** : seules les créances prévues avec le statut `committed` sont comptées. Aucune hypothèse de croissance ou de ventes non réalisées n'est incluse.

Les sorties sont deux scénarios par horizon : **budget + échéances engagées** (engagées) ; **budget + échéances engagées + achats envisagés** (prudent). Les recettes simplement envisagées ne gonflent pas la projection.

### Créer une échéance

Dans Make → Data Stores → `LTC — Prévisions de trésorerie — Échéances` → **Add a record**. Utiliser une clé unique non secrète (ex. `fac-fournisseur-2026-12-10`). Les champs :

| Champ | Valeurs | Exemple |
|---|---|---|
| reference | Référence sans données personnelles | `DEVIS-ACHAT-001` |
| kind | `supplier_invoice`, `stock_purchase`, `other_expense`, `customer_invoice`, `other_income` | `stock_purchase` |
| status | `committed` (certain), `proposed` (envisagé), `settled` (réglé), `cancelled` | `proposed` |
| date | date d'échéance `YYYY-MM-DD` | `2026-12-10` |
| amount_eur | **TTC** au centime | `145.50` |
| notes | note facultative | `Commande stock envisagée` |

Aucune ligne d'exemple n'est enregistrée en production. On doit passer à `settled` dès qu'un règlement est inclus dans le solde de trésorerie manuel, sinon il sera décompté deux fois. Une facture en retard non réglée est comptée dans toutes les projections futures.

**Ne pas recopier les frais déjà inclus dans le budget mensuel comme des dépenses ponctuelles**, sinon double comptabilisation. Il faut au contraire supprimer le poste du budget mensuel si l'on choisit de le planifier au niveau des factures détaillées.

### Fiabilité

Le rapport devient numérique lorsque les paramètres de pilotage existent. Il reste marqué `PROVISIONAL_MANUAL_BASELINE`, car ni solde bancaire ni facturation fournisseurs ne sont directement connectés. Sans paramètres de pilotage, les montants futurs sont `null` et le statut est `MISSING_CASH_BASELINE` — jamais 0 € inventé.

### Confidentialité

API protégée par le même `FINANCE_REPORT_SECRET` que le rapport financier quotidien ; **POST uniquement**, pas de données clients, limite de 40 Ko et 250 échéances, cache désactivé. La connexion HTTP est limitée au domaine LTC, la publication Discord au canal STAFF privé.
