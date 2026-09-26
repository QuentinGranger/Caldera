import styles from './Landing.module.scss';

/** Editorial intro written in the admin, already rendered to safe HTML. */
export function LandingEditorial({ html }: { html: string }) {
  if (!html) return null;
  return (
    <div
      className={styles.editorial}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
