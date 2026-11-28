# Seuils de stock et réapprovisionnement

La [consultation du registre](https://eu2.make.com/2002441/scenarios/10251399) donne les livraisons en retard puis les ruptures. Renseigner un SKU pour obtenir sa fiche, son identifiant, sa version et ses derniers changements. Sans SKU, la sortie détaillée présente 25 dossiers par page et la position de lecture suivante.

## Suivre une référence

La [collecte](https://eu2.make.com/2002441/scenarios/10251404) lit le stock disponible après réservations. Elle ouvre un dossier lorsque la quantité atteint le seuil, puis inscrit « Rupture » à zéro. Une même variante conserve son dossier si son SKU change.

Le seuil effectif est le plus élevé entre le seuil configuré et la demande estimée pendant le délai fournisseur. Cette estimation utilise les unités nettes vendues sur 28 jours. Lorsque le délai et des ventes sont connus, la proposition vise le seuil plus une semaine de ventes, après déduction du disponible et du solde déjà commandé. Un écart de comptage suspend la proposition et la validation.

Dans [Enregistrer une décision ou une réception](https://eu2.make.com/2002441/scenarios/10251398), indiquer l’identifiant du dossier et la dernière version renvoyée par la consultation ou par l’action précédente.

| Action      | Données à saisir                                                                            | Effet sur le dossier                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `valider`   | Quantité décidée                                                                            | Enregistre la validation de l’équipe.                                                                                                    |
| `commander` | Quantité effectivement commandée, référence fournisseur et date prévue au format AAAA-MM-JJ | Enregistre une commande déjà passée. La quantité est plafonnée à la quantité validée.                                                    |
| `recevoir`  | Quantité **totale reçue** sur cette commande                                                | Une première livraison de 5 puis une seconde de 7 se saisissent comme 5 puis 12. Le solde restant et le retard éventuel sont recalculés. |
| `annuler`   | Motif d’annulation                                                                          | Annule la validation ou le solde encore à recevoir. La référence et le cumul reçu restent dans l’historique.                             |

Réceptionner les unités physiques dans l’administration Caldera selon la procédure habituelle. Make suit la commande et les déclarations de réception. Après réception complète, un relevé ultérieur au-dessus du seuil clôt le dossier ; si le stock reste insuffisant, le dossier revient à l’étude. Une variante absente d’un tour complet du catalogue est signalée comme non observée.

La [recette à la demande](https://eu2.make.com/2002441/scenarios/10251412) simule une rupture, une commande de 12 unités, un retard, deux réceptions, la répétition d’une saisie et le retour en stock. Elle fonctionne indépendamment de la boutique et du registre réel.

## Exploitation

La cadence configurée est d’un lot de 250 variantes toutes les deux heures. Compter un passage pour un catalogue éligible de 250 variantes, deux pour 500. Chaque lot prend la suite du dernier lot enregistré. La consultation indique la date du dernier tour complet et signale un relevé de plus de 24 heures. Pour les catalogues plus grands, ajuster la cadence en fonction du délai de détection voulu.

Le [flux de la boutique](https://lesterresdecaldera.fr/api/finance/inventory?vue=reassort) utilise la connexion de reporting Caldera. Le paramètre `after` est le dernier UUID traité. Seules les variantes actives de produits actifs, hors démonstrations et précommandes, participent à cette surveillance. Le rapport d’inventaire standard garde son format.

Le registre occupe une entrée dédiée de type `restock-register-v1` dans « CALDERA INVENTORY — Rapports ». Le scénario d’écriture s’exécute séquentiellement. Le dossier et le curseur sont enregistrés ensemble. Le registre conserve les 25 derniers événements par dossier et les dossiers clos pendant 90 jours. Une écriture qui dépasserait 650 000 octets est refusée avant remplacement du registre.

Pour la mise en service, déployer le flux, rétablir l’accès à la boutique, puis activer la collecte et contrôler le premier tour du catalogue. Les actions à la demande et la recette sont disponibles dans Make.
