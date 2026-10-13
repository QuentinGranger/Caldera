# Les Carnets de Caldera — fondation éditoriale

> Ce document décrit les étapes de fondation. Pour le fonctionnement actuel de diffusion, les accès et le calendrier automatique, consultez [le cycle de publication](carnets-release-cycle.md).

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

Pas de route publique de lecture, accès abonné privé, publication J+14, transformation en campagne, envoi, segmentation, tracking, SEO final ni bloc Comptoir. Une campagne peut désormais référencer un Carnet ; la consommation automatique de ses dérivés reste une prochaine étape.

## Métadonnées éditoriales et référence newsletter

Migration additive `20261013160000_extend_carnet_editorial_metadata` :

- `CarnetChapter.illustrationUrl` (500), `illustrationAlt` (300), `location` (200), tous nullable.
- `earlyAccessAt`, `publicAt`, `publishedAt` : `DateTime?`. Les dates prévues sont facultatives et indépendantes de la programmation d'un email. `publishedAt` est réservé à la première mise à disposition effective, anticipée ou publique, par le futur service de publication. Il n'est pas modifiable par les formulaires.
- `EARLY_ACCESS` et `PUBLIC` sont prévus dans l'enum, mais aucune action actuelle ne permet de les activer. Leur consultation admin reste possible ; leur édition attend le service de publication. Une adresse ayant un `publishedAt` ne peut plus être changée par une sauvegarde de brouillon, y compris après archivage/restauration.
- `NewsletterCampaign.chapterId String? @db.Uuid`, relation facultative vers le Carnet, `onDelete: SetNull`, `onUpdate: Cascade`, index `chapterId`.
- Index Carnets `(status, earlyAccessAt)` et `(status, publicAt)`.
- Contraintes PostgreSQL : dates ordonnées lorsqu'elles sont toutes deux renseignées, illustration et texte alternatif cohérents. Le lieu reste un texte libre ; l'arc conserve ses trois champs, sans modèles géographiques supplémentaires.

L'admin accepte les heures civiles de Paris (2000–2099), les convertit en UTC et refuse les heures inexistantes ou doubles du changement d'heure. Le fuseau du navigateur ou du serveur ne change pas leur interprétation. Les dates restent préparatoires : aucun accès ou ordonnanceur n'est activé.

Les illustrations passent par `GameLogoField`, désormais paramétrable (nom et libellé), et par `imageStorage` existant. JPEG/PNG/WebP, 4 Mo maximum ; normalisation WebP et route `/media` inchangées. Un fichier créé lors d'une sauvegarde échouée est nettoyé. Retirer une référence ne détruit pas son fichier, car une autre page peut le réutiliser.

Dans les paramètres d'une campagne, le Carnet est une référence facultative. Le sélecteur présente les 200 derniers Carnets non archivés et conserve la référence déjà enregistrée, même archivée ou plus ancienne. Depuis n'importe quel Carnet, « Préparer une campagne liée » ouvre une campagne avec sa référence et ses titres préremplis, sans copier le récit. Ce chemin permet aussi de sélectionner un ancien Carnet au-delà des 200 derniers.

La duplication d'une campagne conserve le même `chapterId` et ne crée aucun chapitre. Modifier ou supprimer une campagne ne modifie pas le récit. Les campagnes mises en file restent non modifiables ; la référence n'est pas consultée par le moteur d'envoi dans cette étape. Les enveloppes d'emails existantes restent indépendantes des corrections ultérieures du Carnet.

Une valeur vide détache explicitement la campagne. Un ancien formulaire sans `chapterId` conserve la référence existante. De même, les anciens formulaires Carnets sans les nouveaux champs conservent les métadonnées déjà enregistrées. Les campagnes historiques obtiennent `chapterId = null`, sans réécriture du contenu.

Tests complémentaires : dates/heure d'été, métadonnées, image normalisée et texte alternatif, relation facultative, copie et détachement, indépendance des suppressions, `SET NULL`, formulaires historiques et parcours HTTP réel. Aucune nouvelle dépendance.
