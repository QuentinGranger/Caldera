import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import styles from './IconButton.module.scss';
type Props = ComponentProps<'button'> & { label: string };
export function IconButton({
  label,
  children,
  className = '',
  ...props
}: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${styles.button} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
/** Same round icon target, as a link. */
export function IconLink({
  href,
  label,
  children,
  className = '',
}: {
  href: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`${styles.button} ${className}`}
    >
      {children}
    </Link>
  );
}
