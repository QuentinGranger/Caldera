# Préparation de l'intégration Discord

## État actuel

Le serveur **Les Terres de Caldera** possède un salon privé
`#test-integration` et un webhook nommé **Caldera Test**. Son URL est enregistrée
dans le `.env` local, hors Git. Un message de test envoyé par le
backend a été confirmé dans ce salon le 7 octobre 2026.

L'intégration utilise quatre salons publics dédiés : `#annonces`,
`#nouveautés`, `#restocks`, `#offres`. Chaque webhook est conservé dans
les `.env` hors Git et les variables serveur chiffrées Vercel. Le salon privé
reste réservé aux essais techniques.

**État vérifié le 8 octobre 2026 : `DISCORD_PUBLICATIONS_ENABLED=false`
en production**, après redéploiement et contrôle du worker protégé.
La dernière demande du propriétaire suspend l'activation autorisée auparavant.
`DISCORD_PUBLICATIONS_ENABLED` vaut également `false` dans les `.env` locaux.
L'activation en production nécessite les quatre webhooks et `STORE_OPEN=1`.
Les mécanismes opérationnels et le contrôle préalable Stripe sont décrits ci-dessous.

## Publications publiques

Quatre types sont disponibles : `release`, `restock`, `announcement`, `campaign`.
Chaque type pointe vers son propre secret `DISCORD_WEBHOOK_*`, sans repli vers
un autre salon. Les publications passent par une file transactionnelle en base.
Les messages contiennent seulement un titre, un résumé et un lien public interne.
Le transport neutralise les mentions et le Markdown, impose `https://discord.com`,
refuse les redirections et ne journalise aucun secret ni réponse brute.
Discord confirme l'envoi via `wait=true`. Un envoi incertain exige une revue
manuelle et n'est jamais réessayé automatiquement.

Les sorties dépendent d'un produit réellement publié, marqué comme nouveauté
avec une date de sortie renseignée. Les restocks dépendent d'un réapprovisionnement
physique faisant passer un produit épuisé à un stock achetable. Les annonces et
campagnes sont prévisualisées puis explicitement validées dans `/admin/discord`.
La publication d'une newsletter ne publie pas automatiquement sur Discord.

`npm run test:discord` est une commande volontaire en terminal utilisant
uniquement `DISCORD_WEBHOOK_TEST`. Elle vérifie que le webhook appartient à
`DISCORD_GUILD_ID` et `DISCORD_TEST_CHANNEL_ID`, puis envoie un seul message
technique. Une configuration absente ou incohérente arrête le test ; aucun repli
vers un salon public n'est permis. L'autorisation du transport est temporaire,
limitée à ce processus CLI, puis restaurée ; les variables locales et de
production restent inchangées. Ne pas planifier cette commande en production.

## Comptes et rôle lié

Le profil client propose une liaison volontaire par OAuth2 `authorization_code`
avec portée `identify`. Le `state` aléatoire est stocké sous forme de hachage,
expire après dix minutes, est lié à la session Caldera et est consommé une
seule fois. Le callback ne lit l'identité que via `/users/@me` avec le jeton
reçu de Discord ; ni e-mail, ni jeton d'accès/rafraîchissement ne sont
persistés. Le jeton d'accès est révoqué après usage dans la mesure du possible.

Les tests PostgreSQL (`npm run test:discord:account:db`) vérifient le hachage,
la liaison à la session, le remplacement, l’expiration et la consommation
concurrente unique du `state`, ainsi que les contraintes d’unicité et les
suppressions en cascade, la reprise après une panne Discord et les actions
concurrentes. Ils refusent toute base non locale. Un verrou PostgreSQL par
client sérialise attribution, nouvelle tentative et retrait du rôle entre
les différentes instances du serveur.

`CustomerDiscordLink` impose une liaison unique de chaque côté et disparaît
avec le compte client. Une tentative d'attribution échouée laisse
`roleGrantedAt` vide ; le profil propose alors de réessayer. La déliaison
retire le rôle avant de supprimer la liaison ; en cas d'indisponibilité de
Discord, elle reste en place pour permettre une nouvelle tentative sûre. La
suppression du compte retire le rôle via le hook `beforeDelete` de better-auth,
après vérification du mot de passe.

Le bot lit l'appartenance au seul serveur `DISCORD_GUILD_ID` et ne gère que le
rôle fixe `DISCORD_LINKED_ROLE_ID`. Le code ne reçoit jamais un rôle depuis le
navigateur. Le bot ne doit avoir que `Gérer les rôles` et être placé sous tous
les rôles d'administration, au-dessus de « Compte Caldera lié ». Aucune
intention Gateway privilégiée ni permission Administrateur n'est requise.

