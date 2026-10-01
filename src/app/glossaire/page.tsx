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
import editorial from '@/components/editorial/Editorial.module.scss';
import styles from '@/components/editorial/Glossary.module.scss';

const DEFINITION_MAX = 220;

export async function generateMetadata(): Promise<Metadata> {
  const index = await getGlossaryIndex();
  return editorialMetadata({ ...index.text, decision: index.decision });
}

interface Section {
  id: string;
  heading: string;
  /** Before the first term: a section's own paragraphs. */
  intro: string;
  terms: string[];
}

/**
 * The rendered document, one section per h2 (a letter or a theme) and one
 * block per h3 (a term). The HTML comes sanitized from src/lib/content.
 */
function sections(html: string): Section[] {
  return html
    .split(/(?=<h2[\s>])/)
    .filter((chunk) => chunk.startsWith('<h2'))
    .map((chunk) => {
      const end = chunk.indexOf('</h2>') + '</h2>'.length;
      const heading = chunk.slice(0, end);
      const [intro = '', ...terms] = chunk.slice(end).split(/(?=<h3[\s>])/);
      return {
        id: /id="([^"]+)"/.exec(heading)?.[1] ?? '',
        heading,
        intro: intro.trim(),
        terms,
      };
    });
}

export default async function GlossaryPage() {
  const [index, guides] = await Promise.all([
    getGlossaryIndex(),
    getGuidesIndex(),
  ]);
  const { document, fiches } = index;
  const [lead, ...intro] = document.intro;
  const letterIds = new Set(document.letters.map((letter) => letter.id));
  return (
    <main id="contenu" tabIndex={-1} className={editorial.main}>
      <Container>
        <Breadcrumb
          items={[{ label: 'Accueil', href: '/' }, { label: 'Glossaire' }]}
          currentPath={GLOSSARY_PATH}
        />
        <EditorialHeader
          eyebrow="Glossaire"
          title={document.title}
          lead={lead}
          updated={index.updated}
        >
          {intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {guides.decision.index && (
            <p>
              Voir aussi les{' '}
              <Link href={GUIDES_PATH}>{lowerFirst(guides.heading)}</Link> (
              {guides.counts}).
            </p>
          )}
        </EditorialHeader>

        {document.letters.length > 1 && (
          <nav className={editorial.letters} aria-label="Index alphabétique">
            <ol>
              {document.letters.map((letter) => (
                <li key={letter.id}>
                  <a
                    href={`#${letter.id}`}
                    aria-label={`Lettre ${letter.text}`}
                  >
                    {letter.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {(document.themes.length > 0 || fiches.length > 0) && (
          <nav className={styles.themes} aria-label="Repères du glossaire">
            <p>Repères</p>
            <ul>
              {document.themes.map((theme) => (
                <li key={theme.id}>
                  <a href={`#${theme.id}`}>{theme.text}</a>
                </li>
              ))}
              {fiches.length > 0 && (
                <li>
                  <a href="#fiches-detaillees">Fiches détaillées</a>
                </li>
              )}
            </ul>
          </nav>
        )}

        {sections(document.html).map((section) => {
          const letter = letterIds.has(section.id);
          return (
            <section
              key={section.id}
              className={letter ? styles.letter : styles.theme}
              aria-labelledby={section.id}
            >
              <div
                className={styles.heading}
                dangerouslySetInnerHTML={{ __html: section.heading }}
              />
              <div className={styles.entries}>
                {section.intro && (
                  <div
                    className={styles.sectionIntro}
                    dangerouslySetInnerHTML={{ __html: section.intro }}
                  />
                )}
                {section.terms.map((term, position) => (
                  <div
                    key={position}
                    className={styles.term}
                    dangerouslySetInnerHTML={{ __html: term }}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {fiches.length > 0 && (
          <section
            id="fiches-detaillees"
            className={styles.fiches}
            aria-labelledby="fiches-titre"
          >
            <h2 id="fiches-titre">Fiches détaillées</h2>
            <p>
              Pour aller plus loin, ces termes ont chacun leur page : usages,
              repères d’achat et liens vers les produits concernés.
            </p>
            <ul>
              {fiches.map((fiche) => (
                <li key={fiche.href}>
                  <Link href={fiche.href}>{fiche.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(document.signature || document.closing) && (
          <footer className={styles.closing}>
            {document.signature && <p>{document.signature}</p>}
            {document.closing && <p>{document.closing}</p>}
          </footer>
        )}
      </Container>
      {document.terms.length > 0 && (
        <JsonLd
          data={graph(
            definedTermSetNode({
              path: GLOSSARY_PATH,
              name: document.title,
              description: document.description,
              terms: document.terms.map((term) => ({
                path: `${GLOSSARY_PATH}#${term.id}`,
                name: term.text,
                description: truncateAtWord(term.definition, DEFINITION_MAX),
              })),
            }),
          )}
        />
      )}
    </main>
  );
}
