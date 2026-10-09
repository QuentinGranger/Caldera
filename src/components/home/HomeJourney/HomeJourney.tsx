import type { CSSProperties, ReactNode } from 'react';
import styles from './HomeJourney.module.scss';

export type HomeChapter = {
  key: string;
  content: ReactNode;
  passage: string;
  motif: 'orbit' | 'cards' | 'pages' | 'compass';
  start: string;
  end: string;
  pinned?: boolean;
};

/** Actual rendered chapters only: an empty catalogue never creates an empty passage. */
export function HomeJourney({ chapters }: { chapters: HomeChapter[] }) {
  return chapters.map((chapter, index) => (
    <div
      key={chapter.key}
      className={styles.chapter}
      data-home-chapter={chapter.key}
    >
      {index > 0 && (
        <div
          className={styles.passage}
          data-home-passage
          data-motif={chapter.motif}
          aria-hidden="true"
          style={
            {
              '--passage-from': chapters[index - 1]!.end,
              '--passage-to': chapter.start,
              '--passage-ink':
                chapter.start.startsWith('#f') || chapter.start === '#ebe5d7'
                  ? '#526746'
                  : '#e8c261',
            } as CSSProperties
          }
        >
          <div className={styles.light} />
          <div className={styles.horizon} />
          <div className={styles.object}>
            <span className={styles.plane} />
            <span className={styles.plane} />
            <span className={styles.plane} />
            <span className={styles.needle} />
          </div>
          <div className={styles.caption}>
            <span>{String(index).padStart(2, '0')}</span>
            <span>{chapter.passage}</span>
          </div>
          <span className={styles.thread} />
        </div>
      )}
      <div
        className={styles.camera}
        data-home-camera={chapter.pinned ? 'pinned' : 'free'}
        style={{ '--chapter-ground': chapter.start } as CSSProperties}
      >
        <div className={styles.body}>{chapter.content}</div>
      </div>
    </div>
  ));
}
