import { ArrowUpRight, MessagesSquare } from 'lucide-react';
import { DISCORD_INVITE_URL } from '@/data/community';
import styles from './DiscordInviteLink.module.scss';

export function DiscordInviteLink({
  className = '',
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  return (
    <a
      href={DISCORD_INVITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.link} ${className}`}
      onClick={onClick}
    >
      <MessagesSquare size={18} aria-hidden="true" />
      <span>Rejoindre le Discord</span>
      <ArrowUpRight size={15} aria-hidden="true" />
      <span className={styles.srOnly}> (nouvel onglet)</span>
    </a>
  );
}
