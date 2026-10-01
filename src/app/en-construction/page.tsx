import type { Metadata } from 'next';

import { ConstructionExperience } from './ConstructionExperience';

export const metadata: Metadata = {
  title: 'Caldera — Ouverture prochaine',
  description:
    'Caldera prépare sa boutique en ligne dédiée aux jeux de cartes à collectionner. Ouverture prochaine.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function ConstructionPage() {
  return <ConstructionExperience />;
}
