import type { Metadata } from 'next';
import { headers } from 'next/headers';

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

const previewCommand = String.raw`
(() => {
  const command = 'W3AR3N0T0P3NY3T';

  Object.defineProperty(globalThis, command, {
    configurable: true,
    get() {
      document.cookie =
        'caldera_preview=1; Path=/; Max-Age=604800; SameSite=Lax; Secure';
      location.assign('/');
      return 'Ouverture de Caldera…';
    },
  });
})();
`;

export default async function ConstructionPage() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <>
      <script
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: previewCommand }}
      />
      <ConstructionExperience />
    </>
  );
}
