import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Container/Container';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { JsonLd } from '@/components/seo/JsonLd';
import { UpdatedOn } from '@/components/editorial/UpdatedOn';
import {
  universeChapterPath,
  universeChapters,
  universeImage,
  universeIndex,
  type UniverseChapterSlug,
} from '@/data/universe';
import { articleNode, graph } from '@/lib/seo/jsonld';
import { getUniverseShopLinks } from './shopLinks';
import styles from './UniverseChapter.module.scss';

type Props = {
  slug: UniverseChapterSlug;
  title: string;
  kicker: string;
  lead: string;
  children: ReactNode;
};

export async function UniverseChapterShell({
  slug,
  title,
  kicker,
  lead,
  children,
}: Props) {
  const index = universeChapters.findIndex((chapter) => chapter.slug === slug);
  const previous = index > 0 ? universeChapters[index - 1] : null;
  const next =
    index < universeChapters.length - 1 ? universeChapters[index + 1] : null;
  const chapter = universeChapters[index]!;
  const path = universeChapterPath(slug);
  const hero = universeImage(chapter.hero.src, chapter.hero.alt);
  const shop = await getUniverseShopLinks();

  return (
    <main id="contenu" className={styles.main}>
      <section className={styles.hero} aria-labelledby="chapter-title">
        {hero && (
          <Image
            src={hero.src}
            alt={hero.alt}
            fill
            preload
            sizes="100vw"
            className={styles.heroImage}
          />
        )}
        <div className={styles.heroShade} aria-hidden="true" />
        <Container className={styles.heroInner}>
          <div className={styles.heroBreadcrumb}>
            <Breadcrumb
              items={[
                { label: 'Accueil', href: '/' },
                { label: 'Univers', href: universeIndex.path },
                { label: chapter.title },
              ]}
              currentPath={path}
            />
          </div>
          <p className={styles.chapterNumber}>
            CHRONIQUE {chapter.number} · {kicker}
          </p>
          <h1 id="chapter-title">{title}</h1>
          <p className={styles.heroLead}>{lead}</p>
        </Container>
      </section>

      <section className={styles.reading}>
        <Container className={styles.readingGrid}>
          <aside
            className={styles.chapterNav}
            aria-label="Chapitres de l’univers"
          >
            <Link className={styles.backToIndex} href={universeIndex.path}>
              Toutes les chroniques
            </Link>
            <ol>
              {universeChapters.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={universeChapterPath(item.slug)}
                    aria-current={item.slug === slug ? 'page' : undefined}
                  >
                    <span>{item.number}</span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.label}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </aside>

          <article className={styles.article}>
            {children}

            <UpdatedOn date={chapter.updated} className={styles.updated} />

            <nav
              className={styles.pager}
              aria-label="Navigation entre les chroniques"
            >
              {previous ? (
                <Link
                  href={universeChapterPath(previous.slug)}
                  className={styles.previous}
                >
                  <ArrowLeft size={17} aria-hidden="true" />
                  <span>
                    <small>Chronique précédente</small>
                    <strong>{previous.title}</strong>
                  </span>
                </Link>
              ) : (
                <span />
              )}

              {next ? (
                <Link
                  href={universeChapterPath(next.slug)}
                  className={styles.next}
                >
                  <span>
                    <small>Chronique suivante</small>
                    <strong>{next.title}</strong>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              ) : shop.exit ? (
                <Link href={shop.exit.href} className={styles.next}>
                  <span>
                    <small>Continuer l’exploration</small>
                    <strong>{shop.exit.label}</strong>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              ) : (
                <span />
              )}
            </nav>

            {shop.links.length > 0 && (
              <nav className={styles.shop} aria-labelledby="chapter-shop-title">
                <p id="chapter-shop-title" className={styles.shopTitle}>
                  Dans la boutique
                </p>
                <ul>
                  {shop.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </article>
        </Container>
      </section>
      <JsonLd
        data={graph(
          articleNode({
            path,
            headline: title,
            description: lead,
            dateModified: chapter.updated,
            image: hero?.src,
          }),
        )}
      />
    </main>
  );
}
