const clamp = (value: number) =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = (value: number) => {
  const p = clamp(value);
  return p * p * (3 - 2 * p);
};

/** Geometry is measured on the untransformed wrapper, never on the moving content. */
export function passagePose(top: number, height: number, viewport: number) {
  const p = clamp((viewport - top) / Math.max(1, viewport + height));
  const travel = smooth(p);
  const presence = Math.sin(Math.PI * p);
  return {
    turn: -70 + 140 * travel,
    tilt: 65 - 95 * travel,
    roll: -35 + 70 * travel,
    scale: 0.55 + presence * 0.65,
    travel: -18 + 36 * travel,
    glow: presence * 0.95,
    caption: smooth((presence - 0.2) / 0.65),
    thread: smooth((p - 0.3) / 0.45),
  };
}
export function chapterCamera(top: number, bottom: number, viewport: number) {
  const enter = smooth((viewport - top) / Math.max(1, viewport * 0.8));
  const exit = smooth((viewport * 0.4 - bottom) / Math.max(1, viewport * 0.4));
  return {
    lift: (1 - enter) * 72 - exit * 24,
    tilt: (1 - enter) * 4,
    scale: 0.94 + enter * 0.06 - exit * 0.025,
    opacity: 0.55 + enter * 0.45,
  };
}

export function observeHomeJourney() {
  const chapters = Array.from(
    document.querySelectorAll<HTMLElement>('[data-home-chapter]'),
  );
  const passages = Array.from(
    document.querySelectorAll<HTMLElement>('[data-home-passage]'),
  );
  if (!chapters.length || !('IntersectionObserver' in window)) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let dispose = () => {};
  const configure = () => {
    dispose();
    if (reduced.matches) return;
    const active = new Set<HTMLElement>();
    let frame = 0;
    const paint = () => {
      frame = 0;
      const measures = [...active].map((node) => ({
        node,
        rect: (node.hasAttribute('data-home-passage')
          ? node
          : (node.querySelector<HTMLElement>('[data-home-camera]') ?? node)
        ).getBoundingClientRect(),
      }));
      for (const { node, rect } of measures) {
        if (node.hasAttribute('data-home-passage')) {
          const pose = passagePose(rect.top, rect.height, innerHeight);
          for (const [key, value] of Object.entries(pose)) {
            const unit = ['turn', 'tilt', 'roll'].includes(key)
              ? 'deg'
              : key === 'travel'
                ? 'vw'
                : '';
            node.style.setProperty(
              `--passage-${key}`,
              `${value.toFixed(4)}${unit}`,
            );
          }
        } else {
          const pose = chapterCamera(rect.top, rect.bottom, innerHeight);
          for (const [key, value] of Object.entries(pose))
            node.style.setProperty(
              `--chapter-${key}`,
              `${value.toFixed(4)}${key === 'lift' ? 'px' : key === 'tilt' ? 'deg' : ''}`,
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
    const nodes = [...chapters, ...passages];
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
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    document.addEventListener('visibilitychange', schedule);
    dispose = () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
      chapters.forEach((node) => {
        delete node.dataset.homeJourneyReady;
        ['lift', 'tilt', 'scale', 'opacity'].forEach((key) =>
          node.style.removeProperty(`--chapter-${key}`),
        );
      });
      passages.forEach((node) =>
        [
          'turn',
          'tilt',
          'roll',
          'scale',
          'travel',
          'glow',
          'caption',
          'thread',
        ].forEach((key) => node.style.removeProperty(`--passage-${key}`)),
      );
    };
  };
  configure();
  reduced.addEventListener('change', configure);
  return () => {
    dispose();
    reduced.removeEventListener('change', configure);
  };
}
