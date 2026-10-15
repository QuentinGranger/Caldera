'use client';
import { useEffect } from 'react';
import { analyticsAllowed, measureLocal } from '@/lib/analytics/client';
/** A view is presence, completion is an estimate; neither claims comprehension. */
export function CarnetAnalytics({
  chapterId,
  access,
}: {
  chapterId: string;
  access?: string;
}) {
  useEffect(() => {
    const article = document.querySelector('[data-carnet-reading]');
    const end = document.querySelector('[data-carnet-end]');
    if (!article || !end) return;
    let seconds = 0,
      viewed = false,
      complete = false,
      atEnd = false,
      bootstrapped = false;
    const reset = () => {
      if (!analyticsAllowed()) {
        seconds = 0;
        viewed = false;
        complete = false;
        atEnd = false;
        bootstrapped = false;
      }
    };
    const timer = setInterval(() => {
      if (!analyticsAllowed()) {
        reset();
        return;
      }
      if (!bootstrapped) {
        measureLocal('page_view');
        bootstrapped = true;
      }
      const bounds = article.getBoundingClientRect();
      if (
        document.visibilityState !== 'visible' ||
        bounds.bottom <= 0 ||
        bounds.top >= innerHeight
      )
        return;
      seconds++;
      if (seconds >= 10 && !viewed) {
        measureLocal('carnet_view', { chapterId, access });
        viewed = true;
      }
      const endBounds = end.getBoundingClientRect();
      atEnd = endBounds.bottom > 0 && endBounds.top < innerHeight;
      if (seconds >= 30 && atEnd && viewed && !complete) {
        measureLocal('carnet_complete', { chapterId, access });
        complete = true;
      }
    }, 1000);
    window.addEventListener('caldera:consent-changed', reset);
    window.addEventListener('storage', reset);
    return () => {
      clearInterval(timer);
      window.removeEventListener('caldera:consent-changed', reset);
      window.removeEventListener('storage', reset);
    };
  }, [chapterId, access]);
  return null;
}
