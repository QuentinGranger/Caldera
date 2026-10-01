import type { Metadata } from 'next';

import { ConstructionExperience } from './ConstructionExperience';

export const metadata: Metadata = {
  title: {
    absolute: 'Caldera — Ouverture prochaine',
  },
  description:
    'Caldera prépare sa boutique en ligne dédiée aux jeux de cartes à collectionner. Ouverture prochaine.',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function ConstructionPage() {
  return <ConstructionExperience />;
}
