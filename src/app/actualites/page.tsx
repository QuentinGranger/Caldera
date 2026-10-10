import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container } from '@/components/ui/Container/Container';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { JsonLd } from '@/components/seo/JsonLd';
import { NewsletterCta } from '@/components/newsletter/NewsletterCta';
import { editorialMetadata } from '@/components/editorial/editorial';
import {
  ContentCards,
  EditorialHeader,
} from '@/components/editorial/EditorialParts';
import { NEWS_PATH, getNewsIndex } from '@/components/editorial/sections';
import { collectionPageNode, graph, itemListNode } from '@/lib/seo/jsonld';
import styles from '@/components/editorial/Editorial.module.scss';

export async function generateMetadata(): Promise<Metadata> {
  const index = await getNewsIndex();
  if (!index.entries.length) redirect('/guides');
  return editorialMetadata({ ...index.text, decision: index.decision });
}

export default async function NewsPage() {
  const index = await getNewsIndex();
  if (!index.entries.length) redirect('/guides');
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb
          items={[{ label: 'Accueil', href: '/' }, { label: 'Actualités' }]}
          currentPath={NEWS_PATH}
        />
        <EditorialHeader
          eyebrow="Actualités"
          title={index.heading}
          lead={index.summary}
        />
        <ContentCards entries={index.entries} showKind={false} published wide />
        <NewsletterCta title="Ne manquez aucune nouvelle de Caldera">
          Recevez les prochaines actualités, les réassorts et les nouvelles
          extensions après confirmation de votre adresse.
        </NewsletterCta>
      </Container>
      {index.entries.length > 0 && (
        <JsonLd
          data={graph(
            collectionPageNode({
              path: NEWS_PATH,
              name: index.heading,
              description: index.summary,
              mainEntity: itemListNode(
                index.entries.map((entry) => ({
                  path: entry.href,
                  name: entry.title,
                })),
              ),
            }),
          )}
        />
      )}
    </main>
  );
}
