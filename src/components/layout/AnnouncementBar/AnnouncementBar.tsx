import { Compass } from 'lucide-react';
import styles from './AnnouncementBar.module.scss';
export function AnnouncementBar() {
  return (
    <div className={styles.bar}>
      <Compass size={13} aria-hidden="true" />
      <p>
        Bienvenue sur Les Terres de Caldera{' '}
        <span>— Votre prochaine découverte commence ici.</span>
      </p>
    </div>
  );
}
