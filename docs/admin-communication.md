# Administration — espace communication

La navigation locale relie Newsletter, Carnets, Calendrier et Discord. « Résultats » ouvre les mesures existantes. Les codes promotionnels se trouvent dans Ventes & clients ; la recherche globale permet aussi d’ouvrir directement le calendrier, l’audience et les automatisations.

## Newsletter

La prochaine édition et l’avance éditoriale restent prioritaires. Une action contextuelle propose de compléter le récit, l’illustration, le Comptoir ou l’email, puis de vérifier/tester. Une édition déjà programmée renvoie à son suivi.

Les repères cliquables utilisent les compteurs réels. Les campagnes peuvent être recherchées par nom ou objet, filtrées par état et parcourues par pages de 25, avec un ordre stable. Les campagnes principales des Carnets renvoient à l’éditeur canonique ; les autres au Studio. Les erreurs de diffusion restent visibles dans la liste.

Les paramètres `campaignSearch`, `campaignStatus`, `campaignPage` sont indépendants des paramètres des abonnés (`search`, `status`, `page`). L’audience est repliée par défaut, ouverte dès qu’un filtre d’abonnés ou le raccourci Audience est utilisé. Les consentements, confirmations, sources et dates de désinscription restent accessibles. L’état technique conserve les scénarios et diagnostics existants dans un panneau distinct.

## Discord

Les vues regroupent les brouillons, la file (PENDING/PROCESSING/RETRY), les publications à vérifier (REVIEW/REJECTED), les envois confirmés et les annulations. Les compteurs portent sur l’ensemble des données, les résultats de recherche sur la sélection. Historique paginé par 25.

La sauvegarde crée uniquement un brouillon puis ouvre son aperçu. La mise en file requiert toujours la relecture et la confirmation existantes. Les reprises incertaines et la confirmation d’un message retrouvé restent disponibles. L’annulation est isolée dans une action secondaire avec confirmation. Les boutons d’envoi sont désactivés lorsque le canal ou le service est désactivé ; les contrôles serveur restent autoritaires.

Aucun secret Discord n’est affiché. Les diagnostics de configuration présentent seulement l’état des salons. Aucun changement des permissions, des webhooks ou des destinataires.

## Navigation et accessibilité

Les formulaires GET et les liens conservent des URL partageables. Les ancres rejoignent les résultats après le chargement des données, ouvrent les panneaux nécessaires et placent le focus sur le titre. Les disclosures natifs restent utilisables au clavier. Les libellés accompagnent les icônes ; les états ne reposent pas seulement sur la couleur.

Aucune migration ni nouvelle variable d’environnement. Vérifications sur base QA isolée : pagination/filtrage SQL, compteurs, routes protégées, rendu HTTP admin, scénarios newsletter/Carnets/Discord, contrôles navigateur ordinateur et petit écran. Aucun email ou message Discord réel envoyé pour ces essais.
