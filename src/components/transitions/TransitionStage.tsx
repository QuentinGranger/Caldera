'use client';
import { usePathname } from 'next/navigation';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import { createJourneyAnimator } from '@/lib/transitions/gsap';
import {
  installJourneyAnimator,
  landscapeTransitions,
  noteClick,
  presentArrival,
  resetPresentation,
} from '@/lib/transitions/runtime';

/** Persistent scenery connects click feedback and arrival without a second cut. */
export function TransitionStage() {
  const pathname = usePathname();
  const stage = useRef<HTMLDivElement>(null);
  const landscape = useSyncExternalStore(
    landscapeTransitions.subscribe,
    landscapeTransitions.get,
    landscapeTransitions.getServer,
  );
  useLayoutEffect(() => {
    if (!stage.current) return;
    return installJourneyAnimator(createJourneyAnimator(stage.current));
  }, []);
  // First visits/reloads have no pending journey and remain immediately visible.
  useLayoutEffect(() => {
    presentArrival(pathname);
  }, [pathname]);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPreference = () => {
      if (preference.matches) resetPresentation();
    };
    document.addEventListener('click', noteClick, true);
    preference.addEventListener('change', onPreference);
    window.addEventListener('pagehide', resetPresentation);
    return () => {
      document.removeEventListener('click', noteClick, true);
      preference.removeEventListener('change', onPreference);
      window.removeEventListener('pagehide', resetPresentation);
      resetPresentation();
    };
  }, []);
  return (
    <div ref={stage} className="caldera-veil" aria-hidden="true">
      <div
        className="caldera-veil__previous"
        hidden={!landscape}
        style={
          landscape
            ? {
                top: landscape.top,
                left: landscape.left,
                width: landscape.width,
                height: landscape.height,
                backgroundImage: `url(${JSON.stringify(landscape.src)})`,
                backgroundPosition: landscape.position,
                borderRadius: landscape.radius,
                filter: landscape.filter,
              }
            : undefined
        }
      />
      <div className="caldera-veil__mineral" />
      <div className="caldera-veil__near" />
      <div className="caldera-veil__light" />
      <div className="caldera-veil__vignette" />
      <div className="caldera-veil__progress" />
    </div>
  );
}
