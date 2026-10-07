# Double authentification de l’administration

## Mise en service

1. Confirmer que la connexion PostgreSQL vise la base de **production** utilisée par le déploiement Vercel. Ne jamais utiliser une ancienne copie locale comme cible.
2. Sauvegarder cette base, puis appliquer `prisma migrate deploy` avec la connexion de production fournie hors Git.
3. Déployer le code MFA. À la première connexion, chaque admin doit enregistrer une application TOTP et conserver les codes de secours hors ligne. Les pages et actions admin restent fermées tant que l’enrôlement n’est pas terminé.
4. Vérifier sur le déploiement que le mot de passe seul mène à `/admin/second-facteur`, qu’un code TOTP ouvre l’administration et que les anciennes sessions sont révoquées.

## Récupération normale

Si l’application d’authentification est indisponible, utiliser un **code de secours à usage unique** sur `/admin/second-facteur`. Une fois connecté, ouvrir `/admin/securite` pour remplacer l’application ou renouveler les codes de secours. Le remplacement exige aussi le mot de passe actuel, ferme toutes les sessions et impose un nouvel enrôlement.

## Perte de l’application et de tous les codes

Il n’existe pas de lien de réinitialisation MFA par courriel ni de route cachée. Le propriétaire doit faire vérifier son identité par un autre responsable habilité, avec une procédure documentée hors du site. Une personne ayant accès en écriture à la **bonne base de production** peut ensuite, dans une transaction, supprimer les sessions et la ligne `AdminTwoFactor` du compte concerné, puis remettre `AdminUser.twoFactorEnabled` à `false`. Consigner l’intervention, faire renouveler le mot de passe et imposer immédiatement un nouvel enrôlement. Ne jamais transmettre les codes de secours ou les secrets TOTP par messagerie.
