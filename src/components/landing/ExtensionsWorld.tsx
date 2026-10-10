import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, CalendarDays } from 'lucide-react';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import buttonStyles from '@/components/ui/Button/Button.module.scss';
import styles from './ExtensionsWorld.module.scss';

const illustrations = [
  '/assets/images/experience/giratina-v-186-196.webp',
  '/assets/images/experience/rayquaza-gold-star-107-107.webp',
  '/assets/images/experience/noctali-vmax-215-203.webp',
];

/** Real card artwork illustrates collecting; the release index below stays authoritative. */
export function ExtensionsHero({ calendar }: { calendar: boolean }) {
  return (
    <section className={styles.hero} aria-labelledby="page-title">
      <div className={styles.landscape} data-depth-landscape aria-hidden="true">
        <Image
          src="/assets/images/editorial/foret.png"
          alt=""
          fill
          sizes="100vw"
          loading="eager"
        />
      </div>
      <div className={styles.inner}>
        <Breadcrumb
          items={[{ label: 'Accueil', href: '/' }, { label: 'Extensions' }]}
          currentPath="/extensions"
        />
        <div className={styles.composition}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>L’atlas des collections</p>
            <h1 id="page-title">
              Extensions.
              <br />
              <em>De nouveaux horizons.</em>
            </h1>
            <p className={styles.lead}>
              Chaque extension ouvre un nouvel univers. Retrouvez les sorties
              annoncées, les dernières parutions et les collections déjà
              sorties.
            </p>
            <div className={styles.actions}>
              <a
                href="#chronologie"
                className={`${buttonStyles.button} ${buttonStyles.gold}`}
              >
                Parcourir les extensions{' '}
                <ArrowDown size={18} aria-hidden="true" />
              </a>
              {calendar ? (
                <Link href="/calendrier-des-sorties">
                  Le calendrier <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              ) : (
                <Link href="/pokemon">
                  Explorer Pokémon <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
          <div
            className={styles.scene}
            data-depth-stage="extensions-hero"
            aria-hidden="true"
          >
            <span className={styles.aura} />
            <div className={styles.fan}>
              {illustrations.map((src, index) => (
                <div className={styles.card} key={src}>
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="(min-width: 1200px) 240px, (min-width: 768px) 230px, 42vw"
                    loading={index === 2 ? 'eager' : 'lazy'}
                  />
                  <span />
                </div>
              ))}
            </div>
            <p className={styles.caption}>
              Illustrations du JCC Pokémon · hors catalogue
            </p>
          </div>
        </div>
        <div className={styles.footnote}>
          <span>LES TERRES DE CALDERA</span>
          <span>Découvrir. Suivre. Collectionner.</span>
        </div>
      </div>
    </section>
  );
}

export function ExtensionsNavigation({
  entries,
}: {
  entries: readonly { href: string; label: string; count: number }[];
}) {
  return (
    <nav
      id="chronologie"
      className={styles.navigation}
      aria-label="Parcourir les extensions"
    >
      <p className={styles.eyebrow}>Votre prochaine exploration</p>
      <ol>
        {entries.map((entry, index) => (
          <li key={entry.href}>
            <a href={entry.href}>
              <span className={styles.navNumber} aria-hidden="true">
                0{index + 1}
              </span>
              <span>
                <strong>{entry.label}</strong>
                <small>
                  {`${entry.count} ${entry.count > 1 ? 'extensions' : 'extension'}`}
                </small>
              </span>
              <ArrowDown size={19} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ExtensionsGuide() {
  return (
    <aside className={styles.guide} aria-labelledby="extensions-guide-title">
      <div>
        <p className={styles.eyebrow}>Les repères du collectionneur</p>
        <h2 id="extensions-guide-title">
          Une extension,
          <br />
          <em>tout un univers.</em>
        </h2>
      </div>
      <div>
        <p>
          Séries, extensions, numérotation : découvrez comment se repérer dans
          le JCC Pokémon et choisir ce que vous souhaitez collectionner.
        </p>
        <Link href="/guides/extensions-et-series-pokemon">
          Comprendre les extensions{' '}
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
      <CalendarDays
        className={styles.guideMark}
        size={150}
        strokeWidth={0.6}
        aria-hidden="true"
      />
    </aside>
  );
}
