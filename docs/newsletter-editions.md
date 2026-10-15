# Nouvelle édition — séparation des workflows

## Architecture

1. Newsletter et Carnets conservent leurs sections admin existantes. Le Campaign Studio commercial reste inchangé.
2. `/admin/newsletter/nouvelle` est la page de choix, protégée par requireAdmin et le layout dashboard existants (session, permissions, MFA).
3. Le choix narratif ouvre `/admin/carnets/nouveau` : l’objet CarnetChapter est créé lors de l’enregistrement explicite. Visiter une page ou choisir le parcours n’écrit aucune donnée.
4. Le choix commercial conserve `/admin/newsletter/campagnes/nouvelle`. Les anciennes URLs, campagnes, templates, blocs, programmation, audiences, tracking, récupération, import/export et historique restent disponibles.
5. Nouveaux fichiers : page de choix et module SCSS local. Aucune dépendance ni migration.
6. Modifications : entrée Newsletter, fil d’Ariane, retours Newsletter depuis les Carnets, tests HTTP.
7. Composants réutilisés : PageHeader, styles card/button/eyebrow, tokens admin, Link et icônes Lucide.
8. Les deux entrées de barre latérale restent inchangées. La nouvelle étape ne multiplie pas les sous-menus.
9. Tests : authentification/MFA, deux liens sémantiques, routes existantes, zéro création lors des visites, Carnet sans campagne vide, retours, navigation clavier et largeur réduite.
10. Risques limités aux liens et à l’affichage : aucun changement dans les services d’envoi, le modèle, l’éditeur généraliste ou l’accès aux récits.

## Choix accessibles

Les cartes sont de vrais liens, entièrement cliquables et utilisables au clavier, avec nom accessible unique, description et focus visible. Elles s’empilent sur écran étroit. Aucun formulaire, modal ou JavaScript spécifique n’est nécessaire. Le prefetch des destinations est désactivé : les éditeurs ne sont chargés qu’après le choix.

Le Carnet utilise son propre éditeur spécialisé, jamais un template libre du Campaign Studio. Sa campagne liée reste un canal de diffusion préparé ensuite, à partir du récit canonique et de sa coupure.

Le Comptoir est explicitement indiqué « à venir » : cette étape prépare l’orientation éditoriale, sans présenter comme disponible une section commerciale qui n’est pas encore implémentée.

## Tableau de production éditoriale

`/admin/newsletter` présente d’abord la prochaine édition et l’avance éditoriale,
puis les campagnes, l’audience avec ses consentements et enfin l’état technique.
Aucune visite ne crée de chapitre ou de campagne.

La prochaine édition est le premier Carnet DRAFT/READY dont la diffusion n’a pas
commencé : `publishedAt` vide et aucune livraison SENT/SENDING liée. Les dates
`earlyAccessAt` les plus anciennes passent en premier (y compris une échéance
manquée), puis les numéros croissants ; les Carnets sans date viennent ensuite.
Une édition QUEUED reste prochaine jusqu’au début de diffusion. Les diffusions
engagées et leurs éventuels échecs restent suivis dans les campagnes.

La réserve compte les Carnets READY répondant à ces mêmes critères : nombre / 2
= mois d’avance, avec les demi-mois affichés. La barre utilise un repère visuel
explicite de 3 mois (6 Carnets) ; le total affiché reste exact au-delà. Ce compte
n’exonère pas de valider les illustrations, emails et stocks de chaque édition.

La checklist dérive le nombre de mots de la coupure canonique, vérifie l’image et
son alt et relit Product/ProductVariant (stock disponible net des réservations).
Un Comptoir vide est valide. Le stock est celui lu au chargement ; la vérification
bloquante au moment de la programmation reste assurée par le moteur existant.

Les tests réussis sont lus dans les audits de la campagne explicitement liée
(édition principale, ou ancienne propriétaire de diffusion). Les nouveaux audits
contiennent la révision Carnet et la date de modification de campagne réellement
testées. Un test antérieur à une modification ne valide plus la checklist. Les
anciens audits sans versions utilisent leurs dates. « M’envoyer un test » appelle
l’action existante, protégée par authentification admin/MFA et contrôle de version,
vers l’adresse de test configurée ou l’adresse de l’admin ; il ne programme rien.

## Calendrier éditorial des Carnets

Route admin protégée : `/admin/carnets/calendrier?mois=YYYY-MM`, accessible depuis
les pages Carnets et Newsletter. Le mois par défaut est le mois civil de Paris.
La navigation précédente/suivante traverse les années (2000–2099). Une valeur
invalide revient au mois courant. Les bornes SQL suivent les changements d’heure
à Paris, pas le fuseau du serveur.

