# Carnets — cycle de diffusion

## Architecture explicitée avant implémentation

1. **Diagnostic** : récit JSON canonique avec coupure ; dates préparatoires existantes ; campagnes, livraisons, consentement et quotas existants. Pas de route publique auparavant.
2. **États** : DRAFT/READY/ARCHIVED éditoriaux. EARLY_ACCESS/PUBLIC historiques acceptés, jamais écrits par un cron. L’état temporel est dérivé à chaque requête.
3. **Programmation** : la campagne de première diffusion est identifiée par `releaseCampaignId`. Programmer active ses dates. Annuler avant toute tentative détache le calendrier ; reprogrammer le recalcule. La première prise en charge d’une livraison, après les reports anti-sollicitation, fige les dates dans la même transaction que `firstAttemptAt`. Une tentative échouée les laisse figées. Les promotions ultérieures du même chapitre conservent le premier calendrier.
4. **Token** : `v1.<publicAt en millisecondes>.<HMAC SHA256 hex>`. Sous-clé dérivée de BETTER_AUTH_SECRET via `caldera:carnets:early-access:v1` ; signature sur version, UUID chapitre, earlyAccessAt et publicAt. Aucun identifiant d’abonné ni donnée personnelle. Dates modifiées = anciens tokens invalides. Comparaison timingSafeEqual ; secret absent = refus fermé. Pas de nouveau secret.
5. **Serveur** : projection sans content, état/autorisation, puis lecture du récit dans une transaction RepeatableRead. Aucune API de lecture parallèle. Le JSON canonique est validé avant son rendu HTML échappé.
6. **Route** : une `/univers/carnets/[slug]`. DRAFT, ARCHIVED ou dates seulement préparatoires : 404. Chapitre programmé : portail sans récit. Pendant l’avant-première : token valide ou portail. À publicAt : lecture publique, vieux liens redirigés vers l’URL propre. Une restauration de chapitre déjà diffusé rétablit READY et conserve les dates. Si le worker n’a jamais tourné mais que publicAt est passé, l’archivage reste disponible et enregistre cette première publication publique ; aucun envoi n’est requis pour administrer le récit.
7. **SEO** : description factuelle sans extrait privé ; canonical propre ; noindex avant publication, index/follow ensuite (le catalogue démo reste non indexé ; les vrais récits éditoriaux suivent leur propre calendrier). Aucun récit réservé dans les metadata.
8. **Sitemap** : même sélection READY/non-archivé + cycle actif + publicAt <= now pour archives, navigation et sitemap content. Archive elle-même ajoutée au sitemap seulement si non vide. Un lien depuis /univers apparaît lorsque des Carnets sont publics.
9. **Cache** : force-dynamic/connection, requêtes Prisma sans cache persistant ; routes Carnets private/no-store, sitemap content no-store. Pas de cron/redeploy nécessaire. Les liens Carnets désactivent le prefetch ; DeadlineRefresh actualise une page déjà ouverte à la prochaine frontière, et au retour de focus. Le cron reste nécessaire pour envoyer les emails, pas pour rendre public.
10. **Fuseau** : UTC en base, Paris en admin. +14 jours civils Paris conserve heures, minutes, secondes et millisecondes ; 335/336/337 heures selon DST. Heures cibles ambiguës/inexistantes refusées explicitement. Immédiat : heure serveur du premier claim ; programmé : heure prévue conservée malgré les retards de livraison. Si un traitement immédiat arrive après que le chapitre est déjà public, il ne repousse pas sa date publique. Annuler un chapitre déjà public est refusé.
11. **Nouveaux fichiers** : access.ts, public.ts, campaign.ts, routes Carnets/archives/styles/DeadlineRefresh, CarnetDiffusion, admin/errors et tests release.
12. **Modifications** : schéma, services campagne/worker, éditeurs et pages admin, dates/actions Carnets, rendu email, sitemap, proxy et journalisation Next.
13. **Migration** : 20261013200000_carnet_release_cycle, additive : releaseCampaignId unique + FK SET NULL, scheduledAt, sendImmediately. Aucune réécriture des récits ou campagnes historiques, aucun envoi déclenché par la migration.
14. **Tests** : frontières exactes, tokens altérés/étrangers/expirés, brouillons/archives, HTML/RSC sans récit non autorisé, sitemap/navigation, vrai passage de l’échéance avec le même serveur compilé ; programmation/reprogrammation, gel au premier essai, retry identique, newsletters classiques, MFA/actions admin, DST.
15. **Risques** : le lien porteur peut être partagé ; une rotation BETTER_AUTH_SECRET invalide les liens privés ; quotas et anti-sollicitation étalent la réception. L’indexation Google reste externe à Caldera.

## Source narrative et email

Les campagnes avec chapterId ignorent leurs blocs classiques pour l’envoi : titre, extrait et CTA proviennent du Carnet enregistré. L’éditeur indique ce comportement et utilise le même rendu pour l’aperçu. La campagne conserve uniquement la référence. L’enveloppe de livraison est ensuite figée pour garantir l’idempotence, comme auparavant ; elle contient uniquement l’extrait, jamais le récit complet. Les campagnes sans Carnet suivent leur chemin existant.

Le récit est verrouillé dès programmation pour éviter des extraits différents au sein du même envoi. Il redevient modifiable après annulation avant la première tentative. Les dates et le récit restent verrouillés ensuite ; l’archivage demeure réversible. Un email de test en brouillon pointe vers l’URL propre, encore indisponible tant que la diffusion n’est pas activée. L’envoi effectif reçoit le token automatiquement après gel du calendrier.

## Confidentialité et exploitation

Referrer-Policy no-referrer. Analytics et Sentry existants suppriment les paramètres sensibles ; les requêtes Carnets sont exclues du journal de développement Next. Ne jamais copier un token réel dans un rapport. Les tests utilisent PostgreSQL local et un fournisseur simulé, sans envoi réel aux abonnés et sans fixture éditoriale en production.

La migration doit précéder le déploiement. Aucun nouveau secret, dépendance ou tâche cron n’est requis. Pour publier : enregistrer un Carnet prêt avec sa coupure, créer sa campagne liée, enregistrer et programmer l’audience confirmée. Les dates, liens d’accès et publication publique sont alors gérés automatiquement.
