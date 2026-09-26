import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Container } from '@/components/ui/Container/Container';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { JsonLd } from '@/components/seo/JsonLd';
import { getGuidePage } from '@/components/editorial/content';
import {
  GUIDES_PATH,
  KIND_LABELS,
  editorialDecision,
  editorialMetadata,
} from '@/components/editorial/editorial';
import {
  ArticleLayout,
  ContentSection,
  EditorialHeader,
  FaqSection,
  Prose,
  ShopSection,
} from '@/components/editorial/EditorialParts';
import { getContentEntry } from '@/lib/content';
import { articleNode, faqPageNode, graph } from '@/lib/seo/jsonld';
import styles from '@/components/editorial/Editorial.module.scss';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entry = await getContentEntry('guides', (await params).slug);
  if (!entry) notFound();
  return editorialMetadata({
    title: entry.title,
    description: entry.description,
    decision: editorialDecision(entry.href),
    type: 'article',
  });
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  await connection();
  const page = await getGuidePage(slug);
  if (!page) notFound();
  const { entry, related, shop } = page;
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb
          items={[
            { label: 'Accueil', href: '/' },
            { label: 'Guides', href: GUIDES_PATH },
            { label: entry.title },
          ]}
          currentPath={entry.href}
        />
        <EditorialHeader
          eyebrow={KIND_LABELS[entry.kind]}
          title={entry.title}
          lead={entry.description}
          updated={entry.updated}
        />
        <ArticleLayout headings={entry.headings}>
          <Prose html={entry.html} />
          <FaqSection entries={entry.faq} id="guide-faq-titre" />
        </ArticleLayout>
        <ShopSection
          products={shop.products}
          landings={shop.landings}
          id="guide-boutique-titre"
        />
        <ContentSection
          id="guide-lire-aussi-titre"
          title="À lire aussi"
          entries={related}
        />
      </Container>
      <JsonLd
        data={graph(
          articleNode({
            path: entry.href,
            headline: entry.title,
            description: entry.description,
            dateModified: entry.updated,
          }),
          faqPageNode(entry.faq),
        )}
      />
    </main>
  );
}
