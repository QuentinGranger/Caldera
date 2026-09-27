import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container/Container';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  GLOSSARY_PATH,
  GUIDES_PATH,
  editorialMetadata,
} from '@/components/editorial/editorial';
import {
  ContentCards,
  EditorialHeader,
} from '@/components/editorial/EditorialParts';
import {
  QUESTIONS_PATH,
  getQuestionsIndex,
} from '@/components/editorial/sections';
import { collectionPageNode, graph, itemListNode } from '@/lib/seo/jsonld';
import styles from '@/components/editorial/Editorial.module.scss';

export async function generateMetadata(): Promise<Metadata> {
  const index = await getQuestionsIndex();
  return editorialMetadata({ ...index.text, decision: index.decision });
}

export default async function QuestionsPage() {
  const index = await getQuestionsIndex();
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb
          items={[{ label: 'Accueil', href: '/' }, { label: 'Questions' }]}
          currentPath={QUESTIONS_PATH}
        />
        <EditorialHeader
          eyebrow="Questions fréquentes"
          title={index.heading}
          lead={index.summary}
          updated={index.updated}
        >
          <p>
            Pour aller plus loin, consultez les{' '}
            <Link href={GUIDES_PATH}>guides d’achat et de collection</Link> et
            le <Link href={GLOSSARY_PATH}>glossaire</Link>.
          </p>
        </EditorialHeader>
        <ContentCards entries={index.entries} showKind={false} wide />
      </Container>
      {index.entries.length > 0 && (
        <JsonLd
          data={graph(
            collectionPageNode({
              path: QUESTIONS_PATH,
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
