# Plan Stripe — Les Terres de Caldera

Plan adapté à une boutique de produits physiques de collection, paiements ponctuels EUR, checkout invité Next.js déjà développé et inventaire PostgreSQL. Il est établi depuis les compétences officielles `stripe-best-practices` et les documents Stripe actuels. **Il n’a pas été généré par `stripe_implementation_planner`** : l’app Stripe demandée n’est pas proposée par le catalogue accessible dans cette session, et l’outil n’est pas exposé. Le repli demandé `npx skills add https://docs.stripe.com --agent codex --yes` a installé dix compétences locales, avec `skills-lock.json`.

## 1. Payments : phase 8 implémentée

Conserver PaymentIntent + Payment Element : la boutique possède son propre état CheckoutSession et l’utilisateur demande explicitement cette intégration. Le choix courant par défaut de Stripe est Checkout Sessions, y compris avec UI embarquée ; la maîtrise indépendante de la commande/réservation justifie ici PaymentIntent. Pas de migration vers une page hébergée ni vers Charges/Card Element.

Utiliser un sandbox de développement séparé, avec clés test serveur/publique du même environnement et webhook signé. Clé restreinte recommandée avec les permissions PaymentIntents nécessaires ; aucune clé dans le code. SDK Node instancié, version API du SDK épinglé, méthodes dynamiques configurées dans le Dashboard. Autorisation des domaines Stripe/Link dans la CSP avec nonce par réponse Next.js. [Références de paiement](https://docs.stripe.com/payments/paymentintents/lifecycle), [sécurité](https://docs.stripe.com/security/guide).

L’ordre métier est : validation serveur fraîche → Order et snapshots → réservation atomique → PaymentIntent idempotent → confirmation Payment Element → webhook → consommation définitive. Le montant vient de la commande, jamais du client ; aucune adresse ni email dans les metadata. Succès, processing, échec, annulation et requires_action sont traités. Les doublons et retours tardifs ne peuvent dégrader PAID. Les incohérences passent en revue manuelle.

Recette : concurrence réelle PostgreSQL, répétitions de requêtes, crash réseau, expiration, montants divergents, retours falsifiés, puis transactions Stripe TEST de succès/refus/3DS dès disponibilité des clés. La recette serveur avec le sandbox a validé succès, refus et déclenchement requires_action via les vrais webhooks ; le formulaire navigateur et le défi 3DS complet restent à vérifier. Les wallets ne sont pas promis sans tests navigateur/domaine.

## 2. Tax : préparation, pas d’activation dans cette phase

Informations nécessaires avant de modifier les montants : établissement du vendeur, pays desservis, immatriculations fiscales effectivement actives, prix exprimés HT ou TTC, classification fiscale des cartes/coffrets/accessoires, traitement de la livraison et ventes éventuelles B2B. Ces choix ne se déduisent pas des seuls pays de livraison FR/BE de démonstration.

Après validation de ces paramètres, calculer la taxe côté serveur avant le dernier récapitulatif, faire revalider tout total modifié, puis figer détail fiscal et montant dans la commande. L’intégration simplifiée lie une Tax Calculation au PaymentIntent et enregistre les transactions fiscales après paiement. Tester `taxability_reason`, notamment `not_collecting`, et vérifier les immatriculations du même sandbox. Ne pas inventer de code fiscal ni supposer que zéro signifie exonération. Aucune inscription fiscale n’est créée automatiquement. [Stripe Tax avec PaymentIntents](https://docs.stripe.com/tax/payment-intent/simplified), [codes fiscaux officiels](https://docs.stripe.com/tax/tax-codes).

## 3. Invoicing : préparation, pas de facturation supplémentaire

Préciser le besoin : facture justificative d’une commande déjà réglée, ou facture demandant un paiement ultérieur. Caldera utilise pour l’instant le paiement immédiat : ne jamais créer un second débit automatique pour une commande déjà PAID. Prévoir une relation unique entre Order et la facture Stripe, l’identité du vendeur, les informations de facturation du client et les lignes/frais/taxes issus des snapshots. La création, finalisation et remise de facture auront une idempotence séparée et leurs tests de rapprochement ; les emails ne seront annoncés qu’une fois l’envoi effectivement opérationnel. [API Invoicing](https://docs.stripe.com/invoicing/integration).

L’implémentation du flux facture et la vérification des mentions légales restent à effectuer dans une phase dédiée. Le modèle Customer Stripe éventuellement nécessaire n’impose pas de compte client authentifié Caldera.

## Écart actuel au plan

Payments est codé, migrations et logique transactionnelle testées. Les clés TEST fournies ont permis de vérifier un paiement réussi, un refus et l’état requires_action avec de vrais webhooks signés. Le rendu Payment Element et le défi 3DS complet restent à valider dans un navigateur. Tax et Invoicing restent volontairement non implémentés conformément au périmètre initial de la phase 8 ; aucun total fiscal ou statut de facture fictif n’est affiché. Le nettoyage des réservations est une commande exécutable, dont la planification reste à installer dans l’environnement cible.
