'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Admin.module.scss';
import { revealAdminSection } from './reveal-section';

type Section = { id: string; label: string; count?: number };

/** Real anchors remain usable before hydration; JavaScript adds scroll tracking. */
export function DetailNavigation({ sections }: { sections: Section[] }) {
  const nav = useRef<HTMLElement>(null);
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      const threshold = (nav.current?.getBoundingClientRect().bottom ?? 0) + 24;
      let current = sections[0]?.id;
      for (const section of sections) {
        const target = document.getElementById(section.id);
        if (target && target.getBoundingClientRect().top <= threshold)
          current = section.id;
      }
      // Short final sections cannot always reach the top of the viewport.
      if (
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 4
      )
        current = sections.at(-1)?.id;
      setActive(current);
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    function followHash() {
      const id = window.location.hash.slice(1);
      if (!sections.some((section) => section.id === id)) return;
      revealAdminSection(id);
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
      schedule();
    }
    followHash();
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', followHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', followHash);
    };
  }, [sections]);

  return (
    <nav
      ref={nav}
      className={styles.detailNavigation}
      aria-label="Sections de la fiche"
    >
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          aria-current={active === section.id ? 'location' : undefined}
          onClick={() => revealAdminSection(section.id)}
        >
          {section.label}
          {section.count !== undefined && <span>{section.count}</span>}
        </a>
      ))}
    </nav>
  );
}
