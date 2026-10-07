import 'server-only';
import { publishedProductWhere } from '@/lib/catalog/queries';
import { languageLabels } from '@/lib/catalog/params';
import { getPrisma } from '@/lib/db/prisma';
import { formatPrice } from '@/utils/formatPrice';
import { sendStockAlertConfirmation } from './email';
import {
  newStockAlertToken,
  stockAlertTokenHash,
  verifyStockAlertRemovalToken,
} from './tokens';

/** Alerts an address may hold at once: nobody's inbox can be filled up. */
export const STOCK_ALERTS_PER_EMAIL = 30;
const CONFIRMATION_MS = 24 * 60 * 60_000;

export type StockAlertCustomer = {
  id: string;
  email: string;
  emailVerified: boolean;
};

/**
 * - active: recorded, e-mail already proven (signed-in customer);
 * - pending: a confirmation may have been sent (same answer whatever the
 *   address already holds, so nothing about it is revealed);
 * - available: the variant can be ordered now;
 * - not-found: no such variant on sale.
 */
export type StockAlertOutcome =
  'active' | 'pending' | 'available' | 'not-found';

async function alertableVariant(variantId: string) {
  return getPrisma().productVariant.findFirst({
    where: {
      id: variantId,
      isActive: true,
      product: { ...publishedProductWhere, isDemonstration: false },
    },
    select: {
      id: true,
      price: true,
      language: true,
      availableQuantity: true,
      product: { select: { name: true } },
    },
  });
}

export async function subscribeToStockAlert({
  email,
  variantId,
  customer,
}: {
  email: string;
  variantId: string;
  customer: StockAlertCustomer | null;
}): Promise<StockAlertOutcome> {
  const variant = await alertableVariant(variantId);
  if (!variant) return 'not-found';
  if (variant.availableQuantity > 0) return 'available';
  const db = getPrisma();
  const reset = {
    attemptCount: 0,
    nextAttemptAt: new Date(),
    leaseUntil: null,
    lastError: null,
    providerMessageId: null,
    notifiedAt: null,
  };
  // The account's e-mail is already proven: no confirmation round trip.
  if (customer?.emailVerified && customer.email === email) {
    const data = {
      status: 'ACTIVE' as const,
      customerId: customer.id,
      confirmedAt: new Date(),
      confirmationTokenHash: null,
      confirmationExpiresAt: null,
      ...reset,
    };
    await db.stockAlert.upsert({
      where: { email_variantId: { email, variantId } },
      create: { email, variantId, ...data },
      update: data,
    });
    return 'active';
  }
  const existing = await db.stockAlert.findUnique({
    where: { email_variantId: { email, variantId } },
    select: { status: true },
  });
  if (existing?.status === 'ACTIVE' || existing?.status === 'SENDING')
    return 'pending';
  const held = await db.stockAlert.count({
    where: { email, status: { in: ['PENDING', 'ACTIVE', 'SENDING'] } },
  });
  if (held >= STOCK_ALERTS_PER_EMAIL) return 'pending';
  const token = newStockAlertToken();
  const data = {
    status: 'PENDING' as const,
    customerId: null,
    confirmedAt: null,
    confirmationTokenHash: stockAlertTokenHash(token),
    confirmationExpiresAt: new Date(Date.now() + CONFIRMATION_MS),
    ...reset,
  };
  const alert = await db.stockAlert.upsert({
    where: { email_variantId: { email, variantId } },
    create: { email, variantId, ...data },
    update: data,
    select: { id: true },
  });
  await sendStockAlertConfirmation(
    email,
    {
      name: variant.product.name,
      language: languageLabels[variant.language],
      price: formatPrice(variant.price.toFixed(2)),
    },
    token,
    alert.id,
  );
  return 'pending';
}

/** True when a pending alert was confirmed by its (unexpired) token. */
export async function confirmStockAlert(token: string) {
  const result = await getPrisma().stockAlert.updateMany({
    where: {
      confirmationTokenHash: stockAlertTokenHash(token),
      status: 'PENDING',
      confirmationExpiresAt: { gt: new Date() },
    },
    data: {
      status: 'ACTIVE',
      confirmedAt: new Date(),
      confirmationTokenHash: null,
      confirmationExpiresAt: null,
      nextAttemptAt: new Date(),
    },
  });
  return result.count === 1;
}

/** Deletes the alert of a signed removal link (e-mail link). */
export async function removeStockAlertWithToken(token: unknown) {
  const id = verifyStockAlertRemovalToken(token);
  if (!id) return false;
  await getPrisma().stockAlert.deleteMany({ where: { id } });
  return true;
}

/** Alerts of a signed-in customer: asked while signed in, or with the verified e-mail. */
function customerAlertsWhere(customer: StockAlertCustomer) {
  return {
    OR: [
      { customerId: customer.id },
      ...(customer.emailVerified ? [{ email: customer.email }] : []),
    ],
  };
}

export async function getCustomerStockAlerts(customer: StockAlertCustomer) {
  const alerts = await getPrisma().stockAlert.findMany({
    where: {
      ...customerAlertsWhere(customer),
      status: { in: ['PENDING', 'ACTIVE', 'SENDING'] },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: STOCK_ALERTS_PER_EMAIL,
    select: {
      id: true,
      status: true,
      createdAt: true,
      variant: {
        select: {
          sku: true,
          language: true,
          availableQuantity: true,
          product: { select: { name: true, slug: true } },
        },
      },
    },
  });
  return alerts.map((alert) => ({
    id: alert.id,
    pending: alert.status === 'PENDING',
    createdAt: alert.createdAt,
    name: alert.variant.product.name,
    language: languageLabels[alert.variant.language],
    href: `/produit/${alert.variant.product.slug}?variant=${encodeURIComponent(alert.variant.sku)}`,
    backInStock: alert.variant.availableQuantity > 0,
  }));
}

export async function removeCustomerStockAlert(
  customer: StockAlertCustomer,
  id: string,
) {
  const result = await getPrisma().stockAlert.deleteMany({
    where: { id, ...customerAlertsWhere(customer) },
  });
  return result.count === 1;
}
