# Page de liens Caldera

`/liens` est la porte d’entrée destinée à la bio Instagram. Elle reprend le paysage, l’emblème, les polices et les couleurs du site, sans son menu ni son pied de page complet.

Les destinations sont définies dans `src/app/liens/page.tsx` :

- newsletter : `/newsletter`, avec le formulaire et la confirmation existants ;
- boutique : `/`, sans promesse d’achat tant que le catalogue est en démonstration ;
- Discord : invitation publique centralisée dans `src/data/community.ts` ;
- guides : `/guides`.

La newsletter est le premier accès tant que `CATALOG_DEMO_MODE=1` ou que `STORE_OPEN` ne vaut pas `1`. Une fois la boutique ouverte hors démonstration, le site passe en premier automatiquement.

La page possède un canonical, un titre, une description et les métadonnées Open Graph/Twitter via le générateur SEO existant. Elle figure dans la sitemap des pages et dans le pied de page du site (« Tous nos liens »). La page de liens est indexable même en démonstration ; les règles des alias et du catalogue restent inchangées.

Avant l’ouverture commerciale, `/liens`, le parcours `/newsletter` et la politique de confidentialité restent accessibles. Les URL de confirmation et de désinscription conservent `noindex, nofollow` et `no-store`. Le catalogue et le paiement restent derrière le rideau de préouverture.

Le lien de bio à utiliser après déploiement est `https://lesterresdecaldera.fr/liens`. Sa modification dans Instagram se fait depuis l’application mobile.
