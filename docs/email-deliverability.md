# Délivrabilité des emails Caldera

## Vérification du 20 octobre 2026

Aucun expéditeur ne peut garantir l'absence de classement en spam : la réputation, le destinataire et le contenu interviennent aussi. Les modifications ne contournent ni le consentement ni les filtres des messageries.

### DNS

L'enregistrement suivant a été ajouté dans OVH et vérifié sur `dns111.ovh.net` puis le résolveur public `1.1.1.1` :

```text
_dmarc.lesterresdecaldera.fr TXT "v=DMARC1; p=none; adkim=r; aspf=r"
```

C'est une politique initiale non bloquante, héritée par `news.lesterresdecaldera.fr`. Elle n'ordonne pas le rejet des messages usurpés. Aucun destinataire de rapports `rua` n'a été inventé. Passer ensuite à `quarantine` / `reject` seulement après vérification des sources légitimes et de leur alignement sur des messages réellement reçus.

Éléments existants conservés :

- SPF OVH à la racine : `v=spf1 include:mx.ovh.com -all`.
- MX OVH, utilisés pour recevoir les réponses.
- Clés DKIM `resend._domainkey` sur le domaine principal et `news`.
- Return-path `send` et `send.news` : CNAME vers `send.forge.rmta.net`, dont la cible publie le SPF et le MX. Ne pas les remplacer par d'anciennes instructions Amazon SES et ne pas ajouter de second SPF à la racine.

Contrôle sans secret :

```sh
dig @dns111.ovh.net _dmarc.lesterresdecaldera.fr TXT +short
dig @1.1.1.1 _dmarc.lesterresdecaldera.fr TXT +short
dig lesterresdecaldera.fr TXT +short
dig resend._domainkey.lesterresdecaldera.fr TXT +short
dig resend._domainkey.news.lesterresdecaldera.fr TXT +short
dig send.lesterresdecaldera.fr CNAME +short
dig send.news.lesterresdecaldera.fr CNAME +short
```

### Envoi et consentements

- HTML conservé, alternative texte et coordonnées de l'expéditeur dans tous les modèles partagés.
- Validation de l'enveloppe avant appel à Resend : destinataire unique, objet/entêtes sans injection CRLF, texte non vide, liste fermée d'entêtes. Les champs cachés non autorisés ne sont pas transmis.
- Désinscription en un clic pour les campagnes, emails de fidélisation et notifications stock. Aucun entête de liste ajouté aux emails de sécurité ou de commande.
- POST signé, sans connexion ni cookie, corps limité (256 octets URL-encoded, 2 Ko multipart), succès vide 200. GET ne modifie rien et affiche le parcours de confirmation existant. Les signatures newsletter et stock sont distinctes.
- Lien de suppression visible ajouté aux alertes stock.
- Les limites de fréquence, double opt-in, plafonds quotidiens et idempotence restent appliqués. Les enveloppes déjà figées pour un essai ne sont pas réécrites : les nouveaux entêtes concernent les nouvelles enveloppes.
- Le domaine `news` avec ouvertures/clics reste réservé aux destinataires dont le consentement de suivi est valide. Les autres envois utilisent le domaine sans suivi. Les tags techniques UUID/type servent uniquement à corréler la livraison ; ils n'activent pas l'analytics.

### Rebonds et plaintes

Le webhook `/api/webhooks/resend` doit recevoir, en plus des événements de mesure existants :

```text
email.bounced
email.complained
email.suppressed
```

La signature Svix reste obligatoire. Seuls les messages retrouvés dans une livraison locale peuvent modifier les files. Un rebond permanent, une plainte ou une suppression désinscrit le consentement concerné, neutralise les campagnes/relances et alertes stock en attente et bloque les nouvelles tentatives de la livraison refusée. Un événement ancien n'annule pas un consentement plus récent. Les rebonds transitoires n'entraînent pas de désinscription. Aucun diagnostic brut, IP ou adresse issue du payload n'est journalisé/conservé.

Ces retours opérationnels fonctionnent même lorsque `EMAIL_ENGAGEMENT_ENABLED=false` ; les ouvertures/clics restent conditionnés au flag et au consentement existants. La liste de suppression gérée par Resend reste complémentaire, notamment pour les emails immédiats de compte qui ne possèdent pas d'enregistrement de livraison local.

## Vérifications restantes côté production

- Confirmer dans Resend les trois abonnements webhook ci-dessus et les domaines vérifiés. Le code ne peut pas ajouter ces abonnements avec une clé limitée à l'envoi.
- Après rétablissement de PostgreSQL, vérifier la réception réelle sur Gmail/Outlook : `spf=pass`, `dkim=pass`, `dmarc=pass`, alignement du domaine et couverture DKIM des entêtes `List-Unsubscribe` / `List-Unsubscribe-Post` pour les emails de liste. Les DNS seuls ne prouvent pas la signature des messages.
- Au 20 octobre, le quota gratuit Neon dépassé empêche le parcours réel de réinitialisation du mot de passe. Ce correctif ne rétablit pas la base ; aucune offre payante n'est activée.
- Surveiller rebonds, plaintes et réputation (Google Postmaster lorsque le volume le permet). Éviter les listes achetées et les réactivations massives ; conserver les limites de cadence existantes.

## Tests

`email-deliverability.test.ts` couvre validation, signatures, limites et formats RFC 8058. `email-deliverability-db.test.ts` couvre la portée et l'idempotence des désinscriptions, retours Svix, arrêt des files, plaintes et consentement renouvelé. Les tests d'engagement vérifient aussi les entêtes sur les deux expéditeurs, avec/sans suivi. Les tests de modèles vérifient les coordonnées en HTML et texte. Tous s'exécutent sans envoyer de vrai mail.

Références : [Gmail](https://support.google.com/a/answer/81126?hl=en), [RFC 8058](https://www.rfc-editor.org/rfc/rfc8058.html), [Resend : désinscription](https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails), [rebonds](https://resend.com/docs/webhooks/emails/bounced), [plaintes](https://resend.com/docs/webhooks/emails/complained).
