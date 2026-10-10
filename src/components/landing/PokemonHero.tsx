import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import {
  Breadcrumb,
  type BreadcrumbItem,
} from '@/components/ui/Breadcrumb/Breadcrumb';
import { Button } from '@/components/ui/Button/Button';
import styles from './PokemonWorld.module.scss';

/** A short entrance to the shop, with depth on imagery and stable shopping links. */
export function PokemonHero({
  kind,
  title,
  eyebrow,
  lead,
  breadcrumb,
  path,
  hasProducts,
}: {
  kind: 'pokemon' | 'sealed';
  title: string;
  eyebrow: string;
  lead: string;
  breadcrumb: BreadcrumbItem[];
  path: string;
  hasProducts: boolean;
}) {
  const sealed = kind === 'sealed';
  return (
    <section
      className={styles.hero}
      data-kind={kind}
      aria-labelledby="page-title"
    >
      <div className={styles.landscape} aria-hidden="true" data-depth-landscape>
        <Image
          src={
            sealed
              ? '/assets/images/editorial/foret.png'
              : '/assets/images/editorial/hero-banner.png'
          }
          alt=""
          fill
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
        />
      </div>
      <div className={styles.inner}>
        <Breadcrumb items={breadcrumb} currentPath={path} />
        <div className={styles.composition}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 id="page-title">
              {sealed ? (
                <>
                  {title.replace(/ Pokémon$/, '')}
                  <br />
                  <em>Pokémon.</em>
                </>
              ) : (
                <>
                  {title} <em>Tout un univers.</em>
                </>
              )}
            </h1>
            <p className={styles.lead}>{lead}</p>
            <div className={styles.actions}>
              {hasProducts && (
                <Button href="#catalogue-resultats" variant="gold">
                  Explorer les produits{' '}
                  <ArrowDown size={18} aria-hidden="true" />
                </Button>
              )}
              <Link href={sealed ? '/pokemon' : '/pokemon/scelles'}>
                {sealed ? 'Tout Pokémon' : 'Les produits scellés'}{' '}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div
            className={styles.scene}
            data-depth-stage="hero"
            aria-hidden="true"
          >
            <span className={styles.orbit} />
            <span className={styles.ground} />
            {sealed ? (
              <div className={styles.object} data-hero-object>
                <Image
                  src="/assets/images/products/prismatic.png"
                  alt=""
                  fill
                  sizes="(min-width: 960px) 40vw, 75vw"
                />
              </div>
            ) : (
              <div className={styles.cards} data-hero-object>
                <div className={styles.cardBack}>
                  <Image
                    src="/assets/images/experience/pokemon-card-back.webp"
                    alt=""
                    fill
                    sizes="(min-width: 960px) 20vw, 42vw"
                  />
                </div>
                <div className={styles.cardFront}>
                  <Image
                    src="/assets/images/experience/noctali-vmax-215-203.webp"
                    alt=""
                    fill
                    sizes="(min-width: 960px) 23vw, 48vw"
                  />
                  <span />
                </div>
              </div>
            )}
            <p className={styles.caption}>
              {sealed
                ? 'ETB Évolutions Prismatiques · illustration hors catalogue'
                : 'Illustration du JCC Pokémon · hors catalogue'}
            </p>
          </div>
        </div>
        <div className={styles.footnote}>
          <span>LES TERRES DE CALDERA</span>
          <span>
            {sealed
              ? 'Conserver. Offrir. Ouvrir.'
              : 'Jouer. Ouvrir. Collectionner.'}
          </span>
        </div>
      </div>
    </section>
  );
}
