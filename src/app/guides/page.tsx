import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container/Container';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { JsonLd } from '@/components/seo/JsonLd';
import { getGuidesIndex } from '@/components/editorial/content';
import {
  GLOSSARY_PATH,
  GUIDES_PATH,
  editorialMetadata,
  kindCount,
} from '@/components/editorial/editorial';
import {
  ContentCards,
  EditorialHeader,
} from '@/components/editorial/EditorialParts';
import { collectionPageNode, graph, itemListNode } from '@/lib/seo/jsonld';
import styles from '@/components/editorial/Editorial.module.scss';

export async function generateMetadata(): Promise<Metadata> {
  const index = await getGuidesIndex();
  return editorialMetadata({ ...index.text, decision: index.decision });
}

export default async function GuidesPage() {
  const index = await getGuidesIndex();
  const entries = index.groups.flatMap((group) => group.entries);
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb
          items={[{ label: 'Accueil', href: '/' }, { label: 'Guides' }]}
          currentPath={GUIDES_PATH}
        />
        <EditorialHeader
          eyebrow="Guides d’achat et de collection"
          title={index.heading}
          lead={index.summary}
          updated={index.updated}
        >
          {index.glossaryCount > 0 && (
            <p>
              Les termes employés sont expliqués dans le{' '}
              <Link href={GLOSSARY_PATH}>
                glossaire des cartes à collectionner
              </Link>{' '}
              ({kindCount('glossaire', index.glossaryCount)}).
            </p>
          )}
        </EditorialHeader>

        {index.groups.map((group) => (
          <section
            key={group.kind}
            className={styles.group}
            aria-labelledby={`groupe-${group.kind}`}
          >
            <h2 id={`groupe-${group.kind}`} className={styles.groupTitle}>
              {group.label}
            </h2>
            <ContentCards entries={group.entries} showKind={false} wide />
          </section>
        ))}
      </Container>
      {entries.length > 0 && (
        <JsonLd
          data={graph(
            collectionPageNode({
              path: GUIDES_PATH,
              name: index.heading,
              description: index.summary,
              mainEntity: itemListNode(
                entries.map((entry) => ({
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
