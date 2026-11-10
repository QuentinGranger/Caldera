import { PageHero } from '@/components/catalog/PageHero';
import type { BreadcrumbItem } from '@/components/ui/Breadcrumb/Breadcrumb';

/** The game and its sealed products use the same practical shopping header. */
export function PokemonHero({
  title,
  eyebrow,
  lead,
  breadcrumb,
  path,
}: {
  kind: 'pokemon' | 'sealed';
  title: string;
  eyebrow: string;
  lead: string;
  breadcrumb: BreadcrumbItem[];
  path: string;
  hasProducts: boolean;
}) {
  return (
    <PageHero
      breadcrumb={breadcrumb}
      path={path}
      eyebrow={eyebrow}
      title={title}
      lead={lead}
      view={{ src: '/assets/images/editorial/foret.png', frame: 'backdrop' }}
    />
  );
}
