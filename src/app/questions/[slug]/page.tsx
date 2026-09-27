import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Container } from '@/components/ui/Container/Container';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  editorialDecision,
  editorialMetadata,
  splitLead,
} from '@/components/editorial/editorial';
import {
  ContentSection,
  EditorialHeader,
  FaqSection,
  Prose,
  ShopSection,
} from '@/components/editorial/EditorialParts';
import {
  QUESTIONS_PATH,
  getSectionPage,
} from '@/components/editorial/sections';
import { getContentEntry } from '@/lib/content';
import { articleNode, faqPageNode, graph } from '@/lib/seo/jsonld';
import styles from '@/components/editorial/Editorial.module.scss';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entry = await getContentEntry('questions', (await params).slug);
  if (!entry) notFound();
  return editorialMetadata({
    title: entry.title,
    description: entry.description,
    decision: editorialDecision(entry.href),
    type: 'article',
  });
}

export default async function QuestionPage({ params }: Props) {
  const { slug } = await params;
  await connection();
  const page = await getSectionPage('questions', slug);
  if (!page) notFound();
  const { entry, related, shop } = page;
  const { lead, rest } = splitLead(entry.html);
  // The question (h1) and its direct answer are visible: same pair in FAQPage.
  const faq = [
    ...(entry.definition
      ? [{ question: entry.title, answer: entry.definition }]
      : []),
    ...entry.faq,
  ];
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb
          items={[
            { label: 'Accueil', href: '/' },
            { label: 'Questions', href: QUESTIONS_PATH },
            { label: entry.title },
          ]}
          currentPath={entry.href}
        />
        <EditorialHeader
          eyebrow="Question"
          title={entry.title}
          updated={entry.updated}
        />
        <div className={styles.single}>
          {lead !== null && (
            <div className={styles.definition}>
              <p className={styles.definitionLabel}>En bref</p>
              <p
                className={styles.definitionText}
                dangerouslySetInnerHTML={{ __html: lead }}
              />
            </div>
          )}
          <Prose html={rest} />
          <FaqSection entries={entry.faq} id="question-faq-titre" />
        </div>
        <ShopSection
          products={shop.products}
          landings={shop.landings}
          id="question-boutique-titre"
        />
        <ContentSection
          id="question-lire-aussi-titre"
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
            datePublished: entry.published,
          }),
          faqPageNode(faq),
        )}
      />
    </main>
  );
}
