export const carriers = [
  { code: 'COLISSIMO', label: 'Colissimo', supportsTracking: true },
  { code: 'MONDIAL_RELAY', label: 'Mondial Relay', supportsTracking: true },
  { code: 'CHRONOPOST', label: 'Chronopost', supportsTracking: true },
  { code: 'UPS', label: 'UPS', supportsTracking: true },
  { code: 'DHL', label: 'DHL', supportsTracking: true },
  { code: 'OTHER', label: 'Autre', supportsTracking: false },
] as const;
export const fulfillmentLabels: Record<string, string> = {
  UNFULFILLED: 'Commande reçue',
  PREPARING: 'En préparation',
  READY_TO_SHIP: 'Prête à être expédiée',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
};
/** No unverified carrier URL template: use the actual URL supplied by the administrator. */
export function validTrackingUrl(value: string) {
  if (!value) return null;
  if (value.length > 2000 || /[\u0000-\u0020\u007f]/.test(value))
    throw new Error('URL de suivi invalide.');
  const url = new URL(value);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw new Error('URL de suivi HTTP(S) requise, sans identifiants.');
  return url.href;
}
