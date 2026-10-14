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
