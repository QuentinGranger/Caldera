# Merchandising du lancement

## Administration

Dans **Produits → Informations**, « Sélection du moment » utilise le champ existant `featured`. Les trois cases « Pour commencer », « Pour collectionner » et « À garder scellé » utilisent les tags existants, avec des slugs stables. Les tags libres restent disponibles ; le formulaire sépare les deux usages. Décocher retire le produit du parcours, dépublier le retire du site. La catégorie, le jeu et l’extension doivent rester actifs.

Choisir les parcours d’après le contenu réel du produit. Un produit peut appartenir à plusieurs parcours. « À garder scellé » refuse les cartes à l’unité, accessoires et formats non scellés, côté serveur également. Aucune sélection ne promet de plus-value ni de carte précise dans un booster aléatoire. Le système n’attribue pas automatiquement une recommandation commerciale à tous les produits d’un même format.

## Règles automatiques

- **Nouveauté de la semaine** : choix éditorial `newArrival`, publication dans les 7 derniers jours glissants, date non future, au moins une variante active avec prix positif et stock disponible. La publication n’est pas la date de sortie de l’extension.
- **Derniers exemplaires** : au moins une variante active et achetable à son seuil de stock faible ou en dessous ; aucune variante active au-dessus de son seuil. Les réservations sont déduites du stock.
- **Retour en stock** : mouvement `RESTOCK` datant de moins de 30 jours, stock physique précédent nul, ajout positif, effectué après publication ; une entrée d’inventaire antérieure prouve que cette variante avait déjà du stock. La variante doit encore être active, payante et disponible. Un tag « reassort », un premier approvisionnement ou une correction manuelle ne suffisent pas. Sans historique documenté, aucun badge de retour n’est inventé. Cela décrit le retour d’une variante, pas une rupture de toutes les langues du produit.

Les trois rayons automatiques excluent les produits `isDemonstration`, les précommandes et le mode public `CATALOG_DEMO_MODE=1`. Les sélections éditoriales peuvent montrer des exemples, dont les fiches conservent leur mention explicite et l’achat désactivé.

## Parcours côté site

L’accueil propose les trois intentions, avec des conseils et des guides existants. Chaque sélection administrée dispose de sa page `/selections/[slug]` et des mêmes filtres, tris et variantes que le catalogue. Les liens vers une sélection apparaissent uniquement si elle contient des produits publiés. Sans sélection, les guides restent utiles et accessibles. Dans le catalogue, l’aide se déplie à la demande pour garder les produits visibles rapidement.

Les rayons de l’accueil sont masqués quand ils sont vides. Chaque produit y apparaît une seule fois, selon la priorité sélection éditoriale, nouveauté, retour, derniers exemplaires. Seuls les produits effectivement affichés occupent une place dans cette déduplication. Les choix éditoriaux privilégient le stock disponible dans leur aperçu.

Une sélection devenue vide renvoie au catalogue ; un slug inconnu répond 404. Les sélections sont `noindex, follow` avec leur propre URL canonique, sans créer des centaines de pages SEO à partir de tags libres. Les écritures passent par les protections admin existantes et invalident également les pages de sélection. Aucun changement de schéma, migration ou service tiers n’est nécessaire.

## Vérification

`tests/merchandising-db.test.ts` couvre les dates, stocks, variantes, exemples, historique des retours, affectation/retrait admin et cohérence liste/facettes. `tests/merchandising-http.test.ts` couvre les guides, le rendu d’une sélection persistée, les filtres, les métadonnées et les sélections vides/inconnues. `tests/home.test.ts` couvre aussi la déduplication après limitation des rayons.
