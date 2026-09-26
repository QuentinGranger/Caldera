// Editorial universe of the shop. Client-safe: the mobile navigation imports it.

export interface UniverseImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

// Illustrations actually shipped in public/. An image referenced by a chronicle
// but missing here is neither rendered, preloaded nor shared as og:image.
const PUBLISHED_IMAGES: Readonly<
  Record<string, { width: number; height: number }>
> = {
  '/assets/images/ArchiveExplorateurs.png': { width: 1672, height: 941 },
  '/assets/images/PremiersExplorateurs.png': { width: 1536, height: 1024 },
};

/** The image with its size when the file is published, null otherwise. */
export function universeImage(src: string, alt = ''): UniverseImage | null {
  const size = PUBLISHED_IMAGES[src];
  return size ? { src, alt, ...size } : null;
}

export const universeIndex = {
  path: '/univers',
  title: 'Univers et chroniques',
  description:
    'Les Terres de Caldera : un monde né du Grand Effondrement, cinq territoires, des Archives et des routes encore incomplètes.',
  hero: { src: '/assets/images/RouteCinq.png', alt: '' },
  /** Last edit of the texts. */
  updated: '2026-09-20',
} as const;

export const universeChapters = [
  {
    slug: 'origines',
    number: '01',
    title: 'Origines',
    label: 'Là où la terre s’est ouverte',
    description:
      'Le Grand Effondrement, les premières descentes vers le cratère et ceux qui tracèrent les premiers chemins à travers les brumes.',
    hero: {
      src: '/assets/images/PremiersExplorateurs.png',
      alt: 'Premiers explorateurs descendant vers la Caldera au coucher du soleil',
    },
    updated: '2026-09-20',
  },
  {
    slug: 'archives',
    number: '02',
    title: 'Les Archives',
    label: 'Ce qui mérite d’être gardé',
    description:
      'Un observatoire, une bibliothèque et un centre de cartographie où chaque découverte est conservée avec l’histoire de son voyage.',
    hero: {
      src: '/assets/images/ArchiveExplorateurs.png',
      alt: 'Archives des Explorateurs construites sur une falaise dominant la Caldera',
    },
    updated: '2026-09-20',
  },
  {
    slug: 'territoires',
    number: '03',
    title: 'Les cinq territoires',
    label: 'Une terre, cinq façons d’explorer',
    description:
      'Le cœur de la Caldera, les terres volcaniques, les forêts anciennes, les hauts plateaux et les rivages ouverts sur le large.',
    hero: {
      src: '/assets/images/GrandEffondrement.png',
      alt: 'Vue générale de la Caldera, de ses falaises, de ses lacs et de ses terres volcaniques',
    },
    updated: '2026-09-20',
  },
  {
    slug: 'route-des-cinq',
    number: '04',
    title: 'La Route des Cinq',
    label: 'Il n’existe pas de parcours idéal',
    description:
      'Ponts, sentiers, relais et pistes forment un réseau vivant qui relie les régions et change avec ceux qui l’empruntent.',
    hero: {
      src: '/assets/images/RouteCinq.png',
      alt: 'Vue panoramique de la Route des Cinq reliant forêts, reliefs volcaniques et rivages',
    },
    updated: '2026-09-20',
  },
  {
    slug: 'horizons',
    number: '05',
    title: 'Horizons inconnus',
    label: 'Une carte ne devrait jamais être terminée',
    description:
      'Les zones blanches, les routes interrompues et les signes encore inexpliqués qui empêchent Caldera de devenir un monde entièrement connu.',
    hero: {
      src: '/assets/images/HautesTerres.png',
      alt: 'Hautes Terres de Caldera couvertes de neige, de vent et de brume',
    },
    updated: '2026-09-20',
  },
] as const;

export type UniverseChapter = (typeof universeChapters)[number];
export type UniverseChapterSlug = UniverseChapter['slug'];

export function getUniverseChapter(slug: UniverseChapterSlug) {
  return universeChapters.find((chapter) => chapter.slug === slug)!;
}

export const universeChapterPath = (slug: UniverseChapterSlug) =>
  `/univers/${slug}`;
