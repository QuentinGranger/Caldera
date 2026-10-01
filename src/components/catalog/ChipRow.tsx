'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A row of chips, swiped on phones: the current one (aria-current) is
 * brought to the middle of the row when it is out of view. Only the row
 * scrolls, never the page. Give it a `key` that changes with the current
 * chip, so it centres again after a navigation.
 */
export function ChipRow({ children }: { children: ReactNode }) {
  const row = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = row.current;
    const current = list?.querySelector('[aria-current]')?.closest('li');
    if (!list || !current || list.scrollWidth <= list.clientWidth) return;
    const box = list.getBoundingClientRect();
    const chip = current.getBoundingClientRect();
    if (chip.left >= box.left && chip.right <= box.right) return;
    list.scrollLeft +=
      chip.left - box.left - (list.clientWidth - chip.width) / 2;
  }, []);
  return <ul ref={row}>{children}</ul>;
}
