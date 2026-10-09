const clamp = (value: number) =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = (value: number) => {
  const p = clamp(value);
  return p * p * (3 - 2 * p);
};

/** Content has settled before it reaches the upper reading area. */
export function itemReveal(top: number, viewport: number) {
  return smooth((viewport * 0.95 - top) / Math.max(1, viewport * 0.7));
}

export function chapterFlow(top: number, height: number, viewport: number) {
  if (
    ![top, height, viewport].every(Number.isFinite) ||
    height <= 0 ||
    viewport <= 0
  )
    return { progress: 0, arrival: 1, departure: 0 };
  return {
    progress: smooth((viewport - top) / (viewport + height)),
    arrival: smooth((viewport - top) / viewport),
    departure: smooth((viewport - top - height) / viewport),
  };
}

/** Demand-driven motion on real visuals. Text, layout and native scroll stay stable. */
export function observeHomeJourney() {
  const chapters = Array.from(
    document.querySelectorAll<HTMLElement>('[data-home-chapter]'),
  );
  const items = Array.from(
    document.querySelectorAll<HTMLElement>('[data-journey-item]'),
  );
  if (!chapters.length || !('IntersectionObserver' in window)) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let dispose = () => {};
  const configure = () => {
    dispose();
    if (reduced.matches) return;
    const active = new Set<HTMLElement>();
    // Next Link measures fragments before updating :target. Settle the relevant
    // visuals before its measurement, without intercepting the native navigation.
    const settleAnchor = (hash: string) => {
      chapters.forEach((node) =>
        node
          .querySelector('[data-home-anchor]')
          ?.removeAttribute('data-home-anchor'),
      );
      if (!hash.startsWith('#')) return;
      try {
        document
          .getElementById(decodeURIComponent(hash.slice(1)))
          ?.closest<HTMLElement>('[data-home-camera]')
          ?.setAttribute('data-home-anchor', '');
      } catch {
        /* Malformed fragments must not interrupt navigation. */
      }
    };
    const onAnchorClick = (event: MouseEvent) => {
      const href = (event.target as Element | null)
        ?.closest?.('a[href]')
        ?.getAttribute('href');
      if (href?.startsWith('#')) settleAnchor(href);
    };
    const onHashChange = () => settleAnchor(location.hash);
    settleAnchor(location.hash);
    let frame = 0;
    const paint = () => {
      frame = 0;
      // Stable wrappers only; batch all geometry reads before all style writes.
      const measures = [...active].map((node) => ({
        node,
        rect: node.getBoundingClientRect(),
      }));
      for (const { node, rect } of measures) {
        if (node.hasAttribute('data-journey-item')) {
          node.style.setProperty(
            '--item-reveal',
            itemReveal(rect.top, innerHeight).toFixed(4),
          );
        } else {
          const flow = chapterFlow(rect.top, rect.height, innerHeight);
          node.style.setProperty(
            '--journey-progress',
            flow.progress.toFixed(4),
          );
        }
      }
    };
    const schedule = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(paint);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const node = entry.target as HTMLElement;
          if (entry.isIntersecting) active.add(node);
          else active.delete(node);
        }
        schedule();
      },
      { rootMargin: '180px 0px' },
    );
    const nodes = [...chapters, ...items];
    nodes.forEach((node) => {
      active.add(node);
      observer.observe(node);
    });
    paint();
    active.clear();
    chapters.forEach((node) => (node.dataset.homeJourneyReady = ''));
    const resize =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(schedule);
    nodes.forEach((node) => resize?.observe(node));
    document.addEventListener('click', onAnchorClick, true);
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    document.addEventListener('visibilitychange', schedule);
    dispose = () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize?.disconnect();
      document.removeEventListener('click', onAnchorClick, true);
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
      chapters.forEach((node) => {
        node
          .querySelector('[data-home-anchor]')
          ?.removeAttribute('data-home-anchor');
        delete node.dataset.homeJourneyReady;
        node.style.removeProperty('--journey-progress');
      });
      items.forEach((node) => node.style.removeProperty('--item-reveal'));
    };
  };
  configure();
  reduced.addEventListener('change', configure);
  return () => {
    dispose();
    reduced.removeEventListener('change', configure);
  };
}
