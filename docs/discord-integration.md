# Préparation de l'intégration Discord

## État actuel

Le serveur **Les Terres de Caldera** possède un salon privé
`#test-integration` et un webhook nommé **Caldera Test**. Son URL est enregistrée
dans le `.env` local, hors Git. Un message de test envoyé par le
backend a été confirmé dans ce salon le 7 octobre 2026. Aucun bot, lien de
compte ou rôle n'est encore configuré.

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

## Comptes et rôles : étape ultérieure

La liaison Caldera ↔ Discord doit être volontaire depuis un compte client
authentifié. Prévoir OAuth2 `authorization_code` avec portée minimale
`identify`, `state` à usage unique lié à la session, vérification de la
redirection, et liaison unique entre identifiants Caldera et Discord. Ne pas
fusionner les comptes sur la seule adresse e-mail. Permettre la déliaison et
supprimer la liaison lors de la suppression du compte. Stocker les jetons
OAuth uniquement si une fonctionnalité en a réellement besoin, chiffrés et
avec durée de conservation limitée.

L'attribution de rôles exige un bot, des permissions et une hiérarchie de rôles
vérifiées. Prévoir une table de correspondance explicite entre un statut métier
stable et un rôle autorisé, une synchronisation différée et réversible, un
historique d'échec sans données personnelles et le retrait du rôle si le statut
cesse. Aucun rôle n'est accordé par un simple paramètre de requête ou une
information déclarée par le client.

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
Le bot et OAuth auront une configuration séparée lors de leur implémentation ;
aucun identifiant fictif n'est requis aujourd'hui.

Références : [webhooks Discord](https://docs.discord.com/developers/resources/webhook),
[limites de débit Discord](https://docs.discord.com/developers/topics/rate-limits),
[OAuth2 Discord](https://docs.discord.com/developers/topics/oauth2).
