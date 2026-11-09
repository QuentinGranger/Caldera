import Link from '@/components/transitions/PrefetchLink';
import { canPrefetchPage } from '@/lib/transitions/navigation';
import type { ComponentProps, ReactNode } from 'react';
import styles from './Button.module.scss';
type Common = {
  children: ReactNode;
  variant?: 'primary' | 'gold' | 'outline';
  className?: string;
};
type Props = Common &
  (
    | { href: string }
    | (Omit<ComponentProps<'button'>, 'className' | 'children'> & {
        href?: never;
      })
  );
export function Button({
  href,
  variant = 'primary',
  className = '',
  children,
  ...buttonProps
}: Props) {
  const classes = `${styles.button} ${styles[variant]} ${className}`;
  if (href !== undefined)
    return (
      <Link
        href={href}
        prefetch={canPrefetchPage(href) ? true : undefined}
        className={classes}
      >
        {children}
      </Link>
    );
  return (
    <button type="button" className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
