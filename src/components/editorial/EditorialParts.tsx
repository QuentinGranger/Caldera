import Link from 'next/link';
import type { ReactNode } from 'react';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import type { ContentEntry, ContentHeading } from '@/lib/content/types';
import type { FaqEntry, SeoLink } from '@/lib/seo/types';
import type { CatalogProduct } from '@/types/product';
import { KIND_LABELS } from './editorial';
import { UpdatedOn } from './UpdatedOn';
import styles from './Editorial.module.scss';

export function EditorialHeader({
  eyebrow,
  title,
  lead,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string | null;
  updated?: Date | null;
  /** Factual lines under the lead, links included. */
  children?: ReactNode;
}) {
  return (
    <header className={styles.header} data-arrive="layers">
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1>{title}</h1>
      {lead && <p className={styles.lead}>{lead}</p>}
      {children && <div className={styles.facts}>{children}</div>}
      {updated && <UpdatedOn date={updated} className={styles.updated} />}
    </header>
  );
}

/** Rendered Markdown (sanitized by src/lib/content). */
export function Prose({ html }: { html: string }) {
  if (!html.trim()) return null;
  return (
    <div className={styles.prose} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export interface TocEntry {
  id: string;
  text: string;
}

/**
 * Article column with the table of its h2 beside it on desktop, above it on
 * smaller screens; a single column when there are fewer than two sections.
 * `extra`: h2 rendered after the body (FAQ), listed last.
 */
export function ArticleLayout({
  headings,
  extra = [],
  children,
}: {
  headings: readonly ContentHeading[];
  extra?: readonly TocEntry[];
  children: ReactNode;
}) {
  const sections: TocEntry[] = [
    ...headings.filter((heading) => heading.level === 2),
    ...extra,
  ];
  if (sections.length < 2)
    return <div className={styles.single}>{children}</div>;
  return (
    <div className={styles.layout}>
      <nav className={styles.toc} aria-labelledby="sommaire-titre">
        <p id="sommaire-titre" className={styles.tocTitle}>
          Sommaire
        </p>
        <ol>
          {sections.map((heading) => (
            <li key={heading.id}>
              <a href={`#${heading.id}`}>{heading.text}</a>
            </li>
          ))}
        </ol>
      </nav>
      <div className={styles.article}>{children}</div>
    </div>
  );
}

export const FAQ_TITLE = 'Questions fréquentes';

/** Visible FAQ; the page adds faqPageNode for the same entries. */
export function FaqSection({
  entries,
  id = 'questions-frequentes',
}: {
  entries: readonly FaqEntry[];
  id?: string;
}) {
  if (!entries.length) return null;
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id}>{FAQ_TITLE}</h2>
      <div className={styles.faq}>
        {entries.map((entry) => (
          <div key={entry.question}>
            <h3>{entry.question}</h3>
            <p>{entry.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const productCount = (count: number) =>
  `${count} ${count > 1 ? 'produits' : 'produit'}`;

/** Indexable landings as pills, with their real product count. */
export function LandingPills({ links }: { links: readonly SeoLink[] }) {
  if (!links.length) return null;
  return (
    <ul className={styles.pills}>
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href}>
            {link.label}
            {link.count !== undefined && (
              <span className={styles.pillCount}>
                {productCount(link.count)}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Products and landings matching an entry; nothing when there are none. */
export function ShopSection({
  products,
  landings,
  intro,
  id = 'en-boutique-titre',
}: {
  products: readonly CatalogProduct[];
  landings: readonly SeoLink[];
  intro?: string;
  id?: string;
}) {
  if (!products.length && !landings.length) return null;
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id}>Dans la boutique</h2>
      {intro && <p className={styles.sectionIntro}>{intro}</p>}
      {products.length > 0 && <CatalogGrid products={[...products]} />}
      <LandingPills links={landings} />
    </section>
  );
}

/** Guides or glossary terms as cards: kind, title link, description, date. */
export function ContentCards({
  entries,
  showKind = true,
  showDate = true,
  published = false,
  wide = false,
}: {
  entries: readonly ContentEntry[];
  showKind?: boolean;
  showDate?: boolean;
  /** News: the publication date instead of the update date. */
  published?: boolean;
  wide?: boolean;
}) {
  if (!entries.length) return null;
  return (
    <ul className={`${styles.cards} ${wide ? styles.wideCards : ''}`}>
      {entries.map((entry) => (
        <li key={entry.href}>
          <article className={styles.card}>
            {showKind && (
              <p className={styles.cardKind}>{KIND_LABELS[entry.kind]}</p>
            )}
            <h3>
              <Link href={entry.href}>{entry.title}</Link>
            </h3>
            <p>{entry.description}</p>
            {showDate && (
              <UpdatedOn
                date={published ? entry.published : entry.updated}
                prefix={published ? 'Publié le' : undefined}
                className={styles.cardDate}
              />
            )}
          </article>
        </li>
      ))}
    </ul>
  );
}

/** Titled section of content cards; nothing when the list is empty. */
export function ContentSection({
  id,
  title,
  entries,
  showKind,
}: {
  id: string;
  title: string;
  entries: readonly ContentEntry[];
  showKind?: boolean;
}) {
  if (!entries.length) return null;
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <ContentCards entries={entries} showKind={showKind} wide />
    </section>
  );
}