Un Carnet apparaît une seule fois dans le mois si sa newsletter ou sa publication
publique s’y trouve. Les deux dates restent visibles, même si l’une est hors du
mois : une newsletter du 29 novembre et sa publication du 13 décembre apparaissent
dans les deux vues mensuelles avec l’événement du mois signalé. Les dates d’un
brouillon sont explicitement prévisionnelles. Le clic ouvre l’édition du Carnet.
Les archives sont exclues. Les dix premiers Carnets sans aucun calendrier sont
présentés à part, avec leur nombre total et un accès à la liste complète.

Les états sont dérivés, sans nouvelle colonne en base :

- Brouillon : chapitre non validé ou document/coupure incomplet.
- Texte prêt : chapitre validé (READY ou ancien état de publication), extrait
  non vide et suite après la coupure.
- Prêt à envoyer : texte prêt, édition principale DRAFT, illustration avec alt,
  objet/preheader, Comptoir disponible (ou vide) et test de la version actuelle.
- Programmé : calendrier de diffusion engagé et campagne propriétaire QUEUED ou
  SENDING (ou diffusion déjà commencée), avant la date d’accès anticipé.
- Accès anticipé / Public : état de visibilité réel retourné par les règles
  existantes des Carnets, aux frontières exactes earlyAccessAt/publicAt. Une
  date sans propriétaire de diffusion ne rend pas le Carnet public.

Le stock Product/ProductVariant et les dernières preuves de test sont chargés en
lots, avec les mêmes règles de préparation que le tableau newsletter. Une baisse
ultérieure du stock ne rétrograde pas une diffusion déjà programmée ou publique ;
elle est signalée séparément. La programmation conserve ses contrôles bloquants.

La réserve affiche les textes réellement prêts non diffusés et dont l’accès n’est
pas déjà ouvert, ainsi que le sous-ensemble prêt à envoyer. Les brouillons,
archives et textes incomplets sont exclus. Le repère visuel est 6 à 10 épisodes ;
le total n’est jamais plafonné. L’équivalent en mois utilise 2 Carnets par mois.
Ce calendrier n’envoie et ne programme rien lors d’une visite.

## Organisation visuelle par arc

`/admin/carnets` ouvre la vue « Par arc ». La liste historique, ses filtres et sa
pagination restent accessibles avec `?vue=liste`. Le calendrier reste séparé.

Cette vue réutilise `arcTitle`, `arcPosition` et `arcTotal`. Le regroupement ignore
la casse, les espaces multiples et les différences Unicode de compatibilité ;
il ne fusionne pas des titres simplement ressemblants. Le titre affiché vient
du premier épisode. Les numéros d’arcs sont des repères dérivés de l’ordre des
premiers épisodes, sur l’ensemble de la bibliothèque, archives comprises. Ils
ne changent pas lors d’une recherche, d’un tri ou d’un changement de page. Ajouter
un épisode antérieur ou changer son arc peut changer ces repères : il ne s’agit
pas d’identifiants persistants. Les Carnets sans arc sont regroupés à part.

Huit groupes sont affichés par page. Un index léger de métadonnées permet de
regrouper 200+ épisodes sans charger tous les récits ; seuls les récits des arcs
de la page sont lus pour calculer leur progression. Les chapitres sont ordonnés
par position dans l’arc puis par numéro global. Les filtres réduisent les lignes
visibles mais la progression reste celle de l’arc complet, archives signalées.

Les états sont internes :

- Pas commencé : document narratif valide mais vide.
- En cours : document non vide, encore brouillon ou sans coupure complète.
- À compléter : document ancien invalide.
- Prêt : statut validé, extrait non vide et suite après la coupure. Cela ne valide
  pas les contrôles d’envoi email, de stock, d’illustration ou de test.
- Accès anticipé / Public : règles de visibilité existantes et dates atteintes ;
  `publishedAt` seul n’est pas une preuve de publication publique.
- Archivé : conservé dans le total de l’arc, exclu de sa progression.

La progression additionne les textes prêts, accès anticipés et chapitres publics,
sans doublon. Les compteurs Prêts/Publics/Accès anticipé restent séparés. Les
positions dupliquées, chapitres sans position, totaux divergents ou trop petits
sont signalés. Aucun emplacement n’est suggéré en présence de ces incohérences.
Les positions réellement vacantes proposent un formulaire prérempli : l’ouverture
ne crée aucun chapitre et ne réserve aucun numéro. Les six premières positions
vacantes sont affichées pour conserver une vue compacte.

Les titres existants sont proposés dans l’éditeur pour éviter les variantes de
saisie. Aucun objet CarnetArc ni migration n’est nécessaire pour cette organisation.
Un modèle dédié deviendrait préférable pour des arcs vides, des titres identiques
appartenant à des arcs différents, des renommages centralisés ou une numérotation
indépendante des épisodes. Aucune structure publique supplémentaire n’est imposée.
