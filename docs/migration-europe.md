# Migration de la base et des fonctions en Europe (Francfort)

## Pourquoi

Mesure du 27/09/2026 depuis la France : chaque page passe par le point d’entrée Vercel de Paris (`cdg1`), puis par les fonctions en Virginie (`iad1`), à côté de la base Neon américaine. Temps de réponse (TTFB médian) : 250 ms sur `/mentions-legales`, 370 ms sur `/pokemon`, 430 ms sur `/catalogue` et 630 ms sur `/`. Un fichier servi par le CDN répond en 46 ms.

Placer les fonctions **et** la base à Francfort (`fra1` et `aws-eu-central-1`) supprime l’aller-retour transatlantique de chaque page. Il faut déplacer les deux en même temps : des fonctions en Europe qui interrogent une base américaine seraient plus lentes qu’aujourd’hui, car chaque requête SQL traverserait l’Atlantique.

Neon ne change pas la région d’un projet existant. Il faut donc créer une nouvelle base, copier les données, puis basculer.

## Ce qu’il faut

- Docker lancé (`colima start`).
- Un créneau calme d’environ 45 minutes, dont 20 minutes d’attente sans nouvelle commande.
- Les **URL directes** (sans `-pooler`) de l’ancienne et de la nouvelle base. Tu les tapes toi-même dans ton terminal : elles ne sont jamais écrites dans un fichier du dépôt.

## 1. Créer la base à Francfort (sans interruption)

1. Ouvre la console Neon avec `stripe projects open neon`, ou directement sur console.neon.tech.
2. Crée un projet « caldera-eu » :
   - région **AWS Europe Central 1 (Frankfurt)** ;
   - **même version de PostgreSQL** que la base actuelle (visible dans les réglages du projet actuel).
3. Dans _Connect_, récupère deux URL :
   - l’URL **directe**, pour la copie ;
   - l’URL **poolée** (`-pooler`), pour le site, si le site utilise aujourd’hui une URL poolée.

Le CLI Stripe Projects ne propose pas de choix de région pour `neon/postgres` (schéma de configuration vide). Ce nouveau projet se gère donc dans la console Neon. Si le plan gratuit refuse un second projet, passe au plan Launch le temps de la migration, puis supprime l’ancien projet.

## 2. Suspendre les commandes

1. Définis la variable :

   ```bash
   printf 1 | vercel env add CHECKOUT_PAUSED production
   ```

2. Redéploie :

   ```bash
   vercel --prod
   ```

Le catalogue reste en ligne. Le passage au paiement affiche « Les commandes sont suspendues quelques minutes pour maintenance », et le panier est conservé.

Attends ensuite **20 minutes**, la durée d’une réservation de stock (`STOCK_RESERVATION_TTL`). Les paiements déjà engagés se terminent et le cron libère les réservations. Tu peux vérifier dans le Dashboard Stripe qu’aucun paiement n’est « en cours ».

## 3. Copier

```bash
SOURCE_DATABASE_URL='postgresql://…ancienne…' TARGET_DATABASE_URL='postgresql://…francfort…' npm run db:copy
```

Le script refuse de continuer dans ces cas :

- la cible n’est pas vide ;
- une URL passe par le pooler ;
- la cible est dans une version plus ancienne que la source ;
- une commande ou une réservation est encore en cours. `FORCE_COPY=1` passe outre ce dernier contrôle, en connaissance de cause.

La copie contient les données clients : elle est faite dans un dossier temporaire privé, supprimé à la fin quoi qu’il arrive. Le script compare ensuite le nombre exact de lignes de chaque table et s’arrête au moindre écart.

Pour contrôler l’état des migrations Prisma sur la nouvelle base, sans rien modifier :

```bash
DATABASE_URL='postgresql://…francfort…' npx prisma migrate status
```

## 4. Basculer

1. Ajoute `"regions": ["fra1"]` dans `vercel.json` (à côté de `crons`) et commite.
2. Remplace l’URL de la base côté Vercel, avec l’URL poolée de Francfort si la production utilisait une URL poolée :

   ```bash
   vercel env rm PRIMARY_DB_CONNECTION_STRING production
   ```

   ```bash
   vercel env add PRIMARY_DB_CONNECTION_STRING production --sensitive
   ```

3. Retire la pause :

   ```bash
   vercel env rm CHECKOUT_PAUSED production
   ```

4. Déploie :

   ```bash
   vercel --prod
   ```

## 5. Vérifier

- `curl -sI https://lesterresdecaldera.fr/pokemon | grep x-vercel-id` doit afficher `cdg1::fra1::…`.
- Une page produit, le panier, puis un paiement réel de faible montant, remboursé ensuite dans le Dashboard Stripe. Le webhook doit passer la commande en « payée » sur la nouvelle base.
- `/api/health` doit répondre correctement.
- Dans Speed Insights, compare le TTFB des jours suivants avec les valeurs ci-dessus.

## Retour arrière

Tant que l’ancienne base n’est pas supprimée, il suffit de :

1. remettre l’ancienne URL dans `PRIMARY_DB_CONNECTION_STRING` ;
2. retirer `regions` de `vercel.json` ;
3. redéployer.

Les commandes passées entre-temps sur Francfort seraient alors à reprendre à la main. Garde donc l’ancienne base une semaine, sans l’utiliser, puis supprime-la dans la console Neon.

Ton fichier `.env` local, géré par Stripe Projects, pointe toujours vers l’ancienne base. Les scripts locaux qui en dépendent devront recevoir la nouvelle URL explicitement.
