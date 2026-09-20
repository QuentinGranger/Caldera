export const universeChapters = [
  {
    slug: 'origines',
    number: '01',
    title: 'Origines',
    label: 'Là où la terre s’est ouverte',
    description:
      'Le Grand Effondrement, les premières descentes vers le cratère et ceux qui tracèrent les premiers chemins à travers les brumes.',
  },
  {
    slug: 'archives',
    number: '02',
    title: 'Les Archives',
    label: 'Ce qui mérite d’être gardé',
    description:
      'Un observatoire, une bibliothèque et un centre de cartographie où chaque découverte est conservée avec l’histoire de son voyage.',
  },
  {
    slug: 'territoires',
    number: '03',
    title: 'Les cinq territoires',
    label: 'Une terre, cinq façons d’explorer',
    description:
      'Le cœur de la Caldera, les terres volcaniques, les forêts anciennes, les hauts plateaux et les rivages ouverts sur le large.',
  },
  {
    slug: 'route-des-cinq',
    number: '04',
    title: 'La Route des Cinq',
    label: 'Il n’existe pas de parcours idéal',
    description:
      'Ponts, sentiers, relais et pistes forment un réseau vivant qui relie les régions et change avec ceux qui l’empruntent.',
  },
  {
    slug: 'horizons',
    number: '05',
    title: 'Horizons inconnus',
    label: 'Une carte ne devrait jamais être terminée',
    description:
      'Les zones blanches, les routes interrompues et les signes encore inexpliqués qui empêchent Caldera de devenir un monde entièrement connu.',
  },
] as const;

export type UniverseChapterSlug = (typeof universeChapters)[number]['slug'];

export function getUniverseChapter(slug: UniverseChapterSlug) {
  return universeChapters.find((chapter) => chapter.slug === slug)!;
}
