import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
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
import { FaqHashOpener } from '@/components/editorial/FaqHashOpener';
import {
  QUESTIONS_PATH,
  getQuestionsIndex,
} from '@/components/editorial/sections';
import { getShopFaq, plainAnswer } from '@/components/editorial/shopFaq';
import { renderMarkdown } from '@/lib/content';
import { faqPageNode, graph } from '@/lib/seo/jsonld';
import { ORGANIZATION } from '@/lib/seo/policies';
import editorial from '@/components/editorial/Editorial.module.scss';
import styles from '@/components/editorial/Faq.module.scss';

export async function generateMetadata(): Promise<Metadata> {
  const index = await getQuestionsIndex();
  return editorialMetadata({ ...index.text, decision: index.decision });
}

export default async function QuestionsPage() {
  const [index, faq] = await Promise.all([getQuestionsIndex(), getShopFaq()]);
  return (
    <main id="contenu" tabIndex={-1} className={editorial.main}>
      <Container>
        <Breadcrumb
          items={[
            { label: 'Accueil', href: '/' },
            { label: 'Questions fréquentes' },
          ]}
          currentPath={QUESTIONS_PATH}
        />
        <EditorialHeader
          eyebrow="Aide"
          title={index.heading}
          lead={index.summary}
          updated={index.updated}
        >
          <p>
            Les réponses citent l’article concerné des{' '}
            <Link href="/cgv">conditions générales de vente</Link>, qui font
            foi.
          </p>
        </EditorialHeader>

        <nav className={styles.groups} aria-label="Thèmes des questions">
          <ul>
            {faq.map((group) => (
              <li key={group.id}>
                <a href={`#${group.id}`}>{group.title}</a>
              </li>
            ))}
            {index.entries.length > 0 && (
              <li>
                <a href="#cartes-pokemon">Les cartes Pokémon</a>
              </li>
            )}
          </ul>
        </nav>

        {faq.map((group) => (
          <section
            key={group.id}
            id={group.id}
            className={styles.group}
            aria-labelledby={`${group.id}-titre`}
          >
            <h2 id={`${group.id}-titre`}>{group.title}</h2>
            <div className={styles.items}>
              {group.items.map((item) => (
                <details key={item.id} id={item.id} className={styles.item}>
                  <summary>
                    <h3>{item.question}</h3>
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <div
                    className={styles.answer}
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(item.answer),
                    }}
                  />
                </details>
              ))}
            </div>
          </section>
        ))}

        {index.entries.length > 0 && (
          <section
            id="cartes-pokemon"
            className={styles.group}
            aria-labelledby="cartes-pokemon-titre"
          >
            <h2 id="cartes-pokemon-titre">Questions sur les cartes Pokémon</h2>
            <p className={styles.groupLead}>
              Une réponse directe, puis le détail, sur une page chacune. Voir
              aussi les <Link href={GUIDES_PATH}>guides</Link> et le{' '}
              <Link href={GLOSSARY_PATH}>glossaire</Link>.
            </p>
            <ContentCards entries={index.entries} showKind={false} wide />
          </section>
        )}

        <aside className={styles.contact} aria-labelledby="faq-contact">
          <h2 id="faq-contact">Vous ne trouvez pas votre réponse ?</h2>
          <p>
            Écrivez-nous depuis le{' '}
            <Link href="/contact">formulaire de contact</Link> ou à{' '}
            <a href={`mailto:${ORGANIZATION.email}`}>{ORGANIZATION.email}</a>,
            en indiquant votre numéro de commande s’il y en a une.
          </p>
        </aside>
      </Container>
      <FaqHashOpener />
      <JsonLd
        data={graph(
          faqPageNode(
            faq.flatMap((group) =>
              group.items.map((item) => ({
                question: item.question,
                answer: plainAnswer(item.answer),
              })),
            ),
          ),
        )}
      />
    </main>
  );
}
