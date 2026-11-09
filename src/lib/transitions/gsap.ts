import { gsap } from 'gsap';
import type { JourneyAnimator } from './runtime';

/** One GSAP context owns every style and tween, including rapid-click cleanup. */
export function createJourneyAnimator(stage: HTMLElement): JourneyAnimator {
  const fog = stage.querySelector('.caldera-veil__mineral');
  const previous = stage.querySelector('.caldera-veil__previous');
  const progress = stage.querySelector('.caldera-veil__progress');
  let context: gsap.Context | undefined;
  let timeline: gsap.core.Timeline | undefined;

  function reset() {
    context?.revert();
    context = undefined;
    timeline = undefined;
  }
  function animate(callback: () => void) {
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
            { opacity: 0.7 },
            { opacity: 1, duration: 0.28 },
            0,
          );
        if (previous)
          timeline.fromTo(
            previous,
            { opacity: 0.85, scale: 1, clipPath: 'inset(0% 0% 0% 0%)' },
            {
              opacity: 0,
              scale: 1.035,
              clipPath: 'inset(0% 0% 100% 0%)',
              duration: 0.38,
              ease: 'power2.inOut',
            },
            0,
          );
        if (scenery.length)
          timeline.fromTo(
            scenery,
            {
              scale: (index: number) => scales[index]! * 1.065,
              xPercent: direction * 1.5,
            },
            {
              scale: (index: number) => scales[index]!,
              xPercent: 0,
              duration: duration * 0.95,
              ease: 'power2.out',
            },
            0,
          );
        if (layers.length)
          timeline.fromTo(
            layers,
            {
              opacity: 0,
              y: mobile ? 18 : 28,
              x: direction * 24,
              clipPath: 'inset(0% 0% 100% 0%)',
            },
            {
              opacity: 1,
              y: 0,
              x: 0,
              clipPath: 'inset(0% 0% 0% 0%)',
              duration: 0.46,
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
        timeline.duration(duration);
      });
    },
  };
}
