import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import type { FaqEntry } from '@/lib/seo/types';
import styles from './Landing.module.scss';

/** Visible FAQ; the page adds the FAQPage node only when this is rendered. */
export function LandingFaq({
  entries,
  subject,
}: {
  entries: readonly FaqEntry[];
  /** Eyebrow, e.g. the H1 of the page. */
  subject: string;
}) {
  if (!entries.length) return null;
  return (
    <section className={styles.section} aria-labelledby="questions">
      <SectionTitle
        id="questions"
        eyebrow={subject}
        title="Questions fréquentes"
      />
      <dl className={styles.faq}>
        {entries.map((entry) => (
          <div key={entry.question} className={styles.faqItem}>
            <dt>{entry.question}</dt>
            <dd>{entry.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
