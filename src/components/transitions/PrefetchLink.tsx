'use client';

import Link from 'next/link';
import { useState, type ComponentProps } from 'react';
import { canPrefetchPage } from '@/lib/transitions/navigation';

/** Upgrade public links to a full prefetch on hover, focus or touch intent. */
export default function PrefetchLink({
  prefetch,
  onPointerEnter,
  onPointerDown,
  onFocus,
  ...props
}: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  function warm(link: HTMLAnchorElement) {
    const url = new URL(link.href);
    if (
      prefetch !== false &&
      url.origin === location.origin &&
      canPrefetchPage(url.pathname + url.search + url.hash)
    )
      setIntent(true);
  }
  return (
    <Link
      {...props}
      prefetch={intent && prefetch !== false ? true : prefetch}
      onPointerEnter={(event) => {
        warm(event.currentTarget);
        onPointerEnter?.(event);
      }}
      onPointerDown={(event) => {
        if (event.button === 0) warm(event.currentTarget);
        onPointerDown?.(event);
      }}
      onFocus={(event) => {
        warm(event.currentTarget);
        onFocus?.(event);
      }}
    />
  );
}
