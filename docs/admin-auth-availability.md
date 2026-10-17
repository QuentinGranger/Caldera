# Indisponibilité de l’authentification admin

La connexion et la récupération de mot de passe passent d’abord par les limites
persistées dans PostgreSQL. La récupération doit ensuite lire le compte et
enregistrer un jeton avant tout appel à Resend.

Si le stockage des limites échoue, les deux formulaires refusent l’opération
avec le même message d’indisponibilité pour toute adresse. Aucune authentification
n’est autorisée et aucun envoi d’email n’est annoncé. La réponse habituelle de
récupération reste identique pour les comptes existants, inconnus, désactivés ou
limités lorsque la base fonctionne.

Le journal `admin / login_storage_unavailable` ne contient ni adresse, ni mot de
passe, ni jeton, ni message brut du fournisseur. Les codes TOTP, permissions et
sessions restent soumis aux vérifications existantes.

## Incident du 17 octobre 2026

Les logs Vercel ont signalé un quota Neon dépassé (`53000`, Prisma `P2039`).
Le contrôle `/api/health` répond 503, alors que les formulaires publics répondent 200. La correction du message ne débloque pas le quota. L’utilisateur a choisi
de conserver l’offre gratuite ; aucun changement de facturation n’est inclus.

## Vérification

- `tests/admin-auth-outage.test.ts` simule une panne du stockage des limites,
  contrôle les refus pour plusieurs adresses et l’absence de secrets dans les
  erreurs et journaux.
- Les tests existants admin, réinitialisation et HTTP couvrent le fonctionnement
  normal, les limites et les jetons.
- Vérifier aussi les deux actions HTTP contre une base locale indisponible :
  état `success: false`, même message d’indisponibilité, aucun envoi.

Après le déblocage Neon, vérifier une connexion avec TOTP et demander un nouveau
lien de réinitialisation. La réception réelle d’un email ne peut pas être validée
tant que sa création est bloquée en amont par PostgreSQL.
