import type { ComponentProps } from 'react';
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