Configuration serveur uniquement : `DISCORD_CLIENT_ID`,
`DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` et
`DISCORD_LINKED_ROLE_ID`. Déclarer exactement
`https://lesterresdecaldera.fr/api/discord/callback` comme redirect URI
(et l'URL localhost choisie pour les tests locaux). Les secrets restent hors
Git et ne sont jamais préfixés `NEXT_PUBLIC_`. Les journaux de développement
ignorent le callback OAuth et les arguments des Server Actions. Le filtrage
Sentry existant retire les chaînes de requête des URL.

L’espace `/compte` a été ouvert avant la boutique pour permettre la liaison
Discord. Le propriétaire a ensuite autorisé l’ouverture du catalogue et du
checkout via `STORE_OPEN=1`. Les routes du compte conservent leur authentification.

Les futurs statuts Caldera devront être mappés par le serveur vers une liste
explicite de rôles autorisés. Aucun statut commercial n'est défini ici.

## Commandes et alertes stock

Ne jamais publier les détails de commande, adresses, e-mails, identifiants de
paiement, jetons d'accès ou alertes personnelles dans un salon public. Si des
notifications privées sont ajoutées, demander un opt-in distinct, lier et
vérifier le compte Discord, limiter les informations envoyées, fournir une
désactivation et éviter que Discord devienne le seul canal d'information
transactionnelle. Les e-mails de commande et les alertes stock existants
restent la source fiable.

## Configuration future

Avant d'activer des publications automatiques en production, créer les salons
souhaités, renseigner uniquement leurs webhooks dans les variables serveur,
ajouter puis vérifier la file et les déclencheurs métier.
Le bot et OAuth ont une configuration séparée des webhooks de publication.

Références : [webhooks Discord](https://docs.discord.com/developers/resources/webhook),
[limites de débit Discord](https://docs.discord.com/developers/topics/rate-limits),
[OAuth2 Discord](https://docs.discord.com/developers/topics/oauth2).

## Validation de cette étape

Le test réel a utilisé un compte de QA dans une base PostgreSQL locale isolée
et le véritable compte Discord du propriétaire du serveur. OAuth a créé la
liaison ; après correction et enregistrement de la hiérarchie des rôles,
la nouvelle tentative a attribué le rôle. La déliaison depuis le profil a
supprimé la ligne et retiré le rôle, vérifié par l’API Discord. Aucun compte
de QA n’a été créé dans Neon. Les notifications automatiques de production
restent désactivées.

La migration `20261007190000_add_discord_account_link` a été appliquée via
la console Neon sur `caldera-eu / production` et enregistrée avec le checksum
Prisma correspondant. L’URL de connexion Vercel, marquée sensible, reste
non exportable par la CLI ; cette application sur Neon ne prouve pas à elle
seule que l’instance Vercel utilise cette branche.

## Publications automatiques et ouverture de la boutique

Le propriétaire avait autorisé l’activation des publications et l’ouverture du
catalogue et du checkout. `STORE_OPEN=1` est le seul interrupteur serveur du
rideau ; aucun cookie ne le contourne. Les contrôles de paiement existants
continuent d’exiger Stripe live, une clé publique live et le secret webhook.

La migration `20261008003000_add_discord_outbox` ajoute une seule table et un
enum, sans modifier les produits, clients, commandes ou liaisons existants.
`DiscordOutbox` conserve seulement le contenu public validé, une clé unique,
le statut d’envoi, le délai, le bail et l’identifiant Discord confirmé.

- Les nouveautés publiées avec date de sortie connue sont mises en file dans
  leur transaction d’administration ; la date future est respectée et relue.
- Seuls les réapprovisionnements physiques `RESTOCK` faisant passer un produit
  de rupture à disponible déclenchent un réassort. Les réservations, retours,
  corrections et paiements n’en produisent pas. Les variantes sont regroupées
  par produit, avec une seule annonce par heure.
- Les annonces et campagnes sont créées en brouillon dans `/admin/discord`,
  prévisualisées, puis mises en file avec confirmation explicite. Les campagnes
  newsletter ne sont jamais copiées automatiquement.
- Le worker relit visibilité, nom, URL et disponibilité avant l’envoi. Il
  annule les événements devenus obsolètes et ne publie aucun lien personnel.
- Les workers utilisent `FOR UPDATE SKIP LOCKED`, un bail borné et des écritures
  conditionnées à sa possession. Un bail expiré, timeout, réponse 5xx ou réponse
  sans identifiant confirmé passe en `REVIEW` : aucune nouvelle tentative aveugle.
- Un `429` diffère l’envoi et impose un délai commun aux workers. Après huit
  tentatives refusées, une vérification humaine est requise.
- Les admins peuvent annuler, confirmer un message existant par son identifiant
  ou réessayer après avoir vérifié l’absence du message dans le salon.

Les mutations admin déclenchent immédiatement un lot en arrière-plan après
commit. Le cron de maintenance existant reprend les événements différés ou
planifiés toutes les minutes via le déclencheur Neon `caldera-maintenance-minute`
(actif et vérifié), avec le cron quotidien Vercel en complément. `/api/cron/discord` permet
également un déclenchement depuis un planificateur autorisé ; il refuse tout
appel sans `CRON_SECRET` ou `DISCORD_WORKER_SECRET`. Le mode `?check=1` effectue
uniquement des lectures de préparation Stripe, sans retourner de secret ni
identifiant de compte. Aucun secret n’est accepté en query string.

Les quatre `DISCORD_WEBHOOK_*` doivent pointer explicitement sur leurs salons
respectifs. L’activation nécessite `DISCORD_PUBLICATIONS_ENABLED=true` et,
en production, `STORE_OPEN=1`. Aucun ancien produit ou ancien stock n’est
annoncé en masse à l’activation. La file ne garantit pas un envoi exactement une
fois lors d’une réponse réseau perdue : ce cas est volontairement arrêté pour
vérification, conformément au comportement des webhooks Discord.

Le cycle de liaison a aussi été validé sur le site de production : la ligne et
`roleGrantedAt` ont été constatés dans `caldera-eu / production`, et le rôle
vérifié dans l’API Discord. Cette observation confirme la base réellement
utilisée par Vercel, dont la chaîne de connexion reste masquée.

## Structure du serveur validée le 8 octobre 2026

| Ordre | Catégorie      | Salons                                                    |
| ----- | -------------- | --------------------------------------------------------- |
| 1     | COMMENCER ICI  | bienvenue, règles, annonces, rôles                        |
| 2     | CALDERA        | nouveautés, restocks, offres, actualités-tcg, suggestions |
| 3     | COMMUNAUTÉ     | général, pokémon-tcg, vos-pulls, deckbuilding, collection |
| 4     | AIDE           | aide-caldera, faq                                         |
| 5     | VOCAUX         | Général                                                   |
| 6     | STAFF (privée) | staff, logs, discord-tech, test-integration               |

Les salons COMMENCER ICI, les quatre publications, actualités-tcg et faq sont
en lecture seule pour les membres standards et liés. Les suggestions, l'aide
et la communauté permettent les discussions ; les images sont autorisées,
notamment dans vos-pulls. STAFF et ses quatre salons refusent Voir le salon à
`@everyone` et l'autorisent au rôle Staff. Ces droits ont été contrôlés par
l'API Discord et l'aperçu de rôle `@everyone`, sans utiliser le compte d'un
tiers. La liste des salons a aussi été inspectée à une largeur de 390 px ;
ce contrôle n'est pas un test de l'application Discord sur téléphone physique.

Staff possède uniquement Gérer les messages et Exclure temporairement des
membres au niveau serveur, plus les accès et publications par salon. Il n'est
attribué à aucun membre. La hiérarchie est Staff > bot > Compte Caldera lié :
le bot ne peut pas attribuer le rôle Staff. `@everyone` n'a ni administration,
gestion des rôles, gestion des salons, gestion des webhooks, mentions collectives
ni publications d'applications externes.

| Événement      | Variable serveur                         | Salon            |
| -------------- | ---------------------------------------- | ---------------- |
| `announcement` | `DISCORD_WEBHOOK_ANNOUNCEMENTS`          | annonces         |
| `release`      | `DISCORD_WEBHOOK_RELEASES`               | nouveautés       |
| `restock`      | `DISCORD_WEBHOOK_RESTOCKS`               | restocks         |
| `campaign`     | `DISCORD_WEBHOOK_CAMPAIGNS`              | offres           |
| Test manuel    | `DISCORD_WEBHOOK_TEST` (local seulement) | test-integration |

Les quatre webhooks publics ont été réutilisés sans rotation ni changement
d'identifiant. Le webhook privé Caldera Test est conservé et un nouvel envoi
par le transport backend a été confirmé après son déplacement dans STAFF.
Les URL restent hors Git ; aucune variable Discord n'est `NEXT_PUBLIC_*`.
Les textes d'accueil, règles, rôles, FAQ et aide sont publiés. Aucun fait
commercial, produit, stock, prix ou campagne n'a été inventé.

Le support privé futur suivra demande → ticket individuel → Staff, avec accès
limité au demandeur et au Staff, fermeture et conservation définies. Aucun
ticket ou transfert de données client vers Discord n'est actif. Les demandes
personnelles passent actuellement par le formulaire de contact du site.

Prochaine étape : revoir les déclencheurs métier déjà préparés, leur contenu,
les horaires et les brouillons en attente avant une activation explicitement
autorisée. Les produits de démonstration restent exclus des sorties/restocks.

## Catalogue d’exemple demandé par le propriétaire

`CATALOG_DEMO_MODE=1` affiche un bandeau explicite et une page checkout sans
formulaire de paiement ; le contrôle serveur de paiement bloque également les
appels directs. Les pages portent `X-Robots-Tag: noindex, nofollow`.
Trois fiches `[Exemple]` illustrent Booster, Coffret et ETB, sans extension,
date de sortie, prix ou stock commercial inventé.

Chaque exemple porte `Product.isDemonstration=true` : il reste impossible à
mettre au panier même si son stock est modifié ou le mode global désactivé.
Les fiches masquent achats et alertes, et n’émettent pas de données structurées
Product/Offer. Les sorties/restocks Discord ignorent ces références. Les
modes de livraison `isDevelopment` sont refusés lorsque la boutique est ouverte
en production.

Pour vendre ultérieurement, créer de vraies références et de vrais modes de
livraison, archiver les exemples puis désactiver `CATALOG_DEMO_MODE` et
`CHECKOUT_PAUSED`. Les exemples ne doivent pas être transformés en produits
commerciaux en changeant uniquement leur titre.
