export const universeChapters = [
  {
    slug: 'origines',
    number: '01',
    title: 'Origines',
    label: 'Là où la terre s’est ouverte',
    description:
      'Le Grand Effondrement, la naissance de la Caldera et ceux qui ouvrirent les premiers chemins.',
  },
  {
    slug: 'archives',
    number: '02',
    title: 'Les Archives',
    label: 'Ce qui mérite d’être gardé',
    description:
      'L’origine des Archives des Explorateurs et de la tradition qui relie chaque découverte à son histoire.',
  },
  {
    slug: 'territoires',
    number: '03',
    title: 'Les cinq territoires',
    label: 'Une terre, cinq façons d’explorer',
    description:
      'La Caldera, les Terres de Braise, les Forêts anciennes, les Hautes Terres et les Rivages.',
  },
  {
    slug: 'route-des-cinq',
    number: '04',
    title: 'La Route des Cinq',
    label: 'Il n’existe pas de parcours idéal',
    description:
      'Le réseau mouvant de chemins qui relie les régions et que chaque explorateur parcourt à sa manière.',
  },
  {
    slug: 'horizons',
    number: '05',
    title: 'Horizons inconnus',
    label: 'Une carte ne devrait jamais être terminée',
    description:
      'Les espaces encore blancs des cartes et l’esprit qui donne son sens aux Terres de Caldera.',
  },
] as const;

export type UniverseChapterSlug = (typeof universeChapters)[number]['slug'];

export function getUniverseChapter(slug: UniverseChapterSlug) {
  return universeChapters.find((chapter) => chapter.slug === slug)!;
}
