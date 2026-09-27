import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import type { AccountOrder } from '@/lib/account/queries';
import { ORDER_STEPS } from '@/lib/account/orderStatus';
import { formatPrice } from '@/utils/formatPrice';
import styles from './Account.module.scss';

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'Europe/Paris',
});

const TONE_CLASS = {
  payment: styles.tonePayment,
  progress: styles.toneProgress,
  shipped: styles.toneShipped,
  delivered: styles.toneDelivered,
  cancelled: styles.toneCancelled,
} as const;

const plural = (count: number, word: string) =>
  `${count} ${word}${count > 1 ? 's' : ''}`;

export function OrderBadge({ order }: { order: AccountOrder }) {
  return (
    <span className={`${styles.badge} ${TONE_CLASS[order.tone]}`}>
      {order.label}
    </span>
  );
}

/** Paid → prepared → shipped → delivered, the current step marked. */
export function OrderTimeline({ step }: { step: number }) {
  return (
    <ol className={styles.timeline} aria-label="Suivi de la commande">
      {ORDER_STEPS.map((label, index) => {
        const state =
          index < step ? 'done' : index === step ? 'current' : 'todo';
        return (
          <li
            key={label}
            className={styles[state]}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className={styles.dot} aria-hidden="true">
              {state !== 'todo' && <Check size={12} strokeWidth={3} />}
            </span>
            <span>
              {label}
              {state === 'done' && (
                <span className={styles.srOnly}> : terminé</span>
              )}
              {state === 'current' && (
                <span className={styles.srOnly}> : étape actuelle</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** One order: date, status, what it holds, total and its detail page. */
export function OrderCard({
  order,
  tracking = false,
}: {
  order: AccountOrder;
  /** Shows the delivery steps (open orders on the dashboard). */
  tracking?: boolean;
}) {
  const shown = order.items.slice(0, 3);
  const others = order.items
    .slice(3)
    .reduce((sum, item) => sum + item.quantity, 0);
  return (
    <article className={styles.orderCard}>
      <header className={styles.orderHeader}>
        <div>
          <p className={styles.orderDate}>
            Commande du {dateFormat.format(order.createdAt)}
          </p>
          <p className={styles.orderNumber}>N° {order.orderNumber}</p>
        </div>
        <OrderBadge order={order} />
      </header>

      {tracking && order.step !== null && <OrderTimeline step={order.step} />}

      <ul className={styles.orderItems}>
        {shown.map((item, index) => (
          <li key={`${item.name}-${index}`}>
            <Image
              src={item.imageUrl}
              alt=""
              width={48}
              height={60}
              className={styles.orderThumb}
            />
            <span>
              {item.name}
              {item.quantity > 1 && (
                <span className={styles.quantity}> × {item.quantity}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {others > 0 && (
        <p className={styles.orderMore}>+ {plural(others, 'autre article')}</p>
      )}

      <footer className={styles.orderFooter}>
        <p>
          <span className={styles.orderTotalLabel}>
            Total · {plural(order.itemCount, 'article')}
          </span>
          <strong>{formatPrice(order.total)}</strong>
        </p>
        {order.href ? (
          <Link href={order.href} className={styles.orderLink}>
            Voir le détail
            <span className={styles.srOnly}>
              {' '}
              de la commande {order.orderNumber}
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <p className={styles.orderPending}>
            Détail disponible dès la confirmation du paiement.
          </p>
        )}
      </footer>
    </article>
  );
}
