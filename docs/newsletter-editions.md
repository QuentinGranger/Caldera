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
