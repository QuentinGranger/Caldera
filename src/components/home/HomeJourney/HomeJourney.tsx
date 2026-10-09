import type { CSSProperties, ReactNode } from 'react';
import styles from './HomeJourney.module.scss';

export type HomeChapter = {
  key: string;
  content: ReactNode;
  start: string;
  end: string;
  pinned?: boolean;
};

/** The content itself carries the handoff. No interstitial slide or extra scroll height. */
export function HomeJourney({ chapters }: { chapters: HomeChapter[] }) {
  return chapters.map((chapter, index) => (
    <div
      key={chapter.key}
      className={styles.chapter}
      data-home-chapter={chapter.key}
      style={
        {
          '--chapter-start': chapter.start,
          '--chapter-end': chapter.end,
          '--chapter-next': chapters[index + 1]?.start ?? chapter.end,
        } as CSSProperties
      }
    >
      <div
        className={styles.camera}
        data-home-camera={chapter.pinned ? 'pinned' : 'free'}
      >
        <div className={styles.body}>{chapter.content}</div>
      </div>
    </div>
  ));
}
