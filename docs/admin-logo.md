# Logo de l’administration

Le logo de l’admin reprend l’arche, la caldeira, le chemin d’expédition et l’or
sur vert forêt du site. Le logo public et les logos des emails restent inchangés.

- Asset final : `public/assets/images/brand/caldera-admin-editorial.webp`
- Dimensions : 864 × 288 px, WebP sans perte avec transparence alpha conservée.
- Consommateur unique : `src/components/admin/AdminLogo.tsx`, partagé entre
  navigation desktop/mobile, connexion et récupération de mot de passe.
- Le fond vert du bloc logo sur les écrans de connexion maintient la lisibilité
  du dessin doré sur la surface claire.
- Génération : outil intégré `image_gen`, mode `logo-brand`, fond transparent.
  Export de déploiement redimensionné avec Sharp, sans modification du dessin.
- Source conservée hors dépôt :
  `/Users/quentin/.codex/generated_images/01a108b3-f468-7f03-858c-abf4a5581c65/exec-3fee52ec-88af-4ec8-92ea-3e23ee2f6d50.png`.

## Prompt final

```text
Generate a finished production logo for CALDERA ADMINISTRATION. Use case logo-brand. This logo is ONLY for the administration area of a French cinematic editorial trading-card boutique. The interface has a deep forest green sidebar (#163D30), warm cream panels and antique gold accents (#E8C261).

Design a wide horizontal lockup, approximately 3.2:1 artwork ratio. On the left: a refined simple golden arch outline enclosing a clean stylized caldera mountain ridge and a winding path, with one small four-point expedition compass star above the ridge. Mountain and path rendered as a few strong graphical shapes, no rocky detail or texture. On the right: EXACT TEXT "CALDERA" in large elegant editorial uppercase serif, and EXACT TEXT "ADMINISTRATION" in small but legible widely spaced uppercase below. Align and balance the two lines. No "LES TERRES DE", no other text.

Warm muted GOLD flat opaque artwork, with tiny cream accents permitted. A refined minimal heritage identity, clear silhouettes readable at 210 pixels wide. NO bevel, NO 3D, NO chrome, NO fire, NO red, NO orange glow, NO photographic texture, NO shadows. The caldera symbol feels like an engraved expedition journal seal, beautifully balanced and contemporary. Fairly substantial strokes for legibility.

CRITICAL TRANSPARENCY: every positive shape and letter must be fully opaque, with normal antialiased crisp edges; all negative space must be alpha=0 transparent. No backdrop, no smoky halo, no diffuse light, no vignette, no gold cloud around text, no baked-in checkerboard. The empty inside of the arch is also transparent between the gold mountain shapes. Deliver ONLY this actual logo on genuine transparent alpha, not a mockup. Keep all artwork fully in frame with small equal safe margins.
```
