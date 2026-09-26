// Links from the chronicles to the shop: indexable game hubs, guides and
// glossary, and the exit of the last chronicle.
import 'server-only';
import {
  LISTING_HUBS,
  getIndexableListings,
} from '@/components/catalog/listingHub';
import {
  getGlossaryIndex,
  getGuidesIndex,
} from '@/components/editorial/content';
import { GLOSSARY_PATH, GUIDES_PATH } from '@/components/editorial/editorial';
import { getNavigation } from '@/lib/seo/links';
import type { SeoLink } from '@/lib/seo/types';

export interface UniverseShopLinks {
  links: SeoLink[];
  /** Target after the last chronicle: the catalogue when it is indexable. */
  exit: SeoLink | null;
}

export async function getUniverseShopLinks(): Promise<UniverseShopLinks> {
  const [navigation, listings, guides, glossary] = await Promise.all([
    getNavigation(),
    getIndexableListings(),
    getGuidesIndex(),
    getGlossaryIndex(),
  ]);
  const links: SeoLink[] = [
    ...navigation.games.map((game) => ({
      href: game.href,
      label: `Tous les produits ${game.name}`,
    })),
    ...(guides.decision.index
      ? [{ href: GUIDES_PATH, label: guides.heading }]
      : []),
    ...(glossary.decision.index
      ? [{ href: GLOSSARY_PATH, label: glossary.heading }]
      : []),
  ];
  const exit = listings.has('catalogue')
    ? { href: LISTING_HUBS.catalogue.path, label: 'Entrer dans la boutique' }
    : (links[0] ?? null);
  return { links, exit };
}
