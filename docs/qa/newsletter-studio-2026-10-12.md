# Studio newsletter Caldera — 12 octobre 2026

## Fonctionnalités livrées

- Parcours en trois étapes : paramètres, composition, vérification.
- Objet, préheader, titre et nom interne avec limites explicites.
- Cinq points de départ : page blanche, journal, sortie, réassort, sélection.
  Les modèles donnent des indications éditoriales à personnaliser, sans inventer
  de disponibilité, de promotion ou de date commerciale.
- Blocs texte, image, bouton, produit, séparateur et espacement ; 40 maximum.
- Réorganisation par glisser-déposer natif et flèches accessibles au clavier.
- Duplication/suppression de blocs, historique annuler/rétablir (50 étapes).
- Mise en forme texte : gras, italique, titres, listes, liens, Markdown sûr.
- Images par sélecteur de fichier ou dépôt ; JPEG/PNG/WebP, 4 Mo maximum,
  validation réelle du contenu et réencodage WebP par le stockage existant.
- Recherche dans les 200 produits réels publiés les plus récemment modifiés.
  Les produits de démonstration sont exclus. Le prix est un instantané visible
  à vérifier avant l’envoi ; aucune affirmation automatique de stock.
- Trois ambiances compatibles avec l’identité Caldera.
- Aperçus à 640 px et 375 px, redimensionnés dans l’espace disponible ; vue
  texte et téléchargement HTML. Même moteur que l’e-mail réellement envoyé.
- Checklist : titres, préheader conseillé, blocs, liens, textes alternatifs,
  taille HTML et pied de page. Refus serveur des documents incomplets ou
  dépassant 95 000 octets HTML avant mise en file.
- Audiences : tous les confirmés, confirmation depuis moins de 30 jours,
  confirmation depuis plus de 30 jours. Aucun import non consenti.
- Programmation jusqu’à 180 jours, avec conversion du fuseau du navigateur,
  cohérence heure locale/UTC vérifiée côté serveur et confirmation explicite.
- Annulation avec retour au brouillon avant la première tentative uniquement.
- Duplication complète d’une campagne en nouveau brouillon sans destinataires.
- Statistiques de délivrance, ouvertures/clics uniques : taux calculés uniquement
  sur les envois suivis avec consentement, sans créer de nouvelles permissions.
- Dates de départ éligible dans la liste des campagnes.

## Compatibilité et sécurité

Le document versionné est conservé dans la colonne texte existante, avec un
préfixe stable `CALDERA_NEWSLETTER_V1:`. Les anciennes campagnes Markdown
restent lisibles et éditables. Aucune migration de production ni dépendance
supplémentaire n’est nécessaire.

La conversion des fins de ligne des formulaires multipart a été rencontrée
pendant la recette et corrigée. Le parseur accepte également l’ancien marqueur
avec LF/CRLF pour éviter la perte d’un brouillon de recette.

Les Server Actions exigent une session administrateur avec MFA. Mutations
contrôlées, transactionnelles et auditées. Le HTML brut est neutralisé ; liens
HTTPS/pages locales uniquement pour les blocs ; images locales téléversées ou
assets, sans pixels distants fournis par un rédacteur. L’aperçu utilise une
iframe sandboxée sans scripts ni accès à l’origine. La CSP autorise les frames
locales uniquement dans l’administration, sans modifier le site public.

Les envois test et la programmation sont bloqués tant que le brouillon ouvert
comporte des modifications non enregistrées. Le retour de sauvegarde reste
visible après mise à jour du contenu.

La programmation ne retombe jamais sur un envoi immédiat si sa date est vide,
invalide, passée ou incohérente avec le fuseau sélectionné. L’annulation est
refusée si une tentative a commencé. L’audience est figée à la confirmation,
les désabonnements sont revérifiés avant chaque livraison. La file, les clés
d’idempotence et les limites existantes restent utilisées.

## Recette effectuée

Base PostgreSQL locale isolée sur 127.0.0.1:5435, serveur production local sur
localhost:3099. Resend, Stripe et Discord désactivés ; aucune campagne réelle
créée ou envoyée en production pendant les tests.

- `npm run test:newsletter` : 9 tests passés.
- `npm run test:newsletter:db` : 2 tests passés.
- `npm run test:admin:http` : 16 tests passés, dont sauvegarde multipart réelle,
  refus sans session, téléversement/réencodage image et refus d’une programmation
  incomplète sans mise en file.
- Build production et TypeScript : réussis.
- ESLint : réussi.
- Prettier : fichiers modifiés conformes. Le contrôle global signale encore
  38 fichiers préexistants hors de cette modification ; ils n’ont pas été
  reformatés dans cette livraison.
- Interface Chromium : modèle, saisie, duplication, déplacement par flèche,
  annulation d’une modification, sauvegarde et restitution après rechargement.
- Téléversement réel d’une image, sélection du produit de recette local et
  vérification de l’exclusion de son équivalent de démonstration.
- Lien incomplet : aperçu intact, diagnostic visible, correction puis sauvegarde.
- Protection d’un test sur brouillon non enregistré : refus visible.
- Programmation réelle locale au 13 octobre 2026 à 10 h 30 Europe/Paris : heure
  enregistrée et affichée identique ; annulation puis retour au brouillon.
- Aperçu mobile/desktop, export HTML déclenchant un téléchargement réel.
- Administration à 1280 px et 390 px : aucun débordement horizontal ; champs
  visibles étiquetés ; aucune erreur ou alerte de console pendant la recette.

## Limites explicites

- La réception respecte les quotas et délais anti-sollicitation existants :
  l’heure choisie est un début éligible, pas une promesse de livraison simultanée.
- L’aperçu navigateur ne remplace pas un test dans Gmail/Outlook/Apple Mail.
- Le glisser-déposer natif est implémenté ; la recette automatisée a exercé les
  flèches et le sélecteur de fichiers, pas un geste physique de drag-and-drop.
- Pas de test sur téléphone physique ni de suite multi-clients e-mail.
- Pas d’A/B testing, d’éditeur HTML libre ou de synchronisation Mailchimp :
  il s’agit d’un studio Caldera intégré, sans nouveau service payant.
