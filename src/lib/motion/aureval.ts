import { gsap } from 'gsap';
import { depthPoint } from './depth';

/** Animate inside a fixed, masked frame; never move the section or its edges. */
export function observeAureval(root: HTMLElement) {
  const section = root.closest('section');
  const far = root.querySelector('[data-aureval-far]');
  const near = root.querySelector('[data-aureval-near]');
  if (!section || !far || !near || !('IntersectionObserver' in window)) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 47.99rem)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  let dispose = () => {};

  const configure = () => {
    dispose();
    dispose = () => {};
    if (reduced.matches) {
      root.dataset.aurevalMotion = 'still';
      return;
    }
    let visible = false;
    let frame = 0;
    let aim = { x: 0, y: 0 };
    let ambient: gsap.core.Timeline | undefined;
    let steer: (x: number, y: number, scroll: number) => void = () => {};
    const strength = mobile.matches ? 0.45 : 1;
    const context = gsap.context(() => {
      ambient = gsap.timeline({ paused: true });
      const lamps = root.querySelectorAll('[data-aureval-lamp]');
      lamps.forEach((lamp, index) => {
        ambient!.fromTo(
          lamp,
          { opacity: 0.3 + (index % 3) * 0.08 },
          {
            // Unequal stages avoid every window breathing in the same rhythm.
            keyframes: [
              { opacity: 0.65, duration: 1.8 + index * 0.23 },
              { opacity: 0.42, duration: 0.7 + index * 0.09 },
              { opacity: 0.75, duration: 1.1 + index * 0.17 },
              { opacity: 0.3 + (index % 3) * 0.08, duration: 2.4 },
            ],
            repeat: -1,
            ease: 'sine.inOut',
          },
          0,
        );
      });
      root
        .querySelectorAll('[data-aureval-ripple]')
        .forEach((ripple, index) => {
          ambient!.fromTo(
            ripple,
            { opacity: 0.04 + (index % 3) * 0.025, x: index % 2 ? -2 : 2 },
            {
              opacity: 0.32 + (index % 4) * 0.06,
              x: index % 2 ? 3 : -3,
              y: index % 2 ? 0.6 : -0.6,
              duration: 2.6 + (index % 5) * 0.71,
              repeat: -1,
              yoyo: true,
              ease: 'sine.inOut',
            },
            0,
          );
        });
      const options = { duration: 1.15, ease: 'power3.out' };
      const farX = gsap.quickTo(far, 'x', options);
      const farY = gsap.quickTo(far, 'y', options);
      const nearX = gsap.quickTo(near, 'x', options);
      const nearY = gsap.quickTo(near, 'y', options);
      steer = (x, y, scroll) => {
        farX(-x * 3.5 * strength);
        farY((scroll * 5 - y * 2) * strength);
        nearX(-x * 10 * strength);
        nearY((scroll * 13 - y * 4) * strength);
      };
    }, root);

    const paint = () => {
      frame = 0;
      if (!visible || document.hidden) return;
      const rect = section.getBoundingClientRect();
      const progress = Math.max(
        0,
        Math.min(1, (innerHeight - rect.top) / (innerHeight + rect.height)),
      );
      steer(aim.x, aim.y, 0.5 - progress);
    };
    const schedule = () => {
      if (visible && !document.hidden && !frame)
        frame = requestAnimationFrame(paint);
    };
    const sync = () => {
      const running = visible && !document.hidden;
      if (!running) {
        cancelAnimationFrame(frame);
        frame = 0;
        aim = { x: 0, y: 0 };
      }
      ambient?.paused(!running);
      root.dataset.aurevalMotion = running ? 'running' : 'paused';
      if (running) schedule();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      sync();
    });
    const move = (event: PointerEvent) => {
      if (!pointer.matches || mobile.matches || event.pointerType !== 'mouse')
        return;
      const rect = section.getBoundingClientRect();
      aim = depthPoint(
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height,
      );
      schedule();
    };
    const leave = () => {
      aim = { x: 0, y: 0 };
      schedule();
    };
    observer.observe(section);
    root.dataset.aurevalMotion = 'paused';
    section.addEventListener('pointermove', move, { passive: true });
    section.addEventListener('pointerleave', leave);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', sync);
    dispose = () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      section.removeEventListener('pointermove', move);
      section.removeEventListener('pointerleave', leave);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', sync);
      context.revert();
      delete root.dataset.aurevalMotion;
    };
  };
  configure();
  reduced.addEventListener('change', configure);
  mobile.addEventListener('change', configure);
  return () => {
    dispose();
    delete root.dataset.aurevalMotion;
    reduced.removeEventListener('change', configure);
    mobile.removeEventListener('change', configure);
  };
}
