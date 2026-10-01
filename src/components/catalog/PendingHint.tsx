'use client';
import { useLinkStatus } from 'next/link';
import styles from './Catalog.module.scss';

/**
 * Inside a <Link>: a fixed-size mark that pulses while the page it opens
 * loads (dynamic listings have no loading screen). No layout shift.
 */
export function PendingHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`${styles.pendingHint} ${pending ? styles.pending : ''}`}
    />
  );
}
