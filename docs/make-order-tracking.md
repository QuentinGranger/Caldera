# Suivi des commandes Caldera

L’équipe travaille dans le [registre des commandes](https://docs.google.com/spreadsheets/d/17nv71xfL4I3Zkq-pTdASvugiNciY5zE9LNZENvJwp4M/edit). **Commandes** présente le dernier état connu de chaque référence. **Journal** conserve les changements. **Relève** réunit les compteurs opérationnels et les actions à examiner. **Reprise** indique le dernier succès en UTC, le curseur et la présence éventuelle d’un autre lot. Les dates du journal et de la relève suivent le fuseau Europe/Paris.

## Traiter les priorités de la relève

Ouvrir l’onglet [À traiter](https://docs.google.com/spreadsheets/d/17nv71xfL4I3Zkq-pTdASvugiNciY5zE9LNZENvJwp4M/edit#gid=15). La référence ouvre la fiche admin. Chaque ligne regroupe tous les motifs de la commande. Les paiements à vérifier, les incohérences de paiement et les remboursements bloqués passent en premier. À priorité égale, le signal le plus ancien passe en tête. Le bandeau indique la date du relevé et le nombre de dossiers affichés sur le total, avec une limite de 50. La prochaine relève retire les dossiers résolus. Pour obtenir les trois premières références entre deux relèves, lancer la consultation à la demande.

## Scénarios Make

- [Registre et historique](https://eu2.make.com/2002441/scenarios/10250192) lit au plus 100 événements par exécution horaire. Il enregistre les lignes du journal, les fiches et le point de reprise dans une même requête Google Sheets. L'exécution est séquentielle. Un nouvel essai repart du dernier lot enregistré. Si « Autre lot en attente » indique « Oui », une nouvelle exécution peut avancer le rattrapage.
- [Relève quotidienne](https://eu2.make.com/2002441/scenarios/10250198) appelle le scénario de consultation puis écrit la ligne du jour. Une relance le même jour actualise cette ligne. La relève compte séparément les précommandes, l’expédition en attente depuis 48 h, les paiements à vérifier ou en cours depuis 1 h et les remboursements bloqués ou en attente depuis 24 h. Elle signale une dernière synchronisation vieille de plus de 2 h.
- [Consultation à la demande](https://eu2.make.com/2002441/scenarios/10250196) renvoie directement les dix compteurs de Caldera et un résumé lisible. Elle peut être appelée indépendamment de Google Sheets.
- [Recette isolée](https://eu2.make.com/2002441/scenarios/10250200) simule une commande créée puis payée, vérifie le contenu des écritures et renvoie le résultat. Ses entrées sont fictives et ses sorties restent dans l’exécution Make.

## Mise en service

Déployer la migration Prisma et la route de cette branche. La migration enregistre une observation initiale par commande existante. Elle journalise ensuite chaque création et chaque changement des deux statuts dans la même transaction que la commande. Le journal exporte la référence, les statuts, l’heure et les identifiants techniques nécessaires à la reprise. Il distingue l’état repris à l’installation d’une transition réellement observée.

Le scénario horaire appelle `GET /api/finance/order-events?after=0:0` au premier passage, puis remplace `0:0` par le dernier curseur. La consultation utilise `GET /api/finance/orders?detail=priorites`. Le briefing agrégé continue à utiliser `GET /api/finance/orders`. Les deux appels réutilisent la connexion API de reporting Caldera dans Make. Les paiements, les mouvements physiques et les notifications clients suivent les validations de la boutique.

Vérifier la connexion Google de Make sur le classeur et rétablir l’accès HTTP au déploiement Caldera. Exécuter le registre une fois, contrôler « Dernière synchronisation UTC », puis exécuter la relève. Activer ensuite les deux horaires et vérifier l’heure affichée dans l’équipe Make. La capacité nominale du registre est de 100 événements par heure ; ajuster la fréquence si le rattrapage persiste. Utiliser les vues filtrées de Sheets pour consulter les onglets gérés par l’automatisation.

## Vérification locale

Les modules de transformation sont reproduits dans `scripts/make/order-tracking.cjs` et `scripts/make/order-handover.cjs`. Lancer `node --test tests/order-tracking-make.test.mjs`. Sur une base PostgreSQL locale migrée, lancer `node --conditions=react-server --import tsx --test tests/order-tracking-db.test.ts` pour vérifier la pagination, la reprise, l’autorisation et les écritures concurrentes.
