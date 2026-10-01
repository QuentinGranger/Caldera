import { Plus } from 'lucide-react';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import type { FaqEntry } from '@/lib/seo/types';
import styles from './Landing.module.scss';

/**
 * Visible FAQ, one question per line that opens in place: the answers stay
 * in the page (the FAQPage node describes them), shown on demand. The page
 * adds that node only when this is rendered.
 */
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
      <div className={styles.faq}>
        {entries.map((entry) => (
          <details key={entry.question} className={styles.faqItem}>
            <summary>
              <h3>{entry.question}</h3>
              <Plus size={18} aria-hidden="true" />
            </summary>
            <p>{entry.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
