# CALDERA — rapport financier quotidien Make

Ce document décrit le raccordement du scénario Make **LTC — Rapport financier quotidien [pré-lancement]** (ID 10162564) au système e-commerce maison (Next.js, Prisma/PostgreSQL, Stripe).

## API sécurisée

`GET https://lesterresdecaldera.fr/api/finance/daily?date=YYYY-MM-DD`

Authentification : `Authorization: Bearer <FINANCE_REPORT_SECRET>`. Définir une valeur aléatoire d'au moins 32 caractères dans **Vercel** (`FINANCE_REPORT_SECRET`) et la même valeur **uniquement dans un coffre de connexion HTTP Make**, jamais dans le dépôt GitHub ni en query string. Ne pas utiliser une clé Stripe ni un secret administrateur. Réponse 503 si clé non configurée, 401 si elle est fausse.

Le champ date est facultatif (la veille en heure de Paris). Le scénario Make doit passer la date de la veille pour que la recherche et l'archive portent sur le même jour. Les bornes sont résolues séparément pour tenir compte de l'heure d'été/hiver.

## Données

L'API lit les commandes `PAID` enregistrées à la date demandée, leur coût d'achat historique, et les remboursements `SUCCEEDED` de cette même date. Elle retourne uniquement des agrégats, sans données client ou identifiants de commande.

- `gross_sales_ht - discounts_ht - refunds_ht` : CA produits net hors TVA et hors livraison, avec remboursements affectés au jour de succès.
- `cogs_ht` : coût d'achat historique des produits vendus, net des produits remis en stock lors de remboursements. `null` si informations manquantes.
- `gross_margin_ht` : CA produits HT moins coûts d'achat historiques ; `null` si coût manquant ou remboursement non ventilable.
- `collected_orders_ttc` et `refunded_total_ttc` : flux de commandes/règlements TTC, **pas** un solde bancaire.
- `monthly_operating_budget_eur` et `cash_balance_manual_eur` : valeurs manuelles du back-office, **pas** des dépenses effectivement payées ni un solde bancaire synchronisé.
- `operating_expenses_ht = null` et `cash_available_eur = null` tant qu'une vraie source de comptabilité et de banque n'est pas raccordée.

En cas de remboursement de geste commercial sans ventilation fiable de TVA, les totaux financiers doivent être revus, et la marge est indiquée indisponible. Aucun montant manquant n'est remplacé par un vrai zéro.

## Make

1. Déployer la PR et définir le secret dans Vercel.
2. Configurer la connexion HTTP Make avec la même clé secrète (Bearer), limitée à `https://lesterresdecaldera.fr`.
3. Dans le scénario 10162564, remplacer la source Data Store temporaire par `HTTP > Make a request` : GET, URL ci-dessus, `date={{formatDate(addDays(now; -1); "YYYY-MM-DD"; "Europe/Paris")}}`, `parseResponse=true`, `stopOnHttpError=true`.
4. Archiver les valeurs agrégées dans `LTC - Finance - Archives des rapports`, clé = date, écrasement autorisé pour réexécutions idempotentes.
5. Faire un test sur un jour sans ventes : `paid_orders=0`, `sales_source_connected=true`, marge non calculable, trésorerie et dépenses indisponibles.
6. Vérifier le rapport un jour avec commande de test et coût renseigné ; ne pas déclencher de transaction réelle uniquement pour tester.
7. Activer la planification **chaque jour à 08:00, Europe/Paris** seulement après validation.

Ne jamais afficher de secret dans une sortie de module ou des logs, ni transmettre des données client à Make.
