import type { ReactNode } from 'react';
import { NewsletterCta } from '@/components/newsletter/NewsletterCta';
import { JsonLd } from '@/components/seo/JsonLd';
import { Container } from '@/components/ui/Container/Container';
import type { JsonLdGraph } from '@/lib/seo/jsonld';
import styles from './Catalog.module.scss';
import { PokemonMotion } from '@/components/landing/PokemonMotion';

const NEWSLETTER =
  'Recevez les prochains réassorts, sorties et sélections sans avoir à surveiller le catalogue.';

/**
 * Every catalogue page in one order: the hero, the page's own blocks (the
 * products first, then what follows them), the newsletter last, and the
 * structured data. A new aisle only brings its words and its view.
 */
export function CatalogShell({
  hero,
  children,
  newsletter = NEWSLETTER,
  jsonLd,
  world,
  motionKey = '',
}: {
  world?: 'pokemon' | 'sealed' | 'extensions';
  motionKey?: string;
  hero: ReactNode;
  children: ReactNode;
  /** The newsletter's line, when the page has a better one. */
  newsletter?: string;
  jsonLd: JsonLdGraph;
}) {
  return (
    <main
      id="contenu"
      tabIndex={-1}
      className={`${styles.main} ${styles.immersive} ${world ? styles.world : ''}`}
      data-pokemon-world={world}
    >
      {hero}
      <Container>
        {children}
        <NewsletterCta
          eyebrow="Réassorts et nouveautés"
          title="Soyez prévenu quand de nouvelles cartes arrivent"
        >
          {newsletter}
        </NewsletterCta>
      </Container>
      {world && <PokemonMotion revision={motionKey} />}
      <JsonLd data={jsonLd} />
    </main>
  );
}
