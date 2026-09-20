import type { HTMLAttributes } from 'react';
import styles from './Container.module.scss';
export function Container({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`${styles.container} ${className}`} {...props} />;
}
