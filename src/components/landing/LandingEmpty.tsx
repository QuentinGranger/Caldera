import Link from 'next/link';
import { Compass } from 'lucide-react';
import type { SeoLink } from '@/lib/seo/types';
import catalogStyles from '@/components/catalog/Catalog.module.scss';

/** Empty state of a set or family that has no product yet. */
export function LandingEmpty({
  title,
  links,
}: {
  title: string;
  links: readonly SeoLink[];
}) {
  return (
    <section className={catalogStyles.empty}>
      <Compass size={36} strokeWidth={1} aria-hidden="true" />
      <h2>{title}</h2>
      {links.length > 0 && (
        <>
          <p>À consulter aussi :</p>
          <div>
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
