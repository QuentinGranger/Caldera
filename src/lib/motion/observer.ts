import {
  clamp,
  sceneBeats,
  sceneProgress,
  storyBlend,
  storyPosition,
} from './scene';

/** Optional presentation; no observer support or reduced motion means static content. */
export function observeScrollScenes() {
  const scenes = Array.from(
    document.querySelectorAll<HTMLElement>('[data-scroll-scene]'),
  );
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wide = window.matchMedia('(min-width: 64rem) and (min-height: 42rem)');
  if (!('IntersectionObserver' in window)) return;
  let frame = 0;
  let dispose = () => {};
  const configure = () => {
    dispose();
    if (reduced.matches) return;
    const active = new Set<HTMLElement>();
    const pointed = new Map<HTMLElement, number>();
    const paint = () => {
      frame = 0;
      // Read geometry together, before touching styles: no read/write thrashing.
      const measures = [...active].map((scene) => ({
        scene,
        rect: scene.getBoundingClientRect(),
      }));
      for (const { scene, rect } of measures) {
        const kind = scene.dataset.scrollScene;
        const pinned =
          wide.matches && (kind === 'hero' || kind === 'territories');
        const progress = sceneProgress(
          rect.top,
          rect.height,
          window.innerHeight,
          pinned,
        );
        scene.style.setProperty('--scene-progress', progress.toFixed(4));
        if (kind === 'hero') {
          if (wide.matches && storyBlend(progress) >= 0.95)
            scene.dataset.heroPast = '';
          else delete scene.dataset.heroPast;
          scene.style.setProperty(
            '--story-blend',
            storyBlend(progress).toFixed(4),
          );
          scene.style.setProperty(
            '--story-position',
            storyPosition(progress).toFixed(4),
          );
        }
        const count = kind === 'hero' ? 4 : kind === 'territories' ? 5 : 0;
        const beatProgress =
          kind === 'hero' ? clamp((progress - 0.4) / 0.6) : progress;
        (pointed.has(scene)
          ? Array.from({ length: count }, (_, i) =>
              i === pointed.get(scene) ? 1 : 0,
            )
          : sceneBeats(beatProgress, count)
        ).forEach((weight, index) => {
          scene.style.setProperty(`--scene-beat-${index}`, weight.toFixed(4));
        });
      }
    };
    const schedule = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(paint);
    };
    const onScroll = () => {
      pointed.clear();
      schedule();
    };
    const onPointer = (event: PointerEvent) => {
      const link = (event.target as Element | null)?.closest?.(
        'a[data-territory]',
      );
      const scene = link?.closest<HTMLElement>(
        '[data-scroll-scene="territories"]',
      );
      if (!wide.matches || !scene) {
        if (pointed.size) {
          pointed.clear();
          schedule();
        }
        return;
      }
      const index = Number(link?.getAttribute('data-territory'));
      if (pointed.get(scene) !== index) {
        pointed.set(scene, index);
        schedule();
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const scene = entry.target as HTMLElement;
          if (entry.isIntersecting) active.add(scene);
          else active.delete(scene);
        }
        schedule();
      },
      { rootMargin: '160px 0px' },
    );
    for (const scene of scenes) {
      scene.dataset.sceneReady = '';
      observer.observe(scene);
    }
    // Compute initial state in the layout effect, including history restoration.
    scenes.forEach((scene) => active.add(scene));
    paint();
    active.clear();
    const resize =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(schedule);
    scenes.forEach((scene) => resize?.observe(scene));
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    document.addEventListener('visibilitychange', schedule);
    document.addEventListener('pointermove', onPointer, { passive: true });
    dispose = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      observer.disconnect();
      resize?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
      document.removeEventListener('pointermove', onPointer);
      for (const scene of scenes) {
        delete scene.dataset.sceneReady;
        delete scene.dataset.heroPast;
        for (const name of [
          '--scene-progress',
          '--story-blend',
          '--story-position',
          ...Array.from({ length: 5 }, (_, i) => `--scene-beat-${i}`),
        ])
          scene.style.removeProperty(name);
      }
    };
  };
  configure();
  reduced.addEventListener('change', configure);
  wide.addEventListener('change', configure);
  return () => {
    dispose();
    reduced.removeEventListener('change', configure);
    wide.removeEventListener('change', configure);
  };
}
