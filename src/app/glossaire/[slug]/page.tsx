import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Container } from '@/components/ui/Container/Container';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { JsonLd } from '@/components/seo/JsonLd';
import { getGlossaryTermPage } from '@/components/editorial/content';
import {
  GLOSSARY_PATH,
  editorialDecision,
  editorialMetadata,
  isGuideKind,
  splitLead,
} from '@/components/editorial/editorial';
import {
  ContentSection,
  EditorialHeader,
  FaqSection,
  Prose,
  ShopSection,
} from '@/components/editorial/EditorialParts';
import { getContentEntry } from '@/lib/content';
import { definedTermNode, faqPageNode, graph } from '@/lib/seo/jsonld';
import styles from '@/components/editorial/Editorial.module.scss';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entry = await getContentEntry('glossaire', (await params).slug);
  if (!entry) notFound();
  return editorialMetadata({
    title: `${entry.title} : définition`,
    description: entry.description,
    decision: editorialDecision(entry.href),
    type: 'article',
  });
}

export default async function GlossaryTermPage({ params }: Props) {
  const { slug } = await params;
  await connection();
  const page = await getGlossaryTermPage(slug);
  if (!page) notFound();
  const { entry, related, shop } = page;
  const { lead, rest } = splitLead(entry.html);
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb
          items={[
            { label: 'Accueil', href: '/' },
            { label: 'Glossaire', href: GLOSSARY_PATH },
            { label: entry.title },
          ]}
          currentPath={entry.href}
        />
        <EditorialHeader
          eyebrow="Glossaire"
          title={entry.title}
          updated={entry.updated}
        />
        <div className={styles.single}>
          {lead !== null && (
            <div className={styles.definition}>
              <p className={styles.definitionLabel}>Définition</p>
              <p
                className={styles.definitionText}
                dangerouslySetInnerHTML={{ __html: lead }}
              />
            </div>
          )}
          <Prose html={rest} />
          <FaqSection entries={entry.faq} id="terme-faq-titre" />
        </div>
        <ShopSection
          products={shop.products}
          landings={shop.landings}
          id="terme-boutique-titre"
        />
        <ContentSection
          id="terme-termes-titre"
          title="Termes liés"
          entries={related.filter((item) => item.kind === 'glossaire')}
          showKind={false}
        />
        <ContentSection
          id="terme-guides-titre"
          title="Guides liés"
          entries={related.filter((item) => isGuideKind(item.kind))}
        />
      </Container>
      <JsonLd
        data={graph(
          definedTermNode({
            path: entry.href,
            name: entry.title,
            description: entry.definition ?? entry.description,
            termSetPath: GLOSSARY_PATH,
          }),
          faqPageNode(entry.faq),
        )}
      />
    </main>
  );
}
