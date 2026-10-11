# E-mails automatiques Caldera

## Cadence et audience

| Scénario | Déclencheur et temporalité | Condition |
| --- | --- | --- |
| Bienvenue | Après confirmation newsletter, au prochain traitement ; le formulaire déclenche aussi le traitement après réponse | Adresse confirmée, pas d’historique réenvoyé à l’installation |
| Création de compte | L’e-mail de vérification accueille et explique favoris, alertes et commandes | Service du compte, sans inscription commerciale implicite |
| Panier abandonné | J+1, puis dernier rappel J+4 ; expiration J+7 | Compte vérifié associé au panier ou adresse renseignée au checkout, newsletter confirmée et consentement personnalisé ; aucun achat/paiement intervenu |
| Retour en stock demandé | Prochain traitement stock (horaire, quotidien en secours) | Alerte confirmée pour cette version, un seul envoi |
| Nouveauté disponible | Première semaine suivant publication, regroupement de 3 produits | Produit réel publié et en stock, marqué Nouveauté ; sélection affinée par achats/favoris uniquement avec consentement personnalisé |
| Après achat | J+3 à J+10 après livraison confirmée | Commande payée, pas de retour/remboursement ; contact + recommandations si disponibles |
| Compléments | J+14 à J+30 après livraison confirmée | 3 suggestions disponibles au maximum, produits déjà achetés exclus |
| Favori de retour | Observation réelle de 0 vers stock positif ; fenêtre 24 h | Favori actuel, pas d’alerte stock spécifique faisant doublon |
| Favori — dernières pièces | Stock disponible 1 à 3 et seuil configuré respecté | Favori actuel, une seule fois par cycle de stock ; quantité revérifiée avant envoi |
| Favori — prix modifié | Après changement observé | Préparé, désactivé par défaut (`LIFECYCLE_PRICE_ALERTS_ENABLED=false`) |
| Inactivité | J+75 à J+105 depuis le dernier achat | Vraies nouveautés ou réassorts pertinents disponibles ; une fois pour ce dernier achat |

Les délais sont des fenêtres d’éligibilité, pas une heure garantie. Le workflow GitHub Actions horaire traite des lots bornés : 20 abonnés par passage avec curseur circulaire, 500 variantes disponibles et 500 épuisées maximum observées par passage ; cinq envois par passage, plafond global 50 nouvelles tentatives sur 24 h. Ces limites sont adaptées au lancement ; les relever ou paginer l’observation avant un catalogue dépassant ces tailles. La baseline ne génère jamais de réassort rétroactif.

Un message automatique commercial au maximum tous les trois jours et trois sur trente jours. Les premières tentatives des campagnes newsletter entrent dans ce calcul ; une campagne est aussi différée après un automatisme récent. Une alerte stock demandée récemment notifiée reporte les messages commerciaux. Transactionnel (paiement, livraison, retours, sécurité) indépendant. Les rappels peuvent donc être différés ou expirer plutôt que sursolliciter. Pas de réduction inventée, pas de pixel, pas d’historique de navigation.

## Consentement et admin

- Newsletter : double opt-in existant obligatoire. Option personnalisée distincte, décochée par défaut ; aucun ancien abonné n’est automatiquement opté pour le suivi de panier/favoris/achats.
- Compte → Profil → Vos e-mails Caldera : activer/désactiver les communications personnalisées. La désinscription commerciale globale arrête newsletters et automatismes, mais conserve les messages indispensables et alertes stock explicitement demandées.
- Admin → Newsletter : état de configuration, cadence et trente derniers événements ; aucun bouton d’envoi public.
- Tags administrés : `sleeves`, `penny-sleeves`, `top-loaders`, `protection-etb`, `deck-box`. Les boosters recommandés appartiennent à la même extension que l’achat. Vérifier dimensions et compatibilité dans chaque fiche, jamais déduire une compatibilité du seul nom.
- Une commande doit être marquée **livrée** avec `deliveredAt` pour lancer les scénarios post-achat. Aucune date de livraison n’est devinée depuis l’expédition.

## Exploitation / sécurité

`EMAILS_ENABLED=true`, fournisseur/expéditeur existants valides, `LIFECYCLE_EMAILS_ENABLED=true` et `LIFECYCLE_CRON_SECRET` requis côté Vercel et dans les secrets GitHub Actions. Le workflow `.github/workflows/lifecycle-emails.yml` appelle `/api/cron/lifecycle` à `15 * * * *` avec ce secret dédié ; GitHub peut retarder une exécution et désactive les planifications de dépôts publics inactifs après 60 jours. Un cron Vercel quotidien à `15 5 * * *` sert de secours et reste compatible Hobby. La route accepte également `CRON_SECRET` pour le passage quotidien Vercel ; le secret dédié n’autorise aucun autre endpoint. Les annonces de produits sont suspendues en mode catalogue démo ; le bienvenue reste possible. Le traitement des alertes stock est réutilisé, sans réinscription automatique.

Migration additive `20261011110000_add_lifecycle_emails` à appliquer avant le déploiement ; aucun contenu de démonstration ni destinataire fictif en production. Le Runtime démarre à l’installation pour ignorer les anciennes annonces. Reprise panier : lien signé, sept jours maximum, jeton en fragment (pas dans les logs/Referer), formulaire POST avec contrôle serveur, limite de débit, reconstruction des seules références disponibles aux prix actuels. Aucun accès au compte, adresse, commande ou paiement ; un panier existant n’est pas écrasé.

Outbox à bail atomique, clés uniques par événement/destinataire, enveloppe figée et clé d’idempotence fournisseur stable. Cinq tentatives maximum et fenêtre de reprise inférieure à 24 h. Désinscription et pertinence revérifiées avant envoi. Codes d’erreur contrôlés sans destinataire ni secret dans les logs. Enveloppes supprimées après 30 jours ; identifiants d’événements conservés pour empêcher les doublons.
