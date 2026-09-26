import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container/Container';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  getGlossaryIndex,
  getGuidesIndex,
} from '@/components/editorial/content';
import {
  GLOSSARY_PATH,
  GUIDES_PATH,
  editorialMetadata,
  lowerFirst,
} from '@/components/editorial/editorial';
import { EditorialHeader } from '@/components/editorial/EditorialParts';
import { definedTermSetNode, graph } from '@/lib/seo/jsonld';
import { truncateAtWord } from '@/lib/seo/metadata';
import styles from '@/components/editorial/Editorial.module.scss';

const DEFINITION_MAX = 220;

export async function generateMetadata(): Promise<Metadata> {
  const index = await getGlossaryIndex();
  return editorialMetadata({ ...index.text, decision: index.decision });
}

export default async function GlossaryPage() {
  const [index, guides] = await Promise.all([
    getGlossaryIndex(),
    getGuidesIndex(),
  ]);
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb
          items={[{ label: 'Accueil', href: '/' }, { label: 'Glossaire' }]}
          currentPath={GLOSSARY_PATH}
        />
        <EditorialHeader
          eyebrow="Glossaire"
          title={index.heading}
          lead={index.summary}
          updated={index.updated}
        >
          {guides.decision.index && (
            <p>
              Voir aussi les{' '}
              <Link href={GUIDES_PATH}>{lowerFirst(guides.heading)}</Link> (
              {guides.counts}).
            </p>
          )}
        </EditorialHeader>

        {index.letters.length > 1 && (
          <nav className={styles.letters} aria-label="Index alphabétique">
            <ol>
              {index.letters.map((group) => (
                <li key={group.id}>
                  <a
                    href={`#${group.id}`}
                    aria-label={
                      group.letter === '#'
                        ? 'Autres termes'
                        : `Lettre ${group.letter}`
                    }
                  >
                    {group.letter}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {index.letters.map((group) => (
          <section
            key={group.id}
            id={group.id}
            className={styles.letter}
            aria-labelledby={`${group.id}-titre`}
          >
            <h2 id={`${group.id}-titre`}>{group.letter}</h2>
            <dl className={styles.terms}>
              {group.entries.map((entry) => (
                <div key={entry.slug}>
                  <dt>
                    <Link href={entry.href}>{entry.title}</Link>
                  </dt>
                  <dd>
                    {truncateAtWord(
                      entry.definition ?? entry.description,
                      DEFINITION_MAX,
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </Container>
      {index.terms.length > 0 && (
        <JsonLd
          data={graph(
            definedTermSetNode({
              path: GLOSSARY_PATH,
              name: index.heading,
              description: index.summary,
              terms: index.terms.map((entry) => ({
                path: entry.href,
                name: entry.title,
              })),
            }),
          )}
        />
      )}
    </main>
  );
}
