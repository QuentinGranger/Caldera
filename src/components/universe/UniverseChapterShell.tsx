import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Container/Container';
import {
  universeChapters,
  type UniverseChapterSlug,
} from '@/data/universe';
import styles from './UniverseChapter.module.scss';

type Props = {
  slug: UniverseChapterSlug;
  title: string;
  kicker: string;
  lead: string;
  image: string;
  imageAlt: string;
  children: ReactNode;
};

export function UniverseChapterShell({
  slug,
  title,
  kicker,
  lead,
  image,
  imageAlt,
  children,
}: Props) {
  const index = universeChapters.findIndex((chapter) => chapter.slug === slug);
  const previous = index > 0 ? universeChapters[index - 1] : null;
  const next =
    index < universeChapters.length - 1 ? universeChapters[index + 1] : null;
  const chapter = universeChapters[index];

  return (
    <main id="contenu" className={styles.main}>
      <section className={styles.hero} aria-labelledby="chapter-title">
        <Image
          src={image}
          alt={imageAlt}
          fill
          preload
          sizes="100vw"
          className={styles.heroImage}
        />
        <div className={styles.heroShade} aria-hidden="true" />
        <Container className={styles.heroInner}>
          <nav className={styles.breadcrumb} aria-label="Fil d’Ariane">
            <Link href="/univers">Univers</Link>
            <span aria-hidden="true">/</span>
            <span>{chapter.title}</span>
          </nav>
          <p className={styles.chapterNumber}>
            CHRONIQUE {chapter.number} · {kicker}
          </p>
          <h1 id="chapter-title">{title}</h1>
          <p className={styles.heroLead}>{lead}</p>
        </Container>
      </section>

      <section className={styles.reading}>
        <Container className={styles.readingGrid}>
          <aside className={styles.chapterNav} aria-label="Chapitres de l’univers">
            <Link className={styles.backToIndex} href="/univers">
              Toutes les chroniques
            </Link>
            <ol>
              {universeChapters.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/univers/${item.slug}`}
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

            <nav className={styles.pager} aria-label="Navigation entre les chroniques">
              {previous ? (
                <Link href={`/univers/${previous.slug}`} className={styles.previous}>
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
                <Link href={`/univers/${next.slug}`} className={styles.next}>
                  <span>
                    <small>Chronique suivante</small>
                    <strong>{next.title}</strong>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              ) : (
                <Link href="/catalogue" className={styles.next}>
                  <span>
                    <small>Continuer l’exploration</small>
                    <strong>Entrer dans la boutique</strong>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              )}
            </nav>
          </article>
        </Container>
      </section>
    </main>
  );
}
