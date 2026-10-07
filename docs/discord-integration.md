# Préparation de l'intégration Discord

## État actuel

Le site ne contacte pas Discord. Aucun salon, bot, identifiant, webhook, lien de
compte ou rôle n'est configuré ou simulé. `DISCORD_PUBLICATIONS_ENABLED` vaut
`false` par défaut et aucun flux métier n'appelle encore le transport. Le
contrat de messages publics et le transport webhook, dans `src/lib/discord/`,
servent de point d'entrée pour la suite.

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

Après création du serveur, renseigner uniquement les webhooks des salons
souhaités dans les variables serveur. Ajouter puis vérifier la file et les
déclencheurs métier avant de mettre `DISCORD_PUBLICATIONS_ENABLED=true`.
Le bot et OAuth auront une configuration séparée lors de leur implémentation ;
aucun identifiant fictif n'est requis aujourd'hui.

Références : [webhooks Discord](https://docs.discord.com/developers/resources/webhook),
[limites de débit Discord](https://docs.discord.com/developers/topics/rate-limits),
[OAuth2 Discord](https://docs.discord.com/developers/topics/oauth2).
