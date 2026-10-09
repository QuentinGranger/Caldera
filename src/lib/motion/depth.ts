/** Bounded pointer input: decorative motion must never escape its stage. */
export function depthPoint(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const axis = (position: number, size: number) =>
    !Number.isFinite(position) || !Number.isFinite(size) || size <= 0
      ? 0
      : Math.max(-1, Math.min(1, (position / size) * 2 - 1));
  return { x: axis(x, width), y: axis(y, height) };
}

/** Real imagery only. Native scroll, touch gestures and content geometry are untouched. */
export function observeHomeDepth() {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-depth-stage], [data-depth-landscape]',
    ),
  );
  if (!nodes.length || !('IntersectionObserver' in window)) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let dispose = () => {};
  const configure = () => {
    dispose();
    if (reduced.matches) return;
    const active = new Set<HTMLElement>();
    let point: { x: number; y: number } | undefined;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const measures = [...active].map((node) => ({
        node,
        rect: node.getBoundingClientRect(),
      }));
      for (const { node, rect } of measures) {
        const over =
          point &&
          point.x >= rect.left &&
          point.x <= rect.right &&
          point.y >= rect.top &&
          point.y <= rect.bottom;
        const aim =
          point && over && pointer.matches
            ? depthPoint(
                point.x - rect.left,
                point.y - rect.top,
                rect.width,
                rect.height,
              )
            : { x: 0, y: 0 };
        const scroll = depthPoint(
          0,
          innerHeight - rect.top,
          1,
          innerHeight + rect.height,
        ).y;
        node.style.setProperty('--depth-x', aim.x.toFixed(3));
        node.style.setProperty('--depth-y', aim.y.toFixed(3));
        node.style.setProperty('--depth-scroll', scroll.toFixed(3));
      }
    };
    const schedule = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(paint);
    };
    const move = (event: PointerEvent) => {
      if (!pointer.matches || event.pointerType !== 'mouse') return;
      point = { x: event.clientX, y: event.clientY };
      schedule();
    };
    const leave = () => {
      point = undefined;
      schedule();
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
      { rootMargin: '120px 0px' },
    );
    nodes.forEach((node) => {
      active.add(node);
      observer.observe(node);
    });
    paint();
    active.clear();
    nodes.forEach((node) => (node.dataset.depthReady = ''));
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    document.addEventListener('visibilitychange', leave);
    window.addEventListener('blur', leave);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    const resize =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(schedule);
    nodes.forEach((node) => resize?.observe(node));
    dispose = () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize?.disconnect();
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', leave);
      window.removeEventListener('blur', leave);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      nodes.forEach((node) => {
        delete node.dataset.depthReady;
        for (const name of ['--depth-x', '--depth-y', '--depth-scroll'])
          node.style.removeProperty(name);
      });
    };
  };
  configure();
  reduced.addEventListener('change', configure);
  pointer.addEventListener('change', configure);
  return () => {
    dispose();
    reduced.removeEventListener('change', configure);
    pointer.removeEventListener('change', configure);
  };
}
