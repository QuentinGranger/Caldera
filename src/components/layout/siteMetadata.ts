// Site-wide metadata defaults (docs/seo-architecture.md §5): the root layout
// uses them, pages replace them through buildMetadata.
import type { Metadata } from 'next';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '@/lib/seo/metadata';
import { HANDLING_TIME } from '@/lib/seo/policies';
import { absoluteUrl, siteOrigin } from '@/lib/site';

/** Home title, and the title of any page without its own. */
export const DEFAULT_TITLE =
  'Les Terres de Caldera – boutique de cartes Pokémon et JCC';
/** Added by the layout: page titles never repeat the brand. */
export const TITLE_TEMPLATE = '%s | Caldera';

// Delivery zone and preparation time from the CGV (art. 10.1 and 10.3).
export const DEFAULT_DESCRIPTION = `Boutique en ligne de cartes Pokémon et de JCC. Livraison en France métropolitaine, commandes préparées sous ${HANDLING_TIME.minDays} à ${HANDLING_TIME.maxDays} jours ouvrés après paiement.`;

export function rootMetadata(): Metadata {
  const image = {
    url: absoluteUrl(DEFAULT_OG_IMAGE.url),
    width: DEFAULT_OG_IMAGE.width,
    height: DEFAULT_OG_IMAGE.height,
    alt: DEFAULT_OG_IMAGE.alt,
  };
  return {
    metadataBase: new URL(siteOrigin()),
    title: { default: DEFAULT_TITLE, template: TITLE_TEMPLATE },
    description: DEFAULT_DESCRIPTION,
    applicationName: SITE_NAME,
    openGraph: {
      type: 'website',
      locale: 'fr_FR',
      siteName: SITE_NAME,
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [image.url],
    },
  };
}
