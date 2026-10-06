-- Remove only demonstration FAQ entries. Keep all questions entered in admin.
UPDATE "Game"
SET "faq" = (
  SELECT jsonb_agg(entry.value ORDER BY entry.position)
  FROM jsonb_array_elements("Game"."faq") WITH ORDINALITY AS entry(value, position)
  WHERE position('[Démo]' IN coalesce(entry.value->>'question', '')) = 0
    AND position('[Démo]' IN coalesce(entry.value->>'answer', '')) = 0
)
WHERE jsonb_typeof("faq") = 'array' AND "faq"::text LIKE '%[Démo]%';

UPDATE "Category"
SET "faq" = (
  SELECT jsonb_agg(entry.value ORDER BY entry.position)
  FROM jsonb_array_elements("Category"."faq") WITH ORDINALITY AS entry(value, position)
  WHERE position('[Démo]' IN coalesce(entry.value->>'question', '')) = 0
    AND position('[Démo]' IN coalesce(entry.value->>'answer', '')) = 0
)
WHERE jsonb_typeof("faq") = 'array' AND "faq"::text LIKE '%[Démo]%';

UPDATE "TcgSet"
SET "faq" = (
  SELECT jsonb_agg(entry.value ORDER BY entry.position)
  FROM jsonb_array_elements("TcgSet"."faq") WITH ORDINALITY AS entry(value, position)
  WHERE position('[Démo]' IN coalesce(entry.value->>'question', '')) = 0
    AND position('[Démo]' IN coalesce(entry.value->>'answer', '')) = 0
)
WHERE jsonb_typeof("faq") = 'array' AND "faq"::text LIKE '%[Démo]%';

-- Initial editorial content lives in the same fields edited by the admin.
-- A non-empty FAQ is never overwritten.
UPDATE "Game"
SET "faq" = $faq$[
  {"question":"Quels produits Pokémon puis-je trouver sur Caldera ?","answer":"Caldera propose une sélection de produits du JCC Pokémon, notamment des boosters, displays, coffrets, bundles, ETB et autres produits scellés. La sélection évolue selon les sorties et les disponibilités."},
  {"question":"Comment choisir entre les différentes extensions Pokémon ?","answer":"Chaque extension possède son propre univers, ses cartes et ses raretés. Vous pouvez consulter les pages dédiées aux extensions pour découvrir leur contenu, leur date de sortie et les produits disponibles sur Caldera."}
]$faq$::jsonb
WHERE "slug" = 'pokemon' AND ("faq" IS NULL OR "faq" = '[]'::jsonb);

UPDATE "Category"
SET "faq" = CASE "slug"
  WHEN 'scelles' THEN $faq$[{"question":"Quels produits trouve-t-on dans la famille des produits scellés ?","answer":"Cette famille regroupe les boosters, displays, ETB et coffrets scellés présents au catalogue. Les produits affichés évoluent selon les sorties et les disponibilités."}]$faq$::jsonb
  WHEN 'boosters' THEN $faq$[{"question":"Quelles présentations de boosters puis-je consulter ?","answer":"Cette famille rassemble les boosters à l’unité, blisters, tripacks et bundles proposés au catalogue. Consultez la fiche de chaque produit pour connaître son extension, sa langue et sa disponibilité."}]$faq$::jsonb
  WHEN 'displays' THEN $faq$[{"question":"Qu’est-ce qu’un display de cartes à collectionner ?","answer":"Un display est une boîte de boosters scellée. Consultez sa fiche produit pour connaître l’extension, la langue et les informations propres à cette boîte."}]$faq$::jsonb
  WHEN 'etb' THEN $faq$[{"question":"Que signifie ETB ?","answer":"ETB signifie « Elite Trainer Box », ou « Coffret Dresseur d’élite » en français. Consultez la fiche de chaque ETB pour connaître l’extension et le contenu indiqué pour ce produit."}]$faq$::jsonb
  WHEN 'coffrets' THEN $faq$[{"question":"Quels formats trouve-t-on dans la famille des coffrets ?","answer":"Cette famille rassemble les coffrets de collection, tins et decks présents au catalogue. Le contenu varie selon le produit : consultez sa fiche pour le détail."}]$faq$::jsonb
  WHEN 'cartes' THEN $faq$[{"question":"Où trouver des cartes vendues à l’unité ?","answer":"Les cartes proposées individuellement sont regroupées dans cette famille. Consultez chaque fiche pour vérifier la carte et les informations disponibles avant de choisir."}]$faq$::jsonb
  WHEN 'accessoires' THEN $faq$[{"question":"Quels accessoires puis-je trouver dans cette famille ?","answer":"Cette famille regroupe les protège-cartes, classeurs et articles de rangement présents au catalogue. Consultez la fiche de chaque article pour vérifier son usage et ses caractéristiques."}]$faq$::jsonb
  ELSE "faq"
END
WHERE "slug" IN ('scelles', 'boosters', 'displays', 'etb', 'coffrets', 'cartes', 'accessoires')
  AND ("faq" IS NULL OR "faq" = '[]'::jsonb);
