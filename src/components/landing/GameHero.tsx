import Image from 'next/image';
import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import {
  Breadcrumb,
  type BreadcrumbItem,
} from '@/components/ui/Breadcrumb/Breadcrumb';
import styles from './GameHero.module.scss';

/** A forest of Caldera under its volcano: the shop's world, no creature. */
const VIEW = '/assets/images/editorial/foret.png';

/**
 * The entrance of a game: where you are, what is sold, the way to the
 * products. A view of Caldera seen through an arch on wide screens, the
 * whole background on phones; short, the products follow right below.
 */
export function GameHero({
  breadcrumb,
  path,
  eyebrow,
  title,
  lead,
  explore,
}: {
  breadcrumb: BreadcrumbItem[];
  path: string;
  eyebrow: string;
  title: string;
  lead: string;
  /** Anchor of the products, absent while there is none. */
  explore?: string;
}) {
  return (
    <section className={styles.hero} aria-labelledby="game-title">
      {/* Wide screens: the same view, blurred, as the air around the arch.
          A thumbnail, never requested on phones where it is not shown. */}
      <div className={styles.atmosphere} aria-hidden="true">
        <Image src={VIEW} alt="" fill sizes="128px" loading="lazy" />
      </div>
      <div className={styles.inner}>
        <Breadcrumb items={breadcrumb} currentPath={path} />
        <div className={styles.content}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true" />
            {eyebrow}
          </p>
          <h1 id="game-title">{title}</h1>
          <p className={styles.lead}>{lead}</p>
          {explore && (
            <Button href={explore} variant="gold" className={styles.explore}>
              Explorer les produits <ArrowDown aria-hidden="true" />
            </Button>
          )}
        </div>
        <div className={styles.view} aria-hidden="true">
          <Image
            src={VIEW}
            alt=""
            fill
            sizes="(min-width: 60rem) 26rem, 100vw"
            loading="eager"
            fetchPriority="high"
          />
        </div>
      </div>
    </section>
  );
}
