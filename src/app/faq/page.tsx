import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown, Compass, MoveUpRight } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import { faqSections } from '@/data/faq';
import styles from './faq.module.scss';

export const metadata: Metadata = {
  title: 'FAQ | Les Terres de Caldera',
  description:
    'Retrouvez les réponses aux questions fréquentes sur les commandes, produits Pokémon, paiements, livraisons et retours.',
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqSections.flatMap((section) =>
    section.items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer.join('\n\n'),
      },
    })),
  ),
};

export default function FaqPage() {
  return (
    <main id="contenu" className={styles.main}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c'),
        }}
      />

      <header className={styles.hero}>
        <Container className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Le comptoir des voyageurs</p>
            <h1>Questions fréquentes</h1>
            <p className={styles.intro}>
              Retrouvez les réponses aux questions les plus fréquentes
              concernant nos produits, vos commandes, la livraison et le
              fonctionnement de la boutique.
            </p>
          </div>
          <Compass className={styles.compass} aria-hidden="true" />
        </Container>
      </header>

      <Container className={styles.layout}>
        <aside className={styles.aside}>
          <nav aria-label="Sommaire de la FAQ">
            <p>Choisir un territoire</p>
            <ol>
              {faqSections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <div className={styles.content}>
          {faqSections.map((section, sectionIndex) => (
            <section
              id={section.id}
              className={styles.section}
              key={section.id}
              aria-labelledby={`${section.id}-title`}
            >
              <header className={styles.sectionHeading}>
                <span>{String(sectionIndex + 1).padStart(2, '0')}</span>
                <div>
                  <p>{section.eyebrow}</p>
                  <h2 id={`${section.id}-title`}>{section.title}</h2>
                </div>
              </header>
              <div className={styles.questions}>
                {section.items.map((item) => (
                  <details key={item.question} className={styles.question}>
                    <summary>
                      <span>{item.question}</span>
                      <ChevronDown aria-hidden="true" />
                    </summary>
                    <div className={styles.answer}>
                      {item.answer.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}

          <section
            id="besoin-aide"
            className={styles.help}
            aria-labelledby="help-title"
          >
            <div>
              <p className={styles.eyebrow}>
                Une question reste sans réponse ?
              </p>
              <h2 id="help-title">Besoin d’aide ?</h2>
              <p>
                Contactez-nous en indiquant, lorsque cela concerne une commande,
                votre numéro de commande. Nous ferons notre possible pour vous
                répondre rapidement.
              </p>
            </div>
            <Link href="/contact" className={styles.helpLink}>
              Nous contacter
              <MoveUpRight aria-hidden="true" />
            </Link>
          </section>
        </div>
      </Container>
    </main>
  );
}
