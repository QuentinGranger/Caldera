'use client';

import Link, { useLinkStatus } from 'next/link';
import styles from './PrefetchLink.module.scss';
import { useState, type ComponentProps } from 'react';
import { canPrefetchPage } from '@/lib/transitions/navigation';

/** Upgrade public links to a full prefetch on hover, focus or touch intent. */
export default function PrefetchLink({
  prefetch,
  children,
  pendingLabel,
  onPointerEnter,
  onPointerDown,
  onFocus,
  ...props
}: ComponentProps<typeof Link> & { pendingLabel?: string }) {
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
    >
      {children}
      {pendingLabel && <PendingHint label={pendingLabel} />}
    </Link>
  );
}

function PendingHint({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={styles.pending}
      data-pending={pending || undefined}
      role="status"
    >
      {pending ? label : ''}
    </span>
  );
}
