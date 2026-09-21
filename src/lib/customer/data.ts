import 'server-only';
import { getPrisma } from '@/lib/db/prisma';

export async function claimGuestOrdersForVerifiedCustomer(customerId: string) {
  const customer = await getPrisma().customer.findUnique({
    where: { id: customerId },
    select: { email: true, emailVerifiedAt: true },
  });
  if (!customer?.emailVerifiedAt) return 0;
  const result = await getPrisma().order.updateMany({
    where: {
      customerId: null,
      email: { equals: customer.email, mode: 'insensitive' },
    },
    data: { customerId },
  });
  return result.count;
}

export const customerAddressSelect = {
  id: true,
  label: true,
  firstName: true,
  lastName: true,
  company: true,
  addressLine1: true,
  addressLine2: true,
  postalCode: true,
  city: true,
  region: true,
  countryCode: true,
  phone: true,
  isDefaultShipping: true,
  isDefaultBilling: true,
} as const;

export async function getCustomerAddresses(customerId: string) {
  return getPrisma().customerAddress.findMany({
    where: { customerId },
    select: customerAddressSelect,
    orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function getCustomerOrders(
  customerId: string,
  page = 1,
  pageSize = 10,
) {
  const safePage = Math.max(1, Math.floor(page));
  const [total, rows] = await getPrisma().$transaction([
    getPrisma().order.count({ where: { customerId } }),
    getPrisma().order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      select: {
        publicId: true,
        orderNumber: true,
        status: true,
        fulfillmentStatus: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
  ]);
  return {
    rows,
    page: safePage,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}

export async function getCustomerOrder(customerId: string, publicId: string) {
  return getPrisma().order.findFirst({
    where: { customerId, publicId },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      addresses: true,
      payment: true,
      pickupPoint: true,
      shipments: {
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        include: { trackingEvents: { orderBy: { occurredAt: 'desc' } } },
      },
    },
  });
}
