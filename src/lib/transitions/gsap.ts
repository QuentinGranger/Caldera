import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import type { JourneyAnimator } from './runtime';

gsap.registerPlugin(SplitText);

/** One GSAP context owns every style and tween, including rapid-click cleanup. */
export function createJourneyAnimator(stage: HTMLElement): JourneyAnimator {
  const fog = stage.querySelector('.caldera-veil__mineral');
  const previous = stage.querySelector('.caldera-veil__previous');
  const progress = stage.querySelector('.caldera-veil__progress');
  const near = stage.querySelector('.caldera-veil__near');
  const light = stage.querySelector('.caldera-veil__light');
  const vignette = stage.querySelector('.caldera-veil__vignette');
  let context: gsap.Context | undefined;
  let timeline: gsap.core.Timeline | undefined;

  function reset() {
    context?.revert();
    context = undefined;
    timeline = undefined;
  }
  function animate(callback: () => void | (() => void)) {
    context ??= gsap.context(() => {});
    context.add(callback);
  }

  return {
    reset,
    depart() {
      reset();
      animate(() => {
        timeline = gsap.timeline({ id: 'caldera-departure' });
        const main = document.querySelector('main');
        if (main)
          timeline.to(
            main,
            { opacity: 0.94, duration: 0.14, ease: 'power2.out' },
            0,
          );
        if (fog)
          timeline.fromTo(
            fog,
            { opacity: 0, xPercent: -14, yPercent: 8, scale: 1 },
            {
              opacity: 0.45,
              xPercent: -6,
              yPercent: 3,
              duration: 0.18,
              ease: 'power2.out',
            },
            0,
          );
        if (near)
          timeline.fromTo(
            near,
            { opacity: 0, xPercent: 16, yPercent: 10 },
            {
              opacity: 0.35,
              xPercent: 8,
              yPercent: 4,
              duration: 0.2,
              ease: 'power2.out',
            },
            0,
          );
        if (light)
          timeline.fromTo(
            light,
            { opacity: 0, xPercent: -12 },
            { opacity: 0.3, xPercent: 0, duration: 0.24 },
            0,
          );
        if (progress)
          timeline.fromTo(
            progress,
            { xPercent: -100, autoAlpha: 0 },
            {
              xPercent: 390,
              autoAlpha: 1,
              duration: 0.9,
              repeat: -1,
              ease: 'none',
            },
            0.16,
          );
      });
    },
    arrive(name, milliseconds, complete) {
      // Kill the departure's tweens without reverting the fog's current pose.
      timeline?.kill();
      animate(() => {
        const mobile = window.matchMedia('(max-width: 47.99rem)').matches;
        const duration = milliseconds / 1000;
        const clones: HTMLElement[] = [];
        const direction =
          name === 'chapter-forward' ? 1 : name === 'chapter-back' ? -1 : 0;
        const main = document.querySelector('main');
        const layers = Array.from(
          document.querySelectorAll<HTMLElement>('[data-caldera-layer]'),
        ).filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.bottom > 0 && rect.top < window.innerHeight;
        });
        const scenery = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-caldera-landscape]:not([data-depth-landscape]), [data-caldera-landscape][data-depth-landscape] > img',
          ),
        );
        const scales = scenery.map(
          (element) => Number(gsap.getProperty(element, 'scale')) || 1,
        );
        const visuals = document.querySelectorAll('[data-caldera-visual]');
        timeline = gsap.timeline({
          id: 'caldera-page-transition',
          onComplete: complete,
          defaults: { ease: 'power3.out' },
        });
        if (progress)
          timeline.to(progress, { autoAlpha: 0, duration: 0.08 }, 0);
        if (main)
          timeline.fromTo(
            main,
            { opacity: 0.82 },
            { opacity: 1, duration: 0.28 },
            0,
          );
        if (previous)
          timeline.fromTo(
            previous,
            { opacity: 0.85, scale: 1, yPercent: 0 },
            {
              opacity: 0,
              scale: mobile ? 1.06 : 1.1,
              yPercent: -3,
              duration: duration * 0.62,
              ease: 'power3.out',
            },
            0,
          );
        if (scenery.length)
          timeline.fromTo(
            scenery,
            {
              scale: (index: number) => scales[index]! * (mobile ? 1.1 : 1.16),
              xPercent: direction ? direction * 2.2 : -0.8,
              yPercent: 2,
            },
            {
              scale: (index: number) => scales[index]!,
              xPercent: 0,
              yPercent: 0,
              duration,
              ease: 'power3.out',
            },
            0,
          );
        const copy = layers.filter((element) => {
          if (element.tagName !== 'H1' || document.fonts.status !== 'loaded')
            return true;
          // Split a visual twin so React always retains its original heading DOM.
          const clone = element.cloneNode(true) as HTMLElement;
          clone.removeAttribute('id');
          clone.removeAttribute('data-caldera-layer');
          clone.setAttribute('aria-hidden', 'true');
          clone.setAttribute('data-caldera-title-clone', '');
          Object.assign(clone.style, {
            position: 'absolute',
            top: `${element.offsetTop}px`,
            left: `${element.offsetLeft}px`,
            width: `${element.offsetWidth}px`,
            margin: '0',
            pointerEvents: 'none',
          });
          element.after(clone);
          try {
            const split = SplitText.create(clone, {
              type: 'lines',
              mask: 'lines',
              aria: 'hidden',
              linesClass: 'caldera-cinema-line',
            });
            clones.push(clone);
            gsap.set(element, { opacity: 0 });
            timeline!.fromTo(
              split.lines,
              { opacity: 0.15, yPercent: 110, x: direction * 12 },
              {
                opacity: 1,
                yPercent: 0,
                x: 0,
                duration: 0.54,
                stagger: mobile ? 0.055 : 0.075,
                ease: 'power4.out',
              },
              0.04,
            );
            return false;
          } catch {
            clone.remove();
            return true;
          }
        });
        if (copy.length)
          timeline.fromTo(
            copy,
            {
              opacity: 0,
              y: mobile ? 20 : 34,
              x: direction * 24,
              clipPath: 'inset(0% 0% 100% 0%)',
            },
            {
              opacity: 1,
              y: 0,
              x: 0,
              clipPath: 'inset(0% 0% 0% 0%)',
              duration: 0.5,
              stagger: mobile ? 0.035 : 0.055,
            },
            0.035,
          );
        if (visuals.length)
          timeline.fromTo(
            visuals,
            { opacity: 0, y: 30, scale: 0.92 },
            { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power4.out' },
            0.025,
          );
        if (fog)
          timeline.to(fog, { opacity: 0.55, duration: duration * 0.15 }, 0).to(
            fog,
            {
              opacity: 0,
              xPercent: 22,
              yPercent: -12,
              scale: 1.1,
              duration: duration * 0.85,
              ease: 'power2.inOut',
            },
            duration * 0.15,
          );
        if (near)
          timeline.to(near, { opacity: 0.42, duration: duration * 0.15 }, 0).to(
            near,
            {
              opacity: 0,
              xPercent: -22,
              yPercent: -8,
              scale: 1.08,
              duration: duration * 0.85,
              ease: 'power3.inOut',
            },
            duration * 0.15,
          );
        if (light)
          timeline.to(light, { opacity: 0.45, duration: duration * 0.2 }, 0).to(
            light,
            {
              opacity: 0,
              xPercent: 16,
              duration: duration * 0.8,
              ease: 'sine.inOut',
            },
            duration * 0.2,
          );
        if (vignette)
          timeline.fromTo(
            vignette,
            { opacity: 0.65 },
            { opacity: 0, duration, ease: 'power2.out' },
            0,
          );
        timeline.duration(duration);
        return () => clones.forEach((clone) => clone.remove());
      });
    },
  };
}
