'use client';
import { useEffect } from 'react';
import { revealAdminSection } from './reveal-section';
/** Streaming can finish after the browser first tries to follow a GET form's hash. */
export function CommunicationAnchor({
  targets,
  revision,
}: {
  targets: string[];
  revision: string;
}) {
  useEffect(() => {
    let frame = 0;
    function follow() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let id = '';
        try {
          id = decodeURIComponent(window.location.hash.slice(1));
        } catch {
          return;
        }
        if (!targets.includes(id)) return;
        const target = revealAdminSection(id);
        if (!target) return;
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
        const heading = target.matches('h1,h2,h3')
          ? target
          : target.querySelector<HTMLElement>('h1,h2,h3,summary');
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      });
    }
    follow();
    window.addEventListener('hashchange', follow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', follow);
    };
  }, [targets, revision]);
  return null;
}
