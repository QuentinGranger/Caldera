import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Container } from '@/components/ui/Container/Container';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { JsonLd } from '@/components/seo/JsonLd';
import { UpdatedOn } from '@/components/editorial/UpdatedOn';
import {
  editorialDecision,
  editorialMetadata,
  freeAnchor,
} from '@/components/editorial/editorial';
import {
  ArticleLayout,
  ContentSection,
  EditorialHeader,
  FAQ_TITLE,
  FaqSection,
  Prose,
  ShopSection,
} from '@/components/editorial/EditorialParts';
import { NEWS_PATH, getSectionPage } from '@/components/editorial/sections';
import { getContentEntry } from '@/lib/content';
import { articleNode, faqPageNode, graph } from '@/lib/seo/jsonld';
import styles from '@/components/editorial/Editorial.module.scss';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entry = await getContentEntry('actualites', (await params).slug);
  if (!entry) notFound();
  return editorialMetadata({
    title: entry.title,
    description: entry.description,
    decision: editorialDecision(entry.href),
    type: 'article',
  });
}

export default async function NewsItemPage({ params }: Props) {
  const { slug } = await params;
  await connection();
  const page = await getSectionPage('actualites', slug);
  if (!page) notFound();
  const { entry, related, shop } = page;
  const faqId = freeAnchor('questions-frequentes', entry.headings);
  const edited = entry.updated.getTime() !== entry.published.getTime();
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb
          items={[
            { label: 'Accueil', href: '/' },
            { label: 'Actualités', href: NEWS_PATH },
            { label: entry.title },
          ]}
          currentPath={entry.href}
        />
        <EditorialHeader
          eyebrow="Actualité"
          title={entry.title}
          lead={entry.description}
          updated={edited ? entry.updated : null}
        >
          <UpdatedOn date={entry.published} prefix="Publié le" />
        </EditorialHeader>
        <ArticleLayout
          headings={entry.headings}
          extra={
            entry.faq.length ? [{ id: faqId, text: FAQ_TITLE }] : undefined
          }
        >
          <Prose html={entry.html} />
          <FaqSection entries={entry.faq} id={faqId} />
        </ArticleLayout>
        <ShopSection
          products={shop.products}
          landings={shop.landings}
          id="actualite-boutique-titre"
        />
        <ContentSection
          id="actualite-lire-aussi-titre"
          title="À lire aussi"
          entries={related}
        />
      </Container>
      <JsonLd
        data={graph(
          articleNode({
            type: 'BlogPosting',
            path: entry.href,
            headline: entry.title,
            description: entry.description,
            dateModified: entry.updated,
            datePublished: entry.published,
          }),
          faqPageNode(entry.faq),
        )}
      />
    </main>
  );
}
