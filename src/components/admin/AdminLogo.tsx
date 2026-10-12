import Image from 'next/image';
import styles from './Admin.module.scss';

export function AdminLogo() {
  return (
    <Image
      className={styles.brandImage}
      src="/assets/images/brand/caldera-admin.webp"
      alt="Caldera Administration"
      width={768}
      height={258}
      loading="eager"
      unoptimized
    />
  );
}
