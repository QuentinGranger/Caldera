import styles from './Reflection.module.scss';

/**
 * The threshold of the universe, once the shop has been seen: what Caldera
 * is for, before the card's story, the origins and the territories.
 */
export function Reflection() {
  return (
    <section className={styles.reflection} aria-labelledby="reflection-title">
      <p className={styles.eyebrow}>Les Terres de Caldera</p>
      <h2 id="reflection-title">
        Un univers pour{' '}
        <span className={styles.words}>
          {['collectionner.', 'jouer.', 'découvrir.', 'transmettre.'].map(
            (word) => (
              <span key={word}>{word} </span>
            ),
          )}
        </span>
      </h2>
      <p className={styles.note}>Une carte. Une histoire. La vôtre.</p>
    </section>
  );
}
