# Éditeur d’édition Carnet

## Workflow

`/admin/newsletter/nouvelle` → Créer un Carnet → Récit, Comptoir, Email, Diffusion, Vérification.

Le brouillon peut rester incomplet. Sauvegarder ne programme aucun email et ne rend pas le chapitre public. Pour programmer : récit prêt avec du texte avant/après une coupure unique, illustration avec alt, objet, preheader, produits sélectionnés éligibles, date entre une minute et 180 jours. Les longueurs 900–1100 / 250–400 sont uniquement éditoriales. Arc et Comptoir facultatifs.

Le test utilise la dernière version sauvegardée, vers EMAIL_TEST_RECIPIENT si configuré, sinon l’admin. Un brouillon sans diffusion active affiche un lien canonique ; il ne donne pas accès au récit avant programmation. Il ne faut pas confondre aperçu ouvert et contenu relu : les indicateurs d’ouverture des aperçus sont locaux et invalidés quand l’édition change.

## Sources

- CarnetChapter.content est la seule source du récit web et de l’extrait automatique.
- CarnetChapter.editionCampaignId désigne une campagne principale persistante dès la sauvegarde des champs email. Les anciens formulaires narratifs seuls ne créent aucune campagne.
- releaseCampaignId conserve sa fonction de propriétaire du calendrier de diffusion ; ce champ ne sert pas à identifier un brouillon.
- CarnetComptoirProduct contient les identifiants Product et leurs positions 0–2, sans attributs de style. Deux contraintes uniques et une contrainte CHECK imposent trois références distinctes maximum en base.
- Objet/preheader/date d’envoi sont dans NewsletterCampaign. Le formulaire enregistre atomiquement toutes les sections. La date publique est dérivée à +14 jours civils de Paris ; la programmation et le gel reprennent le service existant.
- Les produits doivent être actifs, non démonstratifs, dans une catégorie active, avec au moins une variante active disponible. Prix et quantités sont lus depuis ProductVariant. La recherche interroge le catalogue côté serveur, pas seulement les premiers résultats chargés.
- Le template global utilise le renderer newsletter de production et les cartes produit existantes. Les données produit sont figées dans carnetProducts à la programmation, puis l’enveloppe de chaque livraison est réutilisée pour les reprises idempotentes.

## Mode avancé

L’action explicite, confirmée, transforme une fois la dernière édition enregistrée en document Studio (image, extrait Markdown, CTA et produits). `carnetCustomized=true` rend ce snapshot indépendant. Le même NewsletterCampaignEditor est réutilisé. Il ne modifie jamais le récit web. La relation de la campagne principale ne peut pas être détachée ou réaffectée.

Les liens exacts vers le chapitre dans les blocs snapshot sont signés au rendu serveur, sans enregistrer de token dans le document éditable. Le calendrier initial reste celui du Carnet. Un retour explicite au format automatique est possible en brouillon et supprime la composition personnalisée après confirmation.

## Sécurité et sauvegarde

Chaque Server Action exige l’admin MFA. UUID, références, limites, dates et contenu sont validés côté serveur. Sauvegardes concurrentes : révision Carnet et horodatage campagne. Ordre des verrous campagne → chapitre identique au worker. Aucun envoi depuis le navigateur ; les identifiants transmis sont relus en base. Les tests/programmes refusent les références périmées.

AdminForm conserve les protections de navigation. Une copie de secours spécifique est stockée 24 h dans sessionStorage de l’onglet, proposée à la récupération après rechargement, sans secrets ni droits de diffusion. Aucun autosend. Les fichiers locaux ne sont pas persistés : ils doivent être sélectionnés à nouveau. L’upload et son réencodage utilisent le stockage existant.

## Migration et compatibilité

Migration additive `20261014000000_carnet_edition_workflow`. Les anciennes campagnes restent automatiques si elles référencent un chapitre, commerciales sinon. Aucun ancien document n’est converti automatiquement. Les anciennes données sans illustration peuvent continuer leur cycle historique ; les nouvelles éditions dédiées exigent leur illustration avant programmation.

Tests : carnets-edition.test.ts (rendu/échappement/coupure/snapshot), carnets-edition-db.test.ts (limites réelles, données Product, sauvegarde, test fournisseur simulé, snapshot, conflits, programmation, gel des prix, worker signé), admin-http.test.ts (MFA, actions, cinq sections, Studio et source inchangée), suites Carnets et newsletter existantes. Vérifications navigateur : réordonnancement, quatrième produit bloqué, sauvegarde, aperçus ordinateur/mobile, responsive, absence d’erreurs console.

## Sélection du Comptoir

Les trois emplacements disposent de Ajouter, Remplacer et Supprimer. Remplacer conserve la position et les autres produits même lorsque le Comptoir est complet. Les doublons sont refusés par la validation partagée client/serveur. L’ordre peut être changé par les poignées de glisser-déposer ou les boutons explicites Monter / Descendre. Les dépôts externes sont ignorés.

La recherche renvoie aussi les produits sélectionnés devenus indisponibles, pour conserver une alerte lisible. Les réponses fraîches remplacent les valeurs initiales de prix/stock ; l’actualisation intervient lors d’une recherche, d’un changement de sélection, au retour de focus dans l’onglet et via Actualiser le stock. Une actualisation commerciale ne marque pas le récit comme modifié, mais invalide les indicateurs d’ouverture des aperçus. La programmation recontrôle les références dans sa transaction ; un produit inactif, sans variante active ou sans stock disponible bloque la mise en file sans créer de livraison.

## Vérification avant le départ

L’étape Vérification calcule les contrôles depuis le chapitre canonique, sa campagne et les références Product existantes. `carnetChecklist` complète `carnetReadiness` et réutilise les validations de composition du Campaign Studio. La même checklist bloque la programmation côté serveur, y compris depuis le Studio.

- Bloquants : chapitre prêt et enregistré, texte avant/après la coupure, adresse et accès anticipé signable, calendrier public à J+14, illustration et alt, trois produits maximum sans doublon, disponibilité après réservations, CTA récit vers ce chapitre, objet/preheader, preuve du test de l’email actuel.
- Conseil : extrait non vide hors de 250–400 mots. Les relectures ordinateur/mobile sont indicatives. Le Comptoir peut être vide.
- J+14 signifie quatorze jours calendaires à la même heure de Paris, avec prise en compte du changement d’heure. L’accès anticipé est vérifié avec le mécanisme signé existant à sa date d’ouverture ; ce contrôle ne rend pas le chapitre public avant cette date.
- Un test n’est enregistré qu’après acceptation par le fournisseur d’email. Son empreinte SHA-256 couvre récit, métadonnées éditoriales, illustration/alt, objet/preheader, composition avancée et sélection ordonnée des produits (nom, image, adresse, prix). Une modification exige un nouveau test. Les anciennes preuves versionnées restent acceptées seulement pour leur révision et leur campagne exactes.
- Programmer, modifier seulement la date ou faire varier la quantité en stock ne modifie pas le contenu testé. Le stock reste vérifié indépendamment au moment de programmer. Une campagne engagée utilise son snapshot testé.
- Les boutons de correction rejoignent les champs concernés ; le mode avancé renvoie au Studio. Une modification non enregistrée interdit test et programmation.

Aucune migration ni nouvelle variable d’environnement. Les journaux d’audit conservent uniquement l’empreinte et les versions, sans recopier le récit ni les liens signés. Les tests du fournisseur sont simulés ; aucun email QA n’est envoyé aux abonnés.
