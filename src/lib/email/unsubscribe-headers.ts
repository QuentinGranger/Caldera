import 'server-only';
import { appOrigin } from '@/lib/orders/access';
import { newsletterUnsubscribeToken } from '@/lib/newsletter/tokens';
import { stockAlertRemovalToken } from '@/lib/stock-alerts/tokens';

/** Transport metadata, independent of analytics consent. Security mail has none. */
export function newsletterUnsubscribeHeaders(subscriberId: string) {
  const url = new URL('/api/newsletter/unsubscribe', appOrigin());
  url.searchParams.set('token', newsletterUnsubscribeToken(subscriberId));
  return {
    'List-Unsubscribe': `<${url.href}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'List-Id': 'Les Terres de Caldera <newsletter.lesterresdecaldera.fr>',
  };
}

export function stockAlertUnsubscribeHeaders(alertId: string) {
  const url = new URL('/api/stock-alerts/unsubscribe', appOrigin());
  url.searchParams.set('token', stockAlertRemovalToken(alertId));
  return {
    'List-Unsubscribe': `<${url.href}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'List-Id': 'Alertes stock Caldera <stock-alerts.lesterresdecaldera.fr>',
  };
}
