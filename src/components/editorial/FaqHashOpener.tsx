'use client';
import { useEffect } from 'react';

/** Opens the question a link points to (/questions#…), on arrival and after. */
export function FaqHashOpener() {
  useEffect(() => {
    function open() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (target instanceof HTMLDetailsElement) target.open = true;
    }
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
  return null;
}
