# Préparation de l'intégration Discord

## État actuel

Le serveur **Les Terres de Caldera** possède un salon privé
`#test-integration` et un webhook nommé **Caldera Test**. Son URL est enregistrée
dans le `.env` local, hors Git. Un message de test envoyé par le
backend a été confirmé dans ce salon le 7 octobre 2026.

Le webhook du salon test est aussi enregistré comme variable **chiffrée**
`DISCORD_WEBHOOK_ANNOUNCEMENTS` dans l'environnement Production du projet
Vercel `les-terres-de-caldera`. Le drapeau d'activation n'y est pas défini :
aucun envoi de production n'est déclenché.

L'application web ne publie rien automatiquement : aucun flux métier n'appelle
le transport de `src/lib/discord/`. `DISCORD_PUBLICATIONS_ENABLED` vaut `false`
par défaut dans le dépôt. La valeur `true` n'est utilisée que dans le `.env`
local de test.

`npm run test:discord` envoie un message technique par exécution dans ce salon.
La commande n'expose aucune route publique et ne réessaie pas automatiquement
un envoi incertain. Elle est réservée à un lancement volontaire en terminal.

## Publications publiques

Quatre types sont prévus : `release`, `restock`, `announcement`, `campaign`.
Chaque type pointe vers son propre secret `DISCORD_WEBHOOK_*`; il n'y a pas de
repli implicite vers un autre salon. Le message ne contient que titre, résumé
et lien interne au site. Le transport limite la longueur, neutralise les
mentions et le Markdown, interdit les hôtes webhooks autres que
`https://discord.com`, refuse les redirections et n'enregistre ni URL ni
réponse brute dans les logs. Discord confirme l'envoi via `wait=true`.

### Étape nécessaire avant activation

Créer une **file transactionnelle** en base, avec clé unique de l'événement,
type, contenu public validé, état, nombre de tentatives, prochaine tentative,
bail temporaire et identifiant du message Discord. Un worker borné, lancé par
le cron de maintenance existant, devra prendre les lignes avec verrouillage
concurrent, respecter les `429` et délais de Discord, et offrir une revue
manuelle quand l'issue d'un envoi est incertaine. Un POST webhook n'a pas de
clé d'idempotence fournie par Discord : après une coupure réseau, réessayer
aveuglément peut créer un doublon. L'enregistrement de l'événement doit se
faire dans la même transaction que sa publication ou le changement de stock.

Les nouvelles sorties doivent dépendre d'une publication réellement visible,
avec date vérifiée. Les restocks doivent dépendre du passage de zéro à un stock
achetable, avec déduplication par produit et fenêtre de regroupement ; les
variations internes de stock et les réservations ne doivent pas annoncer de
faux restock. Les actualités et campagnes doivent être cochées et prévisualisées
dans l'admin avant leur mise en file ; publier une newsletter ne publie pas
automatiquement son contenu sur Discord.

Conserver les secrets dans les variables serveur de l'hébergeur, jamais dans
`NEXT_PUBLIC_*`, le dépôt ou un formulaire admin. Créer un webhook distinct
par salon, avec seulement les permissions nécessaires. Vérifier les salons et
faire un essai explicite avant d'activer les publications.

## Comptes et rôle lié

Le profil client propose une liaison volontaire par OAuth2 `authorization_code`
avec portée `identify`. Le `state` aléatoire est stocké sous forme de hachage,
expire après dix minutes, est lié à la session Caldera et est consommé une
seule fois. Le callback ne lit l'identité que via `/users/@me` avec le jeton
reçu de Discord ; ni e-mail, ni jeton d'accès/rafraîchissement ne sont
persistés. Le jeton d'accès est révoqué après usage dans la mesure du possible.

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
Git et ne sont jamais préfixés `NEXT_PUBLIC_`.

Le rideau « Ouverture prochaine » masque encore `/compte` sur le site en
production. Ne pas l'ouvrir implicitement lors de la mise en place de Discord.
La liaison est testable en local sur le port et l'URL de callback déclarés ;
elle deviendra accessible publiquement à l'ouverture décidée de la boutique.

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
