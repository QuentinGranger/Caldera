// The words and the view of each catalogue page: everything that makes an
// aisle itself, the rest being the shared system (PageHero, AisleNav,
// CatalogResults, ExploreSection, CatalogShell). Real content only: every
// line describes families and products the catalogue actually has, every
// guide exists in content/guides.
import type { ListingKind } from '@/lib/seo/metadata';
import type { HeroView } from './PageHero';

/** Views of Caldera, never a creature: the shop's world, not the games'. */
export const VIEWS = {
  archives: '/assets/images/ArchiveExplorateurs.png',
  path: '/assets/images/PremiersExplorateurs.png',
  dawn: '/assets/images/editorial/hero-banner.png',
  shore: '/assets/images/Rivages.png',
  road: '/assets/images/RouteCinq.png',
  forest: '/assets/images/editorial/foret.png',
} as const;

/** The call to action of a page whose products follow the hero. */
export const EXPLORE_PRODUCTS = 'Explorer les produits';

export interface PageCopy {
  eyebrow: string;
  title: string;
  lead: string;
  note?: string;
  view: HeroView;
}

/** A guide shown between the products: its own title and summary. */
export interface Teaser {
  /** Small label above the guide's title: why read it here. */
  eyebrow: string;
  /** Slug in content/guides. */
  guide: string;
  image: string;
}

/** Transverse listings: the whole shop, seen through one door. */
export const LISTING_COPY: Readonly<Record<ListingKind, PageCopy>> = {
  catalogue: {
    eyebrow: 'Le Comptoir',
    title: 'Tout le catalogue',
    lead: 'Explorez les collections de Caldera et trouvez les pièces qui rejoindront votre prochaine aventure.',
    view: { src: VIEWS.archives, frame: 'backdrop', focus: '35% 45%' },
  },
  nouveautes: {
    eyebrow: 'Dernières arrivées',
    title: 'Nouveautés',
    lead: 'Les dernières références ajoutées au comptoir de Caldera.',
    // The badge says the availability first (getProductBadge).
    note: '« Nouveau » : signalé comme nouveauté par la boutique ; une précommande garde son badge.',
    view: { src: VIEWS.path, frame: 'backdrop', focus: '62% 45%' },
  },
  precommandes: {
    eyebrow: 'Avant la sortie',
    title: 'Précommandes',
    lead: 'Les produits proposés en précommande avant leur sortie.',
    view: { src: VIEWS.dawn, frame: 'backdrop', focus: '50% 38%' },
  },
  'en-stock': {
    eyebrow: 'Prêts à partir',
    title: 'En stock',
    lead: 'Les produits disponibles dès maintenant au comptoir de Caldera.',
    view: { src: VIEWS.shore, frame: 'backdrop', focus: '55% 55%' },
  },
};

export interface AisleCopy {
  eyebrow: string;
  lead: string;
  /** Part of the game's view kept in this aisle's frame. */
  focus: string;
  /** A filter offered as chips above the products (by set). */
  browse?: 'set';
  /** The cards' layout: `edition` shows the set and the languages first. */
  card?: 'edition';
  /** A visible way up to the parent family, in the hero. */
  up?: true;
  /** The latest products above the listing, under this title. */
  latest?: { title: string; all: string };
  teaser?: Teaser;
}

/**
 * The shop game's families (category slugs): the aisles of /{game}/{family}.
 * One view for the whole game, each aisle framing its own part of it.
 */
export function shopAisleCopy(
  slug: string,
  game: string,
): AisleCopy | undefined {
  switch (slug) {
    case 'scelles':
      return {
        eyebrow: 'Collection & ouverture',
        lead: `ETB, coffrets, displays et produits ${game} à conserver, offrir ou ouvrir.`,
        focus: '50% 52%',
        teaser: {
          eyebrow: 'Choisir son produit scellé',
          guide: 'etb-display-ou-booster',
          image: VIEWS.archives,
        },
      };
    case 'boosters':
      return {
        eyebrow: 'Ouvrir une nouvelle piste',
        lead: `Retrouvez les boosters ${game} disponibles parmi les extensions proposées par Caldera.`,
        focus: '50% 8%',
        browse: 'set',
        teaser: {
          eyebrow: 'Choisir son extension',
          guide: 'extensions-et-series-pokemon',
          image: VIEWS.path,
        },
      };
    case 'displays':
      return {
        eyebrow: 'Pour aller plus loin',
        lead: 'Des displays pour multiplier les ouvertures et explorer une extension en profondeur.',
        focus: '50% 76%',
        card: 'edition',
        teaser: {
          eyebrow: 'Garder ses displays intacts',
          guide: 'conserver-produits-scelles',
          image: VIEWS.road,
        },
      };
    case 'coffrets':
      return {
        eyebrow: 'Pièces de collection',
        lead: `Coffrets et collections ${game} pensés pour l’ouverture et la collection.`,
        focus: '50% 30%',
        up: true,
        latest: {
          title: 'Derniers coffrets ajoutés',
          all: 'Voir tous les coffrets',
        },
        teaser: {
          eyebrow: 'Après l’ouverture',
          guide: 'proteger-ses-cartes',
          image: VIEWS.shore,
        },
      };
  }
  return undefined;
}

/** Shop-wide families: /categorie/{slug}. */
export function categoryCopy(slug: string): AisleCopy | undefined {
  if (slug === 'accessoires')
    return {
      eyebrow: 'Protéger · classer',
      lead: 'Les essentiels pour protéger, organiser et accompagner votre collection.',
      focus: '18% 45%',
      teaser: {
        eyebrow: 'Bien protéger sa collection',
        guide: 'proteger-ses-cartes',
        image: VIEWS.shore,
      },
    };
  return undefined;
}

/** /extensions: not a listing, the same entrance. */
export const EXTENSIONS_COPY = {
  eyebrow: 'Cartographier les sorties',
  lead: 'Explorez les extensions disponibles, récentes et à venir.',
  view: { src: VIEWS.road, frame: 'backdrop', focus: '50% 45%' },
} as const satisfies Omit<PageCopy, 'title'>;
