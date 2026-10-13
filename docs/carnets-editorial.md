# Les Carnets de Caldera — fondation éditoriale

## Source unique

`CarnetChapter` est indépendant de `NewsletterCampaign`. Le seul champ narratif persistant est `content Json`. Aucun texte complet ou extrait n'est stocké séparément. Le titre, le numéro, le slug et l'arc sont des métadonnées.

Format versionné exact :

```json
{
  "version": 1,
  "document": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [{ "type": "text", "text": "Le lac se tut." }]
      },
      { "type": "newsletterCut" },
      {
        "type": "paragraph",
        "content": [{ "type": "text", "text": "Puis la route reparut." }]
      }
    ]
  }
}
```

La coupure est un nœud atomique à la racine du document Tiptap. Elle suit les modifications du récit, sans index de caractères ni champ de coupure désynchronisable. Les commandes de placement utilisent un index de bloc transitoire ; cet index n'est jamais sauvegardé.

`deriveCarnet` produit texte, HTML échappé et nombre de mots pour le récit entier et les blocs avant la coupure. Le marqueur est toujours exclu. Sans coupure, `excerpt` vaut `null`, y compris pour un ancien document ; le chapitre complet n'est jamais un extrait de secours.

## Administration

- `/admin/carnets` : recherche titre/numéro/arc/slug, filtres par état, tri et pagination de 25 lignes.
- `/admin/carnets/nouveau` : numéro proposé, titre, slug générable et modifiable, arc facultatif, récit unique.
- `/admin/carnets/[id]` : édition, aperçu complet/extrait, compteurs, coupure déplaçable/supprimable, archivage et restauration.
- Formatage volontairement limité : paragraphes, gras, italique, intertitres h2/h3, citations de paragraphes et retours à la ligne.
- Une seule coupure, au niveau racine ; le serveur et l'éditeur refusent les documents non conformes.
- Avertissements de longueur : 900–1 100 mots pour le chapitre, 250–400 pour l'extrait. Aucune de ces recommandations ne bloque une sauvegarde.
- `DRAFT` autorise un récit incomplet. `READY` exige du texte avant et après une coupure ; il signifie seulement « prêt éditorialement ». `ARCHIVED` conserve le document ; restauration vers `DRAFT`.
- Le slug d'un Carnet enregistré reste stable quand le titre change. Un changement volontaire de slug reste possible avant la future publication.
- URL préparée : `/univers/carnets/{slug}` ; label du CTA : **Continuer l’expédition**. L'aperçu montre un bouton désactivé, car la route de lecture n'est pas encore implémentée.

## Sécurité et concurrence

Toutes les lectures et Server Actions exigent l'authentification admin existante, avec MFA. Les mutations vérifient à nouveau le rôle actif dans la transaction. Validation serveur par liste blanche et schéma JSON fermé après normalisation ; aucun HTML arbitraire, lien, image, CSS ou contenu intégré n'est accepté. Les fragments textuels sont échappés lors du rendu.

Bornes techniques : 100 000 caractères de JSON, 500 blocs racine, 10 000 fragments inline, titre de 200 caractères, slug de 120. Elles protègent l'éditeur et ne remplacent pas les recommandations de longueur.

Numéro et slug uniques en base. Verrou de ligne et compteur `revision` empêchent l'écrasement silencieux de modifications concurrentes. Les actions sont auditées sans recopier le récit dans les logs. L'archivage remplace la suppression destructive.

## Migration et dépendances

Appliquer `20261013130000_add_carnet_chapters` avant de servir le nouveau code. Migration additive : enum, table, index, contraintes, relation vers `AdminUser` ; aucune donnée existante n'est réécrite. Le lien `createdBy` empêche la suppression d'un administrateur auteur tant que ses Carnets lui sont associés.

L'éditeur réutilise les dépendances Tiptap présentes. `@tiptap/pm` est déclaré directement car le contrôle des transactions l'importe explicitement ; aucune seconde bibliothèque d'édition n'est ajoutée.

## Vérifications

- `npm run test:carnets` : 8 tests couvrant extraction, modification avant/après, déplacement/suppression, unicité de coupure, compteurs, rendus sans marqueur, slug/CTA, ancien document et validation/XSS.
- `npm run test:carnets:db` sur PostgreSQL local : création/rechargement, unicité, conflit, concurrence réelle, archivage/restauration et audit.
- `npm run test:admin:http` sur serveur local : routes protégées, actions réelles avec MFA, contrôle d'origine, sauvegarde et refus d'un second champ narratif.
- `npm run test:newsletter` et `npm run test:newsletter:db` : compatibilité du studio et du moteur de diffusion existants, avec fournisseur de test uniquement.
- Recette navigateur : A/B/C/coupure/D/E, modification de B puis E, déplacement après D, retrait/réinsertion, sauvegarde et restauration. Les courts exemples de recette restent exclusivement dans la base locale.

## Étapes suivantes, volontairement absentes

Pas de route publique de lecture, accès abonné privé, publication J+14, transformation en campagne, envoi, segmentation, tracking, SEO final ni bloc Comptoir. Une future campagne pourra référencer le Carnet et consommer ses dérivés sans ajouter une deuxième source éditable.
