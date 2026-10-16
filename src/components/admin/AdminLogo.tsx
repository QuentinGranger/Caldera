import Image from 'next/image';
import styles from './Admin.module.scss';

export function AdminLogo() {
  return (
    <Image
      className={styles.brandImage}
      src="/assets/images/brand/caldera-admin-editorial.webp"
      alt="Caldera Administration"
      width={864}
      height={288}
      loading="eager"
      unoptimized
    />
  );
}
