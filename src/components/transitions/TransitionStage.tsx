'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import {
  landscapeTransitions,
  noteClick,
  presentArrival,
  resetPresentation,
} from '@/lib/transitions/runtime';

/** Persistent scenery connects click feedback and arrival without a second cut. */
export function TransitionStage() {
  const pathname = usePathname();
  const landscape = useSyncExternalStore(
    landscapeTransitions.subscribe,
    landscapeTransitions.get,
    landscapeTransitions.getServer,
  );
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
    <div className="caldera-veil" aria-hidden="true">
      {landscape && (
        <div
          className="caldera-veil__previous"
          style={{
            top: landscape.top,
            left: landscape.left,
            width: landscape.width,
            height: landscape.height,
            backgroundImage: `url(${JSON.stringify(landscape.src)})`,
            backgroundPosition: landscape.position,
            borderRadius: landscape.radius,
            filter: landscape.filter,
          }}
        />
      )}
      <div className="caldera-veil__mineral" />
      <div className="caldera-veil__progress" />
    </div>
  );
}
