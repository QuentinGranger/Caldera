import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { orderAccessUrl } from '@/lib/orders/access';
import { emptyAddress, type AddressValues } from '@/lib/checkout/types';
import type { CurrentCustomer } from './auth';
import { orderStatus, type OrderTone } from './orderStatus';

const HISTORY_LIMIT = 50;

/**
 * Orders shown in an account: those placed while signed in, and those placed
 * with the account's e-mail once it is verified (guest orders included). Only
 * real orders: paid, or whose payment Stripe is still confirming.
 */
export function customerOrdersWhere(
  customer: Pick<CurrentCustomer, 'id' | 'email' | 'emailVerified'>,
): Prisma.OrderWhereInput {
  return {
    AND: [
      {
        OR: [
          { customerId: customer.id },
          ...(customer.emailVerified
            ? [
                {
                  email: {
                    equals: customer.email,
                    mode: 'insensitive' as const,
                  },
                },
              ]
            : []),
        ],
      },
      {
        OR: [
          { paidAt: { not: null } },
          { status: { in: ['PAYMENT_PROCESSING', 'PAYMENT_REVIEW'] } },
        ],
      },
    ],
  };
}

export type AccountOrder = {
  orderNumber: string;
  label: string;
  tone: OrderTone;
  step: number | null;
  items: { name: string; quantity: number; imageUrl: string }[];
  total: string;
  createdAt: Date;
  itemCount: number;
  /** Signed detail link; null while the payment is not confirmed (no detail page yet). */
  href: string | null;
};

export async function getCustomerOrders(
  customer: Pick<CurrentCustomer, 'id' | 'email' | 'emailVerified'>,
): Promise<AccountOrder[]> {
  const orders = await getPrisma().order.findMany({
    where: customerOrdersWhere(customer),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: HISTORY_LIMIT,
    select: {
      publicId: true,
      orderNumber: true,
      status: true,
      fulfillmentStatus: true,
      totalAmount: true,
      createdAt: true,
      items: {
        select: { productName: true, quantity: true, imageUrl: true },
        orderBy: { createdAt: 'asc' },
      },
      payment: { select: { status: true } },
    },
  });
  return orders.map((order) => {
    // Same signed link as the confirmation e-mail, kept relative; the detail
    // page only opens paid orders (src/lib/orders/queries.ts).
    const viewable =
      order.status === 'PAID' && order.payment?.status === 'SUCCEEDED';
    const url = viewable ? new URL(orderAccessUrl(order.publicId)) : null;
    return {
      orderNumber: order.orderNumber,
      ...orderStatus(order),
      items: order.items.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        imageUrl: item.imageUrl,
      })),
      total: order.totalAmount.toFixed(2),
      createdAt: order.createdAt,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      href: url ? `${url.pathname}${url.search}` : null,
    };
  });
}

export async function getCustomerAddress(
  customerId: string,
): Promise<AddressValues | null> {
  const address = await getPrisma().customerAddress.findUnique({
    where: { customerId },
  });
  if (!address) return null;
  return {
    ...emptyAddress(),
    firstName: address.firstName,
    lastName: address.lastName,
    company: address.company ?? '',
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? '',
    postalCode: address.postalCode,
    city: address.city,
    region: address.region ?? '',
    countryCode: address.countryCode,
    phone: address.phone ?? '',
  };
}

export function getShippingCountries() {
  return getPrisma().shippingCountry.findMany({
    where: { isActive: true },
    select: { code: true, name: true },
    orderBy: { name: 'asc' },
  });
}
